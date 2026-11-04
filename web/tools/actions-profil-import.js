/* =================================================================== MON PROFIL : magasin, langue, poste */
viewProfil = function () {
  const u = S.user, s = S.db.shop, edit = DOLI.can('societe.creer');
  setForm('shop', { name: s.name || '', address: s.address || '', phone: s.phone || '', rc: s.rc || '', nif: s.nif || '', ai: s.ai || '', nis: s.nis || '', logo: s.logo || '' });
  const inp = (n, label, mono) => '<div class="field"><label for="sh-' + n + '">' + label + '</label><input class="input' + (mono ? ' mono' : '') + '" id="sh-' + n + '" name="' + n + '" value="' + esc(fv(n)) + '"' + (edit ? '' : ' readonly') + '></div>';
  return head('Mon profil', esc(u.name) + ' · ' + ROLES[u.role] + ' · <span class="mono">' + esc(u.login) + '</span>', '<button class="btn btn-dark" type="button" data-action="logout">' + ic('logout', 18) + 'Se déconnecter</button>') +
    '<div class="grid-auto">' +
      '<form class="card card-pad" data-form="shop" data-submit="saveShop" style="gap:14px"><h2>Mon magasin</h2>' +
        '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span class="thumb" style="width:84px;height:84px;background:#fff">' + (fv('logo') ? '<img alt="Logo du magasin" src="' + esc(fv('logo')) + '" style="object-fit:contain">' : ic('camera', 28, '#8A8F9C')) + '</span>' +
          (edit ? '<div style="display:flex;flex-direction:column;gap:6px"><label class="btn btn-outline" style="position:relative">' + ic('camera', 18) + (fv('logo') ? 'Changer le logo' : 'Ajouter le logo') + '<input type="file" accept="image/*" data-change="shopLogo" style="position:absolute;inset:0;opacity:0;cursor:pointer" aria-label="Logo du magasin"></label>' +
            (fv('logo') ? '<button class="btn" type="button" data-action="shopLogoDel">Retirer le logo</button>' : '') + '</div>' : '') + '</div>' +
        '<div class="form-grid">' + inp('name', 'Nom du magasin (enseigne)') + inp('phone', 'Téléphone') + '</div>' + inp('address', 'Adresse') +
        '<div class="form-grid">' + inp('rc', 'RC', true) + inp('nif', 'NIF', true) + inp('ai', 'Article d’imposition', true) + inp('nis', 'NIS', true) + '</div>' +
        (edit ? '<button class="btn btn-primary" type="submit">Enregistrer le magasin</button><span class="muted" style="font-size:13px">Le nom, l’adresse et le logo apparaissent dans le menu, sur les tickets et les factures, sur tous les postes du magasin.</span>'
          : '<span class="muted" style="font-size:13px">Seul le gérant ou le responsable peut modifier ces informations.</span>') + '</form>' +
      '<section class="card card-pad" style="gap:14px"><h2>Langue et poste</h2>' +
        '<div class="field"><span class="lbl">Langue de l’application</span><div class="chips" role="radiogroup" aria-label="Langue">' + [['fr', 'Français'], ['ar', 'العربية'], ['en', 'English']].map((l) => '<button class="chip" type="button" role="radio" data-action="setLang" data-arg="' + l[0] + '" aria-pressed="' + (LANG() === l[0]) + '" aria-checked="' + (LANG() === l[0]) + '">' + l[1] + '</button>').join('') + '</div></div>' +
        '<form data-submit="saveDevice" style="display:flex;flex-direction:column;gap:10px"><div class="field"><label for="dv-name">Nom de ce poste</label><input class="input" id="dv-name" name="device" value="' + esc(DEVICE) + '"></div><button class="btn" type="submit">Enregistrer le poste</button></form>' +
        '<dl class="kv"><dt>Dolibarr</dt><dd class="mono" style="font-size:13px">' + esc(DOLI.url) + '</dd><dt>Sortie de stock</dt><dd>' + STOCK_MODES[stockMode()] + '</dd><dt>Niveaux de prix</dt><dd>' + LEVELS.join(', ') + '</dd><dt>TVA</dt><dd>' + (VAT() ? '19 %' : 'non assujetti : prix sans TVA') + '</dd><dt>Entrepôts</dt><dd>' + WAREHOUSES.map(esc).join(', ') + '</dd></dl></section>' +
      '<form class="card card-pad" data-submit="changePw"><h2>Changer mon mot de passe</h2><div class="field"><label for="pw-old">Mot de passe actuel</label><input class="input" type="password" id="pw-old" autocomplete="current-password" required></div><div class="field"><label for="pw-new">Nouveau mot de passe</label><input class="input" type="password" id="pw-new" autocomplete="new-password" minlength="8" required><span class="hint">8 caractères minimum</span></div><button class="btn btn-primary" type="submit">Enregistrer</button></form>' +
    '</div>';
};
// Logo réduit (240 px au plus) pour rester léger dans le profil du magasin.
function shrinkLogo(file) {
  return new Promise((ok) => {
    if (!file) return ok('');
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 240 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL('image/png')); }; img.onerror = () => ok(''); img.src = r.result; };
    r.onerror = () => ok('');
    r.readAsDataURL(file);
  });
}
C.shopLogo = async (v, el) => { const url = await shrinkLogo(el.files && el.files[0]); if (url) S.ui.form.logo = url; else toast('Image illisible.'); };
A.shopLogoDel = () => { S.ui.form.logo = ''; };
F.saveShop = () => {
  const f = S.ui.form, p = { name: String(f.name || '').trim(), address: String(f.address || '').trim(), phone: String(f.phone || '').trim(), rc: f.rc || '', nif: f.nif || '', ai: f.ai || '', nis: f.nis || '', logo: f.logo || '' };
  if (!p.name) { toast('Le nom du magasin est obligatoire.'); return; }
  run(async () => { await DOLI.saveProfile(p); S.ui.formKey = ''; toast('Magasin enregistré dans Dolibarr.'); }, 'Enregistrement du magasin…');
};
F.saveDevice = (form, fd) => {
  const n = String(fd.get('device') || '').trim();
  if (!n) return;
  try { localStorage.setItem('caruno-device', n); } catch (e) {}
  location.reload();
};

