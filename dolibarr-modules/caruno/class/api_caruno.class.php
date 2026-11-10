<?php
/*
 * CARUNO — API of the add-on.
 *
 * POST caruno/belowcost {"lines": [{"id": <product id>, "price": <unit sale price>}, ...]}
 *   -> {"below": [<product id>, ...]}: the lines sold under the purchase price.
 * Lets the counter app warn a seller ("vente à perte") without sending the purchase price: the answer is only
 * yes / no per line. Purchase price used (same rule as the app): the higher of the average cost (PMP, or the cost
 * price when there is no PMP) and the most recent purchase (supplier price or supplier order reception).
 *
 * Vehicles (catalogue databases caruno_parts + vehicle_ref, read-only; test instance for now):
 *   POST caruno/vehicles/decode {"vin", "customer_id"?}
 *     -> decoder result + catalogue candidates (level exact / model / make / none); level none: VehiclesDB makes or
 *        models for a manual choice. Every search is saved (llx_caruno_vin_lookup) -> "lookup_id".
 *   POST caruno/vehicles/decode/{lookup_id}/choice {"model_id" | "vdb_model_id", "vehicle_type_id"?}
 *     -> saves the model / engine the seller chose (vehicle_type_id null = "Je ne sais pas").
 *   GET  caruno/vehicles/lookups?limit=   (admin) the latest searches, for review.
 */
use Luracast\Restler\RestException;

require_once DOL_DOCUMENT_ROOT.'/api/class/api.class.php';
require_once __DIR__.'/caruno_vin.class.php';

/**
 * CARUNO add-on API (login required: the two annotations below make Dolibarr check the API key)
 *
 * @access protected
 * @class  DolibarrApiAccess {@requires user,external}
 */
class Caruno extends DolibarrApi
{
	/** At most this many lines per call (a sale): no bulk probing of costs. */
	const MAX_LINES = 60;

	public function __construct()
	{
		global $db;
		$this->db = $db;
	}

	/**
	 * Lines of a sale sold under the purchase price
	 *
	 * @param array $lines Lines: [{"id": product id, "price": unit sale price}]
	 * @return array {"below": [product ids]}
	 *
	 * @url POST belowcost
	 * @throws RestException 403 Not allowed to read products
	 * @throws RestException 400 Bad request
	 */
	public function belowcost($lines)
	{
		if (!is_object(DolibarrApiAccess::$user) || empty(DolibarrApiAccess::$user->id)) {
			throw new RestException(401);
		}
		if (!DolibarrApiAccess::$user->hasRight('produit', 'lire')) {
			throw new RestException(403);
		}
		if (!is_array($lines) || count($lines) > self::MAX_LINES) {
			throw new RestException(400, 'lines: 1 to '.self::MAX_LINES.' lines');
		}
		$want = array();
		foreach ($lines as $l) {
			$l = (array) $l;
			$id = isset($l['id']) ? (int) $l['id'] : 0;
			$price = isset($l['price']) ? (float) $l['price'] : null;
			if ($id > 0 && $price !== null) {
				$want[] = array($id, $price);
			}
		}
		if (!$want) {
			return array('below' => array());
		}
		$ids = implode(',', array_unique(array_map(function ($w) {
			return (int) $w[0];
		}, $want)));
		$ref = $this->costRefs($ids);
		$below = array();
		foreach ($want as $w) {
			if (!empty($ref[$w[0]]) && $w[1] < $ref[$w[0]] && !in_array($w[0], $below, true)) {
				$below[] = $w[0];
			}
		}
		return array('below' => $below);
	}

	/* ===================================================================== VEHICLES */

	/** Catalogue maker name -> VehiclesDB make id, when the slug of the name is not enough. */
	const VDB_MAKE = array('VW' => 'volkswagen', 'MERCEDES-BENZ' => 'mercedes-benz', 'CITROEN' => 'citroen');

	private function parts()
	{
		return '`'.preg_replace('/[^a-z0-9_]/', '', getDolGlobalString('CARUNO_PARTS_DB', 'caruno_parts')).'`';
	}

