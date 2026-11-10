<?php
/*
 * CARUNO — add-on module for the shop's Dolibarr.
 *
 * Purchase prices stay on the server: the REST API does not send costs (cost price, average cost PMP, buy price of
 * invoice lines, margins, supplier prices, price of stock movements) to users without the Dolibarr right
 * "Read supplier prices" (produit > product_advance > read_supplier_prices) — the sellers. Dolibarr's own setting only
 * hides them in its web pages, not in the API used by the CARUNO counter app.
 *
 * Vehicles (API caruno/vehicles/..., class/api_caruno.class.php): VIN decoding (class/caruno_vin.class.php, rules from
 * scripts/parts/vin_decoder.py), with every search saved in llx_caruno_vin_lookup and customers' vehicles in
 * llx_caruno_vehicle (sql/). Reads the catalogue databases caruno_parts and vehicle_ref (read-only grant to the
 * Dolibarr database account: provisioning/41-caruno-catalogue-access.sh).
 * No menu, no page. Installed and activated by provisioning/40-caruno-module.sh.
 */
include_once DOL_DOCUMENT_ROOT.'/core/modules/DolibarrModules.class.php';

class modCaruno extends DolibarrModules
{
	public function __construct($db)
	{
		$this->db = $db;
		$this->numero = 525250;
		$this->rights_class = 'caruno';
		$this->family = 'other';
		$this->module_position = '90';
		$this->name = preg_replace('/^mod/i', '', get_class($this));
		$this->description = 'CARUNO : les prix d\'achat restent sur le serveur (API) pour les utilisateurs sans le droit « Lire les prix fournisseurs ».';
		$this->descriptionlong = $this->description;
		$this->editor_name = 'CARUNO';
		$this->version = '1.1.0';
		$this->const_name = 'MAIN_MODULE_'.strtoupper($this->name);
		$this->picto = 'generic';
		$this->module_parts = array('hooks' => array('api'));
		$this->dirs = array();
		$this->config_page_url = array();
		$this->hidden = false;
		$this->depends = array('modApi', 'modProduct');
		$this->requiredby = array();
		$this->conflictwith = array();
		$this->langfiles = array();
		$this->phpmin = array(7, 4);
		$this->need_dolibarr_version = array(19, 0);
		$this->const = array();
		$this->tabs = array();
		$this->dictionaries = array();
		$this->boxes = array();
		$this->cronjobs = array();
		$this->rights = array();
		$this->menu = array();
	}

	public function init($options = '')
	{
		// Tables of sql/ (CREATE TABLE ignored when the table already exists: data kept on re-activation).
		$result = $this->_load_tables('/caruno/sql/');
		if ($result < 0) {
			return -1;
		}
		return $this->_init(array(), $options);
	}

	public function remove($options = '')
	{
		return $this->_remove(array(), $options);
	}
}
