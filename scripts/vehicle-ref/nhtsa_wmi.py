"""
NHTSA vPIC WMI codes -> vehicle_ref.nhtsa_wmi + scripts/parts/wmi_nhtsa.py (scripts/vehicle-ref/build.sh).

NHTSA has no bulk WMI file in its API: build.sh calls GetWMIsForManufacturer once per query below.
A query is a partial-name search ("ford" also finds "STANFORD ..."), so a record is kept only when its
manufacturer name matches one of RULES; maker = our canonical name (the one vin_decoder.py and caruno_parts use).

Usage: python -I nhtsa_wmi.py queries
       python -I nhtsa_wmi.py build <json_dir> <date> <out.sql> <out_wmi_nhtsa.py>
"""
import json, os, re, sys
from collections import defaultdict

# Makes of the catalogue + makes common in Algeria. Partial-name searches on NHTSA.
QUERIES = [
    "volkswagen", "audi", "seat", "skoda", "porsche", "bmw", "bayerische motoren", "mini", "mercedes", "daimler",
    "hyundai", "kia", "toyota", "lexus", "land rover", "jaguar", "renault", "dacia", "peugeot", "citroen",
    "automobiles", "stellantis", "fiat", "opel", "vauxhall", "ford", "nissan", "suzuki", "mazda", "honda",
    "chevrolet", "general motors", "mitsubishi", "isuzu", "chrysler", "jeep", "alfa romeo", "volvo",
    "chery", "geely", "great wall", "byd", "jac", "anhui", "baic", "dongfeng", "changan", "saic", "ssangyong",
    "kg mobility",
]

# (regex on the upper-case manufacturer name, canonical maker). First match wins; None = left out
# (a plant building several makes). Group names (GENERAL MOTORS, CHRYSLER, STELLANTIS) cover several brands.
RULES = [
    (r"^MAZDA TOYOTA\b", None),
    (r"^VOLKSWAGEN\b", "VW"),
    (r"^AUDI\b", "AUDI"),
    (r"^SEAT\b", "SEAT"),
    (r"^SKODA\b", "SKODA"),
    (r"\bPORSCHE\b", "PORSCHE"),
    (r"^(BMW|BAYERISCHE MOTOREN)\b", "BMW"),
    (r"^MERCEDES\b", "MERCEDES-BENZ"),
    (r"^DAIMLER (AG|CHRYSLER AG)\b", "MERCEDES-BENZ"),
    (r"^HYUNDAI MOTOR\b", "HYUNDAI"),
    (r"^KIA\b", "KIA"),
    (r"^TOYOTA\b", "TOYOTA"),
    (r"^(JAGUAR )?LAND ROVER\b", "LAND ROVER"),
    (r"^JAGUAR\b", "JAGUAR"),
    (r"^RENAULT\b", "RENAULT"),
    (r"^(AUTOMOBILE )?DACIA\b", "DACIA"),
    (r"^(AUTOMOBILES )?PEUGEOT\b", "PEUGEOT"),
    (r"^(AUTOMOBILES )?CITRO[EË]N\b", "CITROEN"),
    (r"^FIAT\b", "FIAT"),
    (r"^(ADAM )?OPEL\b", "OPEL"),
    (r"^VAUXHALL\b", "OPEL"),
    (r"^FORD\b", "FORD"),
    (r"^NISSAN\b", "NISSAN"),
    (r"^SUZUKI\b|^MARUTI SUZUKI\b", "SUZUKI"),
    (r"^MAZDA\b", "MAZDA"),
    (r"^(AMERICAN )?HONDA (MOTOR|DE MEXICO|OF)\b", "HONDA"),
    (r"^CHEVROLET\b", "CHEVROLET"),
    (r"^(SHANGHAI )?GENERAL MOTORS\b", "GENERAL MOTORS"),
    (r"^CHRYSLER\b", "CHRYSLER"),
    (r"^STELLANTIS\b", "STELLANTIS"),
    (r"^MITSUBISHI MOTORS\b", "MITSUBISHI"),
    (r"^ISUZU MOTORS\b", "ISUZU"),
    (r"^JEEP\b", "JEEP"),
    (r"^ALFA ROMEO\b", "ALFA ROMEO"),
    (r"\bVOLVO CAR\b", "VOLVO"),
    (r"^CHERY\b", "CHERY"),
    (r"\bGEELY\b", "GEELY"),
    (r"^GREAT WALL\b", "GREAT WALL"),
    (r"^BYD\b", "BYD"),
    (r"^(ANHUI )?JIANGHUAI\b|^JAC MOTORS\b", "JAC"),
    (r"^BAIC\b|^BEIJING AUTOMOTIVE\b", "BAIC"),
    (r"^DONGFENG\b", "DONGFENG"),
    (r"^CHONGQING CHANGAN\b|^CHANGAN\b", "CHANGAN"),
    (r"^SAIC\b", "SAIC"),
    (r"^SSANGYONG\b|^KG MOBILITY\b", "SSANGYONG"),
]
RULES = [(re.compile(p), m) for p, m in RULES]
# Types of the counter's customers' vehicles; the database keeps every type.
CAR_TYPES = {"Passenger Car", "Multipurpose Passenger Vehicle (MPV)", "Truck"}

