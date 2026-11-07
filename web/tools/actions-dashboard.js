/* =================================================================== TABLEAU DE BORD : CAISSE EN HAUT, GRAPHIQUES */
// En haut, la caisse (état de la session, encaissé du jour, espèces attendues, aller à la caisse / la fermer) ;
// puis les tuiles ; puis le chiffre d'affaires des 30 derniers jours et des 12 derniers mois (barres),
// les ventes du jour par vendeur et les ventes par famille. Chaque graphique a une info-bulle et sa table de chiffres.
// Historique : factures validées des 12 derniers mois lues dans Dolibarr (date, montant, type seulement), une fois
// par session ; le jour même vient des ventes déjà chargées, donc toujours à jour.

// ---------- historique ----------
const DASH = { hist: null };
const dIso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function dashFrom() { const d = new Date(TODAY + 'T12:00'); d.setDate(1); d.setMonth(d.getMonth() - 11); return dIso(d); }
async function dashLoadHistory() {
  const from = dashFrom(), days = {}, rows = [];
  for (let page = 0; page < 100; page++) {
    const r = await DOLI.api('invoices', { query: { sqlfilters: "(t.datef:>=:'" + from + "') and (t.datef:<:'" + TODAY + "')",
      properties: 'id,type,date,total_ttc,statut', sortfield: 't.rowid', sortorder: 'ASC', limit: 1000, page } });
    if (!Array.isArray(r) || !r.length) break;
    rows.push(...r);
    if (r.length < 1000) break;
  }
  rows.forEach((r) => {
    const st = DOLI.num(r.statut), type = DOLI.num(r.type);
    if (st === 0 || st === 3 || type === 3) return;                       // brouillon, abandonnée, acompte
    const day = dIso(new Date(DOLI.num(r.date) * 1000)), v = Math.abs(DOLI.num(r.total_ttc)) * (type === 2 ? -1 : 1);
    days[day] = (days[day] || 0) + v;
  });
  DASH.hist = { days, from };
}
// Chiffre d'affaires d'un jour : historique, sauf aujourd'hui (ventes chargées, à jour après chaque vente).
const dashDay = (iso) => (iso === TODAY ? (S.db.day.base || 0) : (DASH.hist.days[iso] || 0));

// ---------- mise en forme ----------
const dashLocale = () => (LANG() === 'ar' ? 'ar-DZ' : LANG() === 'en' ? 'en-GB' : 'fr-FR');   // ar-DZ : chiffres latins, comme le reste
function dashCompact(v) {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e6) return s + (a / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' M';
  if (a >= 1e4) return s + Math.round(a / 1e3).toLocaleString('fr-FR') + ' k';
  return s + Math.round(a).toLocaleString('fr-FR');
}
// Graduations « rondes » : pas de 1, 2, 2,5 ou 5 × 10^n, 4 intervalles au plus.
function dashTicks(max) {
  if (max <= 0) return [0, 1];
  const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw);
  const out = [];
  for (let v = 0; v < max + step * 0.999; v += step) out.push(v);
  return out;
}
const tipAttrs = (value, label) => ' tabindex="0" data-tip-v="' + esc(value) + '" data-tip-l="' + esc(label) + '" aria-label="' + esc(label + ' : ' + value) + '"';

