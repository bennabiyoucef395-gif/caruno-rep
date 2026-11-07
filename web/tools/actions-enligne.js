/* =================================================================== MAGASIN EN LIGNE : CHOISIR LES PIÈCES MISES EN LIGNE */
// Les pièces en stock (Magasin ou Réserve) et en vente, en tuiles carrées, avec un interrupteur par pièce :
// en ligne = champ Dolibarr du produit « en_ligne » à 1 ; hors ligne = 0 ou vide (valeur par défaut : rien n'est en ligne).
// Le choix est enregistré dans Dolibarr dès le clic, donc partagé par tous les postes et lu par le futur magasin en ligne.
// Règles :
//   - pas de mise en ligne sans prix : le gérant saisit le prix public sur la tuile (niveau 1, enregistré dans Dolibarr) ;
//     sans photo, la pièce peut aller en ligne mais la tuile le signale ;
//   - une pièce en ligne mais en rupture (stock nul ou vide) ou hors vente est signalée en tête, avec « Tout retirer » ;
//   - sélection de plusieurs pièces (ou de tous les résultats) : mettre en ligne / retirer en une fois.
// Champ créé par caruno-erp provisioning/12-product-extrafields.sh. Réservé au gérant et au responsable (droit produit:creer).
const WEB_PAGE = 24;
if (!P.edit) P.edit = '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-4-4L4 16z"/><path d="M14 6l4 4"/>';
P.enligne = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>';
NAV.splice(NAV.findIndex((n) => n.id === 'catalogue') + 1, 0, { id: 'enligne', label: 'Magasin en ligne', roles: ['responsable', 'gerant'] });

function webUi() {
  if (!S.ui.web) S.ui.web = { q: '', f: '', page: 0, items: [], total: 0, on: null, all: null, out: 0, loading: false, err: '', seq: 0,
    busy: {}, started: false, sel: {}, bulk: null, price: {}, wantOn: {}, priceEdit: {} };
  return S.ui.web;
}
const webIsOn = (p) => String((p.array_options || {}).options_en_ligne || '') === '1';
const webPrice = (p) => DOLI.num((p.multiprices || {})[1]) || DOLI.num(p.price);
// Pièces présentes au magasin ou en réserve (stock total > 0 : Magasin et Réserve sont les seuls entrepôts), en vente.
const WEB_BASE = '(t.tosell:=:1) and (t.stock:>:0)';
const WEB_ON = '(ef.en_ligne:=:1)', WEB_OFF = '((ef.en_ligne:=:0) or (ef.en_ligne:is:NULL))';
// En ligne mais pas disponible : stock nul ou vide (NULL pour les pièces jamais entrées en stock), ou hors vente (corbeille).
const WEB_OUT = '(ef.en_ligne:=:1) and ((t.tosell:=:0) or (t.stock:<=:0) or (t.stock:is:NULL))';
// Même recherche que le catalogue ; la référence est cherchée telle quelle (« BUY-1793… ») et sans séparateurs, comme un OEM.
function webSearchFilter(q) {
  const s = sqlSafe(q), oem = s.toUpperCase().replace(/[\s.\-]/g, ''), words = s.replace(/\s+/g, '%');
  return s ? "((ef.oem_ref:like:'%" + oem + "%') or (t.ref:like:'%" + s + "%') or (t.ref:like:'%" + oem + "%') or (t.label:like:'%" + words + "%') or (t.description:like:'%" + words + "%')" + searchExtra(s) + ')' : '';
}
function webFilter(w) {
  return (w.f === 'rupture' ? [WEB_OUT] : [WEB_BASE, w.f === 'on' ? WEB_ON : w.f === 'off' ? WEB_OFF : '']).concat(webSearchFilter(w.q)).filter(Boolean).join(' and ');
}
async function webTotal(filter) {
  const r = await DOLI.api('products', { query: { limit: 1, pagination_data: 'true', properties: 'id', sqlfilters: filter } });
  return r && r.pagination ? DOLI.num(r.pagination.total) : 0;
}
async function webCounts() {
  const w = webUi();
  try { [w.on, w.all, w.out] = await Promise.all([webTotal(WEB_BASE + ' and ' + WEB_ON), webTotal(WEB_BASE), webTotal(WEB_OUT)]); } catch (e) { /* compteurs vides */ }
  render();
}
async function webSearch(page) {
  const w = webUi(), seq = ++w.seq;
  w.loading = true; w.err = ''; render();
  try {
    const r = await DOLI.api('products', { query: { limit: WEB_PAGE, page, sortfield: 't.label', sortorder: 'ASC', pagination_data: 'true', includestockdata: '1',
      properties: 'id,ref,label,stock_reel,stock_warehouse,array_options,multiprices,price,status', sqlfilters: webFilter(w) } });
    if (seq !== w.seq) return;
    w.items = Array.isArray(r) ? r : (r.data || []); w.total = Array.isArray(r) ? r.length : DOLI.num(r.pagination && r.pagination.total); w.page = page;
  } catch (e) { if (seq === w.seq) w.err = e.message; }
  if (seq !== w.seq) return;
  w.loading = false; render();
  // Photos : même cache que le catalogue (photo importée <ref>.jpg), 6 à la fois ; '' = pas de photo.
  const c = catUi(), todo = w.items.map((p) => p.ref).filter((ref) => !(ref in c.thumbs));
  for (let i = 0; i < todo.length && seq === w.seq; i += 6) {
    await Promise.all(todo.slice(i, i + 6).map(async (ref) => {
      try {
        const d = await DOLI.api('documents/download', { query: { modulepart: 'product', original_file: ref + '/thumbs/' + ref + '_small.jpg' } });
        c.thumbs[ref] = d && d.content ? 'data:' + d['content-type'] + ';base64,' + d.content : '';
      } catch (e) { c.thumbs[ref] = ''; }
    }));
    if (seq === w.seq) render();
  }
}
const webPut = (id, on) => DOLI.api('products/' + encodeURIComponent(id), { method: 'PUT', body: { array_options: { options_en_ligne: on ? '1' : '0' } } });
const webErr = (e) => (e.status === 403 ? 'Dolibarr refuse la modification : droit « créer/modifier les produits » nécessaire.' : 'Non enregistré : ' + e.message);
// Nom affiché comme ailleurs (nom anglais du fournisseur traduit en français / arabe).
const webName = (p) => (window.PARTS_I18N && LANG() !== 'en' && PARTS_I18N.translate(p.label, LANG())) || p.label;

