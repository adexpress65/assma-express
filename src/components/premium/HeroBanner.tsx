// src/components/premium/HeroBanner.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - 32;

const BANNERS = [
  {
    id: '1',
    image: 'https://via.placeholder.com/800x400/ff6a00/ffffff?text=Grossiste+International',
    title: 'Grossiste International',
    subtitle: '50 000+ Produits • 2 000+ Fournisseurs',
    cta: 'Découvrir',
    color: ['#ff6a00', '#ff8c00'],
    route: '/categories',
  },
  {
    id: '2', 
    image: 'https://via.placeholder.com/800x400/2196F3/ffffff?text=Machines+Industrielles',
    title: 'Machines Industrielles',
    subtitle: 'Équipements Professionnels • Livraison Mondiale',
    cta: 'Explorer',
    color: ['#2196F3', '#21CBF3'],
    route: '/category/machines',
  },
  {
    id: '3',
    image: 'https://via.placeholder.com/800x400/4CAF50/ffffff?text=Fournisseurs+Verifiés',
    title: 'Fournisseurs Vérifiés',
    subtitle: 'Qualité Garantie • Inspection sur Place',
    cta: 'Vérifier',
    color: ['#4CAF50', '#66BB6A'],
    route: '/suppliers',
  },
  // NOUVEAU BANNER POUR DEVENIR FOURNISSEUR
  {
    id: '4',
    image: 'https://via.placeholder.com/800x400/9C27B0/ffffff?text=Devenir+Fournisseur',
    title: 'Devenir Fournisseur',
    subtitle: 'Vendez vos produits à l\'international • Rejoignez ASMA Express',
    cta: 'Commencer',
    color: ['#9C27B0', '#BA68C8'],
    route: '/become-supplier',
    special: true, // Marqueur pour le badge spécial
  },
];

export default function HeroBanner() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % BANNERS.length;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [currentIndex]);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const renderBanner = ({ item, index }) => {
    const inputRange = [
      (index - 1) * BANNER_WIDTH,
      index * BANNER_WIDTH,
      (index + 1) * BANNER_WIDTH,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.bannerContainer, { transform: [{ scale }] }]}>
        <TouchableOpacity 
          style={styles.bannerTouchable}
          activeOpacity={0.9}
          onPress={() => router.push(item.route)}
        >
          <Image source={{ uri: item.image }} style={styles.bannerImage} />
          
          {/* BADGE SPÉCIAL POUR DEVENIR FOURNISSEUR */}
          {item.special && (
            <View style={styles.specialBadge}>
              <Text style={styles.specialBadgeText}>NOUVEAU</Text>
            </View>
          )}
          
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
            style={styles.gradientOverlay}
          >
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>{item.title}</Text>
              <Text style={styles.bannerSubtitle}>{item.subtitle}</Text>
              <TouchableOpacity 
                style={styles.ctaButton}
                onPress={() => router.push(item.route)}
              >
                <LinearGradient
                  colors={item.color}
                  style={styles.ctaGradient}
                >
                  <Text style={styles.ctaText}>{item.cta}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={BANNERS}
        renderItem={renderBanner}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.flatList}
      />
      
      <View style={styles.indicatorsContainer}>
        {BANNERS.map((_, index) => {
          const inputRange = [
            (index - 1) * BANNER_WIDTH,
            index * BANNER_WIDTH,
            (index + 1) * BANNER_WIDTH,
          ];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 20, 8],
            extrapolate: 'clamp',
          });

          const dotOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.5, 1, 0.5],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.indicator,
                {
                  width: dotWidth,
                  opacity: dotOpacity,
                },
              ]}
            />
          );
        })}
      </View>

      <TouchableOpacity 
        style={[styles.navButton, styles.prevButton]}
        onPress={() => {
          const prevIndex = (currentIndex - 1 + BANNERS.length) % BANNERS.length;
          setCurrentIndex(prevIndex);
          flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
        }}
      >
        <Ionicons name="chevron-back" size={20} color="#fff" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.navButton, styles.nextButton]}
        onPress={() => {
          const nextIndex = (currentIndex + 1) % BANNERS.length;
          setCurrentIndex(nextIndex);
          flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        }}
      >
        <Ionicons name="chevron-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  flatList: {
    borderRadius: 20,
  },
  bannerContainer: {
    width: BANNER_WIDTH,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
  },
  bannerTouchable: {
    flex: 1,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  // NOUVEAU STYLES POUR LE BADGE SPÉCIAL
  specialBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  specialBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
  },
  gradientOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  bannerContent: {
    alignItems: 'flex-start',
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  bannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  ctaButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ctaText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 6,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
  },
  indicator: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    marginHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prevButton: {
    left: 8,
  },
  nextButton: {
    right: 8,
  },
});