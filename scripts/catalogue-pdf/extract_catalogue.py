"""Extract the TiBAO PDF catalogues into a spreadsheet ready for the Dolibarr import.

Usage: extract_catalogue.py <pdf_dir> <out.xlsx>

Each catalogue page is a ruled table: No. | Photo | N,ID | OEM | Parts Name | Model | Remark | Auto B
(Land Rover has no Remark / Auto B columns). Text is real text, no OCR needed.
"""
import collections
import csv
import glob
import os
import re
import sys
from multiprocessing import Pool

import pymupdf
from openpyxl import Workbook
from openpyxl.styles import Font

CHUNK = 40           # pages per worker task
FULL_LINE_SLACK = 3  # a line with less free room (in chars) was wrapped mid-word

COLUMNS = {
    8: ["no", "photo", "n_id", "oem", "designation", "modele", "remarque", "marques_vehicule"],
    6: ["no", "photo", "n_id", "oem", "designation", "modele"],
    5: ["no", "photo", "n_id", "oem", "designation"],
}

# Chinese left in a few remarks (unambiguous terms only; some others are garbled in the PDF itself).
REMARK_ZH = {"带密封圈": "with seal", "外径": "OD ", "内径": "ID ", "前轮": "front wheel",
             "气压": "air pressure", "高": "H ", "厚": "thk ", "寸": "inch", "白": "white", "各": "each"}


def page_chars(page):
    """Every character with its centre and its text line. PyMuPDF may put words from
    neighbouring cells on one line, so cells are rebuilt from characters, not lines."""
    chars = []
    for bi, block in enumerate(page.get_text("rawdict", flags=pymupdf.TEXTFLAGS_TEXT)["blocks"]):
        for li, line in enumerate(block.get("lines", [])):
            for span in line["spans"]:
                for ch in span["chars"]:
                    x0, y0, x1, y1 = ch["bbox"]
                    chars.append(((x0 + x1) / 2, (y0 + y1) / 2, ch["c"], (bi, li), ch["bbox"]))
    return chars


def cell_text(chars, rect):
    """Rebuild a cell's text, joining wrapped lines with or without a space."""
    groups = {}
    for cx, cy, c, key, bbox in chars:
        if rect.x0 <= cx <= rect.x1 and rect.y0 <= cy <= rect.y1:
            groups.setdefault(key, []).append((c, bbox))
    lines = []
    for cs in groups.values():
        ink = [b for c, b in cs if not c.isspace()]
        if ink:
            x0, x1 = min(b[0] for b in ink), max(b[2] for b in ink)
            lines.append((min(b[1] for b in ink), x0, "".join(c for c, _ in cs), x1 - x0))
    lines.sort(key=lambda l: (round(l[0]), l[1]))
    out, prev = "", None
    for l in lines:
        txt = l[2]
        if prev is None:
            out = txt
        else:
            ptxt, pw = prev[2], prev[3]
            slack = (rect.width - pw) / (pw / max(len(ptxt.strip()), 1))
            same_row = abs(l[0] - prev[0]) < 2
            if ptxt.endswith(" ") or txt.startswith(" ") or " " in ptxt.strip():
                sep = " "
            elif same_row or slack < FULL_LINE_SLACK:
                sep = ""  # cut in the middle of a word
            else:
                sep = " "
            out += sep + txt
        prev = l
    out = re.sub(r"[\x00-\x1f\x7f]", " ", out)  # stray control chars, refused by Excel
    return re.sub(r"\s+", " ", out).strip()


def split_oem_name(oem):
    """Some rows put the part name in the OEM cell ("4M0 Arm Bushing Set Front"):
    the name starts at the first capitalised word ("Arm")."""
    tokens = oem.split()
    for i, t in enumerate(tokens):
        if i and len(t) >= 3 and t.isalpha() and t[0].isupper() and t[1:].islower():
            return " ".join(tokens[:i]), " ".join(tokens[i:])
    return oem, ""


def normalize_oem(oem):
    """Search key stored in the `oem_ref` extrafield: upper case, no spaces, dots or dashes."""
    return re.sub(r"[\s.\-]", "", oem).upper()


def extract_pages(task):
    path, start, end = task
    doc = pymupdf.open(path)
    rows, skipped = [], []
    for n in range(start, end):
        page = doc[n]
        chars = page_chars(page)
        for table in page.find_tables().tables:
            names = COLUMNS.get(table.col_count)
            for row in table.rows:
                if any(c is None for c in row.cells):
                    continue  # merged title row
                cells = [cell_text(chars, pymupdf.Rect(c)) for c in row.cells]
                if not any(cells) or cells[0].lower() in ("no.", "no"):
                    continue
                vals = dict(dict.fromkeys(COLUMNS[8], ""), **dict(zip(names, cells))) if names else {}
                # Rows without a numeric TiBAO id (e.g. the SKODA body-parts annex) are kept aside.
                if not vals or not vals["no"].isdigit() or not vals["n_id"].isdigit():
                    skipped.append((n + 1, table.col_count, " | ".join(cells)))
                    continue
                vals.pop("photo")
                if not vals["designation"]:
                    vals["oem"], vals["designation"] = split_oem_name(vals["oem"])
                for zh, en in REMARK_ZH.items():
                    vals["remarque"] = vals.get("remarque", "").replace(zh, en).strip()
                vals.update(page=n + 1, no=int(vals["no"]))
                rows.append(vals)
    return os.path.basename(path), rows, skipped


