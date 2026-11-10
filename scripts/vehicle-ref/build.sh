#!/usr/bin/env bash
# Builds vehicle_ref: outside vehicle reference data, in its own database (never mixed into caruno_parts).
#   vdb_*    VehiclesDB (github.com/vehiclesdb/vehiclesdb, CC-BY 4.0): catalog.sqlite, car rows only
#   vmm_*    vehicle-makes-models (github.com/gor3a/vehicle-makes-models, data ODbL 1.0, copied from
#            autoevolution.com): vehicles.sqlite as is. INTERNAL ONLY: never shown to customers.
#   nhtsa_wmi  NHTSA vPIC WMI codes (US government, public domain) for the makes in nhtsa_wmi.py,
#            also written to scripts/parts/wmi_nhtsa.py for vin_decoder.py.
# Python runs in Docker without network (nothing to install); SQL runs in the instance's MariaDB container.
#
# Usage: scripts/vehicle-ref/build.sh <step>...
#   download  latest releases of both projects + NHTSA WMI lists -> $VREF_OUT/download (VDB_TAG / VMM_TAG pin a release)
#   schema    CREATE DATABASE vehicle_ref (if missing), sources table, SELECT for the read-only account caruno_parts
#   vdb       (re)load the vdb_* tables from the downloaded VehiclesDB release
#   vmm       (re)load the vmm_* tables from the downloaded vehicle-makes-models release
#   nhtsa     (re)load nhtsa_wmi and regenerate scripts/parts/wmi_nhtsa.py
#   views     sql/40_reference_engines.sql: reference engines per catalogue model (vmm, REFERENCE ONLY)
#   missing   $VREF_OUT/review/moteurs_manquants.csv: reference engines our catalogue does not offer for the model
#   test      sql/90_checks.sql
#   all       every step above, in order
#
# Defaults target the TEST instance; a container whose name has no "test" is refused unless VREF_FORCE=1.
# Override: VREF_OUT, VREF_DB_CONTAINER.
set -euo pipefail

here="$(cd "$(dirname "$0")" && { pwd -W 2>/dev/null || pwd; })"
parts="$(cd "$here/../parts" && { pwd -W 2>/dev/null || pwd; })"
out="${VREF_OUT:-C:/Users/TRETEC/caruno-data/vehicle-ref}"
container="${VREF_DB_CONTAINER:-caruno-test-db-1}"
db=vehicle_ref
VDB_REPO=vehiclesdb/vehiclesdb
VMM_REPO=gor3a/vehicle-makes-models

case "$container" in
  *test*) ;;
  *) [ "${VREF_FORCE:-0}" = 1 ] || { echo "Refused: $container is not a test container (VREF_FORCE=1 to override)" >&2; exit 1; } ;;
esac

# Runs SQL from stdin as root inside the container; the root password never leaves the container.
sql_root() { docker exec -i "$container" sh -c 'exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" --default-character-set=utf8mb4 "$@"' sh "$@"; }
# Python on downloaded (untrusted) files: isolated mode, no network, scripts mounted read-only.
py() { MSYS_NO_PATHCONV=1 docker run --rm --network none -v "$here:/tools:ro" -v "$out:/out" python:3.12-slim python -I "$@"; }

latest_tag() { curl -fsSL "https://api.github.com/repos/$1/releases/latest" | sed -n 's/^ *"tag_name": *"\([^"]*\)".*/\1/p' | head -1; }
current() { local f="$out/download/$1/CURRENT"; [ -f "$f" ] || { echo "Nothing downloaded for $1: run the 'download' step first" >&2; exit 1; }; tr -d '\r\n' < "$f"; }
sha() { sha256sum "$1" | cut -d' ' -f1; }
esc() { printf '%s' "$1" | sed "s/'/''/g"; }
record_source() {  # name version url licence sha256
  echo "REPLACE INTO sources (name, version, url, licence, sha256, loaded_at)
        VALUES ('$(esc "$1")', '$(esc "$2")', '$(esc "$3")', '$(esc "$4")', '$(esc "$5")', NOW());" | sql_root "$db"
}

fetch_release() {  # dir repo tag assets...
  local dir="$1" repo="$2" tag="$3"; shift 3
  local dest="$out/download/$dir/$tag"
  mkdir -p "$dest"
  for a in "$@"; do
    [ -s "$dest/$a" ] || curl -fsSL --retry 3 -o "$dest/$a" "https://github.com/$repo/releases/download/$tag/$a"
  done
  ( cd "$dest" && sha256sum "$@" > SHA256SUMS )
  printf '%s\n' "$tag" > "$out/download/$dir/CURRENT"
  echo "$dir: $tag -> $dest"
}

