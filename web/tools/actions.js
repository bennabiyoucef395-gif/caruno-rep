/* =================================================================== DOLIBARR : actions écrites dans Dolibarr
   Remplace les actions de la maquette qui modifiaient les données de test. Chaque écriture passe par l'API,
   puis les données concernées sont relues dans Dolibarr. */
// Action asynchrone : message d'attente, erreur lisible ; session expirée → retour à la connexion.
async function run(fn, wait) {
  if (S.ui.busy) return;
  S.ui.busy = wait || '…';
  if (wait) toast(wait);
  render();
  try { await fn(); }
  catch (e) {
    if (DOLI.expired) { A.logout(); toast('Session Dolibarr expirée : reconnectez-vous.'); }
    else toast(e && e.message ? e.message : String(e));
  } finally { S.ui.busy = ''; render(); }
}
const notYet = (what) => () => { toast(what + ' : pas encore relié à Dolibarr. À faire dans Dolibarr pour l’instant.'); };
const otherWh = (w) => WAREHOUSES.find((x) => x !== w) || w;

// ----- connexion, chargement
async function boot() {
  if (S.user && S.user.token) {
    DOLI.url = S.user.url; DOLI.token = S.user.token; S.ready = false; S.ui.loadErr = ''; render();
    try {
      const me = await DOLI.whoami();
      S.user.role = me.role; S.user.name = me.name; saveUser();
      await DOLI.loadAll();
      S.ready = true;
    } catch (e) {
      if (e.status === 401) { S.user = null; saveUser(); S.ui.login = null; }
      else S.ui.loadErr = e.message;
    }
  }
  render();
}
A.reload = () => { boot(); return false; };
F.login = (form, fd) => {
  const L = S.ui.login, url = String(fd.get('url') || '').trim(), login = String(fd.get('login') || '').trim(), pw = String(fd.get('password') || '');
  L.url = url; L.login = login; L.err = '';
  const host = url.replace(/^https?:\/\//i, '').split(/[/?#]/)[0];
  if (!host || /\s/.test(url) || !(/[.:]/.test(host) || /^localhost$/i.test(host))) { L.err = 'Ce n’est pas une adresse web : mettez l’adresse du Dolibarr (ex. http://localhost:8080).'; return; }
  L.busy = true;
  (async () => {
    try {
      await DOLI.login(url, login, pw);
      const me = await DOLI.whoami();
      try { localStorage.setItem('caruno-url', url); } catch (e) {}
      S.user = { login: me.login, name: me.name, role: me.role, url, token: DOLI.token }; saveUser();
      L.busy = false; S.ready = false; S.ui.loadErr = ''; render();
      await DOLI.loadAll();
      S.ready = true; S.ui.resumeAsked = false; S.ui.cat = null;
      location.hash = '#/' + HOME[me.role];
    } catch (e) {
      L.busy = false;
      if (S.user && !S.ready) S.ui.loadErr = e.message; else L.err = e.message;
    }
    render();
  })();
};
A.logout = () => {
  DOLI.token = ''; S.user = null; saveUser(); S.ready = false; S.db = load();
  S.ui = { caisse: null, modal: null, toast: '', drawer: false, form: {}, formKey: '' };
  location.hash = ''; toast('Déconnecté.');
};

// ----- recherche dans tout Dolibarr pendant la frappe
['pfQ', 'posQ', 'edQ', 'poQ'].forEach((k) => { const base = I[k]; I[k] = (v, el) => { const r = base(v, el); DOLI.searchLater(v); return r; }; });
const posEnterBase = E.posEnter;
E.posEnter = (el) => {
  const u = posUi(), q = u.q.trim();
  // Code-barres ou pièce pas encore chargée : on la cherche dans Dolibarr avant de l'ajouter.
  if (q && !S.db.parts.some((x) => x.ean === q) && (/^\d{8,}$/.test(q) || !posResults().length)) {
    run(async () => { await DOLI.searchParts(q); posEnterBase(el); });
    return;
  }
  posEnterBase(el);
};
A.posScanSim = () => { focusNext('pos-q'); toast('Scannez le code-barres avec la douchette : il arrive dans la recherche.'); };
A.scanSim = () => { focusNext('scan-code'); toast('Scannez le code-barres avec la douchette.'); };
A.formScanEan = () => { focusNext('f-ean'); toast('Scannez le code-barres avec la douchette.'); };
E.scanEnter = () => {
  const code = String(S.ui.scan.code || '').trim();
  if (!code) return;
  if (S.db.parts.some((x) => x.ean === code || norm(x.ref) === norm(code))) { scanCode(code); return; }
  run(async () => { await DOLI.searchParts(code); scanCode(code); });
};

// ----- caisse : vente dans Dolibarr (facture → validation sur le Magasin → règlements)
function finishSale(j, d, steps) {
  const u = posUi();
  if (j.change) steps.push({ t: 'Rendu au client : ' + fmt(j.change) });
  d.change = j.change; d.steps = steps; if (j.note) d.note = j.note;
  if (!j.counted) { sessAdd('count', 1); sessAdd('total', d.ttc); j.pay.forEach((p) => sessAdd(p.mode, p.amount)); if (j.credit) sessAdd('credit', j.credit); j.counted = true; }
  S.db.journal = S.db.journal.filter((x) => x !== j);
  u.done = d.ref; u.cutOff = null; u.screen = 'receipt'; save();
}
A.posValidate = () => {
  const u = posUi(), o = curOrder(), T = orderTotals(o), pp = posPlan(o, T);
  if (!pp.ok) { toast(pp.msg); return; }
  if (S.ui.busy) return false;
  // Chaque prix modifié à la main part dans la note privée de la facture.
  const log = T.lines.filter((x) => x.l.price != null || x.l.disc).map((x) => x.p.brand + ' ' + x.p.ref + ' : ' + fmt(x.ref) + ' → ' + fmt(x.unit) + ' (' + pctTxt(x.unit, x.ref) + ')' + (x.below ? ', sous le prix minimum' : '') + (x.l.reason ? ', motif : ' + x.l.reason : '') + ' — ' + S.user.name);
  if (!o.uid) o.uid = Math.random().toString(36).slice(2, 8).toUpperCase();
  const j = { sale: o.ref, ext: o.ref + '-' + o.uid, invoice: '', device: DEVICE, time: nowStr(), step: 'validation', client: o.client, ttc: T.ttc,
    lines: T.lines.map((x) => ({ pid: x.p.id, qty: x.l.qty, price: x.unit })), pay: pp.pay, credit: pp.credit, notePrivate: log.length ? log : undefined, note: o.note, change: pp.change };
  const idx = S.db.posOrders.indexOf(o);
  S.db.journal.push(j);
  S.db.posOrders.splice(idx, 1); S.db.posOrders.push(newOrder()); u.cur = S.db.posOrders.length - 1; save();
  run(async () => {
    const steps = [];
    try { finishSale(j, await DOLI.sale(j, steps), steps); }
    catch (e) {
      if (e.status === 0 || j.step === 'paiement') { cutOff(j); throw e; }
      // Refus de Dolibarr avant la validation : la commande revient à l'écran, rien n'est sorti du stock.
      S.db.journal = S.db.journal.filter((x) => x !== j);
      S.db.posOrders.splice(idx, 0, o); u.cur = idx; u.screen = 'payment'; save();
      throw e;
    }
  }, 'Enregistrement de la vente dans Dolibarr…');
};
A.resumeSale = (el) => {
  const j = S.db.journal.find((x) => x.sale === el.dataset.arg);
  S.ui.modal = null;
  if (!j) return;
  run(async () => { const steps = []; finishSale(j, await DOLI.sale(j, steps), steps); go('#/caisse'); }, 'Reprise de la vente ' + j.sale + '…');
};
const posCloseBase = A.posClose;
A.posClose = () => {
  if (S.db.journal.length) return posCloseBase();
  const s = S.db.session, u = posUi(), expected = drawerCash(), counted = u.counted === '' ? expected : Number(u.counted) || 0;
  const note = ['Poste ' + DEVICE + ', ouverte le ' + s.opened + ' par ' + s.by, 'Ventes : ' + s.count + ', total ' + fmt(s.total),
    'Espèces ' + fmt(s.especes) + ' · chèques ' + fmt(s.cheque) + ' · virements ' + fmt(s.virement) + ' · crédit ' + fmt(s.credit),
    'Fond ' + fmt(s.opening) + ', entrées/sorties ' + s.moves.map((m) => (m.type === 'in' ? '+' : '−') + fmt(m.amount) + ' ' + m.reason).join(', '),
    'Attendu ' + fmt(expected) + ', compté ' + fmt(counted) + ', écart ' + fmt(counted - expected)].join('\n');
  run(async () => {
    const now = Math.floor(Date.now() / 1000);
    await DOLI.api('agendaevents', { method: 'POST', body: { userownerid: DOLI.me.id, type_code: 'AC_OTH', label: 'Clôture de caisse ' + s.ref + ' (' + DEVICE + ')', note_private: note, datep: now, datef: now, percentage: -1, fulldayevent: 0 } });
    posCloseBase();
  }, 'Enregistrement du rapport de caisse dans Dolibarr…');
};
F.mPosClient = (form, fd) => {
  const name = String(fd.get('name') || '').trim();
  if (!name) { toast('Le nom est obligatoire.'); return; }
  run(async () => {
    const c = await DOLI.saveClient(null, { name, phone: String(fd.get('phone') || ''), cat: fd.get('cat') || 'Particulier' });
    const u = posUi(), o = curOrder(); o.client = c.id; o.pay = []; S.ui.modal = null; u.screen = u.back || 'products'; save();
    toast('Client ' + name + ' créé et choisi.');
  }, 'Création du client dans Dolibarr…');
};

// ----- pièces
F.savePiece = (form) => {
  const f = S.ui.form, id = form.dataset.arg;
  const num = (k) => Number(String(f[k] || '').replace(/\D/g, '')) || 0;
  if (!f.name || !f.brand || !f.ref || !num('p0')) { toast('Désignation, marque, référence et prix public sont obligatoires.'); return; }
  const prices = [num('p0'), num('p1') || num('p0'), num('p2') || num('p1') || num('p0')];
  const old = id ? part(id) : null;
  run(async () => {
    const pid = await DOLI.savePart(id, { name: f.name, brand: f.brand, ref: f.ref, oem: f.oem, ean: f.ean, fam: f.fam, type: f.type, locM: f.locM, seuil: num('seuil'), souhaite: num('souhaite'), floor: num('floor'), tva: f.tva }, prices);
    if (!id && num('initQty')) await DOLI.move(pid, 'Stock initial', num('initQty'), WAREHOUSES[0]);
    const fresh = (f.photos || []).filter((ph) => !old || old.photos.indexOf(ph) === -1);
    for (let i = 0; i < fresh.length; i++) await DOLI.uploadPhoto(part(pid), fresh[i], i);
    await DOLI.refreshParts([pid]);
    part(pid).extra = false; DOLI.lazy['extra:' + pid] = '';
    if (!id) DOLI.total++;
    S.ui.formKey = '';
    toast(id ? 'Pièce enregistrée dans Dolibarr.' : 'Pièce ' + f.brand + ' ' + f.ref + ' créée dans Dolibarr.');
    go('#/pieces/' + pid);
  }, 'Enregistrement de la pièce dans Dolibarr…');
};
C.photoPiece = (v, el) => {
  const p = part(el.dataset.arg), files = Array.from(el.files || []);
  run(async () => {
    let n = 0;
    for (const f of files) { const ph = await compress(f); if (ph) await DOLI.uploadPhoto(p, ph, n++); }
    await DOLI.loadPartExtra(p.id);
    toast(n + ' photo(s) envoyée(s) dans Dolibarr.');
  }, 'Envoi des photos…');
  return false;
};
A.exportCsv = () => {
  const f = S.ui.pf || { q: '' }, list = search(f.q, S.db.parts);
  const cell = (x) => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';
  const rows = [['Référence', 'Marque', 'Désignation', 'OEM', 'EAN', 'Famille'].concat(WAREHOUSES, ['Public', 'Garage', 'Gros'])].concat(
    list.map((p) => [p.ref, p.brand, p.name, p.oem, p.ean, p.fam].concat(WAREHOUSES.map((w) => p.stock[w]), p.prices)));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n')], { type: 'text/csv' }));
  a.download = 'pieces-' + TODAY + '.csv'; a.click();
  toast(list.length + ' pièce(s) exportée(s).');
  return false;
};

// ----- stock : mouvements Dolibarr
async function moveAll(list) { for (const m of list) await DOLI.move(m[0], m[1], m[2], m[3]); await DOLI.refreshParts(list.map((m) => Number(m[0]))); }
F.transfer = () => {
  const f = S.ui.form, p = part(f.pid), q = Number(f.qty) || 0;
  if (!p) return;
  if (f.from === f.to) { toast('Choisissez deux entrepôts différents.'); return; }
  if (q <= 0 || q > p.stock[f.from]) { toast('Quantité impossible : ' + p.stock[f.from] + ' en ' + f.from + '.'); return; }
  run(async () => { await moveAll([[p.id, 'Transfert ' + f.from + ' → ' + f.to, -q, f.from], [p.id, 'Transfert ' + f.from + ' → ' + f.to, q, f.to]]); toast(q + ' × ' + p.brand + ' ' + p.ref + ' transféré(s) vers ' + f.to + '.'); }, 'Transfert…');
};
F.mTransfer = (form, fd) => {
  const p = part(S.ui.modal.pid), from = fd.get('from'), to = otherWh(from), q = Number(fd.get('qty')) || 0;
  if (q <= 0 || q > p.stock[from]) { toast('Quantité impossible : ' + p.stock[from] + ' en ' + from + '.'); return; }
  run(async () => { await moveAll([[p.id, 'Transfert ' + from + ' → ' + to, -q, from], [p.id, 'Transfert ' + from + ' → ' + to, q, to]]); S.ui.modal = null; toast(q + ' transféré(s) vers ' + to + '.'); }, 'Transfert…');
};
F.mCorrect = (form, fd) => {
  const p = part(S.ui.modal.pid), wh = fd.get('wh'), real = Number(fd.get('real')) || 0, gap = real - p.stock[wh];
  if (!gap) { S.ui.modal = null; toast('Aucun écart.'); return; }
  run(async () => { await moveAll([[p.id, 'Correction : ' + fd.get('why'), gap, wh]]); S.ui.modal = null; toast('Stock corrigé (' + (gap > 0 ? '+' : '') + gap + ').'); }, 'Correction du stock…');
};
A.applyInventory = () => {
  const list = [];
  Object.keys(S.ui.inv || {}).forEach((key) => { const v = S.ui.inv[key]; if (v === '' || v == null) return; const [wh, pid] = key.split(':'), p = part(pid), gap = Number(v) - p.stock[wh]; if (gap) list.push([pid, 'Correction inventaire ' + wh + (p.fam ? ' (' + p.fam + ')' : ''), gap, wh]); });
  if (!list.length) { toast('Aucun écart à corriger.'); return; }
  run(async () => { await moveAll(list); S.ui.inv = {}; toast(list.length + ' correction(s) de stock enregistrée(s).'); }, 'Enregistrement de l’inventaire…');
};
A.scanSaveCount = () => {
  const sc = S.ui.scan, p = part(sc.pid), wh = sc.wh || WAREHOUSES[0], n = sc.count === '' ? p.stock[wh] : Number(sc.count), gap = n - p.stock[wh];
  if (!gap) { sc.count = ''; toast('Comptage conforme.'); return; }
  run(async () => { await moveAll([[p.id, 'Inventaire au scan (' + wh + ' ' + (p.loc[wh] || '') + ')', gap, wh]]); sc.count = ''; toast('Correction de ' + (gap > 0 ? '+' : '') + gap + ' enregistrée en ' + wh + '.'); }, 'Enregistrement…');
};

// ----- clients, fournisseurs
F.saveClient = (form) => {
  const f = S.ui.form, id = form.dataset.arg;
  if (!f.name) { toast('Le nom est obligatoire.'); return; }
  run(async () => {
    const c = await DOLI.saveClient(id || null, Object.assign({}, f, { plafond: Number(String(f.plafond || '').replace(/\D/g, '')) || 0 }));
    S.ui.formKey = ''; toast(id ? 'Client enregistré dans Dolibarr.' : 'Client ' + c.name + ' créé dans Dolibarr.'); go('#/clients/' + c.id);
  }, 'Enregistrement du client…');
};
F.mSupplier = (form, fd) => {
  const f = { name: String(fd.get('name') || '').trim(), town: fd.get('town'), phone: fd.get('phone'), email: fd.get('email') };
  if (!f.name) return;
  run(async () => { await DOLI.saveSupplier(f); S.ui.modal = null; toast('Fournisseur créé dans Dolibarr.'); }, 'Création du fournisseur…');
};

// ----- règlements
A.modalSettle = (el) => { S.ui.modal = { kind: 'settle', cid: el.dataset.arg, amount: String(Math.round(encours(el.dataset.arg))) }; };
F.mPay = (form, fd) => {
  const d = doc(S.ui.modal.ref), amt = Math.min(Number(String(fd.get('amount')).replace(/\D/g, '')) || 0, d.ttc - d.paid), mode = fd.get('mode');
  if (amt <= 0) return;
  run(async () => { await DOLI.pay(d, mode, amt, 'Règlement ' + d.ref); await DOLI.refreshDoc('facture', d.id); DOLI.computeDay(); S.ui.modal = null; toast(fmt(amt) + ' encaissés sur ' + d.ref + '.'); }, 'Enregistrement du règlement…');
};
F.mSettle = (form, fd) => {
  const m = S.ui.modal, alloc = allocate(m.cid, Number(m.amount) || 0), mode = fd.get('mode');
  run(async () => {
    for (const a of alloc) { await DOLI.pay(a.d, mode, a.take, 'Règlement client'); await DOLI.refreshDoc('facture', a.d.id); }
    DOLI.computeDay(); S.ui.modal = null; toast('Règlement de ' + fmt(Number(m.amount)) + ' réparti sur ' + alloc.length + ' facture(s).');
  }, 'Enregistrement du règlement…');
};

// ----- ventes : devis, commandes, facturation
A.edSave = (el) => {
  const [type, mode] = el.dataset.arg.split(':'), e = S.ui.editor;
  const lines = e.lines.map((l) => ({ pid: l.pid, qty: l.qty, price: Math.round(l.price * (1 - e.remise / 100)) }));
  run(async () => { const d = await DOLI.createDoc(type, e.client, lines, e.note, mode !== 'brouillon'); S.ui.editorKey = ''; toast(TYPE_LABEL[type] + ' ' + d.ref + ' enregistré dans Dolibarr.'); go('#/ventes/' + d.ref); }, 'Enregistrement…');
};
A.docStatus = (el) => {
  const [ref, st] = el.dataset.arg.split(':'), d = doc(ref), path = d.type === 'devis' ? 'proposals' : 'orders';
  const after = async () => { const n = await DOLI.refreshDoc(d.type, d.id); toast(n.ref + ' : ' + STATUS[n.type][n.status][0].toLowerCase() + '.'); go('#/ventes/' + n.ref); };
  if ((d.type === 'devis' && st === 'envoye') || (d.type === 'commande' && st === 'validee')) return run(async () => { await DOLI.api(path + '/' + d.id + '/validate', { method: 'POST', body: { notrigger: 0 } }); await after(); }, 'Validation dans Dolibarr…');
  if (d.type === 'devis' && st === 'refuse') return run(async () => { await DOLI.api('proposals/' + d.id + '/close', { method: 'POST', body: { status: 3, notrigger: 0 } }); await after(); }, 'Enregistrement…');
  // « Prête » n'existe pas dans Dolibarr : repère gardé sur ce poste.
  d.status = st; toast(ref + ' : ' + STATUS[d.type][st][0].toLowerCase() + ' (repère sur ce poste).');
};
A.docConvert = (el) => {
  const d = doc(el.dataset.arg);
  run(async () => {
    const r = await DOLI.api('orders/createfromproposal/' + d.id, { method: 'POST' });
    const oid = DOLI.num(r && typeof r === 'object' ? r.id : r);
    await DOLI.api('orders/' + oid + '/validate', { method: 'POST', body: { notrigger: 0 } });
    await DOLI.api('proposals/' + d.id + '/close', { method: 'POST', body: { status: 2, notrigger: 0 } }).catch(() => null);
    await DOLI.refreshDoc('devis', d.id);
    const o = await DOLI.refreshDoc('commande', oid);
    toast('Commande ' + o.ref + ' créée depuis ' + d.ref + '.'); go('#/ventes/' + o.ref);
  }, 'Création de la commande…');
};
A.docInvoice = (el) => {
  const d = doc(el.dataset.arg), cc = creditCheck(d.client, d.ttc);
  if (cc.block) { toast(cc.msg); return; }
  run(async () => {
    const r = await DOLI.api('invoices/createfromorder/' + d.id, { method: 'POST' });
    const iid = DOLI.num(r && typeof r === 'object' ? r.id : r);
    await DOLI.api('invoices/' + iid + '/validate', { method: 'POST', body: { idwarehouse: DOLI.whId[WAREHOUSES[0]], notrigger: 0 } });
    const fa = await DOLI.refreshDoc('facture', iid);
    await DOLI.refreshDoc('commande', d.id).catch(() => null);
    await DOLI.refreshParts(fa.lines.map((l) => l.pid)); DOLI.computeDay();
    toast('Facture ' + fa.ref + ' validée : stock sorti du Magasin.' + (cc.msg ? ' ' + cc.msg : '')); go('#/ventes/' + fa.ref);
  }, 'Facturation…');
};

// ----- achats
A.poCreate = () => {
  const e = S.ui.poEd;
  run(async () => {
    const id = DOLI.num(await DOLI.api('supplierorders', { method: 'POST', body: { socid: Number(e.supplier), lines: e.lines.map((l) => ({ fk_product: l.pid, qty: l.qty, subprice: l.price, tva_tx: (part(l.pid) || {}).tva || 0, product_type: 0 })) } }));
    const o = DOLI.mapPO(await DOLI.api('supplierorders/' + id));
    S.db.pos.unshift(o); S.ui.poEd = null; toast('Commande ' + o.ref + ' créée en brouillon dans Dolibarr.'); go('#/achats/' + o.ref);
  }, 'Création de la commande fournisseur…');
};
A.poSend = (el) => {
  const o = po(el.dataset.arg);
  run(async () => {
    await DOLI.api('supplierorders/' + o.id + '/validate', { method: 'POST', body: { idwarehouse: 0, notrigger: 0 } });
    await DOLI.api('supplierorders/' + o.id + '/approve', { method: 'POST', body: { idwarehouse: 0, secondlevel: 0 } }).catch(() => null);
    await DOLI.api('supplierorders/' + o.id + '/makeorder', { method: 'POST', body: { date: Math.floor(Date.now() / 1000), method: 0 } }).catch(() => null);
    const n = DOLI.mapPO(await DOLI.api('supplierorders/' + o.id));
    Object.assign(o, n); toast('Commande ' + o.ref + ' validée et passée au fournisseur.'); go('#/achats/' + o.ref);
  }, 'Envoi de la commande…');
};
A.poValidate = (el) => {
  const o = po(el.dataset.arg), lines = o.lines.filter((l) => l.rec - l.done > 0);
  if (!lines.length) return;
  run(async () => {
    await DOLI.api('supplierorders/' + o.id + '/receive', { method: 'POST', body: { closeopenorder: o.lines.every((l) => l.rec >= l.qty) ? 1 : 0, comment: 'Réception CARUNO', lines: lines.map((l) => ({ id: l.lineId, fk_product: l.pid, qty: l.rec - l.done, warehouse: DOLI.whId[WAREHOUSES[0]] })) } });
    lines.forEach((l) => { l.done = l.rec; });
    await DOLI.refreshParts(lines.map((l) => l.pid));
    o.status = o.lines.every((l) => l.rec >= l.qty) ? 'recue' : 'reception';
    toast(lines.reduce((t, l) => t + l.rec, 0) + ' pièce(s) entrées en ' + WAREHOUSES[0] + '.');
  }, 'Réception dans Dolibarr…');
};
A.poScan = (el) => { S.ui.scan = { mode: 'reception', code: '', pid: null, count: '', wh: WAREHOUSES[0], po: el.dataset.arg }; go('#/scanner'); focusNext('scan-code'); };
A.prepareOrders = notYet('Préparation automatique des commandes fournisseurs');

// ----- pas encore reliés : retours et avoirs, livraisons, remises de chèques, dépôts, comptes utilisateurs
A.modalReturn = notYet('Retours et avoirs');
A.returnStart = notYet('Retours et avoirs');
A.posRefund = notYet('Remboursement d’un ticket');
A.modalShip = notYet('Livraison partielle');
A.modalBillShip = notYet('Facturation des livraisons');
A.chkDeposit = notYet('Bordereau de remise de chèques');
A.modalCashDeposit = notYet('Dépôt d’espèces en banque');
A.userToggle = notYet('Activation des comptes');
F.saveUser = notYet('Création de compte');
A.cleanOrphans = notYet('Suppression des brouillons');
F.changePw = (form) => {
  const old = form.querySelector('#pw-old').value, nw = form.querySelector('#pw-new').value;
  run(async () => {
    const t = DOLI.token;
    try { await DOLI.login(DOLI.url, S.user.login, old); } catch (e) { DOLI.token = t; throw new Error('Mot de passe actuel incorrect.'); }
    await DOLI.api('users/' + DOLI.me.id, { method: 'PUT', body: { pass: nw } });
    form.reset(); toast('Mot de passe modifié dans Dolibarr.');
  }, 'Changement du mot de passe…');
};

boot();
