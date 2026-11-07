<?php
/*
 * Applies ONLY the "product_extrafields" section of a CARUNO shop profile (same code as configure.php),
 * so a new product field can be added to a running shop without re-applying the whole profile.
 * Run inside the Dolibarr container by 12-product-extrafields.sh. Idempotent: existing fields are UNCHANGED.
 */
define('NOLOGIN', 1);
define('NOCSRFCHECK', 1);
define('NOSESSION', 1);
define('NOREQUIREMENU', 1);
define('NOREQUIREHTML', 1);
$_SERVER['HTTP_HOST'] = 'localhost';

require '/var/www/html/master.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/class/extrafields.class.php';

$profile = json_decode(isset($PROFILE_JSON) ? $PROFILE_JSON : '', true);
if (!is_array($profile) || !isset($profile['product_extrafields'])) {
	fwrite(STDERR, "Invalid profile JSON or no product_extrafields\n");
	exit(2);
}
$errors = 0;
$ef = new ExtraFields($db);
$ef->fetch_name_optionals_label('product', true);
foreach ($profile['product_extrafields'] as $f) {
	if (!empty($ef->attributes['product']['type'][$f['code']])) {
		printf("%-9s %s\n", 'UNCHANGED', 'Extra field product.'.$f['code']);
		continue;
	}
	$res = $ef->addExtraField($f['code'], $f['label'], $f['type'], $f['position'], $f['size'], 'product', 0, 0, '', '', 1, '', '1', isset($f['help']) ? $f['help'] : '');
	if ($res <= 0) $errors++;
	printf("%-9s %s\n", $res > 0 ? 'CREATED' : 'ERROR', 'Extra field product.'.$f['code'].' ('.$f['label'].')'.($res > 0 ? '' : ': '.$ef->error));
}
exit($errors > 0 ? 1 : 0);
