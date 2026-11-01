<?php
/*
 * CARUNO product import: creates or updates parts from a CSV, in Dolibarr 24.0.2.
 *
 * Runs inside the Dolibarr container as www-data. 20-import-products.sh streams this
 * file on stdin, prefixed with the CSV as $PRODUCTS_CSV and the admin login as $ADMIN_LOGIN.
 * Columns used (by header name): ref, label, description, brand, oem_ref.
 * Only Dolibarr's own PHP API is used (Product): no direct SQL writes.
 * Idempotent: every item reports CREATED, CHANGED, UNCHANGED or ERROR.
 * Prices, stock and barcodes are left alone (set by the shop afterwards).
 */

define('NOLOGIN', 1);
define('NOCSRFCHECK', 1);
define('NOSESSION', 1);
define('NOREQUIREMENU', 1);
define('NOREQUIREHTML', 1);
$_SERVER['HTTP_HOST'] = 'localhost';

require '/var/www/html/master.inc.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/product/class/product.class.php';

$counts = array('CREATED' => 0, 'CHANGED' => 0, 'UNCHANGED' => 0, 'ERROR' => 0);

function report($status, $what)
{
	global $counts;
	$counts[$status]++;
	printf("%-9s %s\n", $status, $what);
}

// fgetcsv on a memory stream: descriptions hold quoted line breaks.
$fh = fopen('php://memory', 'r+');
fwrite($fh, preg_replace('/^\xEF\xBB\xBF/', '', isset($PRODUCTS_CSV) ? $PRODUCTS_CSV : ''));
rewind($fh);
$header = fgetcsv($fh, 0, ';', '"', '');
foreach (array('ref', 'label', 'description', 'brand', 'oem_ref') as $col) {
	if (!is_array($header) || !in_array($col, $header, true)) {
		fwrite(STDERR, "Missing CSV column: ".$col."\n");
		exit(2);
	}
}

$user = new User($db);
if ($user->fetch(0, $ADMIN_LOGIN) <= 0) {
	fwrite(STDERR, "Admin user not found\n");
	exit(3);
}
$user->loadRights();

while (($cells = fgetcsv($fh, 0, ';', '"', '')) !== false) {
	if (count($cells) < count($header)) {
		continue;  // blank trailing line
	}
	$row = array_combine($header, $cells);
	$wanted = array(
		'label' => dol_trunc($row['label'], 255, 'right', 'UTF-8', 1),
		'description' => $row['description'],
		'options_brand' => $row['brand'],
		'options_oem_ref' => $row['oem_ref'],
	);
	$what = $row['ref'].' "'.$wanted['label'].'"';

	$p = new Product($db);
	if ($p->fetch(0, $row['ref']) > 0) {
		$changed = array();
		foreach (array('label', 'description') as $k) {
			if ((string) $p->$k !== $wanted[$k]) {
				$p->$k = $wanted[$k];
				$changed[] = $k;
			}
		}
		foreach (array('options_brand', 'options_oem_ref') as $k) {
			if ((string) (isset($p->array_options[$k]) ? $p->array_options[$k] : '') !== $wanted[$k]) {
				$p->array_options[$k] = $wanted[$k];
				$changed[] = substr($k, 8);
			}
		}
		if (!$changed) {
			report('UNCHANGED', $what);
			continue;
		}
		$res = $p->update($p->id, $user);
		report($res > 0 ? 'CHANGED' : 'ERROR', $what.' ('.implode(', ', $changed).')'.($res > 0 ? '' : ': '.$p->error));
		continue;
	}

	$p->ref = $row['ref'];
	$p->label = $wanted['label'];
	$p->description = $wanted['description'];
	$p->type = Product::TYPE_PRODUCT;
	$p->status = 1;      // on sale
	$p->status_buy = 1;  // on purchase
	$p->price_base_type = 'HT';
	$p->array_options = array('options_brand' => $wanted['options_brand'], 'options_oem_ref' => $wanted['options_oem_ref']);
	$id = $p->create($user);
	report($id > 0 ? 'CREATED' : 'ERROR', $what.($id > 0 ? ' (id '.$id.')' : ': '.$p->error.' '.implode(', ', $p->errors)));
}

printf("\nSUMMARY created=%d changed=%d unchanged=%d errors=%d\n", $counts['CREATED'], $counts['CHANGED'], $counts['UNCHANGED'], $counts['ERROR']);
exit($counts['ERROR'] > 0 ? 1 : 0);
