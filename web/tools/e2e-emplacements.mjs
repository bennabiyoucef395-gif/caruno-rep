// Parcours navigateur : emplacement de la pièce dans CHAQUE entrepôt (Magasin, Réserve…), enregistré et affiché.
// Dolibarr de TEST (8081) : modifie les emplacements de TEST-LOC-001 (créée si absente) puis remet ceux d'avant.
// Usage : node web/tools/e2e-emplacements.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(resolve(here, '../../app/package.json'))('playwright-core');
const DOLI = process.env.DOLI_URL || 'http://localhost:8081';   // Dolibarr de TEST
const secrets = Object.fromEntries(readFileSync(process.env.CARUNO_TEST_USERS || 'C:/Users/TRETEC/caruno-data/instances/test/test-users.env', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const shots = resolve(here, '../.e2e-shots');
mkdirSync(shots, { recursive: true });
let ok = 0, ko = 0;
const check = (name, cond, detail = '') => { if (cond) { ok++; console.log('OK   ' + name); } else { ko++; console.log('FAIL ' + name + (detail ? ' :: ' + String(detail).slice(0, 300) : '')); } };
const call = async (path, token, opts = {}) => (await fetch(DOLI + '/api/index.php/' + path, { ...opts, headers: { Accept: 'application/json', 'Content-Type': 'application/json', DOLAPIKEY: token } })).json();
const server = await serve(Number(process.env.E2E_PORT) || 8091);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
let restore = null;

async function signIn(login, pw) {
  const p = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  p.on('pageerror', (e) => errors.push(login + ': ' + e.message));
  await p.goto('http://localhost:' + server.address().port + '/');
  if (!(await p.locator('#lg-url').isVisible())) await p.locator('[data-action="loginUrlEdit"]').click();
  await p.locator('#lg-url').fill(DOLI.replace(/^https?:\/\//, ''));
  await p.locator('#lg-user').fill(login); await p.locator('#pw').fill(pw);
  await p.locator('form[data-submit="login"] button[type=submit]').click();
  await p.waitForSelector('.shell, .pos', { timeout: 60000 });
  return p;
}
try {
  const token = (await call('login', '', { method: 'POST', body: JSON.stringify({ login: 'dev.gerant', password: secrets.TEST_PW_DEV_GERANT }) })).success.token;
  // Pièce d'essai propre au test (marque et prix : la fiche refuse d'enregistrer sans), créée si absente, avec 2 en réserve.
  let prod = (await call('products?' + new URLSearchParams({ sqlfilters: "(t.ref:=:'TEST-LOC-001')" }), token))[0];
  if (!prod) {
    const id = Number(await call('products', token, { method: 'POST', body: JSON.stringify({ ref: 'TEST-LOC-001', label: 'Disque de frein (TEST emplacements)', type: 0, status: 1, status_buy: 1, price: 4500, array_options: { options_brand: 'TRW' } }) }));
    await call('stockmovements', token, { method: 'POST', body: JSON.stringify({ product_id: id, warehouse_id: 2, qty: 2, movementlabel: 'Essai emplacements e2e' }) });
    prod = await call('products/' + id, token);
  }
  const ao0 = prod.array_options || {};
  restore = () => call('products/' + prod.id, token, { method: 'PUT', body: JSON.stringify({ array_options: { options_emplacement: ao0.options_emplacement || '', options_emplacements: ao0.options_emplacements || '' } }) });
  const fields = async () => { const ao = (await call('products/' + prod.id, token)).array_options || {}; return [ao.options_emplacement || '', ao.options_emplacements || '']; };

  const g = await signIn('dev.gerant', secrets.TEST_PW_DEV_GERANT);
  await g.evaluate((id) => { location.hash = '#/pieces/' + id + '/modifier'; }, prod.id);
  await g.waitForSelector('#f-loc0', { timeout: 20000 });
  const labels = await g.$$eval('label[for^="f-loc"]', (ls) => ls.map((l) => l.textContent.trim()));
  check('fiche : un emplacement par entrepôt', labels.join(' | ') === 'Emplacement Magasin | Emplacement Réserve', labels.join(' | '));
  await g.locator('#f-loc0').fill('A1-01'); await g.locator('#f-loc1').fill('R-07');
  await g.locator('form[data-submit="savePiece"] button[type=submit]').click();
  await g.waitForFunction(() => /#\/pieces\/\d+$/.test(location.hash), null, { timeout: 30000 }).catch(() => {});
  await g.waitForTimeout(800);
  const [e1, e2] = await fields();
  check('enregistré : Magasin A1-01, Réserve R-07', e1 === 'A1-01' && e2 === 'Réserve=R-07', e1 + ' / ' + e2);

  await g.reload(); await g.waitForSelector('.shell'); await g.evaluate((id) => { location.hash = '#/pieces/' + id; }, prod.id); await g.waitForTimeout(1500);
  const card = await g.locator('#content').innerText();
  check('fiche pièce : les deux emplacements après rechargement', /A1-01/.test(card) && /R-07/.test(card));
  await g.screenshot({ path: resolve(shots, '11a-emplacements-fiche.png') });
  await g.evaluate(() => { location.hash = '#/pieces'; }); await g.locator('#pf-q').fill('TEST-LOC-001'); await g.waitForTimeout(1500);
  check('liste des pièces : emplacement en réserve sous la quantité', /R-07/.test(await g.locator('table.t tbody').innerText()));
  await g.evaluate((id) => { location.hash = '#/pieces/' + id + '/modifier'; }, prod.id); await g.waitForSelector('#f-loc1');
  check('fiche à modifier : emplacements relus', (await g.locator('#f-loc0').inputValue()) === 'A1-01' && (await g.locator('#f-loc1').inputValue()) === 'R-07');

  const v = await signIn('dev.vendeur', secrets.TEST_PW_DEV_VENDEUR);
  if (await v.locator('#pos-open').isVisible().catch(() => false)) { await v.locator('#pos-open').fill('10000'); await v.locator('form[data-submit="posOpen"] button[type=submit]').click(); }
  await v.locator('#pos-q').waitFor(); await v.locator('#pos-q').fill('TEST-LOC-001'); await v.waitForTimeout(1500);
  const row = await v.locator('table.pos-list tbody tr').first().innerText();
  check('caisse : emplacement en réserve dans la liste', /R-07/.test(row) && /A1-01/.test(row), row);
  await v.screenshot({ path: resolve(shots, '11b-emplacements-caisse.png') });
} catch (e) {
  ko++; console.log('ERR  ' + (e && e.message ? e.message.split('\n')[0] : e));
} finally {
  if (restore) await restore().catch(() => {});
  console.log('Erreurs JS dans la page : ' + (errors.length ? errors.join(' | ') : 'aucune'));
  console.log('\n' + ok + ' OK, ' + ko + ' échec(s) — captures : ' + shots);
  await browser.close(); server.close();
  process.exit(ko || errors.length ? 1 : 0);
}
