// Parcours navigateur (Edge, playwright-core) de la page « Magasin en ligne » : tuiles, compteurs, prix obligatoire,
// sélection groupée, alerte « en ligne mais en rupture ».
// Écrit dans Dolibarr de DÉVELOPPEMENT, sur des pièces de test, puis rend à chaque pièce son état d'origine
// (en ligne / hors ligne et prix). Usage : node web/tools/e2e-enligne.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(resolve(here, '../../app/package.json'))('playwright-core');
const DOLI = process.env.DOLI_URL || 'http://localhost:8081';   // Dolibarr de TEST
const NOPRICE = process.env.E2E_NOPRICE_REF || 'TEST-STK-001';     // pièce de test en stock, sans prix
const secrets = Object.fromEntries(readFileSync(process.env.CARUNO_TEST_USERS || 'C:/Users/TRETEC/caruno-data/instances/test/test-users.env', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const shots = resolve(here, '../.e2e-shots');
mkdirSync(shots, { recursive: true });

let ok = 0, ko = 0;
const check = (name, cond, detail = '') => { if (cond) { ok++; console.log('OK   ' + name); } else { ko++; console.log('FAIL ' + name + (detail ? ' :: ' + String(detail).slice(0, 300) : '')); } };
const call = async (path, token, opts = {}) => (await fetch(DOLI + '/api/index.php/' + path, { ...opts, headers: { Accept: 'application/json', 'Content-Type': 'application/json', DOLAPIKEY: token } })).json();
const PORT = Number(process.env.E2E_PORT) || 8088;
const server = await serve(PORT);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const originals = [];   // { id, en, price? } remis en fin de test
let token, profileBackup = null;   // profil du magasin d'avant le test (base64), remis tel quel
let CID = '5';                     // client comptoir (porte le profil) : retrouvé par son marqueur caruno:comptoir

async function signIn(login, pw, viewport = { width: 1400, height: 1000 }) {
  const p = await (await browser.newContext({ viewport })).newPage();
  p.on('pageerror', (e) => errors.push(login + ': ' + e.message));
  await p.goto('http://localhost:' + PORT + '/');
  if (!(await p.locator('#lg-url').isVisible())) await p.locator('[data-action="loginUrlEdit"]').click();
  await p.locator('#lg-url').fill(DOLI.replace(/^https?:\/\//, ''));
  await p.locator('#lg-user').fill(login);
  await p.locator('#pw').fill(pw);
  await p.locator('form[data-submit="login"] button[type=submit]').click();
  await p.waitForSelector('.shell, .pos', { timeout: 60000 });
  return p;
}
async function openPage(p) {
  await p.evaluate(() => { location.hash = '#/enligne'; });
  await p.waitForSelector('.web-tile', { timeout: 30000 });
  await p.waitForFunction(() => /\d/.test((document.querySelector('.web-stat.on .v') || {}).textContent || ''), null, { timeout: 20000 });
}
const settle = (p) => p.waitForFunction(() => !/Recherche…/.test(document.body.innerText) && !document.querySelector('.web-sw:disabled') && !/Mise en ligne…|Retrait…|Sélection…/.test(document.body.innerText), null, { timeout: 30000 });
const search = async (p, q) => { await p.locator('#web-q').fill(q); await p.waitForTimeout(500); await settle(p); };

try {
  token = (await call('login', '', { method: 'POST', body: JSON.stringify({ login: 'dev.gerant', password: secrets.TEST_PW_DEV_GERANT }) })).success.token;
  const counter = await call('thirdparties?limit=1&sqlfilters=' + encodeURIComponent("(t.ref_ext:=:'caruno:comptoir')"), token);
  if (Array.isArray(counter) && counter[0]) CID = String(counter[0].id);
  const read = async (id) => { const r = await call('products/' + id, token); return { en: String((r.array_options || {}).options_en_ligne || ''), price: Number((r.multiprices || {})[1] || r.price || 0) }; };
  const one = async (filter) => (await call('products?' + new URLSearchParams({ sqlfilters: filter, properties: 'id,ref', limit: 1, sortfield: 't.ref' }), token))[0];
  const total = async (filter) => Number((await call('products?' + new URLSearchParams({ sqlfilters: filter, properties: 'id', pagination_data: 'true', limit: 1 }), token)).pagination.total);
  const remember = async (x, withPrice) => { const s = await read(x.id); originals.push({ id: x.id, en: s.en, price: withPrice ? s.price : undefined }); return s; };
  const noPrice = await one("(t.ref:=:'" + NOPRICE + "')");
  const notInStock = await one('(t.tosell:=:1) and ((t.stock:<=:0) or (t.stock:is:NULL))');
  await remember(noPrice, true); await remember(notInStock);
  check('pièce de test sans prix au départ (' + NOPRICE + ')', (await read(noPrice.id)).price === 0);

  const g = await signIn('dev.gerant', secrets.TEST_PW_DEV_GERANT);
  check('menu : « Magasin en ligne » juste après « Catalogue »', await g.evaluate(() => { const h = [...document.querySelectorAll('nav.nav a')].map((a) => a.getAttribute('href')); return h.indexOf('#/enligne') === h.indexOf('#/catalogue') + 1; }));
  await openPage(g);
  const stat = async (i) => Number((await g.locator('.web-stat .v').nth(i).innerText()).replace(/\D/g, ''));
  const all = await stat(2);
  check('en tête : « Pièces en ligne » = Dolibarr', (await stat(0)) === await total('(t.tosell:=:1) and (t.stock:>:0) and (ef.en_ligne:=:1)'));
  check('seulement les pièces en stock (Magasin + Réserve) : ' + all, all === await total('(t.tosell:=:1) and (t.stock:>:0)'));
  const sq = await g.locator('.web-photo').first().boundingBox();
  check('tuiles avec photo carrée', Math.abs(sq.width - sq.height) <= 2, sq.width + 'x' + sq.height);
  check('tuile : prête ? Prix · Photo · Stock', /Prix[\s\S]*Photo[\s\S]*Stock/.test(await g.locator('.web-tile .web-ready').first().innerText()));

  // 1. Prix obligatoire : l'interrupteur demande le prix ; le prix saisi est enregistré et la pièce passe en ligne.
  await search(g, NOPRICE);
  const tileNP = g.locator('.web-tile', { hasText: NOPRICE }).first();
  check('pièce sans prix : « Prix requis » et champ prix sur la tuile', /Prix requis/.test(await tileNP.innerText()) && (await tileNP.locator('input[id^="web-p-"]').count()) === 1);
  await tileNP.locator('.web-sw').click(); await g.waitForTimeout(400);
  check('clic sans prix : rien n’est mis en ligne, le curseur va dans le prix', (await read(noPrice.id)).en !== '1' && (await g.evaluate(() => document.activeElement.id)) === 'web-p-' + noPrice.id);
  await g.screenshot({ path: resolve(shots, '10d-prix-requis.png') });
  await tileNP.locator('input[id^="web-p-"]').fill('1500');
  await tileNP.locator('button[type=submit]').click(); await settle(g); await g.waitForTimeout(300);
  const afterPrice = await read(noPrice.id);
  check('prix saisi : 1 500 DA enregistré dans Dolibarr et pièce en ligne', afterPrice.price === 1500 && afterPrice.en === '1', JSON.stringify(afterPrice));
  check('tuile : prix affiché, « En ligne »', /1\s?500 DA/.test(await tileNP.innerText()) && (await tileNP.locator('.web-sw').getAttribute('aria-checked')) === 'true');

  // 1b. Modifier le prix d'une pièce qui a déjà un prix (en ligne ou non) : clic sur le prix.
  const priced = await one('(t.tosell:=:1) and (t.stock:>:0) and (t.price:>:0)');
  const pr0 = (await remember(priced, true)).price;
  await search(g, priced.ref);
  const tileP = g.locator('.web-tile', { hasText: priced.ref }).first();
  await tileP.locator('.web-price-btn').click(); await g.waitForTimeout(300);
  check('clic sur le prix : saisie ouverte avec le prix actuel (' + pr0 + ')', (await tileP.locator('input[id^="web-p-"]').inputValue()) === String(pr0) && (await g.evaluate(() => document.activeElement.id)).startsWith('web-p-'));
  await tileP.locator('button[aria-label="Annuler"]').click(); await g.waitForTimeout(200);
  check('✕ : saisie fermée, prix inchangé', (await tileP.locator('input[id^="web-p-"]').count()) === 0 && (await read(priced.id)).price === pr0);
  await tileP.locator('.web-price-btn').click();
  await tileP.locator('input[id^="web-p-"]').fill(String(pr0 + 150));
  await tileP.locator('button[type=submit]').click(); await settle(g); await g.waitForTimeout(300);
  check('prix modifié : ' + (pr0 + 150) + ' DA dans Dolibarr et sur la tuile', (await read(priced.id)).price === pr0 + 150 && (await tileP.innerText()).replace(/\s/g, '').includes(String(pr0 + 150) + 'DA'));

  // 2. Sélection : deux pièces hors ligne → « Mettre en ligne », puis « Retirer ».
  await search(g, '');
  await g.locator('#web-f').selectOption('off'); await settle(g);
  const ids = await g.locator('.web-tile .web-chk input').evaluateAll((els) => els.slice(0, 2).map((e) => e.dataset.arg));
  for (const id of ids) { await remember({ id }); await g.locator('.web-chk input[data-arg="' + id + '"]').check(); }
  check('barre de sélection : « 2 pièce(s) sélectionnée(s) »', /2 pièce\(s\) sélectionnée\(s\)/.test(await g.locator('.web-bar').innerText()));
  await g.screenshot({ path: resolve(shots, '10e-selection.png') });
  await g.locator('[data-action="webBulkOn"]').click(); await settle(g); await g.waitForTimeout(300);
  check('« Mettre en ligne » : les 2 pièces en ligne dans Dolibarr', (await Promise.all(ids.map(read))).every((s) => s.en === '1'));
  await g.locator('#web-f').selectOption('on'); await settle(g);
  for (const id of ids) await g.locator('.web-chk input[data-arg="' + id + '"]').check();
  await g.locator('[data-action="webBulkOff"]').click(); await settle(g); await g.waitForTimeout(300);
  check('« Retirer » : les 2 pièces hors ligne dans Dolibarr', (await Promise.all(ids.map(read))).every((s) => s.en === '0'));
  await g.locator('#web-f').selectOption(''); await settle(g);
  await g.locator('[data-action="webSelAll"]').click(); await settle(g);
  check('« Tout sélectionner » : tous les résultats (' + all + ')', new RegExp(all + ' pièce\\(s\\) sélectionnée').test(await g.locator('.web-bar').innerText()));
  await g.locator('[data-action="webSelNone"]').click();
  check('« Annuler la sélection » : barre fermée', (await g.locator('.web-bar').count()) === 0);

  // 3. En ligne mais en rupture : alerte, « Voir », « Tout retirer ».
  const outBefore = await total('(ef.en_ligne:=:1) and ((t.tosell:=:0) or (t.stock:<=:0) or (t.stock:is:NULL))');
  await call('products/' + notInStock.id, token, { method: 'PUT', body: JSON.stringify({ array_options: { options_en_ligne: '1' } }) });
  const h = await signIn('dev.gerant', secrets.TEST_PW_DEV_GERANT);
  await openPage(h);
  await h.waitForSelector('.web-out', { timeout: 20000 });
  check('alerte : ' + (outBefore + 1) + ' pièce(s) en ligne mais en rupture', new RegExp((outBefore + 1) + ' pièce\\(s\\) en ligne mais en rupture').test(await h.locator('.web-out').innerText()));
  await h.screenshot({ path: resolve(shots, '10f-rupture.png') });
  await h.locator('.web-out [data-arg="rupture"]').click(); await settle(h);
  check('« Voir » : la pièce en rupture est listée (' + notInStock.ref + ')', (await h.locator('.web-grid').innerText()).includes(notInStock.ref));
  if (outBefore === 0) {
    await h.locator('[data-action="webRemoveOut"]').click(); await settle(h); await h.waitForTimeout(600);
    check('« Tout retirer » : hors ligne dans Dolibarr, alerte disparue', (await read(notInStock.id)).en === '0' && (await h.locator('.web-out').count()) === 0);
  } else console.log('INFO d’autres pièces en rupture sont en ligne : « Tout retirer » non testé pour ne pas les modifier');

  const m = await signIn('dev.gerant', secrets.TEST_PW_DEV_GERANT, { width: 390, height: 844 });
  await openPage(m);
  check('téléphone : 2 tuiles par ligne, pas de défilement horizontal', await m.evaluate(() => { const t = [...document.querySelectorAll('.web-tile')].slice(0, 2).map((e) => e.getBoundingClientRect().top); return t.length === 2 && Math.abs(t[0] - t[1]) < 2 && document.documentElement.scrollWidth <= innerWidth + 1; }));
  await m.waitForTimeout(800);
  await m.screenshot({ path: resolve(shots, '10b-magasin-en-ligne-mobile.png') });
  check('marque TIBAO jamais affichée', !/TIBAO/i.test(await g.locator('body').innerText()));

  // 4. WhatsApp du magasin en ligne : un clic sur la carte pour modifier ; le profil garde ses autres champs.
  const profileNow = async () => { const d = await call('documents/download?' + new URLSearchParams({ modulepart: 'societe', original_file: CID + '/caruno-profil.json' }), token); return d && d.content ? JSON.parse(Buffer.from(d.content, 'base64').toString('utf8')) : {}; };
  const p0 = await profileNow();
  profileBackup = Buffer.from(JSON.stringify(p0), 'utf8').toString('base64');
  await openPage(g);
  await g.locator('.web-wa-btn').click();
  await g.waitForSelector('#wa-in');
  check('WhatsApp : un clic sur la carte ouvre la saisie', (await g.evaluate(() => document.activeElement.id)) === 'wa-in');
  await g.locator('#wa-in').fill('12'); await g.locator('.web-wa button[type=submit]').click(); await g.waitForTimeout(400);
  check('WhatsApp : numéro trop court refusé, saisie toujours ouverte', (await g.locator('#wa-in').count()) === 1 && /invalide/.test(await g.locator('.toast').innerText().catch(() => '')));
  await g.locator('#wa-in').fill('0555 12 34 56'); await g.locator('.web-wa button[type=submit]').click();
  await g.waitForSelector('.web-wa-btn', { timeout: 20000 });
  const p1 = await profileNow();
  check('WhatsApp : enregistré 213555123456, nom et adresse du magasin intacts', p1.whatsapp === '213555123456' && p1.name === p0.name && p1.address === p0.address, JSON.stringify({ ...p1, logo: undefined }));
  check('WhatsApp : affiché +213 555 12 34 56, « Tester » ouvre wa.me', /\+213 555 12 34 56/.test(await g.locator('.web-wa').innerText()) && (await g.locator('.web-wa a').getAttribute('href')) === 'https://wa.me/213555123456');
  await g.screenshot({ path: resolve(shots, '10g-whatsapp.png') });
  await g.evaluate(() => { location.hash = '#/profil'; }); await g.waitForSelector('#sh-whatsapp');
  check('Profil : champ WhatsApp rempli', (await g.locator('#sh-whatsapp').inputValue()) === '+213 555 12 34 56');
  await g.locator('form[data-submit="saveShop"] button[type=submit]').click(); await g.waitForTimeout(1500);
  check('Profil : « Enregistrer le magasin » garde le WhatsApp', (await profileNow()).whatsapp === '213555123456');

  const v = await signIn('dev.vendeur', secrets.TEST_PW_DEV_VENDEUR);
  check('vendeur : pas d’entrée « Magasin en ligne »', (await v.locator('a[href="#/enligne"]').count()) === 0);
} catch (e) {
  ko++; console.log('ERR  ' + (e && e.message ? e.message.split('\n')[0] : e));
} finally {
  // Chaque pièce touchée retrouve son état d'avant le test (en ligne / hors ligne, et le prix pour la pièce sans prix).
  for (const o of originals) {
    const body = { array_options: { options_en_ligne: o.en || '0' } };
    if (o.price !== undefined) Object.assign(body, { price: String(o.price), price_base_type: 'HT', multiprices: { 1: String(o.price) }, multiprices_base_type: { 1: 'HT' } });
    await call('products/' + o.id, token, { method: 'PUT', body: JSON.stringify(body) }).catch(() => {});
  }
  if (profileBackup) await call('documents/upload', token, { method: 'POST', body: JSON.stringify({ filename: 'caruno-profil.json', modulepart: 'societe', ref: CID, subdir: '', filecontent: profileBackup, fileencoding: 'base64', overwriteifexists: 1 }) }).catch(() => {});
  console.log('Erreurs JS dans la page : ' + (errors.length ? errors.join(' | ') : 'aucune'));
  console.log('\n' + ok + ' OK, ' + ko + ' échec(s) — captures : ' + shots);
  await browser.close(); server.close();
  process.exit(ko || errors.length ? 1 : 0);
}
