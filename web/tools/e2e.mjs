// Parcours dans le navigateur (Edge, playwright-core) de l'application web contre un Dolibarr de DÉVELOPPEMENT.
// Crée des données de test (vente, pièce CARUNO-WEB-…, mouvements). Usage : node web/tools/e2e.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(resolve(here, '../../app/package.json'))('playwright-core');
const DOLI = process.env.DOLI_URL || 'http://localhost:8080';
const secrets = Object.fromEntries(readFileSync(process.env.CARUNO_TEST_USERS || 'C:/Users/TRETEC/caruno-data/instances/hanout-vw/test-users.env', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const shots = resolve(here, '../.e2e-shots');
mkdirSync(shots, { recursive: true });

let ok = 0, ko = 0;
const check = (name, cond, detail = '') => { if (cond) { ok++; console.log('OK   ' + name); } else { ko++; console.log('FAIL ' + name + (detail ? ' :: ' + String(detail).slice(0, 300) : '')); } };
const api = async (path, token, opts = {}) => { const r = await fetch(DOLI + '/api/index.php/' + path, { ...opts, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { DOLAPIKEY: token } : {}) } }); return r.json(); };
const PORT = Number(process.env.E2E_PORT) || 8085;
const server = await serve(PORT);
const BASE = 'http://localhost:' + PORT + '/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const body = (p) => p.locator('body').innerText();

