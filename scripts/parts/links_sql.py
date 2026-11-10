"""
model_links.csv (reviewed links from our models to the vehicle reference data, scripts/vehicle-ref/link_models.py)
-> two SQL files for scripts/parts/build.sh step "links":
  50_links.sql        caruno_parts.models.vdb_model_slug / vmm_generation_id (reference columns only)
  51_links_vref.sql   vehicle_ref.model_links: every vmm generation matched to each model (is_main = the main one)
Rows are keyed by maker + model name + generation (ids change at each rebuild), compared exactly (binary),
not with the database's accent-insensitive collation. Rows that match no model are listed by the SQL.

Usage: python -I links_sql.py <model_links.csv> <out_dir>
"""
import csv, os, re, sys

def text(v):
    return "'" + str(v or "").replace("\\", "\\\\").replace("'", "\\'") + "'"

def lit(v):
    return "NULL" if v is None or v == "" else text(v)

def num(v, what):
    if v in ("", None):
        return "NULL"
    if not re.fullmatch(r"\d+", v):
        sys.exit(f"model_links.csv: {what} is not a number: {v!r}")
    return v

TMP = """CREATE TEMPORARY TABLE tmp_links (
  maker VARCHAR(40) NOT NULL, name VARCHAR(80) NOT NULL, generation VARCHAR(40) NOT NULL,
  vdb VARCHAR(120) NULL, vmm_main INT NULL, vmm_id INT NULL);
"""
MATCH = """CAST(k.name AS BINARY) = CAST(t.maker AS BINARY) AND CAST(m.name AS BINARY) = CAST(t.name AS BINARY)
  AND CAST(IFNULL(m.generation, '') AS BINARY) = CAST(t.generation AS BINARY)"""
JOIN = f"JOIN manufacturers k ON k.id = m.manufacturer_id\nJOIN tmp_links t ON {MATCH}"

def main(src, out_dir):
    rows = list(csv.DictReader(open(src, encoding="utf-8-sig"), delimiter=";"))
    seen = set()
    vals_model, vals_gen = [], []
    for r in rows:
        key = (r["marque"], r["modele"], r["generation"])
        if key in seen:
            sys.exit(f"model_links.csv: duplicate row {key}")
        seen.add(key)
        main_id = num(r["vmm_generation_id"], "vmm_generation_id")
        ids = [num(i, "vmm_generation_ids") for i in r["vmm_generation_ids"].split()]
        if main_id != "NULL" and main_id not in ids:
            ids.insert(0, main_id)
        base = f"{text(r['marque'])},{text(r['modele'])},{text(r['generation'])}"   # '' = no generation
        vals_model.append(f"({base},{lit(r['vdb_model_id'])},{main_id},NULL)")
        vals_gen += [f"({base},NULL,{main_id},{i})" for i in ids]

    ins = lambda vals: "".join("INSERT INTO tmp_links (maker, name, generation, vdb, vmm_main, vmm_id) VALUES\n"
                               + ",\n".join(vals[i:i + 500]) + ";\n" for i in range(0, len(vals), 500))
    with open(os.path.join(out_dir, "50_links.sql"), "w", encoding="utf-8", newline="\n") as f:
        f.write("SET NAMES utf8mb4;\n" + TMP + ins(vals_model))
        f.write("UPDATE models SET vdb_model_slug = NULL, vmm_generation_id = NULL;\n")
        f.write(f"UPDATE models m {JOIN}\nSET m.vdb_model_slug = t.vdb, m.vmm_generation_id = t.vmm_main;\n")
        f.write("SELECT CONCAT('Link row matching no model: ', t.maker, ' | ', t.name, ' | ', t.generation) AS warning\n"
                "FROM tmp_links t WHERE NOT EXISTS (SELECT 1 FROM models m JOIN manufacturers k ON k.id = m.manufacturer_id\n"
                f"  WHERE {MATCH});\n")
        f.write("SELECT COUNT(vdb_model_slug) AS models_with_vdb, COUNT(vmm_generation_id) AS models_with_vmm FROM models;\n")
    with open(os.path.join(out_dir, "51_links_vref.sql"), "w", encoding="utf-8", newline="\n") as f:
        f.write("SET NAMES utf8mb4;\n" + TMP + (ins(vals_gen) if vals_gen else ""))
        f.write("CREATE TABLE IF NOT EXISTS vehicle_ref.model_links (\n"
                "  caruno_model_id INT UNSIGNED NOT NULL, vmm_generation_id INT NOT NULL, is_main BOOLEAN NOT NULL,\n"
                "  PRIMARY KEY (caruno_model_id, vmm_generation_id), KEY (vmm_generation_id)) ENGINE=InnoDB;\n")
        f.write("DELETE FROM vehicle_ref.model_links;\n")
        f.write(f"INSERT INTO vehicle_ref.model_links (caruno_model_id, vmm_generation_id, is_main)\n"
                f"SELECT m.id, t.vmm_id, t.vmm_id <=> t.vmm_main FROM models m {JOIN};\n")
        f.write("SELECT COUNT(*) AS model_links, SUM(is_main) AS main_links FROM vehicle_ref.model_links;\n")
    print(f"  model_links.csv: {len(rows)} models, {len(vals_gen)} vmm generation links")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(*sys.argv[1:])