	private function vref()
	{
		return '`'.preg_replace('/[^a-z0-9_]/', '', getDolGlobalString('CARUNO_VREF_DB', 'vehicle_ref')).'`';
	}

	/** Logged-in user allowed to read products (sellers and up). */
	private function seller()
	{
		$u = DolibarrApiAccess::$user;
		if (!is_object($u) || empty($u->id)) {
			throw new RestException(401);
		}
		if (!$u->hasRight('produit', 'lire')) {
			throw new RestException(403);
		}
		return $u;
	}

	/** Rows of a query, or 503 when the catalogue databases are not there (shop without catalogue yet). */
	private function rows($sql)
	{
		$res = $this->db->query($sql);
		if (!$res) {
			dol_syslog('CARUNO vehicles: '.$this->db->lasterror(), LOG_ERR);
			throw new RestException(503, 'Catalogue des véhicules indisponible sur ce serveur.');
		}
		$out = array();
		while ($o = $this->db->fetch_array($res)) {
			$out[] = $o;
		}
		return $out;
	}

	private static function modelKey($m)
	{
		return $m['maker'].'|'.$m['name'].'|'.(string) $m['generation'];
	}

	private static function modelLabel($m)
	{
		$y = $m['year_from'] ? ' '.$m['year_from'].'–'.($m['year_to'] ?: '') : '';
		return $m['maker'].' '.$m['name'].($m['generation'] ? ' ('.$m['generation'].')' : '').$y;
	}

	/** Catalogue models of a maker, in the decoder's format. */
	private function catalogueModels($maker)
	{
		$p = $this->parts();
		$rows = $this->rows("SELECT m.id, k.name AS maker, m.name, m.generation, m.year_from, m.year_to FROM ".$p.".models m"
			." JOIN ".$p.".manufacturers k ON k.id = m.manufacturer_id WHERE k.name = '".$this->db->escape($maker)."'");
		foreach ($rows as &$m) {
			$m['id'] = (int) $m['id'];
			$m['year_from'] = $m['year_from'] !== null ? (int) $m['year_from'] : null;
			$m['year_to'] = $m['year_to'] !== null ? (int) $m['year_to'] : null;
		}
		return $rows;
	}

