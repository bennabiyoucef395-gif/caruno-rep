/* =================================================================== CATALOGUE : VÉHICULE DU CLIENT (MARQUE → MODÈLE → MOTEUR) */
// Données : web/data/parts/ (index.json + models/<id>.json), exportées de la base caruno_parts par
// scripts/parts/export.sh du dépôt caruno-erp. Absentes → le catalogue reste la recherche Dolibarr habituelle.
// Pour chaque pièce et chaque moteur proposé, un statut calculé par la base :
//   compatible ; a_confirmer (connue pour le modèle, moteur non précisé par la source…) ;
//   moteur_requis (la bonne pièce dépend du moteur, inconnu) : jamais affichée comme compatible, on demande le moteur.
// Une pièce sans statut pour le moteur choisi n'est pas compatible. Prix, stock, photo : lus dans Dolibarr par référence.
const VEH_DIR = 'data/parts/';
const VEH_MAKERS = { VW: 'Volkswagen', AUDI: 'Audi', 'MERCEDES-BENZ': 'Mercedes-Benz', BMW: 'BMW', MINI: 'Mini', SKODA: 'Skoda', SEAT: 'Seat',
  PORSCHE: 'Porsche', 'LAND ROVER': 'Land Rover', TOYOTA: 'Toyota', LEXUS: 'Lexus', HYUNDAI: 'Hyundai', KIA: 'Kia' };
const VEH_RANK = { compatible: 0, a_confirmer: 1 };
const VEH_CONF = { confirmed: 'confirmée', probable: 'probable', unverified: 'non vérifiée' };

function vehUi() {
  if (!S.ui.veh) S.ui.veh = { idx: null, maker: '', model: '', vt: 'unknown', fam: '', q: '', page: 0, files: {}, rows: {}, seq: 0 };
  return S.ui.veh;
}
const vehMaker = (k) => VEH_MAKERS[k] || k;
const vehYears = (m) => (m.year_from ? ' ' + m.year_from + '–' + (m.year_to || '') : '');
const vehModelLabel = (m) => m.name + (m.generation ? ' (' + m.generation + ')' : '') + vehYears(m);
const vehModel = (v) => (v.idx && v.idx.models ? v.idx.models.find((m) => String(m.id) === String(v.model)) : null);
const vehCat = (v, id) => v.idx.catById[id] || { name: '', group: '', engine_dependent: true };

