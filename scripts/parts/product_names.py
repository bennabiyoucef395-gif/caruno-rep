"""
CARUNO — French and Arabic product names for the shop (Dolibarr label), from the catalogue spreadsheet.

Usage:  python product_names.py catalogue-pieces.xlsx catalogue-tibao-2025.xlsx out/
Output: out/product_names.csv  (ref;en;fr;ar)   — en = the supplier label imported in Dolibarr
        out/noms_a_verifier.csv (sample of each rule, for a human check)

Name = French designation of the catalogue + the details of the supplier label translated.
The supplier label is "<designation><details>" ("Control Arm L", "Brake Disc φ300mm", "Engine Mount R N52"):
the details tell parts apart (side, size, engine code), so they are kept: common words are translated
(L -> côté gauche, Front -> avant, Upper -> haut, colours, materials), codes and sizes stay as written.
Forms that do not depend on the noun's gender are used (côté droit, haut / bas, int. / ext.).
Skipped (name unchanged): placeholders "Pièce OEM …", designations left untranslated in the catalogue.
"""
import re, sys, unicodedata
from pathlib import Path
import pandas as pd

SRC_FR, SRC_TIBAO, OUT = sys.argv[1], sys.argv[2], Path(sys.argv[3])

# Phrases first (several words), then single words. Keys are lower-case.
PHRASES = [
    (r"without repair kits?", "sans kit de réparation", "بدون طقم إصلاح"),
    (r"with repair kits?", "avec kit de réparation", "مع طقم إصلاح"),
    (r"repair kits?", "kit de réparation", "طقم إصلاح"),
    (r"air conditioner", "climatisation", "مكيف"),
    (r"l\s*/\s*r|\blr\b", "gauche et droit", "يسار ويمين"),
    (r"front\s*/\s*back|front\s*/\s*rear", "avant et arrière", "أمامي وخلفي"),
    (r"#n/a", "", ""),
]
WORDS = {
    "l": ("côté gauche", "يسار"), "lh": ("côté gauche", "يسار"), "left": ("côté gauche", "يسار"),
    "r": ("côté droit", "يمين"), "rh": ("côté droit", "يمين"), "right": ("côté droit", "يمين"),
    "fl": ("avant côté gauche", "أمامي يسار"), "fr": ("avant côté droit", "أمامي يمين"),
    "bl": ("arrière côté gauche", "خلفي يسار"), "br": ("arrière côté droit", "خلفي يمين"),
    "front": ("avant", "أمامي"), "back": ("arrière", "خلفي"), "rear": ("arrière", "خلفي"), "middle": ("milieu", "وسط"),
    "upper": ("haut", "علوي"), "up": ("haut", "علوي"), "lower": ("bas", "سفلي"), "down": ("bas", "سفلي"),
    "inner": ("int.", "داخلي"), "inside": ("int.", "داخلي"), "outer": ("ext.", "خارجي"),
    "with": ("avec", "مع"), "without": ("sans", "بدون"), "and": ("et", "و"),
    "small": ("petit modèle", "صغير"), "big": ("grand modèle", "كبير"), "long": ("long", "طويل"), "short": ("court", "قصير"),
    "single": ("simple", "مفرد"), "double": ("double", "مزدوج"), "set": ("jeu", "طقم"), "kit": ("kit", "طقم"),
    "pcs": ("pièces", "قطع"), "pc": ("pièce", "قطعة"), "pieces": ("pièces", "قطع"), "piece": ("pièce", "قطعة"),
    "hole": ("trous", "ثقوب"), "holes": ("trous", "ثقوب"), "teeth": ("dents", "أسنان"), "vein": ("nervures", "خطوط"),
    "white": ("blanc", "أبيض"), "black": ("noir", "أسود"), "yellow": ("jaune", "أصفر"), "red": ("rouge", "أحمر"),
    "gray": ("gris", "رمادي"), "grey": ("gris", "رمادي"), "silver": ("argent", "فضي"), "blue": ("bleu", "أزرق"),
    "beige": ("beige", "بيج"), "chrome": ("chromé", "كروم"), "chromed": ("chromé", "كروم"), "matte": ("mat", "مطفي"),
    "crystal": ("cristal", "كريستال"), "smoked": ("fumé", "مدخن"),
    "iron": ("métal", "حديد"), "aluminum": ("aluminium", "ألمنيوم"), "aluminium": ("aluminium", "ألمنيوم"),
    "plastic": ("plastique", "بلاستيك"), "rubber": ("caoutchouc", "مطاط"), "paper": ("papier", "ورق"),
    "carbon": ("carbone", "كربون"), "glass": ("verre", "زجاج"), "gas": ("gaz", "غاز"), "oil": ("huile", "زيت"),
    "air": ("air", "هواء"), "electric": ("électrique", "كهربائي"), "manual": ("manuel", "يدوي"), "manually": ("manuel", "يدوي"),
    "automatic": ("automatique", "أوتوماتيك"), "xenon": ("xénon", "زينون"), "normal": ("standard", "عادي"), "std": ("standard", "عادي"),
    "logo": ("logo", "شعار"), "wire": ("fil", "سلك"), "two": ("deux", "اثنان"), "all": ("tous", "كل"),
    "exhaust": ("échappement", "عادم"), "intake": ("admission", "سحب"), "door": ("porte", "باب"), "drum": ("tambour", "طبلة"),
    "brakes": ("freins", "فرامل"), "round": ("rond", "دائري"), "frame": ("cadre", "إطار"), "ball": ("bille", "كرة"),
    "head": ("tête", "رأس"), "pump": ("pompe", "مضخة"), "plug": ("bouchon", "سدادة"), "pin": ("axe", "محور"),
    "slot": ("fente", "شق"), "light": ("feu", "ضوء"), "cylinder": ("cylindre", "أسطوانة"), "type": ("type", "نوع"),
    "repair": ("réparation", "إصلاح"), "kits": ("kit", "طقم"), "thk": ("ép.", "سمك"),
    "seat": ("support", "قاعدة"), "fan": ("ventilateur", "مروحة"), "motor": ("moteur", "موتور"), "halogen": ("halogène", "هالوجين"),
}
FULLWIDTH = str.maketrans({"：": ": ", "，": ", ", "（": " (", "）": ")", "；": "; ", "／": "/"})
TOKEN = re.compile(r"[A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+")


