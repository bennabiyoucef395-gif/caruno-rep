// Parcours complet dans le navigateur (Edge installé, piloté par playwright-core) contre un Dolibarr de DÉVELOPPEMENT :
// paramètres → connexion → ouverture de caisse → vente au clavier → contrôle dans Dolibarr → arabe → pièce depuis le catalogue → clôture.
// Crée des données de test (facture, pièce CARUNO-E2E-…, rapport d'agenda). Usage : npm run build:web && node scripts/e2e.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serve } from './serve-dist.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const DOLI = process.env.DOLI_URL || 'http://localhost:8080';
const usersFile = process.env.CARUNO_TEST_USERS || 'C:/Users/TRETEC/caruno-data/instances/hanout-vw/test-users.env';
const shots = process.env.SHOTS_DIR || resolve(here, '../.e2e-shots');
const secrets = Object.fromEntries(readFileSync(usersFile, 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
mkdirSync(shots, { recursive: true });

let ok = 0, ko = 0;
const check = (name, cond, detail = '') => { if (cond) { ok++; console.log('OK   ' + name); } else { ko++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); } };
const api = async (path, token, opts = {}) => { const r = await fetch(DOLI + '/api/index.php/' + path, { ...opts, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { DOLAPIKEY: token } : {}) } }); return r.json(); };
const focused = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName || '');
const waitFocus = (page, id) => page.waitForFunction((x) => document.activeElement?.getAttribute('data-testid') === x, id, { timeout: 8000 }).then(() => true, () => false);

