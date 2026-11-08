/* =================================================================== NAVIGATION : BOUTON RETOUR ET ANIMATIONS */
// - « ← Retour · <page précédente> » en tête de chaque page qui n'a pas déjà son lien de retour (fiches) : revient à la page
//   d'où l'on vient (pile des pages visitées pendant la session ; le bouton « précédent » du navigateur la suit aussi).
// - Animation discrète au changement de page seulement (pas à chaque rendu : l'application redessine à chaque frappe) :
//   en avant, la page monte légèrement ; en arrière, elle glisse depuis le côté. Si les données arrivent pendant
//   l'animation, elle continue là où elle en est au lieu de repartir. Fenêtres et messages apparaissent en fondu.
//   Rien ne bouge si le système demande moins d'animations (prefers-reduced-motion).
const NAVH = { stack: [], last: null, backing: false, dir: 'fwd', t0: 0, modal: null, toast: '' };
const NAV_MS = 240;
const navPath = () => String(location.hash || '').split('?')[0];
const navReal = (p) => /^#\/[^/]+/.test(p);                     // une vraie page (« #/ » seul est redirigé vers l'accueil)
function navPrev() { return NAVH.stack.length > 1 ? NAVH.stack[NAVH.stack.length - 2] : null; }
function navLabel(p) {
  const sec = p.split('/')[1] || '', n = NAV.find((x) => x.id === sec);
  return n ? n.label : sec === 'profil' ? 'Mon profil' : cap(sec);
}
A.navBack = () => {
  const prev = navPrev();
  if (!prev) return false;
  NAVH.backing = true;
  location.hash = prev;
  return false;
};

// En-tête de page : bouton « Retour ». Les pages qui ont leur retour logique (Nouvelle pièce → Pièces, fiche → liste…)
// le gardent, sous la même forme ; les autres reviennent à la page précédente.
const headNav = head;
head = function (title, sub, actions, back) {
  const html = headNav(title, sub, actions), prev = navPrev();
  if (!back && !prev) return html;
  const label = back ? back[1] : navLabel(prev);
  const inner = ic('back', 16) + (/^Retour/.test(label) ? '<span>' + esc(label) + '</span>'
    : '<span>Retour</span><span class="page-back-sep" aria-hidden="true">·</span><span class="page-back-to">' + esc(label) + '</span>');
  const btn = back ? '<a class="page-back" href="' + esc(back[0]) + '">' + inner + '</a>'
    : '<button type="button" class="page-back" data-action="navBack" aria-label="Retour à la page précédente">' + inner + '</button>';
  return html.replace('<div class="page-head"><div>', '<div class="page-head"><div>' + btn);
};

const renderNav = render;
render = function () {
  const p = navPath(), changed = !!S.user && navReal(p) && p !== NAVH.last;
  if (changed) {
    // En arrière : bouton « Retour », ou bouton « précédent » du navigateur vers la page d'avant.
    if (NAVH.backing || p === navPrev()) { NAVH.dir = 'back'; NAVH.stack.pop(); }
    else { NAVH.dir = 'fwd'; NAVH.stack.push(p); if (NAVH.stack.length > 50) NAVH.stack.shift(); }
    if (NAVH.stack[NAVH.stack.length - 1] !== p) NAVH.stack.push(p);
    NAVH.backing = false; NAVH.last = p; NAVH.t0 = performance.now();
  }
  if (!S.user) { NAVH.stack = []; NAVH.last = null; }
  renderNav();
  // Page : classe d'animation posée au changement, et gardée (avec le temps déjà écoulé) sur les rendus des 240 ms suivants.
  const el = S.user && (document.getElementById('content') || (document.getElementById('app') || {}).firstElementChild);
  const spent = performance.now() - NAVH.t0;
  if (el && NAVH.t0 && spent < NAV_MS) {
    el.classList.add(NAVH.dir === 'back' ? 'cr-enter-back' : 'cr-enter-fwd');
    if (!changed) el.style.animationDelay = -Math.round(spent) + 'ms';
  }
  const m = S.ui.modal;
  if (m && m !== NAVH.modal) { const bg = document.querySelector('.modal-bg'); if (bg) bg.classList.add('cr-in'); }
  NAVH.modal = m;
  const t = S.ui.toast || '';
  if (t && t !== NAVH.toast) { const el2 = document.querySelector('.toast'); if (el2) el2.classList.add('cr-in'); }
  NAVH.toast = t;
};

(function () {
  const css = document.createElement('style');
  css.textContent = `
@keyframes cr-fwd{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes cr-back{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}
@keyframes cr-back-rtl{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
@keyframes cr-fade{from{opacity:0}to{opacity:1}}
@keyframes cr-pop{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
@keyframes cr-toast{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
.cr-enter-fwd{animation:cr-fwd ${NAV_MS}ms cubic-bezier(.22,.7,.3,1) both}
.cr-enter-back{animation:cr-back ${NAV_MS}ms cubic-bezier(.22,.7,.3,1) both}
[dir="rtl"] .cr-enter-back{animation-name:cr-back-rtl}
.brand .nav-toggle{width:100%;height:36px;margin-top:14px;padding:0 10px;justify-content:flex-start;gap:8px;font:inherit;font-size:13px;color:#C9CBD2;
  transition:background-color .15s ease,color .15s ease}
.brand .nav-toggle:hover{color:#fff}
.side.collapsed .brand .nav-toggle{width:36px;padding:0;justify-content:center}
.side.collapsed .nav-toggle-t{display:none}
[dir="rtl"] .brand .nav-toggle svg{transform:scaleX(-1)}
[dir="rtl"] .side.collapsed .brand .nav-toggle svg{transform:none}
.modal-bg.cr-in{animation:cr-fade .18s ease-out both}
.modal-bg.cr-in .modal{animation:cr-pop .22s cubic-bezier(.22,.7,.3,1) both}
.toast.cr-in{animation:cr-toast .2s ease-out both}
.nav a{transition:background-color .15s ease,color .15s ease}
.page-back{display:flex;align-items:center;gap:5px;width:max-content;margin:0 0 8px;padding:5px 12px 5px 8px;border:1px solid var(--line);border-radius:999px;
  background:var(--surface);color:var(--ink);font:inherit;font-size:13px;font-weight:600;line-height:1.2;cursor:pointer;transition:background-color .15s,border-color .15s}
a.page-back{text-decoration:none}
.page-back:hover{background:var(--soft);border-color:var(--muted)}
.page-back:focus-visible{outline:3px solid #1D4ED8;outline-offset:2px}
.page-back-sep,.page-back-to{font-weight:400;color:var(--muted)}
[dir="rtl"] .page-back{padding:5px 8px 5px 12px}
[dir="rtl"] .page-back svg{transform:scaleX(-1)}
@media (prefers-reduced-motion:reduce){.cr-enter-fwd,.cr-enter-back,.modal-bg.cr-in,.modal-bg.cr-in .modal,.toast.cr-in{animation:none}.nav a,.page-back{transition:none}}
`;
  document.head.appendChild(css);
})();