def fold(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", s)


def translate(extra, lang):
    """Details of the supplier label -> French (lang=1) or Arabic (lang=2); codes and sizes kept."""
    s = " " + extra.translate(FULLWIDTH) + " "
    for rx, fr, ar in PHRASES:
        s = re.sub(r"(?i)" + rx, " " + (fr if lang == 1 else ar) + " ", s)
    out = []
    for tok in TOKEN.findall(s):
        key = tok.lower()
        # A word glued to a number ("300mm", "M52") is a size or a code: kept. Only whole words are translated.
        out.append(WORDS[key][lang - 1] if tok.isalpha() and key in WORDS else tok)
    t = "".join(out)
    t = re.sub(r"\s*,\s*", ", ", t)
    t = re.sub(r"\s+", " ", t).strip(" ,;-#")
    return t


c = pd.read_excel(SRC_FR, dtype=str).fillna("").rename(columns={"Désignation": "fr_name", "التسمية": "ar_name"})
t = pd.read_excel(SRC_TIBAO, sheet_name="Produits", dtype=str).fillna("")
j = c.merge(t[["ref", "label", "designation"]], left_on="Référence", right_on="ref")
rows, review = [], {}
for r in j.itertuples():
    en, desig, fr, ar = r.label.strip(), r.designation.strip(), r.fr_name.strip(), r.ar_name.strip()
    if not en:
        continue
    if not desig or re.match(r"(?i)pi[eè]ce oem", fr) or len(fr) <= 2 or fold(fr) == fold(desig):
        why = "pièce OEM" if re.match(r"(?i)pi[eè]ce oem", fr) else "non traduite"
        review.setdefault(why, []).append((r.ref, en, "(inchangé)", ""))
        continue
    extra = en[len(desig):] if en.lower().startswith(desig.lower()) else ""
    fr_name = (fr + " " + translate(extra, 1)).strip()
    ar_name = ((ar + " " + translate(extra, 2)).strip()) if ar and not re.match(r"(?i)pi[eè]ce oem", ar) else ""
    fr_name = re.sub(r"\s+", " ", fr_name)[:255]
    ar_name = re.sub(r"\s+", " ", ar_name)[:255]
    rows.append({"ref": r.ref, "en": en, "fr": fr_name, "ar": ar_name})
    review.setdefault("avec détails" if extra.strip() else "nom seul", []).append((r.ref, en, fr_name, ar_name))

OUT.mkdir(parents=True, exist_ok=True)
pd.DataFrame(rows).to_csv(OUT / "product_names.csv", sep=";", index=False, encoding="utf-8")
sample = [{"Cas": k, "Réf": a, "Nom fournisseur": b, "Nom français": c2, "Nom arabe": d}
          for k, v in review.items() for (a, b, c2, d) in v[:40]]
pd.DataFrame(sample).to_csv(OUT / "noms_a_verifier.csv", index=False, encoding="utf-8-sig")
print(f"noms {len(rows)} | inchangés {sum(len(v) for k, v in review.items() if k in ('pièce OEM', 'non traduite'))} "
      f"| avec détails {len(review.get('avec détails', []))}")
