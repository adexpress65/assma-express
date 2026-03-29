import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  FlatList,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import algoliasearch from 'algoliasearch/lite';
import { collection, getDocs, limit, query as firestoreQuery } from 'firebase/firestore';
import { Image } from 'expo-image';

import {
  analyzeImageForVisualSearch,
  type VisualSearchDescriptor,
} from '../src/services/imageSearchGemini';
import { db } from '../src/config/firebase';
import { searchProductsByVisualDescriptor } from '../src/services/visualSearchService';
import { searchServerVisualProducts } from '../src/services/visualSearchApi';

const searchClient = algoliasearch('ZYRHOXK3WR', '28b16aa67095fa844e0ef397d15b7a66');
const index = searchClient.initIndex('products');

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 36) / 2;

function normalizeImageUrl(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  if (raw.includes('firebasestorage.googleapis.com') && !raw.includes('alt=media')) {
    return raw.includes('?') ? `${raw}&alt=media` : `${raw}?alt=media`;
  }
  return raw;
}

function normalizeHitImages(hit: SearchHit): SearchHit {
  const mainImage = normalizeImageUrl(hit.mainImage || hit.imageUrl || hit.image);
  const imageUrl = normalizeImageUrl(hit.imageUrl || hit.mainImage || hit.image);
  const image = normalizeImageUrl(hit.image || hit.imageUrl || hit.mainImage);
  const images = Array.isArray(hit.images)
    ? hit.images.map((u) => normalizeImageUrl(u)).filter(Boolean)
    : mainImage
      ? [mainImage]
      : [];
  return {
    ...hit,
    mainImage,
    imageUrl,
    image,
    images: images.length ? images : hit.images,
  };
}

function buildPrimaryTokens(descriptor?: VisualSearchDescriptor | null): string[] {
  if (!descriptor) return [];
  const base = [
    ...(descriptor.labels || []),
    ...(descriptor.keywords || []),
  ]
    .map((t) => normalize(String(t || '')))
    .filter(Boolean);
  const set = new Set(base);
  if (set.has('robe') || set.has('dress')) {
    ['robe', 'robes', 'dress', 'dresses', 'gown', 'gowns', 'vestido', 'vestidos', 'abaya'].forEach((t) =>
      set.add(t)
    );
  }
  return Array.from(set);
}

type SearchHit = {
  objectID: string;
  name?: string;
  price?: number;
  currency?: string;
  supplier?: string;
  companyName?: string;
  companyId?: string;
  mainImage?: string;
  imageUrl?: string;
  image?: string;
  featured?: boolean;
  updatedAt?: number;
  category?: string;
  categoryName?: string;
  images?: string[];
  visualScore?: number;
  description?: string;
  sourceType?: 'firebase' | 'api';
};

type SelectedImageCard = {
  objectID: string;
  __selectedImage: true;
  imageUri: string;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, '')
    .trim();
}

function scoreMatch(name: string, query: string) {
  const n = normalize(name);
  const q = normalize(query);

  if (!q) return 0;
  if (n === q) return 200;

  const qWords = q.split(' ').filter(Boolean);
  if (qWords.length === 0) return 0;

  const matchedCount = qWords.reduce((sum, word) => sum + (n.includes(word) ? 1 : 0), 0);
  const ratio = matchedCount / qWords.length;
  const containsPhrase = n.includes(q) ? 1 : 0;
  const allWordsPresent = qWords.every((word) => n.includes(word)) ? 1 : 0;

  return Math.round(ratio * 120) + containsPhrase * 40 + allWordsPresent * 60;
}

function extractFileNameParts(value: string) {
  const rawFileName = value.split('/').pop() || value;
  const withoutExtension = rawFileName.replace(/\.[a-z0-9]+$/i, '');
  return withoutExtension
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((part) => part.length >= 3);
}