async function vehLoadIndex() {
  const v = vehUi();
  v.idx = 'loading';
  try {
    const r = await fetch(VEH_DIR + 'index.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    const idx = await r.json();
    idx.catById = {};
    idx.categories.forEach((c) => { idx.catById[c.id] = c; });
    idx.models = idx.models.filter((m) => m.parts > 0);
    v.idx = idx;
  } catch (e) { v.idx = 'none'; }  // pas de données véhicules sur ce poste : catalogue habituel
  render();
}
async function vehLoadModel(id) {
  const v = vehUi(), m = v.idx.models.find((x) => String(x.id) === String(id));
  if (!m || v.files[id]) return;
  v.files[id] = 'loading';
  try {
    const r = await fetch(VEH_DIR + m.file, { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    v.files[id] = await r.json();
  } catch (e) { v.files[id] = 'error'; }
  render();
}

// Pièces du véhicule pour le moteur choisi, filtrées (famille, texte) et triées : compatibles d'abord.
function vehList(v, file) {
  const key = v.vt, n = norm(v.q || ''), f = v.fam;
  const inFam = (p) => { const c = vehCat(v, p.category_id); return !f || (f[0] === 'g' ? c.group === f.slice(2) : String(p.category_id) === f.slice(2)); };
  const all = file.parts.filter((p) => p.status[key] && inFam(p) && (!n || norm([p.name, p.ref, p.oem, vehCat(v, p.category_id).name].join(' ')).indexOf(n) !== -1));
  const list = all.filter((p) => p.status[key] !== 'moteur_requis');
  list.sort((a, b) => (VEH_RANK[a.status[key]] - VEH_RANK[b.status[key]]) || (vehCat(v, a.category_id).group.localeCompare(vehCat(v, b.category_id).group))
    || vehCat(v, a.category_id).name.localeCompare(vehCat(v, b.category_id).name) || a.name.localeCompare(b.name));
  return { list, needEngine: all.length - list.length };
}

// Pièces de la page affichée lues dans Dolibarr en un appel (référence = n° TiBAO), gardées pour la session.
async function vehLoadRows(refs) {
  const v = vehUi(), c = catUi(), todo = refs.filter((r) => !(r in v.rows));
  if (!todo.length) return;
  const seq = ++v.seq;
  todo.forEach((r) => { v.rows[r] = null; });
  try {
    const params = new URLSearchParams({ limit: 100, includestockdata: '1', properties: 'id,ref,label,description,stock_reel,array_options',
      sqlfilters: '(t.ref:in:' + todo.map((r) => "'" + sqlSafe(r) + "'").join(',') + ')' });
    const r = await doli('products?' + params.toString());
    (r || []).forEach((p) => { v.rows[p.ref] = p; });
    todo.forEach((ref) => { if (!v.rows[ref]) v.rows[ref] = false; });  // absente de Dolibarr
  } catch (e) { todo.forEach((ref) => { delete v.rows[ref]; }); c.err = e.message; }
  render();
  // Vignettes : même cache et même méthode que le catalogue (photo importée <ref>.jpg, 6 à la fois).
  const thumbs = todo.filter((x) => v.rows[x] && !(x in c.thumbs));
  for (let i = 0; i < thumbs.length && seq === v.seq; i += 6) {
    await Promise.all(thumbs.slice(i, i + 6).map(async (ref) => {
      try {
        const d = await doli('documents/download?' + new URLSearchParams({ modulepart: 'product', original_file: ref + '/thumbs/' + ref + '_small.jpg' }).toString());
        c.thumbs[ref] = d && d.content ? 'data:' + d['content-type'] + ';base64,' + d.content : '';
      } catch (e) { c.thumbs[ref] = ''; }
    }));
    render();
  }
}

// Pourquoi « à confirmer » : la source ne précise pas le moteur, ou l'indique pour un autre moteur.
function vehReason(p) {
  const ev = String(p.evidence || '').split(' | ').filter(Boolean).map((x) => x.split(' · '));
  const engines = [...new Set(ev.map((x) => x[0]).filter((e) => e && e !== 'modèle'))];
  const conf = [...new Set(ev.map((x) => VEH_CONF[x[1]] || x[1]).filter(Boolean))].join(', ');
  return (engines.length ? 'Indiquée pour ' + engines.join(', ') : 'Moteur non précisé par la source') + ' · catalogue fournisseur, fiabilité ' + conf;
}
function vehBadge(p, key) {
  const s = p.status[key];
  if (s === 'compatible') return '<span class="badge b-ok">Compatible</span>';
  return '<span class="badge b-warn">À confirmer</span><div class="t2" style="font-size:12px;max-width:260px" title="' + esc(p.evidence || '') + '">' + esc(vehReason(p)) + '</div>';
}

function vehBar(v) {
  const makers = [...new Set(v.idx.models.map((m) => m.maker))].sort((a, b) => vehMaker(a).localeCompare(vehMaker(b)));
  const models = v.idx.models.filter((m) => m.maker === v.maker).sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }) || (a.year_from || 0) - (b.year_from || 0));
  const file = v.model ? v.files[v.model] : null, ready = file && typeof file === 'object';
  const opt = (val, label, cur) => '<option value="' + esc(val) + '"' + (String(val) === String(cur) ? ' selected' : '') + '>' + esc(label) + '</option>';
  let fam = '';
  if (ready) {
    const groups = {};
    file.parts.forEach((p) => { const c = vehCat(v, p.category_id); (groups[c.group] = groups[c.group] || {})[p.category_id] = c.name; });
    fam = '<div class="field" style="max-width:320px"><label for="veh-fam">Famille</label><select id="veh-fam" data-change="vehFam" style="width:100%">' + opt('', 'Toutes les familles', v.fam) +
      Object.keys(groups).sort().map((g) => '<optgroup label="' + esc(g) + '">' + opt('g:' + g, 'Toute la famille ' + g, v.fam) +
        Object.keys(groups[g]).sort((a, b) => groups[g][a].localeCompare(groups[g][b])).map((id) => opt('c:' + id, groups[g][id], v.fam)).join('') + '</optgroup>').join('') + '</select></div>';
  }
  return '<section class="card card-pad" aria-label="Véhicule du client" style="margin-bottom:14px"><div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end">' +
    '<div class="field"><label for="veh-maker">Marque</label><select id="veh-maker" data-change="vehMaker">' + opt('', '— Choisir —', v.maker) + makers.map((k) => opt(k, vehMaker(k), v.maker)).join('') + '</select></div>' +
    '<div class="field"><label for="veh-model">Modèle</label><select id="veh-model" data-change="vehModel"' + (v.maker ? '' : ' disabled') + '>' + opt('', '— Choisir —', v.model) + models.map((m) => opt(m.id, vehModelLabel(m), v.model)).join('') + '</select></div>' +
    (ready ? '<div class="field"><label for="veh-engine">Moteur</label><select id="veh-engine" data-change="vehEngine">' +
      file.engines.map((o) => opt(o.vehicle_type_id === null ? 'unknown' : o.vehicle_type_id, o.label, v.vt)).join('') + '</select></div>' + fam : '') +
    (v.maker ? '<button class="btn" type="button" data-action="vehClear">Effacer le véhicule</button>' : '') +
    '</div>' + (v.model ? '' : '<span class="muted" style="font-size:13px;display:block;margin-top:8px">Choisissez le véhicule du client pour voir les pièces compatibles, ou cherchez directement une pièce.</span>') + '</section>';
}

