<?php
/*
 * Ensures the shop has its counter customer ("Client comptoir"), marked ref_ext = 'caruno:comptoir'.
 * The CARUNO front finds it by this marker: it is the customer of counter sales and carries the shop profile
 * (caruno-profil.json in its documents). Run inside the Dolibarr container by 16-counter-client.sh. Idempotent.
 *   - a customer already marked            -> UNCHANGED (its name is set to $COUNTER_NAME if different: CHANGED)
 *   - $COUNTER_ID given (existing shop)    -> that customer gets the marker and the name: CHANGED
 *   - otherwise                            -> a new customer is created: CREATED
 */
define('NOLOGIN', 1);
define('NOCSRFCHECK', 1);
define('NOSESSION', 1);
define('NOREQUIREMENU', 1);
define('NOREQUIREHTML', 1);
$_SERVER['HTTP_HOST'] = 'localhost';

require '/var/www/html/master.inc.php';
require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';

$MARK = 'caruno:comptoir';
$name = isset($COUNTER_NAME) && $COUNTER_NAME !== '' ? $COUNTER_NAME : 'Client comptoir';
$admin = new User($db);
if ($admin->fetch(0, isset($ADMIN_LOGIN) ? $ADMIN_LOGIN : 'admin') <= 0) { fwrite(STDERR, "Admin user not found\n"); exit(2); }
$admin->loadRights();

$res = $db->query("SELECT rowid FROM ".MAIN_DB_PREFIX."societe WHERE ref_ext = '".$db->escape($MARK)."' AND entity IN (".getEntity('societe').")");
$marked = $res ? $db->fetch_object($res) : null;
$id = $marked ? (int) $marked->rowid : (isset($COUNTER_ID) ? (int) $COUNTER_ID : 0);

$soc = new Societe($db);
if ($id > 0) {
	if ($soc->fetch($id) <= 0) { printf("%-9s %s\n", 'ERROR', "Customer id $id not found"); exit(1); }
	$changes = array();
	if ($soc->ref_ext !== $MARK) { $soc->ref_ext = $MARK; $changes[] = 'marker '.$MARK; }
	if ($soc->name !== $name) { $changes[] = 'name "'.$soc->name.'" -> "'.$name.'"'; $soc->name = $name; }
	if (empty($soc->client)) { $soc->client = 1; $changes[] = 'customer'; }
	if (!$changes) { printf("%-9s %s\n", 'UNCHANGED', 'Counter customer "'.$soc->name.'" (id '.$id.')'); exit(0); }
	$r = $soc->update($id, $admin, 1, 0, 0, 'update', 1);
	printf("%-9s %s\n", $r > 0 ? 'CHANGED' : 'ERROR', 'Counter customer id '.$id.': '.implode(', ', $changes).($r > 0 ? '' : ': '.$soc->error));
	exit($r > 0 ? 0 : 1);
}
$soc->name = $name;
$soc->client = 1;
$soc->code_client = -1;          // automatic code
$soc->country_id = 13;           // Algeria
$soc->ref_ext = $MARK;
$r = $soc->create($admin);
printf("%-9s %s\n", $r > 0 ? 'CREATED' : 'ERROR', 'Counter customer "'.$name.'"'.($r > 0 ? ' (id '.$r.')' : ': '.$soc->error));
exit($r > 0 ? 0 : 1);
