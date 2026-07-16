import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ImageBackground,
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

export default function CategoryGridPremium() {
  const { t } = useTranslation();
  const [realCategories, setRealCategories] = useState<any[]>([]);
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
  }, []);

  useEffect(() => {
    const loadRealCategories = async () => {
      try {
        const q = query(collection(db, 'categories'), limit(6));
        const snapshot = await getDocs(q);
        const firestoreCategories = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || t('app.premium.categoryDefaultName'),
          // On passe le nom à la fonction d'image
          image: getCategoryImage(doc.data().name)
        }));
        setRealCategories(firestoreCategories);
      } catch (error) {
        console.error('❌ Erreur Firestore:', error);
      }
    };
    loadRealCategories();
  }, [t]);

  // LOGIQUE D'IMAGES CIBLÉES
  const getCategoryImage = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('maison') || n.includes('jardin')) 
        return 'https://images.unsplash.com/photo-1615873968403-89e068629275?w=600'; // Salon/Jardin moderne
    if (n.includes('beauté') || n.includes('santé') || n.includes('beaute')) 
        return 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=600'; // Cosmétique/Bien-être
    if (n.includes('mode') || n.includes('vêtement')) 
        return 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600';
    if (n.includes('machine') || n.includes('industriel')) 
        return 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600';
    if (n.includes('electronique') || n.includes('informatique')) 
        return 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600';
    
    return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'; // Défaut (Gadget premium)
  };

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
        {/* CARTE 1 - LARGE (La première catégorie de ta liste) */}
        {realCategories[0] && (
          <TouchableOpacity 
            style={[styles.card, styles.largeCard]} 
            onPressIn={() => prefetchCategory(realCategories[0])}
            onPress={() => navigateToCategory(realCategories[0])}
            activeOpacity={0.8}
          >
            <ImageBackground source={{ uri: realCategories[0].image }} style={styles.imgBg}>
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.gradient}>
                <View style={styles.badge}><Text style={styles.badgeText}>{t('app.premium.categorySpotlight')}</Text></View>
                <Text style={styles.cardTitle}>{realCategories[0].name}</Text>
              </LinearGradient>
              <ShimmerOverlay />
            </ImageBackground>
          </TouchableOpacity>
        )}

        <View style={styles.rightColumn}>
          {/* CARTE 2 */}
          {realCategories[1] && (
            <TouchableOpacity 
              style={[styles.card, styles.mediumCard]}
              onPressIn={() => prefetchCategory(realCategories[1])}
              onPress={() => navigateToCategory(realCategories[1])}
              activeOpacity={0.8}
            >
              <ImageBackground source={{ uri: realCategories[1].image }} style={styles.imgBg}>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.gradient}>
                  <Text style={styles.cardTitleSmall}>{realCategories[1].name}</Text>
                </LinearGradient>
                <ShimmerOverlay />
              </ImageBackground>
            </TouchableOpacity>
          )}

          {/* CARTE 3 */}
          {realCategories[2] && (
            <TouchableOpacity 
              style={[styles.card, styles.mediumCard]}
              onPressIn={() => prefetchCategory(realCategories[2])}
              onPress={() => navigateToCategory(realCategories[2])}
              activeOpacity={0.8}
            >
              <ImageBackground source={{ uri: realCategories[2].image }} style={styles.imgBg}>
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.gradient}>
                  <Text style={styles.cardTitleSmall}>{realCategories[2].name}</Text>
                </LinearGradient>
                <ShimmerOverlay />
              </ImageBackground>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

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
