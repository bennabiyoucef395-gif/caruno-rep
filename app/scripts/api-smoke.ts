// Essai du client Dolibarr contre une instance de développement (jamais en production : crée une vente de test).
// Usage : npm run test:api   (DOLI_URL, CARUNO_TEST_USERS pour changer l'instance ou le fichier des mots de passe)
import { readFileSync } from 'node:fs';
import { Dolibarr, apiRoot, isAddress, capabilities, DolibarrError } from '../src/lib/dolibarr.ts';

const url = process.env.DOLI_URL || 'http://localhost:8080';
const usersFile = process.env.CARUNO_TEST_USERS || 'C:/Users/TRETEC/caruno-data/instances/hanout-vw/test-users.env';
const secrets = Object.fromEntries(readFileSync(usersFile, 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

let ok = 0, ko = 0;
const check = (name: string, cond: unknown, detail = '') => { if (cond) { ok++; console.log('OK   ' + name); } else { ko++; console.log('FAIL ' + name + (detail ? ' :: ' + detail : '')); } };

async function main() {
  check('adresse sans http:// complétée (local → http)', apiRoot('localhost:8080') === 'http://localhost:8080/api/index.php', apiRoot('localhost:8080'));
  check('adresse sans http:// complétée (internet → https)', apiRoot('erp.boutique.dz/') === 'https://erp.boutique.dz/api/index.php');
  check('adresse complète gardée', apiRoot('http://x:8080/api/index.php') === 'http://x:8080/api/index.php');
  check('adresse copiée du navigateur ramenée à la racine', apiRoot('http://localhost:8080/index.php?mainmenu=home') === 'http://localhost:8080/api/index.php' && apiRoot('localhost:8080/societe/card.php?id=3') === 'http://localhost:8080/api/index.php' && apiRoot('https://x.dz/dolibarr/product/list.php') === 'https://x.dz/dolibarr/api/index.php' && apiRoot('http://x/api/index.php/explorer') === 'http://x/api/index.php');
  check('nom du magasin refusé comme adresse', !isAddress('city makoudi 2') && !isAddress('CARUNO') && isAddress('localhost:8080') && isAddress('erp.boutique.dz') && isAddress('http://192.168.1.20'));
  const unreachable = await new Dolibarr('localhost').ping();
  check('adresse sans port : message qui montre l’adresse essayée', !unreachable.ok && unreachable.message.includes('http://localhost'), unreachable.message);
  const noScheme = await new Dolibarr(url.replace(/^https?:\/\//, '')).ping();
  check('ping sur l’adresse sans http:// : joignable', noScheme.ok, noScheme.message);

  const anon = new Dolibarr(url);
  const ping = await anon.ping();
  check('ping sans jeton : API joignable', ping.ok, ping.message);
  check('ping sur une adresse fausse : refusé', !(await new Dolibarr('http://localhost:1').ping()).ok);

  let bad = false; try { await new Dolibarr(url).login('dev.vendeur', 'mauvais'); } catch (e) { bad = (e as DolibarrError).status >= 400; }
  check('mauvais mot de passe refusé', bad);

  const v = new Dolibarr(url); await v.login('dev.vendeur', secrets.TEST_PW_DEV_VENDEUR);
  const me = await v.me(); const cap = capabilities(me.rights);
  check('vendeur connecté (users/info)', me.login === 'dev.vendeur');
  check('vendeur : vend, ne voit pas les coûts, pas de banque', cap.sell && !cap.seeCost && !cap.bank, JSON.stringify(cap));

  const g = new Dolibarr(url); await g.login('dev.gerant', secrets.TEST_PW_DEV_GERANT);
  const capG = capabilities((await g.me()).rights);
  check('gérant : voit les coûts, banque, crée des pièces', capG.seeCost && capG.bank && capG.createProduct, JSON.stringify(capG));

  const pt = await v.paymentTypes();
  check('modes de paiement lus (LIQ, CHQ, VIR)', pt.LIQ && pt.CHQ && pt.VIR, JSON.stringify(pt));

  const found = await v.searchProducts('TEST-STK');
  check('recherche par référence', found.some((p) => p.ref === 'TEST-STK-002'));
  const byOem = await v.searchProducts('1K0505279A');
  check('recherche par OEM (champ oem_ref)', byOem.length > 0, String(byOem.length));
  check('recherche vide = rien', (await v.searchProducts('   ')).length === 0);

  const custs = await v.searchCustomers('comptoir');
  check('recherche client', custs.some((c) => /comptoir/i.test(c.name)));

  // Vente comptoir complète, telle que la fait l'écran Caisse.
  const counter = custs.find((c) => /comptoir/i.test(c.name))!;
  const before = (await v.product(4)).stock;
  const refExt = 'CARUNO-TEST-' + Date.now();
  const id = await v.createInvoice(counter.id, [{ productId: 4, qty: 1, price: 150 }], refExt, 'Essai api-smoke');
  check('facture brouillon créée', id > 0);
  const again = await v.invoiceByRefExt(refExt);
  check('reprise : facture retrouvée par ref_ext', again && Number(again.id) === id);
  await v.validateInvoice(id, 1);
  const inv = await v.invoice(id);
  check('facture validée (numéro définitif)', Number(inv.statut) === 1 && !/PROV/.test(inv.ref), inv.ref);
  check('stock sorti du Magasin', (await v.product(4)).stock === before - 1);
  await v.payInvoice(id, Number(inv.remaintopay ?? 150) || 150, pt.LIQ, 1, refExt);
  const paid = await v.invoice(id);
  check('payée en espèces sur le compte CAISSE', Number(paid.statut) === 2, 'statut ' + paid.statut);

  let bankRefused = false; try { await v.addBankLine(1, 'Essai interdit', 1); } catch (e) { bankRefused = (e as DolibarrError).status === 401 || (e as DolibarrError).status === 403; }
  check('vendeur : ligne bancaire refusée par Dolibarr', bankRefused);

  const ev = await v.addAgendaEvent(me.id, 'Essai rapport de caisse (api-smoke)', 'Rapport de session de test.');
  check('vendeur : événement d’agenda (rapport de caisse) créé', ev > 0);

  console.log('\n' + ok + ' OK, ' + ko + ' échec(s)');
  process.exit(ko ? 1 : 0);
}
main().catch((e) => { console.error('ERREUR', e); process.exit(1); });
