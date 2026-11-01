#!/usr/bin/env bash
# Per-user sign-in test: the flow the CARUNO front uses with POST /login.
# Password and tokens are never printed, never on a command line, never in a file:
# the password and tokens go to curl on stdin (body, or -K - config).
# Ends with a reset so no token obtained during the test stays valid.
# Usage: provisioning/tests/login-api.sh [login] [secret key]
#   default: dev.vendeur TEST_PW_DEV_VENDEUR
set -uo pipefail

api="${DOLI_URL:-http://localhost:8080}/api/index.php"
env_file="${HANOUT_ENV_FILE:-C:/Users/TRETEC/caruno-data/instances/hanout-vw/instance.env}"
test_file="${HANOUT_TEST_USERS_FILE:-$(dirname "$env_file")/test-users.env}"
login="${1:-dev.vendeur}"
secret_key="${2:-TEST_PW_DEV_VENDEUR}"

pw="$(grep "^${secret_key}=" "$test_file" | cut -d= -f2- | tr -d '\r\n')"
[ -n "$pw" ] || { echo "Secret $secret_key not found in $(basename "$test_file")" >&2; exit 1; }

pass=0
fail=0
check() { # $1 description, $2 actual, $3 expected (space separated)
  if [[ " $3 " == *" $2 "* ]]; then pass=$((pass + 1)); printf 'PASS  %-62s %s\n' "$1" "$2"
  else fail=$((fail + 1)); printf 'FAIL  %-62s %s (attendu %s)\n' "$1" "$2" "$3"; fi
}

# POST /login; $1 password, $2 reset (0/1). Sets $code and $token (never printed).
do_login() {
  local out
  out="$(printf '{"login":"%s","password":"%s","reset":%s}' "$login" "$1" "$2" \
    | curl -s -w '\n%{http_code}' -X POST -H 'Accept: application/json' -H 'Content-Type: application/json' --data-binary @- "$api/login")"
  code="$(printf '%s' "$out" | tail -n1)"
  token="$(printf '%s' "$out" | sed -n 's/.*"token": *"\([0-9a-fA-F]*\)".*/\1/p' | head -n1)"
}

# API call with a token; $1 token, $2 method, $3 path, $4 body or "". Sets $code and $body.
do_call() {
  local args=(-s -w '\n%{http_code}' -X "$2" -H 'Accept: application/json') out
  [ -n "$4" ] && args+=(-H 'Content-Type: application/json' --data "$4")
  out="$(printf 'header = "DOLAPIKEY: %s"\n' "$1" | curl -K - "${args[@]}" "$api/$3")"
  code="$(printf '%s' "$out" | tail -n1)"
  body="$(printf '%s' "$out" | sed '$d')"
}

echo "== Connexion de $login"
do_login "wrong-password-0000000000" 0
check "Mauvais mot de passe: refusé" "$code" "403"

do_login "$pw" 1
check "Connexion (reset=1): nouveau jeton" "$code" "200"
t1="$token"
check "Jeton reçu (hexadécimal, au moins 32 caractères)" "$([ "${#t1}" -ge 32 ] && echo yes || echo no)" "yes"

do_login "$pw" 0
check "Connexion sans reset: même jeton (2e appareil)" "$([ "$token" = "$t1" ] && echo same || echo different)" "same"

echo "== Utilisation du jeton"
do_call "$t1" GET users/info ""
check "Lire son propre compte (users/info)" "$code" "200"
check "Le compte lu est bien $login" "$(printf '%s' "$body" | grep -q "\"login\": *\"$login\"" && echo yes || echo no)" "yes"
uid="$(printf '%s' "$body" | sed -n 's/^ \{0,8\}"id": *"\{0,1\}\([0-9][0-9]*\)"\{0,1\},.*/\1/p' | head -n1)"
check "Identifiant du compte lu" "$([ -n "$uid" ] && echo found || echo missing)" "found"

do_call "$t1" GET "products?limit=1" ""
check "Lire les pièces (404 = liste vide)" "$code" "200 404"
if [ "$code" = 200 ]; then
  for f in cost_price pmp; do
    printf 'INFO  champ %-9s renvoyé par l API produits: %s\n' "$f" "$(printf '%s' "$body" | grep -q "\"$f\":" && echo oui || echo non)"
  done
fi

do_call "$t1" GET users ""
check "Lister les utilisateurs: refusé (droit du groupe inchangé)" "$code" "403"

do_call "$t1" PUT "users/$uid" '{"admin":1}'
check "Se donner le statut administrateur: refusé" "$code" "403"

echo "== Déconnexion"
do_login "$pw" 1
check "Déconnexion (reset=1)" "$code" "200"
check "Le jeton change" "$([ -n "$token" ] && [ "$token" != "$t1" ] && echo changed || echo same)" "changed"

do_call "$t1" GET users/info ""
check "Ancien jeton refusé après déconnexion" "$code" "401 403"

do_call "$token" GET users/info ""
check "Nouveau jeton valide" "$code" "200"

# Leave no known token behind: a final reset makes the last one unknown to everyone.
do_login "$pw" 1
do_call "$token" GET users/info ""
check "Remise à zéro finale" "$code" "200"
token=""; t1=""; pw=""

printf '\nRESULT pass=%d fail=%d\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
