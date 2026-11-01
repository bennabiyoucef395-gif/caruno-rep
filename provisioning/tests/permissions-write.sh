#!/usr/bin/env bash
# Forbidden write attempts through direct form posts, with a positive control.
#
# For each case: a role WITHOUT the right posts the form with a valid session and
# CSRF token -> nothing may be created. Then a role WITH the right posts the same
# form -> exactly one record must be created; this proves the request itself was
# valid, so the refusal really came from the permission check. Control records
# (prefix PERMTEST) are then deleted with Dolibarr's own delete methods.
# Passwords are read from the secret files and sent on stdin; never printed.
# Usage: provisioning/tests/permissions-write.sh
set -uo pipefail
export MSYS_NO_PATHCONV=1

base="${DOLI_URL:-http://localhost:8080}"
env_file="${HANOUT_ENV_FILE:-C:/Users/TRETEC/caruno-data/instances/hanout-vw/instance.env}"
test_file="${HANOUT_TEST_USERS_FILE:-$(dirname "$env_file")/test-users.env}"
db="${DB_CONTAINER:-dolibarr-db}"
app="${APP_CONTAINER:-dolibarr-app}"

count_permtest() {
  docker exec "$db" sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot -N "$MARIADB_DATABASE" -e "SELECT (SELECT COUNT(*) FROM llx_categorie WHERE label LIKE \"PERMTEST%\")+(SELECT COUNT(*) FROM llx_societe WHERE nom LIKE \"PERMTEST%\")+(SELECT COUNT(*) FROM llx_product WHERE ref LIKE \"PERMTEST%\")+(SELECT COUNT(*) FROM llx_bank_account WHERE ref LIKE \"PERMTEST%\")+(SELECT COUNT(*) FROM llx_user WHERE login LIKE \"permtest%\");"'
}

secret_of() { # $1 key -> value on stdout (never echoed to the terminal by callers)
  if grep -q "^$1=" "$test_file"; then grep "^$1=" "$test_file" | cut -d= -f2- | tr -d '\n'
  else grep "^$1=" "$env_file" | cut -d= -f2- | tr -d '\n'; fi
}

# Logs in, posts the form, prints "<http code> <past csrf yes|no> <logged in yes|no>".
post_as() { # $1 login, $2 secret key, $3 page for token, $4 target, $5 fields
  local jar token page_body body code logged
  # Windows-style path: with MSYS_NO_PATHCONV=1, curl.exe cannot write to /tmp/...
  jar="$(cygpath -m "$(mktemp)" 2>/dev/null || mktemp)"
  token=$(curl -s -c "$jar" -b "$jar" "$base/" | grep -oE 'name="token" value="[^"]+"' | head -1 | sed -E 's/.*value="([^"]+)"/\1/')
  secret_of "$2" | curl -s -c "$jar" -b "$jar" -L -o /dev/null \
    --data-urlencode "token=$token" --data-urlencode "actionlogin=login" --data-urlencode "loginfunction=loginfunction" \
    --data-urlencode "username=$1" --data-urlencode "password@-" "$base/index.php"
  page_body=$(curl -s -c "$jar" -b "$jar" "$base/$3")
  logged=no; grep -q 'logout.php' <<< "$page_body" && logged=yes
  # The page's new anti-CSRF token is the one the next request must carry.
  token=$(grep -oE 'name="anti-csrf-newtoken" content="[0-9a-f]+"' <<< "$page_body" | sed -E 's/.*content="([0-9a-f]+)"/\1/')
  local args=(--data-urlencode "token=$token")
  IFS='&' read -ra kv <<< "$5"
  for p in "${kv[@]}"; do args+=(--data-urlencode "$p"); done
  body=$(curl -s -c "$jar" -b "$jar" -L -w '\nHTTP_CODE=%{http_code}' "${args[@]}" "$base/$4")
  code=$(tail -1 <<< "$body" | cut -d= -f2)
  if grep -q 'refused by CSRF protection' <<< "$body"; then echo "$code no $logged"; else echo "$code yes $logged"; fi
  rm -f "$jar"
}

