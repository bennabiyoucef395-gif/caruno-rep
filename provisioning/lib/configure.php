<?php
/*
 * CARUNO provisioning engine: applies a shop profile to Dolibarr 24.0.2.
 *
 * Runs inside the Dolibarr container as www-data. 10-configure.sh streams this
 * file on stdin, prefixed with the profile as $PROFILE_JSON (keeps UTF-8 intact).
 * Only Dolibarr's own PHP API is used (dolibarr_set_const, activateModule,
 * Entrepot, Account, Categorie, ExtraFields): no direct SQL writes.
 * Idempotent: every item reports CREATED, CHANGED, UNCHANGED or ERROR.
 */

define('NOLOGIN', 1);
define('NOCSRFCHECK', 1);
define('NOSESSION', 1);
define('NOREQUIREMENU', 1);
define('NOREQUIREHTML', 1);
$_SERVER['HTTP_HOST'] = 'localhost';

require '/var/www/html/master.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/company.lib.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/categories/class/categorie.class.php';
require_once DOL_DOCUMENT_ROOT.'/product/stock/class/entrepot.class.php';
require_once DOL_DOCUMENT_ROOT.'/compta/bank/class/account.class.php';
require_once DOL_DOCUMENT_ROOT.'/core/class/extrafields.class.php';

$profile = json_decode(isset($PROFILE_JSON) ? $PROFILE_JSON : '', true);
if (!is_array($profile)) {
	fwrite(STDERR, "Invalid or missing profile JSON\n");
	exit(2);
}

$counts = array('CREATED' => 0, 'CHANGED' => 0, 'UNCHANGED' => 0, 'ERROR' => 0, 'INFO' => 0);

function report($status, $what)
{
	global $counts;
	$counts[$status]++;
	printf("%-9s %s\n", $status, $what);
}

function section($title)
{
	print "\n== ".$title."\n";
}

function setConst($name, $value, $entity = null)
{
	global $db, $conf;
	$entity = ($entity === null) ? $conf->entity : $entity;
	if ((string) getDolGlobalString($name) === (string) $value) {
		report('UNCHANGED', $name.' = '.$value);
		return;
	}
	$res = dolibarr_set_const($db, $name, $value, 'chaine', 0, '', $entity);
	report($res > 0 ? 'CHANGED' : 'ERROR', $name.' = '.$value);
}

// Act as the Dolibarr administrator (needed by module activation and object creation).
$user = new User($db);
if ($user->fetch(0, $profile['admin_login']) <= 0) {
	fwrite(STDERR, "Admin user not found\n");
	exit(3);
}
$user->loadRights();

// --- Modules -----------------------------------------------------------------
section('Modules');
foreach ($profile['modules']['enable'] as $module) {
	$const = 'MAIN_MODULE_'.strtoupper(substr($module, 3));
	if (getDolGlobalString($const)) {
		report('UNCHANGED', $module.' enabled');
		continue;
	}
	$res = activateModule($module);
	report(empty($res['errors']) ? 'CHANGED' : 'ERROR', $module.' enabled'.(empty($res['errors']) ? '' : ': '.implode(', ', $res['errors'])));
}
foreach ($profile['modules']['disable'] as $module) {
	$const = 'MAIN_MODULE_'.strtoupper(substr($module, 3));
	if (!getDolGlobalString($const)) {
		report('UNCHANGED', $module.' disabled');
		continue;
	}
	$res = unActivateModule($module);
	report(empty($res) ? 'CHANGED' : 'ERROR', $module.' disabled'.(empty($res) ? '' : ': '.$res));
}
// Reload constants and module flags so the rest of the run sees the new modules.
$conf->setValues($db);

// --- Company identity --------------------------------------------------------
section('Company');
$c = $profile['company'];
setConst('MAIN_INFO_SOCIETE_NOM', $c['name']);
setConst('MAIN_INFO_SOCIETE_ADDRESS', $c['address']);
setConst('MAIN_INFO_SOCIETE_ZIP', $c['zip']);
setConst('MAIN_INFO_SOCIETE_TOWN', $c['town']);
$state = getState((int) $c['state_id'], 'all', $db, 0, $langs, 0);
if (!empty($state['id'])) {
	setConst('MAIN_INFO_SOCIETE_STATE', $state['id'].':'.$state['code'].':'.$state['label']);
} else {
	report('ERROR', 'MAIN_INFO_SOCIETE_STATE: unknown state id '.$c['state_id']);
}
setConst('MAIN_INFO_SOCIETE_FORME_JURIDIQUE', $c['legal_form_code']);
setConst('MAIN_INFO_CAPITAL', $c['capital']);
setConst('MAIN_INFO_SOCIETE_TEL', $c['phone']);
setConst('MAIN_INFO_SOCIETE_MAIL', $c['email']);
// Algeria: ProfId1..4 = RC, NIF, AI, NIS (stored in Dolibarr's generic constants).
setConst('MAIN_INFO_SIREN', $c['profid']['rc']);
setConst('MAIN_INFO_SIRET', $c['profid']['nif']);
setConst('MAIN_INFO_APE', $c['profid']['ai']);
setConst('MAIN_INFO_RCS', $c['profid']['nis']);

