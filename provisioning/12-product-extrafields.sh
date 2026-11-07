#!/usr/bin/env bash
# Adds the product extra fields of a CARUNO shop profile to a running Dolibarr, and nothing else
# (10-configure.sh applies the whole profile). Idempotent: existing fields are reported UNCHANGED.
# Usage: provisioning/12-product-extrafields.sh [profile.json]   (default: shop-profile.dev.json)
# Env: APP_CONTAINER (default dolibarr-app).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
profile="${1:-$here/shop-profile.dev.json}"
app="${APP_CONTAINER:-dolibarr-app}"
[ -f "$profile" ] || { echo "Profile not found: $profile" >&2; exit 1; }
# Same transport as 10-configure.sh: the profile travels on stdin in a nowdoc, UTF-8 labels intact.
{
  printf "<?php \$PROFILE_JSON = <<<'CARUNO_PROFILE_JSON'\n"
  cat "$profile"
  printf "\nCARUNO_PROFILE_JSON;\n?>"
  cat "$here/lib/product_extrafields.php"
} | docker exec -i -u www-data "$app" php