const PORT = Number(process.env.E2E_PORT) || 8083;
const server = await serve(PORT);
const BASE = 'http://localhost:' + PORT;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: 'fr-FR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));

  // 1. Premier lancement : Paramètres, test de connexion, enregistrement.
  await page.goto(BASE);
  await page.getByTestId('set-url').waitFor();
  check('premier lancement → Paramètres', page.url().includes('/parametres'));
  await page.getByTestId('set-url').fill('http://localhost:1');
  await page.getByTestId('set-test').click();
  check('test de connexion : adresse fausse refusée', /✕/.test(await page.getByTestId('set-test-result').innerText()));
  await page.getByTestId('set-url').fill(BASE);
  await page.getByTestId('set-test').click();
  check('test de connexion : une page web qui n’est pas Dolibarr est refusée', /✕/.test(await page.getByTestId('set-test-result').innerText()));
  // Adresse saisie sans http:// (cas réel d'un utilisateur) : complétée par l'app.
  await page.getByTestId('set-url').fill(DOLI.replace(/^https?:\/\//, ''));
  await page.getByTestId('set-test').click();
  check('test de connexion : adresse sans http:// joignable', /✓/.test(await page.getByTestId('set-test-result').innerText()));
  await page.getByTestId('set-save').click();
  await page.getByTestId('set-continue').click();
  await page.getByTestId('login-user').waitFor();
  await page.screenshot({ path: resolve(shots, '01-connexion.png') });

  // 2. Mauvais mot de passe : message de refus ; puis connexion vendeur.
  await page.getByTestId('login-user').fill('dev.vendeur');
  await page.getByTestId('login-pw').fill('mauvais');
  await page.getByTestId('login-submit').click();
  await page.getByText('Identifiant ou mot de passe refusé.').waitFor({ timeout: 10000 }).catch(() => {});
  check('mauvais mot de passe : refus clair', /Identifiant ou mot de passe refusé/.test(await page.locator('body').innerText()));
  await page.getByTestId('login-user').fill('dev.vendeur');
  await page.getByTestId('login-pw').fill(secrets.TEST_PW_DEV_VENDEUR);
  await page.getByTestId('login-submit').click();
  await page.waitForURL('**/caisse', { timeout: 15000 });
  check('vendeur connecté → caisse', page.url().endsWith('/caisse'));

  // 3. Ouverture de caisse si besoin.
  await page.waitForSelector('[data-testid="pos-float"], [data-testid="pos-q"]', { timeout: 15000 });
  const float = page.getByTestId('pos-float');
  if (await float.isVisible().catch(() => false)) { await page.screenshot({ path: resolve(shots, '02a-ouverture.png') }); await float.fill('10000'); await page.getByTestId('pos-open').click(); }
  await page.getByTestId('pos-q').waitFor();
  check('caisse ouverte, curseur dans la recherche', await waitFocus(page, 'pos-q'));

  // 4. Vente au clavier : recherche → Entrée → prix → Entrée → quantité → Entrée → recherche → Entrée → paiement → montant → Entrée.
  await page.keyboard.type('TEST-STK-002');
  await page.getByTestId('res-0').waitFor({ timeout: 10000 });
  await page.keyboard.press('Enter');
  check('Entrée : pièce ajoutée, curseur sur son prix', await waitFocus(page, 'price-0'));
  await page.keyboard.type('150');
  await page.keyboard.press('Enter');
  check('Entrée dans le prix → quantité', await waitFocus(page, 'qty-0'));
  await page.keyboard.press('ArrowUp');
  check('↑ dans la quantité ajoute une pièce', (await page.getByTestId('qty-0').inputValue()) === '2');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  check('Entrée dans la quantité → recherche', await waitFocus(page, 'pos-q'));
  check('total = 150 DA', /150\s?DA/.test((await page.getByTestId('pos-total').innerText()).replace(/\u202f|\u00a0/g, ' ')));
  await page.screenshot({ path: resolve(shots, '02-caisse.png') });
  await page.keyboard.press('Enter');
  check('Entrée sur recherche vide → paiement, montant prêt', await waitFocus(page, 'pay-amt-0'));
  await page.screenshot({ path: resolve(shots, '03-paiement.png') });
  await page.keyboard.type('200');
  await page.keyboard.press('Enter');
  await page.getByTestId('pos-receipt').waitFor({ timeout: 20000 });
  const receipt = (await page.locator('body').innerText()).replace(/\u202f|\u00a0/g, ' ');
  check('vente encaissée : ticket affiché', /Paiement réussi/.test(receipt));
  check('rendu monnaie 50 DA', /50 DA/.test(receipt));
  const ref = (receipt.match(/IN\d{4}-\d{4}/) || [])[0];
  check('numéro de facture définitif', !!ref, receipt.slice(0, 200));
  await page.screenshot({ path: resolve(shots, '04-ticket.png') });

  // 5. Contrôle dans Dolibarr (compte gérant).
  const gTok = (await api('login', '', { method: 'POST', body: JSON.stringify({ login: 'dev.gerant', password: secrets.TEST_PW_DEV_GERANT, reset: 0 }) })).success.token;
  const invs = await api('invoices?sqlfilters=' + encodeURIComponent("(t.ref:=:'" + ref + "')"), gTok);
  const inv = Array.isArray(invs) ? invs[0] : null;
  check('Dolibarr : facture payée, 150 DA, ref_ext CARUNO', inv && Number(inv.statut) === 2 && Math.round(Number(inv.total_ttc)) === 150 && /^V-/.test(inv.ref_ext), JSON.stringify(inv && { s: inv.statut, t: inv.total_ttc, r: inv.ref_ext }));

  await page.keyboard.press('Enter');
  check('Entrée sur le ticket → nouvelle commande, curseur dans la recherche', await waitFocus(page, 'pos-q'));

  // 6. Multilingue : arabe (droite à gauche) puis retour au français.
  await page.goto(BASE + '/parametres');
  await page.getByTestId('lang-ar').click();
  check('arabe : page en droite-à-gauche', (await page.evaluate(() => document.documentElement.dir)) === 'rtl');
  check('arabe : textes traduits', /الإعدادات/.test(await page.locator('body').innerText()));
  await page.screenshot({ path: resolve(shots, '05-parametres-ar.png') });
  await page.getByTestId('lang-en').click();
  check('anglais : textes traduits, gauche-à-droite', /Settings/.test(await page.locator('body').innerText()) && (await page.evaluate(() => document.documentElement.dir)) === 'ltr');
  await page.getByTestId('lang-fr').click();

  // 7. Pièces : le vendeur ne crée pas de pièce.
  await page.goto(BASE + '/pieces');
  await page.getByTestId('pieces-q').waitFor();
  check('vendeur : pas de bouton « Nouvelle pièce »', !(await page.getByTestId('pieces-new').isVisible().catch(() => false)));

  // 8. Clôture de caisse (vendeur : rapport dans l'agenda, écritures bancaires laissées au responsable).
  await page.goto(BASE + '/caisse');
  await page.getByTestId('pos-close').click();
  await page.getByTestId('pos-counted').waitFor();
  await page.screenshot({ path: resolve(shots, '06-cloture.png') });
  await page.getByTestId('pos-close-confirm').click();
  await page.getByTestId('pos-float').waitFor({ timeout: 15000 });
  check('caisse fermée : retour à l’ouverture', await page.getByTestId('pos-float').isVisible());

  // 9. Gérant : nouvelle pièce depuis le catalogue commun.
  const ctxG = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: 'fr-FR' });
  await ctxG.addInitScript((url) => { localStorage.setItem('caruno:device', JSON.stringify({ dolibarrUrl: url, deviceName: 'Bureau', lang: 'fr', catalogueUrl: '/catalogue/tibao-2025.json' })); }, DOLI);
  const pg = await ctxG.newPage();
  pg.on('pageerror', (e) => errors.push(e.message));
  await pg.goto(BASE + '/connexion');
  await pg.getByTestId('login-user').fill('dev.gerant');
  await pg.getByTestId('login-pw').fill(secrets.TEST_PW_DEV_GERANT);
  await pg.getByTestId('login-submit').click();
  await pg.waitForURL('**/caisse', { timeout: 15000 });
  await pg.goto(BASE + '/pieces');
  await pg.getByTestId('pieces-q').fill('TEST-STK');
  await pg.getByText('TEST-STK-001').first().waitFor({ timeout: 10000 }).catch(() => {});
  check('gérant : liste des pièces depuis Dolibarr', /TEST-STK-001/.test(await pg.locator('body').innerText()));
  await pg.screenshot({ path: resolve(shots, '07-pieces.png') });
  await pg.getByTestId('pieces-new').click();
  await pg.getByTestId('cat-q').waitFor({ timeout: 15000 });
  await pg.getByTestId('cat-q').fill('028145271K');
  await pg.getByTestId('cat-hit-420218').waitFor({ timeout: 10000 });
  await pg.getByTestId('cat-hit-420218').click();
  check('catalogue : fiche choisie, champs remplis', (await pg.getByTestId('np-label').inputValue()) === 'V-Belt' && (await pg.getByTestId('np-ref').inputValue()) === '420218');
  const newRef = 'CARUNO-E2E-' + Date.now();
  await pg.getByTestId('np-ref').fill(newRef);
  await pg.getByTestId('np-price').fill('1234');
  await pg.screenshot({ path: resolve(shots, '08-nouvelle-piece.png') });
  await pg.getByTestId('np-create').click();
  await pg.getByText(newRef + ' créée', { exact: false }).waitFor({ timeout: 15000 }).catch(() => {});
  const prods = await api('products?sqlfilters=' + encodeURIComponent("(t.ref:=:'" + newRef + "')"), gTok);
  const prod = Array.isArray(prods) ? prods[0] : null;
  check('Dolibarr : pièce créée, liée au catalogue (ref_ext)', prod && prod.ref_ext === 'tibao:420218' && prod.array_options?.options_oem_ref === '028145271K', JSON.stringify(prod && { ref_ext: prod.ref_ext, oem: prod.array_options?.options_oem_ref }));
} catch (e) {
  ko++; console.log('ERR  ' + (e && e.message ? e.message.split('\n')[0] : e));
} finally {
  console.log('Erreurs JS dans la page : ' + (errors.length ? errors.join(' | ') : 'aucune'));
  console.log('\n' + ok + ' OK, ' + ko + ' échec(s) — captures : ' + shots);
  await browser.close();
  server.close();
  process.exit(ko || errors.length ? 1 : 0);
}
