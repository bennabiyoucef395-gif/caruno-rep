// Construit le fichier du catalogue commun CARUNO à partir de l'export CSV du catalogue fournisseur.
// Le catalogue vit hors de Dolibarr : l'app le consulte pour suggérer les fiches à la création d'une pièce.
// Usage : npm run catalogue [-- <chemin du CSV>]   → public/catalogue/tibao-2025.json (non versionné)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] || 'C:/Users/TRETEC/Documents/bdd pieces auto/export/catalogue-tibao-2025-produits.csv';
const out = resolve(here, '../public/catalogue/tibao-2025.json');

// CSV « ; » avec champs entre guillemets pouvant contenir des retours à la ligne.
function parse(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const rows = parse(readFileSync(src, 'utf8').replace(/^\uFEFF/, ''));
const head = rows.shift().map((h) => h.trim());
const col = (name) => head.indexOf(name);
const C = { ref: col('ref'), label: col('label'), brand: col('brand'), oem: col('oem_ref'), des: col('designation'), veh: col('marques_vehicule') };
const seen = new Set();
const items = [];
for (const r of rows) {
  const ref = (r[C.ref] || '').trim();
  if (!ref || seen.has(ref)) continue;
  seen.add(ref);
  items.push({ i: 'tibao:' + ref, r: ref, l: (r[C.label] || '').trim(), b: (r[C.brand] || '').trim(), o: (r[C.oem] || '').trim(), d: (r[C.des] || '').trim(), v: (r[C.veh] || '').trim() });
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ source: 'TiBAO 2025', version: new Date().toISOString().slice(0, 10), items }));
console.log(items.length + ' pièces → ' + out);
