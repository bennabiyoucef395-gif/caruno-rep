<?php
/*
 * CARUNO — API hook: purchase prices are removed from the answers sent to users without the right
 * "Read supplier prices" (produit > product_advance > read_supplier_prices), and admins always see everything.
 *
 * How: Dolibarr calls the hook "beforeApiCall" before running an API request. The hook registers a listener on the
 * API engine's "compose" event (Restler), which runs after the request (the user is known) and before the answer is
 * turned into JSON. The listener removes the cost fields from the answer, at any depth (products, invoice lines…).
 *
 * Removed for those users:
 *   - everywhere: cost price, average cost (pmp), buy price of document lines (pa_ht…), margins, supplier prices
 *     (fourn_*), supplier statistics;
 *   - stock movements: their price (it is the purchase cost);
 *   - supplier price lists (products/{id}/purchase_prices, products/purchase_prices): an empty answer.
 * Requests and writes are not changed: Dolibarr still computes margins with the real costs.
 */
class ActionsCaruno
{
	public $results = array();
	public $resprints = '';
	public $error = '';
	public $errors = array();

	/** Fields that carry a purchase price or a margin, removed at any depth of the answer. */
	const COST_KEYS = array(
		'cost_price', 'pmp', 'buyprice', 'buy_price_ht', 'pa_ht', 'multicurrency_pa_ht', 'marge_tx', 'marque_tx',
		'total_marge', 'marge', 'fk_fournprice', 'product_fourn_price_id', 'best_purchase_price',
		'fourn_price', 'fourn_unitprice', 'fourn_pu', 'fourn_qty', 'fourn_remise', 'fourn_remise_percent',
		'fourn_unitcharges', 'fourn_charges', 'fourn_tva_tx', 'fourn_multicurrency_price', 'fourn_multicurrency_unitprice',
		'fourn_multicurrency_tx', 'fourn_multicurrency_id', 'fourn_multicurrency_code',
		'stats_facture_fournisseur', 'stats_facturefournrec', 'stats_commande_fournisseur', 'stats_reception',
	);

	public function beforeApiCall($parameters, &$object, &$action, $hookmanager)
	{
		if (!is_object($object) || empty($object->r) || !is_object($object->r)) {
			return 0;
		}
		$classfile = isset($parameters['classfile']) ? (string) $parameters['classfile'] : '';
		$url = isset($parameters['url']) ? (string) $parameters['url'] : '';
		$r = $object->r;
		// Bound to the API engine: its answer ($this->responseData) is a protected property.
		$r->onCompose(Closure::bind(function () use ($classfile, $url) {
			$this->responseData = ActionsCaruno::filter($this->responseData, $classfile, $url);
		}, $r, get_class($r)));
		return 0;
	}

	/** True when the API user may see purchase prices. */
	public static function canSeeCosts()
	{
		$user = class_exists('DolibarrApiAccess') ? DolibarrApiAccess::$user : null;
		if (!is_object($user) || empty($user->id)) {
			return false;
		}
		return !empty($user->admin) || $user->hasRight('produit', 'product_advance', 'read_supplier_prices');
	}

	public static function filter($data, $classfile, $url)
	{
		if ($data === null || self::canSeeCosts()) {
			return $data;
		}
		$path = strtok($url, '?');
		if (preg_match('#/purchase_prices/?$#', $path)) {
			return array();
		}
		return self::strip($data, $classfile === 'stockmovements', 0);
	}

	private static function strip($data, $movements, $depth)
	{
		if ($depth > 12) {
			return $data;
		}
		if (is_array($data)) {
			foreach ($data as $k => $v) {
				if (is_string($k) && (in_array($k, self::COST_KEYS, true) || ($movements && $k === 'price'))) {
					unset($data[$k]);
				} elseif (is_array($v) || is_object($v)) {
					$data[$k] = self::strip($v, $movements, $depth + 1);
				}
			}
			return $data;
		}
		if (is_object($data)) {
			foreach (get_object_vars($data) as $k => $v) {
				if (in_array($k, self::COST_KEYS, true) || ($movements && $k === 'price')) {
					unset($data->$k);
				} elseif (is_array($v) || is_object($v)) {
					$data->$k = self::strip($v, $movements, $depth + 1);
				}
			}
		}
		return $data;
	}
}
