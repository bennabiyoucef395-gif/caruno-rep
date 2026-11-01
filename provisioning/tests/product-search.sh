#!/usr/bin/env bash
# Counter search test: the product searches the CARUNO front makes, as a signed-in seller.
# Needs the TiBAO pilot import (provisioning/20-import-products.sh with pilote-30-produits.csv).
# Same secret handling as login-api.sh: password and tokens only on curl's stdin, never printed.
# Ends with a reset so no token obtained during the test stays valid.
# Usage: provisioning/tests/product-search.sh [login] [secret key]
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

# GET /products with an sqlfilters expression (URL-encoded by curl). Sets $code, $body, $refs.
search() {
  local out
  out="$(printf 'header = "DOLAPIKEY: %s"\n' "$token" | curl -K - -s -G -w '\n%{http_code}' -H 'Accept: application/json' \
    --data-urlencode "sqlfilters=$1" --data-urlencode "limit=50" "$api/products")"
  code="$(printf '%s' "$out" | tail -n1)"
  body="$(printf '%s' "$out" | sed '$d')"
  refs="$(printf '%s' "$body" | sed -n 's/^ \{0,8\}"ref": *"\([^"]*\)".*/\1/p' | sort | tr '\n' ' ' | sed 's/ $//')"
}

do_login "$pw" 1
check "Connexion de $login" "$code" "200"

echo "== Recherche par OEM (champ oem_ref, normalisé)"
search "(ef.oem_ref:=:'1K0505279A')"
check "OEM exact 1K0505279A" "$code" "200"
check "  trouve la pièce TiBAO 414019" "$refs" "414019"
search "(ef.oem_ref:like:'%505279%')"
check "OEM partiel %505279%" "$refs" "414019"
search "(ef.oem_ref:=:'ZZZ000000')"
check "OEM inconnu: aucune pièce (200 vide ou 404)" "$code:${refs:-none}" "200:none 404:none"

echo "== Recherche par référence et désignation"
search "(t.ref:=:'413471')"
check "Référence 413471" "$refs" "413471"
search "(t.label:like:'%Headlight Level Sensor FR%')"
check "Désignation %Headlight Level Sensor FR%" "$(printf ' %s ' "$refs" | grep -q ' 417527 ' && echo found || echo missing)" "found"

echo "== Champs renvoyés"
search "(t.ref:=:'414019')"
check "Marque TIBAO renvoyée (array_options)" "$(printf '%s' "$body" | grep -q '"options_brand": *"TIBAO"' && echo yes || echo no)" "yes"
check "OEM renvoyé (array_options)" "$(printf '%s' "$body" | grep -q '"options_oem_ref": *"1K0505279A"' && echo yes || echo no)" "yes"

# Leave no known token behind.
do_login "$pw" 1
token=""; pw=""

printf '\nRESULT pass=%d fail=%d\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
