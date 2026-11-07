"""
CARUNO — engines and vehicle types from the "moteur ..." fitment notes.

Usage:  python engines.py out/          (reads fitment.csv, models.csv, manufacturers.csv from out/)
Output: engines.csv, vehicle_types.csv, fitment_vehicle_type.csv (fitment id -> vehicle type),
        moteurs_a_verifier.csv (one line per model + engine, with the raw notes it came from).

Rules
  - a model + engine pair becomes a vehicle type only when proven (see MIN_PARTS below);
  - fuel: TDI / TD / D / CRDI / CDI / SDI / HDI = diesel; TSI / TFSI / FSI / T / 16V / 20V / i / V6 ... = essence;
    a bare displacement ("2.0") has an unknown fuel (NULL) and stays a "generic" engine.
  - VW group, model launched in 2007 or later: T / TSI / TFSI are the same turbo petrol engines,
    named TSI (VW, Skoda, Seat) or TFSI (Audi); D / TD / TDI are all TDI. Older "1.8T" stays "T".
  - V6 / V8 name the layout, not the fuel (a 3.0 TDI is a V6): fuel stays unknown.
  - An engine is shared by every model that uses it (one "2.0 TDI" row); a vehicle type is model + engine.
"""
import collections, re, sys
from pathlib import Path
import pandas as pd

OUT = Path(sys.argv[1])
DIESEL = {"TDI", "TD", "D", "CRDI", "CDI", "SDI", "HDI", "DCI", "TDCI", "D4D", "BLUETEC", "DIESEL"}
PETROL = {"TSI", "TFSI", "FSI", "T", "TURBO", "I", "16V", "20V", "8V", "12V", "24V", "2V", "4V",
          "VR6", "MPI", "GDI", "TGDI", "GTI", "VVT", "VVTI"}
LAYOUT = {"V6", "V8", "V10", "V12", "W12"}          # kept in the name, says nothing about the fuel (3.0 TDI is a V6)
NOT_A_CODE = {"AWD", "FWD", "RWD", "QUATTRO", "HP", "KW", "CV"}
VAG = {"VW", "AUDI", "SKODA", "SEAT"}
RE_NOTE_ENGINE = re.compile(r"moteur ([^,]+)")
RE_DISP = re.compile(r"^(\d\.\d)\s*(.*)$")


def parse(raw, maker, year_from):
    """'2.0TDI' -> dict(displacement, fuel, designation, engine_code, power_hp, label)."""
    s = raw.strip().upper().replace("_", " ")
    m = RE_DISP.match(s)
    disp, rest = (float(m.group(1)), m.group(2)) if m else (None, s)
    toks = re.findall(r"[A-Z0-9]+", rest)
    power = next((int(t[:-2]) for t in toks if re.fullmatch(r"\d+HP", t)), None)
    words = [t for t in toks if t in DIESEL or t in PETROL or t in LAYOUT]
    if "T" in words and "FSI" in words:                                   # "2.0T FSI" = 2.0 TFSI
        words = ["TFSI" if w == "FSI" else w for w in words if w != "T"]
    code = next((t for t in toks if re.fullmatch(r"[A-Z]{3,4}", t)
                 and t not in DIESEL | PETROL | LAYOUT | NOT_A_CODE), None)
    fuel = ("diesel" if any(w in DIESEL for w in words)
            else "essence" if any(w in PETROL for w in words) else None)
    desig = " ".join(words) or None
    recent_vag = maker in VAG and (year_from or 0) >= 2007
    if recent_vag and desig in {"T", "TSI", "TFSI"}:                     # one turbo petrol family
        desig = "TFSI" if maker == "AUDI" else "TSI"
    if recent_vag and desig in {"D", "TD", "TDI"}:                       # every VW-group diesel since 2007 is a TDI
        desig = "TDI"
    if desig == "I":
        desig = "i"
    label = " ".join(x for x in [f"{disp:.1f}" if disp else None, desig, code,
                                 f"{power} ch" if power else None] if x)
    return {"displacement_l": disp, "fuel": fuel, "designation": desig, "engine_code": code,
            "power_hp": power, "label": label}


fit = pd.read_csv(OUT / "fitment.csv")
models = pd.read_csv(OUT / "models.csv").merge(
    pd.read_csv(OUT / "manufacturers.csv").rename(columns={"id": "manufacturer_id", "name": "maker"}),
    on="manufacturer_id")
