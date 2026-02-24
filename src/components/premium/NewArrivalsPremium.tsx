// src/components/premium/NewArrivalsPremium.tsx
import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import useAppNavigation from '../../hooks/useAppNavigation';
import ProductCardPremium from './ProductCardPremium';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GROUP_WIDTH = SCREEN_WIDTH - 24; // Largeur d'un groupe de 2 produits

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
  const { t } = useTranslation();
  const { navigateTo } = useAppNavigation();
  const scrollListRef = useRef<FlatList>(null);
  const scrollIndex = useRef(0);

  // 1. Mélange et Groupement des produits (Diversité)
  const groupedProducts = useMemo(() => {
    // On mélange un peu pour ne pas toujours voir les mêmes en premier
    const shuffled = [...products].sort(() => 0.5 - Math.random());
    
    const groups: Product[][] = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      groups.push(shuffled.slice(i, i + 2));
    }
    return groups;
  }, [products]);

  // 2. Logique de Défilement Automatique (Auto-scroll)
  useEffect(() => {
    if (groupedProducts.length <= 1) return;

    const interval = setInterval(() => {
      if (scrollListRef.current) {
        let nextIndex = scrollIndex.current + 1;
        
        if (nextIndex >= groupedProducts.length) {
          nextIndex = 0;
        }

        scrollIndex.current = nextIndex;
        
        scrollListRef.current.scrollToIndex({
          index: nextIndex,
          animated: true,
          viewPosition: 0.5
        });
      }
    }, 5000); // Défilement toutes les 5 secondes

    return () => clearInterval(interval);
  }, [groupedProducts]);

  const handleProductPress = (product: Product) => {
    navigateTo.productDetail(product.id, product.categoryId || 'new-arrivals');
  };

  const navigateToAllNewArrivals = () => {
    navigateTo.category('new-arrivals', t('newArrivals.categoryTitle'));
  };

  // Rendu des groupes (2 produits par ligne)
  const renderProductGroup = ({ item, index }: { item: Product[], index: number }) => (
    <View style={[styles.productGroup, { width: GROUP_WIDTH }]}>
      {item.map((product) => (
        <View key={`${product.id}-${index}`} style={styles.productWrapper}>
          <ProductCardPremium 
            product={product}
            onPress={() => handleProductPress(product)}
            style={styles.productCard}
          />
          
          <LinearGradient
            colors={['#FF375F', '#FF6A00']}
            style={styles.newProductBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="newspaper-outline" size={12} color="#fff" />
            <Text style={styles.newProductText}>{t('newArrivals.badge')}</Text>
          </LinearGradient>
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
            <Text style={styles.newBadgeText}>{t('newArrivals.newBadge')}</Text>
          </LinearGradient>
          <Text style={styles.title}>{t('newArrivals.title')}</Text>
        </View>
        <TouchableOpacity 
          style={styles.seeAllButton}
          onPress={navigateToAllNewArrivals}
        >
          <Text style={styles.seeAllText}>{t('newArrivals.seeAll')}</Text>
          <Ionicons name="arrow-forward" size={16} color="#ff6a00" />
        </TouchableOpacity>
      </View>

      {/* Liste des produits avec défilement automatique */}
      <FlatList
        ref={scrollListRef}
        data={groupedProducts}
        renderItem={renderProductGroup}
        keyExtractor={(_, index) => `new-arrivals-group-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={GROUP_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={styles.productsContainer}
        getItemLayout={(_, index) => ({
          length: GROUP_WIDTH,
          offset: GROUP_WIDTH * index,
          index,
        })}
      />

      {/* Compte à rebours */}
      <View style={styles.countdownContainer}>
        <Text style={styles.countdownTitle}>{t('newArrivals.countdown.title')}</Text>
        <View style={styles.countdownTimer}>
          <View style={styles.timeUnit}>
            <Text style={styles.timeNumber}>02</Text>
            <Text style={styles.timeLabel}>{t('newArrivals.countdown.days')}</Text>
          </View>
          <Text style={styles.timeSeparator}>:</Text>
          <View style={styles.timeUnit}>
            <Text style={styles.timeNumber}>14</Text>
            <Text style={styles.timeLabel}>{t('newArrivals.countdown.hours')}</Text>
          </View>
          <Text style={styles.timeSeparator}>:</Text>
          <View style={styles.timeUnit}>
            <Text style={styles.timeNumber}>38</Text>
            <Text style={styles.timeLabel}>{t('newArrivals.countdown.minutes')}</Text>
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
    elevation: 4,
  },
  newProductText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 2,
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