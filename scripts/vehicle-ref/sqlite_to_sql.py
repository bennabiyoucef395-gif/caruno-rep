"""
Converts a downloaded SQLite release into INSERT statements for vehicle_ref (scripts/vehicle-ref/build.sh).
Tables and columns are copied as they are; the script stops if the upstream columns change, so a new
release never loads silently into the wrong columns. The table definitions are in sql/10_vdb.sql, sql/20_vmm.sql.

Usage: python -I sqlite_to_sql.py vdb|vmm <file.sqlite> <out.sql>
"""
import math, sqlite3, sys

# target table, source table, row filter, columns (in order, as upstream)
SPECS = {
    "vdb": [  # VehiclesDB: car rows only
        ("vdb_meta", "meta", None, ["key", "value"]),
        ("vdb_makes", "makes", "kind = 'car'", ["id", "kind", "name", "former_slugs"]),
        ("vdb_models", "models", "kind = 'car'",
         ["id", "kind", "make_id", "slug", "name", "body_types", "regions",
          "global_popularity_decile", "mass_popularity_decile"]),
        ("vdb_availability", "availability", "kind = 'car'", ["model_id", "kind", "country", "evidence", "source"]),
        ("vdb_popularity", "popularity", "kind = 'car'", ["model_id", "kind", "country", "rank", "decile", "confidence"]),
    ],
    "vmm": [  # vehicle-makes-models: everything, parents before children (foreign keys)
        ("vmm_makes", "makes", None, ["id", "group", "name", "country"]),
        ("vmm_models", "models", None, ["id", "make_id", "name", "year_start", "year_end"]),
        ("vmm_generations", "generations", None, ["id", "model_id", "name", "year_start", "year_end", "body_type"]),
        ("vmm_engines", "engines", None,
         ["id", "generation_id", "label", "fuel_type", "cylinders", "displacement_cc", "power_hp", "torque_nm",
          "transmission", "drivetrain", "zero_to_100_s", "top_speed_kmh", "fuel_economy_combined_l100",
          "length_mm", "width_mm", "height_mm", "wheelbase_mm", "curb_weight_kg"]),
        ("vmm_engine_specs", "engine_specs", None, ["id", "engine_id", "key", "value"]),
    ],
}
BATCH = 1000

def lit(v):
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return str(int(v))
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        if not math.isfinite(v):
            return "NULL"
        return repr(v)
    if isinstance(v, bytes):
        v = v.decode("utf-8", "replace")
    s = (str(v).replace("\\", "\\\\").replace("'", "\\'").replace("\0", "\\0")
         .replace("\n", "\\n").replace("\r", "\\r").replace("\x1a", "\\Z"))
    return "'" + s + "'"

def main(dataset, src, dst):
    con = sqlite3.connect(f"file:{src}?mode=ro", uri=True)
    total = {}
    with open(dst, "w", encoding="utf-8", newline="\n") as out:
        out.write("SET NAMES utf8mb4;\nSET autocommit = 0;\n")
        for target, table, where, cols in SPECS[dataset]:
            have = [r[1] for r in con.execute(f'PRAGMA table_info("{table}")')]
            if have != cols:
                sys.exit(f"{table}: upstream columns changed\n  expected {cols}\n  found    {have}")
            q = f'SELECT {", ".join(chr(34) + c + chr(34) for c in cols)} FROM "{table}"'
            if where:
                q += f" WHERE {where}"
            head = f"INSERT INTO {target} ({', '.join('`' + c + '`' for c in cols)}) VALUES\n"
            n, batch = 0, []
            for row in con.execute(q + " ORDER BY rowid"):
                batch.append("(" + ",".join(lit(v) for v in row) + ")")
                if len(batch) == BATCH:
                    out.write(head + ",\n".join(batch) + ";\n")
                    n += len(batch); batch = []
            if batch:
                out.write(head + ",\n".join(batch) + ";\n")
                n += len(batch)
            total[target] = n
        out.write("COMMIT;\n")
    for t, n in total.items():
        print(f"  {t}: {n} rows")

if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[1] not in SPECS:
        sys.exit(__doc__)
    main(*sys.argv[1:])
