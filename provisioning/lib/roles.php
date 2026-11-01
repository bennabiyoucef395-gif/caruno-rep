<?php
/*
 * CARUNO provisioning engine: groups, users, permissions and the API account.
 *
 * Runs inside the Dolibarr container as www-data. 15-roles.sh streams this file
 * on stdin, prefixed with $ROLES_JSON (the role matrix, versioned) and
 * $SECRETS_JSON (passwords and API key, never versioned, never printed).
 * Only Dolibarr's PHP API writes data (UserGroup, User, dolibarr_set_const);
 * SQL is used read-only to resolve right ids and compare current rights.
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
require_once DOL_DOCUMENT_ROOT.'/core/lib/security.lib.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/usergroup.class.php';

$roles = json_decode(isset($ROLES_JSON) ? $ROLES_JSON : '', true);
$secrets = json_decode(isset($SECRETS_JSON) ? $SECRETS_JSON : '', true);
if (!is_array($roles) || !is_array($secrets)) {
	fwrite(STDERR, "Invalid or missing roles/secrets JSON\n");
	exit(2);
}

$counts = array('CREATED' => 0, 'CHANGED' => 0, 'UNCHANGED' => 0, 'ERROR' => 0);

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

/** Returns the rights_def id of a "module:perms[:subperms]" key, or 0. */
function rightId($key)
{
	global $db, $conf;
	$parts = explode(':', $key);
	$sql = "SELECT id FROM ".MAIN_DB_PREFIX."rights_def WHERE entity = ".((int) $conf->entity);
	$sql .= " AND module = '".$db->escape($parts[0])."' AND perms = '".$db->escape($parts[1])."'";
	$sql .= isset($parts[2]) ? " AND subperms = '".$db->escape($parts[2])."'" : " AND (subperms IS NULL OR subperms = '')";
	$res = $db->query($sql);
	$obj = $res ? $db->fetch_object($res) : null;
	return $obj ? (int) $obj->id : 0;
}

/**
 * Rights Dolibarr adds together with $key (same rule as UserGroup::addrights /
 * User::addrights): the "lire"/"read" right of the same perms, and of the module.
 */
function impliedIds($key)
{
	$parts = explode(':', $key);
	$ids = array();
	$candidates = array();
	if (isset($parts[2])) {
		$candidates[] = $parts[0].':'.$parts[1].':lire';
		$candidates[] = $parts[0].':'.$parts[1].':read';
	}
	$candidates[] = $parts[0].':lire';
	$candidates[] = $parts[0].':read';
	foreach ($candidates as $c) {
		$id = rightId($c);
		if ($id) {
			$ids[] = $id;
		}
	}
	return $ids;
}

/** Resolves a list of keys into [declared ids, expected ids (declared + implied)]. */
function resolveRights($keys, $label)
{
	$declared = array();
	$expected = array();
	foreach ($keys as $key) {
		$id = rightId($key);
		if (!$id) {
			report('ERROR', $label.': unknown right '.$key);
			continue;
		}
		$declared[$id] = $key;
		$expected[$id] = true;
		foreach (impliedIds($key) as $iid) {
			$expected[$iid] = true;
		}
	}
	return array($declared, array_keys($expected));
}

function currentIds($table, $fkField, $fkId)
{
	global $db, $conf;
	$ids = array();
	$res = $db->query("SELECT fk_id FROM ".MAIN_DB_PREFIX.$table." WHERE ".$fkField." = ".((int) $fkId)." AND entity = ".((int) $conf->entity));
	while ($res && ($obj = $db->fetch_object($res))) {
		$ids[] = (int) $obj->fk_id;
	}
	return $ids;
}

