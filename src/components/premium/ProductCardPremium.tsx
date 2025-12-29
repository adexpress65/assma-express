// src/components/premium/ProductCardPremium.tsx - VERSION COMPLÈTE CORRIGÉE
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ✅ UTILISER VOTRE HOOK EXISTANT
import useAppNavigation from '../../hooks/useAppNavigation';

const { width } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  rating: number;
  supplier: string;
  minOrder: number;
  deliveryTime: string;
  isVerified: boolean;
  stock: number;
  categoryId?: string;
  categoryName?: string;
  category?: string;
}

interface ProductCardPremiumProps {
  product: Product;
  style?: any;
  onPress?: () => void;
  showCategory?: boolean;
  isCategoryPage?: boolean;
  isProductDetail?: boolean; // ✅ NOUVEAU: pour éviter la double navigation
}

export default function ProductCardPremium({ 
  product, 
  style, 
  onPress,
  showCategory = false,
  isCategoryPage = false,
  isProductDetail = false // ✅ Par défaut false
}: ProductCardPremiumProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  
  // ✅ UTILISER VOTRE HOOK EXISTANT
  const { navigateTo } = useAppNavigation();
  
  const scaleValue = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // ✅ LOGIQUE DE NAVIGATION UNIFIÉE
  const handleProductPress = () => {
    console.log('🔄 ProductCardPremium - Navigation pour:', product.id);
    
    if (onPress) {
      // Si onPress est fourni, l'utiliser (cas de la page catégorie)
      console.log('✅ Utilisation du onPress fourni');
      onPress();
      return;
    }
    
    if (isCategoryPage || isProductDetail) {
      // Si on est sur une page catégorie OU page produit, aller directement au produit
      console.log('📍 Navigation directe vers produit');
      navigateTo.productDetailDirect(product.id);
    } else {
      // ✅ NAVIGATION EN 2 ÉTAPES: Catégorie → Produit
      console.log('🔄 Navigation en 2 étapes via catégorie');
      navigateTo.productDetail(product.id, product.categoryId || 'all');
    }
  };

  const handleViewDetails = (e: any) => {
    e.stopPropagation();
    console.log('📱 Clic sur bouton "Voir détails"');
    
    // Toujours aller directement au produit quand on clique sur le bouton
    navigateTo.productDetailDirect(product.id);
  };

  const toggleFavorite = (e: any) => {
    e.stopPropagation();
    setIsFavorite(!isFavorite);
    console.log(`❤️ ${isFavorite ? 'Retiré des' : 'Ajouté aux'} favoris`);
  };

  const discount = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleValue }] }, style]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handleProductPress}
      >
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: product.imageUrl }} 
            style={styles.productImage}
            defaultSource={{ uri: 'https://via.placeholder.com/300x300/f0f0f0/cccccc?text=Assma+Express' }}
          />
          
          {discount > 0 && (
            <LinearGradient
              colors={['#ff4444', '#ff6a00']}
              style={styles.discountBadge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.discountText}>-{discount}%</Text>
            </LinearGradient>
          )}

          <TouchableOpacity style={styles.favoriteButton} onPress={toggleFavorite}>
            <Ionicons 
              name={isFavorite ? "heart" : "heart-outline"} 
              size={20} 
              color={isFavorite ? "#ff4444" : "rgba(0,0,0,0.5)"} 
            />
          </TouchableOpacity>

          {product.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#fff" />
              <Text style={styles.verifiedText}>Verifié</Text>
            </View>
          )}
        </View>

        <View style={styles.infoContainer}>
          {showCategory && (product.categoryId || product.category) && (
            <TouchableOpacity 
              style={styles.categoryTag}
              onPress={(e) => {
                e.stopPropagation();
                // Navigation vers la catégorie du produit
                navigateTo.category(
                  product.categoryId || 'all',
                  product.categoryName || product.category
                );
              }}
            >
              <Text style={styles.categoryText}>
                {product.categoryName || product.category || 'Catégorie'}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.supplierText} numberOfLines={1}>
            {product.supplier}
          </Text>

          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>

          <View style={styles.ratingContainer}>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= Math.floor(product.rating) ? "star" : "star-outline"}
                  size={12}
                  color="#FFD700"
                />
              ))}
              <Text style={styles.ratingText}>({product.rating.toFixed(1)})</Text>
            </View>
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>{formatPrice(product.price)} F CFA</Text>
            {product.originalPrice && product.originalPrice > product.price && (
              <Text style={styles.originalPrice}>{formatPrice(product.originalPrice)} F CFA</Text>
            )}
          </View>

          <View style={styles.orderInfo}>
            <View style={styles.orderInfoItem}>
              <Ionicons name="cube-outline" size={10} color="#666" />
              <Text style={styles.minOrder}>Min: {product.minOrder}</Text>
            </View>
            <View style={styles.orderInfoItem}>
              <Ionicons name="time-outline" size={10} color="#666" />
              <Text style={styles.delivery}>{product.deliveryTime}</Text>
            </View>
          </View>

          <View style={styles.stockContainer}>
            <View style={[
              styles.stockIndicator,
              { backgroundColor: product.stock > 10 ? '#4CAF50' : '#FF9800' }
            ]} />
            <Text style={styles.stockText}>
              {product.stock > 10 ? 'En stock' : 'Stock limité'}
            </Text>
          </View>

          {/* Bouton d'action */}
          <TouchableOpacity 
            style={styles.viewProductButton}
            onPress={handleViewDetails}
          >
            <Text style={styles.viewProductButtonText}>
              {isCategoryPage ? 'Commander' : 'Voir détails'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  imageContainer: {
    position: 'relative',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#f8f9fa',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 2,
  },
  infoContainer: {
    padding: 12,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f7ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  categoryText: {
    fontSize: 9,
    color: '#2563eb',
    fontWeight: '600',
  },
  supplierText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
    marginBottom: 2,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    lineHeight: 16,
    marginBottom: 6,
    minHeight: 32,
  },
  ratingContainer: {
    marginBottom: 6,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff6a00',
    marginRight: 6,
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    alignItems: 'center',
  },
  orderInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  minOrder: {
    fontSize: 10,
    color: '#666',
  },
  delivery: {
    fontSize: 10,
    color: '#666',
  },
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  stockIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  stockText: {
    fontSize: 10,
    color: '#666',
  },
  viewProductButton: {
    backgroundColor: '#ff6a00',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewProductButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});