// Clic sur l'interrupteur : affiché tout de suite, enregistré dans Dolibarr ; refus → l'interrupteur revient.
// Mise en ligne sans prix : rien n'est envoyé, le champ prix de la tuile prend le focus ; le prix enregistré, la pièce passe en ligne.
async function webToggle(id) {
  const w = webUi(), p = w.items.find((x) => String(x.id) === String(id));
  if (!p || w.busy[id] || w.bulk) return;
  const next = !webIsOn(p);
  if (next && !(webPrice(p) > 0)) {
    w.wantOn[id] = true; toast('Ajoutez d’abord le prix de vente : la pièce passera en ligne dès qu’il sera enregistré.');
    focusNext('web-p-' + id); render(); return;                  // focusNext agit au rendu suivant
  }
  p.array_options = Object.assign({}, p.array_options, { options_en_ligne: next ? '1' : '0' });
  w.busy[id] = true;
  if (w.on !== null && w.f !== 'rupture') w.on += next ? 1 : -1;
  render();
  try {
    await webPut(id, next);
    toast((next ? 'En ligne : ' : 'Hors ligne : ') + p.ref + ' · ' + webName(p) + '.');
    if (w.f === 'rupture') webCounts();
  } catch (e) {
    p.array_options.options_en_ligne = next ? '0' : '1';
    if (w.on !== null && w.f !== 'rupture') w.on += next ? -1 : 1;
    toast(webErr(e));
  }
  delete w.busy[id];
  render();
}
// Prix public saisi sur la tuile (prix de niveau 1, comme la fiche pièce ; les autres niveaux ne changent pas).
async function webSetPrice(id) {
  const w = webUi(), p = w.items.find((x) => String(x.id) === String(id)), v = Number(String(w.price[id] || '').replace(/\D/g, ''));
  if (!p) return;
  if (!(v > 0)) { toast('Tapez un prix de vente supérieur à 0.'); focusNext('web-p-' + id); return; }
  const before = webPrice(p);
  w.busy[id] = true; render();
  try {
    await DOLI.api('products/' + encodeURIComponent(id), { method: 'PUT', body: { price: String(v), price_base_type: 'HT', multiprices: { 1: String(v) }, multiprices_base_type: { 1: 'HT' } } });
    p.multiprices = Object.assign({}, p.multiprices, { 1: String(v) }); p.price = String(v);
    delete w.price[id]; delete w.priceEdit[id];
    const local = part(p.id); if (local && local.prices) local.prices[0] = v;     // écran Pièces / caisse à jour
    if (w.wantOn[id]) {
      delete w.wantOn[id];
      await webPut(id, true);
      p.array_options = Object.assign({}, p.array_options, { options_en_ligne: '1' });
      if (w.on !== null) w.on += 1;
      toast('Prix enregistré (' + fmt(v) + ') et pièce mise en ligne : ' + p.ref + '.');
    } else if (before > 0) toast('Prix modifié : ' + p.ref + ' · ' + fmt(before) + ' → ' + fmt(v) + (webIsOn(p) ? ' (en ligne)' : '') + '.');
    else toast('Prix enregistré : ' + fmt(v) + '. La pièce peut être mise en ligne.');
  } catch (e) { toast(webErr(e)); }
  delete w.busy[id];
  render();
}

