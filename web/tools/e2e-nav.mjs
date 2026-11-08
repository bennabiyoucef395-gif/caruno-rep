// Parcours navigateur : bouton « Retour » sur chaque page et animation au changement de page (pas pendant la frappe).
// Dolibarr de TEST (8081), lecture seule.
// Usage : node web/tools/e2e-nav.mjs
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
const server = await serve(Number(process.env.E2E_PORT) || 8092);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];

async function signIn(login, pw, opts = {}) {
  const p = await (await browser.newContext({ viewport: { width: 1400, height: 1000 }, ...opts })).newPage();
  p.on('pageerror', (e) => errors.push(login + ': ' + e.message));
  await p.goto('http://localhost:' + server.address().port + '/');
  if (!(await p.locator('#lg-url').isVisible())) await p.locator('[data-action="loginUrlEdit"]').click();
  await p.locator('#lg-url').fill(DOLI.replace(/^https?:\/\//, ''));
  await p.locator('#lg-user').fill(login); await p.locator('#pw').fill(pw);
  await p.locator('form[data-submit="login"] button[type=submit]').click();
  await p.waitForSelector('.shell, .pos', { timeout: 60000 });
  return p;
}
// Animations de page relevées à chaque changement du DOM (la classe ne reste que 240 ms) : reset() vide le relevé, anim() le lit.
const watch = (p) => p.evaluate(() => {
  window.__seen = [];
  new MutationObserver(() => { const c = document.getElementById('content'), m = c && c.className.match(/cr-enter-\w+/); if (m && window.__seen[window.__seen.length - 1] !== m[0]) window.__seen.push(m[0]); })
    .observe(document.getElementById('app'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
});
const reset = async (p) => { await p.waitForTimeout(350); await p.evaluate(() => { window.__seen = []; }); };   // après la fin de l'animation précédente
const anim = (p) => p.evaluate(() => (window.__seen || []).join(','));
const backText = (p) => p.evaluate(() => { const b = document.querySelector('#content .page-back'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : ''; });
const goNav = async (p, id) => { await reset(p); await p.locator('.side .nav a[href="#/' + id + '"]').click(); await p.waitForFunction((h) => location.hash === h, '#/' + id); };

try {
  const token = (await call('login', '', { method: 'POST', body: JSON.stringify({ login: 'dev.gerant', password: secrets.TEST_PW_DEV_GERANT }) })).success.token;
  const part = (await call('products?' + new URLSearchParams({ sqlfilters: "(t.ref:=:'TEST-STK-001')" }), token))[0];

  const g = await signIn('dev.gerant', secrets.TEST_PW_DEV_GERANT);
  await g.waitForTimeout(800); await watch(g);
  check('première page : pas de bouton Retour', (await backText(g)) === '', await backText(g));

  await goNav(g, 'pieces');
  check('nouvelle page : animation « en avant »', (await anim(g)) === 'cr-enter-fwd', await anim(g));
  check('Pièces : « Retour · Tableau de bord »', (await backText(g)) === 'Retour·Tableau de bord', await backText(g));
  await g.screenshot({ path: resolve(shots, '12a-nav-retour.png') });
  await g.waitForTimeout(600); await reset(g);
  await g.locator('#pf-q').pressSequentially('frein', { delay: 60 });
  check('frappe dans la recherche : pas d\'animation', (await anim(g)) === '', await anim(g));
  check('frappe : le champ garde le texte', (await g.locator('#pf-q').inputValue()) === 'frein');

  await goNav(g, 'clients');
  check('Clients : « Retour · Pièces »', (await backText(g)) === 'Retour·Pièces', await backText(g));
  await reset(g); await g.locator('#content .page-back').click();
  await g.waitForFunction(() => location.hash === '#/pieces');
  check('Retour : revient à Pièces, animation « en arrière »', (await anim(g)) === 'cr-enter-back', await anim(g));
  check('après Retour : « Retour · Tableau de bord »', (await backText(g)) === 'Retour·Tableau de bord', await backText(g));

  await goNav(g, 'stock');
  await reset(g); await g.goBack(); await g.waitForFunction(() => location.hash === '#/pieces');
  check('bouton précédent du navigateur : compté comme un retour', (await anim(g)) === 'cr-enter-back' && (await backText(g)) === 'Retour·Tableau de bord', (await anim(g)) + ' / ' + (await backText(g)));

  if (part) {
    await g.evaluate((id) => { location.hash = '#/pieces/' + id; }, part.id); await g.waitForTimeout(1200);
    const n = await g.locator('#content .page-back').count(), own = await g.locator('#content .page-head a[href="#/pieces"]').count();
    check('fiche pièce : son lien de retour, pas de doublon', n === 0 && own === 1, n + ' / ' + own);
  } else check('fiche pièce : fixture TEST-STK-001 trouvée', false);

  // Arabe : texte traduit, flèche et glissement inversés.
  await g.evaluate(() => { location.hash = '#/profil'; }); await g.locator('[data-action="setLang"][data-arg="ar"]').click();
  await g.waitForTimeout(400);
  await goNav(g, 'clients');
  const ar = await backText(g);
  check('arabe : « رجوع · ملفي »', ar === 'رجوع·ملفي', ar);
  await g.screenshot({ path: resolve(shots, '12b-nav-retour-ar.png') });
  await g.locator('[data-action="navBack"]').click(); await g.waitForFunction(() => location.hash === '#/profil');
  await g.locator('[data-action="setLang"][data-arg="fr"]').click();

  // Moins d'animations demandé par le système : la page ne bouge pas.
  const r = await signIn('dev.gerant', secrets.TEST_PW_DEV_GERANT, { reducedMotion: 'reduce' });
  await goNav(r, 'pieces');
  const name = await r.evaluate(() => getComputedStyle(document.getElementById('content')).animationName);
  check('prefers-reduced-motion : aucune animation', name === 'none', name);
} catch (e) {
  ko++; console.log('ERR  ' + (e && e.message ? e.message.split('\n')[0] : e));
} finally {
  console.log('Erreurs JS dans la page : ' + (errors.length ? errors.join(' | ') : 'aucune'));
  console.log('\n' + ok + ' OK, ' + ko + ' échec(s) — captures : ' + shots);
  await browser.close(); server.close();
  process.exit(ko || errors.length ? 1 : 0);
}
