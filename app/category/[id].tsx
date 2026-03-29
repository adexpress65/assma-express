import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, startAfter } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrency } from '../../src/contexts/CurrencyContext';
import { isZeroDollarsShop } from '../../src/utils/zeroDollarsShop';
import ZeroDollarsFreeBadge from '../../src/components/ZeroDollarsFreeBadge';

const PAGE_SIZE = 24;
const CATEGORY_CACHE_TTL_MS = 5 * 60 * 1000;

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

function normalizeProduct(docSnap: any): CategoryProduct {
  const data = docSnap.data();
  const currentPrice = Number(data.price) || 0;

  return {
    id: docSnap.id,
    name: data.name || 'Produit sans nom',
    price: currentPrice,
    originalPrice: Number(data.originalPrice || currentPrice),
    image: data.mainImage || data.imageUrl || (Array.isArray(data.images) ? data.images[0] : '') || 'https://via.placeholder.com/300',
    rating: data.rating !== undefined ? Number(data.rating) : 0,
    supplier: data.supplier || data.companyName || 'Fournisseur',
    companyName: data.companyName || data.supplier || '',
    minOrder: data.minOrder || 1,
    categoryId: data.categoryId,
    categoryName: data.categoryName,
    hasFreeShipping: Boolean(data.hasFreeShipping),
  };
}

export default function CategoryPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const categoryId = params.categoryId as string || params.id as string || 'all';
  const categoryName = params.categoryName as string || getCategoryNameFromId(categoryId);
  const preselectedProductId = (params.targetProductId || params.selectedProductId) as string;
  const selectedProductPayload = params.selectedProductData as string | undefined;
  const { formatPrice } = useCurrency();

  const preloadedSelectedProduct = useMemo(() => {
    if (!selectedProductPayload) {
      return null;
    }

    try {
      return JSON.parse(selectedProductPayload) as CategoryProduct;
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
        if (hasFreshCache) {
          setProducts(cached.products);
          setLastDoc(cached.lastDoc);
          setHasMore(cached.hasMore);

          const cachedSelected =
            cached.products.find((item) => item.id === preselectedProductId) ||
            preloadedSelectedProduct ||
            cached.products[0] ||
            null;

          setSelectedProduct(cachedSelected);
          setSelectedProductId(cachedSelected?.id || null);
          setLoading(false);
        } else {
          setLoading(true);
          setProducts(preloadedSelectedProduct ? [preloadedSelectedProduct] : []);
          setLastDoc(null);
          setHasMore(true);
          setSelectedProduct(preloadedSelectedProduct);
          setSelectedProductId(preselectedProductId || preloadedSelectedProduct?.id || null);
        }

        let directProduct: CategoryProduct | null = null;

        if (preloadedSelectedProduct) {
          directProduct = preloadedSelectedProduct;
        } else if (preselectedProductId) {
          const productRef = doc(db, 'products', preselectedProductId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            directProduct = normalizeProduct(productSnap);
          }
        }

        const snapshot = await getDocs(buildProductsQuery());
        if (snapshot.docs.length > 0) {
          setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
          setHasMore(snapshot.docs.length === PAGE_SIZE);
        } else {
          setHasMore(false);
        }

        const productsData = snapshot.docs.map((docSnap) => normalizeProduct(docSnap));
        const mergedProducts = directProduct
          ? [directProduct, ...productsData.filter((item) => item.id !== directProduct?.id)]
          : productsData;

        setProducts(mergedProducts);

        const found = preselectedProductId
          ? mergedProducts.find((item) => item.id === preselectedProductId)
          : null;
        const finalSelection = directProduct || found || mergedProducts[0] || null;
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
    const imageUris = products
      .slice(0, 16)
      .map((item) => item.image)
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .map((item) => String(item));

    if (!imageUris.length) {
      return;
    }

    Image.prefetch(imageUris, 'memory-disk').catch(() => {});
  }, [products]);

  const relatedProducts = useMemo(
    () => products.filter((product) => product.id !== selectedProductId),
    [products, selectedProductId]
  );

  const handleViewProductDetail = useCallback(() => {
    if (selectedProduct) {
      router.push(`/product/${selectedProduct.id}`);
    }
  }, [router, selectedProduct]);

  const handleSelectProduct = useCallback((product: CategoryProduct) => {
    setSelectedProduct(product);
    setSelectedProductId(product.id);
  }, []);

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
    if (!selectedProduct) return null;

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
              source={{ uri: selectedProduct.image }}
              style={styles.previewImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
            />
            {isZeroDollarsShop({
              companyName: selectedProduct.companyName,
              supplier: selectedProduct.supplier,
            }) && (
              <View style={styles.previewZeroDollarsBadge}>
                <ZeroDollarsFreeBadge compact />
              </View>
            )}
          </View>

          <View style={styles.previewInfo}>
            <Text style={styles.previewName} numberOfLines={2}>{selectedProduct.name}</Text>
            
            <View style={styles.previewPriceRow}>
              {selectedProduct.originalPrice > selectedProduct.price && (
                <Text style={styles.originalPrice}>
                  {formatPrice(selectedProduct.originalPrice)}
                </Text>
              )}
              <Text style={styles.currentPrice}>
                {formatPrice(selectedProduct.price)}
              </Text>
            </View>

            <View style={styles.previewDetails}>
              <Text style={styles.detailText}>Min: {selectedProduct.minOrder} unités</Text>
              <Text style={styles.detailText}>⭐ {selectedProduct.rating.toFixed(1)} | {selectedProduct.supplier}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [formatPrice, handleViewProductDetail, selectedProduct]);

  const renderProductCard = useCallback(({ item: product }: { item: CategoryProduct }) => (
    <TouchableOpacity
      style={[
        styles.productCard,
        selectedProductId === product.id && styles.productCardSelected
      ]}
      onPress={() => handleSelectProduct(product)}
      activeOpacity={0.85}
    >
      <View style={styles.imageWrapper}>
        <Image
          source={{ uri: product.image }}
          style={styles.productImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
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
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>

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
  ), [formatPrice, handleSelectProduct, selectedProductId]);

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
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={8}
          removeClippedSubviews={Platform.OS === 'android'}
        />

        {selectedProduct && (
          <View style={[styles.floatingAction, { bottom: BOTTOM_PADDING, left: 16, right: 16 }]}>
            <TouchableOpacity style={styles.actionButton} onPress={handleViewProductDetail}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="document-text" size={20} color="#fff" />
                <Text style={styles.actionButtonText} numberOfLines={1}>
                  Voir la fiche de {selectedProduct.name}
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
    alignItems: 'center' 
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
    shadowRadius: 8 
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
    borderColor: '#f0f0f0' 
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