def catalogue_name(filename):
    return re.sub(r"\s*(catalog(ue)?)?\s*2025\.pdf$", "", filename, flags=re.I).strip()


def write_sheet(wb, title, header, rows):
    ws = wb.create_sheet(title)
    ws.append(header)
    for c in ws[1]:
        c.font = Font(bold=True)
    for r in rows:
        ws.append(r)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    for col, h in zip(ws.columns, header):
        width = max([len(str(h))] + [len(str(c.value or "")) for c in list(col)[:500]])
        ws.column_dimensions[col[0].column_letter].width = min(width + 2, 60)


def main(pdf_dir, out_path):
    files = sorted(glob.glob(os.path.join(pdf_dir, "*.pdf")))
    tasks = []
    for f in files:
        count = pymupdf.open(f).page_count
        tasks += [(f, s, min(s + CHUNK, count)) for s in range(0, count, CHUNK)]

    by_cat = collections.defaultdict(lambda: {"rows": [], "skipped": []})
    with Pool() as pool:
        for i, (name, rows, skipped) in enumerate(pool.imap_unordered(extract_pages, tasks), 1):
            by_cat[name]["rows"] += rows
            by_cat[name]["skipped"] += skipped
            print(f"\r{i}/{len(tasks)} lots", end="", flush=True)
    print()

    lines, controls, skipped_rows = [], [], []
    for f in files:
        name = os.path.basename(f)
        cat = catalogue_name(name)
        rows = sorted(by_cat[name]["rows"], key=lambda r: r["no"])
        nos = [r["no"] for r in rows]
        missing = sorted(set(range(1, max(nos, default=0) + 1)) - set(nos))
        dupes = [n for n, k in collections.Counter(nos).items() if k > 1]
        controls.append([cat, pymupdf.open(f).page_count, len(rows), max(nos, default=0),
                         len(missing), ", ".join(map(str, missing[:30])), len(dupes)])
        skipped_rows += [[cat, p, cols, txt] for p, cols, txt in by_cat[name]["skipped"]]
        for r in rows:
            r["catalogue"] = cat
            r["oem_ref"] = normalize_oem(r["oem"])
            lines.append(r)

    # One product per supplier reference (N,ID); the same part is often listed in several catalogues.
    products, conflicts = {}, []
    for r in lines:
        p = products.get(r["n_id"])
        if p is None:
            products[r["n_id"]] = dict(r, catalogues=[r["catalogue"]])
            continue
        if r["catalogue"] not in p["catalogues"]:
            p["catalogues"].append(r["catalogue"])
        for k in ("oem_ref", "designation", "modele", "remarque", "marques_vehicule"):
            if r.get(k) and p.get(k) and r[k] != p[k]:
                conflicts.append([r["n_id"], k, p[k], p["catalogue"], r[k], r["catalogue"]])
            elif r.get(k) and not p.get(k):
                p[k] = r[k]

    prod_header = ["ref", "label", "description", "brand", "oem", "oem_ref", "designation",
                   "modele", "remarque", "marques_vehicule", "catalogues"]
    prod_rows = []
    for p in products.values():
        # Dolibarr needs a label; some catalogue rows have no part name.
        label = " ".join(x for x in (p["designation"], p.get("remarque", "")) if x) or f"Pièce OEM {p['oem']}"
        desc = "\n".join(x for x in (
            f"Modèles : {p['modele']}" if p.get("modele") else "",
            f"Véhicules : {p['marques_vehicule']}" if p.get("marques_vehicule") else "",
            f"OEM : {p['oem']}" if p["oem"] else "") if x)
        prod_rows.append([p["n_id"], label, desc, "TIBAO", p["oem"], p["oem_ref"], p["designation"],
                          p.get("modele", ""), p.get("remarque", ""), p.get("marques_vehicule", ""),
                          " / ".join(p["catalogues"])])

    wb = Workbook()
    wb.remove(wb.active)
    write_sheet(wb, "Produits", prod_header, prod_rows)
    write_sheet(wb, "Lignes", ["catalogue", "page", "no", "n_id", "oem", "oem_ref", "designation",
                               "modele", "remarque", "marques_vehicule"],
                [[r["catalogue"], r["page"], r["no"], r["n_id"], r["oem"], r["oem_ref"], r["designation"],
                  r["modele"], r.get("remarque", ""), r.get("marques_vehicule", "")] for r in lines])
    write_sheet(wb, "Controle", ["catalogue", "pages", "lignes", "dernier_no", "no_manquants",
                                 "exemples_manquants", "no_en_double"], controls)
    write_sheet(wb, "Conflits", ["n_id", "champ", "valeur_1", "catalogue_1", "valeur_2", "catalogue_2"],
                conflicts)
    write_sheet(wb, "Hors_format", ["catalogue", "page", "colonnes", "contenu"], skipped_rows)
    wb.save(out_path)

    with open(os.path.splitext(out_path)[0] + "-produits.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow(prod_header)
        w.writerows(prod_rows)

    for c in controls:
        print(f"{c[0]:<14} pages={c[1]:>4} lignes={c[2]:>5} dernier_no={c[3]:>5} manquants={c[4]} doublons={c[6]}")
    print(f"lignes={len(lines)} produits_uniques={len(products)} conflits={len(conflicts)} hors_format={len(skipped_rows)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
