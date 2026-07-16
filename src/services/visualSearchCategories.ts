/**
 * Source unique pour le verrouillage catégorie + sémantique (recherche visuelle).
 * Objectif : une basket → uniquement des chaussures à l’écran (pas de bagues via « Mode & Accessoires »).
 */
import type { AlgoliaHit } from '@/types/product';
import type { SuperCategory, VisualSearchDescriptor } from '@/services/imageSearchGemini';
import {
  BAG_TERMS,
  detectSuperCategory,
  hitTextPassesCategoryFilter,
  normTok,
  SHOE_TERMS,
} from '@/services/imageSearchGemini';

export function normVisualCat(t: string): string {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Liste de validation / fallback strictCategory Gemini */
export const ALL_FIRESTORE_CATEGORIES = [
  'Mode & Accessoires',
  'Mode & Vêtements',
  'Bébé & Enfant',
  'Électroniques',
  'Beauté & Santé',
  'Chaussure homme',
  'Sac a main',
  'Cadeau',
  'Nuisette sexy pour femme',
  'Maison & Jardin',
  'Automobile et Moto',
  'Adulte et enfant',
  'Sacs à dos',
  'Maisons et jardin',
  'Machines Industrielles',
  'Électronique',
  'Sacs',
  'Chaussures femmes',
  'Emballage',
  'Robe pour femme',
  'Cosmétiques',
  'Modes',
  'Sacs cadeaux',
  'Fourniture de bureau',
  'Matériel scolaire',
  'Sac de voyage',
  'Matériel de nettoyage',
  'Battery lithium',
  'Import Global',
  '+18 ans',
  '+ 18 ans',
];

const CATEGORY_ALIASES: Record<string, string[]> = {
  chaussure: ['Mode & Accessoires', 'Chaussure homme', 'Chaussures femmes'],
  chaussures: ['Mode & Accessoires', 'Chaussure homme', 'Chaussures femmes'],
  shoe: ['Mode & Accessoires', 'Chaussure homme', 'Chaussures femmes'],
  shoes: ['Mode & Accessoires', 'Chaussure homme', 'Chaussures femmes'],
  sneaker: ['Mode & Accessoires', 'Chaussure homme', 'Chaussures femmes'],
  sneakers: ['Mode & Accessoires', 'Chaussure homme', 'Chaussures femmes'],
  basket: ['Mode & Accessoires', 'Chaussure homme', 'Chaussures femmes'],
  baskets: ['Mode & Accessoires', 'Chaussure homme', 'Chaussures femmes'],
  escarpin: ['Chaussures femmes', 'Mode & Accessoires'],
  sandale: ['Chaussures femmes', 'Chaussure homme', 'Mode & Accessoires'],
  botte: ['Chaussures femmes', 'Chaussure homme', 'Mode & Accessoires'],
  mocassin: ['Chaussure homme', 'Mode & Accessoires'],
  sac: ['Mode & Accessoires', 'Sac a main', 'Sacs à dos', 'Sacs'],
  bag: ['Mode & Accessoires', 'Sac a main', 'Sacs à dos', 'Sacs'],
  handbag: ['Sac a main', 'Mode & Accessoires'],
  backpack: ['Sacs à dos', 'Mode & Accessoires'],
  pochette: ['Sac a main', 'Mode & Accessoires'],
  bijou: ['Mode & Accessoires'],
  bague: ['Mode & Accessoires'],
  collier: ['Mode & Accessoires'],
  bracelet: ['Mode & Accessoires'],
  montre: ['Mode & Accessoires'],
  lunettes: ['Mode & Accessoires'],
  ceinture: ['Mode & Accessoires'],
  robe: ['Mode & Vêtements', 'Robe pour femme', 'Adulte et enfant', 'Bébé & Enfant'],
  dress: ['Mode & Vêtements', 'Robe pour femme', 'Adulte et enfant'],
  chemise: ['Mode & Vêtements', 'Adulte et enfant'],
  pantalon: ['Mode & Vêtements', 'Adulte et enfant'],
  jupe: ['Mode & Vêtements', 'Adulte et enfant'],
  veste: ['Mode & Vêtements', 'Adulte et enfant'],
  jogging: ['Mode & Vêtements', 'Adulte et enfant', 'Bébé & Enfant'],
  tshirt: ['Mode & Vêtements', 'Adulte et enfant'],
  costume: ['Mode & Vêtements', 'Adulte et enfant'],
  vetement: ['Mode & Vêtements', 'Adulte et enfant'],
  lingerie: ['Nuisette sexy pour femme', 'Mode & Vêtements'],
  nuisette: ['Nuisette sexy pour femme'],
  bebe: ['Bébé & Enfant', 'Adulte et enfant'],
  enfant: ['Bébé & Enfant', 'Adulte et enfant'],
  jouet: ['Bébé & Enfant'],
  shampoing: ['Beauté & Santé', 'Cosmétiques'],
  creme: ['Beauté & Santé', 'Cosmétiques'],
  parfum: ['Beauté & Santé', 'Cosmétiques'],
  maquillage: ['Beauté & Santé', 'Cosmétiques'],
  cosmetique: ['Cosmétiques', 'Beauté & Santé'],
  soin: ['Beauté & Santé', 'Cosmétiques'],
  vase: ['Maison & Jardin', 'Maisons et jardin'],
  decoration: ['Maison & Jardin', 'Maisons et jardin'],
  meuble: ['Maison & Jardin', 'Maisons et jardin'],
  cuisine: ['Maison & Jardin', 'Maisons et jardin'],
  telephone: ['Électroniques', 'Électronique'],
  ecouteur: ['Électroniques', 'Électronique'],
  chargeur: ['Électroniques', 'Électronique'],
  voiture: ['Automobile et Moto'],
  moto: ['Automobile et Moto'],
};

const SHOE_RAYONS = new Set<string>(['Chaussure homme', 'Chaussures femmes']);
const BAG_RAYONS = new Set<string>([
  'Sac a main',
  'Sacs à dos',
  'Sacs',
  'Sacs cadeaux',
  'Sac de voyage',
]);

const SUPER_NARROW: Record<NonNullable<SuperCategory>, string[]> = {
  shoes: ['Chaussure homme', 'Chaussures femmes'],
  bags: ['Sac a main', 'Sacs à dos', 'Sacs', 'Sacs cadeaux', 'Sac de voyage'],
  clothing: ['Mode & Vêtements', 'Robe pour femme', 'Adulte et enfant', 'Bébé & Enfant'],
  beauty: ['Beauté & Santé', 'Cosmétiques'],
  home: ['Maison & Jardin', 'Maisons et jardin'],
  electronics: ['Électroniques', 'Électronique'],
  food: [],
  accessories: ['Mode & Accessoires'],
};

const SUPER_BROAD: Record<NonNullable<SuperCategory>, string[]> = {
  // Inclut « Modes » (souvent utilisé dans Firestore à la place de Mode & Accessoires).
  shoes: ['Chaussure homme', 'Chaussures femmes', 'Mode & Accessoires', 'Modes'],
  bags: ['Sac a main', 'Sacs à dos', 'Sacs', 'Sacs cadeaux', 'Sac de voyage', 'Mode & Accessoires'],
  clothing: ['Mode & Vêtements', 'Robe pour femme', 'Adulte et enfant', 'Bébé & Enfant'],
  beauty: ['Beauté & Santé', 'Cosmétiques'],
  home: ['Maison & Jardin', 'Maisons et jardin'],
  electronics: ['Électroniques', 'Électronique'],
  food: [],
  accessories: ['Mode & Accessoires'],
};

export type VisualSearchCategoryPlan = {
  algoliaNarrow: string[];
  algoliaBroad: string[];
  semanticLock: SuperCategory;
  forbidUnfilteredSearch: boolean;
};

function descriptorBlob(desc: VisualSearchDescriptor): string {
  return normTok(
    [...desc.labels, ...desc.keywords, desc.searchQuery].join(' '),
  );
}

function blobMatchesAnyTerms(blob: string, terms: readonly string[]): boolean {
  return terms.some((term) => {
    const nt = normTok(term);
    if (nt.length < 3) return false;
    return blob.includes(nt);
  });
}

export function inferSuperCategoryFromCategoryName(
  categoryName: string | undefined | null,
): SuperCategory {
  const n = normVisualCat(String(categoryName || ''));
  if (!n) return null;
  if (n.includes('chaussure')) return 'shoes';
  if (n.includes('sac')) return 'bags';
  if (n.includes('robe') || n.includes('vetement') || n.includes('nuisette')) return 'clothing';
  if (n.includes('beaute') || n.includes('cosmetique')) return 'beauty';
  if (n.includes('maison') || n.includes('jardin')) return 'home';
  if (n.includes('electronique')) return 'electronics';
  if (n.includes('accessoire') || n.includes('mode & accessoires')) return 'accessories';
  return null;
}

function collectAliasCategories(desc: VisualSearchDescriptor): Set<string> {
  const aliasResult = new Set<string>();
  const tokens = [...desc.labels, ...desc.keywords, ...desc.searchQuery.split(/\s+/)]
    .map(normVisualCat)
    .filter(Boolean);
  const entries = Object.entries(CATEGORY_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const token of tokens) {
    for (const [alias, cats] of entries) {
      if (token.includes(alias) || alias.includes(token)) {
        cats.forEach((c) => aliasResult.add(c));
      }
    }
  }
  return aliasResult;
}

function refineSuperFromAliases(
  det: SuperCategory,
  aliasSet: Set<string>,
  blob: string,
): SuperCategory {
  const hasShoeRayon = [...aliasSet].some((c) => SHOE_RAYONS.has(c));
  const hasBagRayon = [...aliasSet].some((c) => BAG_RAYONS.has(c));
  const shoeBlob = blobMatchesAnyTerms(blob, SHOE_TERMS);
  const bagBlob = blobMatchesAnyTerms(blob, BAG_TERMS);

  if (hasShoeRayon && !hasBagRayon) return 'shoes';
  if (hasBagRayon && !hasShoeRayon) return 'bags';
  if (shoeBlob && !bagBlob) return 'shoes';
  if (bagBlob && !shoeBlob) return 'bags';
  return det;
}

/**
 * Construit le plan : passe 1 / passe 2 Algolia + verrou sémantique côté client.
 */
export function buildVisualSearchCategoryPlan(
  desc: VisualSearchDescriptor,
  directExact: AlgoliaHit | null,
): VisualSearchCategoryPlan {
  if (directExact?.categoryName) {
    const cn = String(directExact.categoryName).trim();
    const inferred = inferSuperCategoryFromCategoryName(cn);
    const lock: SuperCategory = inferred ?? desc.detectedSuperCategory ?? 'accessories';
    return {
      algoliaNarrow: [cn],
      algoliaBroad: [cn],
      semanticLock: lock,
      forbidUnfilteredSearch: true,
    };
  }

  const aliasSet = collectAliasCategories(desc);
  const blob = descriptorBlob(desc);

  let det: SuperCategory =
    desc.detectedSuperCategory ?? detectSuperCategory(desc.labels, desc.keywords, desc.searchQuery);

  det = refineSuperFromAliases(det, aliasSet, blob);

  if (det) {
    const narrowList = SUPER_NARROW[det];
    const broadList = SUPER_BROAD[det];
    if (narrowList.length > 0 || broadList.length > 0) {
      const narrow = narrowList.length ? [...narrowList] : [...broadList];
      const broad = [...new Set([...(broadList.length ? broadList : narrow), ...narrow])];
      return {
        algoliaNarrow: narrow,
        algoliaBroad: broad.filter(Boolean),
        semanticLock: det,
        forbidUnfilteredSearch: true,
      };
    }
  }

  if (aliasSet.size > 0) {
    const arr = Array.from(aliasSet);
    return {
      algoliaNarrow: arr,
      algoliaBroad: arr,
      semanticLock: null,
      forbidUnfilteredSearch: true,
    };
  }

  if (desc.strictCategory) {
    const sc = String(desc.strictCategory).trim();
    const exact = ALL_FIRESTORE_CATEGORIES.find((c) => normVisualCat(c) === normVisualCat(sc));
    if (exact) {
      const lock = inferSuperCategoryFromCategoryName(exact) ?? null;
      const narrow = [exact];
      const broad =
        lock && SUPER_BROAD[lock]?.length
          ? Array.from(new Set([exact, ...SUPER_BROAD[lock]]))
          : narrow;
      return {
        algoliaNarrow: narrow,
        algoliaBroad: broad,
        semanticLock: lock,
        forbidUnfilteredSearch: true,
      };
    }
  }

  return {
    algoliaNarrow: [],
    algoliaBroad: [],
    semanticLock: null,
    forbidUnfilteredSearch: true,
  };
}

export function hitMatchesFirestoreCategories(
  hit: Pick<AlgoliaHit, 'categoryName'>,
  allowed: string[],
): boolean {
  if (!allowed.length) return true;
  const hitCat = normVisualCat(String(hit.categoryName || ''));
  // Beaucoup de fiches n’ont pas categoryName dans l’index : ne pas les exclure ici
  // (le verrou sémantique décide ensuite).
  if (!hitCat) return true;
  return allowed.some((c) => normVisualCat(c) === hitCat);
}

export function hitPassesVisualSemanticLock(
  hit: Pick<AlgoliaHit, 'name' | 'categoryName' | 'description' | 'subCategory'>,
  lock: SuperCategory,
  desc: VisualSearchDescriptor,
): boolean {
  if (!lock) return true;
  const text = normTok(
    `${hit.name ?? ''} ${hit.categoryName ?? ''} ${hit.description ?? ''} ${hit.subCategory ?? ''}`,
  );
  const primary = [...desc.labels, ...desc.keywords].map(normTok).filter((t) => t.length >= 2);
  return hitTextPassesCategoryFilter(text, lock, primary);
}

export function visualSearchPrimaryTokens(desc: VisualSearchDescriptor): string[] {
  return [...desc.labels, ...desc.keywords].map(normTok).filter((t) => t.length >= 2);
}
