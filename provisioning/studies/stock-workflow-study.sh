#!/usr/bin/env bash
# Stock workflow study (doc/15): counter sale vs delivery-then-invoice, under each
# Dolibarr stock rule. Runs through the REST API as caruno_api, like CARUNO will.
#
# - Creates fictitious TEST-STK-* data (2 parts, 2 customers). Refuses to run twice.
# - Switches the stock rule TEMPORARILY, the same way admin/stock.php does
#   (one decrease rule at a time), and ALWAYS restores "no rule" at the end.
# - Checks that every Dolibarr constant is back to its initial value.
# Stock movements and validated invoice numbers it creates are permanent (Dolibarr design).
# The API key is read from instance.env and passed to curl on stdin; never printed.
set -uo pipefail
export MSYS_NO_PATHCONV=1

api="${DOLI_URL:-http://localhost:8080}/api/index.php"
env_file="${HANOUT_ENV_FILE:-C:/Users/TRETEC/caruno-data/instances/hanout-vw/instance.env}"
db="${DB_CONTAINER:-dolibarr-db}"; app="${APP_CONTAINER:-dolibarr-app}"
WH=1              # warehouse "Magasin"
CASH=1            # bank account "CAISSE"
LIQ=4             # payment mode "Cash"
NOW=$(date +%s)

sql() { docker exec "$db" sh -c "MYSQL_PWD=\"\$MARIADB_ROOT_PASSWORD\" mariadb -uroot -N \"\$MARIADB_DATABASE\" -e \"$1\""; }

call() { # $1 method, $2 path, $3 json body -> prints "<http code>|<body>"
  local cfg="header = \"DOLAPIKEY: $(grep '^CARUNO_API_KEY=' "$env_file" | cut -d= -f2- | tr -d '\n')\""
  local args=(-s -w '|%{http_code}' -X "$1" -H 'Accept: application/json')
  [ -n "${3:-}" ] && args+=(-H 'Content-Type: application/json' --data "$3")
  local out; out=$(printf '%s\n' "$cfg" | curl -K - "${args[@]}" "$api/$2")
  echo "${out##*|}|${out%|*}"
}
ok_id() { # extracts a numeric id from a 200 response, or prints ERR:<code>
  local code="${1%%|*}" body="${1#*|}"
  [ "$code" = 200 ] && [[ "$body" =~ ^[0-9]+$ ]] && echo "$body" || echo "ERR:$code:$(echo "$body" | tr -d '\n' | cut -c1-160)"
}

# Same constants and exclusivity as admin/stock.php; only Dolibarr's own setters.
set_rule() { # $1 = none | STOCK_CALCULATE_ON_BILL | STOCK_CALCULATE_ON_SHIPMENT
  docker exec -i -u www-data "$app" php <<PHP
<?php
define('NOLOGIN',1); define('NOCSRFCHECK',1); define('NOSESSION',1); define('NOREQUIREMENU',1); define('NOREQUIREHTML',1);
\$_SERVER['HTTP_HOST']='localhost';
require '/var/www/html/master.inc.php'; require_once DOL_DOCUMENT_ROOT.'/core/lib/admin.lib.php';
foreach (array('STOCK_CALCULATE_ON_BILL','STOCK_CALCULATE_ON_VALIDATE_ORDER','STOCK_CALCULATE_ON_SHIPMENT','STOCK_CALCULATE_ON_SHIPMENT_CLOSE') as \$c) { dolibarr_del_const(\$db, \$c, \$conf->entity); }
if ('$1' !== 'none') { dolibarr_set_const(\$db, '$1', '1', 'chaine', 0, '', \$conf->entity); }
PHP
  echo "rule now: $(sql "SELECT IFNULL(GROUP_CONCAT(name),'none') FROM llx_const WHERE name LIKE 'STOCK_CALCULATE_ON%' AND value='1';")"
}

stock_of() { sql "SELECT IFNULL((SELECT reel FROM llx_product_stock WHERE fk_product=$1 AND fk_entrepot=$WH),0);"; }
mvts_of() { sql "SELECT COUNT(*) FROM llx_stock_mouvement WHERE fk_product=$1;"; }

declare -a RESULTS
record() { # id | rule | flow | step | expected | P1 before | P1 after | P2 before | P2 after | verdict
  RESULTS+=("$*"); printf '%s\n' "$*"
}

# ---------------------------------------------------------------------------
# The study may run only once: refuse if TEST-STK stock movements already exist.
[ "$(sql "SELECT COUNT(*) FROM llx_stock_mouvement m JOIN llx_product p ON p.rowid=m.fk_product WHERE p.ref LIKE 'TEST-STK%';")" = 0 ] || { echo "TEST-STK stock movements already exist: refusing to run twice"; exit 1; }
[ "$(sql "SELECT COUNT(*) FROM llx_const WHERE name LIKE 'STOCK_CALCULATE_ON%';")" = 0 ] || { echo "A stock rule is already set: refusing to run"; exit 1; }

