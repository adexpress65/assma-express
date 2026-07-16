/**
 * Filtres Algolia « hard » pour la recherche visuelle (alignés sur les facettes indexées).
 * Les attributs category / categoryName / subCategory doivent exister et être déclarés
 * en attributesForFaceting dans le dashboard Algolia.
 */
import type { AlgoliaHit } from '@/types/product';
import type { SuperCategory } from './imageSearchGemini';

export type AlgoliaLiteIndex = {
  search: <T>(
    query: string,
    opts?: Record<string, unknown>,
  ) => Promise<{ hits: T[] }>;
};

/** Score minimal garantissant le match URL exact en tête de liste (tri descendant). */
export const DIRECT_EXACT_TOP_SCORE = 999_999;

const FACET_ATTRS = ['categoryName', 'subCategory', 'category'] as const;

function quoteFacetValue(val: string): string {
  const t = val.trim();
  if (!t) return '""';
  if (/^[\w.-]+$/.test(t)) return t;
  return `"${t.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Libellés « stricts » (évite d’élargir à toute la Mode si une facette Chaussures existe). */
const STRICT_FACET_VALUES: Record<NonNullable<SuperCategory>, string[]> = {
  shoes: [
    'Chaussures',
    'Chaussure',
    'Basket',
    'Baskets',
    'Sneakers',
    'Tennis',
    'Footwear',
    'Chaussures de sport',
  ],
  clothing: ['Vêtements', 'Vetements', 'Robe', 'Robes', 'Prêt-à-porter', 'Pret a porter'],
  bags: ['Sacs', 'Maroquinerie', 'Bagages', 'Sac'],
  beauty: ['Cosmétique', 'Cosmetique', 'Beauté', 'Soin', 'Soins', 'Hygiène'],
  home: ['Maison', 'Maisons et jardin', 'Décoration', 'Jardin', 'Cuisine'],
  electronics: ['Électroniques', 'Electroniques', 'High-tech', 'Informatique'],
  food: ['Alimentaire', 'Epicerie', 'Boissons'],
  accessories: ['Bijoux', 'Accessoires', 'Montres', 'Lunettes'],
};

/** Valeurs additionnelles si le catalogue regroupe sous des rayons larges. */
const BROAD_FACET_VALUES: Record<NonNullable<SuperCategory>, string[]> = {
  shoes: ['Mode & Accessoires', 'Modes', 'Mode', 'Fashion'],
  clothing: ['Mode & Accessoires', 'Modes', 'Mode', 'Fashion'],
  bags: ['Mode & Accessoires', 'Modes', 'Mode'],
  beauty: ['Parfumerie', 'Pharmacie'],
  home: ['Art de la table', 'Literie'],
  electronics: ['Téléphonie', 'Telephonie'],
  food: ['Grossiste alimentaire'],
  accessories: ['Mode & Accessoires', 'Modes', 'Mode'],
};

function valuesToFilterString(values: Iterable<string>): string | undefined {
  const uniq = Array.from(new Set(Array.from(values).map((v) => v.trim()).filter(Boolean)));
  if (!uniq.length) return undefined;
  const parts: string[] = [];
  for (const v of uniq) {
    const q = quoteFacetValue(v);
    for (const attr of FACET_ATTRS) {
      parts.push(`${attr}:${q}`);
    }
  }
  return `(${parts.join(' OR ')})`;
}

/**
 * Filtre obligatoire Algolia : au moins une facette parmi category / categoryName / subCategory.
 * @param tier strict = rayons précis ; broad = ajoute Mode & Accessoires, etc.
 */
export function buildHardAlgoliaCategoryFilters(
  superCat: SuperCategory,
  geminiFacetHint?: string | null,
  tier: 'strict' | 'broad' = 'strict',
): string | undefined {
  const set = new Set<string>();
  if (geminiFacetHint?.trim()) set.add(geminiFacetHint.trim());
  if (superCat) {
    for (const v of STRICT_FACET_VALUES[superCat]) set.add(v);
    if (tier === 'broad') {
      for (const v of BROAD_FACET_VALUES[superCat]) set.add(v);
    }
  }
  return valuesToFilterString(set);
}

const ALGOLIA_VISUAL_SEARCH_OPTS = {
  hitsPerPage: 48,
  typoTolerance: true,
  ignorePlurals: true,
  removeStopWords: ['fr'] as const,
};

/**
 * Double passe : filtres stricts → filtres élargis → sans filtre (fallback).
 */
export async function fetchAlgoliaHitsForVisualSearch(
  index: AlgoliaLiteIndex,
  query: string,
  superCat: SuperCategory,
  facetHint?: string | null,
  strictCategory?: string | null,
): Promise<AlgoliaHit[]> {
  let strict = buildHardAlgoliaCategoryFilters(superCat, facetHint, 'strict');
  let broad = buildHardAlgoliaCategoryFilters(superCat, facetHint, 'broad');
  const baseQ = query.trim() || '*';

  if (strictCategory) {
    const safeCat = strictCategory.replace(/'/g, "\\'");
    const catFilter = `category:'${safeCat}' OR categoryName:'${safeCat}'`;
    strict = strict ? `(${strict}) AND (${catFilter})` : catFilter;
    broad = broad ? `(${broad}) AND (${catFilter})` : catFilter;
  }

  const run = async (filters?: string) => {
    if (!filters) {
      if (strictCategory) {
        const safeCat = strictCategory.replace(/'/g, "\\'");
        const catFilter = `category:'${safeCat}' OR categoryName:'${safeCat}'`;
        const r = await index.search<AlgoliaHit>(baseQ, { ...ALGOLIA_VISUAL_SEARCH_OPTS, filters: catFilter });
        return r.hits;
      }
      const r = await index.search<AlgoliaHit>(baseQ, ALGOLIA_VISUAL_SEARCH_OPTS);
      return r.hits;
    }
    try {
      const r = await index.search<AlgoliaHit>(baseQ, { ...ALGOLIA_VISUAL_SEARCH_OPTS, filters });
      return r.hits;
    } catch {
      return [];
    }
  };

  let hits: AlgoliaHit[] = [];
  if (strict) hits = await run(strict);
  if (hits.length < 4 && broad && broad !== strict) {
    const h2 = await run(broad);
    if (h2.length > hits.length) hits = h2;
  }
  if (hits.length < 4) {
    const h3 = await run(undefined);
    if (h3.length > hits.length) hits = h3;
  }
  return hits;
}

export function pinDirectMatchFirst(hits: AlgoliaHit[], directId: string | null): AlgoliaHit[] {
  if (!directId) return hits;
  const idx = hits.findIndex((h) => h.objectID === directId && h.isExactImageMatch);
  if (idx <= 0) return hits;
  const next = [...hits];
  const [row] = next.splice(idx, 1);
  return [row, ...next];
}
