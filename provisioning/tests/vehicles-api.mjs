// Vehicles API of the CARUNO add-on (dolibarr-modules/caruno, routes caruno/vehicles/...), on the TEST instance.
// Step 1: VIN decoding (PHP port checked against the Python answers, data/vin_cases.json), every search saved,
// the seller's choice saved, the saved list for the admin only. Never prints passwords or tokens.
// Usage: node provisioning/tests/vehicles-api.mjs
//   Without Node on Windows: docker run --rm -v <repo>:/repo:ro -v C:/Users/TRETEC/caruno-data/instances/test:/inst:ro
//     -e DOLI_URL=http://host.docker.internal:8081 -e CARUNO_TEST_USERS=/inst/test-users.env -e CARUNO_INSTANCE_ENV=/inst/instance.env
//     -e VIN_CASES=/repo/dolibarr-modules/caruno/data/vin_cases.json node:22-alpine node /repo/provisioning/tests/vehicles-api.mjs
import { readFileSync } from 'node:fs';

const API = (process.env.DOLI_URL || 'http://localhost:8081') + '/api/index.php/';
const env = (f) => Object.fromEntries(readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l))
  .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const users = env(process.env.CARUNO_TEST_USERS || 'C:/Users/TRETEC/caruno-data/instances/test/test-users.env');
const inst = env(process.env.CARUNO_INSTANCE_ENV || 'C:/Users/TRETEC/caruno-data/instances/test/instance.env');
const cases = JSON.parse(readFileSync(process.env.VIN_CASES || new URL('../../dolibarr-modules/caruno/data/vin_cases.json', import.meta.url), 'utf8'));

