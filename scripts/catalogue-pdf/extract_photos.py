"""Extract the part photos of the TiBAO PDF catalogues, one JPEG per TiBAO id.

Usage: extract_photos.py <pdf_dir> <out_dir>

Each photo is stored in the PDF as horizontal strips (usually two) inside the "Photo" cell,
under a full-page TiBAO watermark. The strips are re-assembled on a blank page, so the
photo comes out without the watermark. Images reused on several rows (generic pictures)
are skipped. Output: <out_dir>/<n_id>.jpg and <out_dir>/photos.csv.
"""
import collections
import csv
import glob
import os
import sys
from multiprocessing import Pool

import pymupdf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # python -I leaves the script dir out
from extract_catalogue import CHUNK, COLUMNS, catalogue_name, cell_text, page_chars

ZOOM = 4          # the strips hold about 4 px per point: render at their own resolution
JPEG_QUALITY = 80


def strip_pixmap(doc, xref):
    pix = pymupdf.Pixmap(doc, xref)
    smask = doc.extract_image(xref).get("smask", 0)
    if smask:
        pix = pymupdf.Pixmap(pix, pymupdf.Pixmap(doc, smask))
    return pix


def render_photo(doc, cell, strips):
    """Paste the strips on a blank page the size of the cell, render the area they cover."""
    tmp = pymupdf.open()
    page = tmp.new_page(width=cell.width, height=cell.height)
    area = pymupdf.Rect()
    for info in strips:
        box = pymupdf.Rect(info["bbox"]) - (cell.x0, cell.y0, cell.x0, cell.y0)
        page.insert_image(box, pixmap=strip_pixmap(doc, info["xref"]), keep_proportion=False)
        area |= box
    pix = page.get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), clip=area & page.rect, alpha=False)
    return pix.tobytes("jpeg", jpg_quality=JPEG_QUALITY), pix.width, pix.height


def extract_pages(task):
    path, start, end, out_dir = task
    doc = pymupdf.open(path)
    found = []
    for n in range(start, end):
        page = doc[n]
        infos = page.get_image_info(xrefs=True)
        chars = None
        for table in page.find_tables().tables:
            if table.col_count not in COLUMNS:
                continue
            for row in table.rows:
                if any(c is None for c in row.cells):
                    continue
                cell = pymupdf.Rect(row.cells[1])
                strips = [i for i in infos if i["xref"] and cell.contains(pymupdf.Point(
                    (i["bbox"][0] + i["bbox"][2]) / 2, (i["bbox"][1] + i["bbox"][3]) / 2))
                    and pymupdf.Rect(i["bbox"]).width <= cell.width * 1.2]
                if not strips:
                    continue
                if chars is None:
                    chars = page_chars(page)
                n_id = cell_text(chars, pymupdf.Rect(row.cells[2]))
                if not n_id.isdigit():
                    continue
                strips.sort(key=lambda i: i["bbox"][1])
                found.append((n_id, n + 1, tuple(i["xref"] for i in strips), cell, strips))
    rows = []
    for k, (n_id, page_no, xrefs, cell, strips) in enumerate(found):
        jpeg, w, h = render_photo(doc, cell, strips)
        name = f"{n_id}.{os.getpid()}.{page_no}.{k}.jpg"  # a part can be listed twice on one page
        with open(os.path.join(out_dir, name), "wb") as fh:
            fh.write(jpeg)
        rows.append((n_id, page_no, xrefs, name, w, h, len(jpeg)))
    return os.path.basename(path), rows


def main(pdf_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    files = sorted(glob.glob(os.path.join(pdf_dir, "*.pdf")))
    tasks = []
    for f in files:
        count = pymupdf.open(f).page_count
        tasks += [(f, s, min(s + CHUNK, count), out_dir) for s in range(0, count, CHUNK)]

    by_cat = collections.defaultdict(list)
    with Pool() as pool:
        for i, (name, rows) in enumerate(pool.imap_unordered(extract_pages, tasks), 1):
            by_cat[name] += rows
            print(f"\r{i}/{len(tasks)} lots", end="", flush=True)
    print()

    # Generic pictures: the same image strips on several rows of one catalogue.
    kept, report, generic = {}, [], 0
    for f in files:
        name = os.path.basename(f)
        uses = collections.Counter(x for r in by_cat[name] for x in set(r[2]))
        for n_id, page_no, xrefs, tmp_name, w, h, size in sorted(by_cat[name], key=lambda r: r[1]):
            tmp_path = os.path.join(out_dir, tmp_name)
            if any(uses[x] > 1 for x in xrefs):
                generic += 1
                os.remove(tmp_path)
                continue
            if n_id in kept:  # already found in an earlier catalogue
                os.remove(tmp_path)
                continue
            final = os.path.join(out_dir, n_id + ".jpg")
            os.replace(tmp_path, final)
            kept[n_id] = final
            report.append([n_id, catalogue_name(name), page_no, w, h, size])

    with open(os.path.join(out_dir, "photos.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow(["n_id", "catalogue", "page", "largeur", "hauteur", "octets"])
        w.writerows(report)
    total = sum(r[5] for r in report)
    print(f"photos={len(kept)} generiques_ignorees={generic} taille_totale={total / 1e6:.0f} Mo")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
