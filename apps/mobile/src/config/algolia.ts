import algoliasearch from 'algoliasearch/lite';
import type { AlgoliaHit } from '@/types/product';

const APP_ID =
  process.env.EXPO_PUBLIC_ALGOLIA_APP_ID ?? 'ZYRHOXK3WR';

const SEARCH_KEY =
  process.env.EXPO_PUBLIC_ALGOLIA_SEARCH_KEY ?? '28b16aa67095fa844e0ef397d15b7a66';

export const algoliaClient = algoliasearch(APP_ID, SEARCH_KEY);

/** Index principal des produits */
export const productsIndex = algoliaClient.initIndex('products');

const VISUAL_ALGOLIA_BASE: Record<string, unknown> = {
  typoTolerance: true,
  ignorePlurals: true,
  removeStopWords: ['fr'],
};

function mergeCategoryNameFilters(
  options: Record<string, unknown>,
  strictCats: string[],
): Record<string, unknown> {
  const finalOptions = { ...options };
  if (strictCats.length === 0) return finalOptions;

  const parts = strictCats.map((c) => {
    const safe = c.replace(/'/g, "\\'");
    return `categoryName:'${safe}'`;
  });
  const catFilter = parts.length === 1 ? parts[0] : `(${parts.join(' OR ')})`;

  finalOptions.filters = finalOptions.filters
    ? `(${finalOptions.filters}) AND ${catFilter}`
    : catFilter;
  return finalOptions;
}

/**
 * Recherche Algolia avec filtre strict sur categoryName (facettes indexées).
 *
 * @param query         texte de recherche
 * @param options       options Algolia supplémentaires
 * @param strictCats    une ou plusieurs valeurs exactes de categoryName Firestore
 *                      (filtre OR entre elles, obligatoire si fourni)
 */
export async function searchVisualAlgolia(
  query: string,
  options: Record<string, unknown> = {},
  strictCats?: string | string[],
) {
  const cats = (Array.isArray(strictCats) ? strictCats : [strictCats])
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  const mergedOpts = mergeCategoryNameFilters({ ...VISUAL_ALGOLIA_BASE, ...options }, cats);
  return productsIndex.search(query, mergedOpts);
}

/**
 * Double passe type marketplace : rayons précis d’abord, puis élargissement
 * (ex. Chaussure homme / femme → + Mode & Accessoires) sans jamais retirer le filtre facet.
 */
export async function searchVisualAlgoliaTiered(
  query: string,
  options: Record<string, unknown>,
  narrowCats: string[],
  broadCats: string[],
  minHitsBeforeBroaden = 6,
): Promise<AlgoliaHit[]> {
  const baseQ = query.trim() || '*';
  const opts = { ...VISUAL_ALGOLIA_BASE, ...options };

  const run = async (cats: string[]) => {
    const merged = mergeCategoryNameFilters({ ...opts }, cats);
    const r = await productsIndex.search<AlgoliaHit>(baseQ, merged);
    return r.hits;
  };

  const uniqKey = (a: string[]) => a.join('\u0001');
  const same =
    narrowCats.length === broadCats.length && uniqKey(narrowCats) === uniqKey(broadCats);

  if (narrowCats.length === 0) {
    const r = await productsIndex.search<AlgoliaHit>(baseQ, opts);
    return r.hits;
  }

  let hits = await run(narrowCats);
  if (!same && hits.length < minHitsBeforeBroaden && broadCats.length) {
    const h2 = await run(broadCats);
    const byId = new Map<string, AlgoliaHit>();
    for (const h of hits) byId.set(String(h.objectID), h);
    for (const h of h2) {
      const id = String(h.objectID);
      if (!byId.has(id)) byId.set(id, h);
    }
    hits = Array.from(byId.values());
  }
  return hits;
}

/**
 * Dernier recours : recherche texte sans filtre categoryName, puis filtrage côté app (sémantique).
 * Utile quand le produit existe mais categoryName est vide ou différent d’Algolia.
 */
export async function searchVisualAlgoliaRescue(
  query: string,
  hitsPerPage = 80,
): Promise<AlgoliaHit[]> {
  const baseQ = query.trim() || '*';
  const r = await productsIndex.search<AlgoliaHit>(baseQ, {
    ...VISUAL_ALGOLIA_BASE,
    hitsPerPage,
  });
  return r.hits;
}
