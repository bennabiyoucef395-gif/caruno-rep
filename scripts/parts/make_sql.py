"""
CARUNO — turn the CSVs of caruno_import.py + engines.py into SQL files, one per build step.

Usage:  python make_sql.py out/          -> out/10_base.sql, out/20_categories.sql, out/30_engines.sql
INSERT statements (no LOAD DATA): nothing to enable on the server, works through `docker exec -i`.
"""
import sys
from pathlib import Path
import pandas as pd

OUT = Path(sys.argv[1])


def lit(v):
    """Every CSV value is read as text; MariaDB converts '12' to 12 for numeric columns."""
    if v is None or (not isinstance(v, str) and pd.isna(v)):
        return "NULL"
    s = str(v).replace("\\", "\\\\").replace("'", "\\'").replace("\0", "")
    return f"'{s}'"


def inserts(table, df, cols, batch=500):
    out = []
    for i in range(0, len(df), batch):
        rows = df.iloc[i:i + batch][cols]
        values = ",\n".join("(" + ",".join(lit(v) for v in row) + ")" for row in rows.itertuples(index=False))
        out.append(f"INSERT INTO {table} ({','.join(cols)}) VALUES\n{values};")
    return "\n".join(out) + "\n"


def csv(name, **kw):
    return pd.read_csv(OUT / name, dtype=object, keep_default_na=False, na_values=[""], **kw)


head = "SET NAMES utf8mb4;\nSET autocommit=0;\n"
tail = "COMMIT;\n"

# ---- step 0: base data (articles without category, fitment at model level) ----
arts = csv("articles.csv")
fit = csv("fitment.csv")
sql = head
sql += inserts("data_sources", csv("data_sources.csv"), ["id", "name", "type"])
sql += inserts("manufacturers", csv("manufacturers.csv"), ["id", "name"])
sql += inserts("models", csv("models.csv"), ["id", "manufacturer_id", "name", "generation", "year_from", "year_to"])
sql += inserts("oem_numbers", csv("oem_numbers.csv"), ["id", "oem", "oem_normalized"])
sql += inserts("articles", arts, ["id", "ref", "name", "name_ar", "remark", "source_id"])
sql += inserts("article_oem", csv("article_oem.csv"), ["article_id", "oem_id"])
sql += inserts("fitment", fit, ["id", "oem_id", "model_id", "source_id", "confidence", "note"])
(OUT / "10_base.sql").write_text(sql + tail, encoding="utf-8")

# ---- step 1: part categories, then each article gets its category ----
sql = head
sql += inserts("part_categories", csv("part_categories.csv"), ["id", "group_name", "name", "engine_dependent"])
sql += "CREATE TEMPORARY TABLE tmp_article_category (article_id INT UNSIGNED PRIMARY KEY, category_id INT UNSIGNED NOT NULL);\n"
sql += inserts("tmp_article_category", arts.rename(columns={"id": "article_id"}), ["article_id", "category_id"])
sql += ("UPDATE articles a JOIN tmp_article_category t ON t.article_id = a.id SET a.category_id = t.category_id;\n"
        "DROP TEMPORARY TABLE tmp_article_category;\n")
(OUT / "20_categories.sql").write_text(sql + tail, encoding="utf-8")

# ---- step 2: engines + vehicle types, then fitment rows with an engine move to vehicle-type level ----
sql = head
sql += inserts("engines", csv("engines.csv"),
               ["id", "label", "displacement_l", "fuel", "designation", "engine_code", "power_hp"])
sql += inserts("vehicle_types", csv("vehicle_types.csv"), ["id", "model_id", "engine_id", "label"])
sql += "CREATE TEMPORARY TABLE tmp_fitment_vt (fitment_id INT UNSIGNED PRIMARY KEY, vehicle_type_id INT UNSIGNED NOT NULL);\n"
sql += inserts("tmp_fitment_vt", csv("fitment_vehicle_type.csv"), ["fitment_id", "vehicle_type_id"])
sql += ("UPDATE fitment f JOIN tmp_fitment_vt t ON t.fitment_id = f.id SET f.vehicle_type_id = t.vehicle_type_id;\n"
        "DROP TEMPORARY TABLE tmp_fitment_vt;\n")
(OUT / "30_engines.sql").write_text(sql + tail, encoding="utf-8")
print("SQL ->", ", ".join(p.name for p in sorted(OUT.glob("[123]0_*.sql"))))
