/* =================================================================== MAGASIN EN LIGNE : CHOISIR LES PIÈCES MISES EN LIGNE */
// Toutes les pièces en vente (pas celles de la corbeille), avec un interrupteur par pièce :
// en ligne = champ Dolibarr du produit « en_ligne » à 1 ; hors ligne = 0 ou vide (valeur par défaut : rien n'est en ligne).
// Le choix est enregistré dans Dolibarr dès le clic, donc partagé par tous les postes et lu par le futur magasin en ligne.
// Champ créé par caruno-erp provisioning/12-product-extrafields.sh. Réservé au gérant et au responsable (droit produit:creer).
const WEB_PAGE = 30;
P.enligne = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>';
NAV.splice(NAV.findIndex((n) => n.id === 'catalogue') + 1, 0, { id: 'enligne', label: 'Magasin en ligne', roles: ['responsable', 'gerant'] });

function webUi() {
  if (!S.ui.web) S.ui.web = { q: '', f: '', page: 0, items: [], total: 0, on: null, all: null, loading: false, err: '', seq: 0, busy: {}, started: false };
  return S.ui.web;
}
const webIsOn = (p) => String((p.array_options || {}).options_en_ligne || '') === '1';
const WEB_FOR_SALE = '(t.tosell:=:1)';
const WEB_ON = '(ef.en_ligne:=:1)', WEB_OFF = '((ef.en_ligne:=:0) or (ef.en_ligne:is:NULL))';
// Même recherche que le catalogue : OEM sans espaces, référence, désignation, description, noms traduits, modèles de voitures.
function webSearchFilter(q) {
  const s = sqlSafe(q), oem = s.toUpperCase().replace(/[\s.\-]/g, ''), words = s.replace(/\s+/g, '%');
  return s ? "((ef.oem_ref:like:'%" + oem + "%') or (t.ref:like:'%" + oem + "%') or (t.label:like:'%" + words + "%') or (t.description:like:'%" + words + "%')" + searchExtra(s) + ')' : '';
}
async function webTotal(filter) {
  const r = await DOLI.api('products', { query: { limit: 1, pagination_data: 'true', properties: 'id', sqlfilters: filter } });
  return r && r.pagination ? DOLI.num(r.pagination.total) : 0;
}
async function webCounts() {
  const w = webUi();
  try { [w.on, w.all] = await Promise.all([webTotal(WEB_FOR_SALE + ' and ' + WEB_ON), webTotal(WEB_FOR_SALE)]); } catch (e) { /* les compteurs restent vides */ }
  render();
}
async function webSearch(page) {
  const w = webUi(), seq = ++w.seq;
  const parts = [WEB_FOR_SALE, w.f === 'on' ? WEB_ON : w.f === 'off' ? WEB_OFF : '', webSearchFilter(w.q)].filter(Boolean);
  w.loading = true; w.err = ''; render();
  try {
    const r = await DOLI.api('products', { query: { limit: WEB_PAGE, page, sortfield: 't.label', sortorder: 'ASC', pagination_data: 'true', includestockdata: '1',
      properties: 'id,ref,label,stock_reel,array_options,multiprices,price', sqlfilters: parts.join(' and ') } });
    if (seq !== w.seq) return;
    w.items = Array.isArray(r) ? r : (r.data || []); w.total = Array.isArray(r) ? r.length : DOLI.num(r.pagination && r.pagination.total); w.page = page;
  } catch (e) { if (seq === w.seq) w.err = e.message; }
  if (seq !== w.seq) return;
  w.loading = false; render();
  // Vignettes : même cache que le catalogue (photo importée <ref>.jpg), 6 à la fois.
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
// Clic : affiché tout de suite, enregistré dans Dolibarr ; en cas de refus, l'interrupteur revient et un message l'explique.
async function webToggle(id) {
  const w = webUi(), p = w.items.find((x) => String(x.id) === String(id));
  if (!p || w.busy[id]) return;
  const next = !webIsOn(p);
  p.array_options = Object.assign({}, p.array_options, { options_en_ligne: next ? '1' : '0' });
  w.busy[id] = true;
  if (w.on !== null) w.on += next ? 1 : -1;
  render();
  try {
    await DOLI.api('products/' + encodeURIComponent(id), { method: 'PUT', body: { array_options: { options_en_ligne: next ? '1' : '0' } } });
    // Nom affiché comme dans la liste (nom anglais du fournisseur traduit en français / arabe).
    const name = (window.PARTS_I18N && LANG() !== 'en' && PARTS_I18N.translate(p.label, LANG())) || p.label;
    toast((next ? 'En ligne : ' : 'Hors ligne : ') + p.ref + ' · ' + name + '.');
  } catch (e) {
    p.array_options.options_en_ligne = next ? '0' : '1';
    if (w.on !== null) w.on += next ? -1 : 1;
    toast(e.status === 403 ? 'Dolibarr refuse la modification : droit « créer/modifier les produits » nécessaire.' : 'Non enregistré : ' + e.message);
  }
  delete w.busy[id];
  render();
}

function viewEnLigne() {
  const w = webUi();
  if (!w.started) { w.started = true; setTimeout(() => { webCounts(); webSearch(0); }, 0); }
  const pages = Math.max(1, Math.ceil(w.total / WEB_PAGE));
  const pager = pages > 1 ? '<div class="actions" style="justify-content:center;padding:14px">' +
    '<button class="btn" type="button" data-action="webPage" data-arg="' + (w.page - 1) + '"' + (w.page <= 0 ? ' disabled' : '') + '>Précédent</button>' +
    '<span class="muted" style="align-self:center">Page ' + (w.page + 1) + ' / ' + pages + '</span>' +
    '<button class="btn" type="button" data-action="webPage" data-arg="' + (w.page + 1) + '"' + (w.page + 1 >= pages ? ' disabled' : '') + '>Suivant</button></div>' : '';
  const c = catUi();
  const rows = w.items.map((p) => {
    const on = webIsOn(p), ef = p.array_options || {}, t = c.thumbs[p.ref], price = DOLI.num((p.multiprices || {})[1]) || DOLI.num(p.price), brand = DOLI.brand(ef.options_brand);
    return '<tr' + (on ? ' class="web-on"' : '') + '><td><div class="cellpart"><span class="thumb">' + (t ? '<img alt="" src="' + t + '">' : ic('pieces', 22, '#8A8F9C')) + '</span>' +
      '<div><a class="rowlink" href="#/catalogue/' + p.id + '">' + esc(p.label) + '</a>' + (brand ? '<div class="t2">' + esc(brand) + '</div>' : '') + '</div></div></td>' +
      '<td><div class="mono">' + esc(p.ref) + '</div><div class="mono muted">' + esc(ef.options_oem_ref || '') + '</div></td>' +
      '<td class="right num">' + (price > 0 ? fmt(price) : '<span class="badge b-warn">Sans prix</span>') + '</td>' +
      '<td class="right num">' + (Number(p.stock_reel) || 0) + '</td>' +
      '<td><button class="web-sw" type="button" role="switch" aria-checked="' + on + '" data-action="webToggle" data-arg="' + p.id + '"' + (w.busy[p.id] ? ' disabled' : '') +
        ' aria-label="' + esc((on ? 'Retirer du magasin en ligne : ' : 'Mettre en ligne : ') + p.ref) + '"><span class="web-knob" aria-hidden="true"></span><span class="web-txt">' + (on ? 'En ligne' : 'Hors ligne') + '</span></button></td></tr>';
  }).join('');
  const counts = w.on === null ? '' : '<b class="num">' + w.on.toLocaleString('fr-FR') + '</b> pièce(s) en ligne sur ' + (w.all || 0).toLocaleString('fr-FR') + ' en vente';
  return head('Magasin en ligne', counts) +
    '<div class="alert a-info" style="margin-bottom:14px">' + ic('info', 20) + '<div>Activez une pièce pour la montrer dans le magasin en ligne ; désactivez-la pour la retirer. Le choix est enregistré dans Dolibarr et vaut pour tous les postes.</div></div>' +
    '<div class="toolbar"><label class="search" for="web-q">' + ic('search', 20, '#4B5060') + '<span class="sr">Rechercher</span><input id="web-q" type="search" autocomplete="off" placeholder="OEM (avec ou sans espaces), référence, désignation, modèle…" value="' + esc(w.q) + '" data-input="webQ"></label>' +
      '<label class="sr" for="web-f">Affichage</label><select id="web-f" data-change="webF">' + [['', 'Toutes les pièces'], ['on', 'En ligne'], ['off', 'Hors ligne']].map((o) => '<option value="' + o[0] + '"' + (w.f === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      (w.loading ? '<span class="muted">Recherche…</span>' : '') + '</div>' +
    (w.err ? '<div class="alert a-bad" role="alert" style="margin-bottom:14px">' + esc(w.err) + '</div>' : '') +
    '<div class="card" style="overflow:hidden"><div class="table-wrap"><table class="t" style="min-width:820px"><thead><tr><th>Pièce</th><th>Réf. / OEM</th><th class="right">Prix</th><th class="right">Stock</th><th>Magasin en ligne</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5" class="empty">' + (w.loading ? 'Recherche en cours…' : 'Aucune pièce ne correspond.') + '</td></tr>') +
    '</tbody></table></div>' + pager + '</div>';
}

Object.assign(A, {
  webToggle: (el) => { webToggle(el.dataset.arg); return false; },
  webPage: (el) => { webSearch(Math.max(0, Number(el.dataset.arg) || 0)); return false; },
});
Object.assign(I, { webQ: (v) => { const w = webUi(); w.q = v; clearTimeout(webUi.t); webUi.t = setTimeout(() => webSearch(0), 350); } });
Object.assign(C, { webF: (v) => { webUi().f = v; webSearch(0); return false; } });

(function () {
  const css = document.createElement('style');
  css.textContent = `
.web-sw{display:inline-flex;align-items:center;gap:10px;padding:4px 6px 4px 4px;border:0;background:none;cursor:pointer;font-size:14px;color:var(--muted);border-radius:999px}
.web-sw:disabled{cursor:progress;opacity:.6}
.web-knob{position:relative;width:44px;height:24px;border-radius:999px;background:#C9CBD2;transition:background .15s;flex:none}
.web-knob::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
.web-sw[aria-checked="true"] .web-knob{background:var(--ok)}
.web-sw[aria-checked="true"] .web-knob::after{transform:translateX(20px)}
.web-sw[aria-checked="true"] .web-txt{color:var(--ok);font-weight:600}
.web-sw:focus-visible{outline:3px solid #1D4ED8;outline-offset:2px}
tr.web-on td:first-child{box-shadow:inset 3px 0 0 var(--ok)}
@media (prefers-reduced-motion:reduce){.web-knob,.web-knob::after{transition:none}}
`;
  document.head.appendChild(css);
})();
