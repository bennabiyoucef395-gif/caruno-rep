#!/usr/bin/env bash
# Rule tests for the caruno_parts catalogue (TEST instance). Read-only.
# Runs compatible_parts() for every model with "Je ne sais pas" and for every vehicle type.
# Usage: scripts/parts/tests.sh
set -uo pipefail

container="${PARTS_DB_CONTAINER:-caruno-test-db-1}"
q() { docker exec -i "$container" sh -c 'exec mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" --default-character-set=utf8mb4 -N -B caruno_parts' 2>/dev/null; }
fail=0
check() { # $1 description, $2 actual, $3 expected
  if [ "$2" = "$3" ]; then echo "OK      $1"; else echo "ÉCHEC   $1 (obtenu: $2, attendu: $3)"; fail=1; fi
}

check "Chaque article a une catégorie" \
  "$(echo 'SELECT COUNT(*) FROM articles WHERE category_id IS NULL;' | q)" 0
# Reviewed category lists (categories.csv, import_review.py).
check "Chaque catégorie a un groupe parent et un nom arabe" \
  "$(echo "SELECT COUNT(*) FROM part_categories c LEFT JOIN part_groups g ON g.id = c.group_id
           WHERE g.id IS NULL OR c.name_ar = '' OR g.name <> c.group_name;" | q)" 0
check "« Cache moteur » : 6 articles, dépendant du moteur" \
  "$(echo "SELECT CONCAT(COUNT(a.id), '/', MAX(c.engine_dependent)) FROM part_categories c JOIN articles a ON a.category_id = c.id
           WHERE c.name = 'Cache moteur';" | q)" "6/1"
check "Embrayage : kit dépendant du moteur, émetteur non" \
  "$(echo "SELECT GROUP_CONCAT(engine_dependent ORDER BY name) FROM part_categories
           WHERE name IN ('Kit d''embrayage', 'Émetteur d''embrayage');" | q)" "0,1"
check "Article classé à la main (432322 → Silentbloc de suspension)" \
  "$(echo "SELECT c.name FROM articles a JOIN part_categories c ON c.id = a.category_id WHERE a.ref = '432322';" | q)" \
  "Silentbloc de suspension"
check "Aucune compatibilité vers un type de véhicule d'un autre modèle" \
  "$(echo 'SELECT COUNT(*) FROM fitment f JOIN vehicle_types vt ON vt.id = f.vehicle_type_id WHERE vt.model_id <> f.model_id;' | q)" 0
check "Les options de chaque modèle finissent par « Je ne sais pas » (id NULL)" \
  "$(echo "SELECT COUNT(*) FROM (SELECT get_engine_options(id) o FROM models) t
           WHERE JSON_VALUE(o, CONCAT('\$[', JSON_LENGTH(o) - 1, '].label')) <> 'Je ne sais pas'
              OR JSON_VALUE(o, CONCAT('\$[', JSON_LENGTH(o) - 1, '].vehicle_type_id')) IS NOT NULL;" | q)" 0
check "Chaque option proposée appartient au modèle" \
  "$(echo "SELECT COUNT(*) FROM models m, JSON_TABLE(get_engine_options(m.id), '\$[*]' COLUMNS (vt INT PATH '\$.vehicle_type_id')) o
           LEFT JOIN vehicle_types vt ON vt.id = o.vt WHERE o.vt IS NOT NULL AND (vt.model_id IS NULL OR vt.model_id <> m.id);" | q)" 0

opts() { # $1 maker, $2 model, $3 generation or '' -> option labels, one per line
  echo "SELECT o.label FROM models m JOIN manufacturers k ON k.id = m.manufacturer_id,
        JSON_TABLE(get_engine_options(m.id), '\$[*]' COLUMNS (label VARCHAR(80) PATH '\$.label')) o
        WHERE k.name = '$1' AND m.name = '$2' AND IFNULL(m.generation, '') = '$3';" | q
}
golf="$(opts VW 'Golf 7' '')"; a4="$(opts AUDI A4 B8)"
check "Golf 7 : 2.0 TDI proposé"                         "$(grep -c '^2.0 TDI (diesel)$' <<<"$golf")" 1
check "Golf 7 : « 2.0 » générique masqué (2.0 TDI/TSI existent)" "$(grep -c '^2.0 (essence ou diesel)$' <<<"$golf")" 0
check "A4 B8 : 2.0 TFSI proposé"                          "$(grep -c '^2.0 TFSI (essence)$' <<<"$a4")" 1
check "A4 B8 : pas de 4.0 TFSI (paire non prouvée)"       "$(grep -c '^4.0 TFSI' <<<"$a4")" 0