/** Makes the rights of $object (UserGroup or User) exactly match the declared keys. */
function syncRights($object, $table, $fkField, $keys, $label)
{
	global $conf;
	list($declared, $expected) = resolveRights($keys, $label);
	$added = 0;
	$removed = 0;
	$errors = 0;
	$current = currentIds($table, $fkField, $object->id);
	foreach ($declared as $id => $key) {
		if (!in_array($id, $current)) {
			if ($object->addrights($id, '', '', $conf->entity) > 0) {
				$added++;
			} else {
				$errors++;
			}
		}
	}
	foreach (currentIds($table, $fkField, $object->id) as $id) {
		if (!in_array($id, $expected)) {
			if ($object->delrights($id, '', '', $conf->entity) > 0) {
				$removed++;
			} else {
				$errors++;
			}
		}
	}
	$final = count(currentIds($table, $fkField, $object->id));
	$status = $errors ? 'ERROR' : (($added || $removed) ? 'CHANGED' : 'UNCHANGED');
	report($status, sprintf('%s rights: %d declared, %d effective (+%d, -%d)', $label, count($declared), $final, $added, $removed));
}

function secret($name)
{
	global $secrets;
	if (empty($secrets[$name]) || strlen($secrets[$name]) < 20) {
		report('ERROR', 'Secret '.$name.' missing or too short');
		return null;
	}
	return $secrets[$name];
}

/** Creates the user if missing and enforces non-admin status; returns the User or null. */
function ensureUser($def, $employee)
{
	global $db, $conf, $user;
	$u = new User($db);
	if ($u->fetch(0, $def['login']) > 0) {
		if (!empty($u->admin)) {
			report('ERROR', 'User '.$def['login'].' is an administrator: refusing to manage it');
			return null;
		}
		report('UNCHANGED', 'User '.$def['login'].' (id '.$u->id.', admin=0)');
		return $u;
	}
	$u->login = $def['login'];
	$u->firstname = $def['firstname'];
	$u->lastname = $def['lastname'];
	$u->email = $def['email'];
	$u->admin = 0;
	$u->employee = $employee;
	$u->entity = $conf->entity;
	if (!empty($def['note'])) {
		$u->note_private = $def['note'];
	}
	$id = $u->create($user);
	if ($id <= 0) {
		report('ERROR', 'User '.$def['login'].': '.$u->error);
		return null;
	}
	$u->fetch($id);
	report('CREATED', 'User '.$def['login'].' (id '.$id.', admin=0)');
	return $u;
}

/** Sets the password unless it already matches (checked against the stored hash). */
function ensurePassword($u, $password)
{
	global $user;
	if ($password === null) {
		return;
	}
	if (!empty($u->pass_indatabase_crypted) && dol_verifyHash($password, $u->pass_indatabase_crypted)) {
		report('UNCHANGED', 'Password of '.$u->login.' (bcrypt)');
		return;
	}
	$res = $u->setPassword($user, $password);
	report((is_string($res) || $res > 0) ? 'CHANGED' : 'ERROR', 'Password of '.$u->login.' set (bcrypt, value not shown)');
}

// Act as the Dolibarr administrator.
$user = new User($db);
if ($user->fetch(0, $roles['admin_login']) <= 0 || empty($user->admin)) {
	fwrite(STDERR, "Admin user not found\n");
	exit(3);
}
$user->loadRights();

// --- Advanced permissions ----------------------------------------------------
section('Advanced permissions');
$wanted = !empty($roles['advanced_permissions']) ? '1' : '';
if ((string) getDolGlobalString('MAIN_USE_ADVANCED_PERMS') === $wanted) {
	report('UNCHANGED', 'MAIN_USE_ADVANCED_PERMS = '.$wanted);
} else {
	// Same call as admin/security_other.php.
	$res = $wanted ? dolibarr_set_const($db, 'MAIN_USE_ADVANCED_PERMS', '1', 'chaine', 0, '', $conf->entity) : dolibarr_del_const($db, 'MAIN_USE_ADVANCED_PERMS', $conf->entity);
	report($res > 0 ? 'CHANGED' : 'ERROR', 'MAIN_USE_ADVANCED_PERMS = '.$wanted);
}