def maker_of(name):
    u = (name or "").upper().strip()
    return next((m for rx, m in RULES if rx.search(u)), None)

def lit(v):
    if v is None or v == "":
        return "NULL"
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'") + "'"

def day(v):
    return v[:10] if v and re.match(r"^\d{4}-\d{2}-\d{2}", v) else None

def build(json_dir, date, out_sql, out_py):
    rows, dropped = {}, defaultdict(set)
    for f in sorted(os.listdir(json_dir)):
        if not f.endswith(".json"):
            continue
        for r in json.load(open(os.path.join(json_dir, f), encoding="utf-8")).get("Results") or []:
            wmi = (r.get("WMI") or "").strip().upper()
            if not re.fullmatch(r"[A-HJ-NPR-Z0-9]{3}([A-HJ-NPR-Z0-9]{3})?", wmi):
                continue
            m = maker_of(r.get("Name"))
            if not m:
                dropped[f[:-5]].add(r.get("Name"))
                continue
            rows[(int(r["Id"]), wmi)] = (int(r["Id"]), wmi, r.get("Name").strip(), (r.get("Country") or "").strip() or None,
                                 (r.get("VehicleType") or "").strip() or None, m,
                                 day(r.get("CreatedOn")), day(r.get("UpdatedOn")))
    with open(out_sql, "w", encoding="utf-8", newline="\n") as out:
        out.write("SET NAMES utf8mb4;\n")
        vals = [f"({','.join(lit(v) for v in row)})" for row in sorted(rows.values())]
        for i in range(0, len(vals), 500):
            out.write("INSERT INTO nhtsa_wmi (mfr_id, wmi, manufacturer, country, vehicle_type, maker, created_on, updated_on)"
                      " VALUES\n" + ",\n".join(vals[i:i + 500]) + ";\n")

    makers = defaultdict(set)
    for _, wmi, _, _, vtype, m, _, _ in rows.values():
        if vtype in CAR_TYPES:
            makers[wmi].add(m)
    table = {w: next(iter(ms)) for w, ms in makers.items() if len(ms) == 1}
    conflicts = {w: sorted(ms) for w, ms in makers.items() if len(ms) > 1}
    with open(out_py, "w", encoding="utf-8", newline="\n") as out:
        out.write('"""\nGENERATED by scripts/vehicle-ref/nhtsa_wmi.py from NHTSA vPIC (US government work, public domain),\n'
                  f"WMI lists fetched on {date}. Do not edit: re-run scripts/vehicle-ref/build.sh download nhtsa.\n"
                  "Hand-written codes go in vin_decoder.WMI, which is checked first.\n"
                  "Keys: 3-char WMI, or 6 chars (WMI + VIN chars 12-14) for small makers (WMI ending in 9).\n")
        if conflicts:
            out.write("Left out, NHTSA gives several makers: "
                      + ", ".join(f"{w} ({'/'.join(ms)})" for w, ms in sorted(conflicts.items())) + "\n")
        out.write('"""\n\nWMI_NHTSA = {\n')
        for w in sorted(table):
            out.write(f'    "{w}": "{table[w]}",\n')
        out.write("}\n")

    print(f"  nhtsa_wmi: {len(rows)} rows; wmi_nhtsa.py: {len(table)} codes (passenger car, MPV, truck)"
          + (f"; {len(conflicts)} left out (several makers)" if conflicts else ""))
    for q, names in sorted(dropped.items()):
        print(f"  dropped for '{q}': {len(names)} names, e.g. {sorted(n for n in names if n)[:4]}")

if __name__ == "__main__":
    if sys.argv[1:2] == ["queries"]:
        print("\n".join(QUERIES))
    elif sys.argv[1:2] == ["build"] and len(sys.argv) == 6:
        build(*sys.argv[2:])
    else:
        sys.exit(__doc__)
