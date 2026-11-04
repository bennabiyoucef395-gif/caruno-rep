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
  translateParts(document.getElementById('app'));
  if (dict()) translateDom(document.getElementById('app'));
  // Caisse : la pièce en surbrillance (flèches ↑ ↓) reste visible dans la liste.
  const hi = document.querySelector('.pos-list tr.hi');
  if (hi && hi.scrollIntoView) hi.scrollIntoView({ block: 'nearest' });
};
/* =================================================================== CATALOGUE : NOMS TRADUITS, MODÈLES DE VOITURES */
// Codes « Modèles » du fournisseur → noms de modèles (VW Golf 5, BMW Série 3 (E90)…), dans la langue choisie.
const catInfoRaw = catInfo;
catInfo = function (desc) {
  const info = catInfoRaw(desc);
  if (info['Modèles'] && window.CAR_MODELS) info['Modèles'] = CAR_MODELS.text(info['Modèles'], LANG());
  return info;
};
// Recherche : un nom français ou arabe (« amortisseur », « ممتص ») ou un modèle (« golf 5 ») trouve aussi
// les pièces dont le nom anglais ou le code modèle correspond.
function searchExtra(q) {
  const out = [];
  if (window.PARTS_I18N && LANG() !== 'en') {
    const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const nq = n(q).trim(), H = PARTS_I18N.heads, i = LANG() === 'ar' ? 2 : 0;
    // Le nom anglais doit finir par la pièce (« Front Shock Absorber », « … Shock Absorber R »), pas seulement la citer.
    if (nq.length >= 3) Object.keys(H).filter((k) => !/[(),，]/.test(k) && n(H[k][i]).indexOf(nq) !== -1).sort((a, b) => a.length - b.length).slice(0, 6)
      .forEach((k) => { const s = DOLI.safe(k); out.push("(t.label:like:'%" + s + "')", "(t.label:like:'%" + s + " %')"); });
  }
  if (window.CAR_MODELS) CAR_MODELS.codesFor(q).slice(0, 12).forEach((c) => out.push("(t.description:like:'%" + DOLI.safe(c) + "%')"));
  return out.length ? ' or ' + out.join(' or ') : '';
}
// Recherche locale : nom traduit et modèles de voitures de la pièce, en plus de ses champs.
function partAlt(p) {
  const t = window.PARTS_I18N ? [PARTS_I18N.translate(p.name, 'fr'), PARTS_I18N.translate(p.name, 'ar')].filter(Boolean).join(' ') : '';
  return t + (p.models ? ' ' + p.models + (window.CAR_MODELS ? ' ' + CAR_MODELS.text(p.models, 'fr') : '') : '');
}
// Noms des pièces (anglais du fournisseur) affichés en français ou en arabe ; en anglais, le nom d'origine.
function translateParts(root) {
  if (!root || !window.PARTS_I18N || LANG() === 'en') return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach((n) => {
    const p = n.parentNode;
    if (!p || /^(SCRIPT|STYLE|TEXTAREA|OPTION)$/.test(p.nodeName)) return;
    const core = n.nodeValue.trim();
    if (core.length < 3 || !/[A-Za-z]/.test(core) || /[à-ÿ؀-ۿ]/i.test(core)) return;
    const t = PARTS_I18N.translate(core, LANG());
    if (t && t !== core) n.nodeValue = n.nodeValue.replace(core, t);
  });
}

