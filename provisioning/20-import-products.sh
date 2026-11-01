#!/usr/bin/env bash
# Imports parts from a CSV (format of scripts/catalogue-pdf: ref;label;description;brand;oem;oem_ref;...)
# into a running Dolibarr instance.
# Usage: provisioning/20-import-products.sh <products.csv> [admin_login]   (default login: admin)
# Env: APP_CONTAINER (default dolibarr-app).
# Re-runnable: a second run must report only UNCHANGED items. Prices and stock are not touched.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
csv="${1:?usage: 20-import-products.sh <products.csv> [admin_login]}"
admin="${2:-admin}"
app="${APP_CONTAINER:-dolibarr-app}"

[ -f "$csv" ] || { echo "CSV not found: $csv" >&2; exit 1; }

# Same transport as 10-configure.sh: the data travels on stdin in a nowdoc, UTF-8 intact.
{
  printf "<?php \$ADMIN_LOGIN = '%s'; \$PRODUCTS_CSV = <<<'CARUNO_PRODUCTS_CSV'\n" "$admin"
  cat "$csv"
  printf "\nCARUNO_PRODUCTS_CSV;\n?>"
  cat "$here/lib/import_products.php"
} | docker exec -i -u www-data "$app" php
