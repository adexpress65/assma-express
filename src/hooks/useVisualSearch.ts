import { useState, useCallback, useRef, useEffect } from 'react';
import {
  analyzeImageForVisualSearch,
  buildPrimaryTokensForCategory,
  catalogCategoryMatchesSuperCategory,
  detectSuperCategory,
  hitTextPassesCategoryFilter,
  inferSuperCategoryFromQueryText,
  repairVisualSearchDescriptor,
  type VisualSearchDescriptor,
  type SuperCategory,
} from '../services/imageSearchGemini';
import {
  applyClipVectorPostFilters,
  filterApiVectorsStrictSimilarity,
  filterSearchHitsByCategoryLock,
  searchVisualImageVector,
  STRICT_VISUAL_MIN_SIMILARITY,
  supplementVectorHitsForRecall,
  type SearchVisualImageOptions,
  type VisualVectorImageInput,
  type ApiVectorProduct,
} from '../services/visualSearchApi';
import {
  findDirectImageMatch,
  findGlobalFingerprintExactMatch,
  promoteFingerprintExactMatch,
} from '../services/directImageMatchService';
import { DIRECT_EXACT_TOP_SCORE, pinDirectMatchFirst } from '../services/visualSearchAlgoliaFilters';
import {
  findExactProductByImageHash,
  visualSearchResultToAlgoliaHit,
} from '../services/visualSearchService';
import type { AlgoliaHit } from '../types/product';
import type { VisualImageSearchResponseMeta } from '../services/visualSearchApi';
import { VISUAL_SEARCH_RECALL_LOCK } from '@/config/visualSearchRecallLock';
import i18n from '@/services/i18n';

export { detectSuperCategory, hitTextPassesCategoryFilter };
export type { SuperCategory };

const DIRECT_SCORE = DIRECT_EXACT_TOP_SCORE;

/** Évite que le scan Firestore « match direct » bloque toute la recherche (Promise.all). */
const DIRECT_MATCH_BUDGET_MS = 9000;

/** Empreintes : plus de candidats = meilleure chance de remonter le SKU exact (photo catalogue ≠ photo utilisateur). */
const FINGERPRINT_PROMOTE_MAX_CANDIDATES = 14;
const FINGERPRINT_PROMOTE_BUDGET_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/** Timeout `fetch` / navigation : pas une erreur « métier » à afficher en rouge. */
function isLikelyAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === 'AbortError') return true;
  const m = String(err instanceof Error ? err.message : err).toLowerCase();
  return m.includes('abort');
}

/** N’affiche jamais tout un data URL / base64 dans l’UI (les libs peuvent les recopier dans le message d’erreur). */
function sanitizeErrorForUi(raw: string): string {
  let s = String(raw || "");
  s = s.replace(
    /data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=\s]+/gi,
    "data:image;base64,[contenu masqué]",
  );
  if (s.length > 220) s = `${s.slice(0, 217)}…`;
  return s.trim() || "Erreur inconnue";
}

/**
 * Déduit s’il reste des pages côté `visualImageSearch` (certaines réponses n’exposent que `totalRanked`).
 */
function inferVectorHasMore(
  meta: VisualImageSearchResponseMeta,
  rawLen: number,
  requestOffset: number,
  pageLimit: number,
): boolean {
  if (typeof meta.hasMore === 'boolean') return meta.hasMore;
  const totalRanked = meta.totalRanked;
  if (typeof totalRanked === 'number' && totalRanked > 0) {
    const offset = typeof meta.offset === 'number' ? meta.offset : requestOffset;
    const returned = typeof meta.returned === 'number' ? meta.returned : rawLen;
    return offset + returned < totalRanked;
  }
  /** Page complète sans métadonnée : tenter une page suivante (le serveur renverra 0 + hasMore false). */
  return rawLen >= pageLimit;
}

