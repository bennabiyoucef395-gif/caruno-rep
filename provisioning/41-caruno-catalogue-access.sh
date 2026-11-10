#!/usr/bin/env bash
# Lets the CARUNO add-on (Dolibarr) READ the catalogue databases: caruno_parts (SELECT + EXECUTE for
# get_engine_options / compatible_parts) and vehicle_ref (SELECT), through Dolibarr's own database account —
# no extra password stored. Read-only: the add-on writes only its own llx_caruno_* tables in the Dolibarr database.
# Grants survive a rebuild of caruno_parts / vehicle_ref (they are kept by name).
# Usage: provisioning/41-caruno-catalogue-access.sh
# Env: DB_CONTAINER (default caruno-test-db-1), APP_CONTAINER (default caruno-test-dolibarr-1, to read the account name).
# The catalogue exists on the TEST instance only: a container without "test" is refused unless CARUNO_FORCE=1.
set -euo pipefail
db="${DB_CONTAINER:-caruno-test-db-1}"
app="${APP_CONTAINER:-caruno-test-dolibarr-1}"
case "$db" in
  *test*) ;;
  *) [ "${CARUNO_FORCE:-0}" = 1 ] || { echo "Refused: $db is not a test container (CARUNO_FORCE=1 to override)" >&2; exit 1; } ;;
esac
user="$(docker exec "$app" sh -c "sed -n \"s/^\\\$dolibarr_main_db_user='\\([^']*\\)';.*/\\1/p\" /var/www/html/conf/conf.php")"
[ -n "$user" ] || { echo "Dolibarr database account not found in $app conf.php" >&2; exit 1; }
case "$user" in (*[!A-Za-z0-9_]*) echo "Unexpected account name: $user" >&2; exit 1 ;; esac
docker exec -i "$db" sh -c 'exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD"' <<SQL
GRANT SELECT, EXECUTE ON caruno_parts.* TO '$user'@'%';
GRANT SELECT ON vehicle_ref.* TO '$user'@'%';
SQL
echo "OK        $user@% can read caruno_parts (SELECT, EXECUTE) and vehicle_ref (SELECT) on $db"
