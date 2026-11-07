#!/usr/bin/env bash
# French product names (label) + Arabic names (extra field nom_ar); the supplier label is kept in nom_fournisseur.
# Usage: provisioning/30-product-names.sh [apply|restore] [names.csv]
#   names.csv: ref;en;fr;ar from scripts/parts/product_names.py (default C:/Users/TRETEC/caruno-data/parts-build/product_names.csv)
#   restore:   puts the supplier labels back (label <- nom_fournisseur).
# Needs the extra fields nom_fournisseur / nom_ar (12-product-extrafields.sh). Env: APP_CONTAINER, ADMIN_LOGIN.
# Idempotent; labels changed by hand in the shop are never overwritten (SKIPPED).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mode="${1:-apply}"
csv="${2:-C:/Users/TRETEC/caruno-data/parts-build/product_names.csv}"
app="${APP_CONTAINER:-dolibarr-app}"
admin="${ADMIN_LOGIN:-admin}"
case "$mode" in apply|restore) ;; *) echo "Mode must be apply or restore" >&2; exit 1 ;; esac
[ -f "$csv" ] || { echo "CSV not found: $csv" >&2; exit 1; }
{
  printf "<?php \$MODE = '%s'; \$ADMIN_LOGIN = '%s'; \$NAMES_CSV = <<<'CARUNO_NAMES_CSV'\n" "$mode" "$admin"
  cat "$csv"
  printf "\nCARUNO_NAMES_CSV;\n?>"
  cat "$here/lib/product_names.php"
} | docker exec -i -u www-data "$app" php
