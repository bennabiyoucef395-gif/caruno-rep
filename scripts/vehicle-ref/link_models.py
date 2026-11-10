"""
Proposes links from our catalogue models (caruno_parts.models) to the outside reference data, and lists
the generation years that differ. Reads files only (no database): the catalogue CSVs from
scripts/parts/build.sh data, and the downloaded VehiclesDB / vehicle-makes-models SQLite releases.

  vdb_model_id       VehiclesDB model id "<make>/<slug>" (model level: VehiclesDB has no generations)
  vmm_generation_id  vehicle-makes-models generation that best matches ours (main row)
  vmm_all            every vmm generation matched to our model (doors / body / facelift rows)

Matching: model name (with the name mappings below) + years. Each vmm generation goes to the one of our
models of that name it overlaps most. Our models without years get no vmm generation.
vehicle-makes-models is INTERNAL ONLY: this file only checks our years, it never feeds the customer screens.

Usage: python -I link_models.py <parts_build_dir> <vdb.sqlite> <vmm.sqlite> <out_dir>
Writes <out_dir>/model_links_a_verifier.csv and <out_dir>/annees_differences.csv (UTF-8 with BOM, for Excel).
"""
import csv, os, re, sqlite3, sys, unicodedata
from collections import defaultdict

NOW = 2026
VDB_MAKE = {"VW": "volkswagen", "AUDI": "audi", "SEAT": "seat", "SKODA": "skoda", "BMW": "bmw", "PORSCHE": "porsche",
            "MERCEDES-BENZ": "mercedes-benz", "HYUNDAI": "hyundai", "TOYOTA": "toyota"}
VMM_MAKE = {"VW": "Volkswagen", "AUDI": "Audi", "SEAT": "SEAT", "SKODA": "Škoda", "BMW": "BMW", "PORSCHE": "Porsche",
            "MERCEDES-BENZ": "Mercedes-Benz", "HYUNDAI": "Hyundai", "TOYOTA": "Toyota"}
BODY_WORDS = r"3 doors|5 doors|coupe|cabriolet|cabrio|convertible|touring|sedan|variant|sportback|hatchback|gran turismo|gran tourer|active tourer"

# BMW chassis code -> (vmm model, body regex on the generation name, "" = no body word).
BMW = {
    "E87": ("1 Series", ""), "F20": ("1 Series", ""), "E81": ("1 Series", "3 doors"), "F21": ("1 Series", "3 doors"),
    "E82": ("1 Series", "coupe"), "E88": ("1 Series", "cabrio|convertible"),
    "F22": ("2 Series", "coupe"), "F23": ("2 Series", "cabrio|convertible"),
    "F45": ("2 Series Active Tourer", None), "F46": ("2 Series Gran Tourer", None),
    "E30": ("3 Series", "sedan"), "E36": ("3 Series", "sedan"), "E46": ("3 Series", "sedan"), "E90": ("3 Series", "sedan"),
    "F30": ("3 Series", "sedan"), "F35": ("3 Series", "sedan"), "G20": ("3 Series", "sedan"), "G28": ("3 Series", "sedan"),
    "E91": ("3 Series", "touring"), "F31": ("3 Series", "touring"), "E92": ("3 Series", "coupe"),
    "E93": ("3 Series", "cabrio|convertible"), "F34": ("3 Series Gran Turismo", None),
    "F32": ("4 Series", "coupe"), "F33": ("4 Series", "cabrio|convertible"), "G22": ("4 Series", "coupe"), "F36": ("4 Series Gran", None),
    "E28": ("5 Series", "sedan"), "E34": ("5 Series", "sedan"), "E39": ("5 Series", "sedan"), "E60": ("5 Series", "sedan"),
    "F10": ("5 Series", "sedan"), "F18": ("5 Series", "sedan"), "G30": ("5 Series", "sedan"), "G38": ("5 Series", "sedan"),
    "E61": ("5 Series", "touring"), "F11": ("5 Series", "touring"), "G31": ("5 Series", "touring"),
    "F07": ("5 Series Gran Turismo", None),
    "E63": ("6 Series", "coupe"), "E64": ("6 Series", "cabrio|convertible"), "F13": ("6 Series", "coupe"), "F12": ("6 Series", "cabrio|convertible"),
    "F06": ("6 Series Gran", None), "G32": ("6 Series Gran Turismo", None),
    "E31": ("8 Series", None),
    "E32": ("7 Series", None), "E38": ("7 Series", None), "E65": ("7 Series", None), "F01": ("7 Series", None),
    "G11": ("7 Series", None),
}
# Long-wheelbase / derived chassis: same vmm generations as the main code, without competing for them.
DERIVED = {("BMW", "F35"): "F30", ("BMW", "F18"): "F10", ("BMW", "G38"): "G30", ("BMW", "G28"): "G20",
           ("BMW", "E66"): "E65", ("BMW", "F02"): "F01", ("BMW", "F04"): "F01", ("BMW", "G12"): "G11",
           ("BMW", "F55"): "F56", ("MERCEDES-BENZ", "V251"): "W251", ("MERCEDES-BENZ", "V167"): "W167"}