snapshot_consts() { sql "SELECT name, entity, value FROM llx_const ORDER BY name, entity;" | md5sum | cut -c1-32; }
CONST_BEFORE=$(snapshot_consts)
trap 'echo; echo "== Restoring: no stock rule"; set_rule none' EXIT

echo "== Setup (fictitious data, through the API)"
# Find-or-create. Non-ASCII characters are JSON-escaped (\u00xx): command-line
# arguments lose UTF-8 on Windows.
product_id() { # $1 ref, $2 json
  local id; id=$(sql "SELECT rowid FROM llx_product WHERE ref='$1';")
  [ -n "$id" ] && echo "$id" || ok_id "$(call POST products "$2")"
}
thirdparty_id() { # $1 name, $2 json
  local id; id=$(sql "SELECT rowid FROM llx_societe WHERE nom='$1';")
  [ -n "$id" ] && echo "$id" || ok_id "$(call POST thirdparties "$2")"
}
P1=$(product_id TEST-STK-001 '{"ref":"TEST-STK-001","label":"Plaquettes de frein avant (TEST stock)","type":0,"status":1,"status_buy":1}')
P2=$(product_id TEST-STK-002 '{"ref":"TEST-STK-002","label":"Filtre a huile (TEST stock)","type":0,"status":1,"status_buy":1}')
C1=$(thirdparty_id 'TEST-STK Client comptoir' '{"name":"TEST-STK Client comptoir","client":1,"country_id":13}')
G1=$(thirdparty_id 'TEST-STK Garage livre' '{"name":"TEST-STK Garage livre","client":1,"country_id":13}')
echo "products P1=$P1 P2=$P2 customers C1=$C1 G1=$G1"
for id in "$P1" "$P2" "$C1" "$G1"; do [[ "$id" =~ ^[0-9]+$ ]] || { echo "setup failed: $id"; exit 1; }; done
for p in "$P1" "$P2"; do
  m=$(ok_id "$(call POST stockmovements "{\"product_id\":$p,\"warehouse_id\":$WH,\"qty\":20,\"type\":3,\"label\":\"TEST-STK stock initial\",\"movementcode\":\"TEST-STK-INIT\"}")")
  echo "initial stock movement for $p: $m -> stock $(stock_of "$p")"
done

line() { echo "{\"fk_product\":$1,\"qty\":$2,\"subprice\":1000,\"tva_tx\":19,\"product_type\":0,\"desc\":\"TEST-STK\"}"; }
invoice() { ok_id "$(call POST invoices "{\"socid\":$1,\"type\":0,\"date\":$NOW,\"lines\":[$(line "$2" "$3")]}")"; }
order() { ok_id "$(call POST orders "{\"socid\":$1,\"date\":$NOW,\"lines\":[$(line "$2" "$3")]}")"; }
validate_invoice() { call POST "invoices/$1/validate" "{\"idwarehouse\":$2,\"notrigger\":0}" | cut -d'|' -f1; }
pay_cash() { call POST "invoices/$1/payments" "{\"datepaye\":$NOW,\"paymentid\":$LIQ,\"closepaidinvoices\":\"yes\",\"accountid\":$CASH}" | cut -d'|' -f1; }
ship_order() { # validate order, create shipment from it, validate shipment -> prints shipment id / codes
  local o=$1 c s v
  c=$(call POST "orders/$o/validate" '{"idwarehouse":0,"notrigger":0}' | cut -d'|' -f1)
  s=$(ok_id "$(call POST "orders/$o/shipment/$WH" '')")
  v=$(call POST "shipments/${s}/validate" '{"notrigger":0}')
  echo "order_validate=$c shipment=$s shipment_validate=${v%%|*} ${v#*|}" | cut -c1-200
}

run() { # id rule flow step expected product qtyexpecteddelta -- command...
  local id=$1 rule=$2 flow=$3 step=$4 exp=$5; shift 5
  local b1 b2 a1 a2; b1=$(stock_of "$P1"); b2=$(stock_of "$P2")
  local info; info=$("$@" 2>&1 | tail -1)
  a1=$(stock_of "$P1"); a2=$(stock_of "$P2")
  record "$id | $rule | $flow | $step | expected: $exp | P1 $b1->$a1 | P2 $b2->$a2 | $info"
}

# ---------------------------------------------------------------------------
echo; echo "== R0: no rule (current HANOUT setting)"; set_rule none
I=$(invoice "$C1" "$P1" 1)
run T01 none A "Facture comptoir validée (entrepôt fourni)" "P1 -0 (aucune règle)" validate_invoice "$I" $WH
run T01b none A "Encaissement espèces" "aucun effet stock" pay_cash "$I"

echo; echo "== R1: STOCK_CALCULATE_ON_BILL (temporary)"; set_rule STOCK_CALCULATE_ON_BILL
I=$(invoice "$C1" "$P1" 1)
run T02 BILL A "Facture comptoir validée avec entrepôt" "P1 -1" validate_invoice "$I" $WH
run T02b BILL A "Encaissement espèces" "aucun effet stock" pay_cash "$I"
I=$(invoice "$C1" "$P1" 1)
run T03 BILL A "Facture comptoir validée SANS entrepôt (défaut API)" "P1 -0 : sortie oubliée" validate_invoice "$I" 0
O=$(order "$G1" "$P2" 2)
run T04 BILL B "Commande garage validée + expédition validée (livraison)" "P2 -0 : livré mais stock non sorti" ship_order "$O"
IB=$(ok_id "$(call POST "invoices/createfromorder/$O" '')")
run T05 BILL B "Facture ultérieure (depuis la commande) validée avec entrepôt" "P2 -2 (sortie au moment de la facture)" validate_invoice "$IB" $WH
I=$(invoice "$C1" "$P1" 1)
run T06a BILL A "Mouvement manuel -1 (sortie physique saisie à part)" "P1 -1" call POST stockmovements "{\"product_id\":$P1,\"warehouse_id\":$WH,\"qty\":-1,\"type\":2,\"label\":\"TEST-STK sortie manuelle\",\"movementcode\":\"TEST-STK-MAN\"}"
run T06b BILL A "Puis facture du même article validée avec entrepôt" "P1 -1 encore : DOUBLE SORTIE" validate_invoice "$I" $WH
I=$(invoice "$C1" "$P1" 500)
run T07 BILL A "Facture de 500 unités (stock insuffisant) validée avec entrepôt" "refus (stock négatif interdit)" validate_invoice "$I" $WH

echo; echo "== R2: STOCK_CALCULATE_ON_SHIPMENT (temporary)"; set_rule STOCK_CALCULATE_ON_SHIPMENT
I=$(invoice "$C1" "$P1" 1)
run T08 SHIPMENT A "Facture comptoir validée avec entrepôt" "P1 -0 : sortie oubliée si rien d'autre" validate_invoice "$I" $WH
run T09 SHIPMENT A "Mouvement explicite -1 rattaché à la facture (modèle TakePOS)" "P1 -1" call POST stockmovements "{\"product_id\":$P1,\"warehouse_id\":$WH,\"qty\":-1,\"type\":2,\"label\":\"Vente comptoir TEST-STK\",\"movementcode\":\"CARUNO-SALE-$I\",\"origin_type\":\"facture\",\"origin_id\":$I}"
O=$(order "$C1" "$P1" 1)
run T10 SHIPMENT A "Comptoir express : commande + expédition validées" "P1 -1 à l'expédition" ship_order "$O"
IA=$(ok_id "$(call POST "invoices/createfromorder/$O" '')")
run T11 SHIPMENT A "Puis facture (depuis la commande) validée avec entrepôt" "P1 -0 (déjà sorti)" validate_invoice "$IA" $WH
O=$(order "$G1" "$P2" 2)
run T12 SHIPMENT B "Commande garage + expédition validées (livraison)" "P2 -2 à la livraison" ship_order "$O"
IB=$(ok_id "$(call POST "invoices/createfromorder/$O" '')")
run T13 SHIPMENT B "Facture ultérieure validée avec entrepôt" "P2 -0 (déjà sorti)" validate_invoice "$IB" $WH
O=$(order "$G1" "$P2" 500)
run T14 SHIPMENT B "Expédition de 500 unités (stock insuffisant)" "refus (stock négatif interdit)" ship_order "$O"

echo; echo "== R3: rule change between delivery and invoice (configuration risk)"
O=$(order "$G1" "$P2" 1)
run T15a SHIPMENT B "Livraison validée sous la règle EXPÉDITION" "P2 -1" ship_order "$O"
set_rule STOCK_CALCULATE_ON_BILL
IB=$(ok_id "$(call POST "invoices/createfromorder/$O" '')")
run T15b BILL B "Règle passée à FACTURE, puis facture validée avec entrepôt" "P2 -1 encore : DOUBLE SORTIE" validate_invoice "$IB" $WH

# ---------------------------------------------------------------------------
set_rule none; trap - EXIT
CONST_AFTER=$(snapshot_consts)
echo; echo "== Final state"
echo "constants identical to start: $([ "$CONST_BEFORE" = "$CONST_AFTER" ] && echo yes || echo NO)"
echo "P1 stock=$(stock_of "$P1") movements=$(mvts_of "$P1") | P2 stock=$(stock_of "$P2") movements=$(mvts_of "$P2")"
echo "invoices created: $(sql "SELECT COUNT(*) FROM llx_facture WHERE fk_soc IN ($C1,$G1);") (validated: $(sql "SELECT COUNT(*) FROM llx_facture WHERE fk_soc IN ($C1,$G1) AND fk_statut>0;")) | orders: $(sql "SELECT COUNT(*) FROM llx_commande WHERE fk_soc IN ($C1,$G1);") | shipments: $(sql "SELECT COUNT(*) FROM llx_expedition WHERE fk_soc IN ($C1,$G1);") (validated: $(sql "SELECT COUNT(*) FROM llx_expedition WHERE fk_soc IN ($C1,$G1) AND fk_statut>0;"))"
echo "invoice refs: $(sql "SELECT GROUP_CONCAT(ref ORDER BY rowid) FROM llx_facture WHERE fk_soc IN ($C1,$G1);")"
