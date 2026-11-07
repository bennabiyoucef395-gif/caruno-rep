/* =================================================================== PHOTOS DANS LES LISTES, DESSIN PAR FAMILLE SANS PHOTO */
// 1. Pièces et caisse : la petite photo Dolibarr (<ref>/thumbs/<ref>_small.jpg) de chaque pièce affichée est chargée,
//    6 à la fois, dans le même cache que le catalogue (une seule fois par session).
// 2. Pièce sans photo : un dessin de sa famille (disque, filtre, piston…) au lieu de la boîte vide.
//    Famille = famille Dolibarr de la pièce, sinon déduite de son nom (anglais du fournisseur, français ou arabe).

// ---------- famille d'une pièce ----------
const ART_RULES = [   // ordre : du plus précis au plus général (« water pump » avant « pump », « oil filter » avant « oil »)
  ['froid', /water pump|pompe [àa] eau|radiat|thermostat|cool|refroid|durite|hose|expansion|condens|compress|fan\b|ventilat|مضخة الماء|المبرد|ترموستات/i],
  ['filtre', /filt|مصفاة|فلتر/i],
  ['frein', /brake|frein|disc\b|disque|pad|plaquette|caliper|[ée]trier|m[âa]choire|\babs\b|فرامل|الفرامل/i],
  ['embrayage', /clutch|embrayage|c\.?v\.? ?joint|homocin|drive ?shaft|transmission|gear|bo[îi]te|flywheel|volant|propeller|cardan|قابض|ناقل/i],
  ['suspension', /shock|absorb|amortiss|spring|ressort|strut|arm\b|bras|bush|silentbloc|ball joint|rotule|tie rod|biellette|stabili|steering|direction|hub|moyeu|bearing|roulement|ممتص|نابض/i],
  ['elec', /alternat|starter|d[ée]marreur|sensor|capteur|switch|interrupteur|relay|relais|coil|bobine|battery|batterie|ignition|allumage|wiring|faisceau|مستشعر|بطارية/i],
  ['carrosserie', /bumper|pare-chocs|mirror|r[ée]troviseur|grill|calandre|fender|aile|bonnet|capot|door|porte|lamp|light|phare|feu|wiper|essuie|handle|poign[ée]e|lock|serrure|emblem|logo|trim|moulure|glass|vitre|مصباح|مرآة|صدام/i],
  ['moteur', /piston|gasket|joint|engine|moteur|timing|belt|courroie|distribution|spark|bougie|plug|inject|turbo|cam|valve|soupape|pump|pompe|mount|support|oil|huile|محرك/i],
];
const ART_FAM = { 'Freinage': 'frein', 'Filtration': 'filtre', 'Moteur': 'moteur', 'Électricité et électronique': 'elec', 'Suspension et direction': 'suspension',
  'Refroidissement et climatisation': 'froid', 'Embrayage et transmission': 'embrayage', 'Carrosserie et accessoires': 'carrosserie' };