models = models.set_index("id")

rows = []                                                           # (fitment row, raw engine, parsed engine)
for f in fit.itertuples():
    m = RE_NOTE_ENGINE.search(f.note) if isinstance(f.note, str) else None
    if not m:
        continue                                                    # no engine: stays at model level
    mod = models.loc[f.model_id]
    year = None if pd.isna(mod.year_from) else int(mod.year_from)
    e = parse(m.group(1), mod.maker, year)
    if e["label"]:
        rows.append((f, m.group(1).strip(), e))

# Engines written after a list of models are true for the list, not for each model
# ("A4 B8 / ... / Q7 4M 3.0 / 4.0T" does not make an A4 B8 4.0). A model + engine pair goes to
# vehicle-type level only when it is proven:
#   direct   the catalogue writes that engine for that model alone, or
#   repeated the pair comes back on at least MIN_PARTS different parts (OEM numbers): accidental
#            pairs of a list appear on 1-3 parts, real ones (Golf 7 2.0 TDI, A4 B8 2.0 TFSI) on 6-20.
# Unproven rows stay at model level with their note: engine-dependent parts then show "à confirmer".
MIN_PARTS = 4
direct = {(f.model_id, e["label"]) for f, _, e in rows if f.engine_scope == "direct"}
parts_per_pair = collections.defaultdict(set)
for f, _, e in rows:
    parts_per_pair[(f.model_id, e["label"])].add(f.oem_id)
proof = {k: "direct" if k in direct else f"répété sur {len(v)} pièces"
         for k, v in parts_per_pair.items() if k in direct or len(v) >= MIN_PARTS}
dropped = collections.Counter()

engines, vtypes, links, review = {}, {}, [], {}
for f, raw, e in rows:
    mod = models.loc[f.model_id]
    if (f.model_id, e["label"]) not in proof:
        gen = "" if pd.isna(mod.generation) else f" ({mod.generation})"
        dropped[(f"{mod.maker} {mod['name']}{gen}", e["label"])] += 1
        continue                                                    # stays at model level, note kept
    eid = engines.setdefault(e["label"], {"id": len(engines) + 1, **e})["id"]
    vkey = (f.model_id, eid)
    if vkey not in vtypes:
        gen = "" if pd.isna(mod.generation) else f" ({mod.generation})"
        vtypes[vkey] = {"id": len(vtypes) + 1, "model_id": f.model_id, "engine_id": eid,
                        "label": f"{mod.maker} {mod['name']}{gen} {e['label']}"}
    links.append({"fitment_id": f.id, "vehicle_type_id": vtypes[vkey]["id"]})
    r = review.setdefault(vkey, {"Véhicule": vtypes[vkey]["label"], "Moteur": e["label"],
                                 "Carburant": e["fuel"] or "inconnu",
                                 "Preuve": proof[(f.model_id, e["label"])], "Notes d'origine": set(), "Lignes": 0})
    r["Notes d'origine"].add(raw)
    r["Lignes"] += 1

eng = pd.DataFrame(engines.values())[["id", "label", "displacement_l", "fuel", "designation", "engine_code", "power_hp"]]
eng["power_hp"] = eng["power_hp"].astype("Int64")
eng.to_csv(OUT / "engines.csv", index=False)
pd.DataFrame(vtypes.values()).to_csv(OUT / "vehicle_types.csv", index=False)
pd.DataFrame(links).to_csv(OUT / "fitment_vehicle_type.csv", index=False)
rv = pd.DataFrame(review.values())
rv["Notes d'origine"] = rv["Notes d'origine"].map(lambda s: " | ".join(sorted(s)))
rv.sort_values("Véhicule").to_csv(OUT / "moteurs_a_verifier.csv", index=False, encoding="utf-8-sig")
pd.DataFrame([{"Véhicule": v, "Moteur": e, "Lignes": n} for (v, e), n in sorted(dropped.items())]) \
  .to_csv(OUT / "moteurs_non_prouves.csv", index=False, encoding="utf-8-sig")

print(f"moteurs {len(eng)} (carburant inconnu: {eng.fuel.isna().sum()}) | types de véhicule {len(vtypes)} | "
      f"lignes au niveau moteur {len(links)} / {len(fit)} | paires non prouvées laissées au niveau modèle "
      f"{len(dropped)} ({sum(dropped.values())} lignes)")
