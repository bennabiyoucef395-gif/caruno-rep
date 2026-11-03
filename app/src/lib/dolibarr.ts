// Client de l'API REST Dolibarr, appelée directement par le front avec le jeton de l'utilisateur connecté
// (pas de serveur intermédiaire). Aucune dépendance : le même fichier sert à l'app et aux tests Node.

export class DolibarrError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type Product = {
  id: number;
  ref: string;
  label: string;
  barcode: string;
  brand: string;
  oem: string;
  stock: number;
  prices: number[]; // niveaux de prix 1..3 (Public, Garage, Gros), prix de vente du magasin
  cost: number; // coût moyen d'achat (PMP) ; masqué à l'écran selon les droits
  minPrice: number;
  tva: number;
  refExt: string; // identifiant de la pièce dans le catalogue commun CARUNO
  alert: number; // seuil d'alerte de stock
  desired: number; // stock souhaité
  location: string; // emplacement en magasin (champ supplémentaire)
  byWarehouse: Record<number, number>; // stock réel par entrepôt (fiche complète)
  description: string;
  created: number;
};

export type Customer = {
  id: number; name: string; priceLevel: number; town: string; phone: string; outstandingLimit: number;
  email: string; address: string; discount: number; rc: string; nif: string; ai: string; nis: string; supplier: boolean;
};

export type Me = {
  id: number;
  login: string;
  name: string;
  rights: Record<string, any>;
};

export type InvoiceLine = { productId: number; qty: number; price: number; label?: string };

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

