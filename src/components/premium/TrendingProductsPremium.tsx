// src/components/premium/TrendingProductsPremium.tsx
import React, { useEffect, useRef, useCallback, useMemo } from 'react';
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
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import ProductCardPremium from './ProductCardPremium';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_GAP = 12;
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (SCREEN_WIDTH - COLUMN_GAP * 3) / NUM_COLUMNS; // 12 padding horizontal de chaque côté + gap entre colonnes

const COLORS = {
  primary: '#FF6B35',
  primaryDark: '#E55A2A',
  accent: '#FFD700',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  text: '#111827',
  textSecondary: '#4B5563',
  muted: '#9CA3AF',
  gradientStart: '#FF8A5E',
  gradientEnd: '#FF5E3A',
};

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string | null;
  mainImage?: string | null;
  rating?: number;
  stock?: number;
  supplier?: string;
  minOrder?: number;
  deliveryTime?: string;
  isVerified?: boolean;
  trending?: boolean;
  [key: string]: any;
}

interface TrendingProductsPremiumProps {
  products: Product[];
  headerComponent?: React.ReactElement;
  footerComponent?: React.ReactElement;
  onProductPress: (product: Product) => void;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

// Composant d'item mémoïsé avec badge de classement
const TrendingProductItem = React.memo(
  ({ item, rank, disableInternalPress }: { item: Product; rank: number; disableInternalPress?: boolean }) => {
    const isTop3 = rank <= 3;

    return (
      <View style={styles.cardContainer}>
        {/* ProductCardPremium avec désactivation du press interne */}
        <ProductCardPremium
          product={item}
          disableInternalPress={disableInternalPress}
        />

        {/* Badge de classement */}
        <View
          style={[
            styles.rankBadge,
            isTop3 ? styles.rankTop3 : styles.rankNormal,
            rank === 1 && styles.rankGold,
            rank === 2 && styles.rankSilver,
            rank === 3 && styles.rankBronze,
          ]}
        >
          <Ionicons name="trophy" size={12} color="#fff" style={styles.rankIcon} />
          <Text style={styles.rankNumber}>#{rank}</Text>
        </View>

        {/* Badge "TOP X" pour les 3 premiers */}
        {isTop3 && (
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.trendingBadge}
          >
            <Ionicons name="flash" size={12} color="#000" />
            <Text style={styles.trendingText}>TOP {rank}</Text>
          </LinearGradient>
        )}
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.item.id === nextProps.item.id &&
    prevProps.rank === nextProps.rank &&
    prevProps.disableInternalPress === nextProps.disableInternalPress
);
TrendingProductItem.displayName = 'TrendingProductItem';

export default function TrendingProductsPremium({
  products,
  headerComponent,
  footerComponent,
  onProductPress,
  loading = false,
  refreshing = false,
  onRefresh,
}: TrendingProductsPremiumProps) {
  const { t } = useTranslation();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  // Animation d'entrée
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 10, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  // Rendu d'un item de la liste (avec TouchableOpacity parent)
  const renderItem = useCallback(
    ({ item, index }: { item: Product; index: number }) => {
      const rank = index + 1;
      return (
        <TouchableOpacity
          style={styles.itemWrapper}
          onPress={() => onProductPress(item)}
          activeOpacity={0.8}
        >
          <TrendingProductItem
            item={item}
            rank={rank}
            disableInternalPress={true} // ← Désactive le press interne de ProductCardPremium
          />
        </TouchableOpacity>
      );
    },
    [onProductPress]
  );

  const keyExtractor = useCallback((item: Product, index: number) => `trending-${item.id}-${index}`, []);

  const ItemSeparator = useCallback(() => <View style={{ height: COLUMN_GAP }} />, []);

  if (loading) {
    return (
      <View style={styles.loadingWrapper}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingLabel}>{t('app.premium.trendingLoading')}</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeIn, transform: [{ translateY }] }]}>
      {/* En-tête fixe du composant (titre + icône) */}
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <LinearGradient colors={[COLORS.gradientStart, COLORS.gradientEnd]} style={styles.titleIcon}>
            <Ionicons name="trending-up" size={28} color="#fff" />
          </LinearGradient>
          <View style={styles.titleTextContainer}>
            <Text style={styles.sectionTitle}>{t('app.premium.trendingSectionTitle')}</Text>
            <Text style={styles.sectionSubtitle}>{t('app.premium.trendingSectionSubtitle')}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={products}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={headerComponent}
        ListFooterComponent={footerComponent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('app.premium.trendingEmpty')}</Text>
        }
        // Optimisations de performance
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS === 'android'}
        updateCellsBatchingPeriod={50}
        // RefreshControl
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          ) : undefined
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  titleTextContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: COLUMN_GAP,
  },
  listContent: {
    paddingBottom: 20,
  },
  itemWrapper: {
    width: ITEM_WIDTH,
    marginBottom: 4,
    // S'assurer que le TouchableOpacity couvre toute la zone
  },
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  rankBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    minWidth: 48,
    height: 32,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 6 },
    }),
  },
  rankTop3: {
    backgroundColor: 'transparent',
  },
  rankGold: {
    backgroundColor: '#F59E0B',
  },
  rankSilver: {
    backgroundColor: '#94A3B8',
  },
  rankBronze: {
    backgroundColor: '#B45309',
  },
  rankNormal: {
    backgroundColor: 'rgba(30,30,30,0.9)',
  },
  rankIcon: {
    marginRight: 4,
  },
  rankNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  trendingBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  trendingText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
  },
  loadingWrapper: {
    flex: 1,
    padding: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  loadingLabel: {
    marginTop: 16,
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  emptyText: {
    color: COLORS.muted,
    textAlign: 'center',
    padding: 40,
    fontSize: 15,
    fontWeight: '500',
  },
});
