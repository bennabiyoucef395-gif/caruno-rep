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
};

export type Customer = { id: number; name: string; priceLevel: number; town: string; phone: string; outstandingLimit: number };

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
export function apiRoot(url: string): string {
  let u = url.trim().replace(/\/+$/, '');
  if (u && !/^https?:\/\//i.test(u)) u = (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u) ? 'http://' : 'https://') + u;
  return /\/api\/index\.php$/.test(u) ? u : u + '/api/index.php';
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
      throw new DolibarrError('Dolibarr injoignable : vérifiez l’adresse et le réseau.', 0);
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

  async createProduct(p: { ref: string; label: string; barcode?: string; brand?: string; oem?: string; price: number; refExt?: string }): Promise<number> {
    const body: any = {
      ref: p.ref, label: p.label, type: 0, status: 1, status_buy: 1, price: p.price, price_base_type: 'HT', tva_tx: 0,
      barcode: p.barcode || undefined, ref_ext: p.refExt || undefined,
      array_options: { options_brand: p.brand || '', options_oem_ref: (p.oem || '').replace(/[\s.\-]/g, '').toUpperCase() },
    };
    return num(await this.request('products', { method: 'POST', body }));
  }
}

function toProduct(r: any): Product {
  const mp = r.multiprices || {};
  const level = (i: number) => num(mp[i]) || num(mp[1]) || num(r.price);
  const ao = r.array_options || {};
  return {
    id: num(r.id), ref: r.ref, label: r.label || '', barcode: r.barcode || '', brand: ao.options_brand || '', oem: ao.options_oem_ref || '',
    stock: num(r.stock_reel), prices: [level(1), level(2), level(3)], cost: num(r.pmp) || num(r.cost_price), minPrice: num(r.price_min), tva: num(r.tva_tx), refExt: r.ref_ext || '',
  };
}

function toCustomer(r: any): Customer {
  return { id: num(r.id), name: r.name || r.nom || '', priceLevel: Math.min(3, Math.max(1, num(r.price_level) || 1)), town: r.town || '', phone: r.phone || '', outstandingLimit: num(r.outstanding_limit) };
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
  };
}
export type Capabilities = ReturnType<typeof capabilities>;
