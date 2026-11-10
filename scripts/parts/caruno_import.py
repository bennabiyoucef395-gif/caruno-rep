"""
CARUNO — import the catalogue Excel into the caruno_parts schema (sql/00_schema.sql).

Usage:  python caruno_import.py catalogue-pieces.xlsx out/ [modeles.xlsx]
Output: one CSV per table (turned into SQL by make_sql.py) + a_verifier.xlsx (what needs a human).
modeles.xlsx (optional): years per generation + duplicate models to merge.

Copied from "bdd pieces auto/caruno database/caruno_import.py", with two changes:
  - an engine written after a model list applies to every model of the list (it went to the last one only),
    and each engine of "3.0 / 4.2 TDI" gives its own fitment row;
  - each article gets a part category (part_categories.py).
"""
import re, sys, collections
from pathlib import Path
import pandas as pd
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))   # python -I leaves the script folder out
from part_categories import categorize

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

# Reviewed category lists (import_review.py): the only categories that may exist, their names and engine_dependent;
# plus the articles classified by hand. A category not listed stops the build: list it first, review, import.
def read_list(name):
    return pd.read_csv(HERE / name, sep=";", dtype=str, keep_default_na=False).to_dict("records")
CAT_LIST = {c["name_fr"]: c for c in read_list("categories.csv")}
GROUP_LIST = {g["group"]: g for g in read_list("category_groups.csv")}
MANUAL = {r["ref"]: r["category"] for r in read_list("article_categories.csv")}
UNLISTED = collections.Counter()

# ---- optional model table: years + merges, keyed by (constructeur, modèle, génération) ----
MODEL_YEARS, MODEL_MERGE = {}, {}
if len(sys.argv) > 3:
    def clean(v):
        return "" if pd.isna(v) else str(v).strip()
    def year(v):
        v = clean(v)
        return int(float(v)) if v and v.replace(".0", "").isdigit() else None
    for _, row in pd.read_excel(sys.argv[3], sheet_name="Modèles", dtype=str).iterrows():
        k = (clean(row["Constructeur"]), clean(row["Modèle"]), clean(row["Génération"]))
        if clean(row.get("Fusionner vers")):
            name, _, gen = clean(row["Fusionner vers"]).partition("|")
            MODEL_MERGE[k] = (name.strip(), gen.strip())
        if year(row["Année début"]):
            MODEL_YEARS[k] = (year(row["Année début"]), year(row["Année fin"]))

# Vehicle-maker names as written in the catalogue -> one canonical name
MAKER_ALIASES = {
    "AUDI": "AUDI", "V.W": "VW", "VW": "VW", "BENZ": "MERCEDES-BENZ", "MERCEDES": "MERCEDES-BENZ",
    "BMW": "BMW", "MINI": "MINI", "SKODA": "SKODA", "SEAT": "SEAT", "PORSCHE": "PORSCHE",
    "LAND ROVER": "LAND ROVER", "RANGE ROVER": "LAND ROVER", "TOYOTA": "TOYOTA", "LEXUS": "LEXUS",
    "HYUNDAI": "HYUNDAI", "KIA": "KIA",
}
# Prefixes used inside "Modèles de voiture" (your dictionary output)
PREFIXES = sorted(["Audi", "VW", "BMW", "Mercedes", "Skoda", "Seat", "Porsche", "Land Rover",
                   "Range Rover", "Toyota", "Lexus", "Hyundai", "Kia", "Mini", "MINI"], key=len, reverse=True)
BRAND_ONLY = {k for k in MAKER_ALIASES}            # tokens like "HYUNDAI" = no model info

RE_PHASE = re.compile(r"\s*\bphase\s*(\d)\b", re.I)
RE_ENGINE = re.compile(r"\s+(\d\.\d\w*\b.*|VR6|V6|V8|V10|V12)$")      # "1.4 16V", "2.0TDI", "1.9TD"
RE_ENGINE_ONLY = re.compile(r"^(\d\.\d\w*(\s+\w+)?|VR6|V6|V8|V10|V12)$")   # "2.0D", "4.2 TDI", "3.2 V6"
RE_ENGINE_PARTS = re.compile(r"^(\d\.\d)(?:\s*(\S.*))?$")

