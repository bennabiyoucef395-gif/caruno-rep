/* Codes « Modèles » du catalogue fournisseur → noms de modèles de voitures.
   Seuls les codes sûrs sont ici ; les autres restent affichés tels quels et sont listés dans
   doc/20-modeles-a-rechercher.csv (à compléter, puis à ajouter ci-dessous).
   Variante : « OCT2 N » = phase 2, « OCT2 O » = phase 1, « JD7 20-23 » = années, « GF4 1.6 » = moteur. */
(function () {
  const M = {};
  // BMW (codes châssis) : [série, code].
  const bmw = { fr: (s, c) => 'BMW Série ' + s + ' (' + c + ')', ar: (s, c) => 'BMW الفئة ' + s + ' (' + c + ')', en: (s, c) => 'BMW ' + s + ' Series (' + c + ')' };
  const bmwX = (n, c) => ({ fr: 'BMW ' + n + ' (' + c + ')', ar: 'BMW ' + n + ' (' + c + ')', en: 'BMW ' + n + ' (' + c + ')' });
  [['1', 'E81 E82 E87 E88 F20 F21'], ['2', 'F22 F23 F45 F46'], ['3', 'E30 E36 E46 E90 E91 E92 E93 F30 F31 F34 F35 G20 G28'], ['4', 'F32 F33 F36 G22'], ['5', 'E28 E34 E39 E60 E61 F07 F10 F11 F18 G30 G31 G38'],
    ['6', 'E63 E64 F06 F12 F13 G32'], ['7', 'E32 E38 E65 E66 F01 F02 F04 G11 G12'], ['8', 'E31']].forEach(([s, codes]) => codes.split(' ').forEach((c) => { M[c] = { fr: bmw.fr(s, c), ar: bmw.ar(s, c), en: bmw.en(s, c) }; }));
  [['X1', 'E84 F48'], ['X2', 'F39'], ['X3', 'E83 F25 G01'], ['iX3', 'G08'], ['X4', 'F26 G02'], ['X5', 'E53 E70 F15 G05'], ['X5 M', 'F85'], ['X6', 'E71 E72 F16 G06'], ['X7', 'G07'], ['Z4', 'E85 E86 E89'], ['M3', 'F80'], ['M4', 'F82'],
    ['Mini', 'R56 F56'], ['Mini Countryman', 'R60 F60'], ['Mini Clubman', 'F54'], ['Mini 5 portes', 'F55']].forEach(([n, codes]) => codes.split(' ').forEach((c) => { M[c] = bmwX(n, c); }));
  // Mercedes-Benz : [classe, codes].
  const mb = (cl, c) => ({ fr: 'Mercedes ' + cl + ' (' + c + ')', ar: 'Mercedes ' + cl + ' (' + c + ')', en: 'Mercedes ' + cl + ' (' + c + ')' });
  [['Classe A', 'W168 W169 W176 W177'], ['Classe B', 'W245 W246 W247'], ['190', 'W201'], ['Classe C', 'W202 W203 W204 W205 W206'], ['Classe C Break', 'S205'], ['Classe C Coupé', 'C205 CL203'],
    ['Classe E', 'W123 W124 W210 W211 W212 W213'], ['Classe E Coupé', 'C207 C238'], ['CLK', 'C209'], ['CLS', 'C218 C219 C257'], ['Classe S', 'W126 W140 W220 W221 W222 W223'], ['Classe S Coupé', 'C217'], ['CL', 'C216'],
    ['Classe S Maybach', 'X222'], ['ML', 'W163 W164'], ['ML / GLE', 'W166'], ['GLE', 'W167 V167'], ['GLE Coupé', 'C292'], ['GL', 'X164'], ['GL / GLS', 'X166'], ['GLS', 'X167'], ['GLK', 'X204'], ['GLC', 'X253'], ['GLC Coupé', 'C253'],
    ['GLA', 'X156'], ['GLB', 'X247'], ['CLA', 'C117'], ['Classe G', 'W460 W461 W463'], ['Classe R', 'W251 V251'], ['SLK', 'R172'], ['SL', 'R230 R231'], ['Vito', 'W638'], ['Vito / Viano', 'W639'], ['Vito / Classe V', 'W447'],
    ['T1', 'W601 W602'], ['Sprinter', 'B901 B903 B904 B906 B907 B910 B901-904']].forEach(([cl, codes]) => codes.split(' ').forEach((c) => { M[c] = mb(cl, c); }));
  // Codes Mercedes sans le « W ».
  ['123', '124', '126', '140', '163', '164', '166', '201', '202', '203', '204', '210', '211', '212', '213', '220', '221', '222', '245', '246', '251', '601', '602', '638'].forEach((n) => { if (M['W' + n]) M[n] = M['W' + n]; });
  // Groupe Volkswagen : codes du fournisseur.
  const same = (n) => ({ fr: n, ar: n, en: n });
  const vag = {
    GF1: 'VW Golf 1', GF2: 'VW Golf 2', GF3: 'VW Golf 3', GF4: 'VW Golf 4', GF5: 'VW Golf 5', GF6: 'VW Golf 6', GF7: 'VW Golf 7', GF8: 'VW Golf 8',
    JD: 'VW Jetta', JD5: 'VW Jetta 5', JD6: 'VW Jetta 6', JD7: 'VW Jetta 7', BR: 'VW Bora', B3: 'VW Passat B3', B4: 'VW Passat B4', B5: 'VW Passat B5', B6: 'VW Passat B6', B7: 'VW Passat B7', B8: 'VW Passat B8',
    PL1: 'VW Polo 1', PL2: 'VW Polo 2', PL3: 'VW Polo 3', PL4: 'VW Polo 4', PL5: 'VW Polo 5', CC1: 'VW Passat CC', CC2: 'VW CC', SC3: 'VW Scirocco 3', SR1: 'VW Sharan 1', SR2: 'VW Sharan 2',
    T2: 'VW Transporter T2', T3: 'VW Transporter T3', T4: 'VW Transporter T4', T5: 'VW Transporter T5', CD2: 'VW Caddy 2', CD3: 'VW Caddy 3', CD4: 'VW Caddy 4', BTL2: 'VW New Beetle', BTL3: 'VW Beetle (5C)',
    GOL: 'VW Gol', GOL1: 'VW Gol', VENTO: 'VW Vento', STN: 'VW Santana', AR1: 'VW Arteon', ATL1: 'VW Atlas / Teramont', ID31: 'VW ID.3', ID41: 'VW ID.4', ID4X1: 'VW ID.4 X', ID4C1: 'VW ID.4 Crozz', ID6C1: 'VW ID.6 Crozz', ID6X1: 'VW ID.6 X',
    A11: 'Audi A1 (8X)', A12: 'Audi A1 (GB)', A31: 'Audi A3 (8L)', A32: 'Audi A3 (8P)', A33: 'Audi A3 (8V)', A34: 'Audi A3 (8Y)', A41: 'Audi A4 (B5)', A42: 'Audi A4 (B6)', A43: 'Audi A4 (B7)', A44: 'Audi A4 (B8)', A45: 'Audi A4 (B9)',
    A51: 'Audi A5 (8T)', A52: 'Audi A5 (F5)', C4A6: 'Audi A6 (C4)', C5A6: 'Audi A6 (C5)', A63: 'Audi A6 (C6)', A64: 'Audi A6 (C7)', A65: 'Audi A6 (C8)', A6L: 'Audi A6 L', A71: 'Audi A7 (4G)', A72: 'Audi A7 (4K)',
    A81: 'Audi A8 (D2)', A82: 'Audi A8 (D3)', A83: 'Audi A8 (D4)', A84: 'Audi A8 (D5)', A100: 'Audi 100', Q21: 'Audi Q2', Q31: 'Audi Q3 (8U)', Q32: 'Audi Q3 (F3)', Q51: 'Audi Q5 (8R)', Q52: 'Audi Q5 (FY)', Q7: 'Audi Q7', Q71: 'Audi Q7 (4L)', Q72: 'Audi Q7 (4M)', Q81: 'Audi Q8',
    TT1: 'Audi TT (8N)', TT2: 'Audi TT (8J)', TT3: 'Audi TT (8S)', OCT1: 'Skoda Octavia 1', OCT2: 'Skoda Octavia 2', OCT3: 'Skoda Octavia 3', OCT4: 'Skoda Octavia 4', FABIA: 'Skoda Fabia', FABIA1: 'Skoda Fabia 1', FABIA2: 'Skoda Fabia 2', FABIA3: 'Skoda Fabia 3',
    SUP2: 'Skoda Superb 2', SUP3: 'Skoda Superb 3', LEON1: 'Seat Leon 1', LEON2: 'Seat Leon 2', LEON3: 'Seat Leon 3', LEON4: 'Seat Leon 4', IBZ2: 'Seat Ibiza 2', IBZ3: 'Seat Ibiza 3', IBZ4: 'Seat Ibiza 4', IBZ5: 'Seat Ibiza 5', ALT1: 'Seat Altea',
    TLD2: 'Seat Toledo 2', TLD3: 'Seat Toledo 3', TLD4: 'Seat Toledo 4', CAY1: 'Porsche Cayenne (9PA)', CAY2: 'Porsche Cayenne (92A)', CAY3: 'Porsche Cayenne (9Y0)',
  };
  Object.entries(vag).forEach(([c, n]) => { M[c] = same(n); });
  const SUF = { O: { fr: 'phase 1', ar: 'المرحلة 1', en: 'phase 1' }, N: { fr: 'phase 2', ar: 'المرحلة 2', en: 'phase 2' } };
  // Un code (avec sa variante éventuelle) → nom du modèle, ou null si le code n'est pas connu.
  function name(code, lang) {
    const c = String(code || '').trim(), l = lang === 'ar' || lang === 'en' ? lang : 'fr';
    if (M[c]) return M[c][l];
    const m = c.match(/^(\S+)\s+(.+)$/);
    if (m && M[m[1]]) return M[m[1]][l] + ' ' + (SUF[m[2]] ? SUF[m[2]][l] : m[2]);
    return null;
  }
  // Texte « Modèles : GF5/JD5/B6 » → « VW Golf 5 / VW Jetta 5 / VW Passat B6 » (codes inconnus gardés).
  function text(models, lang) {
    return String(models || '').split('/').map((x) => x.trim()).filter(Boolean).map((x) => name(x, lang) || x).join(' / ');
  }
  // Recherche « golf 5 » → codes GF5… ; « e90 » marche aussi.
  function codesFor(query) {
    const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s().\-]/g, '');
    const q = n(query);
    if (q.length < 3) return [];
    return Object.keys(M).filter((c) => /^[A-Z]/.test(c) && ['fr', 'ar', 'en'].some((l) => n(M[c][l]).indexOf(q) !== -1));
  }
  window.CAR_MODELS = { name, text, codesFor, known: M };
})();
