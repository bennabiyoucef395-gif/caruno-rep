// Parcours navigateur (Edge, playwright-core) de la vitrine publique (web/vitrine) et du lien depuis « Magasin en ligne ».
// LECTURE SEULE. Données attendues dans web/vitrine/data (caruno-erp scripts/vitrine/export.sh).
// Usage : node web/tools/e2e-vitrine.mjs
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(resolve(here, '../../app/package.json'))('playwright-core');
const DOLI = process.env.DOLI_URL || 'http://localhost:8080';
const secrets = Object.fromEntries(readFileSync(process.env.CARUNO_TEST_USERS || 'C:/Users/TRETEC/caruno-data/instances/hanout-vw/test-users.env', 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const dataFile = resolve(here, '../vitrine/data/data.json');
if (!existsSync(dataFile)) { console.log('Données de la vitrine absentes : lancer caruno-erp scripts/vitrine/export.sh'); process.exit(1); }
const data = JSON.parse(readFileSync(dataFile, 'utf8'));
const shots = resolve(here, '../.e2e-shots');
mkdirSync(shots, { recursive: true });

let ok = 0, ko = 0;
const check = (name, cond, detail = '') => { if (cond) { ok++; console.log('OK   ' + name); } else { ko++; console.log('FAIL ' + name + (detail ? ' :: ' + String(detail).slice(0, 300) : '')); } };
const PORT = Number(process.env.E2E_PORT) || 8089;
const server = await serve(PORT);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];

try {
  // Ce que la vitrine publie : rien d'autre que les champs prévus (pas de coût d'achat, pas de quantité, pas de TIBAO).
  const allowed = ['ref', 'name', 'oem', 'brand', 'price', 'family', 'photo'];
  check('données : seulement nom, réf., OEM, marque, prix public, famille, photo', data.parts.every((p) => Object.keys(p).every((k) => allowed.includes(k))));
  check('données : jamais la marque TIBAO', !/TIBAO/i.test(JSON.stringify(data.parts)));

  const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:' + PORT + '/vitrine/');
  await p.waitForSelector('.card, .empty', { timeout: 20000 });
  check('vitrine : une carte par pièce exportée (' + data.parts.length + ')', (await p.locator('.card').count()) === data.parts.length);
  check('vitrine : nom du magasin en tête', (await p.locator('#shop').innerText()) === data.shop.name);
  if (data.shop.whatsapp && data.parts.length) {
    const first = data.parts[0], href = await p.locator('.card .btn-wa').first().getAttribute('href');
    const text = decodeURIComponent((href.split('?text=')[1] || ''));
    check('« Commander sur WhatsApp » : wa.me/' + data.shop.whatsapp + ', message avec la réf. et le prix', href.startsWith('https://wa.me/' + data.shop.whatsapp + '?text=') && text.includes(first.ref) && /DA/.test(text), text);
    check('bouton « Nous écrire » en tête', (await p.locator('#wa-top').getAttribute('href')).startsWith('https://wa.me/' + data.shop.whatsapp));
  }
  await p.locator('#q').fill('zzzz-introuvable');
  check('recherche sans résultat : message', /Aucune pièce ne correspond/.test(await p.locator('#grid').innerText()));
  await p.locator('#q').fill('');
  await p.screenshot({ path: resolve(shots, '11a-vitrine.png'), fullPage: true });
  await p.locator('.langs button[data-lang="ar"]').click();
  check('arabe : page de droite à gauche, bouton « اطلب عبر واتساب »', (await p.evaluate(() => document.documentElement.dir)) === 'rtl' && (!data.shop.whatsapp || /اطلب عبر واتساب/.test(await p.locator('#grid').innerText())));
  await p.screenshot({ path: resolve(shots, '11b-vitrine-ar.png'), fullPage: true });
  await p.locator('.langs button[data-lang="fr"]').click();

  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  m.on('pageerror', (e) => errors.push(e.message));
  await m.goto('http://localhost:' + PORT + '/vitrine/'); await m.waitForSelector('.card, .empty');
  check('téléphone : 2 cartes par ligne, pas de défilement horizontal', await m.evaluate(() => { const t = [...document.querySelectorAll('.card')].slice(0, 2).map((e) => e.getBoundingClientRect().top); return (t.length < 2 || Math.abs(t[0] - t[1]) < 2) && document.documentElement.scrollWidth <= innerWidth + 1; }));
  await m.screenshot({ path: resolve(shots, '11c-vitrine-mobile.png'), fullPage: true });

  // Depuis l'application : « Voir la vitrine » sur la page Magasin en ligne.
  const g = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  g.on('pageerror', (e) => errors.push(e.message));
  await g.goto('http://localhost:' + PORT + '/');
  await g.locator('#lg-url').fill(DOLI.replace(/^https?:\/\//, ''));
  await g.locator('#lg-user').fill('dev.gerant');
  await g.locator('#pw').fill(secrets.TEST_PW_DEV_GERANT);
  await g.locator('form[data-submit="login"] button[type=submit]').click();
  await g.waitForSelector('.shell', { timeout: 60000 });
  await g.evaluate(() => { location.hash = '#/enligne'; }); await g.waitForSelector('.web-tile', { timeout: 30000 });
  const [tab] = await Promise.all([g.context().waitForEvent('page'), g.locator('a[href="vitrine/"]').click()]);
  await tab.waitForSelector('.card, .empty', { timeout: 20000 });
  check('« Voir la vitrine » ouvre la vitrine dans un nouvel onglet', /\/vitrine\/$/.test(tab.url()));
} catch (e) {
  ko++; console.log('ERR  ' + (e && e.message ? e.message.split('\n')[0] : e));
} finally {
  console.log('Erreurs JS dans la page : ' + (errors.length ? errors.join(' | ') : 'aucune'));
  console.log('\n' + ok + ' OK, ' + ko + ' échec(s) — captures : ' + shots);
  await browser.close(); server.close();
  process.exit(ko || errors.length ? 1 : 0);
}
