/* ===================================================================
   CARUNO ↔ Dolibarr : la maquette validée devient l'application.
   Ce fichier remplit les données de la maquette (S.db) depuis l'API REST du Dolibarr du magasin
   et y écrit les actions (ventes, pièces, stock, clients, règlements). Il est chargé avant le script
   de l'interface et n'utilise S, WAREHOUSES, FAMILIES… qu'au moment des appels.
   Gardé sur ce poste seulement : commandes en cours, journal des ventes, session de caisse.
   =================================================================== */
'use strict';

const DOLI = {
  url: '', token: '', me: null, rights: {},
  whId: {}, whName: {}, famCat: {}, payType: {}, total: 0, counterId: '5', cashAccount: 1, bankAccount: 2,
  loading: false, error: '', lazy: {},

  // ---------- appel REST ----------
  apiRoot(url) {
    let u = String(url || '').trim().replace(/[?#].*$/, '');
    if (u && !/^https?:\/\//i.test(u)) u = (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u) ? 'http://' : 'https://') + u;
    const i = u.search(/\/api\/index\.php(\/|$)/);
    if (i >= 0) return u.slice(0, i) + '/api/index.php';
    return u.replace(/(\/(admin|comm|commande|compta|core|expedition|fourn|product|projet|societe|user))?\/[^/]*\.php(\/.*)?$/i, '').replace(/\/+$/, '') + '/api/index.php';
  },
  async api(path, opts) {
    const o = opts || {};
    const q = Object.entries(o.query || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
    const url = this.apiRoot(this.url) + '/' + path.replace(/^\//, '') + (q.length ? '?' + q.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v))).join('&') : '');
    const headers = { Accept: 'application/json' };
    if (this.token) headers.DOLAPIKEY = this.token;
    if (o.body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    // Lecture : Dolibarr chargé (démarrage, beaucoup de requêtes) peut couper une requête ; deux nouvelles tentatives.
    // Les écritures ne sont jamais rejouées (pas de double vente, de double mouvement).
    const read = (o.method || 'GET') === 'GET';
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(url, { method: o.method || 'GET', headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
        if (read && res.status >= 500 && attempt < 2) { await new Promise((ok) => setTimeout(ok, 600 * (attempt + 1))); continue; }
        break;
      } catch (e) {
        if (read && attempt < 2) { await new Promise((ok) => setTimeout(ok, 600 * (attempt + 1))); continue; }
        throw this.err('Dolibarr injoignable à l’adresse ' + this.apiRoot(this.url).replace(/\/api\/index\.php$/, '') + ' : vérifiez l’adresse (port compris) et le réseau.', 0);
      }
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (typeof data === 'string' && /^\s*</.test(data)) throw this.err('Cette adresse ne répond pas comme une API Dolibarr.', -1);
    if (!res.ok) {
      if (res.status === 404 && (o.method || 'GET') === 'GET' && !/\/\d+$/.test(path)) return [];
      if (res.status === 401 && path !== 'login') { this.expired = true; }
      throw this.err((data && data.error && (data.error.message || data.error)) || ('Erreur Dolibarr ' + res.status), res.status);
    }
    return data;
  },
  err(msg, status) { const e = new Error(String(msg)); e.status = status; return e; },
  async all(path, query, max) {
    const out = [], limit = 100;
    for (let page = 0; out.length < (max || 500); page++) {
      const rows = await this.api(path, { query: Object.assign({}, query, { limit, page }) });
      if (!Array.isArray(rows) || !rows.length) break;
      out.push(...rows);
      if (rows.length < limit) break;
    }
    return out;
  },
  // Marque du catalogue fournisseur importé (TIBAO) : jamais affichée dans l'application.
  brand(b) { return /^\s*tibao\s*$/i.test(b || '') ? '' : (b || ''); },
  num(v) { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v)); return isFinite(n) ? n : 0; },
  txt(s) {
    const E = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç', ocirc: 'ô', ucirc: 'û', icirc: 'î', euml: 'ë', iuml: 'ï', ugrave: 'ù', rsquo: '’', laquo: '«', raquo: '»' };
    return String(s == null ? '' : s).replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (E[e.toLowerCase()] !== undefined ? E[e.toLowerCase()] : m));
  },
  day(sec) { if (!sec) return ''; const d = new Date(Number(sec) * 1000), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); },
  stamp(sec) { if (!sec) return ''; const d = new Date(Number(sec) * 1000), p = (n) => String(n).padStart(2, '0'); return this.day(sec) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); },
  safe(s) { return String(s).replace(/['"()\\%_]/g, ' ').trim(); },
  oem(s) { return String(s || '').replace(/[\s.\-]/g, '').toUpperCase(); },

  // ---------- connexion ----------
  async login(url, login, password) {
    this.url = url; this.token = '';
    let r;
    try { r = await this.api('login', { method: 'POST', body: { login, password, reset: 0 } }); }
    catch (e) { if (e.status === 401 || e.status === 403) throw this.err('Identifiant ou mot de passe refusé.', e.status); throw e; }
    if (!r || !r.success || !r.success.token) throw this.err('Identifiant ou mot de passe refusé.', 403);
    this.token = r.success.token;
    return this.token;
  },
  // Rôle CARUNO déduit des droits Dolibarr (pas du nom du groupe).
  roleOf(rights, admin) {
    const has = (p) => !!p.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), rights);
    if (admin || has('user.user.lire')) return 'gerant';
    if (has('banque.lire') && has('produit.creer')) return 'responsable';
    if (has('banque.lire')) return 'comptable';
    if (has('facture.paiement')) return 'vendeur';
    if (has('stock.mouvement.creer')) return 'magasinier';
    return 'vendeur';
  },
  can(path) { return !!path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), this.rights); },
  async whoami() {
    const r = await this.api('users/info', { query: { includepermissions: 1 } });
    this.rights = r.rights || {};
    this.me = { id: this.num(r.id), login: r.login, name: [r.firstname, r.lastname].filter(Boolean).join(' ') || r.login };
    return { login: r.login, name: this.me.name, role: this.roleOf(this.rights, this.num(r.admin) === 1), id: this.me.id };
  },

  // ---------- correspondances Dolibarr → données de la maquette ----------
  mapPart(r) {
    const mp = r.multiprices || {}, ao = r.array_options || {};
    const lv = (i) => this.num(mp[i]) || this.num(mp[1]) || this.num(r.price);
    const stock = {}, loc = {};
    WAREHOUSES.forEach((w) => { stock[w] = 0; loc[w] = ''; });
    Object.entries(r.stock_warehouse || {}).forEach(([w, v]) => { const n = this.whName[w]; if (n) stock[n] = this.num(v && v.real); });
    if (!r.stock_warehouse && WAREHOUSES[0]) stock[WAREHOUSES[0]] = this.num(r.stock_reel);
    loc[WAREHOUSES[0]] = ao.options_emplacement || '';
    const old = S.db.parts.find((p) => p.id === this.num(r.id));
    return {
      id: this.num(r.id), name: this.txt(r.label), brand: this.brand(ao.options_brand), ref: r.ref, oem: ao.options_oem_ref || '', ean: r.barcode || '',
      fam: old ? old.fam : '', type: ao.options_caruno_part_type || '', stock, loc, prices: [lv(1), lv(2), lv(3)], floor: this.num(r.price_min), cost: this.num(r.pmp) || this.num(r.cost_price),
      seuil: this.num(r.seuil_stock_alerte), souhaite: this.num(r.desiredstock), sups: old ? old.sups : [], photos: old ? old.photos : [], tva: this.num(r.tva_tx),
      refExt: r.ref_ext || '', created: this.num(r.date_creation), extra: old ? old.extra : false,
      // Corbeille CARUNO : pièce « hors vente et hors achat » dans Dolibarr.
      trash: r.status !== undefined && this.num(r.status) === 0 && this.num(r.status_buy) === 0, changed: this.num(r.tms || r.date_modification),
      lastBuy: (this.lastBuy || {})[this.num(r.id)] || (old ? old.lastBuy : null),
      // Codes modèles du catalogue fournisseur (« Modèles : GF5/JD5 ») : affichés en noms de voitures, utilisés par la recherche.
      models: r.description !== undefined ? ((this.txt(r.description).match(/Modèles\s*:\s*([^\n<]*)/) || [])[1] || '').trim() : (old ? old.models : ''),
    };
  },
  CAT: { 1: 'Particulier', 2: 'Garage', 3: 'Revendeur' },
  mapClient(r) {
    const id = String(r.id), lvl = Math.min(3, Math.max(1, this.num(r.price_level) || 1));
    return {
      id, name: this.txt(r.name || r.nom), cat: this.CAT[lvl], phone: r.phone || '', town: r.town || '', email: r.email || '', address: r.address || '',
      rc: r.idprof1 || '', nif: r.idprof2 || '', ai: r.idprof3 || '', nis: r.idprof4 || '', terms: this.terms[r.cond_reglement_id] || 'Comptant',
      remise: this.num(r.remise_percent), plafond: this.num(r.outstanding_limit), fixed: id === this.counterId || undefined,
    };
  },
  mapSupplier(r) { return { id: String(r.id), name: this.txt(r.name || r.nom), town: r.town || '', phone: r.phone || '', email: r.email || '' }; },
  lines(r) {
    return (r.lines || []).filter((l) => this.num(l.fk_product) > 0).map((l) => ({ pid: this.num(l.fk_product), qty: this.num(l.qty), price: this.num(l.subprice), disc: this.num(l.remise_percent), lineId: this.num(l.id || l.rowid) }));
  },
  desc(r) {
    if (r.note_public) return this.txt(r.note_public);
    return (r.lines || []).map((l) => this.num(l.qty) + ' × ' + (l.product_ref || this.txt(l.product_label || l.desc || ''))).slice(0, 3).join(', ');
  },
  mapDoc(kind, r) {
    const base = { id: this.num(r.id), ref: r.ref, client: String(r.socid), date: this.day(r.date || r.datef || r.date_commande || r.date_creation), lines: this.lines(r), desc: this.desc(r), ttc: Math.abs(this.num(r.total_ttc)), note: this.txt(r.note_public || '') };
    const st = this.num(r.statut !== undefined ? r.statut : r.status);
    if (kind === 'facture' && this.num(r.type) === 2) {
      return Object.assign(base, { type: 'avoir', status: this.num(r.paye) ? 'rembourse' : st === 0 ? 'impute' : 'a_valoir', left: this.num(r.paye) ? 0 : base.ttc, why: '', restocked: true, payments: [], origin: '' });
    }
    if (kind === 'facture') {
      const rest = r.remaintopay !== undefined && r.remaintopay !== null ? this.num(r.remaintopay) : (this.num(r.paye) ? 0 : base.ttc);
      const paid = Math.max(0, base.ttc - rest);
      const status = st === 0 ? 'brouillon' : this.num(r.paye) || st === 2 || rest <= 0 ? 'payee' : paid > 0 ? 'partielle' : 'impayee';
      const ext = r.ref_ext || '';
      return Object.assign(base, { type: 'facture', status, paid, due: this.day(r.date_lim_reglement), saleRef: /^V-/.test(ext) ? ext : '', payments: null, notePrivate: r.note_private ? this.txt(r.note_private).split('\n').filter(Boolean) : null, author: this.num(r.fk_user_author || r.user_author) });
    }
    if (kind === 'devis') return Object.assign(base, { type: 'devis', status: ['brouillon', 'envoye', 'accepte', 'refuse', 'accepte'][st] || 'brouillon' });
    if (kind === 'commande') return Object.assign(base, { type: 'commande', status: st === 0 ? 'brouillon' : st === 1 ? 'validee' : st === 2 ? 'livree_part' : this.num(r.billed) ? 'facturee' : 'livree' });
    if (kind === 'livraison') return Object.assign(base, { type: 'livraison', status: this.num(r.billed) || st === 2 ? 'facturee' : 'validee', origin: '', stockOut: false });
    return base;
  },
  mapPO(r) {
    const st = this.num(r.statut !== undefined ? r.statut : r.status);
    return {
      id: this.num(r.id), ref: r.ref, supplier: String(r.socid), date: this.day(r.date || r.date_commande || r.date_creation), bl: null,
      status: st === 0 ? 'brouillon' : st <= 3 ? 'envoyee' : st === 4 ? 'reception' : 'recue',
      lines: (r.lines || []).filter((l) => this.num(l.fk_product) > 0).map((l) => ({ pid: this.num(l.fk_product), qty: this.num(l.qty), rec: 0, done: 0, price: this.num(l.subprice), lineId: this.num(l.id || l.rowid) })),
    };
  },
  mapMove(m) {
    const u = S.db.users.find((x) => x.id === this.num(m.fk_user_author));
    return { date: this.stamp(m.datem), pid: this.num(m.product_id), label: this.txt(m.label), qty: this.num(m.qty), wh: this.whName[m.warehouse_id] || '#' + m.warehouse_id, user: u ? u.login : '#' + m.fk_user_author };
  },

  // ---------- chargement ----------
  safeList(p) { return p.catch((e) => { if (e.status === 401) throw e; return []; }); },
  terms: {},
  async loadAll() {
    this.loading = true; this.error = '';
    try {
      const [whs, pt, terms, cats] = await Promise.all([
        // Les entrepôts sont indispensables (stock, ventes) : une erreur ici arrête le chargement, avec « Réessayer ».
        this.api('warehouses', { query: { limit: 50, sortfield: 't.rowid', sortorder: 'ASC' } }),
        this.safeList(this.api('setup/dictionary/payment_types', { query: { limit: 50 } })),
        this.safeList(this.api('setup/dictionary/payment_terms', { query: { limit: 50 } })),
        this.safeList(this.api('categories', { query: { type: 'product', limit: 100 } })),
      ]);
      WAREHOUSES.splice(0, WAREHOUSES.length, ...whs.map((w) => this.txt(w.label || w.ref)));
      if (!WAREHOUSES.length) throw this.err('Aucun entrepôt lu dans Dolibarr : vérifiez les droits du compte (stock) puis réessayez.', -2);
      whs.forEach((w) => { const n = this.txt(w.label || w.ref); this.whId[n] = this.num(w.id); this.whName[w.id] = n; });
      pt.forEach((t) => { this.payType[t.code] = this.num(t.id); });
      const TL = { RECEP: 'Comptant', '30D': '30 jours', '30DENDMONTH': '30 jours fin de mois', '45D': '45 jours', '60D': '60 jours' };
      terms.forEach((t) => { this.terms[t.id] = TL[t.code] || this.txt(t.label); this.termId = this.termId || {}; this.termId[TL[t.code] || this.txt(t.label)] = this.num(t.id); });
      cats.forEach((c) => { this.famCat[this.txt(c.label)] = this.num(c.id); });
      FAMILIES.splice(0, FAMILIES.length, ...Object.keys(this.famCat));

      const can = (p) => this.can(p);
      const [users, recent, inStock, clients, suppliers, invoices, propals, orders, ships, pos, moves, banks, company] = await Promise.all([
        can('user.user.lire') ? this.safeList(this.api('users', { query: { limit: 200 } })) : Promise.resolve([]),
        this.safeList(this.api('products', { query: { limit: 300, sortfield: 't.rowid', sortorder: 'DESC', includestockdata: 1, pagination_data: 'true', sqlfilters: '(t.tosell:=:1)' } })),
        this.safeList(this.all('products', { sqlfilters: '((t.stock:>:0) or (t.seuil_stock_alerte:>:0)) and (t.tosell:=:1)', includestockdata: 1 }, 1000)),
        this.safeList(this.all('thirdparties', { mode: 1, sortfield: 't.nom', sortorder: 'ASC' }, 1000)),
        this.safeList(this.all('thirdparties', { mode: 4, sortfield: 't.nom', sortorder: 'ASC' }, 500)),
        can('facture.lire') ? this.safeList(this.all('invoices', { sortfield: 't.rowid', sortorder: 'DESC' }, 400)) : Promise.resolve([]),
        can('propale.lire') || can('propal.lire') ? this.safeList(this.all('proposals', { sortfield: 't.rowid', sortorder: 'DESC' }, 200)) : Promise.resolve([]),
        can('commande.lire') ? this.safeList(this.all('orders', { sortfield: 't.rowid', sortorder: 'DESC' }, 200)) : Promise.resolve([]),
        can('expedition.lire') ? this.safeList(this.all('shipments', { sortfield: 't.rowid', sortorder: 'DESC' }, 200)) : Promise.resolve([]),
        can('fournisseur.commande.lire') ? this.safeList(this.all('supplierorders', { sortfield: 't.rowid', sortorder: 'DESC' }, 200)) : Promise.resolve([]),
        can('stock.mouvement.lire') || can('stock.lire') ? this.safeList(this.api('stockmovements', { query: { limit: 300, sortfield: 't.rowid', sortorder: 'DESC' } })) : Promise.resolve([]),
        can('banque.lire') ? this.safeList(this.api('bankaccounts', { query: { limit: 20 } })) : Promise.resolve([]),
        this.api('setup/company').catch(() => null),
      ]);

      S.db.users = (users.length ? users : [{ id: this.me.id, login: this.me.login, firstname: this.me.name, statut: 1 }]).filter((u) => u.login !== 'caruno_api').map((u) => {
        const role = u.login === this.me.login ? S.user.role : u.admin == 1 ? 'gerant' : /responsable/i.test(u.login + u.lastname) ? 'responsable' : /comptable/i.test(u.login + u.lastname) ? 'comptable' : /magasinier/i.test(u.login + u.lastname) ? 'magasinier' : /gerant/i.test(u.login + u.lastname) ? 'gerant' : 'vendeur';
        return { id: this.num(u.id), login: u.login, name: [u.firstname, u.lastname].filter(Boolean).join(' ') || u.login, role, email: u.email || '', active: this.num(u.statut !== undefined ? u.statut : u.status) === 1 };
      });

      const recentRows = Array.isArray(recent) ? recent : recent.data || [];
      this.total = Array.isArray(recent) ? recent.length : this.num(recent.pagination && recent.pagination.total);
      S.db.parts = [];
      const seen = new Set();
      [...recentRows, ...inStock].forEach((r) => { if (!seen.has(r.id)) { seen.add(r.id); S.db.parts.push(this.mapPart(r)); } });

      S.db.clients = clients.map((r) => this.mapClient(r));
      if (!S.db.clients.some((c) => c.id === this.counterId)) {
        const c = await this.api('thirdparties/' + this.counterId).catch(() => null);
        S.db.clients.unshift(c ? this.mapClient(c) : { id: this.counterId, name: 'Client comptoir', cat: 'Particulier', phone: '', town: '', fixed: true });
      }
      S.db.suppliers = suppliers.map((r) => this.mapSupplier(r));
      S.db.docs = [].concat(
        invoices.map((r) => this.mapDoc('facture', r)), propals.map((r) => this.mapDoc('devis', r)),
        orders.map((r) => this.mapDoc('commande', r)), ships.map((r) => this.mapDoc('livraison', r)));
      S.db.pos = pos.map((r) => this.mapPO(r));
      S.db.moves = moves.map((m) => this.mapMove(m));
      if (company && company.name) Object.assign(S.db.shop, { name: this.txt(company.name), address: [company.address, company.zip, company.town].filter(Boolean).join(', '), phone: company.phone || '', rc: company.idprof1 || '', nif: company.idprof2 || '', ai: company.idprof3 || '', nis: company.idprof4 || '' });
      await this.loadProfile().catch(() => null);
      const bank = banks.find((b) => this.num(b.id) === this.bankAccount);
      S.db.bank = { opening: bank ? this.num(bank.balance) : 0, transfers: [], deposits: [], accounts: banks.map((b) => ({ id: this.num(b.id), label: this.txt(b.label), balance: this.num(b.balance) })) };

      // Toutes les pièces citées (documents, commandes en cours du poste) doivent être connues.
      const need = new Set();
      S.db.docs.forEach((d) => d.lines.forEach((l) => need.add(l.pid)));
      S.db.pos.forEach((o) => o.lines.forEach((l) => need.add(l.pid)));
      (S.db.posOrders || []).forEach((o) => o.lines.forEach((l) => need.add(l.pid)));
      (S.db.journal || []).forEach((j) => j.lines.forEach((l) => need.add(l.pid)));
      S.db.moves.forEach((m) => need.add(m.pid));
      await this.fetchParts([...need]);
      (S.db.posOrders || []).forEach((o) => { o.lines = o.lines.filter((l) => part(l.pid)); if (!client(o.client)) o.client = this.counterId; });
      S.db.moves = S.db.moves.filter((m) => part(m.pid));
      await this.fillFamilies(S.db.parts.map((p) => p.id));
      await this.loadBuyPrices().catch(() => null);
      this.computeDay();
      this.lazy = {};
    } finally { this.loading = false; }
  },
  // Profil du magasin (enseigne, adresse, identifiants, logo) : fichier caruno-profil.json rangé dans les documents
  // du client comptoir de Dolibarr, lisible par tous les comptes, modifiable par ceux qui gèrent les tiers.
  PROFILE: 'caruno-profil.json',
  async loadProfile() {
    const d = await this.api('documents/download', { query: { modulepart: 'societe', original_file: this.counterId + '/' + this.PROFILE } });
    if (!d || !d.content) return;
    const p = JSON.parse(decodeURIComponent(escape(atob(d.content))));
    Object.assign(S.db.shop, p);
    try { localStorage.setItem('caruno-shop', JSON.stringify({ name: p.name || '', logo: p.logo || '' })); } catch (e) {}
  },
  async saveProfile(p) {
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(p))));
    await this.api('documents/upload', { method: 'POST', body: { filename: this.PROFILE, modulepart: 'societe', ref: this.counterId, subdir: '', filecontent: content, fileencoding: 'base64', overwriteifexists: 1 } });
    Object.assign(S.db.shop, p);
    try { localStorage.setItem('caruno-shop', JSON.stringify({ name: p.name || '', logo: p.logo || '' })); } catch (e) {}
  },
  // Corbeille : pièces mises hors vente et hors achat par CARUNO, restaurables ; suppression définitive pour le gérant.
  async loadTrash() {
    const rows = await this.safeList(this.api('products', { query: { sqlfilters: '(t.tosell:=:0) and (t.tobuy:=:0)', limit: 300, sortfield: 't.tms', sortorder: 'DESC', includestockdata: 1 } }));
    S.db.trash = rows.map((r) => this.upsertPart(r));
  },
  async setTrash(id, inTrash) {
    const r = await this.api('products/' + id);
    const line = (inTrash ? 'Mise à la corbeille' : 'Restaurée de la corbeille') + ' le ' + nowStr() + ' par ' + S.user.login + ' (CARUNO)';
    await this.api('products/' + id, { method: 'PUT', body: { status: inTrash ? 0 : 1, status_buy: inTrash ? 0 : 1, note_private: [this.txt(r.note_private || ''), line].filter(Boolean).join('\n') } });
    await this.refreshParts([Number(id)]);
    S.db.trash = (S.db.trash || []).filter((p) => p.id !== Number(id));
    if (inTrash && part(id)) S.db.trash.unshift(part(id));
    this.total += inTrash ? -1 : 1;
  },
  async purge(id) {
    try { await this.api('products/' + id, { method: 'DELETE' }); }
    catch (e) {
      if (e.status === 403) throw this.err('Seul le gérant peut supprimer définitivement une pièce.', 403);
      throw this.err('Suppression refusée par Dolibarr : la pièce figure sur des documents (factures, commandes…). Elle reste dans la corbeille. (' + e.message + ')', e.status);
    }
    S.db.trash = (S.db.trash || []).filter((p) => p.id !== Number(id));
    S.db.parts = S.db.parts.filter((p) => p.id !== Number(id));
  },
  // Import : pièce déjà dans Dolibarr avec cette référence (null sinon).
  async findByRef(ref) {
    const r = await this.api('products/ref/' + encodeURIComponent(ref), { query: { includestockdata: 1 } }).catch((e) => { if (e.status === 404) return null; throw e; });
    return r && r.id ? this.upsertPart(r) : null;
  },
  async fetchParts(ids) {
    const miss = [...new Set(ids)].filter((id) => id > 0 && !part(id));
    for (let i = 0; i < miss.length; i += 80) {
      const chunk = miss.slice(i, i + 80);
      const rows = await this.safeList(this.api('products', { query: { sqlfilters: '(t.rowid:in:' + chunk.join(',') + ')', limit: chunk.length, includestockdata: 1 } }));
      rows.forEach((r) => this.upsertPart(r));
    }
  },
  upsertPart(r) {
    const p = this.mapPart(r), i = S.db.parts.findIndex((x) => x.id === p.id);
    if (i >= 0) S.db.parts[i] = p; else S.db.parts.push(p);
    return p;
  },
  // Famille = catégorie Dolibarr de la pièce (une requête par famille, limitée aux pièces chargées).
  async fillFamilies(ids) {
    const u = [...new Set(ids)].filter((id) => id > 0);
    if (!u.length) return;
    await Promise.all(Object.entries(this.famCat).map(async ([fam, cid]) => {
      for (let i = 0; i < u.length; i += 200) {
        const chunk = u.slice(i, i + 200);
        const rows = await this.safeList(this.api('products', { query: { category: cid, sqlfilters: '(t.rowid:in:' + chunk.join(',') + ')', limit: chunk.length, properties: 'id' } }));
        rows.forEach((r) => { const p = part(r.id); if (p) p.fam = fam; });
      }
    }));
  },
  async refreshParts(ids) {
    const u = [...new Set(ids)].filter((id) => id > 0);
    if (!u.length) return;
    const rows = await this.safeList(this.api('products', { query: { sqlfilters: '(t.rowid:in:' + u.join(',') + ')', limit: u.length, includestockdata: 1 } }));
    rows.forEach((r) => this.upsertPart(r));
  },
  // Recherche dans tout Dolibarr (référence, désignation, code-barres, OEM, marque) ; les pièces trouvées rejoignent la liste.
  async searchParts(q, limit) {
    const s = this.safe(q);
    if (s.length < 2) return [];
    const like = '%' + s.replace(/\s+/g, '%') + '%';
    const filter = "(t.ref:like:'" + like + "') or (t.label:like:'" + like + "') or (t.barcode:=:'" + s + "') or (ef.oem_ref:like:'%" + this.oem(s) + "%') or (ef.brand:like:'" + like + "')" + (typeof searchExtra === 'function' ? searchExtra(s) : '');
    const rows = await this.safeList(this.api('products', { query: { sqlfilters: '(' + filter + ') and (t.tosell:=:1)', limit: limit || 60, includestockdata: 1, sortfield: 't.ref', sortorder: 'ASC' } }));
    const ps = rows.map((r) => this.upsertPart(r));
    await this.fillFamilies(ps.filter((p) => !p.fam).map((p) => p.id));
    return ps.map((p) => p.id);
  },
  // Recherche différée pendant la frappe ; re-dessine quand la réponse arrive.
  searchLater(q) {
    clearTimeout(this.st);
    if (String(q || '').trim().length < 2) return;
    this.st = setTimeout(async () => { try { await this.searchParts(q); render(); } catch (e) { toast(e.message); render(); } }, 300);
  },
  async refreshDoc(type, id) {
    const path = { facture: 'invoices', avoir: 'invoices', devis: 'proposals', commande: 'orders', livraison: 'shipments' }[type];
    const r = await this.api(path + '/' + id);
    const d = this.mapDoc(type === 'avoir' ? 'facture' : type, r);
    await this.fetchParts(d.lines.map((l) => l.pid));
    const i = S.db.docs.findIndex((x) => x.id === d.id && (x.type === d.type || (x.type === 'facture' && d.type === 'avoir')));
    if (i >= 0) S.db.docs[i] = Object.assign(d, { payments: S.db.docs[i].payments && d.type !== 'facture' ? S.db.docs[i].payments : d.payments }); else S.db.docs.unshift(d);
    if (d.type === 'facture') await this.loadPayments(d);
    return d;
  },
  // Toutes les factures et avoirs d'un client (fiche client, impression d'une sélection), au-delà des 400 chargées au départ.
  async loadClientInvoices(cid) {
    const rows = await this.safeList(this.all('invoices', { thirdparty_ids: cid, sortfield: 't.datef', sortorder: 'DESC' }, 2000));
    rows.forEach((r) => {
      const d = this.mapDoc('facture', r), i = S.db.docs.findIndex((x) => x.id === d.id && (x.type === 'facture' || x.type === 'avoir'));
      if (i >= 0) { if (S.db.docs[i].payments) d.payments = S.db.docs[i].payments; S.db.docs[i] = d; } else S.db.docs.push(d);
    });
    await this.fetchParts(rows.flatMap((r) => (r.lines || []).map((l) => this.num(l.fk_product))));
  },
  MODE: { LIQ: 'especes', CHQ: 'cheque', VIR: 'virement', CB: 'virement' },
  async loadPayments(d) {
    const rows = await this.safeList(this.api('invoices/' + d.id + '/payments'));
    d.payments = rows.map((p) => ({ date: String(p.date || '').slice(0, 10), mode: this.MODE[p.type] || 'especes', amount: this.num(p.amount), label: p.num || '', ref: p.ref }));
    return d.payments;
  },
  // Chargements à la demande (écran ouvert) : une seule fois, puis nouveau rendu.
  need(key, fn) {
    if (this.lazy[key]) return;
    this.lazy[key] = 'loading';
    fn().then(() => { this.lazy[key] = 'done'; render(); }, (e) => { this.lazy[key] = 'done'; toast(e.message); render(); });
  },
  loadDocPayments(list) {
    const todo = list.filter((d) => d.type === 'facture' && d.payments === null && d.status !== 'brouillon');
    return Promise.all(todo.slice(0, 120).map((d) => this.loadPayments(d)));
  },
  async loadPartExtra(id) {
    const p = part(id);
    if (!p) return;
    const [sups, moves, docs] = await Promise.all([
      this.can('produit.product_advance.read_supplier_prices') ? this.safeList(this.api('products/' + id + '/purchase_prices')) : Promise.resolve([]),
      this.safeList(this.api('stockmovements', { query: { sqlfilters: '(t.fk_product:=:' + id + ')', limit: 20, sortfield: 't.rowid', sortorder: 'DESC' } })),
      this.safeList(this.api('documents', { query: { modulepart: 'product', id } })),
    ]);
    p.sups = sups.map((s) => ({ sid: String(s.fourn_id || s.fk_soc || ''), ref: s.ref_supplier || s.fourn_ref || '', price: this.num(s.fourn_unitprice || s.unitprice || s.fourn_price), delay: this.num(s.delivery_time_days) }));
    p.sups.forEach((s) => { if (s.sid && !supplier(s.sid)) S.db.suppliers.push({ id: s.sid, name: '#' + s.sid, town: '', phone: '', email: '' }); });
    const mv = moves.map((m) => this.mapMove(m));
    S.db.moves = S.db.moves.filter((m) => m.pid !== p.id).concat(mv).sort((a, b) => (a.date < b.date ? 1 : -1));
    const imgs = docs.filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name) && !/\/thumbs\//.test(f.fullname || '')).slice(0, 6);
    p.photos = (await Promise.all(imgs.map((f) => this.api('documents/download', { query: { modulepart: 'product', original_file: p.ref + '/' + f.relativename } }).then((d) => (d && d.content ? { url: 'data:' + d['content-type'] + ';base64,' + d.content, kb: Math.round(d.content.length * 0.75 / 1024), name: f.relativename } : null)).catch(() => null)))).filter(Boolean);
    p.extra = true;
  },

  // Chiffres du tableau de bord, calculés sur les factures de Dolibarr.
  computeDay() {
    const today = TODAY, month = today.slice(0, 7);
    const prev = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1);
    const prevKey = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');
    const inv = S.db.docs.filter((d) => (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon');
    const sign = (d) => (d.type === 'avoir' ? -d.ttc : d.ttc);
    const costOf = (d) => d.lines.reduce((t, l) => t + ((part(l.pid) || {}).cost || 0) * l.qty, 0) * (d.type === 'avoir' ? -1 : 1);
    const ofDay = inv.filter((d) => d.date === today);
    const sellers = {};
    ofDay.forEach((d) => { const u = S.db.users.find((x) => x.id === d.author); const k = u ? u.login : (d.author === this.me.id ? this.me.login : '#' + d.author); sellers[k] = sellers[k] || [0, 0]; sellers[k][0] += sign(d); if (d.type === 'facture') sellers[k][1]++; });
    S.db.users.forEach((u) => { if (!sellers[u.login] && ofDay.length) return; });
    Object.keys(sellers).forEach((k) => { if (!S.db.users.some((u) => u.login === k)) S.db.users.push({ id: 0, login: k, name: k, role: 'vendeur', email: '', active: true, ghost: true }); });
    const sum = (key) => { const l = inv.filter((d) => d.date.slice(0, 7) === key); return { ttc: l.reduce((t, d) => t + sign(d), 0) || 0, cost: l.reduce((t, d) => t + costOf(d), 0) || 0 }; };
    S.db.day = { base: ofDay.reduce((t, d) => t + sign(d), 0), count: ofDay.filter((d) => d.type === 'facture').length || 0, cash: 0, cheque: 0, virement: 0, sellers, orphans: S.db.docs.filter((d) => d.type === 'facture' && d.status === 'brouillon' && d.saleRef && d.date < today).length };
    S.db.months = { [prevKey]: sum(prevKey), [month]: sum(month) };
    S.db.monthKeys = [prevKey, month];
  },
  async loadDayPayments() {
    const ofDay = S.db.docs.filter((d) => d.type === 'facture' && d.status !== 'brouillon' && d.date === TODAY);
    await this.loadDocPayments(ofDay);
    const day = S.db.day; day.cash = 0; day.cheque = 0; day.virement = 0;
    ofDay.forEach((d) => (d.payments || []).filter((p) => p.date === TODAY).forEach((p) => { const k = { especes: 'cash', cheque: 'cheque', virement: 'virement' }[p.mode]; if (k) day[k] += p.amount; }));
  },

  // ---------- écritures ----------
  async savePart(id, f, prices) {
    const body = {
      ref: f.ref, label: f.name, barcode: f.ean || undefined, seuil_stock_alerte: f.seuil, desiredstock: f.souhaite, price_min: f.floor || 0, tva_tx: Number(f.tva) || 0,
      array_options: { options_brand: f.brand || '', options_oem_ref: this.oem(f.oem), options_emplacement: f.locM || '', options_caruno_part_type: f.type || '' },
    };
    let pid = id ? Number(id) : 0;
    if (!pid) pid = this.num(await this.api('products', { method: 'POST', body: Object.assign(body, { type: 0, status: 1, status_buy: 1, price: prices[0], price_base_type: 'HT' }) }));
    // Les niveaux de prix passent par PUT (multiprix) : un appel suffit pour les trois.
    await this.api('products/' + pid, { method: 'PUT', body: Object.assign({}, id ? body : {}, { price: prices[0], price_base_type: 'HT', multiprices: { 1: prices[0], 2: prices[1], 3: prices[2] }, multiprices_base_type: { 1: 'HT', 2: 'HT', 3: 'HT' } }) });
    const old = part(pid);
    if (f.fam && (!old || old.fam !== f.fam) && this.famCat[f.fam]) {
      if (old && old.fam && this.famCat[old.fam]) await this.api('categories/' + this.famCat[old.fam] + '/objects/product/' + pid, { method: 'DELETE' }).catch(() => null);
      await this.api('categories/' + this.famCat[f.fam] + '/objects/product/' + pid, { method: 'POST' }).catch(() => null);
    }
    await this.saveBuyPrice(pid, f);
    await this.refreshParts([pid]);
    if (part(pid)) part(pid).fam = f.fam || part(pid).fam;
    return pid;
  },
  // Prix d'achat saisi sur la fiche : prix du fournisseur choisi (liste de prix fournisseur Dolibarr),
  // sinon prix de revient de la pièce. Devient le « dernier achat » retenu par l'alerte de la caisse.
  async saveBuyPrice(pid, f) {
    const price = Math.round(Number(f.sprice) || 0);
    if (!(price > 0)) return;
    const cur = (this.lastBuy || {})[pid];
    if (cur && cur.price === price && (cur.sid || '') === (f.sid || '')) return;
    if (f.sid) await this.api('products/' + pid + '/purchase_prices', { method: 'POST', body: { qty: 1, buyprice: price, price_base_type: 'HT', fourn_id: Number(f.sid), availability: 0, ref_fourn: f.sref || f.ref, tva_tx: 0 } });
    else await this.api('products/' + pid, { method: 'PUT', body: { cost_price: price } });
    const s = f.sid && supplier(f.sid);
    this.lastBuy = this.lastBuy || {};
    this.lastBuy[pid] = { price, date: Math.floor(Date.now() / 1000), from: s ? s.name : 'saisie', sid: f.sid || '' };
  },
  // Dernier prix d'achat de chaque pièce : le plus récent entre les prix fournisseurs et les réceptions de commandes fournisseurs.
  async loadBuyPrices() {
    const [all, moves] = await Promise.all([
      this.api('products/purchase_prices', { query: { limit: 5000 } }).catch(() => ({})),
      this.safeList(this.api('stockmovements', { query: { limit: 2000, sortfield: 't.datem', sortorder: 'DESC', properties: 'product_id,price,datem,qty,origintype', sqlfilters: "(t.origintype:=:'order_supplier')" } })),
    ]);
    const last = {};
    const take = (pid, price, date, from, sid) => { if (!(price > 0)) return; const c = last[pid]; if (!c || date > c.date) last[pid] = { price: Math.round(price), date, from, sid: sid || '' }; };
    Object.entries(all && !Array.isArray(all) ? all : {}).forEach(([pid, list]) => (list || []).forEach((e) => take(Number(pid), this.num(e.fourn_unitprice), this.num(e.fourn_date_modification || e.fourn_date_creation), this.txt(e.fourn_name || ''), String(e.fourn_id || ''))));
    moves.forEach((m) => { if (this.num(m.qty) > 0) take(this.num(m.product_id), this.num(m.price), this.num(m.datem), 'réception'); });
    this.lastBuy = last;
    S.db.parts.forEach((p) => { p.lastBuy = last[p.id] || null; });
  },
  async uploadPhoto(p, ph, n) {
    await this.api('documents/upload', { method: 'POST', body: { filename: p.ref.replace(/[^\w.-]+/g, '_') + '-' + Date.now().toString(36) + '-' + n + '.jpg', modulepart: 'product', ref: p.ref, subdir: '', filecontent: ph.url.split(',')[1], fileencoding: 'base64', overwriteifexists: 0 } });
  },
  async move(pid, label, qty, wh) {
    await this.api('stockmovements', { method: 'POST', body: { product_id: Number(pid), warehouse_id: this.whId[wh], qty, label, movementlabel: label } });
    S.db.moves.unshift({ date: nowStr(), pid: Number(pid), label, qty, wh, user: S.user.login });
  },
  async saveClient(id, f) {
    const lvl = { Particulier: 1, Garage: 2, Revendeur: 3 }[f.cat] || 1;
    const body = {
      name: f.name, phone: f.phone || '', email: f.email || '', town: f.town || '', address: f.address || '', idprof1: f.rc || '', idprof2: f.nif || '', idprof3: f.ai || '', idprof4: f.nis || '',
      remise_percent: Number(f.remise) || 0, outstanding_limit: Number(f.plafond) || null, cond_reglement_id: (this.termId || {})[f.terms] || undefined, country_id: 13, tva_assuj: 0,
    };
    let cid = id;
    if (id) await this.api('thirdparties/' + id, { method: 'PUT', body });
    else cid = String(this.num(await this.api('thirdparties', { method: 'POST', body: Object.assign(body, { client: 1, code_client: -1 }) })));
    await this.api('thirdparties/' + cid + '/setpricelevel/' + lvl, { method: 'PUT' });
    const c = this.mapClient(await this.api('thirdparties/' + cid));
    const i = S.db.clients.findIndex((x) => x.id === cid);
    if (i >= 0) S.db.clients[i] = c; else S.db.clients.push(c);
    return c;
  },
  async saveSupplier(f) {
    const id = this.num(await this.api('thirdparties', { method: 'POST', body: { name: f.name, town: f.town || '', phone: f.phone || '', email: f.email || '', fournisseur: 1, client: 0, code_fournisseur: -1, country_id: 13 } }));
    S.db.suppliers.push({ id: String(id), name: f.name, town: f.town || '', phone: f.phone || '', email: f.email || '' });
  },
  account(mode) { return mode === 'especes' ? this.cashAccount : this.bankAccount; },
  typeId(mode) { return this.payType[{ especes: 'LIQ', cheque: 'CHQ', virement: 'VIR' }[mode]]; },
  async pay(d, mode, amount, comment) {
    await this.api('invoices/paymentsdistributed', { method: 'POST', body: { arrayofamounts: { [d.id]: { amount: String(amount), multicurrency_amount: '' } }, datepaye: Math.floor(Date.now() / 1000), paymentid: this.typeId(mode), closepaidinvoices: 'yes', accountid: this.account(mode), num_payment: '', comment: comment || 'CARUNO' } });
  },
  // Vente comptoir : facture (retrouvée par ref_ext si elle existe déjà), validation sur le Magasin, règlements relus avant écriture.
  async sale(j, steps) {
    let inv = null;
    const found = await this.api('invoices', { query: { sqlfilters: "(t.ref_ext:=:'" + this.safe(j.ext || j.sale) + "')", limit: 1 } });
    if (Array.isArray(found) && found[0]) { inv = found[0]; steps.push({ t: '1. Facture ' + inv.ref + ' retrouvée par sa référence externe ' + j.sale + ' : réutilisée, pas de doublon', skip: true }); }
    else {
      const id = this.num(await this.api('invoices', { method: 'POST', body: {
        socid: Number(j.client), type: 0, ref_ext: j.ext || j.sale, note_private: (j.notePrivate || []).join('\n'), note_public: j.note || '',
        date_lim_reglement: j.credit ? Math.floor(Date.now() / 1000) + 30 * 86400 : undefined,
        lines: j.lines.map((l) => ({ fk_product: l.pid, qty: l.qty, subprice: l.price, remise_percent: 0, tva_tx: (part(l.pid) || {}).tva || 0, product_type: 0 })),
      } }));
      inv = await this.api('invoices/' + id);
      steps.push({ t: '1. Facture créée (référence externe ' + j.sale + ')' + (j.notePrivate && j.notePrivate.length ? ', note privée : ' + j.notePrivate.length + ' prix modifié(s)' : '') });
    }
    j.invoiceId = this.num(inv.id); j.step = 'validation'; save();
    if (this.num(inv.statut) === 0) {
      await this.api('invoices/' + inv.id + '/validate', { method: 'POST', body: { idwarehouse: this.whId[WAREHOUSES[0]], notrigger: 0 } });
      steps.push({ t: '2. Facture validée sur l’entrepôt ' + WAREHOUSES[0] + ' : stock sorti' });
    } else steps.push({ t: '2. Facture déjà validée : pas de seconde validation, le stock n’est sorti qu’une fois', skip: true });
    j.step = 'paiement'; save();
    inv = await this.api('invoices/' + inv.id);
    j.invoice = inv.ref;
    let due = this.num(inv.remaintopay) - (j.credit || 0);
    if (!j.pay.length) steps.push({ t: '3. Vente à crédit : ' + fmt(j.credit) + ' ajoutés à l’encours du client' });
    else if (due <= 0) steps.push({ t: '3. Reste à payer relu : ' + fmt(this.num(inv.remaintopay)) + '. Rien n’est payé deux fois', skip: true });
    else {
      for (const p of j.pay) { const a = Math.min(p.amount, due); if (a <= 0) continue; await this.pay(inv, p.mode, a, 'Vente comptoir ' + j.sale); due -= a; }
      steps.push({ t: '3. Paiement ' + j.pay.map((p) => MODES[p.mode].toLowerCase() + ' ' + fmt(p.amount)).join(' + ') + ' enregistré' + (j.credit ? ', ' + fmt(j.credit) + ' à crédit' : '') });
    }
    const d = await this.refreshDoc('facture', inv.id);
    await this.refreshParts(j.lines.map((l) => l.pid));
    this.computeDay();
    return d;
  },
  async createDoc(type, cid, lines, note, validate) {
    const path = type === 'devis' ? 'proposals' : 'orders';
    const id = this.num(await this.api(path, { method: 'POST', body: { socid: Number(cid), date: Math.floor(Date.now() / 1000), note_public: note || '', lines: lines.map((l) => ({ fk_product: l.pid, qty: l.qty, subprice: l.price, tva_tx: (part(l.pid) || {}).tva || 0, product_type: 0 })) } }));
    if (validate) await this.api(path + '/' + id + '/validate', { method: 'POST', body: { notrigger: 0 } });
    return this.refreshDoc(type, id);
  },
};

// Ce poste : commandes en cours, journal, session de caisse et compteur des tickets, gardés dans le navigateur.
const POSTE_KEY = 'caruno-poste-v1';
function loadPoste() {
  try { const v = JSON.parse(localStorage.getItem(POSTE_KEY)); if (v && v.posOrders) return v; } catch (e) {}
  return { posOrders: [], journal: [], session: null, sessions: [], counters: { V: 0, CS: 0 }, stockMode: 'bill' };
}
