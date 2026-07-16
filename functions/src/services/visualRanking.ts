import type { DocumentData } from "firebase-admin/firestore";
import type { ImageVisualFingerprint } from "./clipService";
import { compareVisualFingerprints, fetchFingerprintFromImageUrl } from "./clipService";
import { cosineSimilarity } from "./visualSearchCore";
import { VISUAL_SEARCH_RECALL_LOCK } from "./visualSearchRecallLock";

/** Seuil minimal cosine requête → produit (backend, filtre bruit). Rappel e‑commerce : légèrement bas pour ne pas perdre le bon SKU. */
export const DEFAULT_MIN_SIMILARITY = 0.23;

/** Deux produits avec cosinus ≥ ce seuil sont candidats « quasi identiques » (soumis au contrôle catégorie). */
export const DEFAULT_DUPLICATE_SIMILARITY = 0.97;

/**
 * Ancienne logique : retourner `results: []` si le #1 était < seuil → trop strict (0 résultat fréquent).
 * Désormais : seuil informatif uniquement (`metadata.confidence`). Surcharge : `VISUAL_SEARCH_CONFIDENCE_GATE_MIN`.
 */
export const CONFIDENCE_GATE_MIN_TOP_SIMILARITY = 0.3;

/** Lit le plancher « confiance faible » (défaut 0,3). Ne vide plus la réponse — sert au libellé `metadata.confidence`. */
export function getConfidenceGateMin(): number {
  const n = Number(process.env.VISUAL_SEARCH_CONFIDENCE_GATE_MIN);
  if (Number.isFinite(n) && n >= 0.15 && n <= 0.95) return n;
  return CONFIDENCE_GATE_MIN_TOP_SIMILARITY;
}

/** Si le meilleur cosinus est dans [CONFIDENCE_GATE, ADAPTIVE_WEAK_TOP) : élargir le pool vectoriel. */
export const ADAPTIVE_WEAK_TOP_SIMILARITY = 0.48;

/** Max d’embeddings produits lus pour le dédoublonnage visuel (réduit les lectures Firestore). */
export const MAX_EMBEDDING_DEDUP_FETCH = 18;

/**
 * Pondérations par défaut (facilement ajustables).
 * Cosinus dominant (~70 %) — popularité / prix atténués.
 */
export const RANKING_WEIGHTS = {
  cosine: 0.7,
  popularity: 0.12,
  price: 0.1,
  category: 0.08,
} as const;

export type RankingWeights = typeof RANKING_WEIGHTS;

const STOPWORDS = new Set(
  [
    "le",
    "la",
    "les",
    "un",
    "une",
    "des",
    "de",
    "du",
    "et",
    "ou",
    "pour",
    "avec",
    "sans",
    "sur",
    "dans",
    "the",
    "a",
    "an",
    "and",
    "or",
    "for",
    "with",
    "from",
    "new",
    "hot",
    "sale",
  ],
);

export type RankableHit = {
  productId: string;
  /** Similarité cosinus requête CLIP ↔ image produit (0–1). */
  cosine: number;
  price: number;
  soldCount: number;
  rating: number;
  categoryName: string | null;
  /** Utile pour alignement intent / dédup. */
  categoryId: string | null;
  name: string | null;
  imageUrl: string | null;
};

export type ScoredHit = RankableHit & {
  compositeScore: number;
  components: {
    cosineTerm: number;
    popularityTerm: number;
    priceTerm: number;
    categoryTerm: number;
    /** Similarité couleur / forme (histogramme + aspect) si disponible. */
    colorTerm?: number;
    shapeTerm?: number;
    /** Score 0,7·CLIP + 0,2·couleur + 0,1·forme (+ boosts). */
    visualBlend?: number;
  };
};

export type DiversifyOptions = {
  /** Défaut : `DEFAULT_DUPLICATE_SIMILARITY` (0,97). */
  duplicateThreshold?: number;
  /**
   * Défaut : true. Si true : ne pas fusionner deux fiches quasi identiques visuellement
   * lorsque les rayons catalogue diffèrent nettement (variantes légitimes).
   */
  categoryAwareDedup?: boolean;
  /**
   * Les N premiers résultats (liste déjà triée par score) ne subissent pas le dédoublonnage
   * embedding / URL (réservé aux têtes de liste type « même article »).
   */
  protectTopK?: number;
  /**
   * Au‑dessus de ce cosinus : ne jamais retirer un candidat pour cause de dédoublonnage embedding / URL.
   * Défaut : 0,9.
   */
  neverRemoveEmbeddingCosineAbove?: number;
};

