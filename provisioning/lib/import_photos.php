<?php
/*
 * CARUNO photo import: attaches <ref>.jpg files to the Dolibarr products of the same ref.
 *
 * Runs inside the Dolibarr container as www-data. 25-import-photos.sh copies the photos into
 * the container and streams this file on stdin, prefixed with $PHOTOS_DIR and $ADMIN_LOGIN.
 * Same steps as a photo upload on the product card, with Dolibarr's own functions: product
 * directory (get_exdir), thumbnails (addThumbs), document index (addFileIntoDatabaseIndex).
 * Idempotent: every photo reports CREATED, CHANGED, UNCHANGED, SKIPPED (no such product) or ERROR.
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
require_once DOL_DOCUMENT_ROOT.'/core/lib/files.lib.php';

$counts = array('CREATED' => 0, 'CHANGED' => 0, 'UNCHANGED' => 0, 'SKIPPED' => 0, 'ERROR' => 0);

function report($status, $what)
{
	global $counts;
	$counts[$status]++;
	if ($status !== 'UNCHANGED') {
		printf("%-9s %s\n", $status, $what);
	}
}

$user = new User($db);
if ($user->fetch(0, $ADMIN_LOGIN) <= 0) {
	fwrite(STDERR, "Admin user not found\n");
	exit(3);
}
$user->loadRights();

$files = glob($PHOTOS_DIR.'/*.jpg');
sort($files);
foreach ($files as $src) {
	$ref = basename($src, '.jpg');
	$p = new Product($db);
	if ($p->fetch(0, $ref) <= 0) {
		report('SKIPPED', $ref.' (no product with this ref)');
		continue;
	}
	// Same directory as product/document.php and the documents API (produit/<ref>).
	$dir = $conf->product->multidir_output[$p->entity].'/'.get_exdir(0, 0, 0, 1, $p, 'product');
	$name = dol_sanitizeFileName($p->ref).'.jpg';
	$dest = $dir.'/'.$name;
	$existed = file_exists($dest);
	if ($existed && md5_file($dest) === md5_file($src)) {
		report('UNCHANGED', $ref);
		continue;
	}
	if (dol_mkdir($dir) < 0 || dol_copy($src, $dest, '0', 1) < 0) {
		report('ERROR', $ref.': cannot write '.$dest);
		continue;
	}
	$p->addThumbs($dest);
	if (!$existed) {
		addFileIntoDatabaseIndex($dir, $name, '', 'uploaded', 0, $p);
	}
	report($existed ? 'CHANGED' : 'CREATED', $ref);
}

printf("\nSUMMARY created=%d changed=%d unchanged=%d skipped=%d errors=%d\n", $counts['CREATED'], $counts['CHANGED'], $counts['UNCHANGED'], $counts['SKIPPED'], $counts['ERROR']);
exit($counts['ERROR'] > 0 ? 1 : 0);
