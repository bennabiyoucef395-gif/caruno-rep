// Parcours navigateur (Edge, playwright-core) du choix du véhicule dans le Catalogue : marque → modèle → moteur.
// LECTURE SEULE : aucune donnée n'est écrite dans Dolibarr. Données véhicules attendues dans web/data/parts/
// (scripts/parts/export.sh du dépôt caruno-erp). Usage : node web/tools/e2e-vehicle.mjs
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
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
if (!existsSync(resolve(here, '../data/parts/index.json'))) { console.log('Données véhicules absentes : lancer scripts/parts/export.sh avec PARTS_JSON_DIR=web/data/parts'); process.exit(1); }

let ok = 0, ko = 0;
const check = (name, cond, detail = '') => { if (cond) { ok++; console.log('OK   ' + name); } else { ko++; console.log('FAIL ' + name + (detail ? ' :: ' + String(detail).slice(0, 300) : '')); } };
const PORT = Number(process.env.E2E_PORT) || 8086;
const server = await serve(PORT);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];

try {
  const p = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:' + PORT + '/');
  if (!(await p.locator('#lg-url').isVisible())) await p.locator('[data-action="loginUrlEdit"]').click();
  await p.locator('#lg-url').fill(DOLI.replace(/^https?:\/\//, ''));
  await p.locator('#lg-user').fill('dev.vendeur');
  await p.locator('#pw').fill(secrets.TEST_PW_DEV_VENDEUR);
  await p.locator('form[data-submit="login"] button[type=submit]').click();
  await p.waitForSelector('.shell, .pos', { timeout: 60000 });
  await p.evaluate(() => { location.hash = '#/catalogue'; });
  await p.waitForSelector('#veh-maker', { timeout: 20000 });
  check('catalogue : choix du véhicule affiché, recherche Dolibarr toujours là', await p.locator('#cat-q').isVisible());

  const rows = () => p.locator('table.t tbody').innerText();
  const settle = async () => { await p.waitForTimeout(400); await p.waitForFunction(() => !/Chargement/.test(document.querySelector('table.t tbody')?.innerText || 'Chargement'), null, { timeout: 20000 }).catch(() => {}); };
  const pick = async (id, label) => { await p.locator('#' + id).selectOption({ label }); await settle(); };
  const engines = async () => (await p.locator('#veh-engine option').allInnerTexts()).map((s) => s.trim());

  // Golf 7
  await pick('veh-maker', 'Volkswagen');
  await p.locator('#veh-model').selectOption({ label: 'Golf 7 2012–2020' }); await p.waitForSelector('#veh-engine', { timeout: 20000 }); await settle();
  const ge = await engines();
  check('Golf 7 : moteurs proposés + « Je ne sais pas » en dernier', ge.includes('2.0 TDI (diesel)') && ge.includes('1.4 TSI (essence)') && ge[ge.length - 1] === 'Je ne sais pas' && !ge.includes('2.0 (essence ou diesel)'), ge.join(' | '));
  check('Golf 7 : « Je ne sais pas » choisi par défaut', (await p.locator('#veh-engine').inputValue()) === 'unknown');
  await p.locator('#veh-fam').selectOption({ label: 'Filtre à huile' }); await settle();
  let t = await rows(), body = await p.locator('body').innerText();
  check('Golf 7, Je ne sais pas, filtre à huile : aucune pièce affichée compatible, le moteur est demandé', !/Compatible/.test(t) && /dépendent du moteur/.test(body), t.slice(0, 200));
  await p.screenshot({ path: resolve(shots, '08a-vehicule-golf7-inconnu.png') });
  await pick('veh-engine', '1.4 TSI (essence)');
  t = await rows();
  check('Golf 7 1.4 TSI, filtre à huile : filtres compatibles, lus dans Dolibarr', /Compatible/.test(t) && !/Chargement|Pas encore dans les pièces/.test(t), t.slice(0, 200));
  await p.screenshot({ path: resolve(shots, '08b-vehicule-golf7-14tsi.png') });
  await pick('veh-engine', '2.0 TDI (diesel)');
  t = await rows();
  check('Golf 7 2.0 TDI, filtre à huile : les filtres des TSI ne sont pas proposés', /Aucune pièce compatible/.test(t), t.slice(0, 200));
  await p.locator('#veh-fam').selectOption({ label: 'Toute la famille Freinage' }); await settle();
  t = await rows();
  check('Golf 7 2.0 TDI, freinage : disques et plaquettes compatibles', /Compatible/.test(t) && /\d{6}/.test(t), t.slice(0, 200));

  // Audi A4 B8
  await pick('veh-maker', 'Audi');
  await p.locator('#veh-model').selectOption({ label: 'A4 (B8) 2007–2015' }); await p.waitForSelector('#veh-engine', { timeout: 20000 }); await settle();
  const ae = await engines();
  check('A4 B8 : 2.0 TFSI et 2.0 TDI proposés, pas de 4.0 TFSI', ae.includes('2.0 TFSI (essence)') && ae.includes('2.0 TDI (diesel)') && !ae.some((x) => /^4\.0/.test(x)), ae.join(' | '));
  await pick('veh-engine', '2.0 TDI (diesel)');
  await p.locator('#veh-fam').selectOption({ label: 'Filtre à huile' }); await settle();
  t = await rows();
  check('A4 B8 2.0 TDI, filtre à huile : « À confirmer » avec la source', /À confirmer/.test(t) && /Moteur non précisé par la source/.test(t) && !/Compatible/.test(t), t.slice(0, 200));
  await p.screenshot({ path: resolve(shots, '08c-vehicule-a4b8-tdi-filtre.png') });

  // Recherche dans les pièces du véhicule, ouverture d'une fiche, retour : le véhicule reste choisi.
  await p.locator('#veh-fam').selectOption({ label: 'Toutes les familles' }); await settle();
  await p.locator('#veh-q').fill('disque'); await settle();
  t = await rows();
  check('A4 B8 : recherche « disque » dans les pièces du véhicule', /isque|Disc/i.test(t) && !/Filtre à huile/.test(t), t.slice(0, 200));
  await p.locator('table.t tbody tr.click').first().click();
  await p.waitForSelector('text=Compatibilité (catalogue fournisseur)', { timeout: 20000 });
  check('fiche pièce ouverte depuis la liste du véhicule', true);
  await p.evaluate(() => { location.hash = '#/catalogue'; }); await settle();
  check('retour au catalogue : véhicule et moteur gardés', (await p.locator('#veh-model').inputValue()) !== '' && /2\.0 TDI/.test(await p.locator('#veh-engine option:checked').innerText()));
  check('marque TIBAO jamais affichée', !/TIBAO/i.test(await p.locator('body').innerText()));

  // En arabe : textes du choix du véhicule traduits, moteurs avec le carburant en arabe.
  await p.evaluate(() => { location.hash = '#/profil'; }); await p.waitForTimeout(300);
  await p.locator('[data-action="setLang"][data-arg="ar"]').click(); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/catalogue'; }); await settle();
  const ar = await p.locator('body').innerText(), arEng = (await engines()).join(' | ');
  check('en arabe : choix du véhicule et compatibilité traduits', /التوافق/.test(ar) && /مسح السيارة/.test(ar) && /قطعة لـ/.test(ar) && /لا أعرف/.test(arEng) && /ديزل/.test(arEng) && !/Compatibilité|Effacer le véhicule|Je ne sais pas/.test(ar + arEng), arEng);
  await p.screenshot({ path: resolve(shots, '08d-vehicule-ar.png') });
  await p.evaluate(() => { location.hash = '#/profil'; }); await p.waitForTimeout(300);
  await p.locator('[data-action="setLang"][data-arg="fr"]').click(); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/catalogue'; }); await settle();

  await p.locator('[data-action="vehClear"]').click(); await settle();
  check('« Effacer le véhicule » revient à la recherche Dolibarr', await p.locator('#cat-q').isVisible() && (await p.locator('#veh-maker').inputValue()) === '');
} catch (e) {
  ko++; console.log('ERR  ' + (e && e.message ? e.message.split('\n')[0] : e));
} finally {
  console.log('Erreurs JS dans la page : ' + (errors.length ? errors.join(' | ') : 'aucune'));
  console.log('\n' + ok + ' OK, ' + ko + ' échec(s) — captures : ' + shots);
  await browser.close(); server.close();
  process.exit(ko || errors.length ? 1 : 0);
}