export type ScoreContext = {
  minPrice: number;
  maxPrice: number;
  maxSold: number;
  categoryHint?: string | null;
  intentKeywords: string[];
  weights: RankingWeights;
};

/**
 * Mots-clés d’intention : hint texte + labels client (Gemini, etc.), normalisés.
 */
export function extractIntentKeywords(
  ...sources: (string | null | undefined)[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const src of sources) {
    if (!src || typeof src !== "string") continue;
    const normalized = src
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\u00c0-\u024f\s-]/gi, " ");
    const parts = normalized.split(/[\s,/|+]+/).filter(Boolean);
    for (let p of parts) {
      p = p.replace(/^-+|-+$/g, "").trim();
      if (p.length < 3 || STOPWORDS.has(p)) continue;
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
  }
  return out.slice(0, 24);
}

/**
 * Score d’alignement intent 0–1 : recouvrement de tokens + bonus sous-chaîne longue.
 */
export function computeIntentCategoryTerm(
  p: RankableHit,
  intentKeywords: string[],
): number {
  if (!intentKeywords.length) return 0;

  const cat = (p.categoryName || "").toLowerCase();
  const nm = (p.name || "").toLowerCase();
  const blob = `${cat} ${nm}`;

  let hits = 0;
  for (const kw of intentKeywords) {
    if (kw.length >= 3 && blob.includes(kw)) hits += 1;
  }

  const overlap = hits / intentKeywords.length;

  let prefixBonus = 0;
  const sorted = [...intentKeywords].sort((a, b) => b.length - a.length);
  const longest = sorted[0];
  if (longest && longest.length >= 6 && blob.includes(longest)) {
    prefixBonus = 0.15;
  }

  return Math.min(1, overlap * 0.85 + prefixBonus);
}

/** Clé de rayon pour comparer deux fiches (dédoublonnage prudent). */
export function normalizeCategoryKey(
  categoryName: string | null | undefined,
): string {
  if (!categoryName || typeof categoryName !== "string") return "";
  return categoryName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 56);
}

/**
 * Même famille catalogue → on autorise le dédoublonnage visuel strict.
 * Rayons différents → on garde les deux comme variantes possibles.
 */
export function categoriesCompatibleForDedup(
  a: RankableHit,
  b: RankableHit,
): boolean {
  const ka = normalizeCategoryKey(a.categoryName);
  const kb = normalizeCategoryKey(b.categoryName);
  if (!ka || !kb) return true;
  if (ka === kb) return true;
  if (ka.includes(kb) || kb.includes(ka)) return true;
  const ta = new Set(ka.split(/\s+/).filter((t) => t.length > 2));
  const tb = new Set(kb.split(/\s+/).filter((t) => t.length > 2));
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter += 1;
  if (inter >= 2) return true;
  return false;
}

/**
 * Filtre les résultats sous un seuil de similarité visuelle.
 */
export function filterResults(
  items: RankableHit[],
  minSimilarity = DEFAULT_MIN_SIMILARITY,
): RankableHit[] {
  return items.filter((x) => x.cosine >= minSimilarity);
}

/**
 * Filtre par similarité minimale, mais conserve toujours les 3 premiers résultats
 * du classement vectoriel brut (ordre Pinecone / Firestore), même sous le seuil.
 */
export function filterResultsPreservingVectorTop3(
  items: RankableHit[],
  minSimilarity: number,
  vectorTop3ProductIds: readonly string[],
): RankableHit[] {
  const top3 = new Set(vectorTop3ProductIds.slice(0, 3));
  return items.filter(
    (x) => x.cosine >= minSimilarity || top3.has(x.productId),
  );
}

/** Ne jamais filtrer les résultats avec une similarité vectorielle strictement supérieure à ce seuil. */
export const HIGH_SIMILARITY_NEVER_FILTER = 0.9;

/** @see VISUAL_SEARCH_RECALL_LOCK.vectorHeadCategoryExempt — ne pas baisser sans QA. */
export const VECTOR_HEAD_CATEGORY_EXEMPT =
  VISUAL_SEARCH_RECALL_LOCK.vectorHeadCategoryExempt;

