import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useRouter } from 'expo-router';
import { useCurrency } from '../../contexts/CurrencyContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 24) / 2;

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  mainImage?: string;
  images?: string[];
  rating: number;
  supplier: string;
  minOrder: number;
  deliveryTime: string;
  isVerified: boolean;
  stock?: number;
  stockQuantity?: number;
  categoryId?: string;
  categoryName?: string;
  category?: string;
  minOrderQuantity?: number;
  moq?: number;
  hasFreeShipping?: boolean;
  originalLink?: string;
}

interface Props {
  product: Product;
  style?: any;
  onPress?: () => void;
  showCategory?: boolean;
  isCategoryPage?: boolean;
  isProductDetail?: boolean;
  disableInternalPress?: boolean;
}

const PRESS_SCALE = 0.98;

export default function ProductCardPremium({
  product,
  style,
  onPress,
  showCategory = false,
  isCategoryPage = false,
  isProductDetail = false,
  disableInternalPress = false,
}: Props) {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  const router = useRouter();

  const [isFavorite, setIsFavorite] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

const allImages = useMemo(() => {
  let list = [];
  if (product.images && product.images.length > 0) {
    list = [...product.images];
  } else {
    list = [product.mainImage || product.imageUrl || ""];
  }

  return list
    .filter(Boolean)
    .map(url => {
      // 🔧 NETTOYAGE : Trim l'URL
      if (!url || typeof url !== 'string') return null;
      url = url.trim();
      
      if (!url) return null;
      
      if (url.includes("firebasestorage.googleapis.com") && !url.includes("alt=media")) {
        return url.includes("?") ? `${url}&alt=media` : `${url}?alt=media`;
      }
      return url;
    })
    .filter(Boolean); // Enlever les nulls
}, [product.images, product.mainImage, product.imageUrl]);

// 🔧 PROTECTION : S'assurer qu'il y a toujours au moins une image
const safeImages = allImages.length > 0 ? allImages : [''];
const currentImageUrl = safeImages[currentImageIndex] || '';

  useEffect(() => {
    if (allImages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [allImages.length]);

  const stockValue = product.stockQuantity ?? product.stock ?? 0;
  const isOutOfStock = stockValue === 0;

  const handlePressIn = useCallback(() => {
    if (!disableInternalPress) {
      Animated.spring(scaleAnim, {
        toValue: PRESS_SCALE,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    }
  }, [disableInternalPress]);

  const handlePressOut = useCallback(() => {
    if (!disableInternalPress) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    }
  }, [disableInternalPress]);

  // NAVIGATION EN 2 ÉTAPES CORRIGÉE
  const handleProductPress = useCallback(async () => {
    // BUG 2 CORRIGÉ : Vérification stricte du disableInternalPress
    if (disableInternalPress) {
      console.log('🚫 Navigation interne désactivée');
      return;
    }

    if (onPress) {
      onPress();
      return;
    }

    console.log('🔄 Navigation en 2 étapes vers produit:', product.id);
    setLoading(true);

    try {
      // Vérifier si c'est un lien externe
      if (product.originalLink) {
        console.log('🔗 Lien externe détecté');
        router.push({
          pathname: "/webview",
          params: { url: product.originalLink, title: product.name },
        });
        return;
      }

      // ÉTAPE 1: Charger le produit complet depuis Firestore
      console.log('📦 Étape 1 - Chargement Firestore pour:', product.id);
      const productRef = doc(db, 'products', product.id);
      const productSnap = await getDoc(productRef);
      
      if (productSnap.exists()) {
        const fullProduct = {
          id: productSnap.id,
          ...productSnap.data()
        };
        console.log('✅ Produit chargé avec succès');
        
        // ÉTAPE 2: Navigation avec les données complètes
        console.log('➡️ Étape 2 - Navigation vers fiche produit');
        
        // Utiliser le bon chemin selon le contexte
        if (isCategoryPage || isProductDetail) {
          router.push(`/product/${product.id}`);
        } else {
          router.push({
            pathname: `/product/${product.id}`,
            params: { 
              productData: JSON.stringify(fullProduct),
              fromList: 'true',
              categoryId: product.categoryId || 'all'
            }
          });
        }
      } else {
        console.warn('⚠️ Produit non trouvé dans Firestore');
        // Fallback: navigation simple
        router.push(`/product/${product.id}`);
      }
    } catch (error) {
      console.error('❌ Erreur navigation produit:', error);
      // Fallback en cas d'erreur
      router.push(`/product/${product.id}`);
    } finally {
      setLoading(false);
    }
  }, [onPress, disableInternalPress, product, router, isCategoryPage, isProductDetail]);

  const toggleFavorite = useCallback((e: any) => {
    e.stopPropagation();

    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 0.7,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();

    setIsFavorite((v) => !v);
  }, [heartScale]);

  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const formatPrice = (priceInXOF: number) => {
    const converted = priceInXOF * currency.rate;
    if (currency.code === 'XOF') {
      return Math.round(converted).toLocaleString('fr-FR');
    }
    return converted.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const moq = product.minOrderQuantity || product.minOrder || product.moq || 1;

  const ContainerComponent = disableInternalPress ? View : TouchableOpacity;
  const containerProps = disableInternalPress
    ? {}
    : {
        activeOpacity: 0.97,
        onPress: handleProductPress,
        onPressIn: handlePressIn,
        onPressOut: handlePressOut,
        disabled: loading,
      };

return (
    <View style={[styles.container, style]}>
      <Animated.View style={{ transform: [{ scale: disableInternalPress ? 1 : scaleAnim }] }}>
        <ContainerComponent {...containerProps}>
          <View style={styles.imageContainer}>
            {loading && (
              <View style={styles.loadingOverlay}>
                <Ionicons name="sync" size={24} color="#ff6a00" />
              </View>
            )}
            
            {/* Gestion des états de chargement et d'erreur */}
            {imageLoading && !imageError ? (
              <View style={styles.imageFallback}>
                <Ionicons name="sync" size={32} color="#ff6a00" />
              </View>
            ) : imageError ? (
              <View style={styles.imageFallback}>
                <Ionicons name="image-outline" size={32} color="#ccc" />
              </View>
            ) : currentImageUrl ? (
              <Image
                source={{ uri: currentImageUrl }}
                style={styles.productImage}
                resizeMode="cover"
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => {
                  setImageLoading(false);
                  setImageError(false);
                }}
                onError={() => {
                  setImageError(true);
                  setImageLoading(false);
                }}
              />
            ) : (
              <View style={styles.imageFallback}>
                <Ionicons name="image-outline" size={32} color="#ccc" />
              </View>
            )}

            {discount > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>{discount}% OFF</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={toggleFavorite}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={18}
                  color={isFavorite ? '#ff4444' : '#999'}
                />
              </Animated.View>
            </TouchableOpacity>

            {allImages.length > 1 && !loading && !imageLoading && (
              <View style={styles.pagination}>
                {allImages.map((_, i) => (
                  <View
                    key={`dot-${i}`}
                    style={[
                      styles.paginationDot,
                      currentImageIndex === i && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.infoContainer}>
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>

            <View style={styles.priceRow}>
              <Text style={styles.price}>
                {currency.symbol === 'CFA'
                  ? `${formatPrice(product.price)} ${currency.symbol}`
                  : `${currency.symbol}${formatPrice(product.price)}`}
              </Text>

              {discount > 0 && (
                <Text style={styles.oldPrice}>
                  {currency.symbol === 'CFA'
                    ? `${formatPrice(product.originalPrice!)}`
                    : `${currency.symbol}${formatPrice(product.originalPrice!)}`}
                </Text>
              )}
            </View>

            {product.hasFreeShipping && (
              <View style={styles.freeShippingContainer}>
                <Ionicons name="airplane-outline" size={12} color="#00B050" />
                <Text style={styles.freeShippingText}>Livraison gratuite</Text>
              </View>
            )}

            <Text style={styles.moqText}>MOQ: {moq} pcs</Text>

            <View style={styles.supplierRow}>
              <Text style={styles.supplierText} numberOfLines={1}>
                {product.supplier}
              </Text>
              {product.isVerified && (
                <Ionicons name="checkmark-circle" size={12} color="#22c55e" style={styles.verifiedIcon} />
              )}
            </View>

            {product.rating > 0 && (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={10} color="#ffc107" />
                <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
                <Text style={styles.dotSeparator}>•</Text>
                <Text style={styles.deliveryText}>{product.deliveryTime}</Text>
              </View>
            )}
          </View>
        </ContainerComponent>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        backgroundColor: '#fff',
        borderRadius: 16,
      },
      android: {
        elevation: 4,
        backgroundColor: '#fff',
        borderRadius: 16,
      },
    }),
  },
  imageContainer: {
    position: 'relative',
    height: 180,
    backgroundColor: '#fafafa',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
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
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ff4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        borderWidth: 1,
        borderColor: '#f0f0f0',
        backgroundColor: '#ffffff',
      },
    }),
  },
  pagination: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 2,
  },
  paginationDotActive: {
    width: 8,
    backgroundColor: '#fff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  infoContainer: {
    padding: 14,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    lineHeight: 20,
    marginBottom: 6,
    minHeight: 40,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ff6600',
    letterSpacing: -0.5,
  },
  oldPrice: {
    marginLeft: 8,
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  freeShippingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  freeShippingText: {
    fontSize: 10,
    color: '#00B050',
    fontWeight: '700',
    marginLeft: 4,
  },
  moqText: {
    fontSize: 12,
    color: '#555',
    marginBottom: 6,
    fontWeight: '500',
  },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  supplierText: {
    fontSize: 12,
    color: '#555',
    flex: 1,
    fontWeight: '500',
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 2,
    fontWeight: '500',
  },
  dotSeparator: {
    fontSize: 10,
    color: '#ccc',
    marginHorizontal: 4,
  },
  deliveryText: {
    fontSize: 10,
    color: '#999',
  },
});