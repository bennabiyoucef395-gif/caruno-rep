#!/usr/bin/env bash
# Exports caruno_parts to JSON files for the front (index.json + models/<id>.json). Read-only on the database.
# Statuses come from compatible_parts() itself, for "Je ne sais pas" and for every engine option.
# Usage: scripts/parts/export.sh            -> $PARTS_OUT/json
#        PARTS_JSON_DIR=<dir> scripts/parts/export.sh   also copies the result to <dir> (e.g. the front's data folder)
set -euo pipefail

here="$(cd "$(dirname "$0")" && { pwd -W 2>/dev/null || pwd; })"
out="${PARTS_OUT:-C:/Users/TRETEC/caruno-data/parts-build}"
container="${PARTS_DB_CONTAINER:-caruno-test-db-1}"
q() { docker exec -i "$container" sh -c 'exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" --default-character-set=utf8mb4 -N -B caruno_parts'; }

mkdir -p "$out/export"
echo "SELECT id, group_name, name, engine_dependent FROM part_categories ORDER BY id;" | q > "$out/export/categories.tsv"
echo "SELECT m.id, k.name, m.name, m.generation, m.year_from, m.year_to
      FROM models m JOIN manufacturers k ON k.id = m.manufacturer_id ORDER BY m.id;" | q > "$out/export/models.tsv"
echo "SELECT id, get_engine_options(id) FROM models ORDER BY id;" | q > "$out/export/options.tsv"
echo "SELECT a.ref, GROUP_CONCAT(DISTINCT o.oem ORDER BY o.oem SEPARATOR ' / ') FROM articles a
      JOIN article_oem ao ON ao.article_id = a.id JOIN oem_numbers o ON o.id = ao.oem_id GROUP BY a.id;" | q > "$out/export/oem.tsv"
# One CALL for "Je ne sais pas" and one per engine option the customer can pick.
echo "SELECT CONCAT('SELECT ''#M', m.id, '#unknown''; CALL compatible_parts(', m.id, ', NULL, NULL);') FROM models m
      UNION ALL
      SELECT CONCAT('SELECT ''#M', m.id, '#', o.vt, '''; CALL compatible_parts(', m.id, ', ', o.vt, ', NULL);')
      FROM models m, JSON_TABLE(get_engine_options(m.id), '\$[*]' COLUMNS (vt INT PATH '\$.vehicle_type_id')) o
      WHERE o.vt IS NOT NULL;" | q | q > "$out/export/compatible.tsv"

docker build -q -t caruno-parts-tools "$here" >/dev/null
MSYS_NO_PATHCONV=1 docker run --rm --network none -v "$out:/out" caruno-parts-tools python -I /app/export_json.py /out

if [ -n "${PARTS_JSON_DIR:-}" ]; then
  mkdir -p "$PARTS_JSON_DIR"
  rm -rf "$PARTS_JSON_DIR/models"
  cp -r "$out/json/." "$PARTS_JSON_DIR/"
  echo "Copied to $PARTS_JSON_DIR"
fi
