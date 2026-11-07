"""
CARUNO — data of the public online shop (vitrine), built from the SQL export of export.sh.

Usage:  python export_vitrine.py <work dir> <documents dir> <out dir>
  <work dir>/parts.tsv   ref, label, oem, brand, price, family   (mariadb -B output)
  <documents dir>        Dolibarr documents (read-only): produit/<ref>/*.jpg, societe/<counter>/caruno-profil.json
  <out dir>              data.json + photos/<ref>.jpg, replaced as a whole

Only what a customer may see: name, reference, OEM, public price, family, photo, "available".
Never: purchase price, exact stock, supplier, the TIBAO brand (supplier catalogue brand).
"""
import json, shutil, sys
from datetime import datetime, timezone
from pathlib import Path

WORK, DOCS, OUT = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
PHOTO_EXT = (".jpg", ".jpeg", ".png", ".webp")


def tsv(path):
    for line in path.read_text(encoding="utf-8").splitlines():
        if line:
            yield [None if v == "NULL" else v.replace("\\t", "\t").replace("\\n", "\n").replace("\\\\", "\\") for v in line.split("\t")]


def photo_of(ref):
    """First image of the product folder (the imported <ref>.jpg first), thumbnails excluded."""
    folder = DOCS / "produit" / ref
    if not folder.is_dir():
        return None
    files = sorted((f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in PHOTO_EXT),
                   key=lambda f: (f.stem != ref, f.name))
    return files[0] if files else None


def profile():
    for p in sorted(DOCS.glob("societe/*/caruno-profil.json")):
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except ValueError:
            pass
    return {}


tmp = OUT.with_name(OUT.name + ".tmp")
shutil.rmtree(tmp, ignore_errors=True)
(tmp / "photos").mkdir(parents=True)
parts = []
for ref, label, oem, brand, price, family in tsv(WORK / "parts.tsv"):
    src = photo_of(ref)
    photo = None
    if src:
        photo = "photos/" + ref + src.suffix.lower()
        shutil.copyfile(src, tmp / photo)
    parts.append({
        "ref": ref, "name": label, "oem": oem or "",
        "brand": "" if (brand or "").strip().upper() == "TIBAO" else (brand or ""),
        "price": round(float(price or 0)), "family": family or "", "photo": photo,
    })
p = profile()
shop = {k: p.get(k, "") for k in ("name", "address", "phone", "whatsapp", "logo")}
data = {"version": 1, "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "shop": shop,
        "families": sorted({x["family"] for x in parts if x["family"]}), "parts": parts}
(tmp / "data.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
shutil.rmtree(OUT, ignore_errors=True)
tmp.rename(OUT)
print(f"vitrine -> {OUT}: {len(parts)} pièce(s) en ligne, {sum(1 for x in parts if x['photo'])} avec photo, "
      f"WhatsApp {'oui' if shop['whatsapp'] else 'NON RENSEIGNÉ'}")
