// apps/mobile/src/components/common/ProductCard.tsx
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalizedProductText } from '../../utils/productLocale';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  image: string;
  salesCount: number;
  isVerified?: boolean;
  wholesalePrice?: number;
  minQuantity?: number;
}

interface Props {
  product: Product;
  variant: 'carousel' | 'grid' | 'wholesale';
  onPress: () => void;
}

export default function ProductCard({ product, variant, onPress }: Props) {
  const { i18n } = useTranslation();
  const displayName = useMemo(
    () =>
      getLocalizedProductText(
        product.name,
        'name',
        product as unknown as Record<string, unknown>,
        i18n.language,
      ),
    [product, i18n.language],
  );

  const formatPrice = (price: number) => {
    return `${price.toLocaleString('fr-FR')} FCFA`;
  };

  const calculateDiscount = () => {
    if (product.originalPrice && product.price < product.originalPrice) {
      return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    }
    return null;
  };

  const discount = calculateDiscount();

  return (
    <TouchableOpacity 
      style={[styles.container, styles[variant]]}
      onPress={onPress}
    >
      {/* Image avec badges */}
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: product.image || 'https://via.placeholder.com/300' }} 
          style={styles.image}
        />
        
        {/* Badge réduction */}
        {discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        )}
        
        {/* Badge vérifié */}
        {product.isVerified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          </View>
        )}
      </View>

      {/* Informations produit */}
      <View style={styles.infoContainer}>
        <Text style={styles.productName} numberOfLines={2}>
          {displayName}
        </Text>
        
        {/* Prix */}
        <View style={styles.priceContainer}>
          <Text style={styles.currentPrice}>{formatPrice(product.price)}</Text>
          {product.originalPrice && (
            <Text style={styles.originalPrice}>{formatPrice(product.originalPrice)}</Text>
          )}
        </View>

        {/* Prix en gros */}
        {variant === 'wholesale' && product.wholesalePrice && (
          <View style={styles.wholesaleContainer}>
            <Ionicons name="business-outline" size={12} color="#FF6A00" />
            <Text style={styles.wholesaleText}>
              Prix en gros : à partir de {product.minQuantity || 10} pièces — {formatPrice(product.wholesalePrice)} / pièce
            </Text>
          </View>
        )}

        {/* Ventes */}
        <Text style={styles.salesCount}>{product.salesCount.toLocaleString()} vendus</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  carousel: {
    width: 160,
    marginRight: 12,
  },
  grid: {
    width: '100%',
  },
  wholesale: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#FF6A00',
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 2,
  },
  infoContainer: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    color: '#222222',
    marginBottom: 6,
    lineHeight: 18,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222222',
    marginRight: 6,
  },
  originalPrice: {
    fontSize: 12,
    color: '#6B6B6B',
    textDecorationLine: 'line-through',
  },
  wholesaleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    padding: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  wholesaleText: {
    fontSize: 10,
    color: '#FF6A00',
    marginLeft: 4,
    flex: 1,
  },
  salesCount: {
    fontSize: 10,
    color: '#6B6B6B',
  },
});