// ---------- sélection et actions groupées ----------
const webSelCount = (w) => Object.keys(w.sel).length;
function webSelect(p, on) { const w = webUi(); if (on) w.sel[p.id] = { ref: p.ref, priced: webPrice(p) > 0 }; else delete w.sel[p.id]; }
// « Tout sélectionner » : tous les résultats de la recherche et du filtre en cours, toutes pages confondues.
async function webSelectAll() {
  const w = webUi(), filter = webFilter(w);
  w.bulk = { label: 'Sélection…', done: 0, total: w.total }; render();
  try {
    for (let page = 0; page < 50; page++) {
      const r = await DOLI.api('products', { query: { limit: 1000, page, properties: 'id,ref,multiprices,price', sqlfilters: filter } });
      if (!Array.isArray(r) || !r.length) break;
      r.forEach((p) => webSelect(p, true));
      if (r.length < 1000) break;
    }
  } catch (e) { toast(e.message); }
  w.bulk = null; render();
}
// Met en ligne / retire la sélection (4 à la fois). Mise en ligne : les pièces sans prix sont ignorées et comptées.
async function webBulk(on, ids) {
  const w = webUi(), list = (ids || Object.keys(w.sel)).filter((id) => !on || !w.sel[id] || w.sel[id].priced);
  const skipped = (ids || Object.keys(w.sel)).length - list.length;
  let done = 0, failed = 0, lastErr = null;
  w.bulk = { label: on ? 'Mise en ligne…' : 'Retrait…', done: 0, total: list.length }; render();
  for (let i = 0; i < list.length; i += 4) {
    await Promise.all(list.slice(i, i + 4).map((id) => webPut(id, on).then(() => { done++; }, (e) => { failed++; lastErr = e; })));
    w.bulk.done = done + failed; render();
  }
  w.bulk = null; w.sel = {};
  toast((on ? done + ' pièce(s) mise(s) en ligne' : done + ' pièce(s) retirée(s) du magasin en ligne') +
    (skipped ? ' · ' + skipped + ' ignorée(s), sans prix' : '') + (failed ? ' · ' + failed + ' en échec (' + webErr(lastErr) + ')' : '') + '.');
  webCounts(); webSearch(w.page);
}
// « Tout retirer » de l'alerte : toutes les pièces en ligne mais indisponibles.
async function webRemoveOut() {
  const w = webUi(), ids = [];
  try {
    for (let page = 0; page < 50; page++) {
      const r = await DOLI.api('products', { query: { limit: 1000, page, properties: 'id', sqlfilters: WEB_OUT } });
      if (!Array.isArray(r) || !r.length) break;
      r.forEach((p) => ids.push(String(p.id)));
      if (r.length < 1000) break;
    }
  } catch (e) { toast(e.message); return; }
  if (ids.length) await webBulk(false, ids);
}

