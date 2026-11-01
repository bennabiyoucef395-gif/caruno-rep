#!/usr/bin/env bash
# Direct-URL permission test for the HANOUT VW roles (web interface).
# Logs in as each test user (and admin as control), requests each URL directly and
# compares ALLOWED / DENIED with the expected matrix. Passwords are read from the
# secret files and sent on stdin; they are never printed.
# Usage: provisioning/tests/permissions-ui.sh
set -uo pipefail

base="${DOLI_URL:-http://localhost:8080}"
env_file="${HANOUT_ENV_FILE:-C:/Users/TRETEC/caruno-data/instances/hanout-vw/instance.env}"
test_file="${HANOUT_TEST_USERS_FILE:-$(dirname "$env_file")/test-users.env}"

# login|secret file|secret key|column
users="admin|$env_file|DOLI_ADMIN_PASSWORD|A
dev.gerant|$test_file|TEST_PW_DEV_GERANT|G
dev.responsable|$test_file|TEST_PW_DEV_RESPONSABLE|R
dev.vendeur|$test_file|TEST_PW_DEV_VENDEUR|V
dev.magasinier|$test_file|TEST_PW_DEV_MAGASINIER|M
dev.comptable|$test_file|TEST_PW_DEV_COMPTABLE|C"

# url|columns expected ALLOWED (admin A is always allowed)|description
matrix="admin/modules.php|A|Administration: modules
admin/company.php|A|Administration: société
admin/security_other.php|A|Administration: sécurité
imports/import.php|A|Imports de masse
user/card.php?action=create|A|Créer un utilisateur
user/list.php|AG|Lire les utilisateurs
user/group/list.php|AG|Lire les groupes
product/list.php|AGRVMC|Lire les pièces
product/card.php?action=create&type=0|AGRM|Créer une pièce
categories/index.php?type=product|AGRVMC|Lire les familles
categories/card.php?action=create&type=product|AGRVMC|Page famille (création réelle testée par permissions-write.sh)
product/stock/list.php|AGRVMC|Lire les entrepôts
product/stock/card.php?action=create|AGRM|Créer un entrepôt
product/stock/movement_list.php|AGRMC|Lire les mouvements de stock
product/stock/massstockmove.php|AGRVMC|Page mouvements de masse (actions: stock:mouvement:creer)
product/inventory/list.php|AGRM|Inventaires
societe/list.php|AGRVMC|Lire les tiers
societe/card.php?action=create|AGRV|Créer un tiers
comm/propal/card.php?action=create|AGRV|Créer un devis
commande/card.php?action=create|AGRV|Créer une commande client
expedition/list.php|AGRVMC|Lire les expéditions
compta/facture/list.php|AGRVC|Lire les factures
compta/facture/card.php?action=create|AGRVC|Créer une facture
fourn/commande/list.php|AGRMC|Lire les commandes fournisseurs
fourn/commande/card.php?action=create|AGR|Créer une commande fournisseur
fourn/facture/list.php|AGRC|Lire les factures fournisseurs
reception/list.php|AGRMC|Lire les réceptions
compta/bank/list.php|AGRC|Lire banque et caisse
compta/bank/card.php?action=create|AGC|Formulaire compte bancaire (enregistrement: banque:configurer)
compta/sociales/list.php|AGC|Taxes et charges
margin/productMargins.php|AGRC|Marges
exports/export.php|AGC|Exports"

pass=0; fail=0
printf '%-48s %s\n' "URL" "A G R V M C   (expected vs result)"
declare -A result
while IFS='|' read -r login file key col; do
  jar="$(mktemp)"
  token=$(curl -s -c "$jar" -b "$jar" "$base/" | grep -oE 'name="token" value="[^"]+"' | head -1 | sed -E 's/.*value="([^"]+)"/\1/')
  logged=$(grep "^${key}=" "$file" | cut -d= -f2- | tr -d '\n' | curl -s -c "$jar" -b "$jar" -L \
      --data-urlencode "token=$token" --data-urlencode "actionlogin=login" --data-urlencode "loginfunction=loginfunction" \
      --data-urlencode "username=$login" --data-urlencode "password@-" "$base/index.php" | grep -c 'logout.php')
  [ "$logged" -gt 0 ] || { echo "LOGIN FAILED for $login"; fail=$((fail+1)); rm -f "$jar"; continue; }
  while IFS='|' read -r url allowed desc; do
    body=$(curl -s -c "$jar" -b "$jar" "$base/$url")
    # Here-strings, not pipes: with pipefail, "echo | grep -q" fails on large pages (SIGPIPE).
    if grep -q 'Acc&egrave;s refus&eacute;\|Access refused\|Accès refusé' <<< "$body"; then r=D
    elif grep -q 'logout.php' <<< "$body"; then r=A
    else r=?; fi
    result["$url|$col"]=$r
  done <<< "$matrix"
  rm -f "$jar"
done <<< "$users"

while IFS='|' read -r url allowed desc; do
  line=""; ok=1
  for col in A G R V M C; do
    exp=D; [[ "$allowed" == *"$col"* ]] && exp=A
    got="${result["$url|$col"]:-?}"
    if [ "$exp" = "$got" ]; then line+="$got "; pass=$((pass+1)); else line+="$got! "; ok=0; fail=$((fail+1)); fi
  done
  printf '%-48s %s %s  %s\n' "$url" "$line" "$([ $ok = 1 ] && echo PASS || echo FAIL)" "$desc"
done <<< "$matrix"

echo "A=allowed D=denied  ! = differs from expected"
echo "SUMMARY checks=$((pass+fail)) pass=$pass fail=$fail"
[ "$fail" = 0 ]
