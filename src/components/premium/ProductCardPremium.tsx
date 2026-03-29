import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useCurrency } from '../../contexts/CurrencyContext';
import { isZeroDollarsShop } from '@/utils/zeroDollarsShop';
import ZeroDollarsFreeBadge from '@/components/ZeroDollarsFreeBadge';

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
  companyName?: string;
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

// Configuration du cache pour les images
const IMAGE_CACHE_POLICY = {
  cachePolicy: 'memory-disk',
  transition: 200,
};

function ProductCardPremiumComponent({
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
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  // Mémoïsation des images avec cache optimisé
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
        if (!url || typeof url !== 'string') return null;
        url = url.trim();
        
        if (!url) return null;
        
        // Optimisation des URLs Firebase Storage
        if (url.includes("firebasestorage.googleapis.com") && !url.includes("alt=media")) {
          return url.includes("?") ? `${url}&alt=media` : `${url}?alt=media`;
        }
        return url;
      })
      .filter(Boolean);
  }, [product.images, product.mainImage, product.imageUrl]);

  const safeImages = useMemo(() => allImages.length > 0 ? allImages : [''], [allImages]);
  const currentImageUrl = useMemo(() => safeImages[currentImageIndex] || '', [safeImages, currentImageIndex]);

  // Intervalle de rotation des images optimisé
  useEffect(() => {
    if (allImages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [allImages.length]);

  const stockValue = useMemo(() => product.stockQuantity ?? product.stock ?? 0, [product]);

  // Animations optimisées avec useCallback
  const handlePressIn = useCallback(() => {
    if (!disableInternalPress) {
      Animated.spring(scaleAnim, {
        toValue: PRESS_SCALE,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    }
  }, [disableInternalPress, scaleAnim]);

  const handlePressOut = useCallback(() => {
    if (!disableInternalPress) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }).start();
    }
  }, [disableInternalPress, scaleAnim]);

  // NAVIGATION INSTANTANÉE - Plus de getDoc Firebase
  const handleProductPress = useCallback(() => {
    if (disableInternalPress) {
      console.log('🚫 Navigation interne désactivée');
      return;
    }

    if (onPress) {
      onPress();
      return;
    }

    console.log('⚡ Navigation instantanée vers produit:', product.id);

    // Vérifier si c'est un lien externe
    if (product.originalLink) {
      console.log('🔗 Lien externe détecté');
      router.push({
        pathname: "/webview",
        params: { url: product.originalLink, title: product.name },
      });
      return;
    }

    // NAVIGATION INSTANTANÉE : On passe l'objet produit complet via params
    const navigationParams = {
      productId: product.id,
      fromList: 'true',
      categoryId: product.categoryId || 'all',
      // On passe les données essentielles pour l'affichage immédiat
      initialProductData: JSON.stringify({
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        mainImage: product.mainImage,
        images: product.images,
        supplier: product.supplier,
        minOrder: product.minOrder,
        deliveryTime: product.deliveryTime,
        isVerified: product.isVerified,
        hasFreeShipping: product.hasFreeShipping,
      }),
    };

    // Utiliser le bon chemin selon le contexte
    if (isCategoryPage || isProductDetail) {
      router.push(`/product/${product.id}`);
    } else {
      router.push({
        pathname: `/product/${product.id}`,
        params: navigationParams
      });
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

  // Mémoïsation des valeurs calculées
  const discount = useMemo(() => 
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : 0,
    [product.originalPrice, product.price]
  );

  const formatPrice = useCallback((priceInXOF: number) => {
    const converted = priceInXOF * currency.rate;
    if (currency.code === 'XOF') {
      return Math.round(converted).toLocaleString('fr-FR');
    }
    return converted.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [currency]);

  const moq = useMemo(() => 
    product.minOrderQuantity || product.minOrder || product.moq || 1,
    [product]
  );

  const showZeroDollarsFree = useMemo(
    () =>
      isZeroDollarsShop({
        supplier: product.supplier,
        companyName: product.companyName,
      }),
    [product.supplier, product.companyName]
  );

  const ContainerComponent = disableInternalPress ? View : TouchableOpacity;
  const containerProps = disableInternalPress
    ? {}
    : {
        activeOpacity: 0.97,
        onPress: handleProductPress,
        onPressIn: handlePressIn,
        onPressOut: handlePressOut,
      };

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={{ transform: [{ scale: disableInternalPress ? 1 : scaleAnim }] }}>
        <ContainerComponent {...containerProps}>
          <View style={styles.imageContainer}>
            {/* Image avec expo-image et cache memory-disk */}
            {currentImageUrl && !imageError ? (
              <Image
                source={{ uri: currentImageUrl }}
                style={styles.productImage}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                priority={currentImageIndex === 0 ? "high" : "normal"}
                recyclingKey={`${product.id}-${currentImageIndex}`}
                onError={() => setImageError(true)}
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

            {showZeroDollarsFree && (
              <View
                style={[
                  styles.zeroDollarsBadgeWrap,
                  { top: discount > 0 ? 34 : 8 },
                ]}
              >
                <ZeroDollarsFreeBadge onlyFreeText />
              </View>
            )}

            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={toggleFavorite}
              activeOpacity={0.8}
            >
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={18}
                  color={isFavorite ? '#ff4444' : '#999'}
                />
              </Animated.View>
            </TouchableOpacity>

            {allImages.length > 1 && (
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
}

// Définir displayName pour le débogage
ProductCardPremiumComponent.displayName = 'ProductCardPremium';

// Export avec React.memo correct
const ProductCardPremium = React.memo(ProductCardPremiumComponent);

export default ProductCardPremium;

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
  zeroDollarsBadgeWrap: {
    position: 'absolute',
    left: 8,
    zIndex: 2,
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