function guessMime(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

function appendPageVectorHits(
  raw: ApiVectorProduct[],
  descriptor: VisualSearchDescriptor | null,
  queryHint: string,
  tokens: string[],
  lockCat: SuperCategory | null,
  existingIds: Set<string>,
): AlgoliaHit[] {
  let v = applyClipVectorPostFilters(raw, descriptor, queryHint, tokens);
  v = filterApiVectorsStrictSimilarity(v, STRICT_VISUAL_MIN_SIMILARITY);
  const mergedList = v.map((item) => vectorItemToHit(item));
  let list = filterSearchHitsByCategoryLock(mergedList, lockCat).filter(
    (hit) =>
      (typeof hit.similarity === 'number' && !Number.isNaN(hit.similarity)
        ? hit.similarity
        : (Number(hit.visualScore) || 0) / 100) >= STRICT_VISUAL_MIN_SIMILARITY,
  );
  const byClip = mergedList
    .filter(
      (hit) =>
        (typeof hit.similarity === 'number' && !Number.isNaN(hit.similarity)
          ? hit.similarity
          : (Number(hit.visualScore) || 0) / 100) >= STRICT_VISUAL_MIN_SIMILARITY,
    )
    .sort((a, b) => (b.visualScore ?? 0) - (a.visualScore ?? 0));
  if (lockCat && byClip.length > list.length) {
    const seen = new Set(list.map((h) => String(h.objectID)));
    const pageCap = VISUAL_SEARCH_RECALL_LOCK.visualPageSize;
    for (const h of byClip) {
      if (list.length >= pageCap) break;
      const id = String(h.objectID);
      if (!seen.has(id)) {
        list.push(h);
        seen.add(id);
      }
    }
  }
  list.sort((a, b) => (b.visualScore ?? 0) - (a.visualScore ?? 0));
  return list.filter((h) => !existingIds.has(String(h.objectID)));
}

function vectorItemToHit(item: {
  id: string;
  name?: string;
  price?: number;
  imageUrl?: string | null;
  description?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  visualScore?: number;
  similarity?: number;
}): AlgoliaHit {
  return {
    objectID: item.id,
    name: item.name,
    price: item.price,
    imageUrl: item.imageUrl ?? undefined,
    description: item.description ?? undefined,
    category: item.categoryId ?? undefined,
    categoryName: item.categoryName ?? undefined,
    visualScore: Number(item.visualScore ?? (item.similarity ?? 0) * 100),
    similarity: typeof item.similarity === 'number' ? item.similarity : undefined,
    sourceType: 'vector_clip',
  };
}

export interface VisualSearchState {
  results: AlgoliaHit[];
  descriptor: VisualSearchDescriptor | null;
  hasDirectMatch: boolean;
  loading: boolean;
  loadingMoreVisual: boolean;
  hasMoreVisual: boolean;
  loadingMsg: string;
  error: string | null;
  searchByImage: (
    base64: string,
    fileName?: string,
    imageUri?: string,
    options?: { prefetchedDescriptor?: VisualSearchDescriptor | null },
  ) => Promise<void>;
  /** Suite des pages `visualImageSearch` (offset) — scroll infini. */
  loadMoreVisual: () => Promise<void>;
  reset: () => void;
}

/**
 * Recherche par image : correspondance directe (URL / empreinte) + similarité CLIP (Cloud Function + Firestore).
 * Pas d’Algolia ni de scoring par mots-clés sur les résultats vectoriels.
 */
type VisualPageSnap = {
  enabled: boolean;
  vectorInput: VisualVectorImageInput;
  /** Options sans offset/limit (réinjectés à chaque page). */
  baseVectorOpts: SearchVisualImageOptions;
  nextOffset: number;
};

export function useVisualSearch(): VisualSearchState {
  const [results, setResults] = useState<AlgoliaHit[]>([]);
  const [descriptor, setDescriptor] = useState<VisualSearchDescriptor | null>(null);
  const [hasDirectMatch, setHasDirectMatch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMoreVisual, setLoadingMoreVisual] = useState(false);
  const [hasMoreVisual, setHasMoreVisual] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pageSnapRef = useRef<VisualPageSnap | null>(null);
  const resultsRef = useRef<AlgoliaHit[]>([]);
  const hasMoreVisualRef = useRef(false);
  const filterCtxRef = useRef<{
    descriptor: VisualSearchDescriptor | null;
    lockCat: SuperCategory | null;
    queryHint: string;
    tokens: string[];
  }>({ descriptor: null, lockCat: null, queryHint: '', tokens: [] });
  const loadingMoreGuardRef = useRef(false);

  useEffect(() => {
    hasMoreVisualRef.current = hasMoreVisual;
  }, [hasMoreVisual]);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const searchByImage = useCallback(
    async (
      base64: string,
      _fileName = '',
      _imageUri = '',
      options?: { prefetchedDescriptor?: VisualSearchDescriptor | null },
    ) => {
    setLoading(true);
    setError(null);
    setResults([]);
    setHasDirectMatch(false);
    setDescriptor(null);
    setHasMoreVisual(false);
    hasMoreVisualRef.current = false;
    setLoadingMoreVisual(false);
    pageSnapRef.current = null;
    loadingMoreGuardRef.current = false;

    try {
      filterCtxRef.current = {
        descriptor: null,
        lockCat: null,
        queryHint: '',
        tokens: [],
      };
      setLoadingMsg(i18n.t('visualSearch.searchingByImage'));
      const mime = guessMime(_fileName);

      let repairedPrefetch: VisualSearchDescriptor | null = null;
      if (options?.prefetchedDescriptor != null) {
        try {
          repairedPrefetch = repairVisualSearchDescriptor(options.prefetchedDescriptor);
        } catch {
          repairedPrefetch = null;
        }
      }

      const buildVectorOpts = (): SearchVisualImageOptions => {
        const base: SearchVisualImageOptions = {
          minSimilarity: VISUAL_SEARCH_RECALL_LOCK.strictVisualMinSimilarity,
        };
        if (!repairedPrefetch) return base;
        const pt = buildPrimaryTokensForCategory(repairedPrefetch);
        const qh = repairedPrefetch.searchQuery?.trim() || '';
        const hint = (repairedPrefetch.strictCategory || qh).trim();
        if (hint) base.categoryHint = hint;
        if (pt.length) base.intentKeywords = pt.slice(0, 24);
        const ih = [...repairedPrefetch.labels, ...repairedPrefetch.keywords].filter(Boolean);
        if (ih.length) base.imageHints = ih.slice(0, 24);
        return base;
      };

      const geminiRace = repairedPrefetch
        ? Promise.resolve(repairedPrefetch)
        : Promise.race([
            analyzeImageForVisualSearch(base64, mime)
              .then((d) => repairVisualSearchDescriptor(d))
              .catch(() => null),
            new Promise<null>((r) => setTimeout(() => r(null), 26_000)),
          ]);

      let vectorApiError: string | null = null;
      const trimmedUri = _imageUri?.trim() || "";
      /** URIs « opaques » (galerie Android, Photos iOS) : `expo-image-manipulator` peut échouer sur ces schémas ; le base64 est déjà en mémoire. */
      const preferBase64ForVector =
        !trimmedUri ||
        trimmedUri.startsWith("content://") ||
        trimmedUri.startsWith("ph://") ||
        trimmedUri.startsWith("assets-library://");
      const vectorInput: VisualVectorImageInput = preferBase64ForVector
        ? { imageBase64: base64, mimeType: mime }
        : { sourceUri: trimmedUri, mimeHint: mime };
      const baseOptsVec = buildVectorOpts();
      /** Première page : moins de hits à classer + budget un peu plus serré = réponse plus rapide ; le scroll charge la suite. */
      const firstVectorOpts: SearchVisualImageOptions = {
        ...baseOptsVec,
        limit: Math.min(40, VISUAL_SEARCH_RECALL_LOCK.visualPageSize),
        offset: 0,
        budgetMs: 4000,
      };
      const vectorPromise = searchVisualImageVector(vectorInput, firstVectorOpts).catch(
        (err) => {
          if (!isLikelyAbortError(err)) {
            vectorApiError = sanitizeErrorForUi(
              err instanceof Error ? err.message : String(err),
            );
          }
          return { results: [], metadata: {} };
        },
      );

      const directPromise = _imageUri
        ? withTimeout(
            findDirectImageMatch(_imageUri, _fileName),
            DIRECT_MATCH_BUDGET_MS,
            { exactMatches: [] as AlgoliaHit[], fileNameMatches: [] as AlgoliaHit[] },
          )
        : Promise.resolve({ exactMatches: [] as AlgoliaHit[], fileNameMatches: [] as AlgoliaHit[] });

      const trimmedForHash = _imageUri?.trim() || "";
      const hashExactPromise = trimmedForHash
        ? withTimeout(findExactProductByImageHash(trimmedForHash), 12_000, null)
        : Promise.resolve(null);

      const [directRes, geminiDesc, vectorRes, hashExactRow] = await Promise.all([
        directPromise,
        geminiRace,
        vectorPromise,
        hashExactPromise,
      ]);

      const rawVectorHits = vectorRes.results;
      const vectorMeta = vectorRes.metadata ?? {};

      const descriptor = geminiDesc;
      setDescriptor(descriptor);
      const tokens = buildPrimaryTokensForCategory(descriptor);
      const queryHint = descriptor?.searchQuery?.trim() || '';
      let vectorHits = applyClipVectorPostFilters(
        rawVectorHits,
        descriptor,
        queryHint,
        tokens,
      );
      vectorHits = filterApiVectorsStrictSimilarity(vectorHits, STRICT_VISUAL_MIN_SIMILARITY);
      vectorHits = supplementVectorHitsForRecall(rawVectorHits, vectorHits);

      const directExact =
        directRes.exactMatches[0] ?? directRes.fileNameMatches[0] ?? null;

      if (directExact) {
        setHasDirectMatch(true);
        setHasMoreVisual(false);
        hasMoreVisualRef.current = false;
        pageSnapRef.current = null;
        const sole: AlgoliaHit = {
          ...directExact,
          visualScore: DIRECT_SCORE,
          isExactImageMatch: true,
          sourceType: 'firebase',
        };
        setResults([sole]);
        return;
      }

      /** Match sur hash d’image Firestore (`mainImageHash` / `imageHashes`) — indépendant du CLIP. */
      const hashExactHit = hashExactRow ? visualSearchResultToAlgoliaHit(hashExactRow) : null;

      const mergedMap = new Map<string, AlgoliaHit>();
      vectorHits.forEach((item) => {
        const h = vectorItemToHit(item);
        mergedMap.set(h.objectID, h);
      });

      const lockCat =
        descriptor?.detectedSuperCategory ?? inferSuperCategoryFromQueryText(queryHint);
      const mergedList = Array.from(mergedMap.values());
      const simOf = (hit: AlgoliaHit) =>
        typeof hit.similarity === 'number' && !Number.isNaN(hit.similarity)
          ? hit.similarity
          : (Number(hit.visualScore) || 0) / 100;

      let list = filterSearchHitsByCategoryLock(mergedList, lockCat).filter(
        (hit) => simOf(hit) >= STRICT_VISUAL_MIN_SIMILARITY,
      );
      /** Si le verrou super-catégorie laisse trop peu de lignes pour la grille (~50), compléter par le classement CLIP brut. */
      const targetGrid = VISUAL_SEARCH_RECALL_LOCK.gridTargetResults;
      if (list.length < targetGrid && lockCat) {
        const byClip = mergedList
          .filter((hit) => simOf(hit) >= STRICT_VISUAL_MIN_SIMILARITY)
          .sort((a, b) => simOf(b) - simOf(a));
        if (byClip.length > list.length) {
          const seen = new Set(list.map((h) => String(h.objectID)));
          for (const h of byClip) {
            if (list.length >= targetGrid) break;
            const id = String(h.objectID);
            if (!seen.has(id)) {
              list.push(h);
              seen.add(id);
            }
          }
        }
      }
      list.sort((a, b) => (b.visualScore ?? 0) - (a.visualScore ?? 0));

      if (_imageUri && list.length > 0) {
        list = await withTimeout(
          promoteFingerprintExactMatch(
            _imageUri,
            list,
            FINGERPRINT_PROMOTE_MAX_CANDIDATES,
          ),
          FINGERPRINT_PROMOTE_BUDGET_MS,
          list,
        );
      }

      let final = pinDirectMatchFirst(list, null);

      if (hashExactHit) {
        setHasDirectMatch(true);
        const rest = final.filter((h) => String(h.objectID) !== String(hashExactHit.objectID));
        final = [hashExactHit, ...rest];
      }

      if (final.length === 0 && _imageUri) {
        const fpHit = await findGlobalFingerprintExactMatch(_imageUri);
        if (fpHit) {
          const fpLock =
            descriptor?.detectedSuperCategory ?? inferSuperCategoryFromQueryText(queryHint);
          if (
            !fpLock ||
            catalogCategoryMatchesSuperCategory(fpHit.categoryName, fpHit.category, fpLock)
          ) {
            final = [fpHit];
          }
        }
      }

      if (final.length === 0) {
        if (vectorApiError) {
          setError(i18n.t('visualSearch.errorVectorSend', { message: vectorApiError }));
        } else if (rawVectorHits.length > 0 && vectorHits.length === 0) {
          setError(i18n.t('visualSearch.errorFilters'));
        } else {
          setError(i18n.t('visualSearch.errorNoNeighbors'));
        }
      }

      filterCtxRef.current = {
        descriptor,
        lockCat,
        queryHint,
        tokens,
      };
      setResults(final);

      const pageLimit = VISUAL_SEARCH_RECALL_LOCK.visualPageSize;
      const inferredMore = inferVectorHasMore(
        vectorMeta,
        rawVectorHits.length,
        0,
        pageLimit,
      );
      const canPage =
        inferredMore && rawVectorHits.length > 0 && final.length > 0;
      setHasMoreVisual(canPage);
      hasMoreVisualRef.current = canPage;
      if (canPage) {
        pageSnapRef.current = {
          enabled: true,
          vectorInput,
          baseVectorOpts: baseOptsVec,
          nextOffset:
            (vectorMeta.offset ?? 0) +
            (vectorMeta.returned ?? rawVectorHits.length),
        };
      } else {
        pageSnapRef.current = null;
      }
    } catch (err) {
      setHasMoreVisual(false);
      hasMoreVisualRef.current = false;
      pageSnapRef.current = null;
      if (!isLikelyAbortError(err)) {
        const msg =
          err instanceof Error ? err.message : i18n.t('visualSearch.errorGeneric');
        setError(sanitizeErrorForUi(msg));
      }
      console.error('[useVisualSearch]', err);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  },
  [],
);

  const loadMoreVisual = useCallback(async () => {
    const snap = pageSnapRef.current;
    if (!snap?.enabled || loadingMoreGuardRef.current) return;
    if (!hasMoreVisualRef.current) return;
    loadingMoreGuardRef.current = true;
    setLoadingMoreVisual(true);
    const pageLimit = VISUAL_SEARCH_RECALL_LOCK.visualPageSize;
    try {
      const ctx = filterCtxRef.current;
      const reqOffset = snap.nextOffset;
      const res = await searchVisualImageVector(snap.vectorInput, {
        ...snap.baseVectorOpts,
        limit: pageLimit,
        offset: reqOffset,
      });
      const meta = res.metadata ?? {};
      const raw = res.results;
      const prev = resultsRef.current;
      const ids = new Set(prev.map((h) => String(h.objectID)));
      const extra = appendPageVectorHits(
        raw,
        ctx.descriptor,
        ctx.queryHint,
        ctx.tokens,
        ctx.lockCat,
        ids,
      );
      if (!raw.length) {
        setHasMoreVisual(false);
        hasMoreVisualRef.current = false;
        return;
      }
      if (extra.length === 0) {
        /** Page serveur non vide mais tout filtré / doublons : ne pas boucler indéfiniment. */
        setHasMoreVisual(false);
        hasMoreVisualRef.current = false;
        snap.nextOffset =
          (meta.offset ?? reqOffset) + (meta.returned ?? raw.length);
        return;
      }
      const merged = [...prev, ...extra];
      setResults(merged);
      resultsRef.current = merged;
      snap.nextOffset =
        (meta.offset ?? reqOffset) + (meta.returned ?? raw.length);
      const stillMore = inferVectorHasMore(meta, raw.length, reqOffset, pageLimit);
      const nextHas = stillMore && raw.length > 0;
      setHasMoreVisual(nextHas);
      hasMoreVisualRef.current = nextHas;
    } catch (e) {
      console.warn('[useVisualSearch] loadMoreVisual', e);
    } finally {
      loadingMoreGuardRef.current = false;
      setLoadingMoreVisual(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResults([]);
    setDescriptor(null);
    setHasDirectMatch(false);
    setLoading(false);
    setLoadingMoreVisual(false);
    setHasMoreVisual(false);
    hasMoreVisualRef.current = false;
    setLoadingMsg('');
    setError(null);
    pageSnapRef.current = null;
    loadingMoreGuardRef.current = false;
    filterCtxRef.current = {
      descriptor: null,
      lockCat: null,
      queryHint: '',
      tokens: [],
    };
  }, []);

  return {
    results,
    descriptor,
    hasDirectMatch,
    loading,
    loadingMoreVisual,
    hasMoreVisual,
    loadingMsg,
    error,
    searchByImage,
    loadMoreVisual,
    reset,
  };
}