// ---------- affichage ----------
// Stock par entrepôt : « Magasin 5 · Réserve 2 » (noms des entrepôts Dolibarr).
function webStock(p) {
  const by = {};
  WAREHOUSES.forEach((n) => { by[n] = 0; });
  Object.entries(p.stock_warehouse || {}).forEach(([id, v]) => { const n = DOLI.whName[id]; if (n) by[n] = DOLI.num(v && v.real); });
  if (!p.stock_warehouse && WAREHOUSES[0]) by[WAREHOUSES[0]] = DOLI.num(p.stock_reel);
  return WAREHOUSES.map((n) => n + ' ' + by[n]).join(' · ');
}
// Prête pour le magasin en ligne ? Prix (obligatoire), photo (conseillée), stock et en vente.
function webReady(p, t) {
  const stock = DOLI.num(p.stock_reel) > 0 && String(p.status) !== '0';
  const item = (ok, label, hint) => '<li class="' + (ok === null ? 'wait' : ok ? 'ok' : 'ko') + '" title="' + esc(hint) + '">' + (ok === null ? '' : ic(ok ? 'check' : 'warn', 13)) + '<span>' + label + '</span></li>';
  return '<ul class="web-ready" aria-label="Prête pour le magasin en ligne">' +
    item(webPrice(p) > 0, 'Prix', webPrice(p) > 0 ? 'Prix public renseigné' : 'Prix obligatoire pour la mise en ligne') +
    item(t === undefined ? null : !!t, 'Photo', t ? 'Photo présente' : 'Sans photo : conseillée pour le magasin en ligne') +
    item(stock, 'Stock', stock ? 'En stock et en vente' : 'En rupture ou hors vente') + '</ul>';
}
function webTile(w, p, c) {
  const on = webIsOn(p), ef = p.array_options || {}, t = c.thumbs[p.ref], price = webPrice(p), link = '#/catalogue/' + p.id, id = p.id;
  const blocked = !on && !(price > 0), sel = !!w.sel[id], busy = w.busy[id] || !!w.bulk;
  // Prix : un clic sur le prix ouvre la saisie (pièce en ligne ou non) ; sans prix, la saisie est toujours ouverte.
  const editing = !(price > 0) || w.priceEdit[id];
  const priceBlock = !editing
    ? '<button type="button" class="web-price web-price-btn" data-action="webPriceEdit" data-arg="' + id + '" title="Modifier le prix" aria-label="Modifier le prix : ' + esc(fmt(price)) + '"><b class="num">' + fmt(price) + '</b>' + ic('edit', 14, '#4B5060') + '</button>'
    : '<form class="web-pf' + (w.wantOn[id] ? ' want' : '') + '" data-submit="webPrice" data-arg="' + id + '"><label for="web-p-' + id + '">Prix de vente</label><div class="web-pf-row">' +
      '<input class="input num" id="web-p-' + id + '" inputmode="numeric" autocomplete="off" placeholder="DA" value="' + esc(w.price[id] || '') + '" data-input="webPriceIn" data-arg="' + id + '"' + (busy ? ' disabled' : '') + '>' +
      '<button class="btn btn-primary" type="submit"' + (busy ? ' disabled' : '') + '>OK</button>' +
      (price > 0 ? '<button class="btn" type="button" data-action="webPriceCancel" data-arg="' + id + '" aria-label="Annuler"' + (busy ? ' disabled' : '') + '>✕</button>' : '') + '</div></form>';
  return '<article class="card web-tile' + (on ? ' on' : '') + (sel ? ' sel' : '') + '">' +
    '<label class="web-chk" title="Sélectionner"><input type="checkbox" data-change="webSel" data-arg="' + id + '"' + (sel ? ' checked' : '') + (w.bulk ? ' disabled' : '') + ' aria-label="Sélectionner ' + esc(p.ref) + '"></label>' +
    '<a class="web-photo" href="' + link + '" tabindex="-1" aria-hidden="true">' + (t ? '<img alt="" src="' + t + '">' : '<span class="web-nophoto">' + ic('camera', 30, '#A3A7B3') + '<span>Pas de photo</span></span>') + '</a>' +
    '<div class="web-body"><a class="web-name" href="' + link + '">' + esc(p.label) + '</a>' +
      '<div class="mono muted web-ref">' + esc(p.ref) + (ef.options_oem_ref ? ' · ' + esc(ef.options_oem_ref) : '') + '</div>' +
      priceBlock + '<div class="web-stock">' + esc(webStock(p)) + '</div>' + webReady(p, t) + '</div>' +
    '<button class="web-sw' + (blocked ? ' blocked' : '') + '" type="button" role="switch" aria-checked="' + on + '" data-action="webToggle" data-arg="' + id + '"' + (busy ? ' disabled' : '') +
      (blocked ? ' aria-describedby="web-p-' + id + '" title="Ajoutez un prix pour mettre en ligne"' : '') +
      ' aria-label="' + esc((on ? 'Retirer du magasin en ligne : ' : 'Mettre en ligne : ') + p.ref) + '"><span class="web-knob" aria-hidden="true"></span><span class="web-txt">' + (on ? 'En ligne' : blocked ? 'Prix requis' : 'Hors ligne') + '</span></button>' +
  '</article>';
}

