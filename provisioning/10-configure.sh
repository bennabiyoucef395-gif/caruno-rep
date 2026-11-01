#!/usr/bin/env bash
# Applies a CARUNO shop profile to a running Dolibarr instance.
# Usage: provisioning/10-configure.sh [profile.json]   (default: shop-profile.dev.json)
# Env: APP_CONTAINER (default dolibarr-app).
# Re-runnable: a second run must report only UNCHANGED items.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
profile="${1:-$here/shop-profile.dev.json}"
app="${APP_CONTAINER:-dolibarr-app}"

[ -f "$profile" ] || { echo "Profile not found: $profile" >&2; exit 1; }

# The profile travels on stdin with the engine (a nowdoc), never as a command-line
# argument, so UTF-8 labels arrive intact on Windows.
{
  printf "<?php \$PROFILE_JSON = <<<'CARUNO_PROFILE_JSON'\n"
  cat "$profile"
  printf "\nCARUNO_PROFILE_JSON;\n?>"
  cat "$here/lib/configure.php"
} | docker exec -i -u www-data "$app" php