/**
 * Filtre similarité + intention / catégorie :
 * - les N premiers hits vectoriels sont toujours conservés (ordre figé ailleurs) ;
 * - toute ligne avec cosinus > `HIGH_SIMILARITY_NEVER_FILTER` est conservée ;
 * - le filtre d’intention / `categoryHint` ne s’applique qu’aux rangs ≥ N (index 0-based dans `vectorHitsOrdered`).
 */
export function filterRankablesPreservingHeadAndHighSimilarity(
  items: RankableHit[],
  vectorHitsOrdered: { productId: string }[],
  minSimilarity: number,
  categoryHint: string | null | undefined,
  intentKeywordSources: string[],
): RankableHit[] {
  const headN = Math.min(VECTOR_HEAD_CATEGORY_EXEMPT, vectorHitsOrdered.length);
  const topHead = new Set(vectorHitsOrdered.slice(0, headN).map((h) => h.productId));
  const indexById = new Map<string, number>();
  vectorHitsOrdered.forEach((h, i) => indexById.set(h.productId, i));

  const intentKeywords = extractIntentKeywords(
    categoryHint ?? "",
    ...intentKeywordSources.map((x) => String(x)),
  );

  return items.filter((r) => {
    if (r.cosine > HIGH_SIMILARITY_NEVER_FILTER) return true;
    if (topHead.has(r.productId)) return true;
    if (r.cosine < minSimilarity) return false;

    const idx = indexById.get(r.productId);
    if (idx !== undefined && idx < headN) return true;

    return passesCategoryIntentFilter(r, intentKeywords, categoryHint);
  });
}

function passesCategoryIntentFilter(
  r: RankableHit,
  intentKeywords: string[],
  categoryHint: string | null | undefined,
): boolean {
  if (intentKeywords.length > 0) {
    return (
      computeIntentCategoryTerm(r, intentKeywords) >=
      VISUAL_SEARCH_RECALL_LOCK.intentCategoryTermMin
    );
  }
  const hint = (categoryHint || "").trim();
  if (hint.length < 3) return true;
  return legacyCategoryHintTerm(r, categoryHint) >= 0.5;
}

/**
 * Boosts additifs sur le score composite (après pondération e‑commerce / visuel).
 * Si cosinus > 0,97 : +0,7 (exclusif du palier 0,92).
 * Sinon si cosinus > 0,92 : +0,3.
 */
export function applyCosineSimilarityBoost(
  compositeScore: number,
  cosine: number,
): number {
  let s = clamp01(compositeScore);
  if (cosine > 0.97) return clamp01(s + 0.7);
  if (cosine > 0.92) return clamp01(s + 0.3);
  return s;
}

