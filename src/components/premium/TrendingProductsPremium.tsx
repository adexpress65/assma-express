import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Animated,
  Platform,
  ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import ProductCardPremium from './ProductCardPremium';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 🔧 CORRECTION : Carte plus large (85% au lieu de 70%)
const HORIZONTAL_PADDING = 16;
const PRODUCT_CARD_WIDTH = SCREEN_WIDTH * 0.85; // Augmenté de 0.72 à 0.85
const ITEM_SPACING = 12; // Réduit pour plus d'espace utile
const ITEM_FULL_WIDTH = PRODUCT_CARD_WIDTH + ITEM_SPACING;

const COLORS = {
  primary: '#FF6B35',
  primaryLight: '#FFF0EB',
  secondary: '#004E89',
  accent: '#FFD700',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#1A1A2E',
  textMuted: '#6B7280',
  success: '#10B981',
  gradient: ['#FF6B35', '#F7931E'] as const,
};

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  isActive?: boolean;
  [key: string]: any;
}

interface BannerItem {
  id: string;
  icon: string;
  text: string;
  sub: string;
  gradient: readonly [string, string, ...string[]];
}

const RAMADAN_BANNERS: BannerItem[] = [
  { 
    id: '1', 
    icon: 'moon', 
    text: 'Ramadan 2026', 
    sub: 'Offres exclusives jusqu\'à -50%',
    gradient: ['#0F2027', '#203A43', '#2C5364'] as const,
  },
  { 
    id: '2', 
    icon: 'utensils', 
    text: 'Alimentaire Halal', 
    sub: 'Stock limité - Commandez vite',
    gradient: ['#11998e', '#38ef7d'] as const,
  },
  { 
    id: '3', 
    icon: 'star', 
    text: 'Déco & Fête', 
    sub: 'Livraison express 24h',
    gradient: ['#8E2DE2', '#4A00E0'] as const,
  },
];

