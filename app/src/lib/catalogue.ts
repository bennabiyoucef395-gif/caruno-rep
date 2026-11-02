// Catalogue commun CARUNO, hors de Dolibarr : consulté en lecture seule pour suggérer une fiche
// à la création d'une pièce. La pièce créée dans Dolibarr garde l'identifiant catalogue dans ref_ext.
import { Platform } from 'react-native';

export type CatalogueItem = { i: string; r: string; l: string; b: string; o: string; d: string; v: string };

let cache: { url: string; items: CatalogueItem[]; index: string[] } | null = null;

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s.\-/]/g, '');

function absolute(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  if (Platform.OS === 'web' && globalThis.location) return globalThis.location.origin + (url.startsWith('/') ? url : '/' + url);
  return url;
}

export async function loadCatalogue(url: string): Promise<CatalogueItem[]> {
  if (cache && cache.url === url) return cache.items;
  const res = await fetch(absolute(url));
  if (!res.ok) throw new Error('Catalogue ' + res.status);
  const data = await res.json();
  const items: CatalogueItem[] = Array.isArray(data) ? data : data.items || [];
  cache = { url, items, index: items.map((x) => norm(x.r + ' ' + x.o + ' ' + x.l + ' ' + x.b + ' ' + x.d)) };
  return items;
}

// Suggestions : la référence ou l'OEM exacts d'abord, puis le texte qui contient la recherche.
export function suggest(q: string, limit = 8): CatalogueItem[] {
  if (!cache) return [];
  const n = norm(q);
  if (n.length < 2) return [];
  const exact: CatalogueItem[] = [], partial: CatalogueItem[] = [];
  for (let k = 0; k < cache.items.length && exact.length + partial.length < 400; k++) {
    const it = cache.items[k];
    if (norm(it.r) === n || norm(it.o) === n) exact.push(it);
    else if (cache.index[k].includes(n)) partial.push(it);
  }
  return exact.concat(partial).slice(0, limit);
}