// --- Groups ------------------------------------------------------------------
section('Groups');
$groupIds = array();
foreach ($roles['groups'] as $name => $gdef) {
	$g = new UserGroup($db);
	if ($g->fetch(0, $name) > 0) {
		report('UNCHANGED', 'Group "'.$name.'" (id '.$g->id.')');
	} else {
		$g->name = $name;
		$g->note = $gdef['note'];
		$g->entity = $conf->entity;
		$id = $g->create();
		if ($id <= 0) {
			report('ERROR', 'Group "'.$name.'": '.$g->error);
			continue;
		}
		$g->fetch($id);
		report('CREATED', 'Group "'.$name.'" (id '.$id.')');
	}
	$groupIds[$name] = $g->id;
	syncRights($g, 'usergroup_rights', 'fk_usergroup', array_merge($gdef['rights'], $roles['self_rights']), 'Group "'.$name.'"');
}

// --- Test users --------------------------------------------------------------
section('Test users');
foreach ($roles['users'] as $udef) {
	$u = ensureUser($udef, 1);
	if (!$u) {
		continue;
	}
	ensurePassword($u, secret($udef['secret_key']));
	// Rights come from the group only: no direct user rights.
	syncRights($u, 'user_rights', 'fk_user', array(), 'User '.$u->login.' direct');
	// Exactly one group: the declared one.
	$target = isset($groupIds[$udef['group']]) ? $groupIds[$udef['group']] : 0;
	$member = array();
	$res = $db->query("SELECT fk_usergroup FROM ".MAIN_DB_PREFIX."usergroup_user WHERE fk_user = ".((int) $u->id)." AND entity = ".((int) $conf->entity));
	while ($res && ($obj = $db->fetch_object($res))) {
		$member[] = (int) $obj->fk_usergroup;
	}
	$changed = false;
	foreach ($member as $gid) {
		if ($gid !== $target) {
			$u->RemoveFromGroup($gid, $conf->entity);
			$changed = true;
		}
	}
	if ($target && !in_array($target, $member)) {
		$changed = ($u->SetInGroup($target, $conf->entity) > 0) || $changed;
	}
	report($changed ? 'CHANGED' : 'UNCHANGED', 'User '.$u->login.' member of "'.$udef['group'].'" only');
}

// --- CARUNO API technical account --------------------------------------------
section('CARUNO API account');
$adef = $roles['api_user'];
$api = ensureUser($adef, 0);
if ($api) {
	// Random password nobody knows: the account is meant for API keys only.
	ensurePassword($api, null);
	if (empty($api->pass_indatabase_crypted)) {
		$res = $api->setPassword($user, bin2hex(random_bytes(24)));
		report((is_string($res) || $res > 0) ? 'CHANGED' : 'ERROR', 'Password of '.$api->login.' set to an unknown random value');
	}
	syncRights($api, 'user_rights', 'fk_user', $adef['rights'], 'User '.$api->login.' direct');
	$res = $db->query("SELECT COUNT(*) AS nb FROM ".MAIN_DB_PREFIX."usergroup_user WHERE fk_user = ".((int) $api->id));
	$obj = $res ? $db->fetch_object($res) : null;
	report(($obj && (int) $obj->nb === 0) ? 'UNCHANGED' : 'ERROR', 'User '.$api->login.' belongs to no group');

	$key = secret($adef['api_key_secret']);
	if ($key !== null) {
		$api->fetch($api->id);
		if ((string) $api->api_key === $key) {
			report('UNCHANGED', 'API key of '.$api->login.' (stored encrypted, value not shown)');
		} else {
			$api->api_key = $key;
			$res = $api->update($user);
			report($res > 0 ? 'CHANGED' : 'ERROR', 'API key of '.$api->login.' set (stored encrypted, value not shown)'.($res > 0 ? '' : ': '.$api->error));
		}
	}
}

printf("\nSUMMARY created=%d changed=%d unchanged=%d errors=%d\n", $counts['CREATED'], $counts['CHANGED'], $counts['UNCHANGED'], $counts['ERROR']);
exit($counts['ERROR'] > 0 ? 1 : 0);