// Colonnes (une série) : barres de 24 px au plus, haut arrondi, base carrée ; graduations en traits fins.
// data : [{ key, x (étiquette d'axe, '' = pas d'étiquette), label (info-bulle / table), value, mark }]
function dashColumns(title, sub, data, colLabel) {
  const max = Math.max(0, ...data.map((d) => d.value)), ticks = dashTicks(max), top = ticks[ticks.length - 1] || 1;
  // Étiquettes de valeur : la période en cours et le maximum, celui-ci seulement s'il est à plus de 2 barres (pas de chevauchement).
  const bi = data.reduce((b, d, i) => (d.value > (b < 0 ? 0 : data[b].value) ? i : b), -1), mi = data.findIndex((d) => d.mark);
  const showBest = bi >= 0 && (mi < 0 || Math.abs(bi - mi) > 2);
  const grid = ticks.map((t) => '<div class="dc-grid" style="bottom:' + (t / top * 100) + '%"><span>' + dashCompact(t) + '</span></div>').join('');
  const cols = data.map((d, i) => {
    const h = Math.max(0, d.value) / top * 100, lab = d.mark || (showBest && i === bi);
    return '<div class="dc-col' + (d.mark ? ' now' : '') + '"' + tipAttrs(fmt(d.value), d.label) + '>' +
      (lab && d.value > 0 ? '<span class="dc-val" style="bottom:' + h + '%">' + dashCompact(d.value) + '</span>' : '') +
      '<span class="dc-bar" style="height:' + h + '%"></span></div>';
  }).join('');
  // Étiquettes d'axe : une sur deux masquée sur petit écran (classe alt), jamais celle de la période en cours.
  const n = data.length, xs = data.map((d, i) => '<span class="' + (d.mark ? 'now' : (n - 1 - i) % 2 ? 'alt' : '') + '">' + esc(d.x) + '</span>').join('');
  // dir="ltr" : le temps va de gauche à droite et « 57 k » reste lisible, même en arabe.
  return '<section class="card card-pad dash-chart"><div><h2>' + title + '</h2><span class="muted" style="font-size:13px">' + sub + '</span></div>' +
    '<div class="dc" dir="ltr"><div class="dc-plot">' + grid + '<div class="dc-cols">' + cols + '</div></div><div class="dc-x">' + xs + '</div></div>' +
    dashTable(colLabel, data.map((d) => [d.label, fmt(d.value)])) + '</section>';
}
// Barres horizontales (une série), valeur au bout, détail sous le nom.
function dashRows(rows, empty) {
  if (!rows.length) return '<p class="empty" style="margin:0">' + empty + '</p>';
  const max = Math.max(1, ...rows.map((r) => r.value));
  return '<div class="dr">' + rows.map((r) => '<div class="dr-row"' + tipAttrs(fmt(r.value), r.label + (r.sub ? ' · ' + r.sub : '')) + '>' +
    '<div class="dr-head"><b>' + esc(r.label) + '</b><span class="num">' + fmt(r.value) + (r.sub ? ' <span class="muted">· ' + esc(r.sub) + '</span>' : '') + '</span></div>' +
    '<div class="dr-track" aria-hidden="true"><span class="dr-bar" style="width:' + Math.max(0, r.value) / max * 100 + '%"></span></div></div>').join('') + '</div>';
}
function dashTable(colLabel, rows) {
  return '<details class="dash-tbl"><summary>Voir les chiffres</summary><table class="t"><thead><tr><th>' + colLabel + '</th><th class="right">Montant</th></tr></thead><tbody>' +
    rows.map((r) => '<tr><td>' + esc(r[0]) + '</td><td class="right num">' + r[1] + '</td></tr>').join('') + '</tbody></table></details>';
}

// ---------- caisse ----------
function dashTill() {
  const day = S.db.day, s = S.db.session, total = day.cash + day.cheque + day.virement, out = cashOut();
  const by = s ? (S.db.users.find((u) => u.login === s.by) || { name: s.by }).name : '';
  // Morceaux séparés (et non une phrase) : chacun se traduit seul.
  const chip = s ? '<span class="dt-chip on"><span class="dot"></span><b>Ouverte</b><span class="mono">' + esc(s.ref) + '</span><span>depuis ' + esc(String(s.opened || '').slice(11, 16)) + '</span>' + (by ? '<span>' + esc(by) + '</span>' : '') + '</span>'
    : '<span class="dt-chip"><span class="dot"></span><b>Fermée</b></span>';
  const mode = (l, v) => '<div class="dt-mode"><span>' + l + '</span><b class="num">' + fmt(v) + '</b></div>';
  return '<section class="dash-till" aria-label="Caisse">' +
    '<div class="dt-main"><div class="dt-head"><h2>' + ic('caisse', 20) + 'Caisse</h2>' + chip + '</div>' +
      '<div class="dt-hero"><span class="l">Encaissé aujourd’hui</span><span class="v">' + fmt(total) + '</span></div>' +
      '<div class="dt-modes">' + mode('Espèces', day.cash) + mode('Chèques', day.cheque) + mode('Virements', day.virement) + '</div></div>' +
    '<div class="dt-side"><div class="dt-cash"><span>Espèces attendues en caisse</span><b class="num">' + fmt(drawerCash()) + '</b>' +
      '<small>' + (s ? 'Fond ' + fmt(s.opening) + ' inclus' + (out ? ', ' + fmt(out) + ' déposés en banque aujourd’hui' : '') : 'Caisse fermée') + '</small></div>' +
      '<div class="dt-actions">' + (can(['vendeur', 'responsable', 'gerant']) ? '<a class="btn btn-primary" href="#/caisse">' + ic('caisse', 18) + 'Aller à la caisse</a>' : '') +
      '<button class="btn dt-btn" type="button" data-action="modalCashClose">' + (s ? 'Compter et fermer la caisse' : 'Compter la caisse') + '</button></div></div>' +
  '</section>';
}

