// Parcours navigateur (Edge, playwright-core) du tableau de bord : caisse en haut, graphiques en barres.
// LECTURE SEULE : aucune donnée n'est écrite dans Dolibarr. Usage : node web/tools/e2e-dashboard.mjs
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
const PORT = Number(process.env.E2E_PORT) || 8087;
const server = await serve(PORT);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];

async function signIn(login, pw, viewport) {
  const p = await (await browser.newContext({ viewport })).newPage();
  p.on('pageerror', (e) => errors.push(login + ': ' + e.message));
  await p.goto('http://localhost:' + PORT + '/');
  await p.locator('#lg-url').fill(DOLI.replace(/^https?:\/\//, ''));
  await p.locator('#lg-user').fill(login);
  await p.locator('#pw').fill(pw);
  await p.locator('form[data-submit="login"] button[type=submit]').click();
  await p.waitForSelector('.shell, .pos', { timeout: 60000 });
  await p.evaluate(() => { location.hash = '#/tableau'; });
  await p.waitForSelector('.dash-till', { timeout: 20000 });
  await p.waitForSelector('.dc-col', { timeout: 30000 });   // historique chargé
  return p;
}
const num = (s) => Number(String(s).replace(/[^\d−-]/g, '').replace('−', '-')) || 0;

try {
  const g = await signIn('dev.gerant', secrets.TEST_PW_DEV_GERANT, { width: 1400, height: 1000 });
  check('menu : « Tableau de bord » en premier', (await g.locator('nav.nav a').first().getAttribute('href')) === '#/tableau');
  check('caisse en premier dans le tableau de bord',await g.evaluate(() => document.querySelector('.dash').firstElementChild.classList.contains('dash-till')));
  const till = await g.locator('.dash-till').innerText();
  check('caisse : état, encaissé du jour, modes, espèces attendues', /Ouverte|Fermée/.test(till) && /Encaissé aujourd’hui/.test(till) && /Espèces/.test(till) && /Chèques/.test(till) && /Virements/.test(till) && /Espèces attendues en caisse/.test(till), till);
  const charts = g.locator('.dash-chart');
  check('deux graphiques en barres : 30 jours et 12 mois', (await charts.count()) === 2 && (await charts.nth(0).locator('.dc-col').count()) === 30 && (await charts.nth(1).locator('.dc-col').count()) === 12);
  const todayTip = await charts.nth(0).locator('.dc-col.now').getAttribute('data-tip-v');
  const tileCa = await g.locator('.kpi').first().locator('.v').innerText();
  check('barre du jour = tuile « Chiffre d’affaires du jour »', num(todayTip) === num(tileCa), todayTip + ' / ' + tileCa);
  const monthTip = await charts.nth(1).locator('.dc-col.now').getAttribute('data-tip-v');
  check('mois en cours ≥ jour', num(monthTip) >= num(tileCa), monthTip);
  await charts.nth(0).locator('.dc-col.now').hover();
  const tip = g.locator('.dash-tip');
  check('info-bulle au survol : montant et date', await tip.isVisible() && (await tip.innerText()).includes(todayTip), await tip.innerText().catch(() => ''));
  await g.locator('.dash-chart .dash-tbl summary').first().click();
  check('« Voir les chiffres » : table de 30 jours', (await g.locator('.dash-chart .dash-tbl').first().locator('tbody tr').count()) === 30);
  await g.locator('.dash-chart .dash-tbl summary').first().click();
  check('ventes par vendeur et par famille affichées', /Ventes du jour par vendeur/.test(await g.locator('body').innerText()) && /Ventes par famille/.test(await g.locator('body').innerText()));
  check('« À vérifier » toujours là', /À vérifier/.test(await g.locator('body').innerText()));
  await g.mouse.move(5, 5); await g.waitForTimeout(200);
  check('info-bulle cachée quand la souris quitte la barre', !(await tip.isVisible()));
  await g.screenshot({ path: resolve(shots, '09a-tableau-de-bord.png'), fullPage: true });
  await g.locator('.dash-till a[href="#/caisse"]').click();
  await g.waitForTimeout(800);
  check('« Aller à la caisse » ouvre la caisse', /#\/caisse/.test(g.url()), g.url());

  // Arabe
  await g.evaluate(() => { location.hash = '#/profil'; }); await g.waitForTimeout(300);
  await g.locator('[data-action="setLang"][data-arg="ar"]').click(); await g.waitForTimeout(300);
  await g.evaluate(() => { location.hash = '#/tableau'; }); await g.waitForSelector('.dc-col');
  const ar = await g.locator('.dash').innerText();
  check('en arabe : caisse et graphiques traduits', !/Encaissé aujourd’hui|Aller à la caisse|derniers jours|derniers mois|Voir les chiffres|Ventes par famille/.test(ar), ar.slice(0, 300));
  const [x0, xNow] = await g.evaluate(() => { const c = document.querySelector('.dash-chart'); return [c.querySelector('.dc-col').getBoundingClientRect().x, c.querySelector('.dc-col.now').getBoundingClientRect().x]; });
  check('en arabe : le temps va de gauche à droite (aujourd’hui à droite)', xNow > x0, x0 + ' / ' + xNow);
  await g.screenshot({ path: resolve(shots, '09b-tableau-de-bord-ar.png'), fullPage: true });

  // Téléphone
  const m = await signIn('dev.gerant', secrets.TEST_PW_DEV_GERANT, { width: 390, height: 844 });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('téléphone : pas de défilement horizontal', overflow <= 1, overflow);
  await m.screenshot({ path: resolve(shots, '09c-tableau-de-bord-mobile.png'), fullPage: true });

  // Comptable : pas d'accès à la caisse, donc pas de bouton « Aller à la caisse ».
  const c = await signIn('dev.comptable', secrets.TEST_PW_DEV_COMPTABLE, { width: 1400, height: 1000 });
  check('comptable : pas de bouton « Aller à la caisse »', (await c.locator('.dash-till a[href="#/caisse"]').count()) === 0);
  check('comptable : « Tableau de bord » en premier dans le menu', (await c.locator('nav.nav a').first().getAttribute('href')) === '#/tableau');
  check('téléphone : « Bord » en premier dans la barre du bas', (await m.locator('nav.bottomnav a').first().getAttribute('href')) === '#/tableau');
} catch (e) {
  ko++; console.log('ERR  ' + (e && e.message ? e.message.split('\n')[0] : e));
} finally {
  console.log('Erreurs JS dans la page : ' + (errors.length ? errors.join(' | ') : 'aucune'));
  console.log('\n' + ok + ' OK, ' + ko + ' échec(s) — captures : ' + shots);
  await browser.close(); server.close();
  process.exit(ko || errors.length ? 1 : 0);
}
