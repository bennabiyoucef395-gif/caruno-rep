// Relève les textes français affichés par l'interface (tous les écrans, onglets et fenêtres courantes), pour la traduction arabe.
// Ne garde que les textes qui viennent du code de l'interface (pas les données Dolibarr). Usage : node web/tools/collect-texts.mjs sortie.json
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(resolve(here, '../../app/package.json'))('playwright-core');
const secrets = Object.fromEntries(readFileSync('C:/Users/TRETEC/caruno-data/instances/hanout-vw/test-users.env', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const src = readFileSync(resolve(here, '../index.html'), 'utf8').replace(/&rsquo;/g, '’');
const NUM = /\d+(?:[ \u202f\u00a0.,]\d+)*/g;
const found = new Set();
const fromCode = (t) => { if (src.includes(t)) return true; const parts = t.split('#').map((x) => x.trim()).filter((x) => x.length > 2); return parts.length > 0 && parts.every((x) => src.includes(x)); };

const server = await serve(8086);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
async function grab(p) {
  const texts = await p.evaluate(() => {
    const out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const n = w.currentNode; if (!/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) out.push(n.nodeValue); }
    document.querySelectorAll('[placeholder],[aria-label],[title]').forEach((el) => ['placeholder', 'aria-label', 'title'].forEach((a) => el.getAttribute(a) && out.push(el.getAttribute(a))));
    out.push(document.title);
    return out;
  });
  texts.forEach((t) => { const c = String(t).trim(); if (!c || !/[A-Za-zÀ-ÿ]/.test(c)) return; const k = c.replace(NUM, '#'); if (fromCode(k) || fromCode(c)) found.add(src.includes(c) ? c : k); });
}
const go = async (p, h, wait = 700) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(wait); await grab(p); };
const click = async (p, sel, wait = 500) => { const el = p.locator(sel).first(); if (await el.count() && await el.isVisible().catch(() => false)) { await el.click().catch(() => {}); await p.waitForTimeout(wait); await grab(p); return true; } return false; };
const closeModal = async (p) => { await p.keyboard.press('Escape'); await p.waitForTimeout(200); };

async function session(login, pw) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8086/');
  await grab(p);
  await p.locator('#lg-url').fill('http://localhost:8080');
  await p.locator('#lg-user').fill(login); await p.locator('#pw').fill('mauvais');
  await p.locator('form[data-submit="login"] button[type=submit]').click(); await p.waitForTimeout(1500); await grab(p);
  await p.locator('#pw').fill(pw);
  await p.locator('form[data-submit="login"] button[type=submit]').click();
  await p.waitForSelector('.shell, .pos', { timeout: 60000 }); await p.waitForTimeout(800); await grab(p);
  return p;
}