// ---------- vue ----------
function viewTableauCharts() {
  if (!DASH.hist) {
    DOLI.need('dash-hist', dashLoadHistory);
    return '<div class="grid-2"><section class="card card-pad dash-chart"><h2>Chiffre d’affaires</h2><p class="muted">Chargement de l’historique des ventes…</p></section></div>';
  }
  const loc = dashLocale(), today = new Date(TODAY + 'T12:00');
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const iso = dIso(d), dd = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    days.push({ key: iso, x: i === 0 ? dd : (i % 5 === 0 ? dd : ''), label: d.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'long' }), value: dashDay(iso), mark: i === 0 });
  }
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today); d.setDate(1); d.setMonth(d.getMonth() - i);
    const key = dIso(d).slice(0, 7);
    const v = Object.keys(DASH.hist.days).filter((k) => k.slice(0, 7) === key).reduce((t, k) => t + DASH.hist.days[k], 0) + (key === TODAY.slice(0, 7) ? (S.db.day.base || 0) : 0);
    months.push({ key, x: d.toLocaleDateString(loc, { month: 'short' }), label: cap(d.toLocaleDateString(loc, { month: 'long', year: 'numeric' })), value: v, mark: i === 0 });
  }
  const d30 = days.reduce((t, d) => t + d.value, 0), sold = days.filter((d) => d.value > 0).length;
  return '<div class="grid-2">' +
    dashColumns('Chiffre d’affaires · 30 derniers jours', fmt(d30) + ' · ' + sold + ' jour(s) avec des ventes · aujourd’hui en foncé', days, 'Jour') +
    dashColumns('Chiffre d’affaires · 12 derniers mois', fmt(months.reduce((t, m) => t + m.value, 0)) + ' sur 12 mois · mois en cours en foncé', months, 'Mois') +
  '</div>';
}
// Ventes par famille sur 30 jours, à partir des factures chargées (les 400 dernières).
function dashFamilies() {
  const from = (() => { const d = new Date(TODAY + 'T12:00'); d.setDate(d.getDate() - 29); return dIso(d); })();
  const inv = S.db.docs.filter((d) => (d.type === 'facture' || d.type === 'avoir') && d.status !== 'brouillon' && d.date >= from);
  const fam = {};
  inv.forEach((d) => d.lines.forEach((l) => { const p = part(l.pid), k = (p && p.fam) || 'Sans famille'; fam[k] = (fam[k] || 0) + l.qty * l.price * (1 - (l.disc || 0) / 100) * (d.type === 'avoir' ? -1 : 1); }));
  const rows = Object.keys(fam).map((k) => ({ label: k, value: fam[k] })).filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  const top = rows.slice(0, 7), rest = rows.slice(7).reduce((t, r) => t + r.value, 0);
  if (rest > 0) top.push({ label: 'Autres familles', value: rest });
  const loaded = S.db.docs.filter((d) => d.type === 'facture').map((d) => d.date).sort()[0];
  return '<section class="card card-pad"><div><h2>Ventes par famille</h2><span class="muted" style="font-size:13px">30 derniers jours' + (loaded && loaded > from ? ', depuis le ' + esc(loaded.split('-').reverse().join('/')) + ' (ventes chargées)' : '') + '</span></div>' +
    dashRows(top, 'Aucune vente sur la période.') + (top.length ? dashTable('Famille', top.map((r) => [r.label, fmt(r.value)])) : '') + '</section>';
}

