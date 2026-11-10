"""
CARUNO — import a reviewed categories_review.xlsx into the category lists of the build (scripts/parts):
  categories.csv           group;name_fr;name_en;name_ar;synonyms;engine_dependent   (one row per category)
  category_groups.csv      group;name_en;name_ar                                      (the parent level)
  article_categories.csv   ref;category                                               (categories chosen by hand)
These lists are the only place a category exists: caruno_import.py refuses a category that is not listed
(rule: never create a category without listing it first). engine_dependent here wins over part_categories.py.

Usage: python -I import_review.py <categories_review.xlsx> <out_dir>
Sheets used: "Catégories" (engine_dependent must be TRUE or FALSE), "Groupes", "Non classés" (column
"catégorie choisie", "Group › Category"). Existing article_categories.csv rows are kept unless the file changes them.
"""
import csv, os, sys
from openpyxl import load_workbook

def cells(ws):
    rows = list(ws.iter_rows(values_only=True))
    head = [str(h).strip() if h is not None else "" for h in rows[0]]
    return [{h: ("" if v is None else str(v).strip()) for h, v in zip(head, r)} for r in rows[1:] if any(v is not None for v in r)]

def main(xlsx, out):
    wb = load_workbook(xlsx, data_only=True)
    errors = []
    groups = {}
    for r in cells(wb["Groupes"]):
        groups[r["group"]] = {"group": r["group"], "name_en": r["group_en"], "name_ar": r["group_ar"]}
    cats = {}
    for i, r in enumerate(cells(wb["Catégories"]), start=2):
        name, ed = r["name_fr"], r["engine_dependent"].upper()
        if not name: errors.append(f"Catégories ligne {i}: name_fr vide"); continue
        if name in cats: errors.append(f"Catégories ligne {i}: « {name} » en double")
        if ed not in ("TRUE", "FALSE"): errors.append(f"Catégories ligne {i} « {name} »: engine_dependent = {ed or 'vide'} (TRUE ou FALSE)")
        if r["group"] not in groups: errors.append(f"Catégories ligne {i} « {name} »: groupe « {r['group']} » absent de la feuille Groupes")
        if not r["name_ar"]: errors.append(f"Catégories ligne {i} « {name} »: name_ar vide")
        cats[name] = {"group": r["group"], "name_fr": name, "name_en": r["name_en"], "name_ar": r["name_ar"],
                      "synonyms": r["synonymes"], "engine_dependent": int(ed == "TRUE")}

    path = os.path.join(out, "article_categories.csv")
    manual = {}
    if os.path.exists(path):
        manual = {r["ref"]: r["category"] for r in csv.DictReader(open(path, encoding="utf-8"), delimiter=";")}
    if "Non classés" in wb.sheetnames:
        for r in cells(wb["Non classés"]):
            chosen = r.get("catégorie choisie (à remplir)", "")
            if not chosen: continue
            name = chosen.split("›")[-1].strip()
            if name not in cats: errors.append(f"Non classés {r['ref']}: catégorie « {name} » absente de la feuille Catégories")
            manual[r["ref"]] = name
    if errors:
        sys.exit("Fichier refusé :\n  " + "\n  ".join(errors))

    def write(fname, fields, rows):
        with open(os.path.join(out, fname), "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields, delimiter=";", lineterminator="\n"); w.writeheader(); w.writerows(rows)
    write("categories.csv", ["group", "name_fr", "name_en", "name_ar", "synonyms", "engine_dependent"],
          sorted(cats.values(), key=lambda c: (c["group"], c["name_fr"])))
    write("category_groups.csv", ["group", "name_en", "name_ar"], sorted(groups.values(), key=lambda g: g["group"]))
    write("article_categories.csv", ["ref", "category"], [{"ref": k, "category": v} for k, v in sorted(manual.items())])
    print(f"  {len(cats)} catégories ({sum(c['engine_dependent'] for c in cats.values())} dépendantes du moteur), "
          f"{len(groups)} groupes, {len(manual)} articles classés à la main")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(*sys.argv[1:])