# Every model with "Je ne sais pas", then every vehicle type. Blocks are introduced by a marker line.
calls="$(echo "SELECT CONCAT('SELECT ''#M', id, '''; CALL compatible_parts(', id, ', NULL, NULL);') FROM models
               UNION ALL
               SELECT CONCAT('SELECT ''#V', vt.id, '#', e.label, '''; CALL compatible_parts(', vt.model_id, ', ', vt.id, ', NULL);')
               FROM vehicle_types vt JOIN engines e ON e.id = vt.engine_id;" | q)"
result="$(q <<<"$calls")"
[ -n "$result" ] || { echo "ÉCHEC   compatible_parts n'a rien renvoyé"; exit 1; }
# columns: ref, name, group, category, engine_dependent, status, evidence
read -r unknown_bad engine_bad rows < <(awk -F'\t' '
  /^#M/ { mode = "M"; next }
  /^#V/ { mode = "V"; split($0, a, "#"); label = a[3]; next }
  NF >= 7 { n++
    if (mode == "M" && $5 == 1 && $6 == "compatible") u++
    if (mode == "V" && $5 == 1 && $6 == "compatible" && index($7, label " · ") == 0) e++ }
  END { print u + 0, e + 0, n + 0 }' <<<"$result")
check "« Je ne sais pas » : aucune pièce dépendante du moteur « compatible » ($rows lignes vérifiées)" "$unknown_bad" 0
check "Moteur choisi : une pièce dépendante du moteur n'est « compatible » que pour son moteur" "$engine_bad" 0

# Links to the vehicle reference data (step "links", model_links.csv). Reference columns only.
check "Golf 7 lié à VehiclesDB volkswagen/golf" \
  "$(echo "SELECT m.vdb_model_slug FROM models m JOIN manufacturers k ON k.id = m.manufacturer_id
           WHERE k.name = 'VW' AND m.name = 'Golf 7';" | q)" "volkswagen/golf"
check "Liens vehicle-makes-models chargés (au moins 200 modèles)" \
  "$(echo "SELECT COUNT(vmm_generation_id) >= 200 FROM models;" | q)" 1
if [ -n "$(echo "SHOW DATABASES LIKE 'vehicle_ref';" | q)" ]; then
  check "Chaque génération principale est dans vehicle_ref.model_links (is_main)" \
    "$(echo "SELECT COUNT(*) FROM models m LEFT JOIN vehicle_ref.model_links l
             ON l.caruno_model_id = m.id AND l.vmm_generation_id = m.vmm_generation_id AND l.is_main
             WHERE m.vmm_generation_id IS NOT NULL AND l.caruno_model_id IS NULL;" | q)" 0
  check "Chaque lien vmm pointe vers une génération existante" \
    "$(echo "SELECT COUNT(*) FROM vehicle_ref.model_links l LEFT JOIN vehicle_ref.vmm_generations g ON g.id = l.vmm_generation_id
             WHERE g.id IS NULL;" | q)" 0
  check "Chaque lien VehiclesDB pointe vers un modèle existant" \
    "$(echo "SELECT COUNT(*) FROM models m LEFT JOIN vehicle_ref.vdb_models v ON v.id = m.vdb_model_slug AND v.kind = 'car'
             WHERE m.vdb_model_slug IS NOT NULL AND v.id IS NULL;" | q)" 0
fi

[ "$fail" = 0 ] && echo "Tous les tests passent." || { echo "Des tests échouent."; exit 1; }