// Adresse saisie dans Paramètres : on accepte « erp.boutique.dz », « https://erp.boutique.dz » ou « …/api/index.php ».
// Sans http(s)://, l'adresse serait lue comme un chemin de l'app elle-même : on complète (http en local, https sinon).
// Une adresse copiée depuis la barre du navigateur (« …/index.php?mainmenu=home », « …/societe/card.php?id=3 ») est ramenée à la racine de Dolibarr.
export function apiRoot(url: string): string {
  let u = url.trim().replace(/[?#].*$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u) ? 'http://' : 'https://') + u;
  const api = u.search(/\/api\/index\.php(\/|$)/);
  if (api >= 0) return u.slice(0, api) + '/api/index.php';
  u = u.replace(/(\/(admin|comm|commande|compta|core|expedition|fourn|product|projet|societe|user))?\/[^/]*\.php(\/.*)?$/i, '').replace(/\/+$/, '');
  return u + '/api/index.php';
}

// Une adresse web plausible : pas d'espace, et un nom d'hôte avec un point, un port ou « localhost » (le nom du magasin n'en est pas une).
export function isAddress(url: string): boolean {
  const host = url.trim().replace(/^https?:\/\//i, '').split(/[/?#]/)[0];
  return !!host && !/\s/.test(url.trim()) && (/[.:]/.test(host) || /^localhost$/i.test(host));
}

export class Dolibarr {
  readonly root: string;
  token: string;

  constructor(url: string, token = '') {
    this.root = apiRoot(url);
    this.token = token;
  }

  async request<T = any>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> } = {}): Promise<T> {
    const q = Object.entries(opts.query || {}).filter(([, v]) => v !== undefined && v !== '');
    const url = this.root + '/' + path.replace(/^\//, '') + (q.length ? '?' + q.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v))).join('&') : '');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.token) headers.DOLAPIKEY = this.token;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    let res: Response;
    try {
      res = await fetch(url, { method: opts.method || 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    } catch (e) {
      throw new DolibarrError('Dolibarr injoignable à l’adresse ' + this.root.replace(/\/api\/index\.php$/, '') + ' : vérifiez l’adresse (port compris, http ou https) et le réseau.', 0);
    }
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    // Une page web au lieu de JSON : l'adresse ne mène pas à l'API Dolibarr (mauvaise adresse, page d'accueil, proxy…).
    if (typeof data === 'string' && /^\s*</.test(data)) throw new DolibarrError('Cette adresse ne répond pas comme une API Dolibarr : vérifiez-la dans Paramètres.', -1);
    if (!res.ok) {
      // GET d'une liste vide : Dolibarr répond 404 « No … found » ; on renvoie une liste vide.
      if (res.status === 404 && (opts.method || 'GET') === 'GET' && !/\/\d+$/.test(path)) return [] as T;
      const msg = (data && data.error && (data.error.message || data.error)) || res.statusText || 'Erreur Dolibarr';
      throw new DolibarrError(String(msg), res.status);
    }
    return data as T;
  }

  // Test de connexion avant toute authentification (écran Paramètres) : l'instance répond-elle, et en quelle version ?
  async ping(): Promise<{ ok: boolean; version?: string; message: string }> {
    try {
      const r = await this.request<any>('status');
      return { ok: true, version: r?.success?.dolibarr_version, message: 'Dolibarr ' + (r?.success?.dolibarr_version || '') };
    } catch (e) {
      const err = e as DolibarrError;
      // Sans jeton, /status répond 401 : l'API existe et répond, c'est le cas normal avant la connexion.
      if (err.status === 401) return { ok: true, message: 'API Dolibarr joignable' };
      return { ok: false, message: err.message };
    }
  }

  async login(login: string, password: string): Promise<string> {
    let r: any;
    try { r = await this.request<any>('login', { method: 'POST', body: { login, password, reset: 0 } }); }
    catch (e) {
      // Refus d'identifiants seulement si Dolibarr le dit ; sinon on garde l'erreur réelle (adresse, réseau, API de connexion coupée).
      const err = e as DolibarrError;
      if (err.status === 401 || err.status === 403) throw new DolibarrError('Identifiant ou mot de passe refusé.', err.status);
      throw err;
    }
    const token = r?.success?.token;
    if (!token) throw new DolibarrError('Identifiant ou mot de passe refusé.', 403);
    this.token = token;
    return token;
  }

  // Déconnexion : un nouveau jeton remplace l'ancien, qui ne marche plus sur aucun appareil.
  async logout(login: string, password: string) {
    await this.request('login', { method: 'POST', body: { login, password, reset: 1 } });
    this.token = '';
  }

  async me(): Promise<Me> {
    const r = await this.request<any>('users/info', { query: { includepermissions: 1 } });
    return { id: num(r.id), login: r.login, name: [r.firstname, r.lastname].filter(Boolean).join(' ') || r.login, rights: r.rights || {} };
  }

  async paymentTypes(): Promise<Record<string, number>> {
    const rows = await this.request<any[]>('setup/dictionary/payment_types', { query: { limit: 50 } });
    const out: Record<string, number> = {};
    for (const r of rows || []) out[r.code] = num(r.id);
    return out;
  }

  // Recherche comptoir : référence, désignation, code-barres, OEM (champ ef.oem_ref) ou marque.
  async searchProducts(q: string, limit = 40): Promise<Product[]> {
    const s = q.trim().replace(/'/g, '');
    if (!s) return [];
    const like = '%' + s + '%';
    const oem = s.replace(/[\s.\-]/g, '').toUpperCase();
    const filter = "(t.ref:like:'" + like + "') or (t.label:like:'" + like + "') or (t.barcode:=:'" + s + "') or (ef.oem_ref:like:'%" + oem + "%') or (ef.brand:like:'" + like + "')";
    const rows = await this.request<any[]>('products', { query: { sqlfilters: filter, limit, sortfield: 't.ref', sortorder: 'ASC' } });
    return (rows || []).map(toProduct);
  }

  async product(id: number): Promise<Product> {
    return toProduct(await this.request<any>('products/' + id, { query: { includestockdata: 0 } }));
  }

  async searchCustomers(q: string, limit = 20): Promise<Customer[]> {
    const s = q.trim().replace(/'/g, '');
    const filter = s ? "(t.nom:like:'%" + s + "%') or (t.town:like:'%" + s + "%') or (t.phone:like:'%" + s + "%')" : undefined;
    const rows = await this.request<any[]>('thirdparties', { query: { mode: 1, limit, sqlfilters: filter, sortfield: 't.nom', sortorder: 'ASC' } });
    return (rows || []).map(toCustomer);
  }

  async customer(id: number): Promise<Customer> {
    return toCustomer(await this.request<any>('thirdparties/' + id));
  }

  // Dernières factures d'un client, pour retrouver le dernier prix pratiqué sur une pièce.
  async lastInvoices(customerId: number, limit = 20): Promise<any[]> {
    return this.request<any[]>('invoices', { query: { thirdparty_ids: customerId, sortfield: 't.datef', sortorder: 'DESC', limit, status: 'valid' } });
  }

  async invoiceByRefExt(refExt: string): Promise<any | null> {
    const rows = await this.request<any[]>('invoices', { query: { sqlfilters: "(t.ref_ext:=:'" + refExt.replace(/'/g, '') + "')", limit: 1 } });
    return rows && rows[0] ? rows[0] : null;
  }

  async invoice(id: number): Promise<any> {
    return this.request<any>('invoices/' + id);
  }

  async createInvoice(customerId: number, lines: InvoiceLine[], refExt: string, notePrivate?: string): Promise<number> {
    const body = {
      socid: customerId,
      type: 0,
      ref_ext: refExt,
      note_private: notePrivate || '',
      lines: lines.map((l) => ({ fk_product: l.productId, qty: l.qty, subprice: l.price, tva_tx: 0, product_type: 0, desc: l.label || '' })),
    };
    return num(await this.request('invoices', { method: 'POST', body }));
  }

  async validateInvoice(id: number, warehouseId: number): Promise<void> {
    await this.request('invoices/' + id + '/validate', { method: 'POST', body: { idwarehouse: warehouseId, notrigger: 0 } });
  }

  // Un règlement par mode ; le reste à payer est relu avant, jamais de double paiement.
  async payInvoice(id: number, amount: number, paymentTypeId: number, accountId: number, comment: string): Promise<void> {
    await this.request('invoices/paymentsdistributed', {
      method: 'POST',
      body: { arrayofamounts: { [id]: { amount: String(amount), multicurrency_amount: '' } }, datepaye: Math.floor(Date.now() / 1000), paymentid: paymentTypeId, closepaidinvoices: 'yes', accountid: accountId, num_payment: '', comment },
    });
  }

  async addBankLine(accountId: number, label: string, amount: number, type = 'LIQ'): Promise<number> {
    return num(await this.request('bankaccounts/' + accountId + '/lines', { method: 'POST', body: { date: Math.floor(Date.now() / 1000), type, label, amount } }));
  }

  // Rapport de session de caisse : événement d'agenda (le vendeur a le droit de créer ses propres événements).
  async addAgendaEvent(userId: number, label: string, note: string): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    return num(await this.request('agendaevents', { method: 'POST', body: { userownerid: userId, type_code: 'AC_OTH', label, note_private: note, datep: now, datef: now, percentage: -1, fulldayevent: 0 } }));
  }

  async createProduct(p: ProductInput): Promise<number> {
    const body: any = {
      ref: p.ref, label: p.label, type: 0, status: 1, status_buy: 1, price: p.price, price_base_type: 'HT', tva_tx: 0,
      barcode: p.barcode || undefined, ref_ext: p.refExt || undefined,
      seuil_stock_alerte: p.alert ?? undefined, desiredstock: p.desired ?? undefined,
      array_options: { options_brand: p.brand || '', options_oem_ref: normOem(p.oem), options_emplacement: p.location || '' },
    };
    const id = num(await this.request('products', { method: 'POST', body }));
    if (p.prices) await this.updateProduct(id, { prices: p.prices });
    return id;
  }

  // Modification d'une pièce. En mode multiprix, PUT /products/{id} met à jour chaque niveau changé.
  async updateProduct(id: number, p: Partial<ProductInput>): Promise<void> {
    const body: any = {};
    if (p.ref !== undefined) body.ref = p.ref;
    if (p.label !== undefined) body.label = p.label;
    if (p.barcode !== undefined) body.barcode = p.barcode;
    if (p.alert !== undefined) body.seuil_stock_alerte = p.alert;
    if (p.desired !== undefined) body.desiredstock = p.desired;
    if (p.prices) { body.multiprices = { 1: p.prices[0], 2: p.prices[1] || p.prices[0], 3: p.prices[2] || p.prices[0] }; body.multiprices_base_type = { 1: 'HT', 2: 'HT', 3: 'HT' }; body.price = p.prices[0]; body.price_base_type = 'HT'; }
    const ao: any = {};
    if (p.brand !== undefined) ao.options_brand = p.brand;
    if (p.oem !== undefined) ao.options_oem_ref = normOem(p.oem);
    if (p.location !== undefined) ao.options_emplacement = p.location;
    if (Object.keys(ao).length) body.array_options = ao;
    await this.request('products/' + id, { method: 'PUT', body });
  }

  // Liste complète des pièces, les plus récentes d'abord (une pièce créée apparaît en tête), avec filtre de stock.
  async listProducts(o: { q?: string; page?: number; limit?: number; stock?: '' | 'in' | 'out' } = {}): Promise<Page<Product>> {
    const parts: string[] = [];
    const s = sqlSafe(o.q || '');
    if (s) {
      const like = '%' + s.replace(/\s+/g, '%') + '%', oem = normOem(s);
      parts.push("((t.ref:like:'" + like + "') or (t.label:like:'" + like + "') or (t.barcode:=:'" + s + "') or (ef.oem_ref:like:'%" + oem + "%') or (ef.brand:like:'" + like + "'))");
    }
    if (o.stock === 'in') parts.push('(t.stock:>:0)');
    if (o.stock === 'out') parts.push('((t.stock:<=:0) or (t.stock:is:null))');
    return this.page('products', { sqlfilters: parts.join(' and ') || undefined, sortfield: 't.rowid', sortorder: 'DESC', includestockdata: 1 }, toProduct, o.page, o.limit);
  }

  // Fiche complète : stock par entrepôt, seuils, emplacement, prix par niveau.
  async productFull(id: number): Promise<Product> {
    return toProduct(await this.request<any>('products/' + id, { query: { includestockdata: 1 } }));
  }

  async productsByIds(ids: number[]): Promise<Record<number, Product>> {
    const u = [...new Set(ids.filter((i) => i > 0))];
    if (!u.length) return {};
    const rows = await this.request<any[]>('products', { query: { sqlfilters: '(t.rowid:in:' + u.join(',') + ')', limit: u.length } });
    return Object.fromEntries((rows || []).map((r) => [num(r.id), toProduct(r)]));
  }

  async equivalents(oem: string, exceptId: number): Promise<Product[]> {
    if (!oem) return [];
    const rows = await this.request<any[]>('products', { query: { sqlfilters: "(ef.oem_ref:=:'" + sqlSafe(normOem(oem)) + "')", limit: 50, includestockdata: 1 } });
    return (rows || []).map(toProduct).filter((p) => p.id !== exceptId);
  }

  // Pièces avec un seuil d'alerte, triées côté app (Dolibarr ne compare pas deux colonnes dans sqlfilters).
  async stockAlerts(): Promise<Product[]> {
    const rows = await this.request<any[]>('products', { query: { sqlfilters: '(t.seuil_stock_alerte:>:0)', limit: 500, includestockdata: 1 } });
    return (rows || []).map(toProduct).filter((p) => p.stock < p.alert).sort((a, b) => a.stock - a.alert - (b.stock - b.alert));
  }

  async purchasePrices(id: number): Promise<{ supplier: string; ref: string; price: number; delay: number }[]> {
    const rows = await this.request<any[]>('products/' + id + '/purchase_prices');
    return (rows || []).map((r) => ({ supplier: txt(r.fourn_name || r.supplier_name || ''), ref: r.ref_supplier || r.fourn_ref || '', price: num(r.fourn_unitprice || r.unitprice || r.fourn_price), delay: num(r.delivery_time_days) }));
  }

  async warehouses(): Promise<{ id: number; label: string }[]> {
    const rows = await this.request<any[]>('warehouses', { query: { limit: 50, sortfield: 't.rowid', sortorder: 'ASC' } });
    return (rows || []).map((w) => ({ id: num(w.id), label: txt(w.label || w.ref) }));
  }

  async movements(o: { productId?: number; page?: number; limit?: number } = {}): Promise<Page<Movement>> {
    return this.page('stockmovements', { sqlfilters: o.productId ? '(t.fk_product:=:' + o.productId + ')' : undefined, sortfield: 't.rowid', sortorder: 'DESC' }, (m: any): Movement => ({
      id: num(m.id), productId: num(m.product_id), warehouseId: num(m.warehouse_id), qty: num(m.qty), label: txt(m.label), date: num(m.datem), userId: num(m.fk_user_author),
    }), o.page, o.limit ?? 30);
  }

  // Mouvement manuel (correction, transfert) : la quantité est signée, le stock suit tout de suite.
  async addMovement(productId: number, warehouseId: number, qty: number, label: string): Promise<number> {
    return num(await this.request('stockmovements', { method: 'POST', body: { product_id: productId, warehouse_id: warehouseId, qty, movementlabel: label } }));
  }

  // ----- Tiers : clients et fournisseurs
  async listThirdparties(o: { mode: 1 | 4; q?: string; page?: number; limit?: number }): Promise<Page<Customer>> {
    const s = sqlSafe(o.q || '');
    const filter = s ? "(t.nom:like:'%" + s + "%') or (t.town:like:'%" + s + "%') or (t.phone:like:'%" + s + "%')" : undefined;
    return this.page('thirdparties', { mode: o.mode, sqlfilters: filter, sortfield: 't.nom', sortorder: 'ASC' }, toCustomer, o.page, o.limit);
  }

  async names(ids: number[]): Promise<Record<number, string>> {
    const u = [...new Set(ids.filter((i) => i > 0))];
    if (!u.length) return {};
    const rows = await this.request<any[]>('thirdparties', { query: { sqlfilters: '(t.rowid:in:' + u.join(',') + ')', limit: u.length, properties: 'id,name' } });
    return Object.fromEntries((rows || []).map((r) => [num(r.id), txt(r.name)]));
  }

  async saveCustomer(id: number | null, c: CustomerInput): Promise<number> {
    const body = {
      name: c.name, client: c.supplier ? 0 : 1, fournisseur: c.supplier ? 1 : 0, code_client: c.supplier ? undefined : -1, code_fournisseur: c.supplier ? -1 : undefined,
      phone: c.phone, email: c.email, town: c.town, address: c.address, price_level: c.priceLevel, outstanding_limit: c.outstandingLimit || null,
      remise_percent: c.discount || 0, idprof1: c.rc, idprof2: c.nif, idprof3: c.ai, idprof4: c.nis, country_id: 13, tva_assuj: 0,
    };
    if (id) { if (c.supplier) { delete (body as any).fournisseur; delete (body as any).code_fournisseur; } else { delete (body as any).client; delete (body as any).code_client; } await this.request('thirdparties/' + id, { method: 'PUT', body }); }
    else id = num(await this.request('thirdparties', { method: 'POST', body }));
    // Le niveau de prix n'est pris ni à la création ni par PUT : appel dédié.
    if (!c.supplier) await this.request('thirdparties/' + id + '/setpricelevel/' + c.priceLevel, { method: 'PUT' });
    return id;
  }

  // ----- Documents de vente et d'achat
  async listDocs(kind: DocKind, o: { q?: string; socid?: number; page?: number; limit?: number; unpaid?: boolean } = {}): Promise<Page<Doc>> {
    const parts: string[] = [];
    if (kind === 'invoice') parts.push('(t.type:!=:2)');
    if (kind === 'credit') parts.push('(t.type:=:2)');
    const s = sqlSafe(o.q || '');
    if (s) parts.push("(t.ref:like:'%" + s + "%')");
    const q: Record<string, string | number | undefined> = { sqlfilters: parts.join(' and ') || undefined, sortfield: 't.rowid', sortorder: 'DESC', thirdparty_ids: o.socid || undefined };
    if (o.unpaid) q.status = 'unpaid';
    return this.page(DOC_PATH[kind], q, (r: any) => toDoc(kind, r), o.page, o.limit);
  }

  async doc(kind: DocKind, id: number): Promise<Doc> {
    const d = toDoc(kind, await this.request<any>(DOC_PATH[kind] + '/' + id));
    if (kind === 'invoice' || kind === 'credit') {
      const pays = await this.request<any[]>('invoices/' + id + '/payments').catch(() => []);
      d.payments = (pays || []).map((p) => ({ date: p.date ? Date.parse(String(p.date).replace(' ', 'T')) / 1000 : 0, amount: num(p.amount), type: p.type || '', ref: p.ref || '' }));
    }
    return d;
  }

  // Factures validées depuis un jour donné (datef >= jour) : base du tableau de bord.
  async invoicesSince(day: string): Promise<Doc[]> {
    const rows = await this.request<any[]>('invoices', { query: { sqlfilters: "(t.datef:>=:'" + day + "') and (t.fk_statut:>:0)", limit: 1000, sortfield: 't.rowid', sortorder: 'DESC' } });
    return (rows || []).map((r) => toDoc(r.type == 2 ? 'credit' : 'invoice', r));
  }

  // ----- Banque, utilisateurs
  async bankAccounts(): Promise<{ id: number; label: string; ref: string; balance: number }[]> {
    const rows = await this.request<any[]>('bankaccounts', { query: { limit: 20 } });
    return (rows || []).map((a) => ({ id: num(a.id), label: txt(a.label), ref: a.ref, balance: num(a.balance ?? a.solde) }));
  }

  async bankLines(accountId: number, limit = 50): Promise<{ id: number; date: number; label: string; amount: number; type: string }[]> {
    const rows = await this.request<any[]>('bankaccounts/' + accountId + '/lines', { query: { limit, sortfield: 'b.rowid', sortorder: 'DESC' } });
    return (rows || []).map((l) => ({ id: num(l.id), date: num(l.dateo), label: txt(l.label).replace(/^\((\w+)\)$/, '$1'), amount: num(l.amount), type: l.fk_type || '' })).sort((a, b) => b.id - a.id);
  }

  async users(): Promise<{ id: number; login: string; name: string; email: string; active: boolean; admin: boolean; groups: string[] }[]> {
    const rows = await this.request<any[]>('users', { query: { limit: 100, sortfield: 't.login', sortorder: 'ASC' } });
    return Promise.all((rows || []).map(async (u) => ({
      id: num(u.id), login: u.login, name: [u.firstname, u.lastname].filter(Boolean).join(' ') || u.login, email: u.email || '', active: num(u.statut ?? u.status) === 1, admin: num(u.admin) === 1,
      groups: ((await this.request<any[]>('users/' + u.id + '/groups').catch(() => [])) || []).map((g) => txt(g.name ?? g.nom)),
    })));
  }

  // Liste paginée : Dolibarr renvoie { data, pagination } avec pagination_data, ou 404 (traité en liste vide).
  private async page<T>(path: string, query: Record<string, string | number | undefined>, map: (r: any) => T, page = 0, limit = 50): Promise<Page<T>> {
    const r = await this.request<any>(path, { query: { ...query, limit, page, pagination_data: 'true' } });
    if (Array.isArray(r)) return { items: r.map(map), total: r.length, page, limit };
    return { items: (r?.data || []).map(map), total: num(r?.pagination?.total), page, limit };
  }
}

export type Page<T> = { items: T[]; total: number; page: number; limit: number };
export type Movement = { id: number; productId: number; warehouseId: number; qty: number; label: string; date: number; userId: number };
export type ProductInput = { ref: string; label: string; barcode?: string; brand?: string; oem?: string; price: number; prices?: number[]; refExt?: string; alert?: number; desired?: number; location?: string };
export type CustomerInput = { name: string; phone?: string; email?: string; town?: string; address?: string; priceLevel: number; outstandingLimit?: number; discount?: number; rc?: string; nif?: string; ai?: string; nis?: string; supplier?: boolean };
export type DocKind = 'proposal' | 'order' | 'shipment' | 'invoice' | 'credit' | 'supplierOrder';
export type DocLine = { productId: number; ref: string; label: string; qty: number; price: number; total: number; discount: number };
export type Doc = {
  kind: DocKind; id: number; ref: string; refExt: string; socid: number; date: number; due: number; status: number; paid: boolean;
  total: number; remain: number; note: string; author: number; lines: DocLine[]; payments?: { date: number; amount: number; type: string; ref: string }[];
};

const DOC_PATH: Record<DocKind, string> = { proposal: 'proposals', order: 'orders', shipment: 'shipments', invoice: 'invoices', credit: 'invoices', supplierOrder: 'supplierorders' };

function toDoc(kind: DocKind, r: any): Doc {
  const total = num(r.total_ttc);
  const paid = num(r.paye) === 1 || num(r.paid) === 1;
  return {
    kind, id: num(r.id), ref: r.ref || '', refExt: r.ref_ext || '', socid: num(r.socid), date: num(r.date ?? r.datef ?? r.date_commande ?? r.date_creation), due: num(r.date_lim_reglement),
    status: num(r.statut ?? r.status), paid, total, remain: r.remaintopay !== undefined && r.remaintopay !== null ? num(r.remaintopay) : paid ? 0 : total, note: txt(r.note_private || ''), author: num(r.fk_user_author ?? r.user_author),
    lines: (r.lines || []).map((l: any): DocLine => ({ productId: num(l.fk_product), ref: l.product_ref || l.ref || '', label: txt(l.product_label || l.libelle || l.label || l.desc || ''), qty: num(l.qty), price: num(l.subprice), total: num(l.total_ttc), discount: num(l.remise_percent) })),
  };
}

// Les libellés enregistrés par Dolibarr contiennent des entités HTML (« valid&eacute;e ») : on les décode pour l'affichage.
const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç', ocirc: 'ô', ucirc: 'û', icirc: 'î', euml: 'ë', iuml: 'ï', ugrave: 'ù', rsquo: '’', laquo: '«', raquo: '»' };
export function txt(s: unknown): string {
  return String(s ?? '').replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] ?? m);
}
// Une apostrophe ou une parenthèse casserait l'expression sqlfilters.
const sqlSafe = (s: string) => String(s).replace(/['"()\\%_]/g, ' ').trim();
const normOem = (s?: string) => (s || '').replace(/[\s.\-]/g, '').toUpperCase();

function toProduct(r: any): Product {
  const mp = r.multiprices || {};
  const level = (i: number) => num(mp[i]) || num(mp[1]) || num(r.price);
  const ao = r.array_options || {};
  const byWarehouse: Record<number, number> = {};
  for (const [w, v] of Object.entries<any>(r.stock_warehouse || {})) byWarehouse[num(w)] = num(v?.real);
  return {
    id: num(r.id), ref: r.ref, label: txt(r.label), barcode: r.barcode || '', brand: ao.options_brand || '', oem: ao.options_oem_ref || '',
    stock: num(r.stock_reel), prices: [level(1), level(2), level(3)], cost: num(r.pmp) || num(r.cost_price), minPrice: num(r.price_min), tva: num(r.tva_tx), refExt: r.ref_ext || '',
    alert: num(r.seuil_stock_alerte), desired: num(r.desiredstock), location: ao.options_emplacement || '', byWarehouse, description: txt(r.description || ''), created: num(r.date_creation),
  };
}

function toCustomer(r: any): Customer {
  return {
    id: num(r.id), name: txt(r.name || r.nom || ''), priceLevel: Math.min(3, Math.max(1, num(r.price_level) || 1)), town: r.town || '', phone: r.phone || '', outstandingLimit: num(r.outstanding_limit),
    email: r.email || '', address: r.address || '', discount: num(r.remise_percent), rc: r.idprof1 || '', nif: r.idprof2 || '', ai: r.idprof3 || '', nis: r.idprof4 || '', supplier: num(r.fournisseur) === 1,
  };
}

// Droits utiles à l'écran, déduits des droits Dolibarr de l'utilisateur (plutôt que du nom de son groupe).
export function capabilities(rights: Record<string, any>) {
  const has = (path: string) => path.split('.').reduce((o: any, k) => (o && o[k] !== undefined ? o[k] : undefined), rights) ? true : false;
  return {
    sell: has('facture.creer') && has('facture.paiement'),
    seeCost: has('produit.product_advance.read_supplier_prices'),
    bank: has('banque.modifier'),
    createProduct: has('produit.creer'),
    stockMoves: has('stock.mouvement.creer'),
    stock: has('stock.lire'),
    customers: has('societe.client.voir') || (has('societe.lire') && has('facture.lire')),
    editCustomers: has('societe.creer'),
    invoices: has('facture.lire'),
    orders: has('commande.lire'),
    proposals: has('propale.lire') || has('propal.lire'),
    purchases: has('fournisseur.commande.lire'),
    bankRead: has('banque.lire'),
    users: has('user.user.lire'),
    dashboard: has('facture.lire') && (has('banque.lire') || has('produit.creer')),
  };
}
export type Capabilities = ReturnType<typeof capabilities>;
