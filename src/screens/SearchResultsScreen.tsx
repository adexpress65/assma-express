import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  InteractionManager,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { ScreenSafeArea } from '@/components/ScreenSafeArea';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { productsIndex } from '@/config/algolia';
import type { AlgoliaHit } from '@/types/product';
import {
  consumeVisualSearchPickBase64,
  consumeVisualSearchDescriptor,
} from '@/services/visualSearchImageBuffer';
import { repairVisualSearchDescriptor, type VisualSearchDescriptor } from '@/services/imageSearchGemini';
import { getBase64FromImageUri } from '@/services/visualSearchApi';
import { useVisualSearch } from '@/hooks/useVisualSearch';
import { getLocalizedProductText, intlLocaleForAppLanguage } from '@/utils/productLocale';

const { width } = Dimensions.get('window');
const COL_W = (width - 36) / 2;

/**
 * Champs strictement nécessaires à la grille (moins d’octets JSON, réponse plus rapide).
 * Adapter si l’index Algolia expose d’autres noms d’attributs.
 */
const ALGOLIA_GRID_ATTRS = [
  'objectID',
  'name',
  'price',
  'currency',
  'mainImage',
  'imageUrl',
  'image',
  'companyName',
  'supplier',
  'category',
  'categoryName',
  'minOrder',
] as const;

/** Requête Algolia allégée (hits + attributs minimaux). */
const ALGOLIA_FAST = {
  /** Première page texte : équilibre vitesse / couverture (pagination inchangée). */
  hitsPerPage: 48,
  attributesToRetrieve: [...ALGOLIA_GRID_ATTRS],
  typoTolerance: true as const,
  removeStopWords: ['fr'] as const,
  /** Moins de travail côté réseau Algolia sur chaque frappe / navigation. */
  analytics: false,
};

/**
 * Recherche texte en parallèle de la recherche image : uniquement pour remplir la grille
 * avant le CLIP ou compléter ; pas besoin d’un JSON aussi gros que la recherche texte pure.
 */
const ALGOLIA_IMAGE_PARALLEL = {
  ...ALGOLIA_FAST,
  hitsPerPage: 32,
};

/**
 * Plafond de fusion « voisins CLIP + complément texte ».
 * Les pages CLIP (50 / requête) ne sont pas plafonnées : ce plafond limite surtout le nombre de hits texte ajoutés.
 */
/** Plafond lors de l’ajout des hits texte au lot CLIP (évite une fusion énorme). */
const MAX_MERGED_IMAGE_HITS = 500;

/** Valeur interne pour le filtre « toutes catégories » (indépendante de la langue affichée). */
const ALL_CATEGORIES_VALUE = '__ALL__';

function normalizeImg(u: unknown): string {
  const raw = String(u || '').trim();
  if (!raw) return '';
  if (raw.includes('firebasestorage.googleapis.com') && !raw.includes('alt=media')) {
    return raw.includes('?') ? `${raw}&alt=media` : `${raw}?alt=media`;
  }
  return raw;
}

function hitToCardProduct(hit: AlgoliaHit) {
  const img = normalizeImg(hit.mainImage || hit.imageUrl || hit.image);
  return {
    id: String(hit.objectID),
    name: String(hit.name || 'Produit'),
    price: Number(hit.price ?? 0),
    imageUrl: img,
    mainImage: img,
    rating: Number((hit as AlgoliaHit & { rating?: number }).rating ?? 0),
    supplier: String(hit.supplier || hit.companyName || 'Vendeur'),
    companyName: hit.companyName,
    minOrder: Number(hit.minOrder ?? 1),
    deliveryTime: (hit as AlgoliaHit & { deliveryTime?: string }).deliveryTime || '—',
    isVerified: Boolean((hit as AlgoliaHit & { isVerified?: boolean }).isVerified),
  };
}