step_download() {
  local t
  t="${VDB_TAG:-$(latest_tag "$VDB_REPO")}"; [ -n "$t" ] || { echo "No release found for $VDB_REPO" >&2; exit 1; }
  fetch_release vdb "$VDB_REPO" "$t" catalog.sqlite ATTRIBUTION.md manifest.json
  t="${VMM_TAG:-$(latest_tag "$VMM_REPO")}"; [ -n "$t" ] || { echo "No release found for $VMM_REPO" >&2; exit 1; }
  fetch_release vmm "$VMM_REPO" "$t" vehicles.sqlite
  # NHTSA has no bulk WMI file in its API: one call per make (queries listed in nhtsa_wmi.py).
  local day dest q; day="$(date +%Y-%m-%d)"; dest="$out/download/nhtsa/$day"
  mkdir -p "$dest"
  py /tools/nhtsa_wmi.py queries | tr -d '\r' | while IFS= read -r q; do
    [ -s "$dest/$q.json" ] && continue
    curl -fsSL --retry 3 -o "$dest/$q.json" \
      "https://vpic.nhtsa.dot.gov/api/vehicles/GetWMIsForManufacturer/$(printf '%s' "$q" | sed 's/ /%20/g')?format=json"
    sleep 1   # be polite with the public API
  done
  printf '%s\n' "$day" > "$out/download/nhtsa/CURRENT"
  echo "nhtsa: $(ls "$dest" | wc -l) makes -> $dest"
}

step_schema() {
  { echo "CREATE DATABASE IF NOT EXISTS $db CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci;"
    echo "USE $db;"
    cat "$here/sql/00_schema.sql"
  } | sql_root
  if [ "$(echo "SELECT COUNT(*) FROM mysql.user WHERE user = 'caruno_parts';" | sql_root -N)" -gt 0 ]; then
    echo "GRANT SELECT ON $db.* TO 'caruno_parts'@'%';" | sql_root
  else
    echo "Account caruno_parts missing (scripts/parts/build.sh schema creates it): no grant on $db" >&2
  fi
}

load_sqlite() {  # dataset ddl sqlite_file
  mkdir -p "$out/sql"
  py /tools/sqlite_to_sql.py "$1" "/out/${3#"$out"/}" "/out/sql/$1_data.sql"
  sql_root "$db" < "$here/sql/$2"
  sql_root "$db" < "$out/sql/$1_data.sql"
}

step_vdb() {
  local t f; t="$(current vdb)"; f="$out/download/vdb/$t/catalog.sqlite"
  load_sqlite vdb 10_vdb.sql "$f"
  record_source vehiclesdb "$t" "https://github.com/$VDB_REPO/releases/tag/$t" "CC-BY-4.0" "$(sha "$f")"
}

step_vmm() {
  local t f; t="$(current vmm)"; f="$out/download/vmm/$t/vehicles.sqlite"
  load_sqlite vmm 20_vmm.sql "$f"
  record_source vehicle-makes-models "$t" "https://github.com/$VMM_REPO/releases/tag/$t" "ODbL-1.0 (internal only)" "$(sha "$f")"
}

step_nhtsa() {
  local d; d="$(current nhtsa)"
  mkdir -p "$out/sql"
  py /tools/nhtsa_wmi.py build "/out/download/nhtsa/$d" "$d" /out/sql/nhtsa_data.sql /out/wmi_nhtsa.py
  sql_root "$db" < "$here/sql/30_nhtsa.sql"
  sql_root "$db" < "$out/sql/nhtsa_data.sql"
  cp "$out/wmi_nhtsa.py" "$parts/wmi_nhtsa.py"
  record_source nhtsa-vpic-wmi "$d" "https://vpic.nhtsa.dot.gov/api/" "US government work (public domain)" \
    "$(cat "$out/download/nhtsa/$d"/*.json | sha256sum | cut -d' ' -f1)"
  echo "scripts/parts/wmi_nhtsa.py regenerated"
}

step_missing() {
  mkdir -p "$out/review"
  { printf '\xef\xbb\xbf'   # UTF-8 BOM for Excel
    echo "SELECT k.name AS marque, m.name AS modele, IFNULL(m.generation, '') AS generation,
                 CONCAT_WS('-', m.year_from, m.year_to) AS annees, s.label AS moteur_reference,
                 CONCAT(s.hp_min, IF(s.hp_max > s.hp_min, CONCAT('-', s.hp_max), ''), ' ch') AS puissance,
                 s.vmm_variants AS variantes
          FROM reference_engine_summary s
          JOIN caruno_parts.models m ON m.id = s.caruno_model_id
          JOIN caruno_parts.manufacturers k ON k.id = m.manufacturer_id
          WHERE NOT s.in_catalogue AND s.fuel IS NOT NULL
          ORDER BY k.name, m.name, m.year_from, s.displacement_l, s.label;" \
      | sql_root -B "$db" | sed 's/\t/;/g'
  } > "$out/review/moteurs_manquants.csv"
  echo "$(($(wc -l < "$out/review/moteurs_manquants.csv") - 1)) reference engines missing from the catalogue -> $out/review/moteurs_manquants.csv"
}

for step in "$@"; do
  case "$step" in
    all) set -- download schema vdb vmm nhtsa views test missing; for s in "$@"; do "$0" "$s"; done; exit 0 ;;
    views) sql_root "$db" < "$here/sql/40_reference_engines.sql" ;;
    missing) step_missing ;;
    download) step_download ;;
    schema) step_schema ;;
    vdb) step_vdb ;;
    vmm) step_vmm ;;
    nhtsa) step_nhtsa ;;
    test) sql_root --table "$db" < "$here/sql/90_checks.sql" ;;
    *) echo "Unknown step: $step" >&2; exit 1 ;;
  esac
  echo "OK $step"
done
