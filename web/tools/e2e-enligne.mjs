// Parcours navigateur (Edge, playwright-core) de la page « Magasin en ligne ».
// Écrit dans Dolibarr de DÉVELOPPEMENT : met une pièce en ligne puis la remet hors ligne (état final : hors ligne).
// Usage : node web/tools/e2e-enligne.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(resolve(here, '../../app/package.json'))('playwright-core');
const DOLI = process.env.DOLI_URL || 'http://localhost:8080';
const REF = process.env.E2E_REF || '402261';
const secrets = Object.fromEntries(readFileSync(process.env.CARUNO_TEST_USERS || 'C:/Users/TRETEC/caruno-data/instances/hanout-vw/test-users.env', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const shots = resolve(here, '../.e2e-shots');
mkdirSync(shots, { recursive: true });

let ok = 0, ko = 0;
const check = (name, cond, detail = '') => { if (cond) { ok++; console.log('OK   ' + name); } else { ko++; console.log('FAIL ' + name + (detail ? ' :: ' + String(detail).slice(0, 300) : '')); } };
const api = async (path, token) => (await fetch(DOLI + '/api/index.php/' + path, { headers: { Accept: 'application/json', DOLAPIKEY: token } })).json();
const PORT = Number(process.env.E2E_PORT) || 8088;
const server = await serve(PORT);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];

async function signIn(login, pw) {
  const p = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  p.on('pageerror', (e) => errors.push(login + ': ' + e.message));
  await p.goto('http://localhost:' + PORT + '/');
  await p.locator('#lg-url').fill(DOLI.replace(/^https?:\/\//, ''));
  await p.locator('#lg-user').fill(login);
  await p.locator('#pw').fill(pw);
  await p.locator('form[data-submit="login"] button[type=submit]').click();
  await p.waitForSelector('.shell, .pos', { timeout: 60000 });
  return p;
}
const enLigneInDolibarr = async (token, id) => String(((await api('products/' + id, token)).array_options || {}).options_en_ligne || '');

try {
  const token = (await (await fetch(DOLI + '/api/index.php/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'dev.gerant', password: secrets.TEST_PW_DEV_GERANT }) })).json()).success.token;
  const id = (await api('products?' + new URLSearchParams({ sqlfilters: "(t.ref:=:'" + REF + "')", properties: 'id' }), token))[0].id;

  const g = await signIn('dev.gerant', secrets.TEST_PW_DEV_GERANT);
  check('menu : « Magasin en ligne » juste après « Catalogue »', await g.evaluate(() => { const h = [...document.querySelectorAll('nav.nav a')].map((a) => a.getAttribute('href')); return h.indexOf('#/enligne') === h.indexOf('#/catalogue') + 1; }));
  await g.evaluate(() => { location.hash = '#/enligne'; });
  await g.waitForSelector('.web-sw', { timeout: 30000 });
  await g.waitForFunction(() => /pièce\(s\) en ligne sur/.test(document.querySelector('.page-head').innerText), null, { timeout: 20000 });
  const count = async () => Number((await g.locator('.page-head b.num').innerText()).replace(/\D/g, ''));
  const before = await count();
  check('page : liste, interrupteurs, compteur', (await g.locator('.web-sw').count()) > 0 && before >= 0);

  await g.locator('#web-q').fill(REF); await g.waitForTimeout(500);
  await g.waitForFunction((ref) => document.querySelectorAll('table.t tbody tr').length === 1 && document.querySelector('table.t tbody').innerText.includes(ref), REF, { timeout: 20000 });
  const sw = g.locator('table.t tbody .web-sw').first();
  if ((await sw.getAttribute('aria-checked')) === 'true') { await sw.click(); await g.waitForFunction(() => document.querySelector('.web-sw').getAttribute('aria-checked') === 'false' && !document.querySelector('.web-sw').disabled); }
  const base = await count();
  await sw.click();
  await g.waitForFunction(() => !document.querySelector('.web-sw').disabled);
  check('clic : interrupteur sur « En ligne »', (await sw.getAttribute('aria-checked')) === 'true' && /En ligne/.test(await sw.innerText()));
  check('enregistré dans Dolibarr : en_ligne = 1', (await enLigneInDolibarr(token, id)) === '1');
  check('compteur + 1', (await count()) === base + 1, (await count()) + ' / ' + base);
  await g.screenshot({ path: resolve(shots, '10a-magasin-en-ligne.png') });

  await g.locator('#web-f').selectOption('on'); await g.waitForTimeout(600);
  check('filtre « En ligne » : la pièce y est', (await g.locator('table.t tbody').innerText()).includes(REF));
  await g.reload(); await g.waitForSelector('.shell'); await g.evaluate(() => { location.hash = '#/enligne'; });
  await g.waitForSelector('.web-sw', { timeout: 30000 });
  await g.locator('#web-q').fill(REF); await g.waitForTimeout(500);
  await g.waitForFunction((ref) => document.querySelector('table.t tbody').innerText.includes(ref), REF, { timeout: 20000 });
  check('après rechargement : toujours en ligne', (await g.locator('table.t tbody .web-sw').first().getAttribute('aria-checked')) === 'true');

  await g.locator('table.t tbody .web-sw').first().click();
  await g.waitForFunction(() => !document.querySelector('.web-sw').disabled);
  check('clic : « Hors ligne », enregistré 0 dans Dolibarr', (await g.locator('table.t tbody .web-sw').first().getAttribute('aria-checked')) === 'false' && (await enLigneInDolibarr(token, id)) === '0');
  await g.locator('#web-f').selectOption('off'); await g.waitForTimeout(600);
  check('filtre « Hors ligne » : la pièce y est', (await g.locator('table.t tbody').innerText()).includes(REF));
  check('marque TIBAO jamais affichée', !/TIBAO/i.test(await g.locator('body').innerText()));

  const v = await signIn('dev.vendeur', secrets.TEST_PW_DEV_VENDEUR);
  check('vendeur : pas d’entrée « Magasin en ligne » dans le menu', (await v.locator('a[href="#/enligne"]').count()) === 0);
  await v.evaluate(() => { location.hash = '#/enligne'; }); await v.waitForTimeout(600);
  check('vendeur : page refusée', (await v.locator('.web-sw').count()) === 0);
} catch (e) {
  ko++; console.log('ERR  ' + (e && e.message ? e.message.split('\n')[0] : e));
} finally {
  console.log('Erreurs JS dans la page : ' + (errors.length ? errors.join(' | ') : 'aucune'));
  console.log('\n' + ok + ' OK, ' + ko + ' échec(s) — captures : ' + shots);
  await browser.close(); server.close();
  process.exit(ko || errors.length ? 1 : 0);
}