function clamp01(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

/**
 * Score composite e-commerce :
 * - cosinus (~70 % par défaut)
 * - popularité / prix atténués
 * - intention : mots-clés (hint + métadonnées image)
 */
export function computeScore(p: RankableHit, ctx: ScoreContext): ScoredHit["components"] {
  const cosineTerm = clamp01(p.cosine);

  let popularityTerm = 0;
  if (ctx.maxSold > 0 && p.soldCount > 0) {
    popularityTerm = clamp01(
      Math.log(1 + p.soldCount) / Math.log(1 + ctx.maxSold),
    );
  } else {
    popularityTerm = clamp01((p.rating || 0) / 5);
  }

  let priceTerm = 0.5;
  if (ctx.maxPrice > ctx.minPrice && ctx.minPrice >= 0) {
    priceTerm =
      1 -
      (p.price - ctx.minPrice) / (ctx.maxPrice - ctx.minPrice + 1e-9);
    priceTerm = clamp01(priceTerm);
  }

  const categoryTerm =
    ctx.intentKeywords.length > 0
      ? computeIntentCategoryTerm(p, ctx.intentKeywords)
      : legacyCategoryHintTerm(p, ctx.categoryHint);

  return { cosineTerm, popularityTerm, priceTerm, categoryTerm };
}

/** Repli si aucun mot-clé explicite : ancien comportement « includes » sur le hint brut. */
export function legacyCategoryHintTerm(
  p: RankableHit,
  categoryHint: string | null | undefined,
): number {
  const hint = (categoryHint || "").trim().toLowerCase();
  if (hint.length < 3) return 0;
  const cat = (p.categoryName || "").toLowerCase();
  const nm = (p.name || "").toLowerCase();
  const token =
    hint.split(/\s+/).find((t) => t.length >= 4) || hint.slice(0, 48);
  if (token && (cat.includes(token) || nm.includes(token))) return 1;
  return 0;
}

export function applyWeights(
  components: ScoredHit["components"],
  weights: RankingWeights = RANKING_WEIGHTS,
): number {
  return (
    weights.cosine * components.cosineTerm +
    weights.popularity * components.popularityTerm +
    weights.price * components.priceTerm +
    weights.category * components.categoryTerm
  );
}

export type ScoreRankableOptions = {
  categoryHint?: string | null;
  /** Mots-clés additionnels (ex. labels issus d’analyse d’image côté client). */
  intentKeywords?: string[];
  weights?: Partial<RankingWeights>;
  /**
   * IDs des hits vectoriels figés (top 3) : terme « catégorie / intention » neutre pour ne pas les pénaliser
   * avant agrégation du score (le classement tête reste piloté par l’ordre vectoriel).
   */
  frozenCategoryNeutralIds?: Set<string>;
};

/**
 * Attache un score composite à chaque ligne (après filtre similarité).
 */
export function scoreRankableHits(
  items: RankableHit[],
  options?: ScoreRankableOptions,
): ScoredHit[] {
  if (!items.length) return [];

  const mergedWeights: RankingWeights = {
    ...RANKING_WEIGHTS,
    ...options?.weights,
  };

  const hint = options?.categoryHint ?? null;
  const extra = options?.intentKeywords ?? [];
  const intentKeywords = extractIntentKeywords(
    hint,
    ...extra.map((x) => String(x)),
  );

  const prices = items.map((i) => Math.max(0, Number(i.price) || 0));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const soldCounts = items.map((i) => Math.max(0, i.soldCount));
  const maxSold = Math.max(1, ...soldCounts);

  const ctx: ScoreContext = {
    minPrice,
    maxPrice,
    maxSold,
    categoryHint: hint,
    intentKeywords,
    weights: mergedWeights,
  };

  return items.map((p) => {
    const components = computeScore(p, ctx);
    if (options?.frozenCategoryNeutralIds?.has(p.productId)) {
      components.categoryTerm = 0.5;
    }
    let compositeScore = applyWeights(components, mergedWeights);
    compositeScore = applyCosineSimilarityBoost(compositeScore, p.cosine);
    return { ...p, compositeScore, components };
  });
}

/** Pondération type marketplace (CLIP + histogramme + forme). */
export const VISUAL_BLEND_WEIGHTS = { clip: 0.7, color: 0.2, shape: 0.1 } as const;

/** N premiers hits vectoriels bruts (cosinus Pinecone) conservés en tête sans réordonnancement (API legacy / helpers). */
export const PIN_RAW_TOP_K = 3;

/** Diversification (dédoublonnage embedding / URL) appliquée seulement après cette position (1-based : positions 1–5 protégées). */
export const HEAD_DIVERSITY_SKIP = 5;

/**
 * Cosinus requête ↔ produit au‑delà duquel on considère l’article comme quasi identique
 * à la requête (remonté en tête si le moteur vectoriel l’avait plus bas).
 */
export const EXACT_MATCH_COSINE = 0.995;

/** Max produits pour lesquels on télécharge une image et calcule une empreinte (perf). */
export const MAX_FINGERPRINT_FETCH = 28;

/**
 * Score visuel fusionné : `clip * 0.7 + color * 0.2 + shape * 0.1`.
 * Couleur = histogramme + couleurs dominantes ; forme = rapport d’aspect + structure bords (Sobel).
 * Boosts si couleur / forme très proches (images quasi identiques vs. seulement sémantiquement proches en CLIP).
 */
export function blendVisualSimilarity(
  cosine: number,
  queryFp: ImageVisualFingerprint,
  productFp: ImageVisualFingerprint | null | undefined,
): { blend: number; colorTerm: number; shapeTerm: number } {
  let colorTerm = cosine;
  let shapeTerm = cosine;
  if (productFp) {
    const c = compareVisualFingerprints(queryFp, productFp);
    colorTerm = c.colorSim;
    shapeTerm = c.shapeSim;
  }
  let blend =
    VISUAL_BLEND_WEIGHTS.clip * cosine +
    VISUAL_BLEND_WEIGHTS.color * colorTerm +
    VISUAL_BLEND_WEIGHTS.shape * shapeTerm;
  if (colorTerm > 0.9) blend = Math.min(1, blend + 0.06);
  if (shapeTerm > 0.9) blend = Math.min(1, blend + 0.06);
  return { blend: clamp01(blend), colorTerm, shapeTerm };
}

/**
 * Score ranking « AliExpress-like » : mélange visuel + léger e-commerce.
 */
export function scoreRankableHitsVisual(
  items: RankableHit[],
  queryFp: ImageVisualFingerprint,
  productFpMap: Map<string, ImageVisualFingerprint | null>,
  options?: ScoreRankableOptions,
): ScoredHit[] {
  if (!items.length) return [];

  const mergedWeights: RankingWeights = {
    ...RANKING_WEIGHTS,
    ...options?.weights,
  };

  const hint = options?.categoryHint ?? null;
  const extra = options?.intentKeywords ?? [];
  const intentKeywords = extractIntentKeywords(
    hint,
    ...extra.map((x) => String(x)),
  );

  const prices = items.map((i) => Math.max(0, Number(i.price) || 0));
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const soldCounts = items.map((i) => Math.max(0, i.soldCount));
  const maxSold = Math.max(1, ...soldCounts);

  const ctx: ScoreContext = {
    minPrice,
    maxPrice,
    maxSold,
    categoryHint: hint,
    intentKeywords,
    weights: mergedWeights,
  };

  return items.map((p) => {
    const eco = computeScore(p, ctx);
    if (options?.frozenCategoryNeutralIds?.has(p.productId)) {
      eco.categoryTerm = 0.5;
    }
    const { blend, colorTerm, shapeTerm } = blendVisualSimilarity(
      p.cosine,
      queryFp,
      productFpMap.get(p.productId),
    );
    let compositeScore = clamp01(
      0.82 * blend +
        0.06 * eco.popularityTerm +
        0.06 * eco.priceTerm +
        0.06 * eco.categoryTerm,
    );
    compositeScore = applyCosineSimilarityBoost(compositeScore, p.cosine);
    return {
      ...p,
      compositeScore,
      components: {
        cosineTerm: eco.cosineTerm,
        popularityTerm: eco.popularityTerm,
        priceTerm: eco.priceTerm,
        categoryTerm: eco.categoryTerm,
        colorTerm,
        shapeTerm,
        visualBlend: blend,
      },
    };
  });
}

/**
 * Reprend les N premiers IDs du classement vectoriel brut (ordre Pinecone) avec leurs scores composites.
 */
export function takePinnedRawHits(
  rawHits: { productId: string }[],
  scoredById: Map<string, ScoredHit>,
  k = PIN_RAW_TOP_K,
): ScoredHit[] {
  return rawHits
    .slice(0, k)
    .map((h) => scoredById.get(h.productId))
    .filter((x): x is ScoredHit => x != null);
}

/**
 * Construit les N premières lignes du classement final :
 * 1) les 3 premiers hits vectoriels (Pinecone / Firestore), **sans réordonnancement** ;
 * 2) complément jusqu’à `maxHead` par score composite décroissant (positions 4–5 pour `HEAD_DIVERSITY_SKIP`).
 *
 * La diversification ne s’applique qu’aux rangs suivants (voir `HEAD_DIVERSITY_SKIP`).
 */
export function buildHeadOrdered(
  hits: { productId: string; score: number }[],
  scoredById: Map<string, ScoredHit>,
  options?: { maxHead?: number },
): ScoredHit[] {
  const maxHead = options?.maxHead ?? HEAD_DIVERSITY_SKIP;

  const ordered: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < Math.min(3, hits.length); i++) {
    const id = hits[i].productId;
    ordered.push(id);
    seen.add(id);
  }

  const restSorted = [...scoredById.values()]
    .filter((s) => !seen.has(s.productId))
    .sort((a, b) => b.compositeScore - a.compositeScore);

  for (const s of restSorted) {
    if (ordered.length >= maxHead) break;
    ordered.push(s.productId);
    seen.add(s.productId);
  }

  return ordered
    .map((id) => scoredById.get(id))
    .filter((x): x is ScoredHit => x != null);
}

