/**
 * Classement recherche visuelle : récupération large, scores forts (catégorie / mots-clés / sémantique).
 * Pas d’exclusion dure : tout reste dans la liste, le tri sépare le pertinent du bruit.
 */
import type { AlgoliaHit } from '@/types/product';
import type { SuperCategory, VisualSearchDescriptor } from '@/services/imageSearchGemini';
import { detectSuperCategory } from '@/services/imageSearchGemini';
import {
  hitMatchesFirestoreCategories,
  hitPassesVisualSemanticLock,
  inferSuperCategoryFromCategoryName,
  type VisualSearchCategoryPlan,
} from '@/services/visualSearchCategories';

/** Couverture texte descripteur (0–1) — poids relevé pour mieux discriminer. */
export const GEMINI_TEXT_SCORE_WEIGHT = 780;

/** Rayons Algolia « précis » (ex. Chaussures femmes) — bonus maximal. */
export const CATEGORY_NARROW_BONUS = 6_200;
/** Dans le plan élargi mais pas le narrow (ou pas de narrow défini). */
export const CATEGORY_BROAD_MATCH_BONUS = 3_400;
export const CATEGORY_UNKNOWN_NEUTRAL = 160;
/** Catégorie connue mais hors plan : fort malus (reste visible plus bas). */
export const CATEGORY_MISMATCH_PENALTY = -6_800;

export const SEMANTIC_MATCH_BONUS = 2_200;
export const SEMANTIC_MISMATCH_PENALTY = -3_600;

/** Alignement super-catégorie (texte + categoryName) avec le verrou sémantique. */
export const SUPER_RAYON_ALIGN_BONUS = 2_600;
export const SUPER_RAYON_CONFLICT_PENALTY = -4_200;
export const SUPER_RAYON_TOLERANCE_PENALTY = -320;

const KEYWORD_MAX_BOOST = 9_200;
const KEYWORD_PER_UNIT = 108;