export default function TrendingProductsPremium({ products: propProducts }: { products?: Product[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  
  const productsListRef = useRef<FlatList<Product>>(null);
  const ramadanListRef = useRef<FlatList<BannerItem>>(null);
  const scrollIndexRef = useRef(0);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const loadTrendingProducts = async () => {
      try {
        setLoading(true);
        const productsRef = collection(db, "products");
        const q = query(productsRef, limit(100));

        const snapshot = await getDocs(q);
        
        const rawProducts = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Product));

        const uniqueProducts = Array.from(
          new Map(rawProducts.map(item => [item.id, item])).values()
        );

        const shuffled = uniqueProducts
          .filter((p) => p.isActive !== false)
          .sort(() => Math.random() - 0.5);

        setProducts(shuffled.slice(0, 60));

      } catch (error) {
        console.error("🔥 Erreur Trending:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTrendingProducts();
  }, []);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_FULL_WIDTH,
    offset: ITEM_FULL_WIDTH * index,
    index,
  }), []);

  const onScrollToIndexFailed = useCallback((info: { index: number }) => {
    setTimeout(() => {
      if (productsListRef.current && products.length > 0 && info.index < products.length) {
        productsListRef.current.scrollToIndex({
          index: info.index,
          animated: true,
          viewPosition: 0.5,
        });
      }
    }, 100);
  }, [products.length]);

  useEffect(() => {
    if (products.length === 0) return;
    
    const interval = setInterval(() => {
      scrollIndexRef.current = (scrollIndexRef.current + 1) % Math.min(products.length, 10);
      if (productsListRef.current) {
        try {
          productsListRef.current.scrollToIndex({
            index: scrollIndexRef.current,
            animated: true,
            viewPosition: 0.5,
          });
        } catch (error) {
          console.log('Auto-scroll error');
        }
      }
    }, 4000);
    
    return () => clearInterval(interval);
  }, [products]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBannerIndex((prev) => {
        const next = (prev + 1) % RAMADAN_BANNERS.length;
        if (ramadanListRef.current) {
          try {
            ramadanListRef.current.scrollToIndex({ 
              index: next, 
              animated: true,
              viewPosition: 0.5,
            });
          } catch (error) {
            console.log('Ramadan scroll error');
          }
        }
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveProductIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleProductPress = useCallback((product: Product) => {
    router.push(`/product/${product.id}`);
  }, [router]);

  const renderRankBadge = useCallback((index: number) => {
    const isTop3 = index < 3;
    const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
    
    return (
      <View style={[
        styles.rankBadge,
        isTop3 ? { backgroundColor: rankColors[index] } : styles.rankDefault
      ]}>
        <Text style={styles.rankText}>#{index + 1}</Text>
        {isTop3 && (
          <Ionicons 
            name="trophy" 
            size={10} 
            color="#FFF" 
            style={styles.trophyIcon} 
          />
        )}
      </View>
    );
  }, []);

  const renderProductItem = useCallback(({ item, index }: { item: Product; index: number }) => (
    <Animated.View 
      style={[
        styles.productWrapper, 
        { width: PRODUCT_CARD_WIDTH },
        activeProductIndex === index && styles.activeProduct
      ]}
    >
      <ProductCardPremium 
        product={item} 
        onPress={() => handleProductPress(item)} 
      />
      {renderRankBadge(index)}
    </Animated.View>
  ), [activeProductIndex, handleProductPress, renderRankBadge]);

  const renderBannerItem = useCallback(({ item }: { item: BannerItem }) => (
    <View style={styles.bannerSlide}>
      <LinearGradient 
        colors={item.gradient} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 0 }} 
        style={styles.bannerGradient}
      >
        <View style={styles.bannerContent}>
          <View style={styles.bannerIconContainer}>
            <FontAwesome5 name={item.icon as any} size={24} color="#FFD700" />
          </View>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>{item.text}</Text>
            <Text style={styles.bannerSubtitle}>{item.sub}</Text>
          </View>
        </View>
        <View style={styles.bannerDecoration}>
          <Ionicons name="sparkles" size={20} color="rgba(255,215,0,0.3)" />
        </View>
      </LinearGradient>
    </View>
  ), []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement des tendances...</Text>
      </View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ]
        }
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={COLORS.gradient}
              style={styles.gradientIcon}
            >
              <Ionicons name="trending-up" size={22} color="#FFF" />
            </LinearGradient>
          </View>
          <View>
            <Text style={styles.title}>{t('trending.title')}</Text>
            <Text style={styles.subtitle}>Les plus populaires cette semaine</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.seeAllButton}
          onPress={() => router.push('/category/trending')}
          activeOpacity={0.8}
        >
          <Text style={styles.seeAllText}>{t('trending.explore')}</Text>
          <View style={styles.arrowContainer}>
            <Ionicons name="arrow-forward" size={14} color="#FFF" />
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        {products.slice(0, 5).map((_, index) => (
          <View 
            key={index}
            style={[
              styles.progressDot,
              activeProductIndex === index && styles.progressDotActive
            ]} 
          />
        ))}
      </View>

      <FlatList
        ref={productsListRef}
        data={products}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_FULL_WIDTH}
        decelerationRate="fast"
        keyExtractor={(item, index) => `product-${item.id}-${index}`}
        contentContainerStyle={styles.productsList}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={renderProductItem}
      />

      <View style={styles.bannerContainer}>
        <FlatList
          ref={ramadanListRef}
          data={RAMADAN_BANNERS}
          keyExtractor={(item) => `banner-${item.id}`}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH - (HORIZONTAL_PADDING * 2),
            offset: (SCREEN_WIDTH - (HORIZONTAL_PADDING * 2)) * index,
            index,
          })}
          renderItem={renderBannerItem}
        />
        
        <View style={styles.bannerIndicators}>
          {RAMADAN_BANNERS.map((_, index) => (
            <View 
              key={`indicator-${index}`}
              style={[
                styles.bannerIndicator,
                activeBannerIndex === index && styles.bannerIndicatorActive
              ]} 
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    paddingVertical: 20,
    borderRadius: 24,
    marginHorizontal: 8, // Réduit pour plus d'espace
    marginVertical: 8,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 12,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 10,
  },
  gradientIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
    fontWeight: '500',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  seeAllText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
  },
  arrowContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: 3,
  },

  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 6,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  progressDotActive: {
    width: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },

  // 🔧 CORRECTION PRINCIPALE : Padding réduit pour carte plus large
  productsList: {
    paddingHorizontal: HORIZONTAL_PADDING, // 16px au lieu de 20px
    paddingBottom: 8,
  },
  productWrapper: {
    marginRight: ITEM_SPACING, // 12px au lieu de 16px
    position: 'relative',
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  activeProduct: {
    transform: [{ scale: 1 }],
    opacity: 1,
  },

  rankBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    minWidth: 32,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 8,
    zIndex: 10,
  },
  rankDefault: {
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  rankText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
  },
  trophyIcon: {
    marginLeft: 2,
  },

  bannerContainer: {
    marginHorizontal: HORIZONTAL_PADDING,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerSlide: {
    width: SCREEN_WIDTH - (HORIZONTAL_PADDING * 2),
    height: 80,
  },
  bannerGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bannerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  bannerSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '500',
  },
  bannerDecoration: {
    opacity: 0.6,
  },
  bannerIndicators: {
    position: 'absolute',
    bottom: 10,
    right: 16,
    flexDirection: 'row',
    gap: 6,
  },
  bannerIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  bannerIndicatorActive: {
    backgroundColor: '#FFD700',
    width: 18,
  },

  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    margin: 12,
    borderRadius: 24,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
});