/** Remonte un produit en position 1 (ex. correspondance pHash exacte). */
export function promoteScoredRowToFirst(
  list: ScoredHit[],
  productId: string,
): ScoredHit[] {
  const idx = list.findIndex((x) => x.productId === productId);
  if (idx <= 0) return list;
  const copy = [...list];
  const [row] = copy.splice(idx, 1);
  return [row!, ...copy];
}

/** Télécharge les vignettes produit et calcule les empreintes (parallèle borné). */
export async function fetchFingerprintMapForRankables(
  rankables: RankableHit[],
  maxProducts: number,
  concurrency = 5,
): Promise<Map<string, ImageVisualFingerprint | null>> {
  const m = new Map<string, ImageVisualFingerprint | null>();
  const slice = rankables.slice(0, maxProducts);
  for (let i = 0; i < slice.length; i += concurrency) {
    const chunk = slice.slice(i, i + concurrency);
    const pairs = await Promise.all(
      chunk.map(async (r) => {
        const fp = await fetchFingerprintFromImageUrl(r.imageUrl);
        return [r.productId, fp] as const;
      }),
    );
    for (const [id, fp] of pairs) m.set(id, fp);
  }
  return m;
}

/**
 * Diversification : tri par score composite, sélection gloutonne.
 * Avec `categoryAwareDedup` : ne pas traiter comme doublon deux fiches de rayons nettement différents.
 * `protectTopK` : les premiers résultats ne déclenchent pas le filtre embedding (déjà triés ailleurs).
 */