viewTableau = function () {
  const day = S.db.day, mo = S.db.months;
  const ca = day.base + (day.extra || 0);
  const imp = S.db.clients.reduce((t, c) => t + encours(c.id), 0);
  const lateClients = S.db.clients.filter((c) => S.db.docs.some((d) => d.client === c.id && d.type === 'facture' && d.status !== 'payee' && d.due && d.due < TODAY)).length;
  const alerts = S.db.parts.filter((p) => total(p) < p.seuil);
  const chq = payments().filter((p) => p.mode === 'cheque' && p.amount > 0 && !p.deposited);
  const priced = S.db.docs.filter((d) => d.type === 'facture' && d.date === TODAY && d.notePrivate);
  const sellers = Object.keys(day.sellers).map((k) => ({ u: S.db.users.find((x) => x.login === k) || { name: k }, v: day.sellers[k] })).sort((a, b) => b.v[0] - a.v[0]);
  const tile = (l, v, s) => '<div class="card kpi"><span class="l">' + l + '</span><span class="v num">' + v + '</span><span class="s">' + s + '</span></div>';
  DOLI.need('day', () => DOLI.loadDayPayments());
  const sep = mo[S.db.monthKeys[0]] || { ttc: 0, cost: 0 }, oct = mo[S.db.monthKeys[1]] || { ttc: 0, cost: 0 };
  const MN = S.db.monthKeys.map((k) => new Date(k + '-01T12:00').toLocaleDateString('fr-FR', { month: 'long' }));
  const growth = sep.ttc ? Math.round((oct.ttc - sep.ttc) / sep.ttc * 100) : 0;
  const octHt = oct.ttc / (VAT() ? 1.19 : 1), margin = octHt ? ((octHt - oct.cost) / octHt * 100).toFixed(1).replace('.', ',') : '0';
  return head('Tableau de bord', cap(new Date(TODAY + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) + (VAT() ? ' · montants TTC' : '')) +
    '<div class="dash">' + dashTill() +
    '<div class="dash-kpis">' +
      tile('Chiffre d’affaires du jour', fmt(ca), day.count + ' ventes · panier moyen ' + fmt(day.count ? ca / day.count : 0)) +
      tile(cap(MN[1] || '') + ' ' + (S.db.monthKeys[1] || '').slice(0, 4), fmt(oct.ttc), (growth >= 0 ? '+' : '−') + Math.abs(growth) + ' % par rapport à ' + (MN[0] || '')) +
      (seeCost() ? tile('Marge brute de ' + (MN[1] || ''), oct.cost ? margin + ' %' : '—', 'sur le coût moyen pondéré (PMP)') : '') +
      tile('Impayés clients', fmt(imp), lateClients + ' client(s) avec des factures en retard') +
    '</div>' +
    viewTableauCharts() +
    '<div class="grid-auto">' +
      '<section class="card card-pad"><div><h2>Ventes du jour par vendeur</h2><span class="muted" style="font-size:13px">' + fmt(ca) + ' · ' + day.count + ' ventes</span></div>' +
        dashRows(sellers.map((s) => ({ label: s.u.name, value: s.v[0], sub: s.v[1] + ' ventes' })), 'Aucune vente aujourd’hui.') + '</section>' +
      dashFamilies() +
      '<section class="card card-pad"><h2>À vérifier</h2>' +
        (S.db.journal.length ? S.db.journal.map((j) => '<div class="alert a-warn">' + ic('warn', 20, '#9A3412') + '<div><b>Attention :</b> vente ' + j.sale + ' interrompue sur le poste ' + esc(j.device) + ' (étape « ' + STEP_LABEL[j.step] + ' », ' + j.invoice + ', ' + fmt(j.ttc) + '). <a href="#/ventes/' + j.invoice + '">Voir</a></div></div>').join('') : '<div class="alert a-ok">' + ic('check', 20) + 'Aucune vente interrompue.</div>') +
        (priced.length ? '<div class="alert a-info">' + ic('info', 20) + '<div>' + priced.reduce((t, d) => t + d.notePrivate.length, 0) + ' prix modifié(s) à la caisse aujourd’hui : ' + priced.map((d) => '<a class="mono" href="#/ventes/' + d.ref + '">' + d.ref + '</a>').join(', ') + '</div></div>' : '') +
        (day.orphans ? '<div class="alert" style="background:var(--bg)">' + ic('info', 20) + '<div style="display:flex;flex-direction:column;gap:8px"><span><b>Info :</b> ' + day.orphans + ' factures brouillon CARUNO de plus de 24 h, sans vente en cours. Sans effet sur le stock.</span><button class="btn btn-outline" type="button" data-action="cleanOrphans" style="align-self:flex-start">Examiner et supprimer</button></div></div>' : '') +
        (chq.length ? '<div class="alert a-info">' + ic('info', 20) + '<div>' + chq.length + ' chèque(s) à remettre en banque, ' + fmt(chq.reduce((t, p) => t + p.amount, 0)) + '. <a href="#/reglements" data-action="regTab" data-arg="cheques">Règlements</a></div></div>' : '') +
        '<div class="alert a-warn">' + ic('warn', 20, '#9A3412') + '<div>' + alerts.length + ' pièces sous le seuil d’alerte. <a href="#/stock">Voir le stock</a></div></div>' +
      '</section>' +
    '</div></div>';
};

// ---------- info-bulle (une seule, hors de #app pour survivre aux rendus ; texte posé par textContent) ----------
(function () {
  const tip = document.createElement('div');
  tip.className = 'dash-tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
  const v = document.createElement('b'), l = document.createElement('span');
  tip.append(v, l); document.body.appendChild(tip);
  const show = (el) => {
    v.textContent = el.dataset.tipV; l.textContent = el.dataset.tipL; tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    tip.style.top = Math.max(8, r.top - h - 8) + 'px';
  };
  const hide = () => { tip.hidden = true; };
  // Un rendu remplace les barres sans événement de sortie : l'info-bulle disparaît à chaque rendu.
  const renderTip = render;
  render = function () { renderTip(); hide(); };
  document.documentElement.addEventListener('pointerleave', hide);
  document.addEventListener('pointerover', (e) => { const el = e.target.closest && e.target.closest('[data-tip-v]'); if (el) show(el); else hide(); });
  document.addEventListener('focusin', (e) => { const el = e.target.closest && e.target.closest('[data-tip-v]'); if (el) show(el); else hide(); });
  document.addEventListener('focusout', hide);
  window.addEventListener('scroll', hide, true);
})();

// ---------- styles ----------
(function () {
  const css = document.createElement('style');
  css.textContent = `
.dash{display:flex;flex-direction:column;gap:18px}
.dash-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.grid-2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:18px}
.dash-till{display:flex;flex-wrap:wrap;gap:18px 28px;justify-content:space-between;background:var(--dark);color:var(--dark-ink);border-radius:14px;padding:20px 22px}
.dash-till h2{display:flex;align-items:center;gap:8px;color:#fff}
.dt-main{display:flex;flex-direction:column;gap:14px;min-width:0;flex:1 1 360px}
.dt-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px}
.dt-chip{display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px 9px;font-size:13px;padding:4px 10px;border-radius:999px;background:var(--dark2);color:var(--dark-ink)}
.dt-chip .dot{width:8px;height:8px;border-radius:50%;background:#8A8F9C}
.dt-chip.on .dot{background:#4ADE80}
.dt-chip .mono{font-size:12px}
.dt-hero{display:flex;flex-direction:column;gap:2px}
.dt-hero .l{font-size:14px;color:#C9CBD2}
.dt-hero .v{font-size:48px;font-weight:700;line-height:1.05;color:#fff}
.dt-modes{display:grid;grid-template-columns:repeat(3,minmax(0,150px));gap:10px}
.dt-mode{display:flex;flex-direction:column;gap:2px;padding:8px 14px;border-radius:10px;background:var(--dark2);min-width:0}
.dt-mode span{font-size:13px;color:#C9CBD2}.dt-mode b{font-size:17px;color:#fff;font-variant-numeric:tabular-nums}
.dt-side{display:flex;flex-direction:column;justify-content:space-between;gap:14px;flex:0 1 340px}
.dt-cash{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:10px;background:var(--dark2)}
.dt-cash span{font-size:13px;color:#C9CBD2}.dt-cash b{font-size:24px;color:#fff}.dt-cash small{font-size:12px;color:#C9CBD2}
.dt-actions{display:flex;flex-wrap:wrap;gap:10px}
.dt-actions .btn{flex:1 1 auto;justify-content:center}
.dt-btn{background:transparent;color:#fff;border-color:#4B5060}.dt-btn:hover{background:var(--dark2);color:#fff}
.dash-chart{min-width:0}
.dc{display:flex;flex-direction:column;gap:6px;padding-left:44px}
.dc-plot{position:relative;height:190px;margin-top:16px}
.dc-grid{position:absolute;left:0;right:0;border-top:1px solid var(--line2)}
.dc-grid span{position:absolute;right:calc(100% + 8px);top:-8px;font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.dc-cols{position:absolute;inset:0;display:flex;align-items:flex-end}
.dc-col{position:relative;flex:1;height:100%;display:flex;align-items:flex-end;justify-content:center;padding:0 1px;outline:none;cursor:default}
.dc-bar{display:block;width:100%;max-width:24px;min-height:0;background:var(--accent);border-radius:4px 4px 0 0}
.dc-col.now .dc-bar{background:var(--accent-ink)}
.dc-col:hover .dc-bar,.dc-col:focus-visible .dc-bar{box-shadow:0 0 0 3px var(--accent-weak)}
.dc-col:focus-visible{outline:2px solid #1D4ED8;outline-offset:1px;border-radius:4px}
.dc-val{position:absolute;left:50%;transform:translate(-50%,-4px);font-size:11px;font-weight:600;color:var(--ink);white-space:nowrap;pointer-events:none}
.dc-x{display:flex;font-size:11px;color:var(--muted)}
.dc-x span{flex:1;text-align:center;white-space:nowrap;overflow:visible;min-width:0}
.dc-x span.now{color:var(--ink);font-weight:600}
.dr{display:flex;flex-direction:column;gap:12px}
.dr-row{display:flex;flex-direction:column;gap:6px;outline:none;border-radius:6px}
.dr-row:focus-visible{outline:2px solid #1D4ED8;outline-offset:3px}
.dr-head{display:flex;justify-content:space-between;gap:12px;font-size:14px}
.dr-track{height:10px;background:var(--line2);border-radius:4px}
.dr-bar{display:block;height:10px;background:var(--accent);border-radius:0 4px 4px 0}
.dr-row:hover .dr-bar{background:var(--accent-hover)}
.dash-tbl summary{cursor:pointer;font-size:13px;color:#1D4ED8;width:max-content}
.dash-tbl table{margin-top:8px}
.dash-tip{position:fixed;z-index:60;display:flex;flex-direction:column;gap:1px;padding:7px 10px;border-radius:8px;background:var(--dark);color:var(--dark-ink);font-size:12px;pointer-events:none;box-shadow:0 4px 14px rgba(0,0,0,.18)}
.dash-tip b{font-size:14px;color:#fff}
.dash-tip[hidden]{display:none}
@media (max-width:700px){.dt-hero .v{font-size:40px}.dc{padding-left:38px}.dc-x span.alt{visibility:hidden}
  .dt-modes{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.dt-mode{padding:8px 10px}.dt-mode b{font-size:15px}}
`;
  document.head.appendChild(css);
})();