def inherit_fuel(engines):
    """'3.0 / 4.2 TDI' -> ['3.0TDI', '4.2TDI']: when only the LAST engine of a list carries a suffix,
    the bare displacements before it share it. '2.5TDI / 2.8 / 3.7' is left alone (2.8 and 3.7 are petrol).
    Returns (engines, set of engines whose suffix was inferred)."""
    if len(engines) < 2:
        return engines, set()
    parts = [RE_ENGINE_PARTS.match(e) for e in engines]
    if not all(parts) or not parts[-1].group(2) or any(p.group(2) for p in parts[:-1]):
        return engines, set()
    # Only a clear family name is shared: in "2.8 / 3.0 / 3.2T" the 2.8 is not a turbo.
    if parts[-1].group(2).strip().upper() not in {"TDI", "FSI", "TFSI", "TSI", "CRDI", "CDI", "SDI"}:
        return engines, set()
    suffix = parts[-1].group(2).strip()
    out = [p.group(1) + suffix for p in parts[:-1]] + [engines[-1]]
    return out, set(out[:-1])

RE_TRIM = re.compile(r"\s+(GTI|GTD|TDI|TSI|TFSI|AMG|RS|S-Line)$", re.I)
RE_GEN = re.compile(r"\(([^)]+)\)")
RE_SPLIT = re.compile(r"^(.*?)\s*\(([^)]+)\)\s*(.*)$")    # "Série 1 (E87) 30i" -> name, generation, variant
RE_YEARS = re.compile(r"\s*\b((?:19|20)?\d{2})\s*-\s*((?:19|20)?\d{2})\b$")      # "2009-2016" or "18-21"

def full_year(y):
    y = int(y)
    return y if y > 100 else (2000 + y if y < 50 else 1900 + y)

def norm_oem(raw):
    """Return (as_printed, normalized, problem or None)."""
    s = str(raw).strip().rstrip("#*").strip()
    problem = None
    if "/" in s:                                   # "022 198 601G/H/611P/N" = several OEMs in shorthand
        problem = "plusieurs OEM (abrégés)"
        s = s.split("/")[0].strip()
    if re.search(r"[A-Z]{4,}\s+[A-Z]", s.upper()) and not re.search(r"\d{3}", s):
        problem = "pas un OEM"
    return s, re.sub(r"[^A-Z0-9]", "", s.upper()), problem

def makers_of(row_marques):
    if not isinstance(row_marques, str):
        return []
    out = []
    for p in row_marques.split("/"):
        m = MAKER_ALIASES.get(p.strip().upper())
        if m and m not in out:
            out.append(m)
    return out

df = pd.read_excel(SRC, dtype=str)

manufacturers, models, oems, categories = {}, {}, {}, {}
articles, article_oem, fitment = [], [], []
unresolved = collections.defaultdict(lambda: {"n": 0, "marques": "", "gamme": "", "exemple": ""})
oem_review, no_model = [], []

def maker_id(name):
    return manufacturers.setdefault(name, len(manufacturers) + 1)

def model_id(maker, text, notes):
    """Split model text into name / generation; extras (variant, years) go to the fitment notes.
    Model years stay empty here: fill them once per generation (Golf 7 = 2012-2020)."""
    years = RE_YEARS.search(text)
    if years:
        notes.append(f"années {full_year(years.group(1))}-{full_year(years.group(2))}")
        text = RE_YEARS.sub("", text).strip()
    m = RE_SPLIT.match(text)
    if m:
        name, gen, variant = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
        if variant:
            notes.append(f"version {variant}")
    else:
        name, gen = text, None
    k = (maker, name, gen or "")
    if k in MODEL_MERGE:                               # duplicate spelling -> the real model
        if gen:
            notes.append(f"variante {gen}")
        name, gen = MODEL_MERGE[k][0], MODEL_MERGE[k][1] or None
        k = (maker, name, gen or "")
    key = (maker, name, gen)
    if key not in models:
        y = MODEL_YEARS.get(k, (None, None))
        models[key] = {"id": len(models) + 1, "manufacturer_id": maker_id(maker), "name": name,
                       "generation": gen, "year_from": y[0], "year_to": y[1]}
    return models[key]["id"]

