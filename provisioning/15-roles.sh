#!/usr/bin/env bash
# Creates groups, test users, permissions and the CARUNO_API account.
# Usage: provisioning/15-roles.sh [roles.json]   (default: roles.dev.json)
# Secrets (generated on first run, never printed, never in Git):
#   test passwords -> HANOUT_TEST_USERS_FILE (default: test-users.env next to instance.env)
#   API key        -> CARUNO_API_KEY in HANOUT_ENV_FILE (instance.env)
set -euo pipefail
umask 077

here="$(cd "$(dirname "$0")" && pwd)"
roles="${1:-$here/roles.dev.json}"
app="${APP_CONTAINER:-dolibarr-app}"
env_file="${HANOUT_ENV_FILE:-C:/Users/TRETEC/caruno-data/instances/hanout-vw/instance.env}"
test_file="${HANOUT_TEST_USERS_FILE:-$(dirname "$env_file")/test-users.env}"

[ -f "$roles" ] || { echo "Roles file not found: $roles" >&2; exit 1; }
[ -f "$env_file" ] || { echo "Env file not found: $env_file" >&2; exit 1; }

# Append KEY=<random> to a file if KEY is missing. Never prints the value.
ensure_secret() {
  local file="$1" key="$2" value
  grep -q "^${key}=" "$file" 2>/dev/null && return 0
  case "$key" in
    *API_KEY) value="$(openssl rand -hex 24)" ;;
    *)        value="$(openssl rand -base64 18 | tr -d '\n/+=' | cut -c1-24)" ;;
  esac
  printf '%s=%s\n' "$key" "$value" >> "$file"
  echo "generated secret $key in $(basename "$file")"
}

if [ ! -f "$test_file" ]; then
  printf '# Passwords of the fictitious HANOUT VW test users (development only).\n# Outside Git and OneDrive. Logins are documented in doc/14-users-permissions-report.md.\n' > "$test_file"
fi
for key in $(grep -oE '"secret_key": *"[A-Z0-9_]+"' "$roles" | sed -E 's/.*"([A-Z0-9_]+)"$/\1/'); do
  ensure_secret "$test_file" "$key"
done
api_key_name="$(grep -oE '"api_key_secret": *"[A-Z0-9_]+"' "$roles" | sed -E 's/.*"([A-Z0-9_]+)"$/\1/')"
ensure_secret "$env_file" "$api_key_name"

# Secrets as a JSON object (values are base64/hex, safe in JSON).
secrets_json() {
  local first=1
  printf '{'
  { grep -E '^TEST_PW_[A-Z0-9_]+=' "$test_file"; grep -E "^${api_key_name}=" "$env_file"; } | while IFS='=' read -r k v; do
    [ $first = 1 ] && first=0 || printf ','
    printf '"%s":"%s"' "$k" "$v"
  done
  printf '}'
}

# Matrix and secrets travel on stdin with the engine, never as command-line arguments.
{
  printf "<?php \$ROLES_JSON = <<<'CARUNO_ROLES_JSON'\n"
  cat "$roles"
  printf "\nCARUNO_ROLES_JSON;\n\$SECRETS_JSON = <<<'CARUNO_SECRETS_JSON'\n"
  secrets_json
  printf "\nCARUNO_SECRETS_JSON;\n?>"
  cat "$here/lib/roles.php"
} | docker exec -i -u www-data "$app" php
