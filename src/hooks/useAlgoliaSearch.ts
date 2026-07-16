import { useState, useCallback, useRef } from 'react';
import { productsIndex } from '../config/algolia';
import type { AlgoliaHit } from '../types/product';

export interface AlgoliaSearchOptions {
  hitsPerPage?: number;
  category?: string;
}

export interface AlgoliaSearchState {
  results: AlgoliaHit[];
  loading: boolean;
  error: string | null;
  search: (query: string, options?: AlgoliaSearchOptions) => Promise<void>;
  reset: () => void;
}

function normalizeHit(hit: AlgoliaHit): AlgoliaHit {
  const normalize = (v: unknown): string => {
    const raw = String(v ?? '').trim();
    if (!raw) return '';
    if (raw.includes('firebasestorage.googleapis.com') && !raw.includes('alt=media')) {
      return raw.includes('?') ? `${raw}&alt=media` : `${raw}?alt=media`;
    }
    return raw;
  };

  const mainImage = normalize(hit.mainImage ?? hit.imageUrl ?? hit.image);
  const images = Array.isArray(hit.images)
    ? hit.images.map((u) => normalize(u)).filter(Boolean)
    : mainImage ? [mainImage] : [];

  return { ...hit, mainImage, imageUrl: normalize(hit.imageUrl ?? hit.mainImage ?? hit.image), image: normalize(hit.image ?? hit.imageUrl ?? hit.mainImage), images };
}

/**
 * Hook pour effectuer des recherches Algolia avec une double passe
 * (stricte puis large) et fusion des hits.
 */
export function useAlgoliaSearch(): AlgoliaSearchState {
  const [results, setResults] = useState<AlgoliaHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<boolean>(false);

  const search = useCallback(async (query: string, options: AlgoliaSearchOptions = {}) => {
    const { hitsPerPage = 24, category } = options;
    const text = query.trim();
    if (!text) {
      setResults([]);
      return;
    }

    abortRef.current = false;
    setLoading(true);
    setError(null);

    const facetFilters = category && category !== 'Tous'
      ? [`categoryName:${category}`]
      : undefined;

    try {
      // Passe 1 — résultats stricts (rapide, affiché immédiatement)
      const exactRes = await productsIndex.search<AlgoliaHit>(text, {
        hitsPerPage,
        restrictSearchableAttributes: ['name'],
        queryType: 'prefixNone',
        typoTolerance: false,
        ...(facetFilters ? { facetFilters } : {}),
      });

      if (abortRef.current) return;

      const mergedMap = new Map<string, AlgoliaHit>();
      exactRes.hits.forEach((h) => mergedMap.set(h.objectID, normalizeHit(h as AlgoliaHit)));
      setResults(Array.from(mergedMap.values()));
      setLoading(false);

      // Passe 2 — résultats larges (enrichissement, typos, pluriels)
      const broadRes = await productsIndex.search<AlgoliaHit>(text, {
        hitsPerPage: hitsPerPage * 2,
        restrictSearchableAttributes: ['name'],
        typoTolerance: true,
        ignorePlurals: true,
        removeStopWords: ['fr'],
        queryType: 'prefixLast',
        ...(facetFilters ? { facetFilters } : {}),
      });

      if (abortRef.current) return;

      broadRes.hits.forEach((h) => {
        if (!mergedMap.has(h.objectID)) {
          mergedMap.set(h.objectID, normalizeHit(h as AlgoliaHit));
        }
      });

      setResults(Array.from(mergedMap.values()));
    } catch (err) {
      if (!abortRef.current) {
        const msg = err instanceof Error ? err.message : 'Erreur de recherche';
        setError(msg);
        console.error('[useAlgoliaSearch]', err);
      }
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current = true;
    setResults([]);
    setLoading(false);
    setError(null);
  }, []);

  return { results, loading, error, search, reset };
}