for i, r in df.iterrows():
    art_id = i + 1
    name = r["Désignation"] if pd.notna(r["Désignation"]) else r["Référence"]
    group, category, engine_dep = categorize(name, r["N° OEM"] if pd.notna(r["N° OEM"]) else None)
    category = MANUAL.get(str(r["Référence"]).strip(), category)
    listed = CAT_LIST.get(category)
    if not listed:
        UNLISTED[category] += 1
        continue
    group = listed["group"]
    cat_id = categories.setdefault(category, {
        "id": len(categories) + 1, "group_id": list(GROUP_LIST).index(group) + 1, "group_name": group, "name": category,
        "name_en": listed["name_en"], "name_ar": listed["name_ar"], "synonyms": listed["synonyms"] or None,
        "engine_dependent": int(listed["engine_dependent"])})["id"]
    articles.append({"id": art_id, "ref": r["Référence"], "name": name, "name_ar": r["التسمية"],
                     "remark": r["Remarque"], "category_id": cat_id, "source_id": 1})

    printed, normalized, problem = norm_oem(r["N° OEM"])
    if problem:
        oem_review.append({"Référence": r["Référence"], "N° OEM": r["N° OEM"], "Problème": problem,
                           "Désignation": r["Désignation"]})
    if problem == "pas un OEM" or not normalized:
        continue
    if normalized not in oems:
        oems[normalized] = {"id": len(oems) + 1, "oem": printed, "oem_normalized": normalized}
    oem_id = oems[normalized]["id"]
    article_oem.append({"article_id": art_id, "oem_id": oem_id})

    row_makers = makers_of(r["Marques"])
    text = r["Modèles de voiture"]
    if not isinstance(text, str) or not text.strip():
        no_model.append({"Référence": r["Référence"], "Désignation": r["Désignation"],
                         "N° OEM": r["N° OEM"], "Marques": r["Marques"], "Cas": "aucun modèle"})
        continue

    tokens = [t.strip() for t in text.split(" / ") if t.strip()]
    if all(t.upper() in BRAND_ONLY for t in tokens):
        no_model.append({"Référence": r["Référence"], "Désignation": r["Désignation"],
                         "N° OEM": r["N° OEM"], "Marques": r["Marques"], "Cas": "marque seulement"})
        continue

    # Engines written after a model list belong to the whole list:
    # "Audi A4 (B8) / Audi A5 (8T) / Audi Q5 (8R) 2.0T" -> 2.0T for A4, A5 and Q5,
    # "Audi Q7 (4M) 3.6 / 4.2FSI" -> Q7 with 3.6 and 4.2FSI (trailing tokens that are only an engine).
    list_engines = []
    while tokens and RE_ENGINE_ONLY.match(tokens[-1]):
        list_engines.insert(0, tokens.pop())
    parsed = []                                     # (token without engine, base notes, own engine)
    for tok in tokens:
        if tok.upper() in BRAND_ONLY:
            continue
        notes = []
        yr = RE_YEARS.search(tok)
        if yr:
            notes.append(f"années {full_year(yr.group(1))}-{full_year(yr.group(2))}")
            tok = RE_YEARS.sub("", tok).strip()
        ph = RE_PHASE.search(tok)
        if ph:
            notes.append(f"phase {ph.group(1)}")
            tok = RE_PHASE.sub("", tok).strip()
        tr = RE_TRIM.search(tok)
        if tr:
            notes.append(f"version {tr.group(1)}")
            tok = RE_TRIM.sub("", tok).strip()
        en = RE_ENGINE.search(tok)
        own = None
        if en:
            own = en.group(1).strip()
            tok = RE_ENGINE.sub("", tok).strip()
        parsed.append((tok, notes, own))
    if parsed:
        last_own = parsed[-1][2]
        shared = ([last_own] if last_own else []) + list_engines
        shared, fuel_note = inherit_fuel(shared)
        # A shared engine list applies to every model unless an earlier model has its own engine.
        per_token = any(own for _, _, own in parsed[:-1])

    for i, (tok, notes, own) in enumerate(parsed):
        # engine_scope: "direct" = the engine is written for this model alone;
        # "shared" = engines written after several models (true for the list as a whole, not
        # necessarily for each model: engines.py keeps such a pair only if it is proven elsewhere).
        if per_token:
            engines = shared if i == len(parsed) - 1 else ([own] if own else [None])
            scope = "direct"
        else:
            engines = shared or [None]
            scope = "direct" if len(parsed) == 1 else "shared"

        maker, model_text = None, None
        for p in PREFIXES:
            if tok.startswith(p + " "):
                maker, model_text = MAKER_ALIASES[p.upper()], tok[len(p) + 1:].strip()
                break
        if maker is None and RE_GEN.search(tok) and len(row_makers) == 1:
            maker, model_text = row_makers[0], tok        # "GLE (W166)" on a BENZ-only row
        if maker is None:
            u = unresolved[tok]
            u["n"] += 1
            u["marques"] = u["marques"] or (r["Marques"] or "")
            u["gamme"] = u["gamme"] or (r["Gamme"] or "")
            u["exemple"] = u["exemple"] or f'{r["Désignation"]} | {r["N° OEM"]} | {text}'
            continue

        mid = model_id(maker, model_text, notes)
        for eng in engines:                         # one fitment row per engine of the list
            n = notes + ([f"moteur {eng}"] if eng else [])
            if eng and fuel_note and eng in fuel_note:
                n.append("carburant déduit de la liste")
            if eng and scope == "shared":
                n.append("moteur indiqué pour la liste de modèles")
            fitment.append({"oem_id": oem_id, "model_id": mid, "vehicle_type_id": None,
                            "source_id": 1, "confidence": "probable", "note": ", ".join(n) or None,
                            "engine_scope": scope if eng else None})