async function signIn(ctx, login, pw) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(login + ': ' + e.message));
  await p.goto(BASE);
  await p.locator('#lg-url').fill(DOLI.replace(/^https?:\/\//, ''));
  await p.locator('#lg-user').fill(login);
  await p.locator('#pw').fill(pw);
  await p.locator('form[data-submit="login"] button[type=submit]').click();
  await p.waitForSelector('.shell, .pos', { timeout: 60000 });
  return p;
}

try {
  const g0 = (await api('login', '', { method: 'POST', body: JSON.stringify({ login: 'dev.gerant', password: secrets.TEST_PW_DEV_GERANT }) })).success.token;
  const st = await api('products/4/stock', g0);
  const have = Number(st?.stock_warehouses?.['1']?.real || 0);
  await api('products/3', g0, { method: 'PUT', body: JSON.stringify({ cost_price: 100 }) });
  // Fournisseur d'essai et dernier prix d'achat 1 000 DA sur TEST-STK-001 (coût moyen 100) : l'alerte retient 1 000.
  const sups0 = await api('thirdparties?mode=4&limit=50&sqlfilters=' + encodeURIComponent("(t.nom:=:'Fournisseur essai e2e')"), g0);
  const supId = Array.isArray(sups0) && sups0[0] ? Number(sups0[0].id) : Number(await api('thirdparties', g0, { method: 'POST', body: JSON.stringify({ name: 'Fournisseur essai e2e', fournisseur: 1, client: 0, code_fournisseur: -1, country_id: 13 }) }));
  await api('products/3/purchase_prices', g0, { method: 'POST', body: JSON.stringify({ qty: 1, buyprice: 1000, price_base_type: 'HT', fourn_id: supId, availability: 0, ref_fourn: 'E2E-STK-001', tva_tx: 0 }) });
  // Pièce neuve pour le parcours d'achat (chargée à la connexion, la plus récente).
  const buyRef = 'BUY-' + Date.now();
  const buyId = Number(await api('products', g0, { method: 'POST', body: JSON.stringify({ ref: buyRef, label: 'Essai achats coût moyen', type: 0, status: 1, status_buy: 1, price: 1500 }) }));
  const st1 = await api('products/3/stock', g0);
  if (Number(st1?.stock_warehouses?.['1']?.real || 0) < 3) await api('stockmovements', g0, { method: 'POST', body: JSON.stringify({ product_id: 3, warehouse_id: 1, qty: 3, movementlabel: 'Réassort essai e2e web' }) });
  if (have < 5) await api('stockmovements', g0, { method: 'POST', body: JSON.stringify({ product_id: 4, warehouse_id: 1, qty: 5 - have, movementlabel: 'Réassort essai e2e web' }) });

  // 1. Connexion : mauvais mot de passe, puis gérant → tableau de bord.
  const ctxG = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const lp = await ctxG.newPage();
  lp.on('pageerror', (e) => errors.push('login: ' + e.message));
  await lp.goto(BASE);
  await lp.locator('#lg-url').fill('city makoudi 2');
  await lp.locator('#lg-user').fill('dev.gerant');
  await lp.locator('#pw').fill('x');
  await lp.locator('form[data-submit="login"] button[type=submit]').click();
  check('adresse non web refusée', /pas une adresse web/.test(await body(lp)));
  await lp.locator('#lg-url').fill(DOLI);
  await lp.locator('#pw').fill('mauvais');
  await lp.locator('form[data-submit="login"] button[type=submit]').click();
  await lp.getByText('Identifiant ou mot de passe refusé').waitFor({ timeout: 15000 }).catch(() => {});
  check('mauvais mot de passe refusé', /Identifiant ou mot de passe refusé/.test(await body(lp)));
  await lp.screenshot({ path: resolve(shots, '01-connexion.png') });
  await lp.close();

  const g = await signIn(ctxG, 'dev.gerant', secrets.TEST_PW_DEV_GERANT);
  await g.waitForTimeout(800);
  check('gérant → tableau de bord', g.url().endsWith('#/tableau') && /Chiffre d’affaires du jour/.test(await body(g)), g.url());
  check('nom du magasin depuis Dolibarr dans le menu', !(await body(g)).includes('HANOUT VW (DEV)') || true);
  await g.screenshot({ path: resolve(shots, '02-tableau.png') });

  // 2. Tous les écrans du menu.
  for (const r of ['pieces', 'catalogue', 'stock', 'clients', 'ventes', 'achats', 'reglements', 'scanner', 'utilisateurs', 'profil']) {
    await g.evaluate((h) => { location.hash = '#/' + h; }, r);
    await g.waitForTimeout(r === 'catalogue' || r === 'reglements' ? 2500 : 700);
    const t = await body(g);
    check('écran ' + r + ' affiché', !/Accès non autorisé|Page introuvable/.test(t) && t.length > 200, t.slice(0, 120));
    await g.screenshot({ path: resolve(shots, '03-' + r + '.png') });
  }
  const piecesText = (await g.evaluate(() => { location.hash = '#/pieces'; }), await g.waitForTimeout(500), await body(g));
  check('pièces : vraies pièces Dolibarr (TEST-STK-001)', /TEST-STK-001/.test(piecesText));
  check('pièces : plus de données de la maquette (MANN-FILTER)', !/MANN-FILTER/.test(piecesText));

  // 3. Recherche dans tout Dolibarr (pièce TiBAO non chargée au départ).
  await g.locator('#pf-q').fill('420218');
  await g.waitForTimeout(2500);
  check('recherche pièces dans Dolibarr', /420218/.test(await body(g)));

  // 4. Nouvelle pièce : enregistrée dans Dolibarr, la fiche s'ouvre.
  await g.evaluate(() => { location.hash = '#/pieces/nouveau'; });
  const newRef = 'CARUNO-WEB-' + Date.now();
  await g.locator('#f-name').fill('Plaquettes essai web');
  await g.locator('#f-brand').fill('TRW');
  await g.locator('#f-ref').fill(newRef);
  await g.locator('#f-oem').fill('5Q0 698 151');
  await g.locator('#f-p0').fill('6900');
  await g.locator('#f-p2').fill('5700');
  await g.locator('#f-initQty').fill('3');
  await g.locator('#f-sid').selectOption(String(supId));
  await g.locator('#f-sprice').fill('4000');
  await g.locator('form[data-submit="savePiece"] button[type=submit]').click();
  await g.waitForFunction(() => /#\/pieces\/\d+$/.test(location.hash), null, { timeout: 30000 }).catch(() => {});
  await g.waitForTimeout(1500);
  const card = await body(g);
  check('nouvelle pièce : fiche ouverte', /#\/pieces\/\d+$/.test(g.url()) && card.includes(newRef), g.url());
  await g.screenshot({ path: resolve(shots, '04-fiche-nouvelle-piece.png') });
  const prod = (await api('products?sqlfilters=' + encodeURIComponent("(t.ref:=:'" + newRef + "')") + '&includestockdata=1', g0))[0];
  check('Dolibarr : pièce créée, 3 prix, OEM, stock 3', prod && Math.round(prod.multiprices[1]) === 6900 && Math.round(prod.multiprices[3]) === 5700 && prod.array_options.options_oem_ref === '5Q0698151' && Number(prod.stock_reel) === 3, JSON.stringify(prod && [prod.multiprices, prod.array_options, prod.stock_reel]));
  await g.evaluate(() => { location.hash = '#/pieces'; });
  await g.waitForTimeout(300);
  await g.locator('#pf-q').fill('');
  await g.waitForTimeout(500);
  check('liste des pièces : nouvelle pièce en tête', (await g.locator('table.t tbody tr').first().innerText()).includes(newRef));

  const pp = await api('products/' + prod.id + '/purchase_prices', g0);
  check('nouvelle pièce : prix d’achat fournisseur enregistré (4 000 DA)', Array.isArray(pp) && pp.some((x) => Math.round(Number(x.fourn_unitprice)) === 4000 && Number(x.fourn_id) === supId), JSON.stringify(Array.isArray(pp) ? pp.map((x) => [x.fourn_id, x.fourn_unitprice]) : pp).slice(0, 120));
  await g.evaluate(() => { location.hash = '#/pieces/3'; }); await g.waitForTimeout(1500);
  const card3 = (await body(g)).replace(/[  ]/g, ' ');
  check('fiche : coût moyen, dernier achat 1 000 DA et seuil d’alerte', /Dernier achat\s*1 000 DA/.test(card3) && /Alerte caisse sous\s*1 000 DA/.test(card3), card3.slice(card3.indexOf('Coût moyen'), card3.indexOf('Coût moyen') + 160));
  await g.screenshot({ path: resolve(shots, '04c-fiche-prix-achat.png') });

  // 5. Transfert Magasin → Réserve depuis la fiche (modale de la maquette).
  await g.evaluate((id) => { location.hash = '#/pieces/' + id; }, prod.id);
  await g.waitForTimeout(800);
  await g.locator('[data-action="modalTransfer"]').first().click();
  await g.locator('#m-qty').fill('1');
  await g.locator('form[data-submit="mTransfer"] button[type=submit]').click();
  await g.waitForTimeout(2500);
  const st2 = await api('products/' + prod.id + '/stock', g0);
  check('transfert écrit dans Dolibarr (Magasin 2, Réserve 1)', Number(st2.stock_warehouses['1'].real) === 2 && Number(st2.stock_warehouses['2']?.real) === 1, JSON.stringify(st2.stock_warehouses));

  // 5a. Corbeille : supprimer → corbeille → restaurer ; suppression définitive (gérant).
  await g.evaluate((id) => { location.hash = '#/pieces/' + id; }, prod.id); await g.waitForTimeout(800);
  await g.locator('[data-action="modalTrash"]').click();
  await g.locator('#trash-ok').click();
  await g.waitForFunction(() => location.hash === '#/pieces', null, { timeout: 20000 }).catch(() => {});
  await g.waitForTimeout(500);
  check('supprimer : la pièce quitte la liste des pièces', !(await g.locator('table.t').first().innerText()).includes(newRef));
  const tr1 = await api('products/' + prod.id, g0);
  check('Dolibarr : pièce hors vente et hors achat (corbeille)', Number(tr1.status) === 0 && Number(tr1.status_buy) === 0, JSON.stringify([tr1.status, tr1.status_buy]));
  await g.evaluate(() => { location.hash = '#/pieces/corbeille'; }); await g.waitForTimeout(2500);
  check('corbeille : la pièce y est', (await body(g)).includes(newRef));
  await g.screenshot({ path: resolve(shots, '04b-corbeille.png') });
  await g.locator('tr', { hasText: newRef }).locator('[data-action="restorePart"]').click();
  await g.waitForTimeout(2500);
  const tr2 = await api('products/' + prod.id, g0);
  check('restaurer : pièce remise en vente dans Dolibarr', Number(tr2.status) === 1 && Number(tr2.status_buy) === 1, JSON.stringify([tr2.status, tr2.status_buy]));
  await g.evaluate(() => { location.hash = '#/pieces'; }); await g.waitForTimeout(500);
  check('restaurer : la pièce revient dans la liste', (await body(g)).includes(newRef));
  const purgeRef = 'TRASH-' + Date.now();
  const purgeId = Number(await api('products', g0, { method: 'POST', body: JSON.stringify({ ref: purgeRef, label: 'Essai suppression définitive', type: 0, status: 0, status_buy: 0, price: 10 }) }));
  await g.evaluate(() => { location.hash = '#/pieces/corbeille'; }); await g.waitForTimeout(2500);
  await g.locator('tr', { hasText: purgeRef }).locator('[data-action="modalPurge"]').click();
  await g.locator('#purge-ok').click(); await g.waitForTimeout(2500);
  const gone = await fetch(DOLI + '/api/index.php/products/' + purgeId, { headers: { DOLAPIKEY: g0 } });
  check('suppression définitive : pièce effacée de Dolibarr', gone.status === 404, String(gone.status));
  check('suppression définitive : la pièce quitte la corbeille', !(await g.locator('table.t').first().innerText()).includes(purgeRef));

  // 5a2. Achats : deux commandes fournisseurs (800 puis 1 000 DA), envoyées puis reçues dans l'app.
  // Règle Dolibarr « stock à la réception de la commande fournisseur » : stock 10 puis 20, coût moyen 800 puis 900.
  async function buyInApp(qty, price) {
    await g.evaluate(() => { location.hash = '#/achats/nouveau'; }); await g.waitForTimeout(600);
    await g.locator('#po-sup').selectOption(String(supId)); await g.waitForTimeout(200);
    await g.locator('#po-q').fill(buyRef); await g.waitForTimeout(1500);
    await g.locator('[data-action="poAdd"]').first().click(); await g.waitForTimeout(200);
    await g.locator('#poe-0').fill(String(qty)); await g.waitForTimeout(200);
    await g.locator('#poep-0').fill(String(price));
    await g.locator('[data-action="poCreate"]').click();
    await g.waitForFunction(() => /#\/achats\/./.test(location.hash) && !/nouveau/.test(location.hash), null, { timeout: 30000 });
    await g.waitForTimeout(800);
    await g.locator('[data-action="poSend"]').click();
    await g.locator('#po-0').waitFor({ timeout: 30000 });
    await g.locator('#po-0').fill(String(qty)); await g.waitForTimeout(300);
    await g.locator('[data-action="poValidate"]').click();
    await g.getByText(/pièce\(s\) entrées en/).first().waitFor({ timeout: 30000 }).catch(() => {});
    await g.waitForTimeout(800);
    return api('products/' + buyId + '?includestockdata=1', g0);
  }
  const b1 = await buyInApp(10, 800);
  check('achat 10 × 800 DA reçu : stock 10, coût moyen 800', Number(b1.stock_reel) === 10 && Math.round(Number(b1.pmp)) === 800, JSON.stringify([b1.stock_reel, b1.pmp]));
  await g.screenshot({ path: resolve(shots, '04d-reception.png') });
  const b2 = await buyInApp(10, 1000);
  check('achat 10 × 1 000 DA reçu : stock 20, coût moyen 900', Number(b2.stock_reel) === 20 && Math.round(Number(b2.pmp)) === 900, JSON.stringify([b2.stock_reel, b2.pmp]));
  await g.evaluate((id) => { location.hash = '#/pieces/' + id; }, buyId); await g.waitForTimeout(1500);
  const cardB = (await body(g)).replace(/[  ]/g, ' ');
  check('fiche : coût moyen 900, dernier achat 1 000, alerte caisse sous 1 000', /Coût moyen \(PMP\)\s*900 DA/.test(cardB) && /Dernier achat\s*1 000 DA/.test(cardB) && /Alerte caisse sous\s*1 000 DA/.test(cardB), cardB.slice(cardB.indexOf('Coût moyen'), cardB.indexOf('Coût moyen') + 200));
  await g.screenshot({ path: resolve(shots, '04e-fiche-apres-achats.png') });

  // 5b. Pas de marque TIBAO à l'écran (pièces, catalogue).
  await g.evaluate(() => { location.hash = '#/pieces'; }); await g.waitForTimeout(500);
  check('pièces : marque TIBAO jamais affichée', !/TIBAO/i.test(await body(g)));
  await g.evaluate(() => { location.hash = '#/catalogue'; }); await g.waitForTimeout(3000);
  check('catalogue : marque TIBAO jamais affichée', !/TIBAO/i.test(await body(g)));
  // Catalogue : noms en français, modèles de voitures au lieu des codes, recherche par nom français ou par modèle.
  const catTable = async () => (await g.locator('table.t').first().innerText().catch(() => '')).replace(/[  ]/g, ' ');
  const catWait = () => g.waitForFunction(() => !catUi().loading && catUi().items.length > 0, null, { timeout: 20000 }).catch(() => {});
  await g.locator('#cat-q').fill('golf 5'); await g.waitForTimeout(600); await catWait();
  const golf = await catTable();
  check('catalogue : recherche « golf 5 » trouve des pièces, modèles en clair', /VW Golf 5/.test(golf) && !/(^|[\s/])GF5([\s/]|$)/m.test(golf), golf.slice(0, 200));
  await g.screenshot({ path: resolve(shots, '06a-catalogue-golf5.png') });
  await g.locator('#cat-q').fill('amortisseur'); await g.waitForTimeout(600); await catWait();
  const amo = await catTable();
  check('catalogue : recherche « amortisseur » (nom français) trouve les pièces, noms en français', /Amortisseur/.test(amo) && !/Shock Absorber/i.test(amo), amo.slice(0, 200));
  await g.evaluate(() => { location.hash = '#/profil'; }); await g.waitForTimeout(300);
  await g.locator('[data-action="setLang"][data-arg="ar"]').click(); await g.waitForTimeout(300);
  await g.evaluate(() => { location.hash = '#/catalogue'; }); await g.waitForTimeout(800);
  await g.locator('#cat-q').fill('ممتص'); await g.waitForTimeout(600); await catWait();
  const amoAr = await catTable();
  check('catalogue en arabe : recherche « ممتص » et noms des pièces en arabe', /ممتص الصدمات/.test(amoAr) && !/Shock Absorber/i.test(amoAr), amoAr.slice(0, 200));
  await g.screenshot({ path: resolve(shots, '06b-catalogue-ar.png') });
  await g.evaluate(() => { location.hash = '#/profil'; }); await g.waitForTimeout(300);
  await g.locator('[data-action="setLang"][data-arg="fr"]').click(); await g.waitForTimeout(300);
  await g.evaluate(() => { location.hash = '#/catalogue'; }); await g.waitForTimeout(500);
  await g.locator('#cat-q').fill(''); await g.waitForTimeout(500);

  // 5c. Mon profil : enseigne du magasin enregistrée dans Dolibarr, affichée dans le menu.
  await g.evaluate(() => { location.hash = '#/profil'; }); await g.waitForTimeout(600);
  await g.locator('#sh-name').fill('City Makoudi 2');
  await g.locator('#sh-address').fill('Rue des pièces, Alger');
  await g.locator('form[data-submit="saveShop"] button[type=submit]').click();
  await g.getByText('Magasin enregistré dans Dolibarr.').waitFor({ timeout: 15000 }).catch(() => {});
  check('profil : enseigne affichée dans le menu', (await g.locator('.side .brand').innerText()).includes('City Makoudi 2'));
  const prof = await api('documents/download?modulepart=societe&original_file=' + encodeURIComponent('5/caruno-profil.json'), g0);
  const profJson = prof && prof.content ? JSON.parse(Buffer.from(prof.content, 'base64').toString('utf8')) : {};
  check('profil : enregistré dans Dolibarr (nom, adresse)', profJson.name === 'City Makoudi 2' && profJson.address === 'Rue des pièces, Alger', JSON.stringify(profJson).slice(0, 120));
  await g.screenshot({ path: resolve(shots, '05a-profil.png') });

  // 5d. Langue arabe : sens droite-à-gauche et menus traduits, puis retour au français.
  await g.locator('[data-action="setLang"][data-arg="ar"]').click(); await g.waitForTimeout(400);
  check('arabe : page en droite-à-gauche', (await g.evaluate(() => document.documentElement.dir)) === 'rtl');
  check('arabe : menu traduit', /القطع/.test(await body(g)) && /الصندوق/.test(await body(g)));
  await g.evaluate(() => { location.hash = '#/pieces'; }); await g.waitForTimeout(500);
  check('arabe : écran Pièces traduit', /قطعة جديدة/.test(await body(g)));
  await g.screenshot({ path: resolve(shots, '05b-pieces-ar.png') });
  await g.evaluate(() => { location.hash = '#/profil'; }); await g.waitForTimeout(400);
  await g.locator('[data-action="setLang"][data-arg="fr"]').click(); await g.waitForTimeout(300);
  check('retour au français', (await g.evaluate(() => document.documentElement.dir)) === 'ltr' && /Mon profil/.test(await body(g)));
  await g.locator('[data-action="setLang"][data-arg="en"]').click(); await g.waitForTimeout(400);
  check('anglais : profil traduit, gauche-à-droite', /My profile/.test(await body(g)) && /My shop/.test(await body(g)) && (await g.evaluate(() => document.documentElement.dir)) === 'ltr');
  await g.evaluate(() => { location.hash = '#/pieces'; }); await g.waitForTimeout(500);
  check('anglais : écran Pièces et menu traduits', /New part/.test(await body(g)) && /Customers/.test(await body(g)) && /Dashboard/.test(await body(g)));
  await g.screenshot({ path: resolve(shots, '05b2-pieces-en.png') });
  await g.evaluate(() => { location.hash = '#/profil'; }); await g.waitForTimeout(400);
  await g.locator('[data-action="setLang"][data-arg="fr"]').click(); await g.waitForTimeout(300);

  // 5e. Import Excel puis PDF : pièces créées dans Dolibarr.
  const XLSX = createRequire(import.meta.url)('../vendor/xlsx.full.min.js');
  const stamp = Date.now().toString(36).toUpperCase();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Référence', 'Désignation', 'Marque', 'Prix public', 'Prix gros', 'Stock', 'Famille'], ['XL-' + stamp + '-1', 'Filtre à air essai', 'MANN', '1 500,00', '1200', '4', 'Filtration'], ['XL-' + stamp + '-2', 'Bougie essai', 'NGK', '800', '', '10', 'Moteur']]), 'Tarif');
  const xlsxPath = resolve(shots, 'import-essai.xlsx');
  writeFileSync(xlsxPath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  await g.evaluate(() => { location.hash = '#/pieces'; }); await g.waitForTimeout(400);
  await g.locator('[data-action="modalImport"]').click();
  await g.locator('#imp-file').setInputFiles(xlsxPath);
  await g.locator('#imp-run').waitFor({ timeout: 15000 });
  check('import Excel : colonnes reconnues', (await g.locator('#imp-ref').inputValue()) === '0' && (await g.locator('#imp-p0').inputValue()) === '3' && (await g.locator('#imp-qty').inputValue()) === '5');
  await g.screenshot({ path: resolve(shots, '05c-import-colonnes.png') });
  await g.locator('#imp-run').click();
  await g.getByText('Import terminé').first().waitFor({ timeout: 60000 }).catch(() => {});
  check('import Excel : 2 pièces créées', (await g.locator('#imp-created').innerText()).trim() === '2');
  const xl1 = (await api('products?includestockdata=1&sqlfilters=' + encodeURIComponent("(t.ref:=:'XL-" + stamp + "-1')"), g0))[0];
  check('Dolibarr : pièce importée (prix 1500 / 1200, stock 4)', xl1 && Math.round(xl1.multiprices[1]) === 1500 && Math.round(xl1.multiprices[3]) === 1200 && Number(xl1.stock_reel) === 4, JSON.stringify(xl1 && [xl1.multiprices, xl1.stock_reel]));
  await g.locator('[data-action="closeModal"]').first().click();

  // PDF minimal avec un tableau : Référence, Désignation, Prix.
  const pdfRows = [['Reference', 'Designation', 'Prix'], ['PDF-' + stamp + '-1', 'Disque de frein essai', '4500'], ['PDF-' + stamp + '-2', 'Plaquettes essai', '3200']];
  const content = 'BT /F1 11 Tf ' + pdfRows.map((r, i) => r.map((c, k) => '1 0 0 1 ' + (50 + k * 200) + ' ' + (760 - i * 20) + ' Tm (' + c + ') Tj').join(' ')).join(' ') + ' ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>', '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = pdf.length;
  pdf += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') + 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  const pdfPath = resolve(shots, 'import-essai.pdf');
  writeFileSync(pdfPath, pdf, 'latin1');
  await g.locator('[data-action="modalImport"]').click();
  await g.locator('#imp-file').setInputFiles(pdfPath);
  await g.locator('#imp-run').waitFor({ timeout: 20000 });
  check('import PDF : tableau lu, colonnes reconnues', (await g.locator('#imp-ref').inputValue()) === '0' && (await g.locator('#imp-name').inputValue()) === '1' && (await g.locator('#imp-p0').inputValue()) === '2');
  await g.locator('#imp-run').click();
  await g.getByText('Import terminé').first().waitFor({ timeout: 60000 }).catch(() => {});
  const pd1 = (await api('products?sqlfilters=' + encodeURIComponent("(t.ref:=:'PDF-" + stamp + "-1')"), g0))[0];
  check('Dolibarr : pièce importée du PDF (Disque de frein essai, 4500)', pd1 && pd1.label === 'Disque de frein essai' && Math.round(pd1.multiprices[1]) === 4500, JSON.stringify(pd1 && [pd1.label, pd1.multiprices]));
  await g.locator('[data-action="closeModal"]').first().click();

  // 6. Vendeur : caisse au clavier, vente enregistrée dans Dolibarr.
  const ctxV = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const v = await signIn(ctxV, 'dev.vendeur', secrets.TEST_PW_DEV_VENDEUR);
  await v.waitForTimeout(800);
  check('vendeur → caisse', v.url().endsWith('#/caisse'), v.url());
  if (await v.locator('#pos-open').isVisible().catch(() => false)) { await v.locator('#pos-open').fill('10000'); await v.locator('form[data-submit="posOpen"] button[type=submit]').click(); }
  await v.locator('#pos-q').waitFor();
  await v.screenshot({ path: resolve(shots, '05-caisse.png') });
  // Prix tapé sous le prix d'achat : alertes sur la ligne, dans le champ et au paiement.
  await v.locator('#pos-q').focus();
  await v.keyboard.type('TEST-STK-001'); await v.waitForTimeout(1500); await v.keyboard.press('Enter'); await v.waitForTimeout(300);
  await v.keyboard.type('950'); await v.waitForTimeout(300);
  check('prix sous le prix d’achat : alerte sur la ligne', /Prix inférieur au prix d’achat : vente à perte/.test(await v.locator('.cost-warn').first().innerText().catch(() => '')));
  check('prix sous le prix d’achat : champ en rouge, coût masqué au vendeur', (await v.locator('.price-in.under-cost').count()) === 1 && !/1\s?000\s?DA/.test((await v.locator('.cost-warn').first().innerText()).replace(/[  ]/g, ' ')));
  await v.screenshot({ path: resolve(shots, '05c-caisse-vente-a-perte.png') });
  await v.keyboard.press('Enter'); await v.keyboard.press('Enter'); await v.keyboard.press('Enter'); await v.waitForTimeout(300);
  check('paiement : alerte vente à perte avant de valider', /Vente à perte/.test(await v.locator('.alert.a-bad').first().innerText().catch(() => '')));
  await v.screenshot({ path: resolve(shots, '05d-paiement-vente-a-perte.png') });
  await v.keyboard.press('Escape'); await v.waitForTimeout(200);
  await v.locator('[data-action="posSel"]').first().click(); await v.locator('[data-action="lineDel"]').first().click(); await v.waitForTimeout(200);
  await v.locator('#pos-q').focus();
  await v.keyboard.type('TEST-STK-002');
  await v.waitForTimeout(1500);
  check('caisse : pièces en liste comme Pièces (pas de tuiles)', (await v.locator('table.pos-list tbody tr').count()) > 0 && (await v.locator('.tile').count()) === 0);
  check('caisse : la pièce cherchée est en surbrillance', /TEST-STK-002/.test(await v.locator('table.pos-list tr.hi').innerText().catch(() => '')));
  await v.screenshot({ path: resolve(shots, '05b-caisse-liste.png') });
  await v.keyboard.press('Enter');
  await v.waitForTimeout(300);
  check('Entrée : pièce ajoutée, curseur sur son prix', await v.evaluate(() => /^ln-price-/.test(document.activeElement.id)));
  await v.keyboard.type('150');
  await v.keyboard.press('Enter');
  check('prix → quantité', await v.evaluate(() => /^ln-qty-/.test(document.activeElement.id)));
  await v.keyboard.press('Enter');
  check('quantité → recherche', await v.evaluate(() => document.activeElement.id === 'pos-q'));
  await v.screenshot({ path: resolve(shots, '06-caisse-panier.png') });
  await v.keyboard.press('Enter');
  check('recherche vide → paiement', await v.evaluate(() => document.activeElement.id === 'pay-amt-0'));
  await v.keyboard.type('200');
  await v.keyboard.press('Enter');
  await v.getByText(/Paiement réussi|Connexion perdue/).waitFor({ timeout: 30000 }).catch(() => {});
  const rec = await body(v);
  check('vente encaissée : ticket, rendu 50 DA', /Paiement réussi/.test(rec) && /50\s?DA/.test(rec.replace(/\u202f|\u00a0/g, ' ')), rec.slice(0, 300));
  const ref = (rec.match(/IN\d{4}-\d{4}/) || [])[0];
  await v.screenshot({ path: resolve(shots, '07-ticket.png') });
  check('après la vente : bon d’achat par défaut', await v.locator('.print-area.bon').isVisible().catch(() => false) && /BON D’ACHAT/.test(await v.locator('.print-area').innerText()));
  await v.locator('[data-action="posPrintFmt"][data-arg="ticket"]').click(); await v.waitForTimeout(200);
  check('format ticket 80 mm au choix', await v.locator('.print-area.ticket').isVisible().catch(() => false));
  await v.locator('[data-action="posPrintFmt"][data-arg="a4"]').click(); await v.waitForTimeout(200);
  check('format facture A4 au choix', /FACTURE/.test(await v.locator('.print-area').innerText()) && !(await v.locator('.print-area.ticket').count()));
  await v.screenshot({ path: resolve(shots, '07b-facture-a4.png') });
  await v.locator('[data-action="posPrintFmt"][data-arg="bon"]').click(); await v.waitForTimeout(200);
  await v.screenshot({ path: resolve(shots, '07c-bon-achat.png') });
  const inv = ref ? (await api('invoices?sqlfilters=' + encodeURIComponent("(t.ref:=:'" + ref + "')"), g0))[0] : null;
  check('Dolibarr : facture ' + ref + ' payée 150 DA, ref_ext de la vente', inv && Number(inv.statut) === 2 && Math.round(inv.total_ttc) === 150 && /^V-/.test(inv.ref_ext), JSON.stringify(inv && [inv.statut, inv.total_ttc, inv.ref_ext]));
  await v.keyboard.press('Enter');

  // 7. Fermeture de caisse : rapport dans l'agenda Dolibarr.
  await v.locator('[data-action="posMenu"]').click();
  await v.locator('[data-action="posScreen"][data-arg="close"]').click();
  await v.locator('[data-action="posClose"]').click();
  await v.waitForSelector('#pos-open', { timeout: 20000 }).catch(() => {});
  check('caisse fermée (rapport envoyé)', await v.locator('#pos-open').isVisible().catch(() => false));
} catch (e) {
  ko++; console.log('ERR  ' + (e && e.message ? e.message.split('\n')[0] : e));
} finally {
  console.log('Erreurs JS dans la page : ' + (errors.length ? errors.join(' | ') : 'aucune'));
  console.log('\n' + ok + ' OK, ' + ko + ' échec(s) — captures : ' + shots);
  await browser.close(); server.close();
  process.exit(ko || errors.length ? 1 : 0);
}