export function diversifyResults(
  scored: ScoredHit[],
  embeddings: Map<string, number[]>,
  options?: DiversifyOptions,
): ScoredHit[] {
  const thr = options?.duplicateThreshold ?? DEFAULT_DUPLICATE_SIMILARITY;
  const categoryAware = options?.categoryAwareDedup ?? true;
  const protectTopK = Math.max(0, Math.floor(options?.protectTopK ?? 0));
  const neverRemoveAbove =
    options?.neverRemoveEmbeddingCosineAbove ?? HIGH_SIMILARITY_NEVER_FILTER;

  const sorted = [...scored].sort((a, b) => b.compositeScore - a.compositeScore);
  const chosen: ScoredHit[] = [];
  const seenImageKeys = new Set<string>();

  for (const cand of sorted) {
    if (cand.cosine > neverRemoveAbove) {
      chosen.push(cand);
      continue;
    }

    if (chosen.length < protectTopK) {
      const imgKey = normalizeImageKey(cand.imageUrl);
      if (imgKey && seenImageKeys.has(imgKey)) continue;
      if (imgKey) seenImageKeys.add(imgKey);
      chosen.push(cand);
      continue;
    }

    let tooClose = false;

    for (const prev of chosen) {
      const embC = embeddings.get(cand.productId);
      const embP = embeddings.get(prev.productId);
      if (embC && embP && embC.length === embP.length) {
        const sim = cosineSimilarity(embC, embP);
        if (sim >= thr) {
          if (categoryAware && !categoriesCompatibleForDedup(cand, prev)) {
            continue;
          }
          tooClose = true;
          break;
        }
      }
    }

    if (tooClose) continue;

    const imgKey = normalizeImageKey(cand.imageUrl);
    if (imgKey && seenImageKeys.has(imgKey)) continue;
    if (imgKey) seenImageKeys.add(imgKey);

    chosen.push(cand);
  }

  return chosen;
}

export function normalizeImageKey(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  try {
    const u = url.split("?")[0].trim().toLowerCase();
    return u.length > 20 ? u.slice(-80) : u;
  } catch {
    return "";
  }
}

/**
 * Construit un `RankableHit` depuis les données Firestore + score vectoriel.
 */
export function rankableFromProduct(
  productId: string,
  cosine: number,
  data: DocumentData | undefined,
  fallbackPrice?: number,
  fallbackImage?: string | null,
): RankableHit {
  const d = data || {};
  const price = Number(d.price ?? fallbackPrice ?? 0) || 0;
  const sold = Number(d.soldCount ?? d.orders ?? 0) || 0;
  const rating = Number(d.rating ?? 0) || 0;
  const categoryName =
    (d.categoryName || d.category || null) as string | null;
  const categoryId = (d.categoryId != null ? String(d.categoryId) : null) as
    | string
    | null;
  const name = (d.name || null) as string | null;
  const imageUrl =
    (d.mainImage || d.imageUrl || d.image || fallbackImage || null) as
      | string
      | null;
  return {
    productId,
    cosine,
    price,
    soldCount: sold,
    rating,
    categoryName,
    categoryId,
    name,
    imageUrl,
  };
}