export default function SearchResultsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const {
    query: queryParam,
    source,
    imageUri,
    imageFileName,
    visualSearchPayload,
  } = useLocalSearchParams<{
    query?: string;
    source?: string;
    imageUri?: string;
    imageFileName?: string;
    visualSearchPayload?: string;
  }>();

  const queryText = String(queryParam || '').trim();
  const isImageSearch = source === 'image';
  const previewUri = imageUri ? String(imageUri) : '';

  const {
    results: visualHits,
    descriptor,
    loading: visualLoading,
    loadingMoreVisual,
    hasMoreVisual,
    loadingMsg,
    error: visualError,
    searchByImage,
    loadMoreVisual,
  } = useVisualSearch();

  const [textHits, setTextHits] = useState<AlgoliaHit[]>([]);
  const [textLoading, setTextLoading] = useState(false);
  const [textPage, setTextPage] = useState(0);
  const [textHasMore, setTextHasMore] = useState(false);
  const [textLoadingMore, setTextLoadingMore] = useState(false);
  const textPageRef = useRef(0);
  const textHasMoreRef = useRef(false);
  const textLoadMoreGuardRef = useRef(false);
  /** Résultats texte immédiats en parallèle du CLIP (recherche image). */
  const [parallelTextHits, setParallelTextHits] = useState<AlgoliaHit[]>([]);
  const [parallelLoading, setParallelLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORIES_VALUE);

  useEffect(() => {
    textPageRef.current = textPage;
  }, [textPage]);
  useEffect(() => {
    textHasMoreRef.current = textHasMore;
  }, [textHasMore]);

  /** Recherche texte pure (pas d’image) — page 0 + pagination Algolia (`nbPages`). */
  useEffect(() => {
    if (isImageSearch || !queryText) {
      setTextHits([]);
      setTextPage(0);
      setTextHasMore(false);
      textHasMoreRef.current = false;
      return;
    }
    let cancelled = false;
    setTextLoading(true);
    productsIndex
      .search<AlgoliaHit>(queryText, { ...ALGOLIA_FAST, page: 0 })
      .then((r) => {
        if (cancelled) return;
        setTextHits(r.hits || []);
        setTextPage(0);
        textPageRef.current = 0;
        const nbPages = typeof r.nbPages === 'number' ? r.nbPages : 1;
        const page = typeof r.page === 'number' ? r.page : 0;
        const more = page + 1 < nbPages;
        setTextHasMore(more);
        textHasMoreRef.current = more;
      })
      .catch(() => {
        if (!cancelled) {
          setTextHits([]);
          setTextHasMore(false);
          textHasMoreRef.current = false;
        }
      })
      .finally(() => {
        if (!cancelled) setTextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isImageSearch, queryText]);

  const loadMoreText = useCallback(async () => {
    if (isImageSearch || !queryText.trim()) return;
    if (!textHasMoreRef.current || textLoadMoreGuardRef.current || textLoading) return;
    textLoadMoreGuardRef.current = true;
    setTextLoadingMore(true);
    try {
      const nextPage = textPageRef.current + 1;
      const r = await productsIndex.search<AlgoliaHit>(queryText, {
        ...ALGOLIA_FAST,
        page: nextPage,
      });
      const hits = r.hits || [];
      setTextHits((prev) => {
        const seen = new Set(prev.map((h) => String(h.objectID)));
        const extra = hits.filter((h) => !seen.has(String(h.objectID)));
        return [...prev, ...extra];
      });
      setTextPage(nextPage);
      textPageRef.current = nextPage;
      const nbPages = typeof r.nbPages === 'number' ? r.nbPages : nextPage + 1;
      const page = typeof r.page === 'number' ? r.page : nextPage;
      const more = page + 1 < nbPages;
      setTextHasMore(more);
      textHasMoreRef.current = more;
    } catch {
      setTextHasMore(false);
      textHasMoreRef.current = false;
    } finally {
      textLoadMoreGuardRef.current = false;
      setTextLoadingMore(false);
    }
  }, [isImageSearch, queryText, textLoading]);

  /**
   * Recherche image : Algolia sur les mots-clés en parallèle (ne pas attendre Gemini/CLIP).
   * Comportement type marketplace : grille remplie tout de suite, puis rafraîchissement si le vecteur renvoie des hits.
   */
  useEffect(() => {
    if (!isImageSearch || !queryText) {
      setParallelTextHits([]);
      setParallelLoading(false);
      return;
    }
    let cancelled = false;
    setParallelLoading(true);
    productsIndex
      .search<AlgoliaHit>(queryText, ALGOLIA_FAST)
      .then((r) => {
        if (!cancelled) setParallelTextHits(r.hits || []);
      })
      .catch(() => {
        if (!cancelled) setParallelTextHits([]);
      })
      .finally(() => {
        if (!cancelled) setParallelLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isImageSearch, queryText]);

  /** Image : base64 puis CLIP (en parallèle de la requête Algolia texte ci-dessus). */
  useEffect(() => {
    if (!isImageSearch) return;

    let cancelled = false;
    void (async () => {
      const stash = consumeVisualSearchPickBase64();
      let b64 = stash?.base64 ?? null;
      if (!b64 && previewUri) {
        b64 = await getBase64FromImageUri(previewUri);
      }
      if (cancelled || !b64) return;
      const fname =
        (imageFileName && String(imageFileName)) ||
        previewUri.split('/').pop() ||
        `search-${Date.now()}.jpg`;

      let prefetched: VisualSearchDescriptor | null = consumeVisualSearchDescriptor();
      if (!prefetched && typeof visualSearchPayload === 'string' && visualSearchPayload.trim()) {
        try {
          prefetched = repairVisualSearchDescriptor(
            JSON.parse(visualSearchPayload) as VisualSearchDescriptor,
          );
        } catch {
          prefetched = null;
        }
      }

      await searchByImage(
        b64,
        fname,
        previewUri || undefined,
        prefetched ? { prefetchedDescriptor: prefetched } : undefined,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [isImageSearch, previewUri, imageFileName, searchByImage, visualSearchPayload]);

  /**
   * Recherche image : d’abord les voisins CLIP, puis les hits texte Algolia sans doublons
   * (le SKU exact peut être #1 en texte mais hors top vectoriel).
   */
  const { primaryHits, isKeywordFallback, isVisualAugmentedWithText } = useMemo(() => {
    if (!isImageSearch) {
      return {
        primaryHits: textHits,
        isKeywordFallback: false,
        isVisualAugmentedWithText: false,
      };
    }
    if (visualHits.length === 0) {
      return {
        primaryHits: parallelTextHits,
        isKeywordFallback: parallelTextHits.length > 0,
        isVisualAugmentedWithText: false,
      };
    }
    const seen = new Set(visualHits.map((h) => String(h.objectID)));
    const merged: AlgoliaHit[] = [...visualHits];
    for (const h of parallelTextHits) {
      if (merged.length >= MAX_MERGED_IMAGE_HITS) break;
      const id = String(h.objectID);
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(h);
      }
    }
    return {
      primaryHits: merged,
      isKeywordFallback: false,
      isVisualAugmentedWithText: merged.length > visualHits.length,
    };
  }, [isImageSearch, textHits, visualHits, parallelTextHits]);

  const filteredHits = useMemo(() => {
    if (selectedCategory === ALL_CATEGORIES_VALUE) return primaryHits;
    return primaryHits.filter((h) => {
      const c = String(h.categoryName || h.category || '');
      return c === selectedCategory;
    });
  }, [primaryHits, selectedCategory]);

  /** Erreur CLIP seulement si aucun résultat à montrer (sinon le fallback Algolia suffit, bannière ambre). */
  const showVectorFailureBanner = Boolean(visualError && primaryHits.length === 0);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    primaryHits.forEach((h) => {
      const c = h.categoryName || h.category;
      if (c) set.add(String(c));
    });
    return [ALL_CATEGORIES_VALUE, ...Array.from(set).slice(0, 8)];
  }, [primaryHits]);

  /** Spinner tant qu’aucun résultat ; si le vecteur échoue, on attend encore Algolia parallèle. */
  const loading =
    (!isImageSearch && textLoading && textHits.length === 0) ||
    (isImageSearch &&
      visualHits.length === 0 &&
      parallelTextHits.length === 0 &&
      (parallelLoading || visualLoading));

  const resultCount = filteredHits.length;

  useEffect(() => {
    const n = Math.min(22, filteredHits.length);
    const urls = filteredHits
      .slice(0, n)
      .map((h) => normalizeImg(h.mainImage || h.imageUrl || h.image))
      .filter(Boolean);
    if (urls.length === 0) return;
    const task = InteractionManager.runAfterInteractions(() => {
      Image.prefetch(urls, 'memory-disk').catch(() => {});
    });
    return () => task.cancel();
  }, [filteredHits]);

  const onPressProduct = useCallback(
    (hit: AlgoliaHit) => {
      router.push({
        pathname: '/product/[id]',
        params: {
          id: String(hit.objectID),
          initialProductData: JSON.stringify({ ...hit, id: hit.objectID }),
        },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: AlgoliaHit }) => (
      <SearchResultGridItem hit={item} onPress={onPressProduct} lang={i18n.language} />
    ),
    [onPressProduct, i18n.language],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {resultCount === 0
              ? t('searchResults.summaryNone')
              : resultCount === 1
                ? t('searchResults.summaryOne')
                : t('searchResults.summaryMany', { count: resultCount })}
            {isImageSearch ? t('searchResults.visualSuffix') : ''}
          </Text>
        </View>
        {isKeywordFallback ? (
          <View style={styles.fallbackBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#b45309" />
            <Text style={styles.fallbackBannerText}>{t('searchResults.keywordFallbackBanner')}</Text>
          </View>
        ) : null}
        {isVisualAugmentedWithText ? (
          <View style={[styles.fallbackBanner, styles.mergeHintBanner]}>
            <Ionicons name="layers-outline" size={18} color="#1d4ed8" />
            <Text style={[styles.fallbackBannerText, styles.mergeHintBannerText]}>
              {t('searchResults.mergeHint', {
                hint: queryText.trim() ? queryText : t('searchResults.mergeHintDefault'),
              })}
            </Text>
          </View>
        ) : null}
        {showVectorFailureBanner ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{visualError}</Text>
          </View>
        ) : null}
        {descriptor?.searchQuery && isImageSearch ? (
          <Text style={styles.descriptorHint} numberOfLines={2}>
            {descriptor.searchQuery}
          </Text>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {categoryOptions.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, selectedCategory === c && styles.chipActive]}
              onPress={() => setSelectedCategory(c)}
            >
              <Text style={[styles.chipTxt, selectedCategory === c && styles.chipTxtActive]}>
                {c === ALL_CATEGORIES_VALUE ? t('searchResults.allCategories') : c}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    ),
    [
      t,
      resultCount,
      isImageSearch,
      isKeywordFallback,
      isVisualAugmentedWithText,
      queryText,
      showVectorFailureBanner,
      visualError,
      descriptor?.searchQuery,
      categoryOptions,
      selectedCategory,
    ],
  );

  const empty =
    !loading &&
    filteredHits.length === 0 &&
    !(isImageSearch && visualLoading);

  /** FlatList + `numColumns={2}` : `onEndReached` est peu fiable sur Android — on combine avec `onScroll`. */
  const endReachedCooldownRef = useRef(0);
  const scrollNearEndCooldownRef = useRef(0);
  const onEndReachedLoadMore = useCallback(() => {
    const t = Date.now();
    if (t - endReachedCooldownRef.current < 550) return;
    endReachedCooldownRef.current = t;
    if (isImageSearch) {
      if (!hasMoreVisual || loadingMoreVisual || visualLoading) return;
      void loadMoreVisual();
    } else {
      if (!textHasMore || textLoading || textLoadingMore) return;
      void loadMoreText();
    }
  }, [
    isImageSearch,
    hasMoreVisual,
    loadingMoreVisual,
    visualLoading,
    loadMoreVisual,
    textHasMore,
    textLoading,
    textLoadingMore,
    loadMoreText,
  ]);

  const onScrollMaybeLoadMore = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (contentSize.height <= 0) return;
      const distFromEnd = contentSize.height - (layoutMeasurement.height + contentOffset.y);
      if (distFromEnd > 320) return;
      const t = Date.now();
      if (t - scrollNearEndCooldownRef.current < 650) return;
      scrollNearEndCooldownRef.current = t;
      if (isImageSearch) {
        if (hasMoreVisual && !loadingMoreVisual && !visualLoading) void loadMoreVisual();
      } else if (textHasMore && !textLoading && !textLoadingMore) {
        void loadMoreText();
      }
    },
    [
      isImageSearch,
      hasMoreVisual,
      loadingMoreVisual,
      visualLoading,
      loadMoreVisual,
      textHasMore,
      textLoading,
      textLoadingMore,
      loadMoreText,
    ],
  );

  const listFooter = useMemo(() => {
    if (isImageSearch && loadingMoreVisual) {
      return (
        <View style={styles.refineFooter}>
          <ActivityIndicator size="small" color="#ff6a00" />
          <Text style={styles.refineFooterText}>{t('searchResults.loadMoreVisual')}</Text>
        </View>
      );
    }
    if (!isImageSearch && textLoadingMore) {
      return (
        <View style={styles.refineFooter}>
          <ActivityIndicator size="small" color="#ff6a00" />
          <Text style={styles.refineFooterText}>{t('searchResults.loadMoreText')}</Text>
        </View>
      );
    }
    if (isImageSearch && visualLoading && visualHits.length === 0 && filteredHits.length > 0) {
      return (
        <View style={styles.refineFooter}>
          <ActivityIndicator size="small" color="#ff6a00" />
          <Text style={styles.refineFooterText}>{t('searchResults.refiningImage')}</Text>
        </View>
      );
    }
    return null;
  }, [
    t,
    isImageSearch,
    loadingMoreVisual,
    textLoadingMore,
    visualLoading,
    visualHits.length,
    filteredHits.length,
  ]);

  return (
    <ScreenSafeArea style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.searchPreview}>
          <Ionicons name="search-outline" size={22} color="#7c6b5f" />
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={styles.thumb}
              contentFit="cover"
            />
          ) : null}
          <Text style={styles.queryLabel} numberOfLines={1}>
            {queryText.trim() ? queryText : t('searchResults.queryFallback')}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color="#33251a" />
        </TouchableOpacity>
      </View>

      {loading && filteredHits.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff6a00" />
          <Text style={styles.loadingTxt}>
            {isImageSearch
              ? loadingMsg || t('searchResults.imageAnalysis')
              : t('searchResults.loadingTextSearch')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredHits}
          keyExtractor={(item) => String(item.objectID)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          onEndReached={onEndReachedLoadMore}
          onEndReachedThreshold={0.12}
          onScroll={onScrollMaybeLoadMore}
          scrollEventThrottle={250}
          contentContainerStyle={[styles.listContent, empty && styles.listEmpty]}
          ListEmptyComponent={
            empty ? (
              <View style={styles.emptyBox}>
                <Ionicons name="images-outline" size={56} color="#d0c7bf" />
                <Text style={styles.emptyTitle}>{t('searchResults.emptyTitle')}</Text>
                <Text style={styles.emptySub}>{t('searchResults.emptySubtitle')}</Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={isImageSearch ? 6 : 8}
          maxToRenderPerBatch={isImageSearch ? 8 : 10}
          windowSize={isImageSearch ? 5 : 7}
          updateCellsBatchingPeriod={isImageSearch ? 64 : 50}
        />
      )}
    </ScreenSafeArea>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#faf8f5' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e0d8',
  },
  searchPreview: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ece7e0',
  },
  thumb: { width: 36, height: 36, borderRadius: 8 },
  queryLabel: { flex: 1, fontSize: 15, color: '#33251a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingTxt: { marginTop: 12, fontSize: 15, color: '#6b5b4f', textAlign: 'center' },
  listContent: { padding: 12, paddingBottom: 32 },
  listEmpty: { flexGrow: 1 },
  listHeader: { marginBottom: 12 },
  summaryRow: { marginBottom: 8 },
  summaryText: { fontSize: 15, fontWeight: '600', color: '#2d2419' },
  fallbackBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fff7ed',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  fallbackBannerText: { flex: 1, fontSize: 13, color: '#9a3412' },
  mergeHintBanner: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  mergeHintBannerText: { color: '#1e3a8a' },
  errorBanner: {
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: { fontSize: 13, color: '#b91c1c' },
  descriptorHint: { fontSize: 13, color: '#6b5b4f', marginBottom: 8 },
  chipsRow: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e0d8',
  },
  chipActive: { backgroundColor: '#33251a', borderColor: '#33251a' },
  chipTxt: { fontSize: 13, color: '#4a4035' },
  chipTxtActive: { color: '#fff', fontWeight: '600' },
  row: { justifyContent: 'space-between', marginBottom: 12 },
  card: {
    width: COL_W,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee8e0',
  },
  cardImg: { width: '100%', height: COL_W * 1.05 },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#2d2419', minHeight: 36 },
  cardPrice: { fontSize: 14, fontWeight: '700', color: '#ea580c', marginTop: 4 },
  cardMeta: { fontSize: 12, color: '#78716c', marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#57534e', marginTop: 12 },
  emptySub: { fontSize: 14, color: '#a8a29e', textAlign: 'center', marginTop: 8 },
  refineFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  refineFooterText: { fontSize: 13, color: '#78716c' },
});

type GridItemProps = { hit: AlgoliaHit; onPress: (h: AlgoliaHit) => void; lang: string };

const SearchResultGridItem = React.memo(
  function SearchResultGridItem({ hit, onPress, lang }: GridItemProps) {
    const { t } = useTranslation();
    const p = hitToCardProduct(hit);
    const hitData = hit as unknown as Record<string, unknown>;
    const displayNameRaw = getLocalizedProductText(
      hit.name,
      'name',
      hitData,
      lang,
    );
    const displayName = displayNameRaw.trim()
      ? displayNameRaw
      : t('searchResults.defaultProductName');
    const img = p.mainImage || p.imageUrl;
    const priceStr = Number(hit.price ?? 0).toLocaleString(
      intlLocaleForAppLanguage(lang),
    );
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onPress(hit)}
        activeOpacity={0.92}
      >
        <Image
          source={img ? { uri: img } : undefined}
          style={styles.cardImg}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
          recyclingKey={String(hit.objectID)}
        />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {displayName}
          </Text>
          <Text style={styles.cardPrice}>
            {priceStr} {hit.currency || 'XOF'}
          </Text>
          {p.rating > 0 ? (
            <Text style={styles.cardMeta}>⭐ {p.rating.toFixed(1)}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  },
  (prev, next) =>
    prev.lang === next.lang &&
    prev.hit.objectID === next.hit.objectID &&
    (prev.hit.visualScore ?? 0) === (next.hit.visualScore ?? 0) &&
    (prev.hit.price ?? 0) === (next.hit.price ?? 0) &&
    String(prev.hit.name ?? '') === String(next.hit.name ?? '') &&
    normalizeImg(prev.hit.mainImage || prev.hit.imageUrl || prev.hit.image) ===
      normalizeImg(next.hit.mainImage || next.hit.imageUrl || next.hit.image),
);