function viewVehicle(v) {
  const c = catUi(), m = vehModel(v), file = v.files[v.model];
  if (!file || file === 'loading') { if (!file) setTimeout(() => vehLoadModel(v.model), 0); return head('Catalogue', 'Chargement du véhicule…') + vehBar(v); }
  if (file === 'error') return head('Catalogue', '') + vehBar(v) + '<div class="alert a-bad" role="alert">Données du véhicule illisibles. Réexportez le catalogue des véhicules.</div>';
  const key = v.vt, { list, needEngine } = vehList(v, file);
  const pages = Math.max(1, Math.ceil(list.length / CAT_PAGE)), page = Math.min(v.page, pages - 1), shown = list.slice(page * CAT_PAGE, (page + 1) * CAT_PAGE);
  const todo = shown.map((p) => p.ref).filter((r) => !(r in v.rows));
  if (todo.length) setTimeout(() => vehLoadRows(todo), 0);
  const engine = file.engines.find((o) => String(o.vehicle_type_id === null ? 'unknown' : o.vehicle_type_id) === String(key));
  const pager = pages > 1 ? '<div class="actions" style="justify-content:center;padding:14px">' +
    '<button class="btn" type="button" data-action="vehPage" data-arg="' + (page - 1) + '"' + (page <= 0 ? ' disabled' : '') + '>Précédent</button>' +
    '<span class="muted" style="align-self:center">Page ' + (page + 1) + ' / ' + pages + '</span>' +
    '<button class="btn" type="button" data-action="vehPage" data-arg="' + (page + 1) + '"' + (page + 1 >= pages ? ' disabled' : '') + '>Suivant</button></div>' : '';
  const rows = shown.map((p) => {
    const d = v.rows[p.ref], cat = vehCat(v, p.category_id), t = c.thumbs[p.ref], ef = (d && d.array_options) || {};
    const link = d ? '#/catalogue/' + d.id : '';
    return '<tr' + (d ? ' class="click" data-action="go" data-arg="' + link + '"' : '') + '><td><div class="cellpart"><span class="thumb">' + (t ? '<img alt="" src="' + t + '">' : ic('pieces', 22, '#8A8F9C')) + '</span>' +
      '<div>' + (d ? '<a class="rowlink" href="' + link + '">' + esc(d.label) + '</a>' : '<b>' + esc(p.name) + '</b>') +
      '<div class="t2">' + (d === false ? 'Absente de Dolibarr' : d ? esc(ef.options_brand || '') : 'Chargement…') + '</div></div></div></td>' +
      '<td><div class="mono">' + esc(p.ref) + '</div><div class="mono muted">' + esc(p.oem || '') + '</div></td>' +
      '<td style="font-size:13px">' + esc(cat.name) + '<div class="t2">' + esc(cat.group) + '</div></td>' +
      '<td>' + vehBadge(p, key) + '</td>' +
      '<td class="right num">' + (d ? (Number(d.stock_reel) || 0) : '—') + '</td></tr>';
  }).join('');
  return head('Catalogue', '<span class="badge b-ok">Dolibarr</span> ' + list.length.toLocaleString('fr-FR') + ' pièce(s) pour ' + esc(vehMaker(m.maker) + ' ' + vehModelLabel(m)) + ' · ' + esc(engine ? engine.label : '')) +
    vehBar(v) +
    '<div class="toolbar"><label class="search" for="veh-q">' + ic('search', 20, '#4B5060') + '<span class="sr">Rechercher dans les pièces du véhicule</span><input id="veh-q" type="search" autocomplete="off" placeholder="Désignation, référence, OEM, famille…" value="' + esc(v.q) + '" data-input="vehQ"></label></div>' +
    (c.err ? '<div class="alert a-bad" role="alert" style="margin-bottom:14px">' + esc(c.err) + '</div>' : '') +
    (needEngine ? '<div class="alert a-warn" role="status" style="margin-bottom:14px">' + ic('warn', 18, '#9A3412') + needEngine + ' pièce(s) de ce véhicule dépendent du moteur (filtres, distribution, injection…) : choisissez le moteur pour les voir.</div>' : '') +
    '<div class="card" style="overflow:hidden"><div class="table-wrap"><table class="t" style="min-width:860px"><thead><tr><th>Pièce</th><th>Réf. / OEM</th><th>Famille</th><th>Compatibilité</th><th class="right">Stock</th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="5" class="empty">' + (needEngine ? 'Choisissez le moteur pour voir les pièces.' : 'Aucune pièce compatible connue pour ce choix.') + '</td></tr>') +
    '</tbody></table></div>' + pager + '</div>';
}

