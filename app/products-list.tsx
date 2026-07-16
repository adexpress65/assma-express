// app/products-list.tsx
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getLocalizedProductText } from '@/utils/productLocale';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { getFirebaseImageUrl } from '@/utils/firebaseImage';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string | null;
  mainImage?: string | null;
  images?: string[];
  supplier: string;
  rating: number;
  originalLink?: string;
}

export default function ProductsListScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const params = useLocalSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (params.products) {
        const decodedProducts = JSON.parse(params.products as string);
        console.log('Nombre de produits reçus:', decodedProducts.length);
        setProducts(decodedProducts);
        
        // Charger les URLs des images pour tous les produits
        decodedProducts.forEach((product: Product) => {
          loadImageUrl(product);
        });
      }
    } catch (e) {
      console.error('Erreur parsing produits:', e);
    } finally {
      setLoading(false);
    }
  }, [params.products]);

  // Fonction pour charger l'URL de l'image depuis Firebase Storage
  const loadImageUrl = useCallback(async (product: Product) => {
    const imagePath = product.mainImage || product.imageUrl || (product.images && product.images[0]);
    
    if (!imagePath) {
      setImageUrls(prev => ({ ...prev, [product.id]: '' }));
      return;
    }

    // Éviter de recharger si déjà en cours ou chargé
    if (loadingImages[product.id] || imageUrls[product.id]) return;

    setLoadingImages(prev => ({ ...prev, [product.id]: true }));

    try {
      const url = await getFirebaseImageUrl(imagePath);
      if (url) {
        setImageUrls(prev => ({ ...prev, [product.id]: url }));
      } else {
        // Fallback à l'URL originale
        setImageUrls(prev => ({ ...prev, [product.id]: imagePath }));
      }
    } catch (error) {
      console.error(`Erreur chargement image pour ${product.id}:`, error);
      setImageUrls(prev => ({ ...prev, [product.id]: imagePath })); // Fallback
    } finally {
      setLoadingImages(prev => ({ ...prev, [product.id]: false }));
    }
  }, [loadingImages, imageUrls]);

  // TITRE FIXE : "Plus d'article chez A2Express"
  const title = "Plus d'articles chez A2Express";
  const mixMode = params.mixMode === 'true';

  const handleProductPress = useCallback(async (product: Product) => {
    try {
      setLoadingProductId(product.id);
      
      if (product.originalLink) {
        router.push({
          pathname: "/webview",
          params: { url: product.originalLink, title: product.name },
        });
        return;
      }

      console.log('Chargement du produit complet:', product.id);
      const productRef = doc(db, 'products', product.id);
      const productSnap = await getDoc(productRef);
      
      if (productSnap.exists()) {
        const fullProduct = {
          id: productSnap.id,
          ...productSnap.data()
        };
        
        router.push({
          pathname: `/product/${product.id}`,
          params: { productData: JSON.stringify(fullProduct) }
        });
      } else {
        router.push(`/product/${product.id}`);
      }
    } catch (error) {
      console.error('Erreur chargement produit:', error);
      router.push(`/product/${product.id}`);
    } finally {
      setLoadingProductId(null);
    }
  }, [router]);

  const renderProduct = useCallback(({ item }: { item: Product }) => {
    const imageUrl = imageUrls[item.id];
    const isLoadingImage = loadingImages[item.id];
    const isLoading = loadingProductId === item.id;

    return (
      <TouchableOpacity
        style={[styles.productCard, isLoading && styles.productCardLoading]}
        onPress={() => handleProductPress(item)}
        activeOpacity={0.9}
        disabled={isLoading}
      >
        <View style={styles.imageContainer}>
          {isLoadingImage ? (
            <View style={styles.imageLoading}>
              <ActivityIndicator size="small" color="#ff6a00" />
            </View>
          ) : imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imageFallback}>
              <Ionicons name="image-outline" size={40} color="#ccc" />
              <Text style={styles.fallbackText}>Image</Text>
            </View>
          )}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color="#ff6a00" />
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {getLocalizedProductText(
              item.name,
              'name',
              item as unknown as Record<string, unknown>,
              i18n.language,
            )}
          </Text>
          <Text style={styles.productSupplier} numberOfLines={1}>
            {item.supplier || 'Fournisseur'}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.productPrice}>
              {item.price?.toLocaleString() || 0} CFA
            </Text>
            {item.originalPrice && item.originalPrice > item.price && (
              <Text style={styles.oldPrice}>
                {item.originalPrice.toLocaleString()}
              </Text>
            )}
          </View>
          {item.rating > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#ffc107" />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [handleProductPress, imageUrls, loadingImages, loadingProductId, i18n.language]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff6a00" />
          <Text style={styles.loadingText}>Chargement des produits...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {mixMode && products.length > 0 && (
        <View style={styles.statsBanner}>
          <Ionicons name="git-compare" size={20} color="#ff6a00" />
          <Text style={styles.statsText}>
            {products.length} produits sélectionnés
          </Text>
        </View>
      )}

      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => `list-${item.id}`}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListFooterComponent={
          products.length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {products.length} articles disponibles
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>Aucun produit trouvé</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
	paddingTop: 40,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 4,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5EE',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  statsText: {
    fontSize: 14,
    color: '#ff6a00',
    fontWeight: '500',
    flex: 1,
  },
  listContent: {
    padding: 8,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
  },
  productCardLoading: {
    opacity: 0.7,
  },
  imageContainer: {
    width: '100%',
    height: 150,
    backgroundColor: '#f5f5f5',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  imageLoading: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  fallbackText: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    height: 40,
  },
  productSupplier: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ff6a00',
  },
  oldPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});
