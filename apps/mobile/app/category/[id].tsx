import React, { useCallback, useEffect, useMemo, useState, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Platform,
  InteractionManager,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, startAfter } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useTranslation } from 'react-i18next';
import { getLocalizedProductText } from '../../src/utils/productLocale';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrency } from '../../src/contexts/CurrencyContext';
import { isZeroDollarsShop } from '../../src/utils/zeroDollarsShop';
import ZeroDollarsFreeBadge from '../../src/components/ZeroDollarsFreeBadge';

const PAGE_SIZE = 24;
const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000;

const IMG_BLURHASH =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{olj[ayj[j[fQayayayayayayayaya{j[ayj[ayj[ayayayayayayayayoJ';

const categoryProductsCache = new Map<
  string,
  { products: CategoryProduct[]; lastDoc: any; hasMore: boolean; timestamp: number }
>();

type CategoryProduct = {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  rating: number;
  supplier: string;
  companyName: string;
  minOrder: number;
  categoryId?: string;
  categoryName?: string;
  hasFreeShipping: boolean;
};

const getCategoryNameFromId = (categoryId: string): string => {
  const categoryMap: { [key: string]: string } = {
    'fKNpSZ7NgqyMw7uZW15w': 'Électroniques',
    'autre_id': 'Autre Catégorie',
  };
  return categoryMap[categoryId] || 'Catégorie';
};

/** Expo Router peut passer string | string[] pour les query params. */
function paramToOptionalString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  return s != null && String(s).trim() !== '' ? String(s) : undefined;
}

function firstImageFromImagesField(images: unknown): string {
  if (!Array.isArray(images) || images.length === 0) return '';
  const first = images[0];
  if (typeof first === 'string' && first.trim()) return first.trim();
  if (first && typeof first === 'object') {
    const o = first as Record<string, unknown>;
    const u = o.url ?? o.src ?? o.uri;
    return typeof u === 'string' && u.trim() ? u.trim() : '';
  }
  return '';
}

/** Même logique que partout ailleurs : plusieurs clés possibles dans Firestore. */
function imageUrlFromProductData(data: Record<string, unknown> | null | undefined): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as Record<string, unknown>;
  const direct =
    (typeof d.mainImage === 'string' && d.mainImage.trim()) ||
    (typeof d.imageUrl === 'string' && d.imageUrl.trim()) ||
    (typeof d.image === 'string' && d.image.trim()) ||
    (typeof d.thumbnail === 'string' && d.thumbnail.trim()) ||
    (typeof d.photo === 'string' && d.photo.trim()) ||
    (typeof d.coverImage === 'string' && d.coverImage.trim()) ||
    firstImageFromImagesField(d.images);
  return direct ? String(direct) : '';
}

function normalizeProduct(docSnap: any): CategoryProduct {
  const data = docSnap.data();
  const currentPrice = Number(data.price) || 0;
  const resolved =
    imageUrlFromProductData(data) || 'https://via.placeholder.com/300';

  return {
    ...(typeof data === 'object' && data ? data : {}),
    id: docSnap.id,
    name: data.name || 'Produit sans nom',
    price: currentPrice,
    originalPrice: Number(data.originalPrice || currentPrice),
    image: resolved,
    rating: data.rating !== undefined ? Number(data.rating) : 0,
    supplier: data.supplier || data.companyName || 'Fournisseur',
    companyName: data.companyName || data.supplier || '',
    minOrder: data.minOrder || 1,
    categoryId: data.categoryId,
    categoryName: data.categoryName,
    hasFreeShipping: Boolean(data.hasFreeShipping),
  } as CategoryProduct;
}

/** Données venant de JSON (navigation) : les clés peuvent différer de CategoryProduct. */
function coerceCategoryProduct(raw: any): CategoryProduct {
  const image =
    raw?.image ||
    raw?.mainImage ||
    raw?.imageUrl ||
    firstImageFromImagesField(raw?.images) ||
    '';
  return {
    ...(raw && typeof raw === 'object' ? raw : {}),
    id: String(raw?.id ?? ''),
    name: raw?.name || 'Produit sans nom',
    price: Number(raw?.price) || 0,
    originalPrice: Number(raw?.originalPrice ?? raw?.price) || 0,
    image: image ? String(image) : '',
    rating: raw?.rating !== undefined ? Number(raw.rating) : 0,
    supplier: raw?.supplier || raw?.companyName || 'Fournisseur',
    companyName: raw?.companyName || raw?.supplier || '',
    minOrder: raw?.minOrder || 1,
    categoryId: raw?.categoryId,
    categoryName: raw?.categoryName,
    hasFreeShipping: Boolean(raw?.hasFreeShipping),
  } as CategoryProduct;
}

function hasRenderableImage(p: CategoryProduct | null | undefined): boolean {
  return Boolean(p?.image && String(p.image).trim().length > 0);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff',
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { marginRight: 12 },
  titleContainer: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  productCount: { fontSize: 13, color: '#666' },
  contentWrapper: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  previewContainer: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  previewTitle: { fontSize: 16, fontWeight: '700' },
  viewDetailButton: { flexDirection: 'row', alignItems: 'center' },
  viewDetailText: { color: '#FF6A00', fontSize: 12, marginRight: 4, fontWeight: '600' },
  productPreview: { flexDirection: 'row' },
  previewImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
    position: 'relative',
    overflow: 'hidden',
  },
  previewZeroDollarsBadge: { position: 'absolute', bottom: 2, left: 2, zIndex: 2 },
  previewImage: { width: '100%', height: '100%', borderRadius: 8 },
  previewInfo: { flex: 1, justifyContent: 'center' },
  previewName: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  previewPriceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  originalPrice: { fontSize: 12, color: '#999', textDecorationLine: 'line-through', marginRight: 8 },
  currentPrice: { fontSize: 18, fontWeight: '800', color: '#FF6A00' },
  previewDetails: { marginTop: 4 },
  detailText: { fontSize: 11, color: '#666' },
  productsSection: { backgroundColor: '#fff', paddingTop: 20, marginTop: 8 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  productsGrid: { justifyContent: 'space-between', paddingHorizontal: 8 },
  productCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  productCardSelected: { borderColor: '#FF6A00', backgroundColor: '#FFF9F5' },
  imageWrapper: { position: 'relative', width: '100%', marginBottom: 8 },
  productImage: { width: '100%', height: 120, borderRadius: 8, backgroundColor: '#f5f5f5' },
  promoBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#FF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  promoText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  categoryZeroDollarsBadge: { position: 'absolute', bottom: 4, left: 4, zIndex: 3 },
  oldPriceSmall: { fontSize: 11, color: '#999', textDecorationLine: 'line-through', marginLeft: 6 },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: '#E8F8EE',
  },
  miniBadgeText: { fontSize: 9, fontWeight: '600' },
  productInfo: { flex: 1 },
  productName: { fontSize: 12, fontWeight: '600', marginBottom: 4, height: 32 },
  productPriceRow: { marginBottom: 4 },
  productPrice: { fontSize: 14, fontWeight: '800', color: '#FF6A00' },
  productMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  productMetaText: { fontSize: 10, color: '#666' },
  listFooter: { paddingVertical: 12 },
  listFooterSpacing: { height: 8 },
  floatingAction: { position: 'absolute', zIndex: 100 },
  actionButton: { backgroundColor: '#FF6A00', borderRadius: 12, height: 56, justifyContent: 'center', elevation: 4 },
  actionButtonContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center' },
});

type CategoryProductCardProps = {
  product: CategoryProduct;
  selected: boolean;
  index: number;
  onPressProduct: (p: CategoryProduct) => void;
  formatPrice: (n: number) => string;
  uiLanguage: string;
};

const CategoryProductCard = memo(function CategoryProductCard({
  product,
  selected,
  index,
  onPressProduct,
  formatPrice,
  uiLanguage,
}: CategoryProductCardProps) {
  const title = getLocalizedProductText(
    product.name,
    'name',
    product as unknown as Record<string, unknown>,
    uiLanguage,
  );
  return (
    <TouchableOpacity
      style={[styles.productCard, selected && styles.productCardSelected]}
      onPress={() => onPressProduct(product)}
      activeOpacity={0.85}
    >
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: product.image }}
          style={styles.productImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
          placeholder={IMG_BLURHASH}
          placeholderContentFit="cover"
          priority={index < 8 ? 'high' : 'normal'}
          allowDownscaling
          recyclingKey={product.id}
        />
        {product.originalPrice > product.price && (
          <View style={styles.promoBadge}>
            <Text style={styles.promoText}>PROMO</Text>
          </View>
        )}
        {isZeroDollarsShop({
          companyName: product.companyName,
          supplier: product.supplier,
        }) && (
          <View style={styles.categoryZeroDollarsBadge}>
            <ZeroDollarsFreeBadge compact />
          </View>
        )}
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{title}</Text>

        <View style={styles.productPriceRow}>
          <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
          {product.originalPrice > product.price && (
            <Text style={styles.oldPriceSmall}>{formatPrice(product.originalPrice)}</Text>
          )}
        </View>

        <View style={styles.productMeta}>
          {product.hasFreeShipping && (
            <View style={styles.miniBadge}>
              <Ionicons name="airplane" size={8} color="#00B050" />
              <Text style={[styles.miniBadgeText, { color: '#00B050' }]}>Gratuit</Text>
            </View>
          )}
          <Text style={styles.productMetaText}>Min: {product.minOrder}</Text>
          <Text style={styles.productMetaText}>⭐ {product.rating || '5.0'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function CategoryPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const categoryId =
    paramToOptionalString(params.categoryId as string | string[] | undefined) ||
    paramToOptionalString(params.id as string | string[] | undefined) ||
    'all';
  const categoryName = (params.categoryName as string) || getCategoryNameFromId(categoryId);
  const preselectedProductId = paramToOptionalString(
    (params.targetProductId || params.selectedProductId) as string | string[] | undefined
  );
  const selectedProductPayload = params.selectedProductData as string | undefined;
  const { formatPrice } = useCurrency();
  const { i18n } = useTranslation();

  const preloadedSelectedProduct = useMemo(() => {
    if (!selectedProductPayload) {
      return null;
    }

    try {
      return coerceCategoryProduct(JSON.parse(selectedProductPayload));
    } catch {
      return null;
    }
  }, [selectedProductPayload]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [products, setProducts] = useState<CategoryProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<CategoryProduct | null>(preloadedSelectedProduct);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    preselectedProductId || preloadedSelectedProduct?.id || null
  );
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 83 : 60;
  const BOTTOM_PADDING = insets.bottom + TAB_BAR_HEIGHT + 20;
  const BUTTON_HEIGHT = 56;

  const buildProductsQuery = useCallback((cursor?: any) => {
    const productsRef = collection(db, 'products');

    if (categoryId === 'all' || categoryId === 'tous') {
      return cursor
        ? query(productsRef, orderBy('createdAt', 'desc'), startAfter(cursor), limit(PAGE_SIZE))
        : query(productsRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    }

    return cursor
      ? query(
          productsRef,
          where('categoryId', '==', categoryId),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
          startAfter(cursor),
          limit(PAGE_SIZE)
        )
      : query(
          productsRef,
          where('categoryId', '==', categoryId),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE)
        );
  }, [categoryId]);

  useEffect(() => {
    const loadCategoryProducts = async () => {
      const cached = categoryProductsCache.get(categoryId);
      const hasFreshCache =
        cached && Date.now() - cached.timestamp < CATEGORY_CACHE_TTL_MS;

      try {
        if (hasFreshCache && cached) {
          setProducts(cached.products);
          setLastDoc(cached.lastDoc);
          setHasMore(cached.hasMore);

          const fromList = preselectedProductId
            ? cached.products.find((item) => String(item.id) === String(preselectedProductId))
            : null;
          const cachedSelected =
            fromList ||
            preloadedSelectedProduct ||
            cached.products[0] ||
            null;

          setSelectedProduct(cachedSelected);
          setSelectedProductId(cachedSelected?.id || null);
          setLoading(false);
          return;
        }

        setLoading(true);
        setProducts(preloadedSelectedProduct ? [preloadedSelectedProduct] : []);
        setLastDoc(null);
        setHasMore(true);
        setSelectedProduct(preloadedSelectedProduct);
        setSelectedProductId(preselectedProductId || preloadedSelectedProduct?.id || null);

        const snapshot = await getDocs(buildProductsQuery());

        if (snapshot.docs.length > 0) {
          setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
          setHasMore(snapshot.docs.length === PAGE_SIZE);
        } else {
          setHasMore(false);
        }

        const productsData = snapshot.docs.map((docSnap) => normalizeProduct(docSnap));
        const firestoreMatch = preselectedProductId
          ? productsData.find((item) => String(item.id) === String(preselectedProductId))
          : null;

        let directProduct: CategoryProduct | null = preloadedSelectedProduct;

        if (!firestoreMatch && preselectedProductId) {
          const singleSnap = await getDoc(doc(db, 'products', preselectedProductId));
          if (singleSnap.exists()) {
            directProduct = normalizeProduct(singleSnap);
          }
        }

        const mergedProducts =
          directProduct &&
          !productsData.some((item) => String(item.id) === String(directProduct!.id))
            ? [directProduct, ...productsData]
            : productsData;

        setProducts(mergedProducts);

        const finalSelection =
          firestoreMatch ||
          directProduct ||
          mergedProducts[0] ||
          null;
        setSelectedProduct(finalSelection);
        setSelectedProductId(finalSelection?.id || null);

        categoryProductsCache.set(categoryId, {
          products: mergedProducts,
          lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
          hasMore: snapshot.docs.length === PAGE_SIZE,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.error('🔥 Erreur:', e);
      } finally {
        setLoading(false);
      }
    };

    loadCategoryProducts();
  }, [buildProductsQuery, categoryId, preloadedSelectedProduct, preselectedProductId]);

  useEffect(() => {
    if (!products.length) return;
    const uris = [...new Set(products.slice(0, 24).map((p) => String(p.image)).filter(Boolean))];
    if (!uris.length) return;

    const opts = { cachePolicy: 'memory-disk' as const };
    const head = uris.slice(0, 10);
    const tail = uris.slice(10);

    let t: ReturnType<typeof setTimeout> | undefined;
    const interaction = InteractionManager.runAfterInteractions(() => {
      Image.prefetch(head.length === 1 ? head[0] : head, opts).catch(() => {});
      if (tail.length) {
        t = setTimeout(() => {
          Image.prefetch(tail.length === 1 ? tail[0] : tail, opts).catch(() => {});
        }, 120);
      }
    });

    return () => {
      interaction.cancel();
      if (t) clearTimeout(t);
    };
  }, [products]);

  /** Aligne l’état sur la ligne Firestore chargée (même id, URL image à jour). */
  useEffect(() => {
    if (!selectedProductId || !products.length) return;
    const row = products.find((p) => String(p.id) === String(selectedProductId));
    if (!row || !hasRenderableImage(row)) return;
    if (
      selectedProduct &&
      String(selectedProduct.id) === String(row.id) &&
      selectedProduct.image === row.image
    ) {
      return;
    }
    setSelectedProduct(row);
  }, [products, selectedProductId, selectedProduct]);

  const relatedProducts = useMemo(
    () =>
      products.filter(
        (product) => String(product.id) !== String(selectedProductId ?? '')
      ),
    [products, selectedProductId]
  );

  /** Après chargement Firestore, la grille porte l’URL réelle — on l’utilise pour l’aperçu (évite le JSON accueil vide). */
  const previewProduct = useMemo(() => {
    if (!selectedProductId) return selectedProduct;
    const fromList = products.find(
      (p) => String(p.id) === String(selectedProductId)
    );
    return fromList ?? selectedProduct;
  }, [products, selectedProductId, selectedProduct]);

  const previewProductDisplayName = useMemo(
    () =>
      previewProduct
        ? getLocalizedProductText(
            previewProduct.name,
            'name',
            previewProduct as unknown as Record<string, unknown>,
            i18n.language,
          )
        : '',
    [previewProduct, i18n.language],
  );

  const selectedProductDisplayName = useMemo(
    () =>
      selectedProduct
        ? getLocalizedProductText(
            selectedProduct.name,
            'name',
            selectedProduct as unknown as Record<string, unknown>,
            i18n.language,
          )
        : '',
    [selectedProduct, i18n.language],
  );

  const handleViewProductDetail = useCallback(() => {
    if (selectedProduct) {
      router.push(`/product/${selectedProduct.id}`);
    }
  }, [router, selectedProduct]);

  const goToProductDetail = useCallback(
    (product: CategoryProduct) => {
      router.push(`/product/${product.id}`);
    },
    [router]
  );

  const loadMoreProducts = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDoc) {
      return;
    }

    setLoadingMore(true);
    try {
      const snapshot = await getDocs(buildProductsQuery(lastDoc));
      const nextItems = snapshot.docs.map((docSnap) => normalizeProduct(docSnap));

      setProducts((prev) => {
        const map = new Map(prev.map((item) => [item.id, item]));
        nextItems.forEach((item) => map.set(item.id, item));
        const merged = Array.from(map.values());

        categoryProductsCache.set(categoryId, {
          products: merged,
          lastDoc: snapshot.docs[snapshot.docs.length - 1] || lastDoc,
          hasMore: snapshot.docs.length === PAGE_SIZE,
          timestamp: Date.now(),
        });

        return merged;
      });

      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('Erreur pagination catégorie:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [buildProductsQuery, hasMore, lastDoc, loadingMore]);

  const renderProductPreview = useCallback(() => {
    if (!previewProduct) return null;

    const previewUri = hasRenderableImage(previewProduct)
      ? String(previewProduct.image).trim()
      : '';

    return (
      <View style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>Produit Sélectionné</Text>
          <TouchableOpacity style={styles.viewDetailButton} onPress={handleViewProductDetail}>
            <Text style={styles.viewDetailText}>Voir la fiche</Text>
            <Ionicons name="arrow-forward" size={16} color="#FF6A00" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.productPreview} onPress={handleViewProductDetail}>
          <View style={styles.previewImageContainer}>
            <Image
              key={`pv-${previewProduct.id}-${previewUri.slice(0, 80)}`}
              source={{
                uri: previewUri || 'https://via.placeholder.com/300',
              }}
              style={styles.previewImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
              placeholder={previewUri ? undefined : IMG_BLURHASH}
              placeholderContentFit="cover"
              priority="high"
              allowDownscaling
              recyclingKey={`pv-${previewProduct.id}-${previewUri.slice(0, 64)}`}
            />
            {isZeroDollarsShop({
              companyName: previewProduct.companyName,
              supplier: previewProduct.supplier,
            }) && (
              <View style={styles.previewZeroDollarsBadge}>
                <ZeroDollarsFreeBadge compact />
              </View>
            )}
          </View>

          <View style={styles.previewInfo}>
            <Text style={styles.previewName} numberOfLines={2}>{previewProductDisplayName}</Text>
            
            <View style={styles.previewPriceRow}>
              {previewProduct.originalPrice > previewProduct.price && (
                <Text style={styles.originalPrice}>
                  {formatPrice(previewProduct.originalPrice)}
                </Text>
              )}
              <Text style={styles.currentPrice}>
                {formatPrice(previewProduct.price)}
              </Text>
            </View>

            <View style={styles.previewDetails}>
              <Text style={styles.detailText}>Min: {previewProduct.minOrder} unités</Text>
              <Text style={styles.detailText}>
                ⭐ {Number.isFinite(previewProduct.rating) ? previewProduct.rating.toFixed(1) : '0.0'} |{' '}
                {previewProduct.supplier}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [formatPrice, handleViewProductDetail, previewProduct, previewProductDisplayName]);

  const renderProductCard = useCallback(
    ({ item, index }: { item: CategoryProduct; index: number }) => (
      <CategoryProductCard
        product={item}
        index={index}
        selected={selectedProductId === item.id}
        onPressProduct={goToProductDetail}
        formatPrice={formatPrice}
        uiLanguage={i18n.language}
      />
    ),
    [formatPrice, goToProductDetail, selectedProductId, i18n.language]
  );

  const listHeader = useMemo(() => (
    <View>
      {renderProductPreview()}
      <View style={styles.productsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Articles similaires</Text>
        </View>
      </View>
    </View>
  ), [renderProductPreview]);

  const listFooter = useMemo(() => (
    loadingMore ? (
      <View style={styles.listFooter}>
        <ActivityIndicator size="small" color="#FF6A00" />
      </View>
    ) : <View style={styles.listFooterSpacing} />
  ), [loadingMore]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6A00" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
<View style={styles.titleContainer}>
  <Text style={styles.title}>{categoryName}</Text>
  <Text style={styles.productCount}>Découvrez nos sélections</Text>
</View>
      </View>

      <View style={styles.contentWrapper}>
        <FlatList
          data={relatedProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProductCard}
          numColumns={2}
          columnWrapperStyle={styles.productsGrid}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BUTTON_HEIGHT + 100 }]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreProducts}
          onEndReachedThreshold={0.4}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={Platform.OS === 'android'}
        />

        {selectedProduct && (
          <View style={[styles.floatingAction, { bottom: BOTTOM_PADDING, left: 16, right: 16 }]}>
            <TouchableOpacity style={styles.actionButton} onPress={handleViewProductDetail}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="document-text" size={20} color="#fff" />
                <Text style={styles.actionButtonText} numberOfLines={1}>
                  Voir la fiche de {selectedProductDisplayName}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