function viewEnLigne() {
  const w = webUi();
  if (!w.started) { w.started = true; w.countedAt = Date.now(); setTimeout(() => { webCounts(); webSearch(0); }, 0); }
  // Retour sur la page : compteurs et alerte « en rupture » relus s'ils ont plus de 30 s (des ventes ont pu vider un stock).
  else if (Date.now() - (w.countedAt || 0) > 30000 && !w.bulk) { w.countedAt = Date.now(); setTimeout(webCounts, 0); }
  const pages = Math.max(1, Math.ceil(w.total / WEB_PAGE));
  const pager = pages > 1 ? '<div class="actions" style="justify-content:center;padding:14px">' +
    '<button class="btn" type="button" data-action="webPage" data-arg="' + (w.page - 1) + '"' + (w.page <= 0 ? ' disabled' : '') + '>Précédent</button>' +
    '<span class="muted" style="align-self:center">Page ' + (w.page + 1) + ' / ' + pages + '</span>' +
    '<button class="btn" type="button" data-action="webPage" data-arg="' + (w.page + 1) + '"' + (w.page + 1 >= pages ? ' disabled' : '') + '>Suivant</button></div>' : '';
  const c = catUi(), tiles = w.items.map((p) => webTile(w, p, c)).join('');
  // En tête : le nombre de pièces en ligne, bien visible ; chaque tuile filtre la liste.
  const n = (v) => (w.on === null ? '…' : v.toLocaleString('fr-FR'));
  const stat = (f, cls, label, value, sub) => '<button type="button" class="card kpi web-stat' + cls + (w.f === f ? ' sel' : '') + '" data-action="webStat" data-arg="' + f + '" aria-pressed="' + (w.f === f) + '">' +
    '<span class="l">' + label + '</span><span class="v">' + value + '</span><span class="s">' + sub + '</span></button>';
  const stats = '<div class="web-stats">' +
    stat('on', ' on', 'Pièces en ligne', n(w.on), 'visibles dans le magasin en ligne') +
    stat('off', '', 'Hors ligne', n(Math.max(0, (w.all || 0) - (w.on || 0))), 'en stock, non affichées') +
    stat('', '', 'En stock', n(w.all || 0), 'Magasin + Réserve') + '</div>';
  const outAlert = w.out > 0 ? '<div class="alert a-bad web-out" role="alert">' + ic('warn', 20, '#991B1B') +
    '<div><b>' + w.out + ' pièce(s) en ligne mais en rupture ou hors vente.</b> Les clients les verraient sans pouvoir les acheter.</div>' +
    '<div class="web-out-act"><button class="btn" type="button" data-action="webStat" data-arg="rupture">Voir</button>' +
    '<button class="btn btn-dark" type="button" data-action="webRemoveOut"' + (w.bulk ? ' disabled' : '') + '>Tout retirer du magasin en ligne</button></div></div>' : '';
  const nSel = webSelCount(w);
  const bar = w.bulk ? '<div class="web-bar" role="status"><b>' + esc(w.bulk.label) + '</b><span class="num">' + w.bulk.done + ' / ' + w.bulk.total + '</span></div>'
    : nSel ? '<div class="web-bar" role="region" aria-label="Sélection"><b>' + nSel + ' pièce(s) sélectionnée(s)</b>' +
      '<button class="btn btn-primary" type="button" data-action="webBulkOn">' + ic('check', 18) + 'Mettre en ligne</button>' +
      '<button class="btn" type="button" data-action="webBulkOff">Retirer du magasin en ligne</button>' +
      '<button class="btn web-bar-x" type="button" data-action="webSelNone">Annuler la sélection</button></div>' : '';
  return head('Magasin en ligne', 'Pièces en stock au magasin ou en réserve') + stats + waCard(w) + outAlert +
    '<div class="toolbar"><label class="search" for="web-q">' + ic('search', 20, '#4B5060') + '<span class="sr">Rechercher</span><input id="web-q" type="search" autocomplete="off" placeholder="OEM (avec ou sans espaces), référence, désignation, modèle…" value="' + esc(w.q) + '" data-input="webQ"></label>' +
      '<label class="sr" for="web-f">Affichage</label><select id="web-f" data-change="webF">' + [['', 'Toutes les pièces'], ['on', 'En ligne'], ['off', 'Hors ligne'], ['rupture', 'En ligne mais en rupture']].map((o) => '<option value="' + o[0] + '"' + (w.f === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      (w.total ? '<button class="btn" type="button" data-action="webSelAll"' + (w.bulk ? ' disabled' : '') + '>Tout sélectionner (' + w.total.toLocaleString('fr-FR') + ')</button>' : '') +
      (w.loading ? '<span class="muted">Recherche…</span>' : '<span class="muted">' + w.total.toLocaleString('fr-FR') + ' résultat(s)</span>') + '</div>' +
    (w.err ? '<div class="alert a-bad" role="alert" style="margin-bottom:14px">' + esc(w.err) + '</div>' : '') +
    (tiles ? '<div class="web-grid">' + tiles + '</div>' : '<p class="empty">' + (w.loading ? 'Recherche en cours…' : w.f === 'rupture' ? 'Aucune pièce en ligne en rupture.' : 'Aucune pièce en stock ne correspond.') + '</p>') + pager + bar;
}

// ---------- WhatsApp du magasin en ligne : affiché en tête ; un clic permet de le modifier ----------
// Enregistré dans le profil du magasin (caruno-profil.json dans Dolibarr, partagé par tous les postes), champ whatsapp,
// au format international (213555123456). Modifiable par qui peut modifier le magasin (droit Dolibarr societe:creer).
P.whatsapp = '<path d="M3.5 20.5l1.4-4.2A8.4 8.4 0 1 1 8 19.3z"/><path d="M9.2 8.6c.2 2.9 2.4 5.3 5.4 5.9l1.1-1.3-1.8-1-.9.7c-1-.5-1.9-1.4-2.4-2.4l.7-.9-1-1.8z"/>';
function waCard(w) {
  const num = S.db.shop.whatsapp || '', edit = DOLI.can('societe.creer'), e = w.wa;
  const icon = '<span class="web-wa-ic" aria-hidden="true">' + ic('whatsapp', 26, '#fff') + '</span>';
  if (e && e.edit) {
    return '<form class="card web-wa" data-submit="waSave">' + icon + '<div class="web-wa-main"><label class="l" for="wa-in">Numéro WhatsApp du magasin en ligne</label>' +
      '<div class="web-wa-row"><input class="input" id="wa-in" inputmode="tel" autocomplete="tel" placeholder="0555 12 34 56" value="' + esc(e.value) + '" data-input="waIn"' + (e.busy ? ' disabled' : '') + '>' +
      '<button class="btn btn-primary" type="submit"' + (e.busy ? ' disabled' : '') + '>Enregistrer</button><button class="btn" type="button" data-action="waCancel"' + (e.busy ? ' disabled' : '') + '>Annuler</button></div>' +
      '<span class="hint">Les clients du magasin en ligne vous écriront sur ce numéro. Laissez vide pour le retirer.</span></div></form>';
  }
  const main = '<span class="l">WhatsApp du magasin en ligne</span>' + (num ? '<span class="v num">' + esc(waShow(num)) + '</span>' : '<span class="v none">Aucun numéro</span>');
  return '<div class="card web-wa">' + icon +
    (edit ? '<button type="button" class="web-wa-main web-wa-btn" data-action="waEdit" title="Modifier le numéro WhatsApp">' + main + '</button>' : '<div class="web-wa-main">' + main + '</div>') +
    '<div class="web-wa-act">' + (edit ? '<button class="btn" type="button" data-action="waEdit">' + (num ? 'Modifier' : 'Ajouter un numéro') + '</button>' : '') +
      (num ? '<a class="btn" target="_blank" rel="noopener noreferrer" href="https://wa.me/' + esc(num) + '">Tester</a>' : '') + '</div></div>';
}
async function waSave() {
  const w = webUi(), v = waNorm(w.wa.value);
  if (v && !waOk(v)) { toast('Numéro WhatsApp invalide : tapez par exemple 0555 12 34 56.'); focusNext('wa-in'); render(); return; }
  w.wa.busy = true; render();
  try {
    await profilePatch({ whatsapp: v });
    w.wa = null; S.ui.formKey = '';                  // le formulaire « Mon profil » se recharge avec le nouveau numéro
    toast(v ? 'WhatsApp enregistré : ' + waShow(v) + '.' : 'Numéro WhatsApp retiré.');
  } catch (e) { w.wa.busy = false; toast(e.status === 403 ? 'Dolibarr refuse la modification du magasin.' : 'Non enregistré : ' + e.message); }
  render();
}

Object.assign(A, {
  waEdit: () => { webUi().wa = { edit: true, value: waShow(S.db.shop.whatsapp || ''), busy: false }; focusNext('wa-in'); },
  waCancel: () => { webUi().wa = null; },
  webToggle: (el) => { webToggle(el.dataset.arg); return false; },
  webPage: (el) => { webSearch(Math.max(0, Number(el.dataset.arg) || 0)); return false; },
  webStat: (el) => { webUi().f = el.dataset.arg; webSearch(0); return false; },
  webSelAll: () => { webSelectAll(); return false; },
  webPriceEdit: (el) => { const w = webUi(), id = el.dataset.arg, p = w.items.find((x) => String(x.id) === id); w.priceEdit[id] = true; w.price[id] = p ? String(Math.round(webPrice(p))) : ''; focusNext('web-p-' + id); },
  webPriceCancel: (el) => { const w = webUi(); delete w.priceEdit[el.dataset.arg]; delete w.price[el.dataset.arg]; },
  webSelNone: () => { webUi().sel = {}; },
  webBulkOn: () => { webBulk(true); return false; },
  webBulkOff: () => { webBulk(false); return false; },
  webRemoveOut: () => { webRemoveOut(); return false; },
});
Object.assign(I, {
  webQ: (v) => { const w = webUi(); w.q = v; clearTimeout(webUi.t); webUi.t = setTimeout(() => webSearch(0), 350); },
  webPriceIn: (v, el) => { webUi().price[el.dataset.arg] = v.replace(/\D/g, ''); return false; },
  waIn: (v) => { const w = webUi(); if (w.wa) w.wa.value = v; return false; },
});
Object.assign(C, {
  webF: (v) => { webUi().f = v; webSearch(0); return false; },
  webSel: (v, el) => { const w = webUi(), p = w.items.find((x) => String(x.id) === el.dataset.arg); if (p) webSelect(p, el.checked); },
});
Object.assign(F, { webPrice: (form) => { webSetPrice(form.dataset.arg); }, waSave: () => { waSave(); } });

(function () {
  const css = document.createElement('style');
  css.textContent = `
.web-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:14px}
.web-stat{text-align:left;cursor:pointer;font:inherit;color:inherit;transition:border-color .15s,box-shadow .15s}
[dir="rtl"] .web-stat{text-align:right}
.web-stat:hover{border-color:var(--muted)}
.web-stat.sel{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}
.web-stat .v{font-size:32px;font-weight:700;line-height:1.1}
.web-stat.on{background:var(--ok-bg);border-color:#A7D7B8}
.web-stat.on .v{font-size:44px;color:var(--ok)}
.web-stat.on.sel{border-color:var(--ok);box-shadow:0 0 0 1px var(--ok)}
.web-wa{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;padding:14px 18px;margin-bottom:14px}
.web-wa-ic{display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;background:#1F8F4E;flex:none}
.web-wa-main{display:flex;flex-direction:column;gap:2px;flex:1 1 260px;min-width:0;text-align:left;font:inherit;color:inherit}
[dir="rtl"] .web-wa-main{text-align:right}
.web-wa-btn{border:0;background:none;padding:4px 8px;margin:-4px -8px;border-radius:10px;cursor:pointer}
.web-wa-btn:hover{background:var(--soft)}
.web-wa .l{font-size:14px;color:var(--muted)}
.web-wa .v{font-size:24px;font-weight:700;color:var(--ink)}
.web-wa .v.none{font-size:17px;font-weight:600;color:var(--warn)}
.web-wa-act{display:flex;flex-wrap:wrap;gap:8px}
.web-wa-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
.web-wa-row .input{flex:1 1 200px;min-width:0;font-size:18px}
.web-wa .hint{font-size:12px;color:var(--muted)}
.web-out{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin-bottom:14px}
.web-out>div:first-of-type{flex:1 1 320px}
.web-out-act{display:flex;flex-wrap:wrap;gap:8px}
.web-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;padding-bottom:80px}
.web-tile{position:relative;display:flex;flex-direction:column;overflow:hidden;transition:border-color .15s,box-shadow .15s}
.web-tile.on{border-color:var(--ok);box-shadow:0 0 0 1px var(--ok)}
.web-tile.sel{border-color:#1D4ED8;box-shadow:0 0 0 2px #1D4ED8}
.web-chk{position:absolute;top:8px;left:8px;z-index:1;display:flex;padding:6px;border-radius:8px;background:rgba(255,255,255,.92);box-shadow:0 1px 3px rgba(0,0,0,.15);cursor:pointer}
[dir="rtl"] .web-chk{left:auto;right:8px}
.web-chk input{width:18px;height:18px;margin:0;cursor:pointer;accent-color:#1D4ED8}
.web-photo{display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;background:#fff;border-bottom:1px solid var(--line2);padding:10px;text-decoration:none}
.web-photo img{max-width:100%;max-height:100%;object-fit:contain}
.web-nophoto{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;color:#8A8F9C}
.web-body{display:flex;flex-direction:column;gap:5px;padding:10px 12px 8px;flex:1;min-width:0}
.web-name{font-weight:600;color:var(--ink);text-decoration:none;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.web-name:hover{text-decoration:underline}
.web-ref{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.web-price b{font-size:16px}
.web-price-btn{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;border:1px dashed transparent;background:none;padding:2px 6px;margin:-2px -6px;border-radius:8px;cursor:pointer;font:inherit;color:var(--ink)}
.web-price-btn:hover,.web-price-btn:focus-visible{border-color:var(--line);background:var(--soft)}
.web-pf{display:flex;flex-direction:column;gap:4px}
.web-pf label{font-size:12px;font-weight:600;color:var(--warn)}
.web-pf-row{display:flex;gap:6px}
.web-pf-row .input{flex:1;min-width:0;min-height:36px;padding:6px 10px}
.web-pf-row .btn{min-height:36px;padding:6px 12px}
.web-pf.want .input{border-color:var(--warn);box-shadow:0 0 0 3px var(--warn-bg)}
.web-stock{font-size:12px;color:var(--muted)}
.web-ready{display:flex;flex-wrap:wrap;gap:4px;list-style:none;margin:2px 0 0;padding:0}
.web-ready li{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:600;padding:2px 7px;border-radius:999px}
.web-ready li.ok{background:var(--ok-bg);color:var(--ok)}
.web-ready li.ko{background:var(--warn-bg);color:var(--warn)}
.web-ready li.wait{background:var(--line2);color:var(--muted)}
.web-tile .web-sw{width:100%;justify-content:flex-start;padding:10px 12px;border-top:1px solid var(--line2);border-radius:0}
.web-tile.on .web-sw{background:var(--ok-bg)}
.web-sw{display:inline-flex;align-items:center;gap:10px;border:0;background:none;cursor:pointer;font-size:14px;color:var(--muted)}
.web-sw:disabled{cursor:progress;opacity:.6}
.web-sw.blocked .web-knob{background:#E4E5EA}
.web-sw.blocked .web-txt{color:var(--warn);font-weight:600}
.web-knob{position:relative;width:44px;height:24px;border-radius:999px;background:#C9CBD2;transition:background .15s;flex:none}
.web-knob::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
[dir="rtl"] .web-knob::after{left:auto;right:3px}
.web-sw[aria-checked="true"] .web-knob{background:var(--ok)}
.web-sw[aria-checked="true"] .web-knob::after{transform:translateX(20px)}
[dir="rtl"] .web-sw[aria-checked="true"] .web-knob::after{transform:translateX(-20px)}
.web-sw[aria-checked="true"] .web-txt{color:var(--ok);font-weight:600}
.web-sw:focus-visible{outline:3px solid #1D4ED8;outline-offset:-3px}
.web-bar{position:fixed;left:0;right:0;margin:0 auto;width:max-content;bottom:84px;z-index:40;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;max-width:calc(100% - 32px);padding:10px 14px;border-radius:14px;background:var(--dark);color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.web-bar .btn:not(.btn-primary){background:transparent;color:#fff;border-color:#4B5060}
.web-bar .btn:not(.btn-primary):hover{background:var(--dark2)}
@media (max-width:700px){.web-bar{bottom:140px;left:16px;right:16px;width:auto;max-width:none}}
@media (max-width:520px){.web-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}
@media (prefers-reduced-motion:reduce){.web-knob,.web-knob::after,.web-tile{transition:none}}
`;
  document.head.appendChild(css);
})();
