// src/components/premium/PremiumAdBanner.tsx
import React, { useRef, useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Dimensions,
  ImageBackground
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// --- CONFIGURATION DE VISIBILITÉ ---
const SHOW_ADS = false; // Passe à 'true' pour afficher la bannière
// ------------------------------------

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width - 40;

const PREMIUM_ADS_DATA = [
  {
    id: 1,
    title: "SPÉCIAL RAMADAN 2026",
    subtitle: "Économisez jusqu'à 30% sur l'alimentaire",
    description: "Préparez vos stocks dès maintenant",
    bgImage: "https://images.unsplash.com/photo-1564121211835-e88c852648ab?q=80&w=800",
    gradient: ['#0F2027', '#203A43'],
    icon: "moon",
    timer: "05:12:45",
    cta: "Voir les Offres",
    badge: "RAMADAN",
    products: 450,
    route: "/search?q=ramadan"
  },
  {
    id: 2, 
    title: "LIVRAISON EXPRESS GOLD",
    subtitle: "Livraison gratuite et express dès 50 000 FCFA",
    description: "Commande avant 14h • Livré demain",
    bgImage: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=800",
    gradient: ['#4CAF50', '#66BB6A'],
    icon: "rocket",
    timer: null,
    cta: "Conditions",
    badge: "EXPRESS",
    products: 89,
    route: "/shipping-info"
  },
  {
    id: 3,
    title: "TECH & INDUSTRIE 2026",
    subtitle: "Les dernières machines au meilleur prix",
    description: "Innovation • Garantie 3 ans • Support technique",
    bgImage: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=800",
    gradient: ['#2196F3', '#42A5F5'],
    icon: "construct",
    timer: "12:00:00",
    cta: "Découvrir",
    badge: "PRO",
    products: 256,
    route: "/new-arrivals"
  }
];

export default function PremiumAdBanner() {
  const router = useRouter();

  // Condition de sortie immédiate si désactivé
  if (!SHOW_ADS) return null;

  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const nextAd = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -100, duration: 400, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 400, useNativeDriver: true })
    ]).start(() => {
      setCurrentAdIndex((prev) => (prev + 1) % PREMIUM_ADS_DATA.length);
      
      fadeAnim.setValue(0);
      slideAnim.setValue(100);
      scaleAnim.setValue(0.9);
      progressAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(progressAnim, { toValue: 1, duration: 4000, useNativeDriver: false })
      ]).start();
    });
  };

  useEffect(() => {
    // Initialise la barre de progression pour la première slide
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(nextAd, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentAd = PREMIUM_ADS_DATA[currentAdIndex];

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.bannerContainer,
          { 
            opacity: fadeAnim,
            transform: [
              { translateX: slideAnim },
              { scale: scaleAnim }
            ]
          }
        ]}
      >
        <TouchableOpacity 
          style={styles.bannerTouchable}
          activeOpacity={0.9}
          onPress={() => router.push(currentAd.route)}
        >
          <ImageBackground
            source={{ uri: currentAd.bgImage }}
            style={styles.backgroundImage}
            imageStyle={styles.backgroundImageStyle}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)']}
              style={styles.overlayGradient}
            >
              <View style={styles.bannerContent}>
                <View style={styles.badgeContainer}>
                  <LinearGradient
                    colors={currentAd.gradient}
                    style={styles.badge}
                  >
                    <Ionicons name={currentAd.icon as any} size={14} color="#fff" />
                    <Text style={styles.badgeText}>{currentAd.badge}</Text>
                  </LinearGradient>
                </View>

                <View style={styles.textContent}>
                  <Text style={styles.title}>{currentAd.title}</Text>
                  <Text style={styles.subtitle}>{currentAd.subtitle}</Text>
                  <Text style={styles.description}>{currentAd.description}</Text>
                  
                  {currentAd.timer && (
                    <View style={styles.timerContainer}>
                      <Ionicons name="time-outline" size={16} color="#FFD700" />
                      <Text style={styles.timerText}>{currentAd.timer}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.ctaContainer}>
                  <View style={styles.ctaButton}>
                    <LinearGradient colors={currentAd.gradient} style={styles.ctaGradient}>
                      <Text style={styles.ctaText}>{currentAd.cta}</Text>
                      <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </LinearGradient>
                  </View>
                </View>
              </View>

              <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                  <Animated.View 
                    style={[
                      styles.progressFill,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%']
                        })
                      }
                    ]} 
                  />
                </View>
              </View>
            </LinearGradient>
          </ImageBackground>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.indicatorsContainer}>
        {PREMIUM_ADS_DATA.map((_, index) => (
          <View key={index} style={[styles.paginationDot, index === currentAdIndex && styles.paginationDotActive]}>
             {index === currentAdIndex && <View style={styles.paginationFill} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 20, marginVertical: 16 },
  bannerContainer: { borderRadius: 24, overflow: 'hidden', elevation: 8, backgroundColor: '#eee' },
  bannerTouchable: { borderRadius: 24, overflow: 'hidden' },
  backgroundImage: { width: '100%', height: 180 },
  backgroundImageStyle: { borderRadius: 24 },
  overlayGradient: { flex: 1, padding: 20, justifyContent: 'space-between' },
  bannerContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  badgeContainer: { position: 'absolute', top: -10, left: -10 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderBottomRightRadius: 12 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', marginLeft: 4 },
  textContent: { flex: 1, marginTop: 20 },
  title: { fontSize: 18, fontWeight: '900', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 4 },
  description: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  timerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  timerText: { color: '#FFD700', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  ctaContainer: { justifyContent: 'flex-end', marginBottom: 10 },
  ctaButton: { borderRadius: 10, overflow: 'hidden' },
  ctaGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  ctaText: { color: '#fff', fontSize: 12, fontWeight: '700', marginRight: 4 },
  progressBarContainer: { marginTop: 10 },
  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff' },
  indicatorsContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  paginationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd', marginHorizontal: 4 },
  paginationDotActive: { backgroundColor: '#ff6a00' },
  paginationFill: { flex: 1, borderRadius: 4, backgroundColor: '#ff6a00' }
});