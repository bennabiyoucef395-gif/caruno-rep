// Parcours navigateur (Edge, playwright-core) de la page « Magasin en ligne » : tuiles carrées, pièces en stock.
// Écrit dans Dolibarr de DÉVELOPPEMENT : bascule une pièce en stock en ligne / hors ligne, puis lui rend son état d'origine.
// Usage : node web/tools/e2e-enligne.mjs
import { readFileSync, mkdirSync } from 'node:fs';
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
const call = async (path, token, opts = {}) => (await fetch(DOLI + '/api/index.php/' + path, { ...opts, headers: { Accept: 'application/json', 'Content-Type': 'application/json', DOLAPIKEY: token } })).json();
const PORT = Number(process.env.E2E_PORT) || 8088;
const server = await serve(PORT);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
let restore = null;

async function signIn(login, pw, viewport = { width: 1400, height: 1000 }) {
  const p = await (await browser.newContext({ viewport })).newPage();
  p.on('pageerror', (e) => errors.push(login + ': ' + e.message));
  await p.goto('http://localhost:' + PORT + '/');
  await p.locator('#lg-url').fill(DOLI.replace(/^https?:\/\//, ''));
  await p.locator('#lg-user').fill(login);
  await p.locator('#pw').fill(pw);
  await p.locator('form[data-submit="login"] button[type=submit]').click();
  await p.waitForSelector('.shell, .pos', { timeout: 60000 });
  return p;
}

try {
  const token = (await call('login', '', { method: 'POST', body: JSON.stringify({ login: 'dev.gerant', password: secrets.TEST_PW_DEV_GERANT }) })).success.token;
  const enLigne = async (id) => String(((await call('products/' + id, token)).array_options || {}).options_en_ligne || '');
  const inStock = await call('products?' + new URLSearchParams({ sqlfilters: '(t.tosell:=:1) and (t.stock:>:0)', properties: 'id,ref', limit: 1, sortfield: 't.ref' }), token);
  const { id, ref: REF } = inStock[0];
  const initial = await enLigne(id);
  restore = async () => call('products/' + id, token, { method: 'PUT', body: JSON.stringify({ array_options: { options_en_ligne: initial || '0' } }) });
  const notInStock = (await call('products?' + new URLSearchParams({ sqlfilters: '(t.tosell:=:1) and (t.stock:<=:0)', properties: 'ref', limit: 1 }), token))[0].ref;

  const g = await signIn('dev.gerant', secrets.TEST_PW_DEV_GERANT);
  check('menu : « Magasin en ligne » juste après « Catalogue »', await g.evaluate(() => { const h = [...document.querySelectorAll('nav.nav a')].map((a) => a.getAttribute('href')); return h.indexOf('#/enligne') === h.indexOf('#/catalogue') + 1; }));
  await g.evaluate(() => { location.hash = '#/enligne'; });
  await g.waitForSelector('.web-tile', { timeout: 30000 });
  await g.waitForFunction(() => /\d/.test((document.querySelector('.web-stat.on .v') || {}).textContent || ''), null, { timeout: 20000 });
  const stat = async (i) => Number((await g.locator('.web-stat .v').nth(i).innerText()).replace(/\D/g, ''));
  const count = () => stat(0);
  const all = await stat(2);
  const apiAll = (await call('products?' + new URLSearchParams({ sqlfilters: '(t.tosell:=:1) and (t.stock:>:0)', properties: 'id', pagination_data: 'true', limit: 1 }), token)).pagination.total;
  const apiOn = (await call('products?' + new URLSearchParams({ sqlfilters: '(t.tosell:=:1) and (t.stock:>:0) and (ef.en_ligne:=:1)', properties: 'id', pagination_data: 'true', limit: 1 }), token)).pagination.total;
  check('en tête : « Pièces en ligne » = Dolibarr (' + apiOn + ')', (await count()) === Number(apiOn) && /Pièces en ligne/.test(await g.locator('.web-stats').innerText()));
  check('en tête : en ligne + hors ligne = en stock', (await count()) + (await stat(1)) === all);
  check('seulement les pièces en stock (Magasin + Réserve) : ' + all, all === Number(apiAll), all + ' / ' + apiAll);
  const sq = await g.locator('.web-photo').first().boundingBox();
  check('tuiles avec photo carrée', Math.abs(sq.width - sq.height) <= 2, sq.width + 'x' + sq.height);
  check('tuile : stock par entrepôt', /Magasin \d+ · Réserve \d+/.test(await g.locator('.web-tile').first().innerText()));
  await g.screenshot({ path: resolve(shots, '10a-magasin-en-ligne.png') });

  await g.locator('#web-q').fill(notInStock); await g.waitForTimeout(500);
  await g.waitForFunction(() => !/Recherche…/.test(document.body.innerText), null, { timeout: 20000 });
  check('pièce sans stock (' + notInStock + ') : absente', (await g.locator('.web-tile').count()) === 0);

  await g.locator('#web-q').fill(REF); await g.waitForTimeout(500);
  await g.waitForFunction((ref) => document.querySelectorAll('.web-tile').length >= 1 && document.querySelector('.web-grid').innerText.includes(ref), REF, { timeout: 20000 });
  const tile = g.locator('.web-tile', { hasText: REF }).first(), sw = tile.locator('.web-sw');
  if ((await sw.getAttribute('aria-checked')) === 'true') { await sw.click(); await g.waitForFunction(() => !document.querySelector('.web-sw:disabled')); }
  const base = await count();
  await sw.click();
  await g.waitForFunction(() => !document.querySelector('.web-sw:disabled'));
  check('clic : « En ligne », tuile marquée', (await sw.getAttribute('aria-checked')) === 'true' && /\bon\b/.test(await tile.getAttribute('class')));
  check('enregistré dans Dolibarr : en_ligne = 1', (await enLigne(id)) === '1');
  check('compteur + 1', (await count()) === base + 1, (await count()) + ' / ' + base);
  await g.screenshot({ path: resolve(shots, '10c-magasin-en-ligne-compteur.png') });
  await g.locator('.web-stat.on').click(); await g.waitForTimeout(600);
  check('clic sur « Pièces en ligne » : filtre « En ligne », la pièce y est', (await g.locator('#web-f').inputValue()) === 'on' && (await g.locator('.web-grid').innerText()).includes(REF));
  await g.locator('.web-tile', { hasText: REF }).first().locator('.web-sw').click();
  await g.waitForFunction(() => !document.querySelector('.web-sw:disabled'));
  check('clic : « Hors ligne », enregistré 0 dans Dolibarr', (await enLigne(id)) === '0');
  check('marque TIBAO jamais affichée', !/TIBAO/i.test(await g.locator('body').innerText()));

  const m = await signIn('dev.gerant', secrets.TEST_PW_DEV_GERANT, { width: 390, height: 844 });
  await m.evaluate(() => { location.hash = '#/enligne'; }); await m.waitForSelector('.web-tile', { timeout: 30000 });
  check('téléphone : 2 tuiles par ligne, pas de défilement horizontal', await m.evaluate(() => { const t = [...document.querySelectorAll('.web-tile')].slice(0, 2).map((e) => e.getBoundingClientRect().top); return t.length === 2 && Math.abs(t[0] - t[1]) < 2 && document.documentElement.scrollWidth <= innerWidth + 1; }));
  await m.waitForTimeout(800);
  await m.screenshot({ path: resolve(shots, '10b-magasin-en-ligne-mobile.png') });

  const v = await signIn('dev.vendeur', secrets.TEST_PW_DEV_VENDEUR);
  check('vendeur : pas d’entrée « Magasin en ligne »', (await v.locator('a[href="#/enligne"]').count()) === 0);
} catch (e) {
  ko++; console.log('ERR  ' + (e && e.message ? e.message.split('\n')[0] : e));
} finally {
  if (restore) await restore().catch(() => {});      // la pièce retrouve son état d'avant le test
  console.log('Erreurs JS dans la page : ' + (errors.length ? errors.join(' | ') : 'aucune'));
  console.log('\n' + ok + ' OK, ' + ko + ' échec(s) — captures : ' + shots);
  await browser.close(); server.close();
  process.exit(ko || errors.length ? 1 : 0);
}