function hitProductText(hit: AlgoliaHit): string {
  return `${hit.name ?? ''} ${hit.categoryName ?? ''} ${hit.description ?? ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normToken(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Couverture tokens descripteur / requête dans le texte produit (0–1).
 */
export function computeGeminiScore(hit: AlgoliaHit, desc: VisualSearchDescriptor): number {
  const text = hitProductText(hit);
  if (!text) return 0;

  const allTokens = [
    ...desc.keywords,
    ...desc.labels,
    ...desc.entities,
    ...desc.detectedText,
    ...desc.colors,
    ...desc.materials,
  ]
    .map((t) => normToken(String(t)))
    .filter((t) => t.length >= 2);

  const unique = Array.from(new Set(allTokens));
  if (!unique.length) return 0;

  const coverage = unique.filter((tok) => text.includes(tok)).length / unique.length;
  const qNorm = normToken(desc.searchQuery || '');
  const queryWords = qNorm.split(' ').filter((w) => w.length >= 2);
  const qCov = queryWords.length
    ? queryWords.filter((w) => text.includes(w)).length / queryWords.length
    : 0;

  return Math.min(1, coverage * 0.52 + qCov * 0.48);
}

/**
 * Bonus catégorie par paliers : narrow Algolia > broad > inconnu > hors plan.
 */
export function computeCategorySoftModifier(
  hit: Pick<AlgoliaHit, 'categoryName'>,
  plan: VisualSearchCategoryPlan,
): number {
  const hasNarrow = plan.algoliaNarrow.length > 0;
  const hasBroad = plan.algoliaBroad.length > 0;
  if (!hasNarrow && !hasBroad) return 0;

  const hitCat = String(hit.categoryName || '').trim();
  if (!hitCat) return CATEGORY_UNKNOWN_NEUTRAL;

  if (hasNarrow && hitMatchesFirestoreCategories(hit, plan.algoliaNarrow)) {
    return CATEGORY_NARROW_BONUS;
  }

  const broadForCheck = hasBroad ? plan.algoliaBroad : plan.algoliaNarrow;
  if (hitMatchesFirestoreCategories(hit, broadForCheck)) {
    return CATEGORY_BROAD_MATCH_BONUS;
  }

  return CATEGORY_MISMATCH_PENALTY;
}

export function computeSemanticSoftModifier(
  hit: Pick<AlgoliaHit, 'name' | 'categoryName' | 'description' | 'subCategory'>,
  lock: SuperCategory,
  desc: VisualSearchDescriptor,
): number {
  if (!lock) return 0;
  return hitPassesVisualSemanticLock(hit, lock, desc)
    ? SEMANTIC_MATCH_BONUS
    : SEMANTIC_MISMATCH_PENALTY;
}

function inferHitSuperCategory(hit: AlgoliaHit): SuperCategory {
  const fromCn = inferSuperCategoryFromCategoryName(hit.categoryName);
  if (fromCn) return fromCn;
  const blob = hitProductText(hit);
  return detectSuperCategory([], [], blob);
}

/**
 * Renfort selon la cohérence chaussures / sacs / … entre fiche et intention de recherche.
 */
export function computeSuperCategoryRayonModifier(
  hit: AlgoliaHit,
  lock: SuperCategory,
): number {
  if (!lock) return 0;
  const product = inferHitSuperCategory(hit);
  if (!product) return 0;

  if (product === lock) return SUPER_RAYON_ALIGN_BONUS;

  if (
    (lock === 'clothing' && product === 'accessories') ||
    (lock === 'accessories' && product === 'clothing')
  ) {
    return SUPER_RAYON_TOLERANCE_PENALTY;
  }

  return SUPER_RAYON_CONFLICT_PENALTY;
}

type WeightedTok = { t: string; w: number };

function buildWeightedDescriptorTokens(desc: VisualSearchDescriptor): WeightedTok[] {
  const acc: WeightedTok[] = [];
  const pushPhrase = (raw: string, weight: number) => {
    normToken(raw)
      .split(' ')
      .filter((x) => x.length >= 2)
      .forEach((t) => acc.push({ t, w: weight }));
  };

  pushPhrase(desc.searchQuery || '', 3.4);
  desc.labels.forEach((l) => pushPhrase(String(l || ''), 3.0));
  desc.keywords.forEach((k) => pushPhrase(String(k || ''), 2.6));
  desc.entities.forEach((e) => pushPhrase(String(e || ''), 2.9));
  desc.detectedText.forEach((x) => pushPhrase(String(x || ''), 2.0));
  desc.colors.forEach((c) => pushPhrase(String(c || ''), 1.35));
  desc.materials.forEach((m) => pushPhrase(String(m || ''), 1.5));

  const best = new Map<string, number>();
  for (const { t, w } of acc) {
    best.set(t, Math.max(best.get(t) ?? 0, w));
  }
  return Array.from(best.entries()).map(([t, w]) => ({ t, w }));
}

/**
 * Bonus forts si le texte produit contient les termes clés du descripteur (requête, labels, etc.).
 */
export function computeDescriptorKeywordBoost(hit: AlgoliaHit, desc: VisualSearchDescriptor): number {
  const text = hitProductText(hit);
  if (!text) return 0;

  const weighted = buildWeightedDescriptorTokens(desc);
  let sum = 0;
  for (const { t, w } of weighted) {
    if (t.length < 2) continue;
    if (!text.includes(t)) continue;
    const lenFactor = Math.min(14, Math.max(2, t.length));
    sum += lenFactor * w * KEYWORD_PER_UNIT;
  }
  return Math.min(KEYWORD_MAX_BOOST, Math.round(sum));
}

export type VisualRankComponents = {
  baseVisual: number;
  geminiText: number;
  categoryMod: number;
  semanticMod: number;
  superRayonMod: number;
  keywordBoost: number;
  total: number;
};

export function computeVisualRankComponents(
  hit: AlgoliaHit,
  desc: VisualSearchDescriptor,
  plan: VisualSearchCategoryPlan,
): VisualRankComponents {
  const baseVisual = Number(hit.visualScore ?? 0);
  const geminiText = computeGeminiScore(hit, desc) * GEMINI_TEXT_SCORE_WEIGHT;
  const categoryMod = computeCategorySoftModifier(hit, plan);
  const semanticMod = computeSemanticSoftModifier(hit, plan.semanticLock, desc);
  const superRayonMod = computeSuperCategoryRayonModifier(hit, plan.semanticLock);
  const keywordBoost = computeDescriptorKeywordBoost(hit, desc);

  const total =
    baseVisual +
    geminiText +
    categoryMod +
    semanticMod +
    superRayonMod +
    keywordBoost;

  return {
    baseVisual,
    geminiText,
    categoryMod,
    semanticMod,
    superRayonMod,
    keywordBoost,
    total,
  };
}

/** Score unique pour tri / affichage (même formule que `computeVisualRankComponents`). */
export function computeVisualRankTotal(
  hit: AlgoliaHit,
  desc: VisualSearchDescriptor,
  plan: VisualSearchCategoryPlan,
): number {
  return computeVisualRankComponents(hit, desc, plan).total;
}

export function visualHitAllowed(
  _hit: AlgoliaHit,
  _plan: VisualSearchCategoryPlan,
  _desc: VisualSearchDescriptor,
  _directExact: AlgoliaHit | null,
): boolean {
  void _hit;
  void _plan;
  void _desc;
  void _directExact;
  return true;
}

function normCompact(s: string): string {
  return normToken(s);
}

export function buildVisualRescueQuery(
  desc: VisualSearchDescriptor,
  fallbackSearchText: string,
): string {
  const chunks = [
    String(desc.searchQuery || '').trim(),
    ...desc.keywords.map((k) => String(k || '').trim()).filter(Boolean).slice(0, 8),
    ...desc.labels.map((k) => String(k || '').trim()).filter(Boolean).slice(0, 6),
    ...desc.entities.map((k) => String(k || '').trim()).filter(Boolean).slice(0, 4),
  ].filter(Boolean);
  const joined = Array.from(new Set(chunks)).join(' ').replace(/\s+/g, ' ').trim();
  if (joined.length >= 2) return joined.slice(0, 220);
  const fb = normCompact(fallbackSearchText);
  if (fb && fb !== 'produit' && fb !== '*') return String(fallbackSearchText).trim().slice(0, 220);
  return '';
}

const MIN_GEMINI_FOR_HIT = 0.13;
const MIN_GEMINI_IN_SCOPE = 0.065;

function nameOverlapsSearch(hit: Pick<AlgoliaHit, 'name'>, searchText: string): boolean {
  const hay = normCompact(hit.name || '');
  const words = normCompact(searchText)
    .split(' ')
    .filter((w) => w.length >= 2);
  if (!words.length || !hay) return false;
  const matched = words.filter((w) => hay.includes(w)).length;
  return matched >= Math.min(2, words.length) || matched / words.length >= 0.35;
}

export function hitMeetsVisualQueryRelevance(
  hit: AlgoliaHit,
  desc: VisualSearchDescriptor,
  searchText: string,
  plan: VisualSearchCategoryPlan | null,
  opts: { lockedExactId?: string | null } = {},
): boolean {
  if (opts.lockedExactId && hit.objectID === opts.lockedExactId) return true;
  if (hit.isExactImageMatch) return true;
  /** Résultats CLIP : pas de filtrage par mots-clés Gemini */
  if (hit.sourceType === 'vector_clip') return true;

  const gs = computeGeminiScore(hit, desc);
  if (gs >= MIN_GEMINI_FOR_HIT) return true;
  if (nameOverlapsSearch(hit, searchText)) return true;

  const hay = hitProductText(hit);
  const qWords = normCompact(searchText)
    .split(' ')
    .filter((w) => w.length >= 2);
  if (qWords.length > 0) {
    const matched = qWords.filter((w) => hay.includes(w)).length;
    const ratio = matched / qWords.length;
    if (ratio >= 0.4) return true;
    if (matched >= 2) return true;
  }

  if (plan?.algoliaBroad?.length && hit.categoryName) {
    const inCat = hitMatchesFirestoreCategories(hit, plan.algoliaBroad);
    if (inCat && gs >= MIN_GEMINI_IN_SCOPE) return true;
    if (inCat && qWords.some((w) => hay.includes(w))) return true;
  }

  if (plan?.semanticLock && hitPassesVisualSemanticLock(hit, plan.semanticLock, desc)) {
    if (gs >= MIN_GEMINI_IN_SCOPE) return true;
    if (qWords.some((w) => hay.includes(w))) return true;
  }

  return false;
}

export function filterVisualResultsForQuery(
  hits: AlgoliaHit[],
  desc: VisualSearchDescriptor,
  searchText: string,
  plan: VisualSearchCategoryPlan | null,
  lockedExactId: string | null,
): AlgoliaHit[] {
  const filtered = hits.filter((h) =>
    hitMeetsVisualQueryRelevance(h, desc, searchText, plan, { lockedExactId }),
  );
  if (filtered.length > 0) return filtered;
  return hits
    .filter((h) => computeGeminiScore(h, desc) >= 0.11)
    .sort((a, b) => computeGeminiScore(b, desc) - computeGeminiScore(a, desc))
    .slice(0, 12);
}