# Removes PERMTEST control records with Dolibarr's own delete methods (no SQL write).
cleanup_permtest() {
  docker exec -i -u www-data "$app" php <<'PHP'
<?php
define('NOLOGIN', 1); define('NOCSRFCHECK', 1); define('NOSESSION', 1); define('NOREQUIREMENU', 1); define('NOREQUIREHTML', 1);
$_SERVER['HTTP_HOST'] = 'localhost';
require '/var/www/html/master.inc.php';
require_once DOL_DOCUMENT_ROOT.'/categories/class/categorie.class.php';
require_once DOL_DOCUMENT_ROOT.'/societe/class/societe.class.php';
require_once DOL_DOCUMENT_ROOT.'/product/class/product.class.php';
require_once DOL_DOCUMENT_ROOT.'/user/class/user.class.php';
$user = new User($db); $user->fetch(0, 'admin'); $user->loadRights();
$n = 0; $e = 0;
$q = function ($sql) use ($db) { $ids = array(); $r = $db->query($sql); while ($r && ($o = $db->fetch_object($r))) { $ids[] = (int) $o->id; } return $ids; };
foreach ($q("SELECT rowid AS id FROM ".MAIN_DB_PREFIX."categorie WHERE label LIKE 'PERMTEST%'") as $id) { $o = new Categorie($db); $o->fetch($id); ($o->delete($user) > 0) ? $n++ : $e++; }
foreach ($q("SELECT rowid AS id FROM ".MAIN_DB_PREFIX."societe WHERE nom LIKE 'PERMTEST%'") as $id) { $o = new Societe($db); $o->fetch($id); ($o->delete($id, $user) > 0) ? $n++ : $e++; }
foreach ($q("SELECT rowid AS id FROM ".MAIN_DB_PREFIX."product WHERE ref LIKE 'PERMTEST%'") as $id) { $o = new Product($db); $o->fetch($id); ($o->delete($user) > 0) ? $n++ : $e++; }
foreach ($q("SELECT rowid AS id FROM ".MAIN_DB_PREFIX."user WHERE login LIKE 'permtest%'") as $id) { $o = new User($db); $o->fetch($id); ($o->delete($user) > 0) ? $n++ : $e++; }
echo "deleted=$n errors=$e";
PHP
}

if [ "${1:-}" = "--cleanup-only" ]; then
  echo "CLEANUP $(cleanup_permtest) remaining_permtest=$(count_permtest)"
  exit 0
fi

# forbidden login|key|control login|key|token page|target|fields (%s = name suffix)|description
cases="dev.vendeur|TEST_PW_DEV_VENDEUR|dev.gerant|TEST_PW_DEV_GERANT|categories/card.php?action=create&type=product|categories/card.php|action=add&type=product&parent=-1&label=PERMTEST-CAT-%s|Créer une famille (vendeur: categorie:lire seul)
dev.magasinier|TEST_PW_DEV_MAGASINIER|dev.vendeur|TEST_PW_DEV_VENDEUR|societe/card.php?action=create|societe/card.php|action=add&client=1&status=1&country_id=13&name=PERMTEST-SOC-%s|Créer un client (magasinier: societe:lire seul)
dev.comptable|TEST_PW_DEV_COMPTABLE|dev.responsable|TEST_PW_DEV_RESPONSABLE|societe/card.php?action=create|societe/card.php|action=add&client=1&status=1&country_id=13&name=PERMTEST-SOC2-%s|Créer un client (comptable: pas de societe:creer)
dev.vendeur|TEST_PW_DEV_VENDEUR|dev.magasinier|TEST_PW_DEV_MAGASINIER|product/card.php?action=create&type=0|product/card.php|action=add&type=0&statut=1&statut_buy=1&label=PERMTEST&ref=PERMTEST-PRD-%s|Créer une pièce (vendeur: pas de produit:creer)
dev.magasinier|TEST_PW_DEV_MAGASINIER|admin|DOLI_ADMIN_PASSWORD|user/card.php?action=create|user/card.php|action=add&lastname=PERMTEST&admin=1&login=permtest.%s|Créer un utilisateur administrateur (magasinier)"

[ "$(count_permtest)" = 0 ] || { echo "Database already contains PERMTEST records; aborting"; exit 1; }

pass=0; fail=0
while IFS='|' read -r fuser fkey cuser ckey page target fields desc; do
  before=$(count_permtest)
  read -r fcode fcsrf flogged <<< "$(post_as "$fuser" "$fkey" "$page" "$target" "$(printf "$fields" forbidden)")"
  mid=$(count_permtest)
  read -r ccode ccsrf clogged <<< "$(post_as "$cuser" "$ckey" "$page" "$target" "$(printf "$fields" control)")"
  after=$(count_permtest)
  forbidden_created=$((mid - before)); control_created=$((after - mid))
  if [ "$forbidden_created" != 0 ]; then r=FAIL
  elif [ "$flogged" = yes ] && [ "$fcsrf" = yes ] && [ "$control_created" = 1 ]; then r=PASS
  else r=INCONCLUSIVE; fi
  [ "$r" = PASS ] && pass=$((pass+1)) || fail=$((fail+1))
  printf '%-12s %-60s forbidden(%s): logged=%s past_csrf=%s created=%s | control(%s): logged=%s created=%s\n' \
    "$r" "$desc" "$fuser" "$flogged" "$fcsrf" "$forbidden_created" "$cuser" "$clogged" "$control_created"
done <<< "$cases"

echo "CLEANUP $(cleanup_permtest) remaining_permtest=$(count_permtest)"
echo "SUMMARY cases=$((pass+fail)) pass=$pass fail_or_inconclusive=$fail"
[ "$fail" = 0 ] && [ "$(count_permtest)" = 0 ]
