// Construit web/index.html à partir de la maquette validée (doc/maquette/caruno-maquette.html) :
// même interface, données et actions branchées sur Dolibarr par caruno-dolibarr.js.
// Usage : node web/tools/patch-from-mockup.mjs <maquette.html> <sortie.html>
// Chaque remplacement doit trouver son texte exactement une fois, sinon le script s'arrête.
import { readFileSync, writeFileSync } from 'node:fs';

const [src, out] = process.argv.slice(2);
let s = readFileSync(src, 'utf8').replace(/\r\n/g, '\n');
const rep = (a, b) => {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error('Texte trouvé ' + n + ' fois : ' + a.slice(0, 90));
  s = s.replace(a, () => b);
};
const repRe = (re, b) => {
  const m = s.match(re);
  if (!m) throw new Error('Motif introuvable : ' + re);
  s = s.replace(re, () => b);
};
const between = (start, end, b) => {
  const i = s.indexOf(start), j = s.indexOf(end, i);
  if (i < 0 || j < 0) throw new Error('Bloc introuvable : ' + start.slice(0, 60));
  s = s.slice(0, i) + b + s.slice(j);
};

// ---------- en-tête, constantes, données ----------
rep('<script>\n/* ===================================================================\n   CARUNO — maquette autonome du front magasin de pièces auto.\n   Données de test fictives, gardées dans le navigateur (localStorage).\n   Rien n\'est envoyé à Dolibarr.\n   =================================================================== */',
  '<script src="caruno-dolibarr.js"></script>\n<script>\n/* ===================================================================\n   CARUNO — application du magasin de pièces auto.\n   Interface de la maquette validée ; données lues et écrites dans le Dolibarr du magasin (caruno-dolibarr.js).\n   Gardé sur ce poste : commandes en cours, journal des ventes, session de caisse.\n   =================================================================== */');
rep("const KEY = 'caruno-maquette-v5';", "const KEY = 'caruno-app-v1';");
rep("const TODAY = '2026-11-01';", "const TODAY = (() => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); })();");
rep("const DEVICE = 'Comptoir 1';", "const DEVICE = (() => { try { return localStorage.getItem('caruno-device') || 'Comptoir 1'; } catch (e) { return 'Comptoir 1'; } })();");
between('/* ---------- seed data ---------- */', '/* ---------- state ---------- */',
  `/* ---------- données vides : remplies depuis Dolibarr à la connexion ---------- */
function seed() {
  return {
    parts: [], suppliers: [], clients: [], docs: [], pos: [], moves: [], users: [],
    day: { base: 0, count: 0, cash: 0, cheque: 0, virement: 0, sellers: {}, orphans: 0 }, months: {}, monthKeys: [],
    shop: { name: '', address: '', phone: '', rc: '', nif: '', ai: '', nis: '', vat: false },
    stockMode: 'bill', journal: [], bank: { opening: 0, transfers: [], deposits: [] }, posOrders: [], session: null, sessions: [], counters: { V: 0, CS: 0 }
  };
}

`);
rep(`function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.parts && v.posOrders && v.sessions && 'session' in v) return v; } catch (e) {} return seed(); }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S.db)); }
  catch (e) { try { const c = JSON.parse(JSON.stringify(S.db)); c.parts.forEach((p) => { p.photos = []; }); localStorage.setItem(KEY, JSON.stringify(c)); } catch (e2) {} }
}`, `// Les données du magasin viennent de Dolibarr ; seul l'état de ce poste est gardé dans le navigateur.
function load() { return Object.assign(seed(), loadPoste()); }
function save() {
  try { localStorage.setItem(POSTE_KEY, JSON.stringify({ posOrders: S.db.posOrders, journal: S.db.journal, session: S.db.session, sessions: S.db.sessions.slice(0, 30), counters: S.db.counters, stockMode: S.db.stockMode })); } catch (e) {}
}`);
rep("return prefix + (prefix === 'V' ? '-' : '2611-')", "return prefix + (prefix === 'V' ? '-' : TODAY.slice(2, 4) + TODAY.slice(5, 7) + '-')");
rep("function creditOf(cid) { return S.db.docs.filter((d) => d.type === 'avoir' && d.client === cid && d.status === 'a_valoir').reduce((t, d) => t + d.left, 0); }",
  "// Avoirs Dolibarr à valoir : pas encore utilisables comme paiement à la caisse.\nfunction creditOf() { return 0; }");

