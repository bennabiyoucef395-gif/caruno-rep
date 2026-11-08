<?php
/*
 * Activates (or deactivates) the CARUNO add-on module (dolibarr-modules/caruno, copied to htdocs/custom/caruno by
 * 40-caruno-module.sh). Run inside the Dolibarr container. Idempotent.
 *   $CARUNO_ACTION = 'on'  -> module active (hooks registered): CHANGED, or UNCHANGED if it already was
 *   $CARUNO_ACTION = 'off' -> module disabled
 */
define('NOLOGIN', 1);
define('NOCSRFCHECK', 1);
define('NOSESSION', 1);
define('NOREQUIREMENU', 1);
define('NOREQUIREHTML', 1);
$_SERVER['HTTP_HOST'] = 'localhost';

require '/var/www/html/master.inc.php';
require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';

$user = new User($db);
if ($user->fetch(0, isset($ADMIN_LOGIN) ? $ADMIN_LOGIN : 'admin') <= 0 || empty($user->admin)) { fwrite(STDERR, "Admin user not found\n"); exit(2); }
$user->loadRights();

$on = !isset($CARUNO_ACTION) || $CARUNO_ACTION !== 'off';
$active = isModEnabled('caruno');
if (!file_exists(DOL_DOCUMENT_ROOT.'/custom/caruno/core/modules/modCaruno.class.php')) { printf("%-9s %s\n", 'ERROR', 'custom/caruno not found'); exit(1); }

if ($on) {
	// Re-activating re-registers the hooks (also after an update of the module files).
	$res = activateModule('modCaruno');
	$err = !empty($res['errors']) ? implode(' ; ', $res['errors']) : '';
	if ($err) { printf("%-9s %s\n", 'ERROR', 'CARUNO module: '.$err); exit(1); }
	$hooks = $db->query("SELECT value FROM ".MAIN_DB_PREFIX."const WHERE name = 'MAIN_MODULE_CARUNO_HOOKS' AND entity IN (0, ".((int) $conf->entity).")");
	$h = $hooks ? $db->fetch_object($hooks) : null;
	printf("%-9s %s\n", $active ? 'UNCHANGED' : 'CHANGED', 'CARUNO module active, hooks: '.($h ? $h->value : '(none)'));
} else {
	if (!$active) { printf("%-9s %s\n", 'UNCHANGED', 'CARUNO module already disabled'); exit(0); }
	unActivateModule('modCaruno');
	printf("%-9s %s\n", 'CHANGED', 'CARUNO module disabled');
}
