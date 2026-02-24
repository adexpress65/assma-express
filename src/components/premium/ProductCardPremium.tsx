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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useCurrency } from '../../contexts/CurrencyContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');


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
}

interface Props {
  product: Product;
  style?: any;
  onPress?: () => void;
  showCategory?: boolean;
  isCategoryPage?: boolean;
  isProductDetail?: boolean;
}

// ✨ Animation constants pour timing cohérent
const SPRING_CONFIG = { tension: 300, friction: 15, useNativeDriver: true };
const PRESS_SCALE = 0.96;

export default function ProductCardPremium({
  product,
  style,
  onPress,
  showCategory = false,
  isCategoryPage = false,
  isProductDetail = false,
}: Props) {
  const { t } = useTranslation();
  const { currency } = useCurrency();
  
  // 🎯 State management optimisé
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // 🎨 Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  const { navigateTo } = useAppNavigation();

  // ✅ LOGIQUE LIVRAISON SUPPRIMÉE ICI

  // ✅ VOTRE LOGIQUE GALERIE (optimisée avec useCallback)
  const allImages = useMemo(() => {
    let list = [];
    if (product.images && product.images.length > 0) {
      list = [...product.images];
    } else {
      list = [product.mainImage || product.imageUrl || ""];
    }

    return list.map(url => {
      if (!url) return `https://via.placeholder.com/600x600/f8f9fa/dee2e6?text=${encodeURIComponent(product.name.slice(0, 20))}`;
      if (url.includes("firebasestorage.googleapis.com") && !url.includes("alt=media")) {
        return url.includes("?") ? `${url}&alt=media` : `${url}?alt=media`;
      }
      return url;
    });
  }, [product.images, product.mainImage, product.imageUrl, product.name]);

  const currentImageUrl = allImages[currentImageIndex];

  // 🔥 VOTRE EFFET DÉFILEMENT (amélioré avec animation slide)
  useEffect(() => {
    if (allImages.length <= 1) return;
    
    const interval = setInterval(() => {
      // Slide out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -20,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
        slideAnim.setValue(20);
        
        // Slide in
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: 0,
            ...SPRING_CONFIG,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 5000); // 5s pour meilleure UX
    
    return () => clearInterval(interval);
  }, [allImages.length]);

  const stockValue = product.stockQuantity ?? product.stock ?? 0;
  const isLowStock = stockValue <= 10 && stockValue > 0;
  const isOutOfStock = stockValue === 0;

  // 🎯 Handlers avec animations tactiles
  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: PRESS_SCALE,
      ...SPRING_CONFIG,
    }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...SPRING_CONFIG,
    }).start();
  }, []);

  const handleProductPress = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }
    if (isCategoryPage || isProductDetail) {
      navigateTo.productDetailDirect(product.id);
    } else {
      navigateTo.productDetail(product.id, product.categoryId || 'all');
    }
  }, [onPress, isCategoryPage, isProductDetail, navigateTo, product.id, product.categoryId]);

  const toggleFavorite = useCallback((e: any) => {
    e.stopPropagation();
    
    // Animation coeur "pop"
    Animated.sequence([
      Animated.timing(heartScale, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1.2,
        friction: 3,
        tension: 200,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 5,
        tension: 200,
        useNativeDriver: true,
      }),
    ]).start();
    
    setIsFavorite((v) => !v);
  }, [heartScale]);

  // 💰 Calcul discount (votre logique conservée)
  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  // 💱 Format prix (votre logique conservée)
  const formatPrice = (priceInXOF: number) => {
    const converted = priceInXOF * currency.rate;
    if (currency.code === 'XOF') {
      return Math.round(converted).toLocaleString('fr-FR');
    }
    return converted.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const categoryLabel = product.categoryName || product.category || "";
  const displayCategory = (categoryLabel.toLowerCase() === "uncategorized" || categoryLabel === "") 
    ? null 
    : categoryLabel;

  // 🎨 Styles dynamiques
  const stockColor = isOutOfStock ? '#dc3545' : isLowStock ? '#ff9800' : '#22c55e';
  const stockText = isOutOfStock 
    ? t('productCard.outOfStock') 
    : isLowStock 
      ? t('productCard.limitedStock') 
      : t('productCard.inStock');

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          transform: [{ scale: scaleAnim }],
          opacity: isOutOfStock ? 0.8 : 1,
        }, 
        style
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={handleProductPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isOutOfStock}
      >
        {/* 🖼️ IMAGE CONTAINER */}
        <View style={styles.imageContainer}>
          {imageError ? (
            <View style={styles.imageFallback}>
              <LinearGradient
                colors={['#f8f9fa', '#e9ecef']}
                style={styles.fallbackGradient}
              >
                <Ionicons name="image-outline" size={48} color="#adb5bd" />
                <Text style={styles.fallbackText}>Image non disponible</Text>
              </LinearGradient>
            </View>
          ) : (
            <Animated.Image
              source={{ uri: currentImageUrl }}
              style={[
                styles.productImage, 
                { 
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                }
              ]}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          )}

          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'transparent', 'transparent', 'rgba(0,0,0,0.1)']}
            style={styles.imageOverlay}
            pointerEvents="none"
          />

          {allImages.length > 1 && (
            <View style={styles.paginationContainer}>
              <View style={styles.paginationDots}>
                {allImages.map((_, i) => (
                  <Animated.View 
                    key={`dot-${i}`} 
                    style={[
                      styles.dot, 
                      currentImageIndex === i ? styles.activeDot : styles.inactiveDot,
                      currentImageIndex === i && { transform: [{ scale: heartScale }] }
                    ]} 
                  />
                ))}
              </View>
            </View>
          )}

          {discount > 0 && (
            <View style={styles.discountWrapper}>
              <LinearGradient 
                colors={['#ff416c', '#ff4b2b']} 
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.discountBadge}
              >
                <Text style={styles.discountText}>-{discount}%</Text>
              </LinearGradient>
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
                size={20} 
                color={isFavorite ? '#ff416c' : '#495057'} 
              />
            </Animated.View>
          </TouchableOpacity>

          {product.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
            </View>
          )}
        </View>

        {/* 📋 INFO CONTAINER */}
        <View style={styles.infoContainer}>
          {!!(showCategory && displayCategory) && (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText} numberOfLines={1}>
                {displayCategory}
              </Text>
            </View>
          )}
          
          <View style={styles.supplierRow}>
            <Ionicons name="storefront-outline" size={12} color="#6c757d" />
            <Text style={styles.supplierText} numberOfLines={1}>
              {product.supplier}
            </Text>
            {product.isVerified && (
              <Ionicons name="shield-checkmark" size={12} color="#22c55e" style={styles.verifiedIcon} />
            )}
          </View>

          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>

          {product.rating > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#ffc107" />
              <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
              <Text style={styles.deliveryTime}>• {product.deliveryTime}</Text>
            </View>
          )}

          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              <Text style={styles.price}>
                {currency.symbol === 'CFA' 
                  ? `${formatPrice(product.price)} ${currency.symbol}` 
                  : `${currency.symbol}${formatPrice(product.price)}`
                }
              </Text>
              
              {!!(product.originalPrice && product.originalPrice > product.price) && (
                <Text style={styles.oldPrice}>
                  {currency.symbol === 'CFA' 
                    ? `${formatPrice(product.originalPrice)} ${currency.symbol}` 
                    : `${currency.symbol}${formatPrice(product.originalPrice)}`
                  }
                </Text>
              )}
            </View>
            
            <Text style={styles.minOrderText}>
              Min. {product.minOrder} unité{product.minOrder > 1 ? 's' : ''}
            </Text>
          </View>

          {/* ✅ LE BADGE LIVRAISON GRATUITE A ÉTÉ DÉFINITIVEMENT SUPPRIMÉ ICI */}

          <View style={styles.stockRow}>
            <View style={[styles.stockIndicator, { backgroundColor: stockColor + '20' }]}>
              <View style={[styles.stockDot, { backgroundColor: stockColor }]} />
              <Text style={[styles.stockText, { color: stockColor }]}>
                {stockText}
              </Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[
              styles.viewButton,
              isOutOfStock && styles.viewButtonDisabled
            ]}
            activeOpacity={0.8}
            onPress={handleProductPress}
            disabled={isOutOfStock}
          >
            <LinearGradient
              colors={isOutOfStock ? ['#e9ecef', '#dee2e6'] : ['#ff9900', '#ff6600']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.viewButtonGradient}
            >
              <Text style={[
                styles.viewButtonText,
                isOutOfStock && styles.viewButtonTextDisabled
              ]}>
                {isOutOfStock ? t('productCard.outOfStock') : t('productCard.viewDetails')}
              </Text>
              {!isOutOfStock && (
                <Ionicons name="arrow-forward" size={14} color="#fff" style={styles.arrowIcon} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    margin: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    height: 180,
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  imageFallback: {
    width: '100%',
    height: '100%',
  },
  fallbackGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  activeDot: {
    width: 20,
    backgroundColor: '#fff',
  },
  inactiveDot: {
    width: 6,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  discountWrapper: {
    position: 'absolute',
    top: 12,
    left: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#ff416c',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  discountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    minWidth: 45,
    alignItems: 'center',
  },
  discountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 25,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  infoContainer: {
    padding: 14,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#e7f3ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  categoryText: {
    fontSize: 10,
    color: '#0066cc',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  supplierText: {
    fontSize: 11,
    color: '#6c757d',
    marginLeft: 4,
    flex: 1,
    fontWeight: '500',
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212529',
    lineHeight: 20,
    marginBottom: 6,
    minHeight: 40,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#495057',
    marginLeft: 4,
  },
  deliveryTime: {
    fontSize: 11,
    color: '#6c757d',
    marginLeft: 4,
  },
  priceSection: {
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ff6b6b',
    letterSpacing: -0.5,
  },
  oldPrice: {
    marginLeft: 8,
    fontSize: 13,
    textDecorationLine: 'line-through',
    color: '#adb5bd',
    fontWeight: '500',
  },
  minOrderText: {
    fontSize: 10,
    color: '#6c757d',
    marginTop: 2,
    fontWeight: '500',
  },
  stockRow: {
    marginBottom: 10,
  },
  stockIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  stockText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  viewButton: {
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#FF6600',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  viewButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  viewButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  viewButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  viewButtonTextDisabled: {
    color: '#6c757d',
  },
  arrowIcon: {
    marginLeft: 6,
  },
});