if UNLISTED:
    sys.exit("Catégories non listées dans scripts/parts/categories.csv (à lister, relire et importer d'abord) : "
             + ", ".join(f"{c} ({n} articles)" for c, n in UNLISTED.most_common()))
unknown_manual = sorted(set(MANUAL) - set(df["Référence"].astype(str).str.strip()))
if unknown_manual:
    print(f"article_categories.csv : références absentes du catalogue : {', '.join(unknown_manual)}")

# ---- write CSVs (column order = table columns) ----
pd.DataFrame([{"id": i + 1, "name": g, "name_en": v["name_en"], "name_ar": v["name_ar"]}
              for i, (g, v) in enumerate(GROUP_LIST.items())]).to_csv(OUT / "part_groups.csv", index=False)
pd.DataFrame([{"id": 1, "name": "Catalogue", "type": "catalogue"}]).to_csv(OUT / "data_sources.csv", index=False)
pd.DataFrame([{"id": v, "name": k} for k, v in manufacturers.items()]).to_csv(OUT / "manufacturers.csv", index=False)
md = pd.DataFrame(models.values())
md[["year_from", "year_to"]] = md[["year_from", "year_to"]].astype("Int64")   # 2012, not 2012.0
md.to_csv(OUT / "models.csv", index=False)
pd.DataFrame(oems.values()).to_csv(OUT / "oem_numbers.csv", index=False)
pd.DataFrame(categories.values()).to_csv(OUT / "part_categories.csv", index=False)
pd.DataFrame(articles).to_csv(OUT / "articles.csv", index=False)
pd.DataFrame(article_oem).drop_duplicates().to_csv(OUT / "article_oem.csv", index=False)
fit = pd.DataFrame(fitment).drop_duplicates(subset=["oem_id", "model_id", "note"])
fit.insert(0, "id", range(1, len(fit) + 1))
fit.to_csv(OUT / "fitment.csv", index=False)

# ---- review workbook ----
codes = (pd.DataFrame([{"Code": k, "Occurrences": v["n"], "Marques": v["marques"], "Gamme": v["gamme"],
                        "Exemple": v["exemple"], "Modèle réel (à remplir)": ""} for k, v in unresolved.items()])
         .sort_values("Occurrences", ascending=False))
with pd.ExcelWriter(OUT / "a_verifier.xlsx") as xw:
    codes.to_excel(xw, sheet_name="Codes à compléter", index=False)
    pd.DataFrame(oem_review).to_excel(xw, sheet_name="OEM à vérifier", index=False)
    pd.DataFrame(no_model).to_excel(xw, sheet_name="Sans modèle", index=False)

print(f"articles {len(articles)} | OEM {len(oems)} | constructeurs {len(manufacturers)} | "
      f"modèles {len(models)} | liens de compatibilité {len(fit)}")
print(f"codes à compléter {len(codes)} ({codes['Occurrences'].sum()} occurrences) | "
      f"OEM à vérifier {len(oem_review)} | pièces sans modèle {len(no_model)}")
