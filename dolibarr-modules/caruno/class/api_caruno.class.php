<?php
/*
 * CARUNO — API of the add-on.
 *
 * POST caruno/belowcost {"lines": [{"id": <product id>, "price": <unit sale price>}, ...]}
 *   -> {"below": [<product id>, ...]}: the lines sold under the purchase price.
 * Lets the counter app warn a seller ("vente à perte") without sending the purchase price: the answer is only
 * yes / no per line. Purchase price used (same rule as the app): the higher of the average cost (PMP, or the cost
 * price when there is no PMP) and the most recent purchase (supplier price or supplier order reception).
 */
use Luracast\Restler\RestException;

require_once DOL_DOCUMENT_ROOT.'/api/class/api.class.php';

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