	/** Manual choice when no catalogue model matches: the VehiclesDB models of the make, else all makes. */
	private function manualChoice($maker)
	{
		$v = $this->vref();
		if ($maker) {
			$id = isset(self::VDB_MAKE[$maker]) ? self::VDB_MAKE[$maker] : trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($maker)), '-');
			$make = $this->rows("SELECT id, name FROM ".$v.".vdb_makes WHERE kind = 'car' AND id = '".$this->db->escape($id)."'");
			if ($make) {
				$models = $this->rows("SELECT id AS vdb_model_id, name FROM ".$v.".vdb_models WHERE kind = 'car' AND make_id = '"
					.$this->db->escape($id)."' ORDER BY name");
				return array('make' => array('id' => $make[0]['id'], 'name' => $make[0]['name']), 'models' => $models);
			}
		}
		return array('makes' => $this->rows("SELECT id, name FROM ".$v.".vdb_makes WHERE kind = 'car' ORDER BY name"));
	}

	/**
	 * Decode a VIN and propose the matching catalogue models (the search is saved)
	 *
	 * @param string $vin         VIN as typed (spaces, dashes and lower case accepted)
	 * @param int    $customer_id Customer (third party) id, optional
	 * @return array
	 *
	 * @url POST vehicles/decode
	 * @throws RestException 400 Bad request
	 * @throws RestException 503 Catalogue not available
	 */
	public function decode($vin, $customer_id = null)
	{
		$u = $this->seller();
		$typed = trim((string) $vin);
		if ($typed === '' || strlen($typed) > 64) {
			throw new RestException(400, 'vin: 1 to 64 characters');
		}
		$soc = $customer_id ? (int) $customer_id : null;
		if ($soc && !$this->rows("SELECT rowid FROM ".MAIN_DB_PREFIX."societe WHERE rowid = ".$soc." AND entity IN (".getEntity('societe').")")) {
			throw new RestException(400, 'customer_id: unknown customer');
		}
		$d = CarunoVin::decode($typed);
		$match = array('level' => 'none', 'candidates' => array(), 'year' => null);
		if ($d['valid'] && $d['maker']) {
			$match = CarunoVin::matchModels($d, $this->catalogueModels($d['maker'] === 'MINI' ? 'BMW' : $d['maker']));
		}
		$candidates = array();
		foreach ($match['candidates'] as $m) {
			$candidates[] = array('model_id' => $m['id'], 'model_key' => self::modelKey($m), 'label' => self::modelLabel($m),
				'maker' => $m['maker'], 'name' => $m['name'], 'generation' => $m['generation'],
				'year_from' => $m['year_from'], 'year_to' => $m['year_to']);
		}
		$manual = ($d['valid'] && $match['level'] === 'none') ? $this->manualChoice($d['maker']) : null;

		$e = function ($s) {
			return $s === null || $s === '' ? 'NULL' : "'".$this->db->escape($s)."'";
		};
		$sql = "INSERT INTO ".MAIN_DB_PREFIX."caruno_vin_lookup (entity, vin, vin_typed, datec, fk_user, fk_soc, valid, maker,"
			." maker_source, model_years, year_confidence, level, candidates) VALUES ("
			.((int) $GLOBALS['conf']->entity).", ".$e(substr($d['vin'] !== '' ? $d['vin'] : $typed, 0, 17)).", "
			.$e($typed !== $d['vin'] ? substr($typed, 0, 64) : null).", '".$this->db->idate(dol_now())."', ".((int) $u->id).", "
			.($soc ?: 'NULL').", ".($d['valid'] ? 1 : 0).", ".$e($d['maker']).", ".$e($d['maker_source']).", "
			.$e(implode(',', $d['years'])).", ".$e($d['year_confidence']).", ".$e($match['level']).", "
			.$e(json_encode(array_column($candidates, 'model_key'), JSON_UNESCAPED_UNICODE)).")";
		if (!$this->db->query($sql)) {
			dol_syslog('CARUNO vin lookup: '.$this->db->lasterror(), LOG_ERR);
			throw new RestException(500, 'Recherche non enregistrée.');
		}
		return array('lookup_id' => (int) $this->db->last_insert_id(MAIN_DB_PREFIX.'caruno_vin_lookup'),
			'vin' => $d['vin'], 'valid' => $d['valid'], 'errors' => $d['errors'], 'check_digit_ok' => $d['check_digit_ok'],
			'maker' => $d['maker'], 'maker_source' => $d['maker_source'], 'years' => $d['years'],
			'year_confidence' => $d['year_confidence'], 'year' => $match['year'], 'level' => $match['level'],
			'candidates' => $candidates, 'manual' => $manual);
	}

	/**
	 * Save the model (and engine) the seller chose for a VIN search
	 *
	 * @param int    $id              Search id (lookup_id of vehicles/decode)
	 * @param int    $model_id        Catalogue model id (caruno_parts), or
	 * @param string $vdb_model_id    VehiclesDB model id ("renault/arkana") for a car not in the catalogue
	 * @param int    $vehicle_type_id Engine option of the model; null = "Je ne sais pas"
	 * @return array
	 *
	 * @url POST vehicles/decode/{id}/choice
	 * @throws RestException 400 Bad request
	 * @throws RestException 404 Search not found
	 */
	public function choice($id, $model_id = null, $vdb_model_id = null, $vehicle_type_id = null)
	{
		$u = $this->seller();
		$id = (int) $id;
		if (!$this->rows("SELECT rowid FROM ".MAIN_DB_PREFIX."caruno_vin_lookup WHERE rowid = ".$id." AND entity = ".((int) $GLOBALS['conf']->entity))) {
			throw new RestException(404, 'Recherche introuvable.');
		}
		list($key, $label, $engine, $vdb) = $this->resolveVehicle($model_id, $vdb_model_id, $vehicle_type_id);
		$e = function ($s) {
			return $s === null ? 'NULL' : "'".$this->db->escape($s)."'";
		};
		$this->db->query("UPDATE ".MAIN_DB_PREFIX."caruno_vin_lookup SET chosen_model_key = ".$e($key).", chosen_model_label = ".$e($label)
			.", chosen_engine = ".$e($engine).", chosen_engine_unknown = ".($model_id && !$engine ? 1 : 0).", chosen_vdb_model = ".$e($vdb)
			.", date_choice = '".$this->db->idate(dol_now())."', fk_user_choice = ".((int) $u->id)." WHERE rowid = ".$id);
		return array('lookup_id' => $id, 'model_key' => $key, 'model_label' => $label, 'engine' => $engine,
			'engine_unknown' => $model_id && !$engine, 'vdb_model_id' => $vdb);
	}

	/**
	 * Catalogue model (+ engine) or VehiclesDB model chosen by a seller -> array(model_key, label, engine label, vdb id).
	 * The engine must be one of the model's options (get_engine_options); none = "Je ne sais pas".
	 */
	private function resolveVehicle($model_id, $vdb_model_id, $vehicle_type_id)
	{
		$p = $this->parts();
		if ($model_id) {
			$m = $this->rows("SELECT m.id, k.name AS maker, m.name, m.generation, m.year_from, m.year_to FROM ".$p.".models m"
				." JOIN ".$p.".manufacturers k ON k.id = m.manufacturer_id WHERE m.id = ".((int) $model_id));
			if (!$m) {
				throw new RestException(400, 'model_id: unknown model');
			}
			$engine = null;
			if ($vehicle_type_id) {
				$vt = $this->rows("SELECT e.label FROM ".$p.".vehicle_types vt JOIN ".$p.".engines e ON e.id = vt.engine_id"
					." WHERE vt.id = ".((int) $vehicle_type_id)." AND vt.model_id = ".((int) $model_id));
				if (!$vt) {
					throw new RestException(400, 'vehicle_type_id: not an engine of this model');
				}
				$engine = $vt[0]['label'];
			}
			return array(self::modelKey($m[0]), self::modelLabel($m[0]), $engine, null);
		}
		if ($vdb_model_id) {
			$v = $this->rows("SELECT m.id, m.name, k.name AS make FROM ".$this->vref().".vdb_models m JOIN ".$this->vref().".vdb_makes k"
				." ON k.id = m.make_id AND k.kind = m.kind WHERE m.kind = 'car' AND m.id = '".$this->db->escape($vdb_model_id)."'");
			if (!$v) {
				throw new RestException(400, 'vdb_model_id: unknown model');
			}
			return array(null, $v[0]['make'].' '.$v[0]['name'], null, $v[0]['id']);
		}
		throw new RestException(400, 'model_id or vdb_model_id required');
	}

	/** Current catalogue ids of a saved model key / engine label (caruno_parts ids change at each rebuild). */
	private function currentIds($modelKey, $engine)
	{
		if (!$modelKey) {
			return array(null, null);
		}
		$p = $this->parts();
		list($maker, $name, $gen) = array_pad(explode('|', $modelKey, 3), 3, '');
		$b = function ($s) {
			return "CAST('".$this->db->escape($s)."' AS BINARY)";
		};
		$m = $this->rows("SELECT m.id FROM ".$p.".models m JOIN ".$p.".manufacturers k ON k.id = m.manufacturer_id"
			." WHERE CAST(k.name AS BINARY) = ".$b($maker)." AND CAST(m.name AS BINARY) = ".$b($name)
			." AND CAST(IFNULL(m.generation, '') AS BINARY) = ".$b($gen));
		if (!$m) {
			return array(null, null);
		}
		$mid = (int) $m[0]['id'];
		if ($engine === null) {
			return array($mid, null);
		}
		$vt = $this->rows("SELECT vt.id FROM ".$p.".vehicle_types vt JOIN ".$p.".engines e ON e.id = vt.engine_id"
			." WHERE vt.model_id = ".$mid." AND CAST(e.label AS BINARY) = ".$b($engine));
		return array($mid, $vt ? (int) $vt[0]['id'] : null);
	}

	private function customer($id, $right)
	{
		$u = $this->seller();
		if (!$u->hasRight('societe', $right)) {
			throw new RestException(403);
		}
		$id = (int) $id;
		if (!$this->rows("SELECT rowid FROM ".MAIN_DB_PREFIX."societe WHERE rowid = ".$id." AND entity IN (".getEntity('societe').")")) {
			throw new RestException(404, 'Client introuvable.');
		}
		return array($u, $id);
	}

	/**
	 * Engine options of a catalogue model (get_engine_options), "Je ne sais pas" last
	 *
	 * @param int $id Catalogue model id (caruno_parts)
	 * @return array [{vehicle_type_id, label, fuel, displacement_l}]; vehicle_type_id null = "Je ne sais pas"
	 *
	 * @url GET models/{id}/engines
	 * @throws RestException 404 Unknown model
	 */
	public function engines($id)
	{
		$this->seller();
		$p = $this->parts();
		$r = $this->rows("SELECT ".$p.".get_engine_options(m.id) AS o FROM ".$p.".models m WHERE m.id = ".((int) $id));
		if (!$r) {
			throw new RestException(404, 'Modèle introuvable.');
		}
		return json_decode($r[0]['o'], true);
	}

	/**
	 * Save a vehicle on a customer
	 *
	 * @param int    $id              Customer (third party) id
	 * @param string $vin             VIN (optional; must be a valid 17-character VIN when given)
	 * @param int    $model_id        Catalogue model id, or
	 * @param string $vdb_model_id    VehiclesDB model id ("renault/arkana") for a car not in the catalogue
	 * @param int    $vehicle_type_id Engine option of the model; null = "Je ne sais pas"
	 * @param string $production_date "2015", "2015-06" or "2015-06-20" (optional)
	 * @param int    $lookup_id       The VIN search it comes from (optional; its choice is saved too)
	 * @return array The saved vehicle
	 *
	 * @url POST customers/{id}/vehicles
	 * @throws RestException 400 Bad request
	 * @throws RestException 404 Unknown customer
	 */
	public function addVehicle($id, $vin = null, $model_id = null, $vdb_model_id = null, $vehicle_type_id = null, $production_date = null, $lookup_id = null)
	{
		list($u, $soc) = $this->customer($id, 'creer');
		list($key, $label, $engine, $vdb) = $this->resolveVehicle($model_id, $vdb_model_id, $vehicle_type_id);
		$v = null;
		if ($vin !== null && trim((string) $vin) !== '') {
			$d = CarunoVin::decode($vin);
			if (!$d['valid']) {
				throw new RestException(400, 'vin: '.implode(' ', $d['errors']));
			}
			$v = $d['vin'];
		}
		$date = null;
		if ($production_date !== null && $production_date !== '') {
			if (!preg_match('/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/', (string) $production_date, $g)
				|| !checkdate(isset($g[2]) ? (int) $g[2] : 1, isset($g[3]) ? (int) $g[3] : 1, (int) $g[1])
				|| (int) $g[1] < 1950 || (int) $g[1] > (int) date('Y') + 1) {
				throw new RestException(400, 'production_date: YYYY, YYYY-MM or YYYY-MM-DD');
			}
			$date = sprintf('%04d-%02d-%02d', $g[1], isset($g[2]) ? $g[2] : 1, isset($g[3]) ? $g[3] : 1);
		}
		$lk = $lookup_id ? (int) $lookup_id : null;
		if ($lk && !$this->rows("SELECT rowid FROM ".MAIN_DB_PREFIX."caruno_vin_lookup WHERE rowid = ".$lk." AND entity = ".((int) $GLOBALS['conf']->entity))) {
			throw new RestException(400, 'lookup_id: unknown search');
		}
		$e = function ($s) {
			return $s === null ? 'NULL' : "'".$this->db->escape($s)."'";
		};
		$ok = $this->db->query("INSERT INTO ".MAIN_DB_PREFIX."caruno_vehicle (entity, fk_soc, vin, model_key, model_label, vdb_model_id,"
			." production_date, engine_label, fk_vin_lookup, datec, fk_user_creat) VALUES (".((int) $GLOBALS['conf']->entity).", ".$soc.", "
			.$e($v).", ".$e($key).", ".$e($label).", ".$e($vdb).", ".$e($date).", ".$e($engine).", ".($lk ?: 'NULL').", '"
			.$this->db->idate(dol_now())."', ".((int) $u->id).")");
		if (!$ok) {
			dol_syslog('CARUNO vehicle: '.$this->db->lasterror(), LOG_ERR);
			throw new RestException(500, 'Véhicule non enregistré.');
		}
		$newId = (int) $this->db->last_insert_id(MAIN_DB_PREFIX.'caruno_vehicle');
		if ($lk) {   // the search gets the same choice and the customer
			$this->db->query("UPDATE ".MAIN_DB_PREFIX."caruno_vin_lookup SET chosen_model_key = ".$e($key).", chosen_model_label = ".$e($label)
				.", chosen_engine = ".$e($engine).", chosen_engine_unknown = ".($key && !$engine ? 1 : 0).", chosen_vdb_model = ".$e($vdb)
				.", date_choice = '".$this->db->idate(dol_now())."', fk_user_choice = ".((int) $u->id).", fk_soc = ".$soc." WHERE rowid = ".$lk);
		}
		return $this->vehicleRows("v.rowid = ".$newId)[0];
	}

	/**
	 * Vehicles of a customer
	 *
	 * @param int $id Customer (third party) id
	 * @return array
	 *
	 * @url GET customers/{id}/vehicles
	 * @throws RestException 404 Unknown customer
	 */
	public function vehicles($id)
	{
		list(, $soc) = $this->customer($id, 'lire');
		return $this->vehicleRows("v.fk_soc = ".$soc);
	}

	/**
	 * Compatible parts for a saved vehicle, with their label, OEM numbers and the shops that have them
	 *
	 * Statuses come from caruno_parts.compatible_parts() (the catalogue rules), labels:
	 *   confirmed -> "Compatible"; probable for this engine -> "Compatible (moteur)"; probable for the model ->
	 *   "Compatible (modèle)"; a_confirmer -> "À confirmer"; moteur_requis -> not listed (count in engine_needed);
	 *   unverified -> not shown.
	 * Shops: published (en_ligne = 1, for sale), stock > 0; price = public price, or "Sur devis" without a price.
	 * Never the exact stock, never a purchase price. A car not in the catalogue -> empty list, not an error.
	 *
	 * @param int    $id       Saved vehicle id (customers/{id}/vehicles)
	 * @param string $category Category or group name ("Freinage", "Filtre à huile"), optional
	 * @param int    $all      1 = also the parts no shop has in stock (shops empty); default: only parts a shop has
	 * @return array
	 *
	 * @url GET vehicles/{id}/parts
	 * @throws RestException 404 Unknown vehicle
	 */
	public function vehicleParts($id, $category = null, $all = 0)
	{
		$this->seller();
		$veh = $this->vehicleRows("v.rowid = ".((int) $id));
		if (!$veh) {
			throw new RestException(404, 'Véhicule introuvable.');
		}
		$veh = $veh[0];
		$out = array('vehicle' => array('id' => $veh['id'], 'label' => $veh['model_label'], 'engine' => $veh['engine'],
			'engine_unknown' => $veh['engine_unknown'], 'in_catalogue' => $veh['in_catalogue']),
			'category' => $category, 'engine_needed' => 0, 'message' => null, 'parts' => array());
		if (!$veh['in_catalogue']) {
			$out['message'] = 'Véhicule hors catalogue : aucune pièce connue pour ce modèle.';
			return $out;
		}
		$p = $this->parts();
		$filter = ($category === null || $category === '') ? 'NULL' : "'".$this->db->escape($category)."'";
		$res = $this->db->query("CALL ".$p.".compatible_parts(".((int) $veh['model_id']).", "
			.($veh['vehicle_type_id'] ? (int) $veh['vehicle_type_id'] : 'NULL').", ".$filter.")");
		if (!$res) {
			dol_syslog('CARUNO parts: '.$this->db->lasterror(), LOG_ERR);
			throw new RestException(503, 'Catalogue des véhicules indisponible sur ce serveur.');
		}
		$rows = array();
		while ($o = $this->db->fetch_array($res)) {
			$rows[] = $o;
		}
		$this->db->free($res);
		while ($this->db->db->more_results() && $this->db->db->next_result()) {   // CALL leaves a status result
			if ($x = $this->db->db->store_result()) {
				$x->free();
			}
		}

		$parts = array();
		foreach ($rows as $r) {
			if ($r['status'] === 'moteur_requis') {
				$out['engine_needed']++;
				continue;
			}
			// Evidence of the best row first: "<engine or modèle> · <confidence>[ · note]".
			$best = explode(' · ', explode(' | ', (string) $r['evidence'])[0]);
			$level = isset($best[0]) ? $best[0] : '';
			$conf = isset($best[1]) ? $best[1] : '';
			if ($conf === 'unverified') {
				continue;
			}
			if ($r['status'] === 'a_confirmer') {
				$label = 'À confirmer';
			} elseif ($conf === 'confirmed') {
				$label = 'Compatible';
			} elseif ($level !== 'modèle') {
				$label = 'Compatible (moteur)';
			} else {
				$label = 'Compatible (modèle)';
			}
			$parts[$r['ref']] = array('ref' => $r['ref'], 'name' => $r['name'], 'group' => $r['group_name'], 'category' => $r['category'],
				'status' => $r['status'], 'label' => $label, 'oem' => array(), 'shops' => array());
		}
		if (!$parts) {
			if ($out['engine_needed']) {
				$out['message'] = 'Précisez le moteur pour voir '.$out['engine_needed'].' pièce(s) qui en dépendent.';
			}
			return $out;
		}
		$refs = implode(',', array_map(function ($r) {
			return "'".$this->db->escape($r)."'";
		}, array_keys($parts)));
		foreach ($this->rows("SELECT a.ref, o.oem FROM ".$p.".articles a JOIN ".$p.".article_oem ao ON ao.article_id = a.id"
			." JOIN ".$p.".oem_numbers o ON o.id = ao.oem_id WHERE a.ref IN (".$refs.") ORDER BY o.oem") as $o) {
			$parts[$o['ref']]['oem'][] = $o['oem'];
		}
		global $mysoc;
		$x = MAIN_DB_PREFIX;
		foreach ($this->rows("SELECT p.ref, COALESCE((SELECT pp.price FROM ".$x."product_price pp WHERE pp.fk_product = p.rowid"
			." AND pp.price_level = 1 ORDER BY pp.date_price DESC, pp.rowid DESC LIMIT 1), p.price) AS price FROM ".$x."product p"
			." JOIN ".$x."product_extrafields ef ON ef.fk_object = p.rowid WHERE p.ref IN (".$refs.") AND p.entity IN (".getEntity('product').")"
			." AND ef.en_ligne = 1 AND p.tosell = 1 AND p.stock > 0") as $s) {
			$price = (float) $s['price'];
			$parts[$s['ref']]['shops'][] = array('shop' => $mysoc->name, 'available' => true,
				'price_mode' => $price > 0 ? 'fixe' : 'sur_devis', 'price' => $price > 0 ? price2num($price, 'MT') : null,
				'price_label' => $price > 0 ? price($price, 0, '', 1, -1, -1, $GLOBALS['conf']->currency) : 'Sur devis');
		}
		foreach ($parts as $part) {
			if ($all || $part['shops']) {
				$out['parts'][] = $part;
			}
		}
		if ($out['engine_needed']) {
			$out['message'] = 'Précisez le moteur pour voir '.$out['engine_needed'].' pièce(s) qui en dépendent.';
		}
		return $out;
	}

	/** Saved vehicles with their current catalogue ids (model_id / vehicle_type_id null when not in the catalogue). */
	private function vehicleRows($where)
	{
		$rows = $this->rows("SELECT v.rowid, v.fk_soc, v.vin, v.model_key, v.model_label, v.vdb_model_id, v.production_date, v.engine_label,"
			." v.fk_vin_lookup, v.datec FROM ".MAIN_DB_PREFIX."caruno_vehicle v WHERE v.entity = ".((int) $GLOBALS['conf']->entity)
			." AND ".$where." ORDER BY v.rowid DESC");
		$out = array();
		foreach ($rows as $r) {
			list($mid, $vt) = $this->currentIds($r['model_key'], $r['engine_label']);
			$out[] = array('id' => (int) $r['rowid'], 'customer_id' => (int) $r['fk_soc'], 'vin' => $r['vin'],
				'model_key' => $r['model_key'], 'model_label' => $r['model_label'], 'vdb_model_id' => $r['vdb_model_id'],
				'production_date' => $r['production_date'], 'engine' => $r['engine_label'],
				'engine_unknown' => $r['model_key'] !== null && $r['engine_label'] === null,
				'model_id' => $mid, 'vehicle_type_id' => $vt, 'in_catalogue' => $mid !== null,
				'lookup_id' => $r['fk_vin_lookup'] !== null ? (int) $r['fk_vin_lookup'] : null, 'created' => $r['datec']);
		}
		return $out;
	}

	/**
	 * Latest VIN searches (admin), for review
	 *
	 * @param int $limit Number of searches (1 to 500)
	 * @return array
	 *
	 * @url GET vehicles/lookups
	 * @throws RestException 403 Admin only
	 */
	public function lookups($limit = 50)
	{
		$u = $this->seller();
		if (empty($u->admin)) {
			throw new RestException(403, 'Réservé à l\'administrateur.');
		}
		$limit = max(1, min(500, (int) $limit));
		$rows = $this->rows("SELECT l.rowid AS id, l.vin, l.vin_typed, l.datec, u.login AS seller, l.fk_soc AS customer_id, l.valid, l.maker,"
			." l.maker_source, l.model_years, l.level, l.candidates, l.chosen_model_label, l.chosen_engine, l.chosen_engine_unknown,"
			." l.chosen_vdb_model, l.date_choice FROM ".MAIN_DB_PREFIX."caruno_vin_lookup l LEFT JOIN ".MAIN_DB_PREFIX."user u ON u.rowid = l.fk_user"
			." WHERE l.entity = ".((int) $GLOBALS['conf']->entity)." ORDER BY l.rowid DESC LIMIT ".$limit);
		foreach ($rows as &$r) {
			$r['candidates'] = $r['candidates'] ? json_decode($r['candidates'], true) : array();
		}
		return $rows;
	}

	/** Purchase price reference per product id (rounded like the app): max(PMP or cost price, last purchase). */
	private function costRefs($ids)
	{
		$p = MAIN_DB_PREFIX;
		$ref = array();
		$last = array();   // id => array(date, price)
		$take = function ($id, $price, $date) use (&$last) {
			if ($price > 0 && (!isset($last[$id]) || $date > $last[$id][0])) {
				$last[$id] = array($date, round($price));
			}
		};
		$res = $this->db->query("SELECT rowid, pmp, cost_price FROM ".$p."product WHERE rowid IN (".$ids.") AND entity IN (".getEntity('product').")");
		while ($res && ($o = $this->db->fetch_object($res))) {
			$ref[(int) $o->rowid] = (float) $o->pmp > 0 ? (float) $o->pmp : (float) $o->cost_price;
		}
		$res = $this->db->query("SELECT fk_product, unitprice, GREATEST(COALESCE(tms, datec), COALESCE(datec, tms)) AS d FROM ".$p."product_fournisseur_price WHERE fk_product IN (".$ids.")");
		while ($res && ($o = $this->db->fetch_object($res))) {
			$take((int) $o->fk_product, (float) $o->unitprice, (string) $o->d);
		}
		$res = $this->db->query("SELECT fk_product, price, datem FROM ".$p."stock_mouvement WHERE fk_product IN (".$ids.") AND origintype = 'order_supplier' AND value > 0");
		while ($res && ($o = $this->db->fetch_object($res))) {
			$take((int) $o->fk_product, (float) $o->price, (string) $o->datem);
		}
		foreach ($ref as $id => $c) {
			$ref[$id] = max($c, isset($last[$id]) ? $last[$id][1] : 0);
		}
		return $ref;
	}
}