export default function SearchResultsPage() {
  const {
    query: queryParam,
    source,
    base64,
    imageFileName,
    imageUri,
    visualSearchPayload,
  } = useLocalSearchParams<{
    query?: string;
    source?: string;
    base64?: string;
    imageFileName?: string;
    imageUri?: string;
    visualSearchPayload?: string;
  }>();

  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Initialisation...');
  const [activeTab, setActiveTab] = useState<'products' | 'suppliers'>('products');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 24;
  const router = useRouter();

  const queryText = String(queryParam || '').trim();
  const selectedImageUri = imageUri ? String(imageUri) : '';
  const selectedImageFileName = imageFileName ? String(imageFileName) : '';
  const isImageSearch = source === 'image';
  const visualDescriptor = useMemo<VisualSearchDescriptor | null>(() => {
    if (!visualSearchPayload) {
      return null;
    }

    try {
      const parsed = JSON.parse(String(visualSearchPayload));
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return parsed as VisualSearchDescriptor;
    } catch {
      return null;
    }
  }, [visualSearchPayload]);
  const selectedImageTokens = useMemo(() => {
    const tokenSource = [selectedImageFileName, selectedImageUri].filter(Boolean).join(' ');
    return extractFileNameParts(tokenSource);
  }, [selectedImageFileName, selectedImageUri]);

  const getImageBoost = useCallback((hit: SearchHit) => {
    if (!isImageSearch || !selectedImageFileName) return 0;

    const fileName = selectedImageFileName.toLowerCase();
    const baseName = fileName.replace(/\.[a-z0-9]+$/i, '');
    const candidates = [hit?.mainImage, hit?.imageUrl, hit?.image, ...(hit?.images || [])]
      .filter(Boolean)
      .map((uri) => String(uri).toLowerCase());

    const match =
      candidates.some((uri) => uri.includes(fileName)) ||
      (baseName !== fileName && candidates.some((uri) => uri.includes(baseName)));

    return match ? 5000 : 0;
  }, [isImageSearch, selectedImageFileName]);

  const getRankingScore = useCallback((hit: SearchHit, searchText: string, descriptor?: VisualSearchDescriptor | null) => {
     let score = scoreMatch(hit?.name || '', searchText) +
       (hit?.featured ? 10 : 0) +
       getImageBoost(hit) +
       Number(hit?.visualScore || 0);

     // Boost massif pour correspondance d'URL d'image exacte
     const hitImages = [hit?.mainImage, hit?.imageUrl, hit?.image, ...(hit?.images || [])].filter(Boolean).map(String);
     if (selectedImageUri && hitImages.includes(selectedImageUri)) {
       score += 20000;
     }

    // Boost supplémentaire si des entités ou du texte détecté dans l'image (OCR) correspondent au nom du produit
     if (descriptor) {
      const name = normalize(hit?.name || '');
      const description = normalize(hit?.description || '');
      const category = normalize(hit?.categoryName || hit?.category || '');
      const haystack = `${name} ${description} ${category}`;

      // Boost pour les entités (Marques, Modèles, SKU)
      if (descriptor.entities?.length > 0) {
        descriptor.entities.forEach(entity => {
          const normalizedEntity = normalize(entity);
          if (normalizedEntity.length > 2 && haystack.includes(normalizedEntity)) {
            score += 1000; // Gros boost pour les entités correspondantes
          }
        });
      }

      // Boost pour le texte détecté (OCR)
      if (descriptor.detectedText?.length > 0) {
        descriptor.detectedText.forEach(text => {
          const normalizedText = normalize(text);
          if (normalizedText.length > 3 && haystack.includes(normalizedText)) {
            score += 500; // Boost moyen pour l'OCR
          }
        });
      }

      // Boost fort pour une similarité visuelle élevée (quand disponible)
      const vs = Number(hit?.visualScore || 0);
      if (vs >= 0.9) score += 20000;
      else if (vs >= 0.8) score += 12000;
      else if (vs >= 0.7) score += 8000;
      else if (vs >= 0.6) score += 4000;

      // Boost pour le type de produit (labels/keywords)
      const primaryTokens = buildPrimaryTokens(descriptor);
      if (primaryTokens.length > 0) {
        primaryTokens.forEach((tok) => {
          if (tok && haystack.includes(tok)) {
            score += 1200;
          }
        });
        if (category && primaryTokens.some((t) => category.includes(t))) {
          score += 6000;
        }
      }
    }

    return score;
   }, [getImageBoost, selectedImageUri]);

  const fetchFirestoreFallback = useCallback(async (textToSearch: string) => {
    const snapshot = await getDocs(
      firestoreQuery(collection(db, 'products'), limit(350))
    );

    const normalizedQuery = normalize(textToSearch);
    const queryTokens = normalizedQuery.split(' ').filter(Boolean);

    const fallbackHits = snapshot.docs
      .map((doc) => {
        const data = doc.data() as Record<string, any>;
        const images = [
          data.mainImage,
          data.imageUrl,
          data.image,
          ...(Array.isArray(data.images) ? data.images : []),
        ].filter(Boolean).map((item) => String(item));

        const name = String(data.name || '');
        const supplier = String(data.supplier || data.companyName || '');
        const categoryName = String(data.categoryName || data.category || '');
        const haystack = normalize(`${name} ${supplier} ${categoryName}`);

        const hasQueryTokens = queryTokens.some((token) => haystack.includes(token));
        const exactImageMatch = selectedImageUri
          ? images.some((uri) => uri === selectedImageUri)
          : false;
        const fileNameMatch = selectedImageFileName
          ? images.some((uri) => {
              const lowerUri = uri.toLowerCase();
              const lowerFile = selectedImageFileName.toLowerCase();
              const lowerBase = lowerFile.replace(/\.[a-z0-9]+$/i, '');
              return lowerUri.includes(lowerFile) || lowerUri.includes(lowerBase);
            })
          : false;
        const tokenMatchCount = selectedImageTokens.reduce(
          (sum, token) => sum + (haystack.includes(token) || images.some((uri) => uri.toLowerCase().includes(token)) ? 1 : 0),
          0
        );

        const score =
          scoreMatch(name, textToSearch) +
          (hasQueryTokens ? 60 : 0) +
          tokenMatchCount * 45 +
          (fileNameMatch ? 3000 : 0) +
          (exactImageMatch ? 10000 : 0) +
          (data.featured ? 12 : 0);

        return {
          objectID: doc.id,
          name,
          price: Number(data.price) || 0,
          currency: data.currency || 'XOF',
          supplier,
          companyName: data.companyName || supplier,
          companyId: data.companyId,
          mainImage: data.mainImage || data.imageUrl || data.image,
          imageUrl: data.imageUrl || data.mainImage || data.image,
          image: data.image || data.imageUrl || data.mainImage,
          featured: Boolean(data.featured),
          updatedAt:
            typeof data?.updatedAt?.toMillis === 'function'
              ? data.updatedAt.toMillis()
              : (typeof data?.updatedAt === 'number' ? data.updatedAt : 0),
          category: data.category,
          categoryName: data.categoryName,
          images,
          _score: score,
        };
      })
      .filter((item: any) => item._score > 0)
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 60);

    return fallbackHits as SearchHit[];
  }, [selectedImageFileName, selectedImageTokens, selectedImageUri]);

  const performAlgoliaSearch = useCallback(async (
    textToSearch: string,
    descriptor?: VisualSearchDescriptor | null
  ) => {
    try {
      const searchText = textToSearch.trim();
      const mergedMap = new Map<string, SearchHit>();

      // Phase 1: résultats prioritaires (affichage immédiat)
      const exactP = index.search(searchText, {
        hitsPerPage: 12,
        restrictSearchableAttributes: ['name'],
        queryType: 'prefixNone',
        typoTolerance: false,
      });
      const localVisualP = isImageSearch && descriptor
        ? searchProductsByVisualDescriptor(descriptor, { limit: 40 })
        : Promise.resolve([]);

      const [exactRes, localVisualRes] = await Promise.allSettled([exactP, localVisualP]);

      if (exactRes.status === 'fulfilled') {
        exactRes.value.hits.forEach((hit: any) => mergedMap.set(hit.objectID, hit as SearchHit));
      }
      if (localVisualRes.status === 'fulfilled') {
        localVisualRes.value.forEach((hit: any) => {
          const current = mergedMap.get(hit.objectID);
          mergedMap.set(hit.objectID, {
            ...(current || {}),
            ...hit,
            sourceType: current?.sourceType || 'firebase',
            visualScore: Math.max(Number(current?.visualScore || 0), Number(hit.visualScore || 0)),
          });
        });
      }

      let initial = Array.from(mergedMap.values())
        .sort((a, b) => {
          const scoreA = getRankingScore(a, searchText, descriptor);
          const scoreB = getRankingScore(b, searchText, descriptor);
          if (scoreA !== scoreB) return scoreB - scoreA;
          return (Number(b?.updatedAt) || 0) - (Number(a?.updatedAt) || 0);
        })
        .slice(0, 36)
        .map(normalizeHitImages);

      if (initial.length > 0) {
        setResults(initial);
        setLoading(false); // Affiche tout de suite les premiers résultats
      }

      // Phase 2: enrichissement (large Algolia + API serveur)
      const broadP = index.search(searchText, {
        hitsPerPage: 48,
        restrictSearchableAttributes: ['name'],
        typoTolerance: true,
        ignorePlurals: true,
        removeStopWords: ['fr'],
        queryType: 'prefixLast',
      });
      const apiVisualP = isImageSearch
        ? searchServerVisualProducts(searchText, descriptor, 24).catch(() => [])
        : Promise.resolve([]);

      const [broadRes, apiVisualResults] = await Promise.allSettled([broadP, apiVisualP]);

      if (broadRes.status === 'fulfilled') {
        broadRes.value.hits.forEach((hit: any) => {
          const current = mergedMap.get(hit.objectID);
          mergedMap.set(hit.objectID, { ...(current || {}), ...(hit as SearchHit) });
        });
      }
      if (apiVisualResults.status === 'fulfilled') {
        apiVisualResults.value.forEach((hit: any) => {
          const current = mergedMap.get(hit.id);
          mergedMap.set(hit.id, {
            ...(current || {}),
            objectID: hit.id,
            name: hit.name,
            description: hit.description || current?.description,
            price: Number(hit.price || current?.price || 0),
            currency: current?.currency || 'XOF',
            supplier: current?.supplier || 'ASSMA',
            companyName: current?.companyName || 'ASSMA',
            mainImage: hit.imageUrl || current?.mainImage,
            imageUrl: hit.imageUrl || current?.imageUrl,
            image: hit.imageUrl || current?.image,
            category: String(hit.categoryName || current?.category || ''),
            categoryName: String(hit.categoryName || current?.categoryName || ''),
            sourceType: 'api',
            visualScore: Math.max(Number(current?.visualScore || 0), Number(hit.visualScore || 0)),
            images: current?.images || (hit.imageUrl ? [hit.imageUrl] : []),
          });
        });
      }

      let merged = Array.from(mergedMap.values()).sort((a, b) => {
        const scoreA = getRankingScore(a, searchText, descriptor);
        const scoreB = getRankingScore(b, searchText, descriptor);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return (Number(b?.updatedAt) || 0) - (Number(a?.updatedAt) || 0);
      });

      if (isImageSearch && descriptor) {
        const primaryTokens = buildPrimaryTokens(descriptor);
        if (primaryTokens.length > 0) {
          const isPrimary = (item: SearchHit) => {
            const text = normalize(`${item?.name || ''} ${item?.categoryName || ''} ${item?.category || ''}`);
            return primaryTokens.some((t) => text.includes(t));
          };
          const primary = merged.filter(isPrimary);
          const others = merged.filter((i) => !isPrimary(i));
          merged = [...primary, ...others];
        }
      }

      if (isImageSearch && merged.length < 20) {
        const fallbackHits = await fetchFirestoreFallback(searchText);
        fallbackHits.forEach((hit) => {
          const current = mergedMap.get(hit.objectID);
          mergedMap.set(hit.objectID, {
            ...(current || {}),
            ...hit,
            sourceType: current?.sourceType || 'firebase',
            visualScore: current?.visualScore,
          });
        });

        merged = Array.from(mergedMap.values()).sort((a, b) => {
          const scoreA = getRankingScore(a, searchText, descriptor);
          const scoreB = getRankingScore(b, searchText, descriptor);
          if (scoreA !== scoreB) return scoreB - scoreA;
          return (Number(b?.updatedAt) || 0) - (Number(a?.updatedAt) || 0);
        });

        if (isImageSearch && descriptor) {
          const primaryTokens = buildPrimaryTokens(descriptor);
          if (primaryTokens.length > 0) {
            const isPrimary = (item: SearchHit) => {
              const text = normalize(`${item?.name || ''} ${item?.categoryName || ''} ${item?.category || ''}`);
              return primaryTokens.some((t) => text.includes(t));
            };
            const primary = merged.filter(isPrimary);
            const others = merged.filter((i) => !isPrimary(i));
            merged = [...primary, ...others];
          }
        }
      }

      setResults(merged.map(normalizeHitImages));
      setLoading(false);
    } catch (error) {
      console.error('Algolia Search Error:', error);
      setResults([]);
      setLoading(false);
    }
  }, [fetchFirestoreFallback, getRankingScore, isImageSearch]);

  useEffect(() => {
    const handleSearchInit = async () => {
      setLoading(true);
      setSelectedCategory('Tous');
      let finalSearchText = queryText;
      let resolvedVisualDescriptor = visualDescriptor;

      try {
        if (isImageSearch && base64 && !resolvedVisualDescriptor) {
          setLoadingMsg("L'IA analyse votre photo...");
          resolvedVisualDescriptor = await analyzeImageForVisualSearch(String(base64), 'image/jpeg');
        }

        if (resolvedVisualDescriptor?.searchQuery) {
          finalSearchText = resolvedVisualDescriptor.searchQuery;
        }

        if (finalSearchText) {
          setLoadingMsg(isImageSearch ? 'Recherche visuelle des produits similaires...' : 'Recherche des produits...');
          await performAlgoliaSearch(finalSearchText, resolvedVisualDescriptor);
          return;
        }

        setResults([]);
        setLoading(false);
      } catch (error) {
        console.error('Erreur SearchInit:', error);
        setResults([]);
        setLoading(false);
      }
    };

    void handleSearchInit();
  }, [base64, isImageSearch, performAlgoliaSearch, queryText, visualDescriptor]);

  useEffect(() => {
    const imageUris = results
      .slice(0, 16)
      .flatMap((item) => [item.mainImage, item.imageUrl, item.image])
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .map((item) => String(item));

    if (!imageUris.length) {
      return;
    }

    Image.prefetch(imageUris, 'memory-disk').catch(() => {});
  }, [results]);

  const categoryOptions = useMemo(() => {
    const categories = Array.from(
      new Set(
        results
          .map((item) => item.categoryName || item.category)
          .filter(Boolean)
          .map((item) => String(item))
      )
    ).slice(0, 6);

    return ['Tous', ...categories];
  }, [results]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'Tous') {
      return results;
    }

    return results.filter((item) => {
      const category = item.categoryName || item.category || '';
      return String(category) === selectedCategory;
    });
  }, [results, selectedCategory]);

  const pagedProducts = useMemo(() => {
    if (!isImageSearch) {
      return filteredProducts.slice(0, page * PAGE_SIZE);
    }

    const primaryTokens = buildPrimaryTokens(visualDescriptor);
    if (primaryTokens.length === 0) {
      return filteredProducts.slice(0, page * PAGE_SIZE);
    }

    const isPrimary = (item: SearchHit) => {
      const text = normalize(`${item?.name || ''} ${item?.categoryName || ''} ${item?.category || ''}`);
      return primaryTokens.some((t) => text.includes(t));
    };

    const primary = filteredProducts.filter(isPrimary);
    const others = filteredProducts.filter((i) => !isPrimary(i));

    if (page === 1) {
      // Première vue = seulement les produits du type détecté
      return primary.slice(0, PAGE_SIZE);
    }

    // À partir de la page 2, on mélange : le reste des primaires puis les autres
    const remainingPrimary = primary.slice(PAGE_SIZE, page * PAGE_SIZE);
    const takeFromOthers = Math.max(0, page * PAGE_SIZE - (PAGE_SIZE + remainingPrimary.length));
    return [...primary.slice(0, page * PAGE_SIZE), ...others.slice(0, takeFromOthers)];
  }, [PAGE_SIZE, filteredProducts, isImageSearch, page, visualDescriptor]);

  const supplierResults = useMemo(() => {
    const supplierMap = new Map<
      string,
      { id: string; name: string; image?: string; productCount: number; companyId?: string }
    >();

    results.forEach((item) => {
      const supplierName = String(item.supplier || item.companyName || '').trim();
      if (!supplierName) {
        return;
      }

      const key = supplierName.toLowerCase();
      const current = supplierMap.get(key);

      if (current) {
        current.productCount += 1;
        if (!current.image) {
          current.image = item.mainImage || item.imageUrl || item.image;
        }
        if (!current.companyId && item.companyId) {
          current.companyId = item.companyId;
        }
        return;
      }

      supplierMap.set(key, {
        id: key,
        name: supplierName,
        image: item.mainImage || item.imageUrl || item.image,
        productCount: 1,
        companyId: item.companyId,
      });
    });

    return Array.from(supplierMap.values()).sort((a, b) => b.productCount - a.productCount);
  }, [results]);

  const productData = useMemo<(SearchHit | SelectedImageCard)[]>(() => {
    if (isImageSearch && selectedImageUri) {
      return [
        { objectID: 'selected-image-card', __selectedImage: true, imageUri: selectedImageUri },
        ...pagedProducts,
      ];
    }

    return pagedProducts;
  }, [pagedProducts, isImageSearch, selectedImageUri]);

  const canLoadMore = useMemo(
    () => page * PAGE_SIZE < filteredProducts.length,
    [filteredProducts.length, page, PAGE_SIZE]
  );

  const handleLoadMore = useCallback(() => {
    if (loading) return;
    if (!canLoadMore) return;
    setPage((p) => p + 1);
  }, [canLoadMore, loading]);

  const renderProduct = useCallback(({ item }: { item: SearchHit | SelectedImageCard }) => {
    if ('__selectedImage' in item) {
      return (
        <View style={[styles.card, styles.selectedImageCard]}>
          <Image
            source={{ uri: item.imageUri }}
            style={styles.productImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
          />
          <View style={styles.selectedImageBadge}>
            <Ionicons name="image-outline" size={14} color="#fff" />
            <Text style={styles.selectedImageBadgeText}>Votre image</Text>
          </View>
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              Image choisie
            </Text>
            <Text style={styles.supplierName} numberOfLines={2}>
              Nous plaçons votre photo en premier, puis les articles similaires.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: '/product/[id]',
            params: {
              id: item.objectID,
              initialProductData: JSON.stringify(item),
            },
          })
        }
        activeOpacity={0.92}
      >
        <Image
          source={{ uri: item.mainImage || item.imageUrl || item.image }}
          style={styles.productImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.productPrice}>
            {Number(item.price || 0).toLocaleString()} {item.currency || 'XOF'}
          </Text>
          <Text style={styles.supplierName} numberOfLines={1}>
            {item.supplier || item.companyName || 'Fournisseur'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [router]);

  const renderSupplier = useCallback(({ item }: { item: { id: string; name: string; image?: string; productCount: number; companyId?: string } }) => (
    <TouchableOpacity
      style={styles.supplierCard}
      activeOpacity={item.companyId ? 0.9 : 1}
      onPress={() => {
        if (item.companyId) {
          router.push({ pathname: '/company/[id]', params: { id: item.companyId, name: item.name } });
        }
      }}
    >
      <Image
        source={{ uri: item.image || 'https://via.placeholder.com/120' }}
        style={styles.supplierImage}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
      <View style={styles.supplierInfo}>
        <Text style={styles.supplierCardTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.supplierCardMeta}>
          {item.productCount} produit{item.productCount > 1 ? 's' : ''} similaire{item.productCount > 1 ? 's' : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#b56d27" />
    </TouchableOpacity>
  ), [router]);

  const emptyComponent = (
    <View style={styles.emptyContainer}>
      <Ionicons name={activeTab === 'products' ? 'search-outline' : 'business-outline'} size={64} color="#d0c7bf" />
      <Text style={styles.emptyText}>
        {activeTab === 'products' ? 'Aucun produit exact trouvé.' : 'Aucun fournisseur pertinent trouvé.'}
      </Text>
      <Text style={styles.emptySubText}>
        Essayez une image plus nette ou un autre angle du produit.
      </Text>
    </View>
  );

  const listHeader = (
    <View>
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'products' && styles.tabButtonActive]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>Produits</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'suppliers' && styles.tabButtonActive]}
          onPress={() => setActiveTab('suppliers')}
        >
          <Text style={[styles.tabText, activeTab === 'suppliers' && styles.tabTextActive]}>Fournisseurs</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'products' && (
        <>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {filteredProducts.length} résultat{filteredProducts.length > 1 ? 's' : ''} similaire{filteredProducts.length > 1 ? 's' : ''}
            </Text>
            {isImageSearch && (
              <View style={styles.visualSearchBadge}>
                <Ionicons name="sparkles-outline" size={14} color="#d86a11" />
                <Text style={styles.visualSearchBadgeText}>Recherche visuelle</Text>
              </View>
            )}
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categoryOptions}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.chipsRow}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.filterChip, selectedCategory === item && styles.filterChipActive]}
                onPress={() => setSelectedCategory(item)}
              >
                <Text style={[styles.filterChipText, selectedCategory === item && styles.filterChipTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={22} color="#7c6b5f" />
          {selectedImageUri ? (
            <Image
              source={{ uri: selectedImageUri }}
              style={styles.searchPreviewImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
            />
          ) : null}
          <Text style={styles.searchBarText} numberOfLines={1}>
            {queryText || 'Rechercher'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#33251a" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#ff6a00" />
          <Text style={styles.loaderText}>{loadingMsg}</Text>
        </View>
      ) : activeTab === 'products' ? (
        <FlatList
          key="products-grid"
          data={productData}
          keyExtractor={(item) => item.objectID}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyComponent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={9}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReachedThreshold={0.2}
          onEndReached={handleLoadMore}
        />
      ) : (
        <FlatList
          key="suppliers-list"
          data={supplierResults}
          keyExtractor={(item) => item.id}
          renderItem={renderSupplier}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={emptyComponent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={9}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f3ef',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#efe4da',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4f0ed',
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 52,
  },
  searchPreviewImage: {
    width: 28,
    height: 28,
    borderRadius: 8,
    marginLeft: 10,
    marginRight: 8,
  },
  searchBarText: {
    flex: 1,
    fontSize: 16,
    color: '#5c4b3f',
    marginLeft: 10,
  },
  closeButton: {
    marginLeft: 12,
    padding: 4,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loaderText: {
    marginTop: 12,
    color: '#6f6259',
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    paddingTop: 14,
    paddingHorizontal: 4,
    backgroundColor: '#f7f3ef',
  },
  tabButton: {
    paddingBottom: 10,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#1f1f1f',
  },
  tabText: {
    fontSize: 17,
    color: '#8d7d72',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#1f1f1f',
    fontWeight: '800',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  summaryText: {
    color: '#594438',
    fontSize: 13,
    fontWeight: '600',
  },
  visualSearchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1e4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  visualSearchBadgeText: {
    color: '#d86a11',
    fontSize: 12,
    fontWeight: '700',
  },
  chipsRow: {
    paddingBottom: 14,
    gap: 10,
  },
  filterChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ead8c9',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: '#1f1f1f',
    borderColor: '#1f1f1f',
  },
  filterChipText: {
    color: '#5e5046',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  productRow: {
    justifyContent: 'space-between',
  },
  card: {
    width: COLUMN_WIDTH,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#efe4da',
    ...Platform.select({
      ios: {
        shadowColor: '#8f6d54',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  selectedImageCard: {
    borderColor: '#ffcfaa',
    backgroundColor: '#fff8f1',
  },
  selectedImageBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 24, 17, 0.82)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  selectedImageBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  productImage: {
    width: '100%',
    height: 176,
    backgroundColor: '#f0ebe7',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2f241b',
    minHeight: 42,
  },
  productPrice: {
    color: '#ff6a00',
    fontWeight: '800',
    fontSize: 18,
    marginTop: 6,
  },
  supplierName: {
    fontSize: 12,
    color: '#8b7b70',
    marginTop: 4,
    lineHeight: 18,
  },
  supplierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#efe4da',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#8f6d54',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  supplierImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#f0ebe7',
  },
  supplierInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  supplierCardTitle: {
    color: '#2f241b',
    fontSize: 15,
    fontWeight: '700',
  },
  supplierCardMeta: {
    color: '#8b7b70',
    fontSize: 12,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5f564f',
    marginTop: 15,
  },
  emptySubText: {
    fontSize: 14,
    color: '#9b8f86',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