# Body rows left out of the main generation and of the years compared (the plain rows are the reference).
VARIANT = r"3 doors|coupe|cabrio|convertible|variant|touring|sedan|sportback"
# Our name -> vmm model names (lower case, maker prefix removed) and body regex; None body = any generation.
MERCEDES = {
    "Classe C Break": (["c-klasse t-modell"], None), "Classe C Coupé": (["c-klasse sportcoupe/clc", "c-klasse"], "coupe|sportcoupe"),
    "Classe E Coupé": (["e-klasse coupe and predecessors"], None), "Classe S Coupé": ([], None),
    "Classe S Maybach": (["s-class maybach"], None), "GLE Coupé": (["gle-class"], "coupe"), "GLE": (["gle-class"], ""),
    "GLC Coupé": (["glc class"], "coupe"), "GLC": (["glc class"], ""), "ML": (["m-klasse"], None),
    "GL": (["gl-klasse"], None), "GLS": (["gls-class"], None), "CLA": (["cla klasse"], None), "CLS": (["cls-klasse"], None),
    "CL": (["cl-klasse and predecessors"], None), "Classe V": (["v-class and predecessors"], None),
    "190": (["c-klasse and predecessors"], None), "Viano": (["viano"], None), "Vito": (["vito"], None),
    "SL": (["sl-klasse"], None), "SLK": (["slk-klasse"], None), "GLK": (["glk-klasse"], None),
}
VW_VMM = {"Jetta": "jetta / vento / bora", "Bora": "jetta / vento / bora", "Vento": "jetta / vento / bora",
          "New Beetle": "beetle", "Transporter T5": "multivan"}
VDB_NAME = {  # our base name -> VehiclesDB model name, when it differs
    ("VW", "New Beetle"): "Beetle", ("VW", "Passat CC"): "CC", ("VW", "ID.4 Crozz"): "ID.4", ("VW", "ID.4 X"): "ID.4",
    ("VW", "ID.6 Crozz"): "ID.6", ("VW", "ID.6 X"): "ID.6", ("SEAT", "Leon"): "León",
    ("MERCEDES-BENZ", "Classe S Maybach"): "S-Class", ("AUDI", "A6 L"): "A6", ("AUDI", "A6L"): "A6",
}

def norm(s):
    s = unicodedata.normalize("NFKD", (s or "").casefold())
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in s if not unicodedata.combining(c))).strip()

def end_year(y):
    return y if y is not None else NOW

def overlap(a0, a1, b0, b1):
    return min(end_year(a1), end_year(b1)) - max(a0, b0)

def base_name(maker, name):
    if maker in ("VW", "SEAT", "SKODA"):
        if name in VW_VMM:
            return name
        m = re.match(r"^(.*?) (\d+|B\d|T\d)$", name)
        return m.group(1) if m else name
    return name

def vmm_targets(maker, name, generation):
    """(list of vmm model names (normalised), body regex or None)."""
    if maker == "BMW":
        if name.startswith("Mini"):
            if "Countryman" in name: return (["countryman"], None)
            if "Clubman" in name: return (["clubman"], None)
            return (["hatch"], None)
        if (generation or "") in BMW:
            mdl, body = BMW[generation]
            return ([norm(mdl)], body)
        return ([norm(name)], None)                               # M3, M4, X1..., iX3
    if maker == "MERCEDES-BENZ":
        if name in MERCEDES:
            names, body = MERCEDES[name]
            return ([norm(n) for n in names], body)
        m = re.match(r"^Classe ([A-Z]+)$", name)
        x = m.group(1).lower() if m else name.lower()
        return ([norm(f"{x}-klasse and predecessors"), norm(f"{x}-klasse"), norm(f"{x}-class"), norm(x)], "first")
    if maker in ("VW", "SEAT", "SKODA"):
        b = base_name(maker, name)
        return ([norm(VW_VMM.get(b, b))], None)
    return ([norm(name)], None)