const g = await session('dev.gerant', secrets.TEST_PW_DEV_GERANT);
const ids = await g.evaluate(() => ({ part: (S.db.parts.find((p) => p.stock['Magasin'] > 0) || S.db.parts[0]).id, client: (S.db.clients.find((c) => !c.fixed) || S.db.clients[0]).id, docs: ['devis', 'commande', 'livraison', 'facture', 'avoir'].map((t) => (S.db.docs.find((d) => d.type === t) || {}).ref).filter(Boolean), unpaid: (S.db.docs.find((d) => d.type === 'facture' && d.status === 'impayee') || {}).ref, po: (S.db.pos[0] || {}).ref }));
for (const h of ['#/tableau', '#/pieces', '#/pieces/' + ids.part, '#/pieces/nouveau', '#/pieces/' + ids.part + '/modifier', '#/catalogue', '#/clients', '#/clients/' + ids.client, '#/clients/nouveau', '#/clients/' + ids.client + '/modifier', '#/ventes/nouveau/devis', '#/ventes/nouveau/commande', '#/achats', '#/achats/nouveau', '#/scanner', '#/utilisateurs', '#/utilisateurs/nouveau', '#/profil', '#/inconnu']) await go(g, h, h === '#/catalogue' ? 3000 : 700);
await go(g, '#/catalogue'); await click(g, 'table.t tbody tr', 2500);
await go(g, '#/pieces/' + ids.part, 1500);
for (const a of ['modalTransfer', 'modalCorrect', 'modalLabel']) { await click(g, '[data-action="' + a + '"]'); await closeModal(g); }
await go(g, '#/pieces'); await click(g, '[data-action="modalImport"]'); await closeModal(g);
await go(g, '#/stock'); for (const t of ['alertes', 'mouvements', 'transfert', 'inventaire']) await click(g, '[data-action="stockTab"][data-arg="' + t + '"]');
await go(g, '#/ventes'); for (const t of ['devis', 'commande', 'livraison', 'facture', 'avoir']) await click(g, '[data-action="ventesTab"][data-arg="' + t + '"]');
for (const r of ids.docs) { await go(g, '#/ventes/' + r, 1200); await click(g, '[data-action="modalPrint"]'); await click(g, '[data-action="printFmt"][data-arg="ticket"]'); await closeModal(g); }
if (ids.unpaid) { await go(g, '#/ventes/' + ids.unpaid, 1200); await click(g, '[data-action="modalPay"]'); await closeModal(g); }
await go(g, '#/clients/' + ids.client); await click(g, '[data-action="modalSettle"]'); await closeModal(g);
await go(g, '#/achats'); await click(g, '[data-action="achatsTab"][data-arg="fournisseurs"]'); await click(g, '[data-action="modalSupplier"]'); await closeModal(g);
if (ids.po) await go(g, '#/achats/' + ids.po, 1000);
await go(g, '#/reglements', 2500); for (const t of ['paiements', 'cheques', 'banque']) await click(g, '[data-action="regTab"][data-arg="' + t + '"]');
await go(g, '#/scanner'); for (const m of ['consult', 'count', 'reception']) await click(g, '[data-action="scanMode"][data-arg="' + m + '"]');
await g.locator('#scan-code').fill('TEST-STK-001'); await g.keyboard.press('Enter'); await g.waitForTimeout(1500); await grab(g);
await click(g, '[data-action="drawer"]');

// Caisse (vendeur) : écrans, menu, fenêtres.
const v = await session('dev.vendeur', secrets.TEST_PW_DEV_VENDEUR);
if (await v.locator('#pos-open').isVisible().catch(() => false)) { await v.locator('#pos-open').fill('10000'); await v.locator('form[data-submit="posOpen"] button[type=submit]').click(); await v.waitForTimeout(800); await grab(v); }
await v.locator('#pos-q').fill('TEST-STK'); await v.waitForTimeout(1800); await grab(v);
await v.keyboard.press('Enter'); await v.waitForTimeout(500); await grab(v);
await v.keyboard.type('120'); await v.keyboard.press('Enter'); await v.keyboard.press('Enter'); await v.waitForTimeout(300); await grab(v);
await click(v, '[data-action="modalPriceOk"]'); await closeModal(v);
await click(v, '[data-action="posInfo"]'); await closeModal(v);
await click(v, '[data-action="modalPosNote"]'); await closeModal(v);
await click(v, '[data-action="posMenu"]'); await click(v, '[data-action="modalCashMove"]'); await closeModal(v);
await click(v, '[data-action="posScreen"][data-arg="customers"]'); await click(v, '[data-action="modalPosClient"]'); await closeModal(v); await click(v, '[data-action="posScreen"][data-arg="products"]');
await click(v, '[data-action="posPay"]'); for (const m of ['cheque', 'virement', 'credit']) await click(v, '[data-action="posPayAdd"][data-arg="' + m + '"]');
await click(v, '[data-action="posScreen"][data-arg="products"]');
await click(v, '[data-action="posScreen"][data-arg="orders"]'); await click(v, '[data-action="posOrdTab"][data-arg="paid"]', 800); await click(v, '[data-action="posScreen"][data-arg="products"]');
await click(v, '[data-action="posMenu"]'); await click(v, '[data-action="posScreen"][data-arg="close"]');
await click(v, '[data-action="posScreen"][data-arg="products"]'); await click(v, '[data-action="lineDel"]');
await go(v, '#/pieces'); await go(v, '#/profil');

await browser.close(); server.close();
const list = [...found].sort();
writeFileSync(process.argv[2], JSON.stringify(list, null, 1));
console.log(list.length + ' textes');
