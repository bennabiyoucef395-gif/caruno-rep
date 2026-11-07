#!/usr/bin/env bash
# Ensures the shop's counter customer ("Client comptoir", marker ref_ext = caruno:comptoir) exists.
# The CARUNO front uses it for counter sales and stores the shop profile in its documents.
# Usage: provisioning/16-counter-client.sh [existing_customer_id]   (give the id on a shop that already has one)
# Env: APP_CONTAINER (default dolibarr-app), COUNTER_NAME (default "Client comptoir"), ADMIN_LOGIN (default admin).
# Idempotent: a second run reports UNCHANGED.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
app="${APP_CONTAINER:-dolibarr-app}"
id="${1:-0}"
case "$id" in (*[!0-9]*) echo "Customer id must be a number" >&2; exit 1 ;; esac
name="${COUNTER_NAME:-Client comptoir}"
admin="${ADMIN_LOGIN:-admin}"
{
  printf "<?php \$COUNTER_ID = %d; \$ADMIN_LOGIN = '%s'; \$COUNTER_NAME = <<<'CARUNO_NAME'\n%s\nCARUNO_NAME;\n?>" "$id" "$admin" "$name"
  cat "$here/lib/counter_client.php"
} | docker exec -i -u www-data "$app" php
