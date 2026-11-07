<?php
/*
 * Gives products their French name (label) and Arabic name (extra field nom_ar), keeping the supplier label
 * in the extra field nom_fournisseur. Input: $NAMES_CSV "ref;en;fr;ar" (scripts/parts/product_names.py).
 * $MODE = 'apply' (default) or 'restore' (label <- nom_fournisseur). Run by 30-product-names.sh. Idempotent.
 * Dolibarr PHP API only (Product extra fields + CommonObject::setValueFrom); reads use SQL, writes never do.
 *
 * apply, per product:
 *   nom_fournisseur empty, label = supplier label (en)  -> keep en in nom_fournisseur, label = fr, nom_ar = ar  (CHANGED)
 *   nom_fournisseur empty, label != en                  -> renamed by hand in the shop: left alone              (SKIPPED)
 *   already done (label = fr, nom_ar = ar)              -> UNCHANGED
 *   label != fr and label != nom_fournisseur            -> renamed by hand after the change: left alone         (SKIPPED)
 */
define('NOLOGIN', 1);
define('NOCSRFCHECK', 1);
define('NOSESSION', 1);
define('NOREQUIREMENU', 1);
define('NOREQUIREHTML', 1);
$_SERVER['HTTP_HOST'] = 'localhost';

require '/var/www/html/master.inc.php';
require_once DOL_DOCUMENT_ROOT.'/product/class/product.class.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';

$mode = isset($MODE) && $MODE === 'restore' ? 'restore' : 'apply';
$admin = new User($db);
if ($admin->fetch(0, isset($ADMIN_LOGIN) ? $ADMIN_LOGIN : 'admin') <= 0) { fwrite(STDERR, "Admin user not found\n"); exit(2); }

// Current state of every product (read).
$cur = array();
$sql = "SELECT p.rowid, p.ref, p.label, ef.nom_fournisseur, ef.nom_ar FROM ".MAIN_DB_PREFIX."product p"
	." LEFT JOIN ".MAIN_DB_PREFIX."product_extrafields ef ON ef.fk_object = p.rowid WHERE p.entity IN (".getEntity('product').")";
$res = $db->query($sql);
if (!$res) { fwrite(STDERR, "Read failed: ".$db->lasterror()."\n"); exit(2); }
while ($o = $db->fetch_object($res)) $cur[$o->ref] = $o;

$counts = array('CHANGED' => 0, 'UNCHANGED' => 0, 'SKIPPED' => 0, 'MISSING' => 0, 'ERROR' => 0);
$shown = 0;
function note($status, $msg) { global $counts, $shown; $counts[$status]++; if ($status !== 'UNCHANGED' && $status !== 'CHANGED' && $shown++ < 25) printf("%-9s %s\n", $status, $msg); }

// Writes one product: extra fields first (all of them, re-read, so brand / OEM / en_ligne are kept), then the label.
function write($id, $label, $nf, $ar) {
	global $db, $admin;
	$p = new Product($db);
	$p->id = $id;
	$p->fetch_optionals();
	$p->array_options['options_nom_fournisseur'] = $nf;
	$p->array_options['options_nom_ar'] = $ar;
	if ($p->insertExtraFields() < 0) return $p->error ?: 'extra fields';
	if ($p->setValueFrom('label', $label, '', null, 'text', '', $admin) < 0) return $p->error ?: 'label';
	return '';
}

$lines = preg_split('/\r?\n/', trim($NAMES_CSV));
array_shift($lines);                                      // header ref;en;fr;ar
$db->begin();
$n = 0;
foreach ($lines as $line) {
	if ($line === '') continue;
	list($ref, $en, $fr, $ar) = array_pad(str_getcsv($line, ';', '"', ''), 4, '');
	if (!isset($cur[$ref])) { note('MISSING', $ref); continue; }
	$o = $cur[$ref];
	$label = (string) $o->label; $nf = (string) $o->nom_fournisseur; $nar = (string) $o->nom_ar;
	if ($mode === 'restore') {
		if ($nf === '' || $label === $nf) { note('UNCHANGED', $ref); continue; }
		if ($label !== $fr) { note('SKIPPED', $ref.' renamed by hand: "'.$label.'"'); continue; }
		$err = write($o->rowid, $nf, $nf, $nar);
	} else {
		if ($nf === '' && $label !== $en) { note('SKIPPED', $ref.' renamed by hand: "'.$label.'"'); continue; }
		if ($nf !== '' && $label === $fr && $nar === $ar) { note('UNCHANGED', $ref); continue; }
		if ($nf !== '' && $label !== $fr && $label !== $nf) { note('SKIPPED', $ref.' renamed by hand: "'.$label.'"'); continue; }
		$err = write($o->rowid, $fr, $nf !== '' ? $nf : $en, $ar);
	}
	if ($err !== '') { note('ERROR', $ref.': '.$err); continue; }
	$counts['CHANGED']++;
	if (++$n % 500 === 0) { $db->commit(); $db->begin(); }
}
$db->commit();
printf("\nSUMMARY mode=%s changed=%d unchanged=%d skipped=%d missing=%d errors=%d\n", $mode, $counts['CHANGED'], $counts['UNCHANGED'], $counts['SKIPPED'], $counts['MISSING'], $counts['ERROR']);
exit($counts['ERROR'] > 0 ? 1 : 0);