def vdb_target(maker, name, generation):
    if maker == "BMW" and name.startswith("Mini"):
        return "mini", ("Countryman" if "Countryman" in name else "Clubman" if "Clubman" in name else "Cooper")
    make = VDB_MAKE.get(maker)
    if maker == "BMW":
        m = re.match(r"^Série (\d)$", name)
        return make, (f"{m.group(1)} Series" if m else name)
    if maker == "MERCEDES-BENZ":
        m = re.match(r"^Classe ([A-Z]+)\b", name)
        if m: return make, f"{m.group(1)}-Class"
        return make, re.sub(r" (Coupé|Break)$", "", name)
    if maker == "TOYOTA":
        txt = f"{name} {generation or ''}".upper()
        for k in ("COROLLA", "HILUX", "CAMRY", "YARIS", "HIACE", "COASTER"):
            if k in txt or (k == "CAMRY" and "ACV40" in txt):
                return make, k.title()
        return make, None
    b = base_name(maker, name)
    return make, VDB_NAME.get((maker, b), VDB_NAME.get((maker, name), b))

def main(pb, vdb_path, vmm_path, out_dir):
    makers = {r["id"]: r["name"] for r in csv.DictReader(open(os.path.join(pb, "manufacturers.csv"), encoding="utf-8"))}
    ours = []
    for r in csv.DictReader(open(os.path.join(pb, "models.csv"), encoding="utf-8")):
        ours.append({"id": int(r["id"]), "maker": makers[r["manufacturer_id"]], "name": r["name"],
                     "generation": r["generation"] or None,
                     "from": int(r["year_from"]) if r["year_from"] else None,
                     "to": int(r["year_to"]) if r["year_to"] else None})

    vdb = sqlite3.connect(f"file:{vdb_path}?mode=ro", uri=True)
    vdb_models = defaultdict(dict)                                 # make -> norm(name) -> id
    for mid, make, name, slug in vdb.execute("SELECT id, make_id, name, slug FROM models WHERE kind = 'car'"):
        vdb_models[make].setdefault(norm(name), mid)
        vdb_models[make].setdefault(norm(slug), mid)

    vmm = sqlite3.connect(f"file:{vmm_path}?mode=ro", uri=True)
    vmm_models = defaultdict(dict)                                 # make -> norm(model name without maker prefix) -> id
    for mid, make, name in vmm.execute("SELECT mo.id, k.name, mo.name FROM models mo JOIN makes k ON k.id = mo.make_id"):
        short = re.sub(r"^(MERCEDES BENZ|SKODA) ", "", name)
        vmm_models[make][norm(short)] = mid
    gens_of = defaultdict(list)
    for gid, model_id, gname, y0, y1 in vmm.execute("SELECT id, model_id, name, year_start, year_end FROM generations"):
        gens_of[model_id].append({"id": gid, "name": gname, "from": y0, "to": y1})

    # 1. Candidate generations for each of our models.
    cand, notes = {}, {}
    for m in ours:
        names, body = vmm_targets(m["maker"], m["name"], m["generation"])
        pool = vmm_models.get(VMM_MAKE.get(m["maker"], ""), {})
        if m["maker"] == "BMW" and m["name"].startswith("Mini"):
            pool = vmm_models.get("MINI", {})
        found = [n for n in names if n in pool]
        if body == "first":                                        # Mercedes "Classe X": first existing name
            found, body = found[:1], None
        gens = [g for n in found for g in gens_of[pool[n]]]
        if body is not None:
            rx = re.compile(body) if body else None
            gens = [g for g in gens if (rx.search(g["name"].lower()) if rx else not re.search(BODY_WORDS, g["name"].lower()))]
        notes[m["id"]] = "" if found else "modèle absent de vehicle-makes-models"
        if m["from"] is None:
            cand[m["id"]] = []
            continue
        # A generation starting more than 2 years before ours belongs to an earlier generation we may not carry.
        cand[m["id"]] = [g for g in gens if g["from"] is not None and m["from"] - 2 <= g["from"] <= end_year(m["to"])
                         and (overlap(m["from"], m["to"], g["from"], g["to"]) >= 1 or g["from"] == m["from"])]

    # 2. Each generation goes to the model it overlaps most (then the closest start).
    claims = defaultdict(list)
    by_id = {m["id"]: m for m in ours}
    derived = {m["id"]: DERIVED[(m["maker"], m["generation"])] for m in ours if (m["maker"], m["generation"]) in DERIVED}
    for mid, gens in cand.items():
        if mid in derived:
            continue
        for g in gens:
            claims[g["id"]].append(mid)
    assigned = defaultdict(list)
    for mid, gens in cand.items():
        if mid in derived:
            continue
        for g in gens:
            m = by_id[mid]
            def score(other):
                o = by_id[other]
                return (overlap(o["from"], o["to"], g["from"], g["to"]), -abs(o["from"] - g["from"]))
            if max(claims[g["id"]], key=score) == mid:
                assigned[mid].append(g)
    for mid, main_code in derived.items():
        m = by_id[mid]
        main_ids = [o["id"] for o in ours if o["maker"] == m["maker"] and o["generation"] == main_code]
        assigned[mid] = [g for o in main_ids for g in assigned.get(o, [])]

    # 3. Main generation, VehiclesDB link, year comparison.
    links, diffs = [], []
    for m in sorted(ours, key=lambda m: (m["maker"], m["name"], m["from"] or 0)):
        gens = sorted(assigned.get(m["id"], []), key=lambda g: (g["from"], g["id"]))
        main, plain = None, []
        if gens:
            plain = [g for g in gens if not re.search(VARIANT, g["name"].lower())] or gens
            main = min(plain, key=lambda g: (abs(g["from"] - m["from"]), g["from"], g["id"]))
        make, vname = vdb_target(m["maker"], m["name"], m["generation"])
        vdb_id = vdb_models.get(make, {}).get(norm(vname)) if make and vname else None
        their_from = min(g["from"] for g in plain) if plain else None
        # An end year of last year or later = still in production (the dataset is refreshed weekly).
        their_to = (None if any(g["to"] is None or g["to"] >= NOW - 1 for g in plain) else max(g["to"] for g in plain)) if plain else None
        d_from = (their_from - m["from"]) if gens else None
        d_to = None
        if gens and (m["to"] is not None or their_to is not None):
            d_to = (end_year(their_to) - end_year(m["to"])) if (m["to"] is not None and their_to is not None) else "ouvert/fermé"
        if m["from"] is None:
            status = "sans_annees"
        elif not gens:
            status = "pas_de_generation"
        elif abs(d_from) <= 1 and (d_to is None or (isinstance(d_to, int) and abs(d_to) <= 1)):
            status = "ok"
        else:
            status = "annees_differentes"
        note = notes[m["id"]]
        if not vdb_id:
            note = (note + "; " if note else "") + "pas de modèle VehiclesDB"
        years = lambda a, b: f"{a or ''}-{b or ''}" if a else ""
        links.append({
            "model_id": m["id"], "marque": m["maker"], "modele": m["name"], "generation": m["generation"] or "",
            "annees_caruno": years(m["from"], m["to"]), "vdb_model_id": vdb_id or "",
            "vmm_generation_id": main["id"] if main else "", "vmm_generation": main["name"] if main else "",
            "annees_vmm": years(their_from, their_to) if gens else "",
            "vmm_toutes": " | ".join(f'{g["id"]}:{g["name"]} {years(g["from"], g["to"])}' for g in gens),
            "statut": status, "note": note})
        if status == "annees_differentes":
            diffs.append({"marque": m["maker"], "modele": m["name"], "generation": m["generation"] or "",
                          "annees_caruno": years(m["from"], m["to"]), "annees_vmm": years(their_from, their_to),
                          "ecart_debut": d_from, "ecart_fin": d_to if d_to is not None else "",
                          "generations_vmm": " | ".join(f'{g["name"]} {years(g["from"], g["to"])}' for g in gens)})

    os.makedirs(out_dir, exist_ok=True)
    for fname, rows in (("model_links_a_verifier.csv", links), ("annees_differences.csv", diffs)):
        with open(os.path.join(out_dir, fname), "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["vide"], delimiter=";")
            w.writeheader(); w.writerows(rows)
    count = defaultdict(int)
    for r in links:
        count[r["statut"]] += 1
    print(f"  {len(links)} models: " + ", ".join(f"{k} {v}" for k, v in sorted(count.items()))
          + f"; VehiclesDB link {sum(1 for r in links if r['vdb_model_id'])}")

if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    main(*sys.argv[1:])