// --- General -----------------------------------------------------------------
section('General');
setConst('MAIN_LANG_DEFAULT', $profile['general']['language']);
if (!empty($profile['general']['show_profids_on_documents'])) {
	for ($i = 1; $i <= 4; $i++) {
		setConst('MAIN_PROFID'.$i.'_IN_SOURCE_ADDRESS', '1');
		setConst('MAIN_PROFID'.$i.'_IN_ADDRESS', '1');
	}
}

// --- API: per-user sign-in from the CARUNO front (api/class/api_login.class.php)
section('API');
setConst('API_ENABLE_LOGIN_API', !empty($profile['api']['enable_login_api']) ? '1' : '');

// --- Pricing (same constants as product/admin/product.php, "other" action) --
section('Pricing');
$levels = $profile['pricing']['levels'];
$rules = array('PRODUCT_PRICE_UNIQ', 'PRODUIT_MULTIPRICES', 'PRODUIT_CUSTOMER_PRICES', 'PRODUIT_CUSTOMER_PRICES_AND_MULTIPRICES', 'PRODUIT_CUSTOMER_PRICES_BY_QTY', 'PRODUIT_CUSTOMER_PRICES_BY_QTY_MULTIPRICES');
foreach ($rules as $rule) {
	setConst($rule, $rule === 'PRODUIT_MULTIPRICES' ? '1' : '0');
}
setConst('PRODUIT_MULTIPRICES_LIMIT', (string) count($levels));
foreach ($levels as $i => $label) {
	setConst('PRODUIT_MULTIPRICES_LABEL'.($i + 1), $label);
}
setConst('PRODUCT_PRICE_BASE_TYPE', $profile['pricing']['price_base_type']);
setConst('MARGIN_TYPE', $profile['pricing']['margin_type']);

// --- Barcode -----------------------------------------------------------------
section('Barcode');
$code = $profile['barcode']['default_product_type'];
$resql = $db->query("SELECT rowid FROM ".MAIN_DB_PREFIX."c_barcode_type WHERE code = '".$db->escape($code)."' AND entity IN (".getEntity('c_barcode_type').")");
$obj = $resql ? $db->fetch_object($resql) : null;
if ($obj) {
	setConst('PRODUIT_DEFAULT_BARCODE_TYPE', (string) $obj->rowid);
} else {
	report('ERROR', 'Barcode type '.$code.' not found (is modBarcode enabled?)');
}

// --- Stock -------------------------------------------------------------------
section('Stock');
if (!empty($profile['stock']['disallow_negative'])) {
	setConst('STOCK_DISALLOW_NEGATIVE_TRANSFER', '1');
}
// Customer-side decrease: exactly one rule, chosen by the shop (same constants as product/stock/admin/stock.php).
// "bill": stock leaves when the invoice is validated; "shipment": when the shipment is validated.
$decreaseRules = array('bill' => 'STOCK_CALCULATE_ON_BILL', 'shipment' => 'STOCK_CALCULATE_ON_SHIPMENT');
$decreaseOn = isset($profile['stock']['decrease_on']) ? $profile['stock']['decrease_on'] : '';
if (!isset($decreaseRules[$decreaseOn])) {
	report('ERROR', 'stock.decrease_on must be "bill" or "shipment", got "'.$decreaseOn.'"');
} else {
	foreach (array('STOCK_CALCULATE_ON_BILL', 'STOCK_CALCULATE_ON_VALIDATE_ORDER', 'STOCK_CALCULATE_ON_SHIPMENT', 'STOCK_CALCULATE_ON_SHIPMENT_CLOSE') as $rule) {
		if ($rule === $decreaseRules[$decreaseOn]) {
			setConst($rule, '1');
		} elseif (getDolGlobalString($rule) === '') {
			report('UNCHANGED', $rule.' off');
		} else {
			$res = dolibarr_del_const($db, $rule, $conf->entity);
			report($res > 0 ? 'CHANGED' : 'ERROR', $rule.' off');
		}
	}
}
$supplierRules = array('STOCK_CALCULATE_ON_SUPPLIER_BILL', 'STOCK_CALCULATE_ON_SUPPLIER_VALIDATE_ORDER', 'STOCK_CALCULATE_ON_SUPPLIER_DISPATCH_ORDER', 'STOCK_CALCULATE_ON_RECEPTION', 'STOCK_CALCULATE_ON_RECEPTION_CLOSE');
$active = array_filter($supplierRules, function ($r) {
	return getDolGlobalString($r) !== '';
});
report('INFO', 'Supplier-side stock rules (not set by this script yet): '.($active ? implode(', ', $active) : 'none'));