/* =================================================================== CATALOGUE : pas de marque fournisseur affichée */
const doliRaw = doli;
doli = async function (path, opts) {
  const r = await doliRaw(path, opts);
  const strip = (o) => { if (o && o.array_options) o.array_options.options_brand = DOLI.brand(o.array_options.options_brand); };
  if (Array.isArray(r)) r.forEach(strip); else if (r && Array.isArray(r.data)) r.data.forEach(strip); else strip(r);
  return r;
};

/* =================================================================== IMPORT DE PIÈCES (Excel, CSV ou PDF) */
const IMP_FIELDS = [
  ['ref', 'Référence', true, /^(r[ée]f|reference|code|article|part)/i], ['name', 'Désignation', true, /d[ée]sign|libell|description|nom|label|article/i],
  ['brand', 'Marque', false, /marque|brand|fabricant/i], ['oem', 'Référence OEM', false, /oem|origine/i], ['ean', 'Code-barres', false, /ean|barre|barcode|gtin/i],
  ['fam', 'Famille', false, /famille|cat[ée]gorie/i], ['p0', 'Prix public', false, /public|vente|^prix$|pvp|price|tarif/i], ['p1', 'Prix garage', false, /garage/i],
  ['p2', 'Prix gros', false, /gros|revendeur/i], ['qty', 'Stock initial', false, /stock|qt[ée]|quantit/i], ['loc', 'Emplacement', false, /emplacement|casier|location|rayon/i],
  ['seuil', 'Seuil d’alerte', false, /seuil|alerte/i], ['sprice', 'Prix d’achat', false, /achat|co[uû]t|purchase|cost/i],
];
function loadScript(src) {
  return new Promise((ok, ko) => {
    if (document.querySelector('script[src="' + src + '"]')) return ok();
    const s = document.createElement('script'); s.src = src; s.onload = () => ok(); s.onerror = () => ko(new Error('Lecteur de fichier introuvable (' + src + ').'));
    document.head.appendChild(s);
  });
}
// Fichier → lignes de cellules. PDF : texte rangé en lignes (même hauteur) puis en colonnes (mêmes abscisses).
async function readRows(file) {
  const buf = await file.arrayBuffer();
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
    await loadScript('vendor/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise, all = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const tc = await (await pdf.getPage(i)).getTextContent();
      const items = tc.items.filter((it) => it.str && it.str.trim()).map((it) => ({ x: it.transform[4], y: it.transform[5], w: it.width, s: it.str.trim() }));
      const lines = [];
      items.forEach((it) => { const l = lines.find((x) => Math.abs(x.y - it.y) <= 2.5); if (l) l.items.push(it); else lines.push({ y: it.y, items: [it] }); });
      lines.sort((a, b) => b.y - a.y).forEach((l) => {
        l.items.sort((a, b) => a.x - b.x);
        const cells = []; let last = null;
        l.items.forEach((it) => { if (last && it.x - (last.x + last.w) < 6) cells[cells.length - 1].s += ' ' + it.s; else cells.push({ x: it.x, s: it.s }); last = it; });
        all.push(cells);
      });
    }
    const cols = [];
    all.flat().map((c) => c.x).sort((a, b) => a - b).forEach((x) => { const c = cols.find((k) => Math.abs(k.x - x) < 15); if (c) { c.n++; c.x += (x - c.x) / c.n; } else cols.push({ x, n: 1 }); });
    const keep = cols.filter((c) => c.n >= Math.max(2, all.length * 0.15)).sort((a, b) => a.x - b.x);
    if (!keep.length) return [];
    return all.map((r) => {
      const out = keep.map(() => '');
      r.forEach((c) => { let k = 0, best = Infinity; keep.forEach((col, i) => { const d = Math.abs(col.x - c.x); if (d < best) { best = d; k = i; } }); out[k] = out[k] ? out[k] + ' ' + c.s : c.s; });
      return out;
    }).filter((r) => r.filter(Boolean).length >= 2);
  }
  await loadScript('vendor/xlsx.full.min.js');
  const wb = XLSX.read(buf, { type: 'array' }), ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }).map((r) => r.map((c) => String(c == null ? '' : c).trim())).filter((r) => r.some((c) => c));
}
const impNum = (v) => {
  let t = String(v || '').replace(/[^\d.,-]/g, '');
  if (t.indexOf(',') !== -1 && t.indexOf('.') !== -1) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(',', '.');
  const n = parseFloat(t); return isFinite(n) ? Math.round(n) : 0;
};
function impGuess(m) {
  const head = m.header ? m.rows[0] || [] : [];
  m.map = {};
  IMP_FIELDS.forEach(([k, , , re]) => { const i = head.findIndex((h, j) => re.test(h) && !Object.values(m.map).includes(j) && !(k === 'ref' && /oem|fourn/i.test(h))); if (i !== -1) m.map[k] = i; });
  if (m.map.ref === undefined && !m.header) { m.map.ref = 0; m.map.name = 1; }
}
function impItems(m) {
  const data = m.header ? m.rows.slice(1) : m.rows, get = (r, k) => (m.map[k] === undefined ? '' : String(r[m.map[k]] || '').trim());
  return data.map((r) => ({ ref: get(r, 'ref'), name: get(r, 'name'), brand: get(r, 'brand'), oem: get(r, 'oem'), ean: get(r, 'ean'), fam: get(r, 'fam'), p0: impNum(get(r, 'p0')), p1: impNum(get(r, 'p1')), p2: impNum(get(r, 'p2')), qty: impNum(get(r, 'qty')), loc: get(r, 'loc'), seuil: impNum(get(r, 'seuil')), sprice: impNum(get(r, 'sprice')) }))
    .filter((it) => it.ref && it.name);
}
A.modalImport = () => { S.ui.modal = { kind: 'import', step: 'file', rows: [], header: true, map: {}, existing: 'update', name: '' }; };
C.importFile = (v, el) => {
  const file = el.files && el.files[0], m = S.ui.modal;
  if (!file || !m) return false;
  m.step = 'reading'; m.name = file.name; render();
  readRows(file).then((rows) => {
    if (S.ui.modal !== m) return;
    if (!rows.length) { m.step = 'file'; toast('Aucun tableau trouvé dans ' + file.name + '.'); render(); return; }
    const first = rows[0].filter(Boolean);
    m.rows = rows; m.header = first.filter((c) => /[a-zA-Zéè]/.test(c) && !/\d{3,}/.test(c)).length >= Math.min(2, first.length);
    impGuess(m); m.step = 'map'; render();
  }, (e) => { m.step = 'file'; toast(e.message || 'Fichier illisible.'); render(); });
  return false;
};
C.impHeader = (v, el) => { const m = S.ui.modal; m.header = el.checked; impGuess(m); };
C.impMap = (v, el) => { const m = S.ui.modal; if (v === '') delete m.map[el.dataset.arg]; else m.map[el.dataset.arg] = Number(v); };
A.impExisting = (el) => { S.ui.modal.existing = el.dataset.arg; };
A.impRun = () => {
  const m = S.ui.modal, items = impItems(m);
  if (!items.length) { toast('Associez au moins la référence et la désignation.'); return; }
  Object.assign(m, { step: 'run', total: items.length, done: 0, created: 0, updated: 0, skipped: 0, errors: [] });
  (async () => {
    for (const it of items) {
      try {
        const old = await DOLI.findByRef(it.ref);
        if (old && m.existing === 'skip') m.skipped++;
        else {
          const f = old ? { name: old.name, brand: old.brand, ref: old.ref, oem: old.oem, ean: old.ean, fam: old.fam, type: old.type, locM: old.loc[WAREHOUSES[0]], seuil: old.seuil, souhaite: old.souhaite, floor: old.floor, tva: old.tva }
            : { name: '', brand: '', ref: '', oem: '', ean: '', fam: '', type: '', locM: '', seuil: 0, souhaite: 0, floor: 0, tva: 0 };
          ['name', 'brand', 'oem', 'ean'].forEach((k) => { if (it[k]) f[k] = it[k]; });
          f.ref = it.ref;
          if (it.fam && DOLI.famCat[it.fam]) f.fam = it.fam;
          if (it.loc) f.locM = it.loc;
          if (it.seuil) f.seuil = it.seuil;
          if (it.sprice) f.sprice = it.sprice;
          const prices = it.p0 ? [it.p0, it.p1 || it.p0, it.p2 || it.p1 || it.p0] : old ? old.prices : [0, 0, 0];
          const pid = await DOLI.savePart(old ? old.id : null, f, prices);
          if (!old && it.qty > 0) await DOLI.move(pid, 'Stock initial (import ' + m.name + ')', it.qty, WAREHOUSES[0]);
          if (old) m.updated++; else { m.created++; DOLI.total++; }
        }
      } catch (e) { m.errors.push(it.ref + ' : ' + (e.message || e)); }
      m.done++;
      if (S.ui.modal === m) render();
    }
    m.step = 'done';
    if (S.ui.modal === m) render();
    toast('Import terminé : ' + m.created + ' créée(s), ' + m.updated + ' mise(s) à jour' + (m.errors.length ? ', ' + m.errors.length + ' erreur(s)' : '') + '.');
  })();
};
const closeModalBase = A.closeModal;
A.closeModal = (el, ev) => { if (S.ui.modal && S.ui.modal.kind === 'import' && S.ui.modal.step === 'run') return false; return closeModalBase(el, ev); };
function importModal(m) {
  const close = '<button class="btn" type="button" data-action="closeModal">' + (m.step === 'done' ? 'Fermer' : 'Annuler') + '</button>';
  if (m.step === 'file' || m.step === 'reading') {
    return modal('Importer des pièces',
      (m.step === 'reading' ? '<div class="alert a-info">' + ic('info', 20) + 'Lecture de ' + esc(m.name) + '…</div>' :
      '<label class="photo photo-add" style="width:100%;height:150px;flex-direction:column;gap:8px">' + ic('file', 30) + '<span style="font-size:15px">Choisir un fichier Excel, CSV ou PDF</span><input type="file" id="imp-file" accept=".xlsx,.xls,.ods,.csv,.pdf,application/pdf" data-change="importFile" aria-label="Fichier à importer"></label>') +
      '<span class="muted" style="font-size:14px">Excel ou CSV : une ligne par pièce, la première ligne peut porter les titres des colonnes. PDF : tarif ou catalogue avec un tableau ; les colonnes sont détectées, vous choisissez ensuite laquelle est la référence, la désignation, le prix…</span>',
      close, null, true);
  }
  if (m.step === 'map') {
    const head = m.rows[0] || [], ncol = Math.max.apply(null, m.rows.slice(0, 50).map((r) => r.length)), items = impItems(m);
    const colName = (i) => String.fromCharCode(65 + (i % 26)) + (m.header && head[i] ? ' · ' + head[i] : ' · ex. ' + ((m.rows[m.header ? 1 : 0] || [])[i] || ''));
    const sample = (m.header ? m.rows.slice(1) : m.rows).slice(0, 6);
    const shown = IMP_FIELDS.filter(([k]) => m.map[k] !== undefined);
    return modal('Importer ' + esc(m.name),
      '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-change="impHeader"' + (m.header ? ' checked' : '') + ' style="width:20px;height:20px">La première ligne contient les titres des colonnes</label>' +
      '<div class="form-grid">' + IMP_FIELDS.map(([k, label, req]) => '<div class="field"><label for="imp-' + k + '">' + label + (req ? ' *' : '') + '</label><select id="imp-' + k + '" data-change="impMap" data-arg="' + k + '"><option value="">— ignorer —</option>' +
        Array.from({ length: ncol }, (x, i) => '<option value="' + i + '"' + (m.map[k] === i ? ' selected' : '') + '>' + esc(colName(i).slice(0, 40)) + '</option>').join('') + '</select></div>').join('') + '</div>' +
      '<div class="table-wrap"><table class="t" style="min-width:560px"><thead><tr>' + shown.map(([, label]) => '<th>' + label + '</th>').join('') + '</tr></thead><tbody>' +
        sample.map((r) => '<tr>' + shown.map(([k]) => '<td>' + esc(r[m.map[k]] || '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
      '<div class="field"><span class="lbl">Pièce déjà dans Dolibarr (même référence)</span><div class="chips" role="radiogroup" aria-label="Pièces existantes">' + [['update', 'Mettre à jour'], ['skip', 'Ignorer']].map((o) => '<button class="chip" type="button" role="radio" data-action="impExisting" data-arg="' + o[0] + '" aria-pressed="' + (m.existing === o[0]) + '" aria-checked="' + (m.existing === o[0]) + '">' + o[1] + '</button>').join('') + '</div></div>' +
      '<span class="muted" style="font-size:14px">' + items.length + ' pièce(s) avec une référence et une désignation sur ' + (m.header ? m.rows.length - 1 : m.rows.length) + ' ligne(s). Familles reconnues : ' + esc(FAMILIES.join(', ')) + '.</span>',
      close + '<button class="btn btn-primary" type="button" id="imp-run" data-action="impRun"' + (items.length ? '' : ' disabled') + '>Importer ' + items.length + ' pièce(s)</button>', null, true);
  }
  const pct = m.total ? Math.round(m.done / m.total * 100) : 0;
  return modal(m.step === 'done' ? 'Import terminé' : 'Import en cours…',
    '<div class="meter" role="img" aria-label="Import à ' + pct + ' %"><div style="width:' + pct + '%;background:#15803D"></div></div>' +
    '<dl class="kv num"><dt>Traitées</dt><dd>' + m.done + ' / ' + m.total + '</dd><dt>Créées</dt><dd id="imp-created">' + m.created + '</dd><dt>Mises à jour</dt><dd>' + m.updated + '</dd><dt>Ignorées</dt><dd>' + m.skipped + '</dd><dt>Erreurs</dt><dd style="color:' + (m.errors.length ? 'var(--bad)' : 'inherit') + '">' + m.errors.length + '</dd></dl>' +
    (m.errors.length ? '<div class="alert a-bad" style="flex-direction:column;align-items:flex-start;gap:4px">' + m.errors.slice(0, 15).map((e) => '<span style="font-size:13px">' + esc(e) + '</span>').join('') + '</div>' : '') +
    (m.step === 'run' ? '<span class="muted" style="font-size:14px">Ne fermez pas la page pendant l’import.</span>' : ''),
    m.step === 'done' ? close : '<button class="btn" type="button" disabled>Import en cours…</button>', null, true);
}
const renderModalBase = renderModal;
renderModal = function () { return S.ui.modal && S.ui.modal.kind === 'import' ? importModal(S.ui.modal) : renderModalBase(); };

/* =================================================================== ARABE, ANGLAIS : traduction de l'interface après chaque rendu */
const dict = () => (LANG() === 'ar' ? window.AR : LANG() === 'en' ? window.EN : null);
// Dictionnaires window.AR (i18n-ar.js) et window.EN (i18n-en.js) : texte français exact → arabe ; dans les clés, les nombres sont remplacés par #.
const NUM_RE = /\d+(?:[   .,]\d+)*/g;
function trText(t) {
  const core = t.trim();
  if (!core || !/[A-Za-zÀ-ÿ]/.test(core)) return t;
  const D = dict();
  let out = D[core];
  if (out === undefined) {
    const nums = core.match(NUM_RE) || [], hit = D[core.replace(NUM_RE, '#')];
    if (hit !== undefined) { let i = 0; out = hit.replace(/#/g, () => (nums[i++] || '')); }
    else {
      // Textes composés (dates, mois…) : règles du dictionnaire.
      const rule = ((LANG() === 'ar' ? window.AR_RULES : window.EN_RULES) || []).find((r) => r[0].test(core));
      if (!rule) return t;
      out = core.replace(rule[0], rule[1]);
    }
  }
  return t.replace(core, out);
}
function translateDom(root) {
  if (!root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach((n) => { if (n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName)) return; const v = trText(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; });
  root.querySelectorAll('[placeholder],[aria-label],[title]').forEach((el) => ['placeholder', 'aria-label', 'title'].forEach((a) => { const v = el.getAttribute(a); if (v) { const t = trText(v); if (t !== v) el.setAttribute(a, t); } }));
  document.title = trText(document.title);
}
const renderFr = render;
render = function () {
  renderFr();
  if (dict()) translateDom(document.getElementById('app'));
  // Caisse : la pièce en surbrillance (flèches ↑ ↓) reste visible dans la liste.
  const hi = document.querySelector('.pos-list tr.hi');
  if (hi && hi.scrollIntoView) hi.scrollIntoView({ block: 'nearest' });
};
/* =================================================================== PIÈCES : CORBEILLE */
P.trash = '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>';
const viewPieceBase = viewPiece;
viewPiece = function (id) { return id === 'corbeille' ? viewTrash() : viewPieceBase(id); };
function viewTrash() {
  DOLI.need('trash', () => DOLI.loadTrash());
  const list = S.db.trash || [], loading = DOLI.lazy.trash !== 'done', purge = DOLI.can('produit.supprimer');
  return head('Corbeille', list.length + ' pièce(s) supprimée(s) · elles n’apparaissent plus dans les pièces ni à la caisse, et peuvent être restaurées', '', ['#/pieces', 'Pièces']) +
    '<div class="alert a-info">' + ic('info', 20) + '<div>Une pièce supprimée garde son historique (ventes, mouvements de stock). « Restaurer » la remet dans les pièces et à la caisse.' + (purge ? ' « Supprimer définitivement » l’efface de Dolibarr, seulement si elle ne figure sur aucun document.' : '') + '</div></div>' +
    '<div class="card" style="overflow:hidden"><div class="table-wrap"><table class="t" style="min-width:820px"><thead><tr><th>Pièce</th><th>Réf. / OEM</th><th class="right">Stock</th><th>Supprimée le</th><th></th></tr></thead><tbody>' +
    (list.length ? list.map((p) => '<tr><td><div class="cellpart">' + thumb(p, 40) + '<div><b>' + esc(p.name) + '</b>' + (p.brand ? '<div class="t2">' + esc(p.brand) + '</div>' : '') + '</div></div></td>' +
      '<td><div class="mono">' + esc(p.ref) + '</div>' + (p.oem ? '<div class="mono muted">' + esc(p.oem) + '</div>' : '') + '</td><td class="right num">' + total(p) + '</td>' +
      '<td class="num">' + (p.changed ? DOLI.stamp(p.changed).split(' ').map((x, i) => (i ? x : dateFr(x))).join(' ') : '—') + '</td>' +
      '<td class="right"><div class="actions" style="justify-content:flex-end"><button class="btn btn-primary" type="button" data-action="restorePart" data-arg="' + p.id + '">' + ic('undo', 18) + 'Restaurer</button>' +
        (purge ? '<button class="btn" type="button" data-action="modalPurge" data-arg="' + p.id + '">Supprimer définitivement</button>' : '') + '</div></td></tr>').join('')
      : '<tr><td colspan="5" class="empty">' + (loading ? 'Chargement…' : 'La corbeille est vide.') + '</td></tr>') +
    '</tbody></table></div></div>';
}
// La corbeille est relue dans Dolibarr à chaque ouverture.
window.addEventListener('hashchange', () => { if (location.hash !== '#/pieces/corbeille') DOLI.lazy.trash = ''; });
A.modalTrash = (el) => { S.ui.modal = { kind: 'trash', pid: Number(el.dataset.arg) }; };
A.modalPurge = (el) => { S.ui.modal = { kind: 'purge', pid: Number(el.dataset.arg) }; };
A.trashPart = () => {
  const id = S.ui.modal.pid, p = part(id);
  run(async () => { await DOLI.setTrash(id, true); S.ui.modal = null; toast('Pièce ' + p.ref + ' mise à la corbeille. Elle peut être restaurée depuis Pièces → Corbeille.'); go('#/pieces'); }, 'Mise à la corbeille…');
};
A.restorePart = (el) => {
  const id = Number(el.dataset.arg), p = part(id);
  run(async () => { await DOLI.setTrash(id, false); toast('Pièce ' + (p ? p.ref : '') + ' restaurée.'); }, 'Restauration…');
};
A.purgePart = () => {
  const id = S.ui.modal.pid, p = part(id);
  run(async () => { S.ui.modal = null; await DOLI.purge(id); toast('Pièce ' + (p ? p.ref : '') + ' supprimée définitivement de Dolibarr.'); }, 'Suppression…');
};
function trashModal(m) {
  const p = part(m.pid), cancel = '<button class="btn" type="button" data-action="closeModal">Annuler</button>';
  if (!p) return '';
  const who = '<div style="display:flex;gap:12px;align-items:center">' + thumb(p, 48) + '<div><b>' + esc(p.name) + '</b><div class="mono muted">' + esc((p.brand ? p.brand + ' ' : '') + p.ref) + '</div></div></div>';
  if (m.kind === 'trash') return modal('Supprimer la pièce ?', who + (total(p) ? '<div class="alert a-warn">' + ic('warn', 18, '#9A3412') + 'Il reste ' + total(p) + ' pièce(s) en stock.</div>' : '') +
    '<span class="muted" style="font-size:14px">La pièce va dans la corbeille : elle n’apparaît plus dans les pièces ni à la caisse. Vous pouvez la restaurer à tout moment depuis Pièces → Corbeille.</span>',
    cancel + '<button class="btn btn-primary" type="button" id="trash-ok" data-action="trashPart">' + ic('trash', 18) + 'Mettre à la corbeille</button>');
  return modal('Supprimer définitivement ?', who + '<div class="alert a-bad">' + ic('warn', 18) + 'La pièce sera effacée de Dolibarr. Cette action ne peut pas être annulée.</div>',
    cancel + '<button class="btn btn-dark" type="button" id="purge-ok" data-action="purgePart">Supprimer définitivement</button>');
}
const renderModalTrash = renderModal;
renderModal = function () { return S.ui.modal && (S.ui.modal.kind === 'trash' || S.ui.modal.kind === 'purge') ? trashModal(S.ui.modal) : renderModalTrash(); };

/* =================================================================== CAISSE : VENTE SOUS LE PRIX D'ACHAT */
// Prix de vente de la ligne sous le coût d'achat (PMP connu). Le vendeur est averti sans voir le coût ;
// les rôles qui voient les coûts ont le montant.
// Prix d'achat retenu : le plus élevé du coût moyen (PMP) et du dernier achat (protège quand le fournisseur augmente).
function costRef(p) { return Math.max(p.cost || 0, (p.lastBuy && p.lastBuy.price) || 0); }
function underCost(x) { const c = costRef(x.p); return c > 0 && x.unit < c; }
function costWarn(x) {
  if (!underCost(x)) return '';
  return '<div class="cost-warn" role="alert">' + ic('warn', 16, '#991B1B') + '<span>Prix inférieur au prix d’achat' + (seeCost() ? ' (' + fmt(costRef(x.p)) + ')' : '') + ' : vente à perte</span></div>';
}
// Fiche pièce (rôles qui voient les coûts) : dernier achat et seuil de l'alerte de la caisse.
function lastBuyRows(p) {
  const row = (a, b) => '<div style="display:flex;justify-content:space-between;width:100%;gap:10px"><span>' + a + '</span><b>' + b + '</b></div>';
  const lb = p.lastBuy;
  return row('Dernier achat', lb ? fmt(lb.price) : '—') + (lb ? '<span class="muted" style="font-size:12px;align-self:flex-end">' + esc(lb.from) + ' · ' + dateFr(DOLI.day(lb.date)) + '</span>' : '') +
    (costRef(p) ? row('Alerte caisse sous', fmt(costRef(p))) : '');
}
function costAlert(T) {
  const lines = T.lines.filter(underCost);
  if (!lines.length) return '';
  return '<div class="alert a-bad" role="alert">' + ic('warn', 18) + '<div><b>Vente à perte :</b> ' + lines.map((x) => esc(x.p.brand ? x.p.brand + ' ' + x.p.ref : x.p.ref)).join(', ') + ' sous le prix d’achat. Vérifiez les prix avant de valider.</div></div>';
}

/* =================================================================== IMPRESSION : bon d'achat par défaut */
// Choix du format (bon d'achat, facture A4, ticket 80 mm) pour une facture.
function printFormats(cur, action) {
  return '<div class="chips" role="group" aria-label="Format" style="justify-content:center">' + [['bon', 'Bon d’achat'], ['a4', 'Facture A4'], ['ticket', 'Ticket 80 mm']].map((f) => '<button class="chip" type="button" data-action="' + action + '" data-arg="' + f[0] + '" aria-pressed="' + (cur === f[0]) + '">' + f[1] + '</button>').join('') + '</div>';
}
A.posPrintFmt = (el) => { posUi().pfmt = el.dataset.arg; };
const posNextBase = A.posNext;
A.posNext = (el, ev) => { posUi().pfmt = ''; return posNextBase(el, ev); };
A.modalPrint = (el) => { const [ref, f] = el.dataset.arg.split(':'), d = doc(ref); S.ui.modal = { kind: 'print', ref, format: d && d.type === 'facture' ? 'bon' : (f || 'a4') }; };
// Bon d'achat : enseigne et logo, pièces achetées, total, règlements et rendu ; sans mentions fiscales.
const printDocBase = printDoc;
printDoc = function (d, format) {
  if (format !== 'bon') return printDocBase(d, format);
  const shop = S.db.shop, c = client(d.client) || {}, lines = d.lines || [];
  const row = (a, b, st) => '<div style="display:flex;justify-content:space-between;gap:16px' + (st || '') + '"><span>' + a + '</span><span>' + b + '</span></div>';
  return '<div class="print-area bon">' +
    '<div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start"><div style="display:flex;gap:10px;align-items:center">' +
      (shop.logo ? '<img src="' + esc(shop.logo) + '" alt="" style="height:52px;width:auto;max-width:96px;object-fit:contain">' : '') +
      '<div><b style="font-size:16px">' + esc(shop.name) + '</b>' + (shop.address ? '<br>' + esc(shop.address) : '') + (shop.phone ? '<br>' + esc(shop.phone) : '') + '</div></div>' +
    '<div style="text-align:right"><b style="font-size:18px">BON D’ACHAT</b><br><span class="mono">' + esc(d.ref) + '</span>' + (d.saleRef ? '<br><span class="mono">' + esc(d.saleRef) + '</span>' : '') + '<br>' + dateFr(d.date) + '</div></div>' +
    (c.fixed || !c.name ? '' : '<div>Client : <b>' + esc(c.name) + '</b>' + (c.phone ? ' · ' + esc(c.phone) : '') + '</div>') +
    '<table><thead><tr><th>Désignation</th><th>Référence</th><th class="r">Qté</th><th class="r">Prix</th><th class="r">Total</th></tr></thead><tbody>' +
      (lines.length ? lines.map((l) => { const p = part(l.pid) || {}; return '<tr><td>' + esc(p.name || '') + '</td><td>' + esc((p.brand ? p.brand + ' ' : '') + (p.ref || '')) + '</td><td class="r">' + l.qty + '</td><td class="r">' + fmt(l.price) + '</td><td class="r">' + fmt(l.price * l.qty) + '</td></tr>'; }).join('') : '<tr><td colspan="5">' + esc(d.desc) + '</td></tr>') + '</tbody></table>' +
    '<div style="align-self:flex-end;min-width:min(240px,100%);display:flex;flex-direction:column;gap:2px">' + row('Total', fmt(d.ttc), ';font-weight:700;font-size:15px;border-top:1px solid #000;padding-top:4px') +
      (d.payments || []).map((p) => row(esc(MODES[p.mode] || p.mode), fmt(p.amount))).join('') + (d.change ? row('Rendu monnaie', fmt(d.change)) : '') +
      (d.type === 'facture' && d.paid < d.ttc ? row('Reste dû', fmt(d.ttc - d.paid)) : '') + '</div>' +
    '<div style="text-align:center;margin-top:6px">Merci de votre visite</div></div>';
};

applyLang();

boot();