const viewCatalogueBase = viewCatalogue;
viewCatalogue = function () {
  const c = catUi(), v = vehUi();
  if (!c.token) return viewCatalogueBase();
  if (v.idx === null) setTimeout(vehLoadIndex, 0);
  if (!v.idx || typeof v.idx !== 'object') return viewCatalogueBase();            // pas (encore) de données véhicules
  if (v.model) return viewVehicle(v);
  const html = viewCatalogueBase(), at = html.indexOf('<div class="toolbar">');
  return at < 0 ? html : html.slice(0, at) + vehBar(v) + html.slice(at);
};

const vehReset = (v) => { v.vt = 'unknown'; v.fam = ''; v.q = ''; v.page = 0; };
Object.assign(C, {
  vehMaker: (val) => { const v = vehUi(); v.maker = val; v.model = ''; vehReset(v); },
  vehModel: (val) => { const v = vehUi(); v.model = val; vehReset(v); },
  vehEngine: (val) => { const v = vehUi(); v.vt = val; v.page = 0; },
  vehFam: (val) => { const v = vehUi(); v.fam = val; v.page = 0; },
});
Object.assign(I, { vehQ: (val) => { const v = vehUi(); v.q = val; v.page = 0; } });
Object.assign(A, {
  vehPage: (el) => { vehUi().page = Math.max(0, Number(el.dataset.arg) || 0); },
  vehClear: () => { const v = vehUi(); v.maker = ''; v.model = ''; vehReset(v); },
});