/* =================================================================== CLIENT : FACTURES, OPÉRATIONS ET IMPRESSION */
// Sur la fiche client, même période « du … au … » pour deux onglets :
// - Factures et bons d'achat : toutes ses factures et avoirs (lus dans Dolibarr), cases à cocher, impression de la sélection
//   en bons d'achat, factures A4, tickets ou relevé de compte ;
// - Toutes les opérations : factures, versements, avoirs et remboursements, avec le solde après chaque opération.
function cdUi(cid) { if (!S.ui.cd || S.ui.cd.cid !== cid) S.ui.cd = { cid, tab: 'docs', from: '', to: '', unpaid: false, off: {}, kind: '' }; return S.ui.cd; }
function clientDocs(cid) {
  return S.db.docs.filter((d) => d.client === cid && (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon')
    .sort((a, b) => (a.date === b.date ? (a.ref < b.ref ? 1 : -1) : a.date < b.date ? 1 : -1));
}
const cdIn = (u, d) => (!u.from || d.date >= u.from) && (!u.to || d.date <= u.to) && (!u.unpaid || (d.type === 'facture' && d.status !== 'payee'));
const cdSel = (cid) => { const u = cdUi(cid); return clientDocs(cid).filter((d) => cdIn(u, d) && !u.off[d.ref]); };
const cdSign = (d) => (d.type === 'avoir' ? -1 : 1);
const cdRest = (d) => (d.type === 'facture' ? Math.max(0, d.ttc - (d.paid || 0)) : 0);
function clientDocsSection(cid) {
  DOLI.need('cdocs:' + cid, () => DOLI.loadClientInvoices(cid));
  const u = cdUi(cid), ops = u.tab === 'ops';
  const month = TODAY.slice(0, 8) + '01', year = TODAY.slice(0, 4) + '-01-01';
  const cur = u.unpaid && !ops ? 'unpaid' : !u.from && !u.to ? 'all' : u.from === month && !u.to ? 'month' : u.from === year && !u.to ? 'year' : '';
  const quick = [['all', 'Tout'], ['month', 'Ce mois'], ['year', 'Cette année']].concat(ops ? [] : [['unpaid', 'Impayées']]);
  const sel = ops ? [] : cdSel(cid), ready = DOLI.lazy['cdocs:' + cid] === 'done' && !u.loading;
  const btn = ops
    ? '<button class="btn btn-primary" type="button" id="cd-ledger" data-action="cdLedgerPrint" data-arg="' + esc(cid) + '"' + (ready ? '' : ' disabled') + '>' + ic('print', 18) + 'Imprimer le relevé</button>'
    : '<button class="btn btn-primary" type="button" id="cd-print" data-action="cdPrint" data-arg="' + esc(cid) + '"' + (sel.length ? '' : ' disabled') + '>' + ic('print', 18) + 'Imprimer la sélection (' + sel.length + ')</button>';
  return '<section class="card" style="overflow:hidden" id="client-docs"><div style="padding:0 12px">' + tabs([['docs', 'Factures et bons d’achat'], ['ops', 'Toutes les opérations']], u.tab, 'cdTab') + '</div>' +
    '<div class="card-head" style="flex-wrap:wrap;gap:10px;align-items:flex-end"><div class="actions" style="align-items:flex-end;flex-wrap:wrap">' +
      '<div class="chips" role="group" aria-label="Période">' + quick.map((q) => '<button class="chip" type="button" data-action="cdQuick" data-arg="' + q[0] + '" aria-pressed="' + (cur === q[0]) + '">' + q[1] + '</button>').join('') + '</div>' +
      '<div class="field"><label for="cd-from">Du</label><input class="input" type="date" id="cd-from" value="' + esc(u.from) + '" data-change="cdFrom"></div>' +
      '<div class="field"><label for="cd-to">Au</label><input class="input" type="date" id="cd-to" value="' + esc(u.to) + '" data-change="cdTo"></div>' + btn +
    '</div></div>' + (ops ? cdOpsBody(cid) : cdDocsBody(cid, sel)) + '</section>';
}
function cdDocsBody(cid, sel) {
  const u = cdUi(cid), shown = clientDocs(cid).filter((d) => cdIn(u, d));
  const tot = sel.reduce((t, d) => t + cdSign(d) * d.ttc, 0), paid = sel.reduce((t, d) => t + (d.type === 'facture' ? d.paid || 0 : 0), 0), rest = sel.reduce((t, d) => t + cdRest(d), 0);
  return '<div class="table-wrap"><table class="t" style="min-width:760px"><thead><tr><th><input type="checkbox" id="cd-all" aria-label="Tout cocher" data-change="cdAll"' + (shown.length && !shown.some((d) => u.off[d.ref]) ? ' checked' : '') + ' style="width:20px;height:20px"></th><th>Référence</th><th>Date</th><th>Statut</th><th class="right">Montant</th><th class="right">Payé</th><th class="right">Reste dû</th></tr></thead><tbody>' +
    (shown.length ? shown.map((d) => '<tr><td><input type="checkbox" data-change="cdPick" data-arg="' + esc(d.ref) + '"' + (u.off[d.ref] ? '' : ' checked') + ' aria-label="Choisir ' + esc(d.ref) + '" style="width:20px;height:20px"></td>' +
      '<td><a class="mono" href="#/ventes/' + esc(d.ref) + '">' + esc(d.ref) + '</a>' + (d.saleRef ? '<div class="muted mono" style="font-size:12px">' + esc(d.saleRef) + '</div>' : '') + '</td><td class="num">' + dateFr(d.date) + '</td><td>' + statusBadge(d.type, d) + '</td>' +
      '<td class="right num">' + (d.type === 'avoir' ? '−' : '') + fmt(d.ttc) + '</td><td class="right num">' + (d.type === 'facture' ? fmt(d.paid || 0) : '—') + '</td><td class="right num"><b>' + (d.type === 'facture' ? fmt(cdRest(d)) : '—') + '</b></td></tr>').join('')
      : '<tr><td colspan="7" class="empty">' + (DOLI.lazy['cdocs:' + cid] !== 'done' ? 'Chargement…' : 'Aucune facture sur cette période.') + '</td></tr>') +
    '</tbody></table></div>' +
    '<div class="num" style="display:flex;justify-content:flex-end;gap:24px;padding:12px 18px;flex-wrap:wrap;border-top:1px solid var(--line2)"><span class="muted">Sélection : ' + sel.length + ' document(s)</span><span>Total <b id="cd-total">' + fmt(tot) + '</b></span><span>Payé <b>' + fmt(paid) + '</b></span><span>Reste dû <b style="color:' + (rest ? 'var(--bad)' : 'inherit') + '">' + fmt(rest) + '</b></span></div>';
}

// Opérations du compte client : chaque facture (débit), chaque versement (un règlement Dolibarr, qui peut couvrir
// plusieurs factures), chaque avoir (crédit) et chaque remboursement d'avoir (débit). Solde > 0 : le client doit.
// Dans une même journée, ordre de l'heure de saisie. Les avoirs imputés sur une facture ne sont comptés qu'une fois (ligne Avoir).
const cdNeedPay = (d) => (d.type === 'facture' ? d.payments === null : d.status === 'rembourse' && !d.payLoaded);
function clientOps(cid) {
  const ops = [], pays = {};
  clientDocs(cid).forEach((d) => {
    ops.push({ date: d.date, at: d.at || '', kind: d.type, ref: d.ref, doc: d, refs: [d.ref], debit: d.type === 'facture' ? d.ttc : 0, credit: d.type === 'avoir' ? d.ttc : 0 });
    (d.payments || []).filter((p) => !p.line || p.line === 'payment').forEach((p) => {
      const back = p.amount < 0, k = (p.ref || d.ref + '/' + p.date) + (back ? '-' : '+');
      const o = pays[k] || (pays[k] = { date: p.date || d.date, at: p.at || '', kind: back ? 'rembourse' : 'versement', ref: p.ref || '', mode: p.mode, num: p.label, refs: [], debit: 0, credit: 0 });
      if (back) o.debit -= p.amount; else o.credit += p.amount;
      o.refs.push(d.ref);
    });
  });
  const rank = { facture: 0, avoir: 1, versement: 2, rembourse: 3 };
  const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
  return ops.concat(Object.values(pays)).sort((a, b) => cmp(a.date, b.date) || cmp(a.at, b.at) || rank[a.kind] - rank[b.kind] || cmp(a.ref, b.ref));
}
function cdLedger(cid) {
  const u = cdUi(cid), all = clientOps(cid);
  let bal = all.filter((o) => u.from && o.date < u.from).reduce((t, o) => t + o.debit - o.credit, 0);
  const open = bal, rows = all.filter((o) => (!u.from || o.date >= u.from) && (!u.to || o.date <= u.to)).map((o) => Object.assign({ bal: (bal += o.debit - o.credit) }, o));
  const sum = (k, f) => rows.filter(f).reduce((t, o) => t + o[k], 0);
  return { open, rows, close: bal, billed: sum('debit', (o) => o.kind === 'facture'), paid: sum('credit', (o) => o.kind === 'versement'), credits: sum('credit', (o) => o.kind === 'avoir'), refunds: sum('debit', (o) => o.kind === 'rembourse'),
    first: u.from || (rows[0] || {}).date || TODAY, last: u.to || TODAY };
}
const OP_NAMES = { facture: ['Facture', 'b-grey'], avoir: ['Avoir', 'b-info'], versement: ['Versement', 'b-ok'], rembourse: ['Remboursement', 'b-warn'] };
const opDetail = (o) => (o.doc ? esc(o.doc.desc || '') : '<span>' + (MODES[o.mode] || '') + '</span>' + (o.num ? ' <span class="mono">n° ' + esc(o.num) + '</span>' : '') + '<div class="muted mono" style="font-size:12px">' + o.refs.map(esc).join(', ') + '</div>');
const balTxt = (b) => (b < 0 ? '−' + fmt(-b) : fmt(b));
// Les règlements de chaque facture sont lus par paquets de 6, avec l'avancement affiché.
function cdLoadPays(cid) {
  const u = cdUi(cid);
  if (u.loading || u.payErr || DOLI.lazy['cdocs:' + cid] !== 'done') return;
  const todo = clientDocs(cid).filter(cdNeedPay);
  if (!todo.length) return;
  u.loading = true; u.prog = [0, todo.length];
  (async () => {
    for (let i = 0; i < todo.length; i += 6) {
      await Promise.all(todo.slice(i, i + 6).map((d) => DOLI.loadPayments(d)));
      u.prog = [Math.min(todo.length, i + 6), todo.length];
      if (i + 6 < todo.length) render();
    }
  })().catch((e) => { u.payErr = true; toast(e.message); }).finally(() => {
    u.loading = false;
    if (u.printWhenReady && !u.payErr) { u.printWhenReady = false; S.ui.modal = { kind: 'ledger', cid }; }
    render();
  });
}
function cdOpsBody(cid) {
  cdLoadPays(cid);
  const u = cdUi(cid), L = cdLedger(cid), wait = DOLI.lazy['cdocs:' + cid] !== 'done' || u.loading;
  const rows = L.rows.filter((o) => !u.kind || o.kind === u.kind || (u.kind === 'avoir' && o.kind === 'rembourse')).slice().reverse();
  const kinds = [['', 'Tout'], ['facture', 'Factures'], ['versement', 'Versements'], ['avoir', 'Avoirs et remboursements']];
  const td = (v) => '<td class="right num">' + (v ? fmt(v) : '') + '</td>';
  return '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:0 18px 12px"><div class="chips" role="group" aria-label="Type d’opération">' + kinds.map((k) => '<button class="chip" type="button" data-action="cdKind" data-arg="' + k[0] + '" aria-pressed="' + (u.kind === k[0]) + '">' + k[1] + '</button>').join('') + '</div>' +
      (u.loading ? '<span class="muted num" style="font-size:14px">Chargement des règlements… ' + u.prog[0] + ' / ' + u.prog[1] + '</span>' : '') + '</div>' +
    '<div class="table-wrap"><table class="t" id="cd-ops" style="min-width:820px"><thead><tr><th>Date</th><th>Opération</th><th>Détail</th><th class="right">Débit</th><th class="right">Crédit</th><th class="right">Solde</th></tr></thead><tbody>' +
    (rows.length ? rows.map((o) => '<tr data-kind="' + o.kind + '"><td class="num">' + dateFr(o.date) + (o.at.length > 15 ? '<div class="muted" style="font-size:12px">' + o.at.slice(11, 16) + '</div>' : '') + '</td>' +
      '<td><span class="badge ' + OP_NAMES[o.kind][1] + '">' + OP_NAMES[o.kind][0] + '</span><div class="mono" style="font-size:12px;margin-top:4px">' + (o.doc ? '<a href="#/ventes/' + esc(o.ref) + '">' + esc(o.ref) + '</a>' : esc(o.ref)) + '</div></td>' +
      '<td style="font-size:14px;max-width:320px">' + opDetail(o) + '</td>' + td(o.debit) + td(o.credit) + '<td class="right num"><b style="color:' + (o.bal > 0 ? 'var(--bad)' : o.bal < 0 ? 'var(--info)' : 'inherit') + '">' + balTxt(o.bal) + '</b></td></tr>').join('')
      : '<tr><td colspan="6" class="empty">' + (wait ? 'Chargement…' : 'Aucune opération sur cette période.') + '</td></tr>') +
    (u.from ? '<tr class="muted"><td class="num">' + dateFr(u.from) + '</td><td colspan="4">Solde au début de la période</td><td class="right num"><b>' + balTxt(L.open) + '</b></td></tr>' : '') +
    '</tbody></table></div>' +
    '<div class="num" style="display:flex;justify-content:flex-end;gap:24px;padding:12px 18px;flex-wrap:wrap;border-top:1px solid var(--line2)"><span>Facturé <b>' + fmt(L.billed) + '</b></span><span>Versé <b id="cd-paid">' + fmt(L.paid) + '</b></span>' +
      (L.credits ? '<span>Avoirs <b>' + fmt(L.credits) + '</b></span>' : '') + (L.refunds ? '<span>Remboursé <b>' + fmt(L.refunds) + '</b></span>' : '') +
      '<span>Solde <b id="cd-balance" style="color:' + (L.close > 0 ? 'var(--bad)' : L.close < 0 ? 'var(--info)' : 'inherit') + '">' + balTxt(L.close) + '</b> <span class="muted" style="font-size:13px">' + (L.close > 0 ? 'le client doit' : L.close < 0 ? 'en faveur du client' : 'compte soldé') + '</span></span></div>';
}
const viewClientBase = viewClient;
viewClient = function (id) { const html = viewClientBase(id); return client(id) ? html + clientDocsSection(id) : html; };
C.cdFrom = (v) => { const u = S.ui.cd; u.from = v; u.unpaid = false; };
C.cdTo = (v) => { const u = S.ui.cd; u.to = v; u.unpaid = false; };
C.cdPick = (v, el) => { S.ui.cd.off[el.dataset.arg] = !el.checked; };
C.cdAll = (v, el) => { const u = S.ui.cd; clientDocs(u.cid).filter((d) => cdIn(u, d)).forEach((d) => { u.off[d.ref] = !el.checked; }); };
A.cdQuick = (el) => { const u = S.ui.cd, k = el.dataset.arg; u.unpaid = k === 'unpaid'; u.to = ''; u.from = k === 'month' ? TODAY.slice(0, 8) + '01' : k === 'year' ? TODAY.slice(0, 4) + '-01-01' : ''; u.off = {}; };
A.cdPrint = (el) => {
  const cid = el.dataset.arg, list = cdSel(cid);
  if (!list.length) return;
  run(async () => { await DOLI.loadDocPayments(list); S.ui.modal = { kind: 'printMany', cid, refs: list.map((d) => d.ref), format: 'bon' }; }, 'Préparation de l’impression…');
};
A.pmFmt = (el) => { S.ui.modal.format = el.dataset.arg; };
A.cdTab = (el) => { cdUi(S.ui.cd.cid).tab = el.dataset.arg; };
A.cdKind = (el) => { S.ui.cd.kind = el.dataset.arg; };
A.cdLedgerPrint = (el) => { S.ui.modal = { kind: 'ledger', cid: el.dataset.arg }; };
// Bouton « Relevé de compte » de la carte Encours : onglet des opérations, puis impression une fois les règlements lus.
A.cdStatement = (el) => {
  const cid = el.dataset.arg, u = cdUi(cid);
  u.tab = 'ops';
  if (DOLI.lazy['cdocs:' + cid] === 'done' && !u.loading && !clientDocs(cid).some(cdNeedPay)) S.ui.modal = { kind: 'ledger', cid };
  else { u.printWhenReady = true; u.payErr = false; setTimeout(() => { const s = document.getElementById('client-docs'); if (s) s.scrollIntoView({ block: 'start' }); }, 50); }
};
const prRow = (a, b, st) => '<div style="display:flex;justify-content:space-between;gap:16px' + (st || '') + '"><span>' + a + '</span><span>' + b + '</span></div>';
// En-tête commun des relevés : magasin, titre, période, client.
function stmtHead(cid, from, to) {
  const shop = S.db.shop, c = client(cid) || {};
  return '<div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap"><div style="display:flex;gap:10px;align-items:center">' + (shop.logo ? '<img src="' + esc(shop.logo) + '" alt="" style="height:52px;width:auto;max-width:96px;object-fit:contain">' : '') +
      '<div><b style="font-size:16px">' + esc(shop.name) + '</b>' + (shop.address ? '<br>' + esc(shop.address) : '') + (shop.phone ? '<br>' + esc(shop.phone) : '') + '</div></div>' +
      '<div style="text-align:right"><b style="font-size:18px">RELEVÉ DE COMPTE</b><br>Du ' + dateFr(from) + ' au ' + dateFr(to) + '<br>Édité le ' + dateFr(TODAY) + '</div></div>' +
    '<div style="border:1px solid #CCC;border-radius:6px;padding:8px 10px;align-self:flex-end;min-width:min(260px,100%)"><b>' + esc(c.name || '') + '</b>' + (c.address ? '<br>' + esc(c.address) : '') + (c.town ? '<br>' + esc(c.town) : '') + (c.phone ? '<br>' + esc(c.phone) : '') + '</div>';
}
// Relevé de compte : une page avec les documents choisis, payé et reste dû.
function statement(cid, docs) {
  const dates = docs.map((d) => d.date).sort(), row = prRow;
  const tot = docs.reduce((t, d) => t + cdSign(d) * d.ttc, 0), paid = docs.reduce((t, d) => t + (d.type === 'facture' ? d.paid || 0 : 0), 0), rest = docs.reduce((t, d) => t + cdRest(d), 0);
  return '<div class="print-area releve">' + stmtHead(cid, dates[0], dates[dates.length - 1]) +
    '<table><thead><tr><th>Date</th><th>Document</th><th class="r">Montant</th><th class="r">Payé</th><th class="r">Reste dû</th></tr></thead><tbody>' +
      docs.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ref < b.ref ? -1 : 1)).map((d) => '<tr><td>' + dateFr(d.date) + '</td><td>' + (d.type === 'avoir' ? 'Avoir ' : 'Facture ') + esc(d.ref) + '</td><td class="r">' + (d.type === 'avoir' ? '−' : '') + fmt(d.ttc) + '</td><td class="r">' + (d.type === 'facture' ? fmt(d.paid || 0) : '—') + '</td><td class="r">' + (d.type === 'facture' ? fmt(cdRest(d)) : '—') + '</td></tr>').join('') + '</tbody></table>' +
    '<div style="align-self:flex-end;min-width:min(260px,100%);display:flex;flex-direction:column;gap:2px">' + row('Total', fmt(tot)) + row('Payé', fmt(paid)) + row('Reste dû', fmt(rest), ';font-weight:700;font-size:15px;border-top:1px solid #000;padding-top:4px') + '</div></div>';
}
function printManyModal(m) {
  const docs = m.refs.map(doc).filter(Boolean);
  const body = m.format === 'releve' ? statement(m.cid, docs) : docs.map((d) => printDoc(d, m.format === 'bon' && d.type === 'avoir' ? 'a4' : m.format)).join('');
  return modal('Imprimer ' + docs.length + ' document(s)',
    '<div class="chips" role="group" aria-label="Format">' + [['bon', 'Bon d’achat'], ['a4', 'Facture A4'], ['ticket', 'Ticket 80 mm'], ['releve', 'Relevé de compte']].map((f) => '<button class="chip" type="button" data-action="pmFmt" data-arg="' + f[0] + '" aria-pressed="' + (m.format === f[0]) + '">' + f[1] + '</button>').join('') + '</div>' +
    '<span class="muted" style="font-size:13px">' + (m.format === 'releve' ? 'Une page récapitulative.' : 'Une page par document, dans l’ordre de la liste.') + '</span>' +
    '<div class="print-multi">' + body + '</div>',
    '<button class="btn" type="button" data-action="closeModal">Fermer</button><button class="btn btn-primary" type="button" id="pm-print" data-action="printNow">' + ic('print', 18) + 'Imprimer ou PDF</button>', null, true);
}
// Relevé des opérations : solde au début, chaque opération dans l'ordre des dates avec le solde, puis les totaux.
function ledgerPrint(cid) {
  const L = cdLedger(cid), cell = (v) => '<td class="r">' + (v ? fmt(v) : '') + '</td>';
  const what = (o) => '<span>' + OP_NAMES[o.kind][0] + '</span> <span>' + esc(o.ref) + '</span>' + (o.doc ? '' : ' · <span>' + (MODES[o.mode] || '') + '</span>' + (o.num ? ' <span>n° ' + esc(o.num) + '</span>' : '') + ' <span>(' + o.refs.map(esc).join(', ') + ')</span>');
  return '<div class="print-area releve">' + stmtHead(cid, L.first, L.last) +
    '<table><thead><tr><th>Date</th><th>Opération</th><th class="r">Débit</th><th class="r">Crédit</th><th class="r">Solde</th></tr></thead><tbody>' +
      '<tr><td>' + dateFr(L.first) + '</td><td>Solde au début de la période</td><td></td><td></td><td class="r">' + balTxt(L.open) + '</td></tr>' +
      L.rows.map((o) => '<tr><td>' + dateFr(o.date) + '</td><td>' + what(o) + '</td>' + cell(o.debit) + cell(o.credit) + '<td class="r">' + balTxt(o.bal) + '</td></tr>').join('') + '</tbody></table>' +
    '<div style="align-self:flex-end;min-width:min(280px,100%);display:flex;flex-direction:column;gap:2px">' + prRow('Facturé', fmt(L.billed)) + prRow('Versé', fmt(L.paid)) + (L.credits ? prRow('Avoirs', fmt(L.credits)) : '') + (L.refunds ? prRow('Remboursé', fmt(L.refunds)) : '') +
      prRow(L.close < 0 ? 'En faveur du client' : 'Reste dû', fmt(Math.abs(L.close)), ';font-weight:700;font-size:15px;border-top:1px solid #000;padding-top:4px') + '</div></div>';
}
const renderModalMany = renderModal;
renderModal = function () {
  const m = S.ui.modal;
  if (m && m.kind === 'printMany') return printManyModal(m);
  if (m && m.kind === 'ledger') return modal('Relevé de compte', '<div class="print-multi">' + ledgerPrint(m.cid) + '</div>',
    '<button class="btn" type="button" data-action="closeModal">Fermer</button><button class="btn btn-primary" type="button" id="lg-print" data-action="printNow">' + ic('print', 18) + 'Imprimer ou PDF</button>', null, true);
  return renderModalMany();
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