let ok = 0, ko = 0;
const check = (name, cond, detail = '') => { if (cond) { ok++; console.log('OK   ' + name); } else { ko++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); } };
const login = async (u, pw) => { const j = await (await fetch(API + 'login', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ login: u, password: pw }) })).json(); return j.success && j.success.token; };
const call = async (tok, method, path, body) => {
  const r = await fetch(API + path, { method, headers: { ...(tok ? { DOLAPIKEY: tok } : {}), 'Content-Type': 'application/json', Accept: 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {} return { status: r.status, j };
};

const seller = await login('dev.vendeur', users.TEST_PW_DEV_VENDEUR);
const admin = await login(inst.DOLI_ADMIN_LOGIN || 'admin', inst.DOLI_ADMIN_PASSWORD);
check('connexion vendeur et admin', !!seller && !!admin);

// ---- 1. POST vehicles/decode
check('decode : sans connexion -> 401', (await call(null, 'POST', 'caruno/vehicles/decode', { vin: cases[0].vin })).status === 401);
const ids = [];
const res = {};
for (const c of cases) {
  const r = await call(seller, 'POST', 'caruno/vehicles/decode', { vin: c.input });
  res[c.input] = r;
  const j = r.j || {};
  if (j.lookup_id) ids.push(j.lookup_id);
  const keys = (j.candidates || []).map((x) => x.model_key).sort();
  const same = r.status === 200 && j.vin === c.vin && j.valid === c.valid && (j.maker || null) === c.maker
    && JSON.stringify(j.years || []) === JSON.stringify(c.years) && j.level === c.level && (j.year || null) === c.year
    && JSON.stringify(keys) === JSON.stringify(c.candidates);
  check(`decode « ${c.input} » = Python (${c.maker || 'inconnu'}, ${c.level}, ${c.candidates.length} modèle(s))`, same,
    `status ${r.status} ${JSON.stringify({ vin: j.vin, maker: j.maker, years: j.years, level: j.level, year: j.year, keys }).slice(0, 300)}`);
}
const golf = res.WVWZZZAUZFW123456.j || {};
check('Golf 7 : niveau exact, année 2015, libellé lisible', golf.level === 'exact' && golf.year === 2015 && /Golf 7/.test((golf.candidates || [])[0]?.label || ''));
const w204 = res.WDD2040081A123456.j || {};
check('W204 : Classe C W204 trouvée par le code Mercedes', w204.level === 'exact' && (w204.candidates || [])[0]?.model_key === 'MERCEDES-BENZ|Classe C|W204');
const ark = res.VF1RJL00067123456.j || {};
check('Renault Arkana : Renault reconnu, pas de modèle catalogue, choix manuel VehiclesDB (renault/arkana)',
  ark.maker === 'RENAULT' && ark.level === 'none' && ark.manual?.make?.id === 'renault' && (ark.manual.models || []).some((m) => m.vdb_model_id === 'renault/arkana'));
const unk = res.LB2ABCDE1F1234567.j || {};
check('constructeur inconnu : liste de toutes les marques pour le choix manuel', unk.level === 'none' && (unk.manual?.makes || []).length > 300);
const short = res.WVWZZZAUZFW12345.j || {};
check('VIN de 16 caractères : refusé avec un message, mais la recherche est enregistrée', short.valid === false && /17 caractères/.test((short.errors || [])[0] || '') && short.lookup_id > 0);
check('decode : client inconnu -> 400', (await call(seller, 'POST', 'caruno/vehicles/decode', { vin: cases[0].vin, customer_id: 999999999 })).status === 400);

// ---- 1b. POST vehicles/decode/{id}/choice
const gm = (golf.candidates || [])[0] || {};
const ch1 = await call(seller, 'POST', `caruno/vehicles/decode/${golf.lookup_id}/choice`, { model_id: gm.model_id, vehicle_type_id: null });
check('choix : Golf 7 + « Je ne sais pas » enregistré', ch1.status === 200 && ch1.j.model_key === 'VW|Golf 7|' && ch1.j.engine === null && ch1.j.engine_unknown === true, JSON.stringify(ch1.j));
const ch2 = await call(seller, 'POST', `caruno/vehicles/decode/${golf.lookup_id}/choice`, { model_id: gm.model_id, vehicle_type_id: 999999 });
check('choix : moteur qui n\'est pas de ce modèle -> 400', ch2.status === 400);
const ch3 = await call(seller, 'POST', `caruno/vehicles/decode/${ark.lookup_id}/choice`, { vdb_model_id: 'renault/arkana' });
check('choix : Renault Arkana (VehiclesDB) enregistré', ch3.status === 200 && ch3.j.vdb_model_id === 'renault/arkana', JSON.stringify(ch3.j));
check('choix : recherche inconnue -> 404', (await call(seller, 'POST', 'caruno/vehicles/decode/999999999/choice', { model_id: gm.model_id })).status === 404);

// ---- saved searches (admin)
check('liste des recherches : refusée au vendeur (403)', (await call(seller, 'GET', 'caruno/vehicles/lookups')).status === 403);
const list = await call(admin, 'GET', 'caruno/vehicles/lookups?limit=100');
const mine = Array.isArray(list.j) ? list.j.filter((l) => ids.includes(Number(l.id))) : [];
check(`chaque recherche est enregistrée (${ids.length} recherches de ce test)`, list.status === 200 && mine.length === cases.length, `${mine.length}/${cases.length}`);
const lg = mine.find((l) => Number(l.id) === golf.lookup_id) || {};
check('recherche Golf 7 : vendeur, niveau, choix « Je ne sais pas » gardés', lg.seller === 'dev.vendeur' && lg.level === 'exact' && /Golf 7/.test(lg.chosen_model_label || '') && Number(lg.chosen_engine_unknown) === 1);
const la = mine.find((l) => Number(l.id) === ark.lookup_id) || {};
check('recherche Arkana : constructeur RENAULT, choix VehiclesDB gardé', la.maker === 'RENAULT' && la.chosen_vdb_model === 'renault/arkana');
const ls = mine.find((l) => Number(l.id) === short.lookup_id) || {};
check('recherche invalide gardée telle que tapée (valid = 0)', Number(ls.valid) === 0 && ls.vin === 'WVWZZZAUZFW12345');

// ---- 2. GET models/{id}/engines
const eng = await call(seller, 'GET', `caruno/models/${gm.model_id}/engines`);
const labels = Array.isArray(eng.j) ? eng.j.map((o) => o.label) : [];
check('moteurs Golf 7 : 2.0 TDI proposé, « Je ne sais pas » en dernier (vehicle_type_id null)',
  eng.status === 200 && labels.includes('2.0 TDI (diesel)') && labels.at(-1) === 'Je ne sais pas' && eng.j.at(-1).vehicle_type_id === null, labels.join(' | '));
check('moteurs : modèle inconnu -> 404', (await call(seller, 'GET', 'caruno/models/999999/engines')).status === 404);
const tdi = (eng.j || []).find((o) => o.label === '2.0 TDI (diesel)') || {};
const wm = (w204.candidates || [])[0] || {};
const wEng = await call(seller, 'GET', `caruno/models/${wm.model_id}/engines`);
const otherVt = (wEng.j || []).find((o) => o.vehicle_type_id)?.vehicle_type_id;

// ---- 3. POST / GET customers/{id}/vehicles (test customer, created once, found by name)
const NAME = 'TEST VEHICULES (tests API)';
let cust = (await call(admin, 'GET', 'thirdparties?' + new URLSearchParams({ sqlfilters: `(t.nom:=:'${NAME}')`, limit: 1 }))).j;
let cid = Array.isArray(cust) && cust[0] ? Number(cust[0].id) : null;
if (!cid) cid = Number((await call(admin, 'POST', 'thirdparties', { name: NAME, client: 1, code_client: -1 })).j);
check('client de test disponible', cid > 0);
const before = (await call(seller, 'GET', `caruno/customers/${cid}/vehicles`)).j || [];
const look = (await call(seller, 'POST', 'caruno/vehicles/decode', { vin: 'WVWZZZAUZFW123456', customer_id: cid })).j;
const v1 = await call(seller, 'POST', `caruno/customers/${cid}/vehicles`,
  { vin: 'WVWZZZAUZFW123456', model_id: gm.model_id, vehicle_type_id: tdi.vehicle_type_id, production_date: '2015-06', lookup_id: look.lookup_id });
check('véhicule : Golf 7 2.0 TDI enregistré (VIN, date 2015-06-01, ids du catalogue)', v1.status === 200 && v1.j.model_key === 'VW|Golf 7|'
  && v1.j.engine === '2.0 TDI' && v1.j.vehicle_type_id === tdi.vehicle_type_id && v1.j.model_id === gm.model_id
  && v1.j.production_date === '2015-06-01' && v1.j.vin === 'WVWZZZAUZFW123456' && v1.j.in_catalogue === true, JSON.stringify(v1.j));
const v2 = await call(seller, 'POST', `caruno/customers/${cid}/vehicles`, { vin: 'WDD2040081A123456', model_id: wm.model_id, production_date: '2010' });
check('véhicule : W204 avec « Je ne sais pas » (moteur NULL)', v2.status === 200 && v2.j.engine === null && v2.j.engine_unknown === true
  && v2.j.vehicle_type_id === null && v2.j.model_id === wm.model_id, JSON.stringify(v2.j));
const v3 = await call(seller, 'POST', `caruno/customers/${cid}/vehicles`, { vin: 'VF1RJL00067123456', vdb_model_id: 'renault/arkana', production_date: '2021-03-15' });
check('véhicule : Renault Arkana (VehiclesDB, hors catalogue)', v3.status === 200 && v3.j.vdb_model_id === 'renault/arkana'
  && v3.j.in_catalogue === false && v3.j.model_id === null && /Renault Arkana/.test(v3.j.model_label), JSON.stringify(v3.j));
check('véhicule : VIN invalide -> 400', (await call(seller, 'POST', `caruno/customers/${cid}/vehicles`, { vin: 'ABC', model_id: gm.model_id })).status === 400);
check('véhicule : date invalide -> 400', (await call(seller, 'POST', `caruno/customers/${cid}/vehicles`, { model_id: gm.model_id, production_date: '2015-13' })).status === 400);
check('véhicule : moteur d\'un autre modèle -> 400', !otherVt || (await call(seller, 'POST', `caruno/customers/${cid}/vehicles`, { model_id: gm.model_id, vehicle_type_id: otherVt })).status === 400);
check('véhicule : ni modèle ni VehiclesDB -> 400', (await call(seller, 'POST', `caruno/customers/${cid}/vehicles`, { vin: 'WVWZZZAUZFW123456' })).status === 400);
check('véhicule : client inconnu -> 404', (await call(seller, 'POST', 'caruno/customers/999999999/vehicles', { model_id: gm.model_id })).status === 404);
const after = (await call(seller, 'GET', `caruno/customers/${cid}/vehicles`)).j || [];
check('liste des véhicules du client : +3, le plus récent en premier', after.length === before.length + 3 && after[0].id === v3.j.id, `${before.length} -> ${after.length}`);
const lk = ((await call(admin, 'GET', 'caruno/vehicles/lookups?limit=20')).j || []).find((l) => Number(l.id) === look.lookup_id) || {};
check('la recherche du VIN reçoit le client et le choix (Golf 7 2.0 TDI)', Number(lk.customer_id) === cid && lk.chosen_engine === '2.0 TDI');

// ---- 4. GET vehicles/{id}/parts — two Golf 7 brake parts published with stock for the test, restored afterwards.
const COST = ['cost_price', 'pmp', 'buyprice', 'buy_price_ht', 'pa_ht', 'fourn_price', 'stock', 'stock_reel', 'qty'];
const keysIn = (o, out = new Set()) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.add(k); keysIn(v, out); } return out; };
const prod = async (ref) => ((await call(admin, 'GET', 'products?' + new URLSearchParams({ sqlfilters: `(t.ref:=:'${ref}')`, limit: 1 }))).j || [])[0];
const FIX = [{ ref: '395351', price: 4500, qty: 2 }, { ref: '391351', price: 0, qty: 1 }];   // pads (price), disc ("Sur devis")
const saved = [];
try {
  for (const f of FIX) {
    const pr = await prod(f.ref);
    if (!pr) continue;
    // Prices by level are on (PRODUIT_MULTIPRICES): the public price is level 1, written like the counter app does.
    saved.push({ ...f, id: Number(pr.id), price0: Number(pr.price) || 0, mp0: Number(pr.multiprices?.['1'] ?? pr.price) || 0,
      enl0: pr.array_options?.options_en_ligne ?? null });
    await call(admin, 'PUT', `products/${pr.id}`, { price: f.price, price_base_type: 'HT', multiprices: { 1: f.price }, multiprices_base_type: { 1: 'HT' },
      array_options: { options_en_ligne: 1 } });
    await call(admin, 'POST', 'stockmovements', { product_id: Number(pr.id), warehouse_id: 1, qty: f.qty, movementlabel: 'Test API véhicules (temporaire)' });
  }
  check('2 pièces de frein Golf 7 publiées avec stock pour le test', saved.length === 2);

  const p1 = await call(seller, 'GET', `caruno/vehicles/${v1.j.id}/parts?` + new URLSearchParams({ category: 'Freinage' }));
  const byRef = Object.fromEntries((p1.j?.parts || []).map((x) => [x.ref, x]));
  check('pièces Golf 7 2.0 TDI / Freinage : seulement les pièces en stock et publiées (2)', p1.status === 200 && (p1.j.parts || []).length === 2, JSON.stringify(Object.keys(byRef)));
  check('plaquettes : « Compatible (modèle) », prix fixe 4500, OEM listés', byRef['395351']?.label === 'Compatible (modèle)'
    && byRef['395351']?.shops?.[0]?.price_mode === 'fixe' && Number(byRef['395351'].shops[0].price) === 4500 && byRef['395351'].oem.length > 0, JSON.stringify(byRef['395351']));
  check('disque sans prix : « Sur devis »', byRef['391351']?.shops?.[0]?.price_mode === 'sur_devis' && byRef['391351'].shops[0].price === null && byRef['391351'].shops[0].price_label === 'Sur devis');
  check('ni stock exact ni prix d\'achat dans la réponse', ![...keysIn(p1.j)].some((k) => COST.includes(k)), [...keysIn(p1.j)].filter((k) => COST.includes(k)).join(', '));
  const pAll = await call(seller, 'GET', `caruno/vehicles/${v1.j.id}/parts?` + new URLSearchParams({ category: 'Freinage', all: 1 }));
  const allRef = Object.fromEntries((pAll.j?.parts || []).map((x) => [x.ref, x]));
  check('all=1 : aussi les pièces sans magasin (boutiques vides)', (pAll.j?.parts || []).length > 2 && Array.isArray(allRef['422835']?.shops) && allRef['422835'].shops.length === 0);
  check('pièce citée pour ce moteur : « Compatible (moteur) » (tuyau de servo-frein 2.0 TDI)', allRef['413204']?.label === 'Compatible (moteur)', JSON.stringify(allRef['413204']));

  const vU = await call(seller, 'POST', `caruno/customers/${cid}/vehicles`, { model_id: gm.model_id });
  const pU = await call(seller, 'GET', `caruno/vehicles/${vU.j.id}/parts?` + new URLSearchParams({ category: 'Filtre à huile', all: 1 }));
  check('Golf 7 « Je ne sais pas » / filtres à huile : aucun listé, 2 « précisez le moteur »', pU.status === 200 && pU.j.parts.length === 0
    && pU.j.engine_needed === 2 && /Précisez le moteur/.test(pU.j.message || ''), JSON.stringify(pU.j).slice(0, 300));
  const pT = await call(seller, 'GET', `caruno/vehicles/${v1.j.id}/parts?` + new URLSearchParams({ category: 'Filtre à huile', all: 1 }));
  check('Golf 7 2.0 TDI / filtres à huile : aucun (les 2 filtres sont pour 1.2 / 1.4 TSI)', pT.status === 200 && pT.j.parts.length === 0 && pT.j.engine_needed === 0);
  const pW = await call(seller, 'GET', `caruno/vehicles/${v2.j.id}/parts?all=1`);
  check('W204 « Je ne sais pas » : liste sans pièce dépendante du moteur « Compatible »', pW.status === 200
    && (pW.j.parts || []).every((x) => x.status !== 'moteur_requis') && pW.j.engine_needed >= 0, `${(pW.j?.parts || []).length} pièces, ${pW.j?.engine_needed} à préciser`);
  const pA = await call(seller, 'GET', `caruno/vehicles/${v3.j.id}/parts?all=1`);
  check('Renault Arkana : liste vide, pas d\'erreur', pA.status === 200 && Array.isArray(pA.j.parts) && pA.j.parts.length === 0 && pA.j.vehicle.in_catalogue === false, JSON.stringify(pA.j).slice(0, 200));
  check('pièces : véhicule inconnu -> 404', (await call(seller, 'GET', 'caruno/vehicles/999999999/parts')).status === 404);
} finally {
  for (const s of saved) {   // back to the state before the test
    await call(admin, 'POST', 'stockmovements', { product_id: s.id, warehouse_id: 1, qty: -s.qty, movementlabel: 'Test API véhicules (retour)' });
    await call(admin, 'PUT', `products/${s.id}`, { price: s.price0, price_base_type: 'HT', multiprices: { 1: s.mp0 }, multiprices_base_type: { 1: 'HT' },
      array_options: { options_en_ligne: s.enl0 } });
  }
  const back = await Promise.all(FIX.map((f) => prod(f.ref)));
  check('pièces de test remises comme avant (stock, publication, prix)', back.every((p, i) => !p || ((Number(p.stock_reel) || 0) === 0
    && !Number(p.array_options?.options_en_ligne) && (Number(p.price) || 0) === (saved[i]?.price0 ?? 0))),
    JSON.stringify(back.map((p) => p && { s: p.stock_reel, e: p.array_options?.options_en_ligne, p: p.price })));
}

console.log(`\n${ok} OK, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