function artKey(name, fam) {
  if (fam && ART_FAM[fam]) return ART_FAM[fam];
  const r = ART_RULES.find((x) => x[1].test(String(name || '')));
  return r ? r[0] : 'autre';
}
// ---------- dessins (24×24, trait du style des icônes de l'application) ----------
const ART = {
  frein: '<circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="2.6"/><circle cx="11" cy="8" r=".6"/><circle cx="15.8" cy="11.5" r=".6"/><circle cx="14" cy="17.1" r=".6"/><circle cx="8" cy="17.1" r=".6"/><circle cx="6.2" cy="11.5" r=".6"/><path d="M15.5 3.2l4.6 3-1.4 2.2-4.6-3z"/>',
  filtre: '<rect x="6" y="5" width="12" height="16" rx="2.2"/><path d="M9 5V3h6v2M6 9h12M6 17h12M9.5 9v8M12 9v8M14.5 9v8"/>',
  moteur: '<rect x="6.5" y="3" width="11" height="9" rx="1.6"/><path d="M6.5 6h11M6.5 8.2h11M10 12l-1.3 7.5M14 12l1.3 7.5M7.5 19.5h9"/><circle cx="12" cy="12" r=".9"/>',
  elec: '<rect x="3" y="7.5" width="18" height="12" rx="2"/><path d="M6.5 7.5V5.5h3v2M14.5 7.5V5.5h3v2M6.5 13.5h3M8 12v3M14.5 13.5h3"/>',
  suspension: '<path d="M12 2v3.5"/><rect x="9.6" y="5.5" width="4.8" height="6" rx="1"/><path d="M7.5 12.5l9 1.6-9 1.6 9 1.6-9 1.6 9 1.6M12 20.5V22"/>',
  froid: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M7 6v13M10.5 6v13M14 6v13M17.5 6v13"/><circle cx="18" cy="3.6" r="1.4"/>',
  embrayage: '<circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  carrosserie: '<path d="M3 15.5v-3.2l2.6-4.6h8.6l3.6 4.6h2.2a1 1 0 0 1 1 1v2.2"/><path d="M3 12.3h18"/><circle cx="7.2" cy="16.4" r="2"/><circle cx="16.8" cy="16.4" r="2"/><path d="M9.2 16.4h5.6"/>',
  autre: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
};
// Dessin de la famille, dans un carré clair (taille px) ; label = nom de la famille pour les lecteurs d'écran.
function artSvg(key, px) {
  return '<svg class="art-svg" viewBox="0 0 24 24" width="' + px + '" height="' + px + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ART[key] || ART.autre) + '</svg>';
}

// ---------- petites photos des listes (pièces, caisse) ----------
const ART_PENDING = new Set();
let artTimer = null;
function artWantThumb(ref) {
  const c = catUi();
  if (!ref || ref in c.thumbs || ART_PENDING.has(ref)) return;
  ART_PENDING.add(ref);
  clearTimeout(artTimer);
  artTimer = setTimeout(artLoadThumbs, 60);
}
async function artLoadThumbs() {
  const c = catUi(), todo = [...ART_PENDING].filter((r) => !(r in c.thumbs));
  for (let i = 0; i < todo.length; i += 6) {
    await Promise.all(todo.slice(i, i + 6).map(async (ref) => {
      try {
        const d = await DOLI.api('documents/download', { query: { modulepart: 'product', original_file: ref + '/thumbs/' + ref + '_small.jpg' } });
        c.thumbs[ref] = d && d.content ? 'data:' + d['content-type'] + ';base64,' + d.content : '';
      } catch (e) { c.thumbs[ref] = ''; }
      ART_PENDING.delete(ref);
    }));
    render();
  }
}

// Vignette d'une pièce : sa photo (chargée à l'ouverture de la fiche), sinon la petite photo Dolibarr, sinon le dessin.
thumb = function (p, size) {
  const s = size || 44, c = catUi();
  const url = (p.photos && p.photos[0] && p.photos[0].url) || c.thumbs[p.ref];
  if (!url && p.ref && !(p.ref in c.thumbs)) artWantThumb(p.ref);
  return '<span class="thumb" style="width:' + s + 'px;height:' + s + 'px">' + (url ? '<img alt="" src="' + url + '">' : '<span class="art">' + artSvg(artKey(p.name, p.fam), Math.round(s * 0.62)) + '</span>') + '</span>';
};
// Vignette à partir d'une ligne produit brute de l'API (catalogue, véhicule) : photo t ou dessin d'après le libellé.
function artThumb(t, label, px) {
  return t ? '<img alt="" src="' + t + '">' : '<span class="art">' + artSvg(artKey(label), px || 28) + '</span>';
}
// Grande photo absente (fiche pièce) : grand dessin + « Pas encore de photo ».
function artBig(name, fam) {
  return '<span class="art art-big">' + artSvg(artKey(name, fam), 120) + '</span><span>Pas encore de photo</span>';
}

(function () {
  const css = document.createElement('style');
  css.textContent = `
.art{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#9A9FAB;background:linear-gradient(145deg,#F7F7F4,#ECECE7)}
.art-big{width:auto;height:auto;padding:22px;border-radius:18px;color:#8A8F9C}
.thumb .art{border-radius:inherit}
`;
  document.head.appendChild(css);
})();
