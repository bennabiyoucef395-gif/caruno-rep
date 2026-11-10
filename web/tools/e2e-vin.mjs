// Parcours navigateur (Edge, playwright-core) de la lecture du VIN dans le Catalogue, sur le Dolibarr de TEST (8081).
// Écrit seulement les lectures de VIN et les choix du vendeur (module CARUNO, llx_caruno_vin_lookup), jamais de pièce,
// de stock ni de vente. Vérifie aussi que le champ VIN reste caché sur un serveur sans ces routes (le magasin aujourd'hui).
// Usage : node web/tools/e2e-vin.mjs
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(resolve(here, '../../app/package.json'))('playwright-core');
const DOLI = process.env.DOLI_URL || 'http://localhost:8081';   // Dolibarr de TEST
const env = (f) => Object.fromEntries(readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const secrets = env(process.env.CARUNO_TEST_USERS || 'C:/Users/TRETEC/caruno-data/instances/test/test-users.env');
const inst = env(process.env.CARUNO_INSTANCE_ENV || 'C:/Users/TRETEC/caruno-data/instances/test/instance.env');
const shots = resolve(here, '../.e2e-shots');
mkdirSync(shots, { recursive: true });
if (!existsSync(resolve(here, '../data/parts/index.json'))) { console.log('Données véhicules absentes : lancer scripts/parts/export.sh avec PARTS_JSON_DIR=web/data/parts'); process.exit(1); }

let ok = 0, ko = 0;
const check = (name, cond, detail = '') => { if (cond) { ok++; console.log('OK   ' + name); } else { ko++; console.log('FAIL ' + name + (detail ? ' :: ' + String(detail).slice(0, 300) : '')); } };
const PORT = Number(process.env.E2E_PORT) || 8087;
const server = await serve(PORT);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const API = DOLI + '/api/index.php/';
const adminTok = (await (await fetch(API + 'login', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ login: inst.DOLI_ADMIN_LOGIN || 'admin', password: inst.DOLI_ADMIN_PASSWORD }) })).json()).success?.token;
const lookups = async () => (await (await fetch(API + 'caruno/vehicles/lookups?limit=30', { headers: { DOLAPIKEY: adminTok, Accept: 'application/json' } })).json());

async function open(withRoutes) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  if (!withRoutes) await p.route('**/api/index.php/caruno/vehicles/status', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":404}}' }));
  await p.goto('http://localhost:' + PORT + '/');
  if (!(await p.locator('#lg-url').isVisible())) await p.locator('[data-action="loginUrlEdit"]').click();
  await p.locator('#lg-url').fill(DOLI.replace(/^https?:\/\//, ''));
  await p.locator('#lg-user').fill('dev.vendeur');
  await p.locator('#pw').fill(secrets.TEST_PW_DEV_VENDEUR);
  await p.locator('form[data-submit="login"] button[type=submit]').click();
  await p.waitForSelector('.shell, .pos', { timeout: 60000 });
  await p.evaluate(() => { location.hash = '#/catalogue'; });
  await p.waitForSelector('#veh-maker', { timeout: 20000 });
  return { ctx, p };
}

try {
  // ---- server without the vehicle routes: no VIN field, the catalogue as before
  const off = await open(false);
  await off.p.waitForTimeout(1500);
  check('serveur sans les routes véhicules : pas de champ VIN, choix manuel toujours là',
    !(await off.p.locator('#veh-vin').count()) && await off.p.locator('#veh-maker').isVisible() && await off.p.locator('#cat-q').isVisible());
  await off.ctx.close();

  const { p } = await open(true);
  await p.waitForSelector('#veh-vin', { timeout: 20000 });
  check('serveur de test : champ VIN affiché', await p.locator('#veh-vin').isVisible());
  const read = async (vin) => {
    await p.locator('#veh-vin').fill(vin);
    await p.locator('form[data-submit="vehVin"] button[type=submit]').click();
    await p.waitForFunction(() => !/Lecture du VIN/.test(document.body.innerText), null, { timeout: 20000 });
    await p.waitForTimeout(500);
    return p.locator('section[aria-label="Véhicule du client"]').innerText();
  };
  const modelLabel = async () => (await p.locator('#veh-model option:checked').innerText()).trim();

  // Golf 7: chosen alone, engine stays "Je ne sais pas" until the seller picks it
  let t = await read('wvw zzz au-zfw 123456');
  check('Golf 7 : VIN lu (tapé avec espaces et minuscules), modèle choisi tout seul, année 2015', /VIN lu : Volkswagen Golf 7/.test(t) && /année 2015/.test(t) && /Golf 7/.test(await modelLabel()), t.slice(0, 300));
  await p.waitForSelector('#veh-engine', { timeout: 20000 });
  check('Golf 7 : moteur « Je ne sais pas » tant que le vendeur ne choisit pas', (await p.locator('#veh-engine').inputValue()) === 'unknown');
  await p.locator('#veh-engine').selectOption({ label: '2.0 TDI (diesel)' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: resolve(shots, '09a-vin-golf7.png') });
  let L = await lookups();
  check('Golf 7 : lecture et choix enregistrés (Golf 7, 2.0 TDI, vendeur)', L[0]?.seller === 'dev.vendeur' && L[0]?.vin === 'WVWZZZAUZFW123456'
    && /Golf 7/.test(L[0]?.chosen_model_label || '') && L[0]?.chosen_engine === '2.0 TDI', JSON.stringify(L[0]).slice(0, 300));

  // W204: found from the Mercedes code
  t = await read('WDD2040081A123456');
  check('W204 : Classe C (W204) choisie toute seule', /VIN lu : Mercedes-Benz Classe C \(W204\)/.test(t) && /W204/.test(await modelLabel()), t.slice(0, 300));

  // BMW: make level, list of models to click
  t = await read('WBA3A5C50CF123456');
  const btns = p.locator('[data-action="vehVinPick"]');
  check('BMW : marque lue, liste de modèles à cliquer, marque déjà choisie', /choisissez le modèle/.test(t) && (await btns.count()) > 1
    && (await p.locator('#veh-maker').inputValue()) === 'BMW', t.slice(0, 300));
  const first = (await btns.first().innerText()).trim();
  await btns.first().click();
  await p.waitForTimeout(800);
  check('BMW : le modèle cliqué est choisi et enregistré', (await modelLabel()) === first && /VIN lu : BMW/.test(await p.locator('section[aria-label="Véhicule du client"]').innerText()));
  await p.screenshot({ path: resolve(shots, '09b-vin-bmw.png') });

  // Renault Arkana: maker known, not in the catalogue
  t = await read('VF1RJL00067123456');
  check('Renault Arkana : « pas dans le catalogue », choix manuel possible', /Constructeur : RENAULT/.test(t) && /pas dans le catalogue/.test(t) && await p.locator('#veh-maker').isEnabled(), t.slice(0, 300));
  // wrong VIN
  t = await read('ABC123');
  check('VIN trop court : message clair', /17 caractères/.test(t), t.slice(0, 200));
  await p.screenshot({ path: resolve(shots, '09c-vin-erreur.png') });

  L = await lookups();
  check('chaque lecture du parcours est enregistrée (5)', ['ABC123', 'VF1RJL00067123456', 'WBA3A5C50CF123456', 'WDD2040081A123456', 'WVWZZZAUZFW123456']
    .every((vin, i) => L[i]?.vin === vin && L[i]?.seller === 'dev.vendeur'), L.slice(0, 5).map((l) => l.vin).join(', '));
  check('aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${ok} OK, ${ko} échec(s)`);
process.exit(ko ? 1 : 0);
