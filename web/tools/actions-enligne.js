/* =================================================================== MAGASIN EN LIGNE : CHOISIR LES PIÈCES MISES EN LIGNE */
// Les pièces en stock (Magasin ou Réserve) et en vente, en tuiles carrées, avec un interrupteur par pièce :
// en ligne = champ Dolibarr du produit « en_ligne » à 1 ; hors ligne = 0 ou vide (valeur par défaut : rien n'est en ligne).
// Le choix est enregistré dans Dolibarr dès le clic, donc partagé par tous les postes et lu par le futur magasin en ligne.
// Champ créé par caruno-erp provisioning/12-product-extrafields.sh. Réservé au gérant et au responsable (droit produit:creer).
const WEB_PAGE = 24;
P.enligne = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>';
NAV.splice(NAV.findIndex((n) => n.id === 'catalogue') + 1, 0, { id: 'enligne', label: 'Magasin en ligne', roles: ['responsable', 'gerant'] });

function webUi() {
  if (!S.ui.web) S.ui.web = { q: '', f: '', page: 0, items: [], total: 0, on: null, all: null, loading: false, err: '', seq: 0, busy: {}, started: false };
  return S.ui.web;
}
const webIsOn = (p) => String((p.array_options || {}).options_en_ligne || '') === '1';
// Pièces présentes au magasin ou en réserve (stock total > 0 : Magasin et Réserve sont les seuls entrepôts), en vente.
const WEB_BASE = '(t.tosell:=:1) and (t.stock:>:0)';
const WEB_ON = '(ef.en_ligne:=:1)', WEB_OFF = '((ef.en_ligne:=:0) or (ef.en_ligne:is:NULL))';
// Même recherche que le catalogue : OEM sans espaces, référence, désignation, description, noms traduits, modèles de voitures.
function webSearchFilter(q) {
  const s = sqlSafe(q), oem = s.toUpperCase().replace(/[\s.\-]/g, ''), words = s.replace(/\s+/g, '%');
  // La référence est cherchée telle quelle (« BUY-1793… », tirets compris) et sans séparateurs, comme un OEM.
  return s ? "((ef.oem_ref:like:'%" + oem + "%') or (t.ref:like:'%" + s + "%') or (t.ref:like:'%" + oem + "%') or (t.label:like:'%" + words + "%') or (t.description:like:'%" + words + "%')" + searchExtra(s) + ')' : '';
}
async function webTotal(filter) {
  const r = await DOLI.api('products', { query: { limit: 1, pagination_data: 'true', properties: 'id', sqlfilters: filter } });
  return r && r.pagination ? DOLI.num(r.pagination.total) : 0;
}
async function webCounts() {
  const w = webUi();
  try { [w.on, w.all] = await Promise.all([webTotal(WEB_BASE + ' and ' + WEB_ON), webTotal(WEB_BASE)]); } catch (e) { /* les compteurs restent vides */ }
  render();
}
async function webSearch(page) {
  const w = webUi(), seq = ++w.seq;
  const parts = [WEB_BASE, w.f === 'on' ? WEB_ON : w.f === 'off' ? WEB_OFF : '', webSearchFilter(w.q)].filter(Boolean);
  w.loading = true; w.err = ''; render();
  try {
    const r = await DOLI.api('products', { query: { limit: WEB_PAGE, page, sortfield: 't.label', sortorder: 'ASC', pagination_data: 'true', includestockdata: '1',
      properties: 'id,ref,label,stock_reel,stock_warehouse,array_options,multiprices,price', sqlfilters: parts.join(' and ') } });
    if (seq !== w.seq) return;
    w.items = Array.isArray(r) ? r : (r.data || []); w.total = Array.isArray(r) ? r.length : DOLI.num(r.pagination && r.pagination.total); w.page = page;
  } catch (e) { if (seq === w.seq) w.err = e.message; }
  if (seq !== w.seq) return;
  w.loading = false; render();
  // Photos : même cache que le catalogue (photo importée <ref>.jpg), 6 à la fois.
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
    toast((next ? 'En ligne : ' : 'Hors ligne : ') + p.ref + ' · ' + webName(p) + '.');
  } catch (e) {
    p.array_options.options_en_ligne = next ? '0' : '1';
    if (w.on !== null) w.on += next ? -1 : 1;
    toast(e.status === 403 ? 'Dolibarr refuse la modification : droit « créer/modifier les produits » nécessaire.' : 'Non enregistré : ' + e.message);
  }
  delete w.busy[id];
  render();
}
// Nom affiché comme ailleurs (nom anglais du fournisseur traduit en français / arabe).
const webName = (p) => (window.PARTS_I18N && LANG() !== 'en' && PARTS_I18N.translate(p.label, LANG())) || p.label;
// Stock par entrepôt : « Magasin 5 · Réserve 2 » (noms des entrepôts Dolibarr).
function webStock(p) {
  const by = {};
  WAREHOUSES.forEach((n) => { by[n] = 0; });
  Object.entries(p.stock_warehouse || {}).forEach(([id, v]) => { const n = DOLI.whName[id]; if (n) by[n] = DOLI.num(v && v.real); });
  if (!p.stock_warehouse && WAREHOUSES[0]) by[WAREHOUSES[0]] = DOLI.num(p.stock_reel);
  return WAREHOUSES.map((n) => n + ' ' + by[n]).join(' · ');
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
  const tiles = w.items.map((p) => {
    const on = webIsOn(p), ef = p.array_options || {}, t = c.thumbs[p.ref], price = DOLI.num((p.multiprices || {})[1]) || DOLI.num(p.price);
    const link = '#/catalogue/' + p.id;
    return '<article class="card web-tile' + (on ? ' on' : '') + '">' +
      '<a class="web-photo" href="' + link + '" tabindex="-1" aria-hidden="true">' + (t ? '<img alt="" src="' + t + '">' : ic('pieces', 44, '#8A8F9C')) + '</a>' +
      '<div class="web-body"><a class="web-name" href="' + link + '">' + esc(p.label) + '</a>' +
        '<div class="mono muted web-ref">' + esc(p.ref) + (ef.options_oem_ref ? ' · ' + esc(ef.options_oem_ref) : '') + '</div>' +
        '<div class="web-price">' + (price > 0 ? '<b class="num">' + fmt(price) + '</b>' : '<span class="badge b-warn">Sans prix</span>') + '</div>' +
        '<div class="web-stock">' + esc(webStock(p)) + '</div></div>' +
      '<button class="web-sw" type="button" role="switch" aria-checked="' + on + '" data-action="webToggle" data-arg="' + p.id + '"' + (w.busy[p.id] ? ' disabled' : '') +
        ' aria-label="' + esc((on ? 'Retirer du magasin en ligne : ' : 'Mettre en ligne : ') + p.ref) + '"><span class="web-knob" aria-hidden="true"></span><span class="web-txt">' + (on ? 'En ligne' : 'Hors ligne') + '</span></button>' +
    '</article>';
  }).join('');
  const counts = w.on === null ? '' : '<b class="num">' + w.on.toLocaleString('fr-FR') + '</b> pièce(s) en ligne sur ' + (w.all || 0).toLocaleString('fr-FR') + ' en stock (Magasin + Réserve)';
  return head('Magasin en ligne', counts) +
    '<div class="alert a-info" style="margin-bottom:14px">' + ic('info', 20) + '<div>Pièces en stock au magasin ou en réserve. Activez une pièce pour la montrer dans le magasin en ligne ; désactivez-la pour la retirer. Le choix est enregistré dans Dolibarr et vaut pour tous les postes.</div></div>' +
    '<div class="toolbar"><label class="search" for="web-q">' + ic('search', 20, '#4B5060') + '<span class="sr">Rechercher</span><input id="web-q" type="search" autocomplete="off" placeholder="OEM (avec ou sans espaces), référence, désignation, modèle…" value="' + esc(w.q) + '" data-input="webQ"></label>' +
      '<label class="sr" for="web-f">Affichage</label><select id="web-f" data-change="webF">' + [['', 'Toutes les pièces'], ['on', 'En ligne'], ['off', 'Hors ligne']].map((o) => '<option value="' + o[0] + '"' + (w.f === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      (w.loading ? '<span class="muted">Recherche…</span>' : '') + '</div>' +
    (w.err ? '<div class="alert a-bad" role="alert" style="margin-bottom:14px">' + esc(w.err) + '</div>' : '') +
    (tiles ? '<div class="web-grid">' + tiles + '</div>' : '<p class="empty">' + (w.loading ? 'Recherche en cours…' : 'Aucune pièce en stock ne correspond.') + '</p>') + pager;
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
.web-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px}
.web-tile{display:flex;flex-direction:column;overflow:hidden;transition:border-color .15s,box-shadow .15s}
.web-tile.on{border-color:var(--ok);box-shadow:0 0 0 1px var(--ok)}
.web-photo{display:flex;align-items:center;justify-content:center;aspect-ratio:1/1;background:#fff;border-bottom:1px solid var(--line2);padding:10px}
.web-photo img{max-width:100%;max-height:100%;object-fit:contain}
.web-body{display:flex;flex-direction:column;gap:4px;padding:10px 12px 6px;flex:1;min-width:0}
.web-name{font-weight:600;color:var(--ink);text-decoration:none;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.web-name:hover{text-decoration:underline}
.web-ref{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.web-price b{font-size:16px}
.web-stock{font-size:12px;color:var(--muted)}
.web-tile .web-sw{width:100%;justify-content:flex-start;padding:10px 12px;border-top:1px solid var(--line2);border-radius:0}
.web-tile.on .web-sw{background:var(--ok-bg)}
.web-sw{display:inline-flex;align-items:center;gap:10px;border:0;background:none;cursor:pointer;font-size:14px;color:var(--muted)}
.web-sw:disabled{cursor:progress;opacity:.6}
.web-knob{position:relative;width:44px;height:24px;border-radius:999px;background:#C9CBD2;transition:background .15s;flex:none}
.web-knob::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
[dir="rtl"] .web-knob::after{left:auto;right:3px}
.web-sw[aria-checked="true"] .web-knob{background:var(--ok)}
.web-sw[aria-checked="true"] .web-knob::after{transform:translateX(20px)}
[dir="rtl"] .web-sw[aria-checked="true"] .web-knob::after{transform:translateX(-20px)}
.web-sw[aria-checked="true"] .web-txt{color:var(--ok);font-weight:600}
.web-sw:focus-visible{outline:3px solid #1D4ED8;outline-offset:-3px}
@media (max-width:520px){.web-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}
@media (prefers-reduced-motion:reduce){.web-knob,.web-knob::after,.web-tile{transition:none}}
`;
  document.head.appendChild(css);
})();
