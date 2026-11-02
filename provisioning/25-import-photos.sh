#!/usr/bin/env bash
# Attaches part photos (<product ref>.jpg, made by scripts/catalogue-pdf -Photos) to Dolibarr products.
# Usage: provisioning/25-import-photos.sh <photos_dir> [admin_login]   (default login: admin)
# Env: APP_CONTAINER (default dolibarr-app).
# Re-runnable: a photo already in place with the same content reports UNCHANGED.
set -euo pipefail
export MSYS_NO_PATHCONV=1

here="$(cd "$(dirname "$0")" && pwd)"
src="${1:?usage: 25-import-photos.sh <photos_dir> [admin_login]}"
admin="${2:-admin}"
app="${APP_CONTAINER:-dolibarr-app}"
tmp="/tmp/caruno-photos-$$"

[ -d "$src" ] || { echo "Photos directory not found: $src" >&2; exit 1; }

# The photos are copied into the container for the run, then removed.
docker cp "$src" "$app:$tmp"
trap 'docker exec "$app" rm -rf "$tmp"' EXIT
docker exec "$app" chmod -R a+rX "$tmp"

{
  printf "<?php \$ADMIN_LOGIN = '%s'; \$PHOTOS_DIR = '%s'; ?>" "$admin" "$tmp"
  cat "$here/lib/import_photos.php"
} | docker exec -i -u www-data "$app" php
