#!/usr/bin/env bash
# Exports the public online shop (vitrine) data: the parts switched "en ligne" in the app that are on sale and
# in stock, with their public price, family and photo, plus the shop name / address / WhatsApp from the profile.
# Reads the database inside its container and the documents folder on disk: no Dolibarr password or API key.
# Usage: scripts/vitrine/export.sh            -> C:/Users/TRETEC/dev/caruno-app/web/vitrine/data
# Env: VITRINE_OUT, VITRINE_DB_CONTAINER (dolibarr-db), VITRINE_INSTANCE_DIR (…/instances/hanout-vw).
# Re-run after changes in "Magasin en ligne" (or schedule it): the vitrine only shows the last export.
set -euo pipefail

here="$(cd "$(dirname "$0")" && { pwd -W 2>/dev/null || pwd; })"
out="${VITRINE_OUT:-C:/Users/TRETEC/dev/caruno-app/web/vitrine/data}"
db="${VITRINE_DB_CONTAINER:-dolibarr-db}"
instance="${VITRINE_INSTANCE_DIR:-C:/Users/TRETEC/caruno-data/instances/hanout-vw}"
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
work_w="$(cd "$work" && { pwd -W 2>/dev/null || pwd; })"

# Public price = latest level-1 price (multiprices), else the base price. Family = first product category.
docker exec -i "$db" sh -c 'exec mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" --default-character-set=utf8mb4 -N -B "$MARIADB_DATABASE"' > "$work/parts.tsv" <<'SQL'
SELECT p.ref, p.label, ef.oem_ref, ef.brand,
       COALESCE((SELECT pp.price FROM llx_product_price pp WHERE pp.fk_product = p.rowid AND pp.price_level = 1
                 ORDER BY pp.date_price DESC, pp.rowid DESC LIMIT 1), p.price) AS price,
       (SELECT c.label FROM llx_categorie_product cp JOIN llx_categorie c ON c.rowid = cp.fk_categorie AND c.type = 0
         WHERE cp.fk_product = p.rowid ORDER BY c.rowid LIMIT 1) AS family
FROM llx_product p
JOIN llx_product_extrafields ef ON ef.fk_object = p.rowid
WHERE ef.en_ligne = 1 AND p.tosell = 1 AND p.stock > 0
HAVING price > 0
ORDER BY p.label, p.ref;
SQL

mkdir -p "$(dirname "$out")"
MSYS_NO_PATHCONV=1 docker run --rm --network none -v "$here:/app:ro" -v "$work_w:/work:ro" -v "$instance/documents:/docs:ro" \
  -v "$(dirname "$out"):/out" python:3.12-slim python -I /app/export_vitrine.py /work /docs "/out/$(basename "$out")"