// ---------- menu, connexion, caisse ----------
rep("'</button></div><span>HANOUT VW (DEV)</span></div>'", "'</button></div><span>' + esc(S.db.shop.name) + '</span></div>'");
rep('flex:1">HANOUT VW</span>', "flex:1\">' + esc(S.db.shop.name) + '</span>");
between('function viewLogin() {', '/* =================================================================== CAISSE',
  `function viewLogin() {
  const L = S.ui.login || (S.ui.login = { url: (() => { try { return localStorage.getItem('caruno-url') || 'http://localhost:8080'; } catch (e) { return 'http://localhost:8080'; } })(), login: '', err: '', busy: false });
  return '<div class="login"><div class="box">' +
    loginMark('Gestion du magasin de pièces') +
    '<form data-submit="login" style="display:flex;flex-direction:column;gap:16px">' +
      '<div class="field"><label for="lg-url">Adresse du Dolibarr du magasin</label><input class="input" id="lg-url" name="url" value="' + esc(L.url) + '" autocomplete="url" placeholder="http://localhost:8080"></div>' +
      '<div class="field"><label for="lg-user">Identifiant</label><input class="input" id="lg-user" name="login" value="' + esc(L.login) + '" autocomplete="username" autocapitalize="none" required></div>' +
      '<div class="field"><label for="pw">Mot de passe</label><input class="input" id="pw" name="password" type="password" autocomplete="current-password" required></div>' +
      (L.err ? '<div class="alert a-bad" role="alert">' + esc(L.err) + '</div>' : '') +
      '<button class="btn btn-primary btn-lg" type="submit"' + (L.busy ? ' disabled' : '') + '>' + (L.busy ? 'Connexion…' : 'Se connecter') + '</button>' +
    '</form>' +
    '<p style="margin:0;color:#C9CBD2;font-size:14px;line-height:1.5">Identifiant et mot de passe Dolibarr du magasin. Les menus et les prix visibles dépendent de vos droits.</p>' +
    '</div></div>';
}
function viewLoading() {
  const err = S.ui.loadErr;
  return '<div class="login"><div class="box">' + loginMark(err ? 'Chargement impossible' : 'Chargement des données du magasin depuis Dolibarr…') +
    (err ? '<div class="alert a-bad" role="alert">' + esc(err) + '</div><button class="btn btn-primary btn-lg" type="button" data-action="reload">Réessayer</button><button class="btn" type="button" data-action="logout">Se déconnecter</button>' : '') + '</div></div>';
}

`);
repRe(/function ribbon\(\) \{ return '<div class="ribbon">.*\n/, "function ribbon() { return ''; }\n");
rep("function newOrder() { return { ref: nextRef('V'), client: 'c',", "function newOrder() { return { ref: nextRef('V'), uid: Math.random().toString(36).slice(2, 8).toUpperCase(), client: DOLI.counterId,");
rep("(o.client !== 'c' ?", "(client(o.client) && !client(o.client).fixed ?");
// Pièces affichées à la caisse : en stock d'abord, puis les plus récentes ; 120 tuiles au plus.
rep("function posResults() { const u = posUi(); return search(u.q, S.db.parts).filter((p) => u.cat === 'Tous' || p.fam === u.cat); }",
  "function posResults() { const u = posUi(); return search(u.q, S.db.parts).filter((p) => u.cat === 'Tous' || p.fam === u.cat).sort((a, b) => ((b.stock['Magasin'] > 0) - (a.stock['Magasin'] > 0)) || b.id - a.id).slice(0, 120); }");
repRe(/ {8}'<div class="demo"><label for="pos-cut">.*\n/, '');
rep("ic('scanner', 20) + 'Simuler un scan</button></div>' +\n      '<div class=\"kbd-hint\">", "ic('scanner', 20) + 'Scanner</button></div>' +\n      '<div class=\"kbd-hint\">");

// ---------- pièces, stock ----------
rep("let list = search(f.q, S.db.parts).filter(", "let list = search(f.q, S.db.parts.slice().sort((a, b) => b.id - a.id)).filter(");
rep("return head('Pièces', S.db.parts.length + ' références · '", "return head('Pièces', (DOLI.total || S.db.parts.length).toLocaleString('fr-FR') + ' références · '");
rep(`data-action="toast" data-arg="Export CSV généré (maquette)">Exporter</button>`, `data-action="exportCsv">Exporter</button>`);
rep("function viewPiece(id) {\n  const p = part(id);\n  if (!p) return head('Pièce introuvable', '', '', ['#/pieces', 'Pièces']);",
  "function viewPiece(id) {\n  const p = part(id);\n  if (!p) { DOLI.need('get:' + id, () => DOLI.fetchParts([Number(id)])); return head(DOLI.lazy['get:' + id] === 'done' ? 'Pièce introuvable' : 'Chargement…', '', '', ['#/pieces', 'Pièces']); }\n  if (!p.extra) DOLI.need('extra:' + id, () => DOLI.loadPartExtra(Number(id)));");
rep("esc(supplier(p.sups[0].sid).name) + (seeCost() ? ' · ' + fmt(p.sups[0].price) : '')", "(p.sups[0] && supplier(p.sups[0].sid) ? esc(supplier(p.sups[0].sid).name) + (seeCost() ? ' · ' + fmt(p.sups[0].price) : '') : '—')");
rep("setForm('transfer', { pid: '4',", "setForm('transfer', { pid: String((S.db.parts.find((x) => total(x) > 0) || S.db.parts[0] || {}).id || ''),");

// ---------- catalogue : même session que l'application ----------
rep("S.ui.cat = { url: saved.url || 'http://localhost:8080', login: saved.login || '', token: saved.token || '',", "S.ui.cat = { url: DOLI.apiRoot(DOLI.url).replace(/\\/api\\/index\\.php$/, ''), login: S.user ? S.user.login : '', token: DOLI.token,");
rep("'<button class=\"btn\" type=\"button\" data-action=\"catLogout\">Se déconnecter de Dolibarr</button>'", "''");

// ---------- ventes, tableau de bord, règlements, profil ----------
rep("if (!d) return head('Document introuvable', '', '', ['#/ventes', 'Ventes']);\n  const c = client(d.client)",
  "if (!d) return head('Document introuvable', '', '', ['#/ventes', 'Ventes']);\n  if (d.type === 'facture' && d.payments === null) DOLI.need('pay:' + d.ref, () => DOLI.loadPayments(d));\n  const c = client(d.client)");
rep("S.ui.editor = { client: params.get('client') || 'g',", "S.ui.editor = { client: params.get('client') || ((S.db.clients.find((x) => !x.fixed) || S.db.clients[0] || {}).id),");
rep(`  const oct = mo['2026-10'], sep = mo['2026-09'];
  const growth = Math.round((oct.ttc - sep.ttc) / sep.ttc * 100);
  const octHt = oct.ttc / (VAT() ? 1.19 : 1), margin = ((octHt - oct.cost) / octHt * 100).toFixed(1).replace('.', ',');`,
`  DOLI.need('day', () => DOLI.loadDayPayments());
  const sep = mo[S.db.monthKeys[0]] || { ttc: 0, cost: 0 }, oct = mo[S.db.monthKeys[1]] || { ttc: 0, cost: 0 };
  const MN = S.db.monthKeys.map((k) => new Date(k + '-01T12:00').toLocaleDateString('fr-FR', { month: 'long' }));
  const growth = sep.ttc ? Math.round((oct.ttc - sep.ttc) / sep.ttc * 100) : 0;
  const octHt = oct.ttc / (VAT() ? 1.19 : 1), margin = octHt ? ((octHt - oct.cost) / octHt * 100).toFixed(1).replace('.', ',') : '0';`);
rep("return head('Tableau de bord', 'Dimanche 1<sup>er</sup> novembre 2026' +", "return head('Tableau de bord', cap(new Date(TODAY + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) +");
rep("tile('Octobre 2026', fmt(oct.ttc), (growth >= 0 ? '+' : '−') + Math.abs(growth) + ' % par rapport à septembre')", "tile(cap(MN[1] || '') + ' ' + (S.db.monthKeys[1] || '').slice(0, 4), fmt(oct.ttc), (growth >= 0 ? '+' : '−') + Math.abs(growth) + ' % par rapport à ' + (MN[0] || ''))");
rep("tile('Marge brute d’octobre',", "tile('Marge brute de ' + (MN[1] || ''),");
rep("  const tab = S.ui.regTab || 'paiements';\n  const all = payments();", "  const tab = S.ui.regTab || 'paiements';\n  DOLI.need('payments', () => DOLI.loadDocPayments(S.db.docs));\n  DOLI.need('day', () => DOLI.loadDayPayments());\n  const all = payments();");
rep("const banque = S.db.bank.opening + all.filter((p) => p.mode === 'virement').reduce((t, p) => t + p.amount, 0) + S.db.bank.deposits.reduce((t, x) => t + x.amount, 0) + cashOut();", "const banque = S.db.bank.opening; // solde du compte banque lu dans Dolibarr");
rep("Définis dans le profil magasin au déploiement, non modifiables ici. Le bandeau de la maquette permet de changer le mode de stock pour la démo.", "Lus dans Dolibarr (fiche de la société) et le profil du magasin.");
rep("Se déconnecter annule le jeton d’accès sur tous vos appareils (POST /login avec reset=1).", "Se déconnecter ferme la session sur ce poste.");
rep("const sc = S.ui.scan, p = S.db.parts.find((x) => x.ean === String(code).trim());", "const sc = S.ui.scan, c = String(code).trim(), p = S.db.parts.find((x) => x.ean === c) || S.db.parts.find((x) => norm(x.ref) === norm(c));");
s = s.split(' (maquette)').join(' (à venir)');
// Prix de référence ou coût à zéro (pièce sans prix, coût inconnu) : pas de pourcentage ni de marge calculés.
rep('const pctTxt = (a, b) => { const v', "const pctTxt = (a, b) => { if (!b) return ''; const v");
rep("p.prices.map((x) => Math.round((x - p.cost) / x * 100) + ' %')", "p.prices.map((x) => (p.cost && x ? Math.round((x - p.cost) / x * 100) + ' %' : '—'))");
rep("tile('Marge brute de ' + (MN[1] || ''), margin + ' %',", "tile('Marge brute de ' + (MN[1] || ''), oct.cost ? margin + ' %' : '—',");

// ---------- enseigne du magasin (logo + nom) à la place de CARUNO ; import de pièces ----------
rep('<div class="brand-row"><b>CARUNO</b>', "<div class=\"brand-row\">' + shopMark() + '");
rep("'</button></div><span>' + esc(S.db.shop.name) + '</span></div>'", "'</button></div></div>'");
rep("<b>CARUNO</b><span style=\"font-size:12px;color:#C9CBD2;flex:1\">' + esc(S.db.shop.name) + '</span>", "' + shopMark(true) + '<span style=\"flex:1\"></span>");
rep('<span class="brand2">CARUNO</span>', "<span class=\"brand2\">' + shopMark(true) + '</span>");
rep("'Nouvelle pièce</a>' : '')", "'Nouvelle pièce</a><button class=\"btn\" type=\"button\" data-action=\"modalImport\">Importer</button>' : '')");
// Traductions arabe et anglaise : dictionnaires chargés avant l'interface.
rep('<script src="caruno-dolibarr.js"></script>', '<script src="i18n-ar.js"></script>\n<script src="i18n-en.js"></script>\n<script src="caruno-dolibarr.js"></script>');

// ---------- caisse : les pièces en liste comme l'écran Pièces (et non en tuiles carrées) ----------
// Même clavier : la ligne en surbrillance (u.hi) est ajoutée par Entrée ; ↑ ↓ changent de ligne.
between('  const tiles = res.length ? res.map((p, idx) => {', '  return posOrderPanel(o, T) +',
`  const tiles = res.length ? '<div class="card" style="overflow:hidden"><div class="table-wrap"><table class="t pos-list" style="min-width:660px"><thead><tr><th>Pièce</th><th>Réf. / OEM</th><th>Empl.</th><th class="right">Magasin</th><th class="right">Réserve</th><th>État</th><th class="right">Prix</th><th></th></tr></thead><tbody>' +
    res.map((p, idx) => {
      const n = inCart(p.id), mag = p.stock['Magasin'], price = ttc(Math.round(p.prices[T.L] * (1 - (c.remise || 0) / 100)), p.tva);
      const act = mag > 0 ? 'data-action="posAdd"' : p.stock['Réserve'] > 0 ? 'data-action="modalTransfer"' : 'data-action="posInfo"';
      return '<tr class="click' + (u.q && idx === u.hi ? ' hi' : '') + '" ' + act + ' data-arg="' + p.id + '">' +
        '<td><div class="cellpart">' + thumb(p, 40) + '<div><b>' + esc(p.name) + '</b>' + (n ? ' <span class="badge b-accent">' + n + ' au panier</span>' : '') + (p.brand ? '<div class="t2">' + esc(p.brand) + '</div>' : '') + '</div></div></td>' +
        '<td><div class="mono">' + esc(p.ref) + '</div>' + (p.oem ? '<div class="mono muted">' + esc(p.oem) + '</div>' : '') + '</td>' +
        '<td class="mono">' + esc(p.loc['Magasin'] || '') + '</td><td class="right num"><b>' + mag + '</b></td><td class="right num">' + p.stock['Réserve'] + '</td>' +
        '<td>' + stockBadge(p) + '</td><td class="right num"><b>' + fmt(price) + '</b></td>' +
        '<td class="right"><button class="icon-btn" type="button" data-action="posInfo" data-arg="' + p.id + '" aria-label="Infos ' + esc(p.brand + ' ' + p.ref) + '">' + ic('info', 16) + '</button></td></tr>';
    }).join('') + '</tbody></table></div></div>'
    : '<p class="empty">Aucune pièce. Essayez la référence OEM ou une autre marque.</p>';
`);
rep(`'<div class="pos-grid">' + tiles + '</div>'`, `'<div class="pos-grid pos-listwrap">' + tiles + '</div>'`);
rep('</style>', '.pos-grid.pos-listwrap{display:block}\n.pos-list tr.hi td{background:#FFF4EC}\n.pos-list tr.hi td:first-child{box-shadow:inset 4px 0 0 var(--accent)}\n</style>');

// ---------- pièces : corbeille (supprimer → corbeille → restaurer ; suppression définitive pour le gérant) ----------
rep(`'/modifier">Modifier</a>' : ''), ['#/pieces', 'Pièces · ' + p.fam])`, `'/modifier">Modifier</a><button class="btn" type="button" data-action="modalTrash" data-arg="' + p.id + '">' + ic('trash', 18) + 'Supprimer</button>' : ''), ['#/pieces', 'Pièces' + (p.fam ? ' · ' + p.fam : '')])`);
rep(`data-action="modalImport">Importer</button>' : '')`, `data-action="modalImport">Importer</button><a class="btn" href="#/pieces/corbeille">' + ic('trash', 18) + 'Corbeille</a>' : '')`);
rep('search(f.q, S.db.parts.slice().sort((a, b) => b.id - a.id))', 'search(f.q, S.db.parts.filter((x) => !x.trash).sort((a, b) => b.id - a.id))');
rep("search(u.q, S.db.parts).filter((p) => u.cat === 'Tous'", "search(u.q, S.db.parts.filter((x) => !x.trash)).filter((p) => u.cat === 'Tous'");

// ---------- prix d'achat : coût moyen (PMP) et dernier achat ; l'alerte retient le plus élevé ----------
rep("sid: p.sups[0] ? p.sups[0].sid : 's1', sref: p.sups[0] ? p.sups[0].ref : '', sprice: p.sups[0] ? p.sups[0].price : '',",
  "sid: p.lastBuy && p.lastBuy.sid ? p.lastBuy.sid : (p.sups[0] ? p.sups[0].sid : ''), sref: p.sups[0] ? p.sups[0].ref : '', sprice: p.lastBuy ? p.lastBuy.price : (p.sups[0] ? p.sups[0].price : ''),");
rep("sid: 's1', sref: '', sprice: '',", "sid: '', sref: '', sprice: '',");
rep(`<select id="f-sid" name="sid">' + S.db.suppliers.map(`, `<select id="f-sid" name="sid"><option value="">— Aucun —</option>' + S.db.suppliers.map(`);
rep("'<span class=\"pc info\" title=\"Coût moyen d’achat (PMP)\"><span>Prix d’achat</span><b class=\"num\">' + fmt(x.p.cost) + xHT()", "'<span class=\"pc info\" title=\"Le plus élevé du coût moyen et du dernier achat\"><span>Prix d’achat</span><b class=\"num\">' + fmt(costRef(x.p)) + xHT()");
rep(`<span>Coût moyen (PMP)</span><b>' + fmt(p.cost) + '</b></div>`, `<span>Coût moyen (PMP)</span><b>' + fmt(p.cost) + '</b></div>' + lastBuyRows(p) + '`);

// Commande fournisseur : le prix d'achat se saisit sur la ligne (il devient le coût du stock à la réception).
rep(`(seeCost() ? '<td class="right num">' + fmt(l.price) + '</td>' : '') + '<td class="right"><button class="icon-btn" type="button" data-action="poDel"`,
  `(seeCost() ? '<td class="right"><label class="sr" for="poep-' + i + '">Prix d’achat</label><input class="input num" style="width:110px" id="poep-' + i + '" inputmode="numeric" value="' + esc(l.price || '') + '" data-input="poPrice" data-arg="' + i + '"></td>' : '') + '<td class="right"><button class="icon-btn" type="button" data-action="poDel"`);

// Équivalences : seulement entre pièces qui ont un OEM (deux OEM vides ne sont pas « la même pièce »).
rep('const eq = S.db.parts.filter((x) => x.oem === p.oem);', 'const eq = S.db.parts.filter((x) => !x.trash && (x.id === p.id || (p.oem && x.oem === p.oem)));');
rep('eq = S.db.parts.filter((x) => x.oem === p.oem && x.id !== p.id);', 'eq = S.db.parts.filter((x) => p.oem && !x.trash && x.oem === p.oem && x.id !== p.id);');

// ---------- caisse : alerte quand le prix tapé passe sous le prix d'achat (vente à perte) ----------
rep(`'</b></button>' + (sel ? lineEdit(o, x, i) : '') + last + '</div>';`, `'</b></button>' + costWarn(x) + (sel ? lineEdit(o, x, i) : '') + last + '</div>';`);
rep(`<input class="input num price-in" id="ln-price-' + i + '"`, `<input class="input num price-in' + (underCost(x) ? ' under-cost' : '') + '" id="ln-price-' + i + '"`);
rep(`(pp.warn ? '<div class="alert a-warn">' + ic('warn', 18, '#9A3412') + esc(pp.warn) + '</div>' : '') +`, `(pp.warn ? '<div class="alert a-warn">' + ic('warn', 18, '#9A3412') + esc(pp.warn) + '</div>' : '') + costAlert(T) +`);
rep('</style>', '.price-in.under-cost{border-color:var(--bad);box-shadow:0 0 0 3px #FDECEC;color:var(--bad)}\n.cost-warn{display:flex;gap:8px;align-items:center;margin:0 14px 8px;padding:7px 10px;border-radius:8px;background:#FDECEC;color:#991B1B;font-size:13px;font-weight:600}\n</style>');

// ---------- catalogue : noms des pièces en français / arabe, modèles de voitures au lieu des codes ----------
rep('<script src="i18n-en.js"></script>', '<script src="i18n-en.js"></script>\n<script src="parts-i18n.js"></script>\n<script src="car-models.js"></script>');
rep(`(t.description:like:'%" + words + "%')" : '';`, `(t.description:like:'%" + words + "%')" + searchExtra(q) : '';`);
rep('[p.name, p.brand, p.ref, p.oem, p.ean, p.fam, p.type].some(', '[p.name, p.brand, p.ref, p.oem, p.ean, p.fam, p.type, partAlt(p)].some(');

// Impression de plusieurs documents (fiche client) : une page par document.
rep('</style>', '.print-multi{display:flex;flex-direction:column;gap:16px}\n@media print{.print-multi,.print-multi *{visibility:visible}.print-multi{position:absolute;left:0;top:0;width:100%;gap:0}.print-multi .print-area{position:static;break-after:page;page-break-after:always}.print-multi .print-area:last-child{break-after:auto;page-break-after:auto}}\n</style>');
// Fiche client : le bouton « Relevé de compte » imprime les opérations du client (factures, versements, avoirs).
rep('data-action="toast" data-arg="Relevé de compte PDF généré (à venir)"', 'data-action="cdStatement" data-arg="\' + c.id + \'"');

// ---------- impression : bon d'achat par défaut, facture A4 ou ticket 80 mm au choix ----------
rep(`printDoc(d, 'ticket') +
      '<div class="actions" style="justify-content:center"><button class="btn btn-outline" type="button" data-action="printNow">' + ic('print', 18) + 'Imprimer le ticket</button><button class="btn btn-outline" type="button" data-action="modalPrint" data-arg="' + d.ref + ':a4">Facture A4</button>`,
`printFormats(posUi().pfmt || 'bon', 'posPrintFmt') + printDoc(d, posUi().pfmt || 'bon') +
      '<div class="actions" style="justify-content:center"><button class="btn btn-primary" type="button" data-action="printNow">' + ic('print', 18) + 'Imprimer</button>`);
rep("[['a4', 'Format A4'], ['ticket', 'Ticket 80 mm']]", "(d.type === 'facture' ? [['bon', 'Bon d’achat'], ['a4', 'Facture A4'], ['ticket', 'Ticket 80 mm']] : [['a4', 'Format A4'], ['ticket', 'Ticket 80 mm']])");

// ---------- rendu : écran de chargement tant que les données Dolibarr arrivent ----------
rep("  if (!S.user) { app.innerHTML = viewLogin(); return; }", "  if (!S.user) { app.innerHTML = viewLogin(); return; }\n  if (!S.ready) { app.innerHTML = viewLoading(); return; }");
// Page « Magasin en ligne » (tools/actions-enligne.js).
rep("  else if (sec === 'profil') html = viewProfil();", "  else if (sec === 'profil') html = viewProfil();\n  else if (sec === 'enligne') html = viewEnLigne();");

// ---------- actions branchées sur Dolibarr, puis démarrage ----------
rep('\nrender();\n</script>', '\n' + ['./actions.js', './actions-profil-import.js', './actions-vehicle.js', './actions-dashboard.js', './actions-enligne.js'].map((p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')).join('\n') + '</script>');
writeFileSync(out, s);
console.log('OK ' + out);
