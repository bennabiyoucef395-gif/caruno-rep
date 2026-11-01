#!/usr/bin/env bash
# REST API access test for the CARUNO_API technical account.
# The key is read from instance.env and given to curl on stdin (-K -): it never
# appears in a command line, in the output or in a file.
# Forbidden calls use non-existent ids: Dolibarr checks rights before loading the
# object (verified in the 24.0.2 source), so 403 = refused by permission, 404 = allowed.
# Usage: provisioning/tests/api-access.sh
set -uo pipefail

api="${DOLI_URL:-http://localhost:8080}/api/index.php"
env_file="${HANOUT_ENV_FILE:-C:/Users/TRETEC/caruno-data/instances/hanout-vw/instance.env}"
key_name="${API_KEY_NAME:-CARUNO_API_KEY}"

call() { # $1 method, $2 path, $3 json body or "", $4 key mode: valid|wrong|none -> prints http code
  local cfg=""
  case "$4" in
    valid) cfg="header = \"DOLAPIKEY: $(grep "^${key_name}=" "$env_file" | cut -d= -f2- | tr -d '\n')\"" ;;
    wrong) cfg='header = "DOLAPIKEY: 0000000000000000000000000000000000000000"' ;;
  esac
  local args=(-s -o /dev/null -w '%{http_code}' -X "$1" -H 'Accept: application/json')
  [ -n "$3" ] && args+=(-H 'Content-Type: application/json' --data "$3")
  printf '%s\n' "$cfg" | curl -K - "${args[@]}" "$api/$2"
}

# method|path|body|key mode|expected codes (space separated)|description
tests="GET|status||none|401|Sans clé: refusé
GET|status||wrong|401 403|Clé invalide: refusé
GET|status||valid|200|Statut de l'API
GET|users/info||valid|403|Lire son propre compte (exige user:self:creer, non accordé)
GET|products?limit=1||valid|200 404|Lire les pièces (404 = liste vide)
GET|categories?type=product||valid|200|Lire les familles
GET|warehouses||valid|200|Lire les entrepôts
GET|thirdparties?limit=1||valid|200 404|Lire les tiers (404 = liste vide)
GET|bankaccounts||valid|200|Lire banque et caisse
GET|invoices?limit=1||valid|200 404|Lire les factures (404 = liste vide)
GET|setup/dictionary/payment_types||valid|200|Lire les modes de paiement
GET|users||valid|403|Lister les utilisateurs
GET|users/groups||valid|403|Lister les groupes
POST|users|{\"login\":\"permtest.api\",\"lastname\":\"PERMTEST\",\"admin\":1}|valid|403|Créer un utilisateur administrateur
GET|setup/modules||valid|403|Lister les modules (admin)
PUT|setup/modules/modVariants/enable||valid|401 403|Activer un module (admin)
POST|setup/extrafields/product/permtest|{\"label\":\"PERMTEST\",\"type\":\"varchar\"}|valid|401 403|Créer un champ supplémentaire (admin)
GET|setup/conf/MAIN_INFO_SOCIETE_NOM||valid|403|Lire une constante de configuration (admin)
GET|setup/checkintegrity?target=local||valid|403|Contrôle d'intégrité (admin)
POST|bankaccounts|{\"ref\":\"PERMTEST\",\"label\":\"PERMTEST\"}|valid|403|Créer un compte bancaire
DELETE|bankaccounts/999999||valid|403|Supprimer un compte bancaire
DELETE|categories/999999||valid|403|Supprimer une catégorie
DELETE|products/999999||valid|403|Supprimer une pièce"

pass=0; fail=0
while IFS='|' read -r method path body mode expected desc; do
  body="${body//\\\"/\"}"
  code=$(call "$method" "$path" "$body" "$mode")
  if [[ " $expected " == *" $code "* ]]; then r=PASS; pass=$((pass+1)); else r=FAIL; fail=$((fail+1)); fi
  printf '%-4s %-7s %-40s key=%-5s http=%s expected=%s  %s\n' "$r" "$method" "$path" "$mode" "$code" "${expected// //}" "$desc"
done <<< "$tests"

echo "SUMMARY checks=$((pass+fail)) pass=$pass fail=$fail"
[ "$fail" = 0 ]
