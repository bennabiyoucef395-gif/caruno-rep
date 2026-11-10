#!/usr/bin/env bash
# Builds the CARUNO parts catalogue database (caruno_parts) from the catalogue spreadsheet.
# Python runs in Docker (nothing to install); SQL runs in the instance's MariaDB container.
#
# Usage: scripts/parts/build.sh <step>...
#   data        catalogue-pieces.xlsx -> CSV + SQL in $PARTS_OUT (no database access)
#   schema      DROP + CREATE caruno_parts, tables, read-only user caruno_parts
#   base        load manufacturers, models, articles, OEM numbers, fitment (model level)
#   categories  load part_categories and set articles.category_id
#   engines     load engines + vehicle_types, move fitment rows with an engine to vehicle-type level
#   links       model_links.csv -> models.vdb_model_slug / vmm_generation_id, and vehicle_ref.model_links
#               (every matched vmm generation) when the vehicle_ref database exists (scripts/vehicle-ref/build.sh)
#   functions   get_engine_options(), compatible_parts()
#   test        scripts/parts/sql/90_checks.sql (Golf 7 and A4 B8)
#   export      JSON files for the front (export.sh): $PARTS_OUT/json
#   all         every step above, in order
#
# Defaults target the TEST instance; a container whose name has no "test" is refused unless
# PARTS_FORCE=1. Override: PARTS_SRC, PARTS_OUT, PARTS_DB_CONTAINER, PARTS_ENV_FILE.
set -euo pipefail

here="$(cd "$(dirname "$0")" && { pwd -W 2>/dev/null || pwd; })"
src="${PARTS_SRC:-C:/Users/TRETEC/Documents/bdd pieces auto}"
out="${PARTS_OUT:-C:/Users/TRETEC/caruno-data/parts-build}"
container="${PARTS_DB_CONTAINER:-caruno-test-db-1}"
env_file="${PARTS_ENV_FILE:-C:/Users/TRETEC/caruno-data/instances/test/instance.env}"
db=caruno_parts

case "$container" in
  *test*) ;;
  *) [ "${PARTS_FORCE:-0}" = 1 ] || { echo "Refused: $container is not a test container (PARTS_FORCE=1 to override)" >&2; exit 1; } ;;
esac

# Runs SQL from stdin as root inside the container; the root password never leaves the container.
sql_root() { docker exec -i "$container" sh -c 'exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" --default-character-set=utf8mb4 "$@"' sh "$@"; }

step_data() {
  mkdir -p "$out"
  docker build -q -t caruno-parts-tools "$here" >/dev/null
  run() { MSYS_NO_PATHCONV=1 docker run --rm --network none -v "$src:/src:ro" -v "$out:/out" caruno-parts-tools python -I "$@"; }
  run /app/caruno_import.py "/src/export/catalogue-pieces.xlsx" /out "/src/caruno database/modeles.xlsx"
  run /app/engines.py /out
  run /app/make_sql.py /out
}

step_schema() {
  if ! grep -q '^PARTS_DB_PASSWORD=' "$env_file"; then
    printf '\n# caruno_parts catalogue: read-only account (scripts/parts/build.sh)\nPARTS_DB_PASSWORD=%s\n' \
      "$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')" >> "$env_file"
    echo "PARTS_DB_PASSWORD added to $env_file"
  fi
  local pw; pw="$(grep '^PARTS_DB_PASSWORD=' "$env_file" | cut -d= -f2- | tr -d '\r\n')"
  { echo "DROP DATABASE IF EXISTS $db;"
    echo "CREATE DATABASE $db CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;  -- MariaDB 11.4 default: clients in utf8mb4 compare without collation errors"
    echo "CREATE USER IF NOT EXISTS 'caruno_parts'@'%' IDENTIFIED BY '$pw';"
    echo "ALTER USER 'caruno_parts'@'%' IDENTIFIED BY '$pw';"
    echo "GRANT SELECT, EXECUTE ON $db.* TO 'caruno_parts'@'%';"
  } | sql_root
  sql_root "$db" < "$here/sql/00_schema.sql"
}

step_links() {
  mkdir -p "$out"
  MSYS_NO_PATHCONV=1 docker run --rm --network none -v "$here:/parts:ro" -v "$out:/out" python:3.12-slim \
    python -I /parts/links_sql.py /parts/model_links.csv /out
  sql_root --table "$db" < "$out/50_links.sql"
  if [ -n "$(echo "SHOW DATABASES LIKE 'vehicle_ref';" | sql_root -N)" ]; then
    sql_root --table "$db" < "$out/51_links_vref.sql"
  else
    echo "No vehicle_ref database: vehicle_ref.model_links not written (scripts/vehicle-ref/build.sh all)"
  fi
}

load() { [ -f "$out/$1" ] || { echo "Missing $out/$1: run the 'data' step first" >&2; exit 1; }; sql_root "$db" < "$out/$1"; }

for step in "$@"; do
  case "$step" in
    all) set -- data schema base categories engines links functions test export; for s in "$@"; do "$0" "$s"; done; exit 0 ;;
    data) step_data ;;
    schema) step_schema ;;
    base) load 10_base.sql ;;
    categories) load 20_categories.sql ;;
    engines) load 30_engines.sql ;;
    links) step_links ;;
    functions) sql_root "$db" < "$here/sql/40_functions.sql" ;;
    test) sql_root --table "$db" < "$here/sql/90_checks.sql" ;;
    export) PARTS_OUT="$out" PARTS_DB_CONTAINER="$container" "$here/export.sh" ;;
    *) echo "Unknown step: $step" >&2; exit 1 ;;
  esac
  echo "OK $step"
done
