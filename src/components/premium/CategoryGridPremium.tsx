import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { router } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

export type CategoryGridItem = {
  id: string;
  name: string;
  image?: string;
};

type CategoryGridPremiumProps = {
  /** Liste déjà chargée par le parent : aucune requête Firestore si fournie. */
  categories?: CategoryGridItem[];
};

function CategoryGridPremium({ categories }: CategoryGridPremiumProps) {
  const { t } = useTranslation();
  const parentControlled = categories !== undefined;
  const [fetchedCategories, setFetchedCategories] = useState<CategoryGridItem[]>([]);
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  // Animation Shimmer Premium
  useEffect(() => {
    const startAnimation = () => {
      shimmerAnim.setValue(-1);
      Animated.timing(shimmerAnim, {
        toValue: 2,
        duration: 4000,
        easing: Easing.bezier(0.3, 0, 0.7, 1),
        useNativeDriver: true,
      }).start(() => startAnimation());
    };
    startAnimation();
  }, [shimmerAnim]);

  useEffect(() => {
    if (parentControlled) return;

    const loadRealCategories = async () => {
      try {
        const q = query(collection(db, 'categories'), limit(6));
        const snapshot = await getDocs(q);
        const firestoreCategories = snapshot.docs.map(doc => {
          const data = doc.data() as Record<string, unknown>;
          const imageRaw =
            [data.image, data.imageUrl, data.coverImage].find(
              (value) => typeof value === 'string' && String(value).trim().length > 0,
            ) ?? '';
          return {
            id: doc.id,
            name: (typeof data.name === 'string' && data.name.trim())
              ? data.name
              : t('app.premium.categoryDefaultName'),
            image: String(imageRaw).trim(),
          };
        });
        setFetchedCategories(firestoreCategories);
      } catch (error) {
        console.error('❌ Erreur Firestore:', error);
      }
    };
    void loadRealCategories();
  }, [parentControlled, t]);

  const realCategories = useMemo(() => {
    const source = parentControlled ? (categories ?? []) : fetchedCategories;
    return source.filter((cat) => cat?.id).slice(0, 6);
  }, [parentControlled, categories, fetchedCategories]);

  const categoryHref = (cat: { id: string; name: string }) => ({
    pathname: "/category/[id]" as const,
    params: {
      id: cat.id,
      categoryName: cat.name,
    },
  });

  const prefetchCategory = (cat: { id: string; name: string; image?: string }) => {
    try {
      router.prefetch(categoryHref(cat));
    } catch {
      /* prefetch optionnel selon version navigateur */
    }
    const uri = cat.image?.trim();
    if (uri) {
      ExpoImage.prefetch(uri, { cachePolicy: "memory-disk" }).catch(() => {});
    }
  };

  const navigateToCategory = (cat: { id: string; name: string }) => {
    router.push(categoryHref(cat));
  };

  const ShimmerOverlay = () => (
    <Animated.View
      style={[
        styles.shimmer,
        {
          transform: [
            {
              translateX: shimmerAnim.interpolate({
                inputRange: [-1, 2],
                outputRange: [-width, width],
              }),
            },
          ],
        },
      ]}
    />
  );

  const renderCardImage = (cat: CategoryGridItem, variant: 'hero' | 'small') => {
    const uri = cat.image?.trim();
    return (
      <View style={styles.imgBg}>
        {uri ? (
          <ExpoImage
            source={{ uri }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={cat.id}
          />
        ) : null}
        <LinearGradient
          colors={
            variant === 'hero'
              ? ['transparent', 'rgba(0,0,0,0.85)']
              : ['transparent', 'rgba(0,0,0,0.75)']
          }
          style={styles.gradient}
        >
          {variant === 'hero' ? (
            <>
              <View style={styles.badge}><Text style={styles.badgeText}>{t('app.premium.categorySpotlight')}</Text></View>
              <Text style={styles.cardTitle}>{cat.name}</Text>
            </>
          ) : (
            <Text style={styles.cardTitleSmall}>{cat.name}</Text>
          )}
        </LinearGradient>
        <ShimmerOverlay />
      </View>
    );
  };

  if (realCategories.length < 1) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
            <Text style={styles.title}>{t('app.premium.categoryHubTitle')}</Text>
            <Text style={styles.subtitle}>{t('app.premium.categoryHubSubtitle')}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/categories')} style={styles.btnAll}>
          <Text style={styles.seeAll}>{t('app.premium.categorySeeAll')}</Text>
          <MaterialIcons name="grid-view" size={16} color="#FF6A00" />
        </TouchableOpacity>
      </View>

      <View style={styles.bentoGrid}>
        {realCategories[0] && (
          <TouchableOpacity 
            style={[styles.card, styles.largeCard]} 
            onPressIn={() => prefetchCategory(realCategories[0])}
            onPress={() => navigateToCategory(realCategories[0])}
            activeOpacity={0.8}
          >
            {renderCardImage(realCategories[0], 'hero')}
          </TouchableOpacity>
        )}

        <View style={styles.rightColumn}>
          {realCategories[1] && (
            <TouchableOpacity 
              style={[styles.card, styles.mediumCard]}
              onPressIn={() => prefetchCategory(realCategories[1])}
              onPress={() => navigateToCategory(realCategories[1])}
              activeOpacity={0.8}
            >
              {renderCardImage(realCategories[1], 'small')}
            </TouchableOpacity>
          )}

          {realCategories[2] && (
            <TouchableOpacity 
              style={[styles.card, styles.mediumCard]}
              onPressIn={() => prefetchCategory(realCategories[2])}
              onPress={() => navigateToCategory(realCategories[2])}
              activeOpacity={0.8}
            >
              {renderCardImage(realCategories[2], 'small')}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export default React.memo(
  CategoryGridPremium,
  (prev, next) => {
    const prevCats = prev.categories;
    const nextCats = next.categories;
    if (prevCats === nextCats) return true;
    if (!prevCats || !nextCats) return prevCats === nextCats;
    if (prevCats.length !== nextCats.length) return false;
    return prevCats.every(
      (cat, index) =>
        cat.id === nextCats[index]?.id &&
        cat.name === nextCats[index]?.name &&
        cat.image === nextCats[index]?.image,
    );
  },
);

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, marginVertical: 25 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 18 
  },
  title: { fontSize: 22, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.8 },
  subtitle: { fontSize: 13, color: '#888', marginTop: -2 },
  btnAll: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF0E6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  seeAll: { color: '#FF6A00', fontWeight: '800', fontSize: 13 },
  
  bentoGrid: { flexDirection: 'row', height: 280, gap: 12 },
  rightColumn: { flex: 1, gap: 12 },
  card: { borderRadius: 28, overflow: 'hidden', backgroundColor: '#F5F5F5', elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  largeCard: { flex: 1.3 },
  mediumCard: { flex: 1 },
  imgBg: { width: '100%', height: '100%' },
  gradient: { flex: 1, justifyContent: 'flex-end', padding: 18 },
  
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 4 },
  cardTitleSmall: { color: '#fff', fontSize: 14, fontWeight: '800' },
  badge: { backgroundColor: '#FF6A00', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginBottom: 8 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '45%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    transform: [{ skewX: '-25deg' }],
  },
});
