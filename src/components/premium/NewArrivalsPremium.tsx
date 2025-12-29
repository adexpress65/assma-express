// src/components/premium/NewArrivalsPremium.tsx - VERSION CORRIGÉE
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ✅ UTILISER VOTRE HOOK EXISTANT
import useAppNavigation from '../../hooks/useAppNavigation';
import ProductCardPremium from './ProductCardPremium';

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
}

interface NewArrivalsPremiumProps {
  products: Product[];
}

export default function NewArrivalsPremium({ products }: NewArrivalsPremiumProps) {
  // ✅ UTILISER VOTRE HOOK EXISTANT
  const { navigateTo } = useAppNavigation();

  // ✅ Grouper les produits par 2
  const groupedProducts = products.reduce((acc: Product[][], _, i, arr) => {
    if (i % 2 === 0) acc.push(arr.slice(i, i + 2));
    return acc;
  }, []);

  // ✅ NAVIGATION EN 2 ÉTAPES
  const handleProductPress = (product: Product) => {
    console.log('🆕 Navigation nouveau produit:', product.id);
    navigateTo.productDetail(product.id, product.categoryId || 'new-arrivals');
  };

  const navigateToAllNewArrivals = () => {
    navigateTo.category('new-arrivals', 'Nouveautés');
  };

  // ✅ Rendu des groupes
  const renderProductGroup = ({ item, index }: { item: Product[], index: number }) => (
    <View style={styles.productGroup}>
      {item.map((product, productIndex) => (
        <View key={product.id} style={styles.productWrapper}>
          <ProductCardPremium 
            product={product}
            onPress={() => handleProductPress(product)}
            style={styles.productCard}
          />
          
          {/* Badge Nouveau */}
          <LinearGradient
            colors={['#FF375F', '#FF6A00']}
            style={styles.newProductBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="newspaper-outline" size={12} color="#fff" />
            <Text style={styles.newProductText}>Nouveau</Text>
          </LinearGradient>

          {/* Timeline pour les premiers produits seulement */}
          {index === 0 && productIndex === 0 && (
            <>
              <View style={styles.timelineDot} />
              <View style={styles.timelineLine} />
            </>
          )}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <LinearGradient
            colors={['#FF375F', '#FF6A00']}
            style={styles.newBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={styles.newBadgeText}>NOUVEAU</Text>
          </LinearGradient>
          <Text style={styles.title}>Nouveaux Produits</Text>
        </View>
        <TouchableOpacity 
          style={styles.seeAllButton}
          onPress={navigateToAllNewArrivals}
        >
          <Text style={styles.seeAllText}>Voir plus</Text>
          <Ionicons name="arrow-forward" size={16} color="#ff6a00" />
        </TouchableOpacity>
      </View>

      {/* Liste des produits */}
      <FlatList
        data={groupedProducts}
        renderItem={renderProductGroup}
        keyExtractor={(_, index) => `new-arrivals-group-${index}`}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.productsContainer}
      />

      {/* Compte à rebours */}
      <View style={styles.countdownContainer}>
        <Text style={styles.countdownTitle}>Prochaines arrivages dans:</Text>
        <View style={styles.countdownTimer}>
          <View style={styles.timeUnit}>
            <Text style={styles.timeNumber}>02</Text>
            <Text style={styles.timeLabel}>Jours</Text>
          </View>
          <Text style={styles.timeSeparator}>:</Text>
          <View style={styles.timeUnit}>
            <Text style={styles.timeNumber}>14</Text>
            <Text style={styles.timeLabel}>Heures</Text>
          </View>
          <Text style={styles.timeSeparator}>:</Text>
          <View style={styles.timeUnit}>
            <Text style={styles.timeNumber}>38</Text>
            <Text style={styles.timeLabel}>Minutes</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#333',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  seeAllText: {
    color: '#ff6a00',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  productsContainer: {
    paddingHorizontal: 12,
  },
  productGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  productWrapper: {
    flex: 1,
    marginHorizontal: 4,
    position: 'relative',
  },
  productCard: {
    width: '100%',
  },
  newProductBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  newProductText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 2,
  },
  timelineDot: {
    position: 'absolute',
    bottom: -20,
    left: '50%',
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff6a00',
    zIndex: 5,
  },
  timelineLine: {
    position: 'absolute',
    bottom: -16,
    left: '60%',
    right: -20,
    height: 2,
    backgroundColor: '#ff6a00',
    opacity: 0.3,
  },
  countdownContainer: {
    backgroundColor: 'rgba(255, 106, 0, 0.05)',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.1)',
  },
  countdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  countdownTimer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeUnit: {
    alignItems: 'center',
    minWidth: 50,
  },
  timeNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ff6a00',
    marginBottom: 4,
  },
  timeLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  timeSeparator: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff6a00',
    marginHorizontal: 8,
    marginBottom: 8,
  },
});