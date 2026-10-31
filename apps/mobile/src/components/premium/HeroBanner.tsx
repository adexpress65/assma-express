import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 32;
const TRENDING_ITEM_WIDTH = 85 + 18; // Largeur du cercle (85) + marginRight (18)
const TRENDING_DISPLAY_LIMIT = 15;

const BANNERS = [
  { id: 'banner_1', image: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800', title: 'Grossiste International', subtitle: 'Direct Usine' },
  { id: 'banner_2', image: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800', title: 'Machines Industrielles', subtitle: 'Qualité Pro' },
  { id: 'banner_3', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800', title: 'Mode & Accessoires', subtitle: 'Collection 2026' },
  { id: 'banner_4', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800', title: 'Électronique', subtitle: 'High-Tech' },
  { id: 'banner_5', image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800', title: 'Logistique & Fret', subtitle: 'A2Express Logistique' },
  { id: 'banner_6', image: 'https://images.unsplash.com/photo-1556740758-90de374c12ad?w=800', title: 'Devenir Fournisseur', subtitle: 'Vendez dans le monde entier' },
];

export type HeroBannerProduct = {
  id?: string;
  firebaseId?: string;
  name?: string;
  mainImage?: string | null;
  imageUrl?: string | null;
};

type HeroBannerProps = {
  trendingProducts?: HeroBannerProduct[];
};

export default function HeroBanner({ trendingProducts = [] }: HeroBannerProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const flatListBannerRef = useRef<FlatList>(null);
  const flatListTrendingRef = useRef<FlatList>(null);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [trendingIndex, setTrendingIndex] = useState(0);

  const displayedTrending = useMemo(
    () => trendingProducts.slice(0, TRENDING_DISPLAY_LIMIT),
    [trendingProducts],
  );

  // Auto-scroll Bannières
  useEffect(() => {
    const interval = setInterval(() => {
      const next = (bannerIndex + 1) % BANNERS.length;
      setBannerIndex(next);
      flatListBannerRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0.5 });
    }, 6000);
    return () => clearInterval(interval);
  }, [bannerIndex]);

  // Auto-scroll Tendances
  useEffect(() => {
    if (displayedTrending.length > 0) {
      const interval = setInterval(() => {
        const next = (trendingIndex + 1) % displayedTrending.length;
        setTrendingIndex(next);
        flatListTrendingRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0 });
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [trendingIndex, displayedTrending]);

  useEffect(() => {
    setTrendingIndex(0);
  }, [displayedTrending]);

  return (
    <View style={styles.container}>
      {/* 1. BANNIÈRES */}
      <View style={styles.bannerWrapper}>
        <FlatList
          ref={flatListBannerRef}
          data={BANNERS}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          // --- AJOUTS POUR LE WEB ---
          getItemLayout={(data, index) => (
            { length: BANNER_WIDTH, offset: BANNER_WIDTH * index, index }
          )}
          onScrollToIndexFailed={() => {}} 
          // ---------------------------
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push('/categories')} style={styles.bannerItem}>
              <Image
                source={{ uri: item.image }}
                style={styles.bannerImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={item.id}
              />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.overlay}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.subtitle}>{item.subtitle}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* 2. TENDANCES */}
      <View style={styles.trendingContainer}>
        <Text style={styles.sectionTitle}>{t('app.premium.heroCurrentTrends')}</Text>
        <FlatList
          ref={flatListTrendingRef}
          data={displayedTrending}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item, index) => `trending-${item.id || item.firebaseId || index}`}
          contentContainerStyle={{ paddingLeft: 16, paddingBottom: 10 }}
          // --- AJOUTS POUR LE WEB ---
          getItemLayout={(data, index) => (
            { length: TRENDING_ITEM_WIDTH, offset: TRENDING_ITEM_WIDTH * index, index }
          )}
          onScrollToIndexFailed={() => {}}
          // ---------------------------
          renderItem={({ item }) => {
            const productId = item.id || item.firebaseId;
            return (
            <TouchableOpacity 
              style={styles.circleCard}
              onPress={() => {
                if (productId) router.push(`/product/${productId}`);
              }}
            >
              <View style={styles.circleImageWrapper}>
                <Image
                  source={{ uri: item.mainImage || item.imageUrl || undefined }}
                  style={styles.circleImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  recyclingKey={productId}
                />
              </View>
              <Text numberOfLines={1} style={styles.circleName}>{item.name}</Text>
            </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 10 },
  bannerWrapper: {
    marginHorizontal: 16,
    borderRadius: 25,
    overflow: 'hidden',
    height: 170,
    backgroundColor: '#000',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  bannerItem: { width: BANNER_WIDTH, height: 170 },
  bannerImage: { width: '100%', height: '100%', position: 'absolute' },
  overlay: { flex: 1, justifyContent: 'flex-end', padding: 20 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { color: '#fff', opacity: 0.9, fontSize: 13 },

  trendingContainer: { marginTop: 25 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginLeft: 20, marginBottom: 15, color: '#222' },
  circleCard: { alignItems: 'center', marginRight: 18, width: 85 },
  circleImageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    padding: 2,
    borderWidth: 2,
    borderColor: '#FF6B00',
  },
  circleImage: { width: '100%', height: '100%', borderRadius: 40 },
  circleName: { fontSize: 11, fontWeight: '700', marginTop: 6, textAlign: 'center', color: '#444' }
});