foreach ($profile['warehouses'] as $w) {
	$wh = new Entrepot($db);
	if ($wh->fetch(0, $w['label']) > 0) {
		report('UNCHANGED', 'Warehouse "'.$w['label'].'" (id '.$wh->id.')');
		continue;
	}
	$wh->label = $w['label'];
	$wh->lieu = $w['location'];
	$wh->description = $w['description'];
	$wh->statut = Entrepot::STATUS_OPEN_ALL;
	$wh->country_id = $mysoc->country_id;
	$id = $wh->create($user);
	report($id > 0 ? 'CREATED' : 'ERROR', 'Warehouse "'.$w['label'].'"'.($id > 0 ? ' (id '.$id.')' : ': '.$wh->error));
}

// --- Bank and cash -----------------------------------------------------------
section('Bank accounts');
foreach ($profile['bank_accounts'] as $b) {
	$wantedType = ($b['type'] === 'cash') ? Account::TYPE_CASH : Account::TYPE_CURRENT;
	$acc = new Account($db);
	if ($acc->fetch(0, $b['ref']) > 0) {
		if ((int) $acc->type === $wantedType) {
			report('UNCHANGED', 'Account '.$b['ref'].' (id '.$acc->id.', type '.$wantedType.')');
		} else {
			$previous = $acc->type;
			$acc->type = $wantedType;
			$acc->courant = $wantedType;
			$res = $acc->update($user);
			report($res > 0 ? 'CHANGED' : 'ERROR', 'Account '.$b['ref'].' type '.$previous.' -> '.$wantedType.($res > 0 ? '' : ': '.$acc->error));
		}
		continue;
	}
	$acc->ref = $b['ref'];
	$acc->label = $b['label'];
	// "type" is what Dolibarr 24 stores (column courant); "courant" is deprecated.
	$acc->type = $wantedType;
	$acc->courant = $wantedType;
	$acc->bank = $b['bank'];
	$acc->currency_code = $conf->currency;
	$acc->country_id = $mysoc->country_id;
	$acc->date_solde = dol_now();
	$acc->solde = 0;
	$acc->clos = Account::STATUS_OPEN;
	$acc->min_allowed = 0;
	$acc->min_desired = 0;
	$acc->comment = 'Compte fictif - instance de développement CARUNO';
	$id = $acc->create($user);
	report($id > 0 ? 'CREATED' : 'ERROR', 'Account '.$b['ref'].' "'.$b['label'].'"'.($id > 0 ? ' (id '.$id.')' : ': '.$acc->error));
}

// --- Categories --------------------------------------------------------------
section('Categories');
foreach (array('product' => Categorie::TYPE_PRODUCT, 'customer' => Categorie::TYPE_CUSTOMER) as $key => $type) {
	foreach ($profile['categories'][$key] as $cdef) {
		$cat = new Categorie($db);
		if ($cat->fetch(0, '', $type, $cdef['code']) > 0) {
			report('UNCHANGED', ucfirst($key).' category "'.$cdef['label'].'" ['.$cdef['code'].'] (id '.$cat->id.')');
			continue;
		}
		$cat->label = $cdef['label'];
		$cat->type = $type;
		$cat->ref_ext = $cdef['code'];
		$cat->description = isset($cdef['description']) ? $cdef['description'] : '';
		$cat->fk_parent = 0;
		$cat->visible = 0;
		$id = $cat->create($user);
		report($id > 0 ? 'CREATED' : 'ERROR', ucfirst($key).' category "'.$cdef['label'].'" ['.$cdef['code'].']'.($id > 0 ? ' (id '.$id.')' : ': '.$cat->error));
	}
}

// --- Product extra fields ----------------------------------------------------
section('Product extra fields');
$ef = new ExtraFields($db);
$ef->fetch_name_optionals_label('product', true);
foreach ($profile['product_extrafields'] as $f) {
	if (!empty($ef->attributes['product']['type'][$f['code']])) {
		report('UNCHANGED', 'Extra field product.'.$f['code']);
		continue;
	}
	$res = $ef->addExtraField($f['code'], $f['label'], $f['type'], $f['position'], $f['size'], 'product', 0, 0, '', '', 1, '', '1', isset($f['help']) ? $f['help'] : '');
	report($res > 0 ? 'CREATED' : 'ERROR', 'Extra field product.'.$f['code'].' ('.$f['label'].')'.($res > 0 ? '' : ': '.$ef->error));
}

// --- Summary -----------------------------------------------------------------
printf("\nSUMMARY created=%d changed=%d unchanged=%d errors=%d\n", $counts['CREATED'], $counts['CHANGED'], $counts['UNCHANGED'], $counts['ERROR']);
exit($counts['ERROR'] > 0 ? 1 : 0);
