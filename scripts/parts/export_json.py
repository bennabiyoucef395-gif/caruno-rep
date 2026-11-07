"""
CARUNO — JSON export of caruno_parts for the front (which only talks to Dolibarr, see CLAUDE.md).

Usage:  python export_json.py out/      (reads out/export/*.tsv written by export.sh, writes out/json/)
Output:
  index.json         {"version", "generated_at", "categories": [...], "models": [{id, maker, name, generation,
                      year_from, year_to, engines, parts, file}]}
  models/<id>.json   {"model": {...}, "engines": get_engine_options(id),
                      "parts": [{"ref", "name", "category_id", "status": {"<vehicle_type_id>": s, "unknown": s},
                                 "evidence"}]}
status values come from compatible_parts(): compatible | a_confirmer | moteur_requis. A part missing for an
option is not compatible with it. "unknown" = "Je ne sais pas". Price, stock, photo: from Dolibarr by ref.
"""
import csv, json, sys
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(sys.argv[1])
SRC, DST = OUT / "export", OUT / "json"
VERSION = 1
csv.field_size_limit(10**8)


def tsv(name):
    """mariadb -B output: tab separated, NULL as 'NULL', \\t \\n \\\\ escaped."""
    with open(SRC / name, encoding="utf-8", newline="") as fh:
        for line in fh.read().split("\n"):
            if line:
                yield [None if v == "NULL" else v.replace("\\t", "\t").replace("\\n", "\n").replace("\\\\", "\\")
                       for v in line.split("\t")]


def num(v):
    return None if v is None else int(v)


categories = [{"id": int(i), "group": g, "name": n, "engine_dependent": e == "1"}
              for i, g, n, e in tsv("categories.tsv")]
cat_id = {c["name"]: c["id"] for c in categories}
models = {int(i): {"id": int(i), "maker": mk, "name": n, "generation": gen, "year_from": num(yf), "year_to": num(yt)}
          for i, mk, n, gen, yf, yt in tsv("models.tsv")}
options = {int(i): json.loads(o) for i, o in tsv("options.tsv")}

# compatible_parts() results, one block per (model, option), introduced by "#M<model>#<vehicle type|unknown>"
parts = {m: {} for m in models}
model, key = None, None
for row in tsv("compatible.tsv"):
    if row[0].startswith("#M"):
        _, m, key = row[0].split("#")
        model = int(m[1:])
        continue
    ref, name, _group, category, _eng, status, evidence = row
    p = parts[model].setdefault(ref, {"ref": ref, "name": name, "category_id": cat_id[category], "status": {}})
    p["status"][key] = status
    if key == "unknown":                     # the "Je ne sais pas" call sees every fitment row of the model
        p["evidence"] = evidence

(DST / "models").mkdir(parents=True, exist_ok=True)
for old in (DST / "models").glob("*.json"):
    old.unlink()
index = []
for m, meta in sorted(models.items()):
    plist = sorted(parts[m].values(), key=lambda p: (p["category_id"], p["ref"]))
    if not plist:
        continue
    doc = {"version": VERSION, "model": meta, "engines": options.get(m, []), "parts": plist}
    (DST / "models" / f"{m}.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    index.append({**meta, "engines": sum(1 for o in doc["engines"] if o["vehicle_type_id"] is not None),
                  "parts": len(plist), "file": f"models/{m}.json"})

(DST / "index.json").write_text(json.dumps(
    {"version": VERSION, "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
     "categories": categories, "models": index}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

# Safety net: the rule the front relies on.
dep = {c["id"] for c in categories if c["engine_dependent"]}
bad = [(m, p["ref"]) for m in parts for p in parts[m].values()
       if p["category_id"] in dep and p["status"].get("unknown") == "compatible"]
if bad:
    sys.exit(f"ERREUR: pièce dépendante du moteur « compatible » sans moteur: {bad[:5]}")
print(f"JSON -> {DST}: {len(index)} modèles, {sum(m['parts'] for m in index)} lignes pièce-modèle")
