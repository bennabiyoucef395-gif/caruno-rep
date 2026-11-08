// Purchase prices stay on the server (CARUNO add-on, provisioning/40-caruno-module.sh): checks what each role's own
// login receives from the REST API. Reads only; prints field names and counts, never values or passwords.
//   seller (no "Read supplier prices")  -> no cost field anywhere, empty supplier price lists, sale price still there
//   manager, storekeeper                -> cost fields still sent
// Usage: node provisioning/tests/api-costs.mjs     (default: TEST shop 8081; DOLI_URL / CARUNO_TEST_USERS to change)
import { readFileSync } from 'node:fs';

const API = (process.env.DOLI_URL || 'http://localhost:8081') + '/api/index.php/';
const users = Object.fromEntries(readFileSync(process.env.CARUNO_TEST_USERS || 'C:/Users/TRETEC/caruno-data/instances/test/test-users.env', 'utf8')
  .split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const COST = ['cost_price', 'pmp', 'buyprice', 'buy_price_ht', 'pa_ht', 'marge_tx', 'marque_tx', 'fk_fournprice', 'product_fourn_price_id',
  'fourn_price', 'fourn_unitprice', 'fourn_multicurrency_price', 'fourn_multicurrency_unitprice', 'stats_facture_fournisseur'];
let ok = 0, ko = 0;
const check = (name, cond, detail = '') => { if (cond) { ok++; console.log('OK   ' + name); } else { ko++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); } };
const login = async (u, pw) => { const j = await (await fetch(API + 'login', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ login: u, password: pw }) })).json(); return j.success && j.success.token; };
const get = async (tok, path) => { const r = await fetch(API + path, { headers: { DOLAPIKEY: tok, Accept: 'application/json' } }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, j }; };
// Cost field names found anywhere in an answer.
const found = (o, keys, out = new Set(), d = 0) => { if (o && typeof o === 'object' && d < 12) for (const [k, v] of Object.entries(o)) { if (keys.includes(k)) out.add(k); found(v, keys, out, d + 1); } return out; };

async function answers(tok) {
  const prods = await get(tok, 'products?limit=50&sortfield=t.rowid&sortorder=DESC');
  const one = Array.isArray(prods.j) && prods.j[0] ? await get(tok, 'products/' + prods.j[0].id) : { j: null };
  const inv = await get(tok, 'invoices?limit=20&sortfield=t.rowid&sortorder=DESC');
  const mv = await get(tok, 'stockmovements?limit=20&sortfield=t.rowid&sortorder=DESC');
  const pp = await get(tok, 'products/purchase_prices?limit=20');
  const pp1 = Array.isArray(prods.j) && prods.j[0] ? await get(tok, 'products/' + prods.j[0].id + '/purchase_prices') : { j: [] };
  return { prods, one, inv, mv, pp, pp1 };
}
const size = (x) => (Array.isArray(x) ? x.length : x && typeof x === 'object' ? Object.keys(x).length : 0);

const seller = await login('dev.vendeur', users.TEST_PW_DEV_VENDEUR);
const s = await answers(seller);
check('vendeur : liste des pièces sans prix d\'achat', s.prods.status === 200 && found(s.prods.j, COST).size === 0, [...found(s.prods.j, COST)].join(', '));
check('vendeur : fiche pièce sans prix d\'achat', found(s.one.j, COST).size === 0, [...found(s.one.j, COST)].join(', '));
check('vendeur : lignes de facture sans prix d\'achat ni marge', s.inv.status === 200 && found(s.inv.j, COST).size === 0, [...found(s.inv.j, COST)].join(', '));
check('vendeur : mouvements de stock sans prix', s.mv.status >= 400 || (Array.isArray(s.mv.j) && s.mv.j.every((m) => !('price' in m))), 'status ' + s.mv.status);
check('vendeur : prix fournisseurs vides', size(s.pp.j) === 0 && size(s.pp1.j) === 0, size(s.pp.j) + ' / ' + size(s.pp1.j));
check('vendeur : prix de vente et stock toujours envoyés', Array.isArray(s.prods.j) && s.prods.j.length > 0 && s.prods.j.every((p) => 'price' in p && 'stock_reel' in p && 'price_min' in p));
check('vendeur : les factures gardent leurs montants', Array.isArray(s.inv.j) && s.inv.j.every((f) => 'total_ttc' in f && (f.lines || []).every((l) => 'subprice' in l && 'qty' in l)));

// « Vente à perte » for the seller: the server answers yes / no per line, never the cost.
const post = async (tok, body) => { const r = await fetch(API + 'caruno/belowcost', { method: 'POST', headers: { ...(tok ? { DOLAPIKEY: tok } : {}), 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, j }; };
const fx = (await get(seller, 'products?' + new URLSearchParams({ sqlfilters: "(t.ref:=:'TEST-STK-001')" }))).j;
if (Array.isArray(fx) && fx[0]) {
  const id = Number(fx[0].id);
  const low = await post(seller, { lines: [{ id, price: 1 }] }), high = await post(seller, { lines: [{ id, price: 99999999 }] });
  check('vente à perte : 1 DA signalé sous le prix d\'achat', low.status === 200 && (low.j.below || []).map(Number).includes(id), JSON.stringify(low.j));
  check('vente à perte : prix très haut non signalé', high.status === 200 && (high.j.below || []).length === 0, JSON.stringify(high.j));
  check('vente à perte : réponse oui / non seulement (aucun prix)', JSON.stringify(low.j) === JSON.stringify({ below: [id] }), JSON.stringify(low.j));
  check('vente à perte : 60 lignes au plus par question', (await post(seller, { lines: Array.from({ length: 61 }, () => ({ id, price: 1 })) })).status === 400);
  check('vente à perte : refusé sans connexion', (await post(null, { lines: [{ id, price: 1 }] })).status === 401);
} else check('fixture TEST-STK-001 trouvée', false);

for (const [login_, pwKey, label] of [['dev.gerant', 'TEST_PW_DEV_GERANT', 'gérant'], ['dev.magasinier', 'TEST_PW_DEV_MAGASINIER', 'magasinier']]) {
  const g = await answers(await login(login_, users[pwKey]));
  check(label + ' : prix d\'achat toujours envoyés (pièces)', found(g.prods.j, ['cost_price', 'pmp']).size === 2);
  check(label + ' : prix d\'achat des lignes de facture envoyés (si factures lisibles)', !Array.isArray(g.inv.j) || !g.inv.j.some((f) => (f.lines || []).length) || found(g.inv.j, ['pa_ht']).size === 1);
  check(label + ' : mouvements de stock avec leur prix', g.mv.status >= 400 || (Array.isArray(g.mv.j) && g.mv.j.every((m) => 'price' in m)));
  if (label === 'gérant') check('gérant : prix fournisseurs envoyés', size(g.pp.j) > 0 || size(s.pp.j) === 0, String(size(g.pp.j)));
}
console.log('\n' + ok + ' OK, ' + ko + ' échec(s)');
process.exit(ko ? 1 : 0);
