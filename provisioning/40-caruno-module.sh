#!/usr/bin/env bash
# Installs the CARUNO add-on module in a shop's Dolibarr: purchase prices are not sent by the API to users without
# the right "Read supplier prices" (sellers). Source: dolibarr-modules/caruno -> htdocs/custom/caruno.
# Usage: provisioning/40-caruno-module.sh [on|off]      (default on; off disables it, files stay)
# Env: APP_CONTAINER (default dolibarr-app = the shop; caruno-test-dolibarr-1 = test), ADMIN_LOGIN (default admin).
# Idempotent. Back up the shop first (scripts/backup-instance.sh) when APP_CONTAINER is the shop.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
app="${APP_CONTAINER:-dolibarr-app}"
action="${1:-on}"
case "$action" in (on|off) ;; (*) echo "Usage: $0 [on|off]" >&2; exit 1 ;; esac
admin="${ADMIN_LOGIN:-admin}"
src="$here/../dolibarr-modules/caruno"

if [ "$action" = on ]; then
  # Copy the files (tar keeps the tree; the custom folder is the instance's, on disk), readable by the web server.
  tar -C "$src" -cf - . | docker exec -i -u root "$app" sh -c 'rm -rf /var/www/html/custom/caruno && mkdir -p /var/www/html/custom/caruno && tar -C /var/www/html/custom/caruno -xf - && chown -R www-data:www-data /var/www/html/custom/caruno'
  echo "COPIED    dolibarr-modules/caruno -> $app:/var/www/html/custom/caruno"
fi
{
  printf "<?php \$CARUNO_ACTION = '%s'; \$ADMIN_LOGIN = '%s'; ?>" "$action" "$admin"
  cat "$here/lib/caruno_module.php"
} | docker exec -i -u www-data "$app" php
