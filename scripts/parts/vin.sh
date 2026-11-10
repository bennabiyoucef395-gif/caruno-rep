#!/usr/bin/env bash
# Decodes one or more VINs with vin_decoder.py and lists the matching catalogue models.
# Uses the catalogue CSVs from scripts/parts/build.sh data (no database access); Python runs in Docker.
# Usage: scripts/parts/vin.sh WVWZZZAUZFW123456 [VIN...]
set -euo pipefail
[ $# -gt 0 ] || { echo "Usage: $0 VIN [VIN...]" >&2; exit 1; }
here="$(cd "$(dirname "$0")" && { pwd -W 2>/dev/null || pwd; })"
out="${PARTS_OUT:-C:/Users/TRETEC/caruno-data/parts-build}"
for vin in "$@"; do
  echo "== $vin"
  MSYS_NO_PATHCONV=1 docker run --rm --network none -v "$here:/code:ro" -v "$out:/pb:ro" python:3.12-slim \
    python -I /code/vin_decoder.py "$vin" /pb/models.csv /pb/manufacturers.csv
done
