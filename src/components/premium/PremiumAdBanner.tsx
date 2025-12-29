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

const { width } = Dimensions.get('window');
const BANNER_WIDTH = width - 40;

const PREMIUM_ADS_DATA = [
  {
    id: 1,
    title: "FLASH DEAL EXCLUSIF",
    subtitle: "Économisez jusqu'à 70% sur les machines industrielles",
    description: "Offre limitée • Fin dans",
    bgImage: "https://via.placeholder.com/800x200/ff6a00/ffffff?text=FLASH+DEAL+70%",
    gradient: ['#ff4444', '#ff6a00'],
    icon: "flash",
    timer: "02:15:33",
    cta: "Acheter Maintenant",
    badge: "HOT",
    products: 124,
    route: "/flash-deals"
  },
  {
    id: 2, 
    title: "LIVRAISON EXPRESS GOLD",
    subtitle: "Livraison gratuite et express dès 50 000 FCFA",
    description: "Commande avant 14h • Livré demain",
    bgImage: "https://via.placeholder.com/800x200/4CAF50/ffffff?text=LIVRAISON+EXPRESS",
    gradient: ['#4CAF50', '#66BB6A'],
    icon: "rocket",
    timer: null,
    cta: "Voir les Conditions",
    badge: "EXPRESS",
    products: 89,
    route: "/shipping-info"
  },
  {
    id: 3,
    title: "NOUVEAUTÉS 2024",
    subtitle: "Découvrez les dernières technologies industrielles",
    description: "Innovation • Garantie 3 ans • Support technique",
    bgImage: "https://via.placeholder.com/800x200/2196F3/ffffff?text=NOUVEAUTÉS+2024",
    gradient: ['#2196F3', '#42A5F5'],
    icon: "sparkles",
    timer: "06:45:12",
    cta: "Découvrir",
    badge: "NEW",
    products: 256,
    route: "/new-arrivals"
  }
];

export default function PremiumAdBanner() {
  const router = useRouter();
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const nextAd = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 400,
        useNativeDriver: true,
      })
    ]).start(() => {
      setCurrentAdIndex((prev) => (prev + 1) % PREMIUM_ADS_DATA.length);
      
      fadeAnim.setValue(0);
      slideAnim.setValue(100);
      scaleAnim.setValue(0.9);
      progressAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: false,
        })
      ]).start();
    });
  };

  useEffect(() => {
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
              colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
              style={styles.overlayGradient}
            >
              <View style={styles.bannerContent}>
                <View style={styles.badgeContainer}>
                  <LinearGradient
                    colors={currentAd.gradient}
                    style={styles.badge}
                  >
                    <Ionicons 
                      name={currentAd.icon as any} 
                      size={14} 
                      color="#fff" 
                    />
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

                  <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                      <Ionicons name="cube-outline" size={12} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.statText}>{currentAd.products} produits</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                      <Ionicons name="trending-up" size={12} color="rgba(255,255,255,0.8)" />
                      <Text style={styles.statText}>+24% aujourd'hui</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.ctaContainer}>
                  <TouchableOpacity 
                    style={styles.ctaButton}
                    onPress={() => router.push(currentAd.route)}
                  >
                    <LinearGradient
                      colors={currentAd.gradient}
                      style={styles.ctaGradient}
                    >
                      <Text style={styles.ctaText}>{currentAd.cta}</Text>
                      <Ionicons name="arrow-forward" size={16} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
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
          <TouchableOpacity
            key={index}
            onPress={() => {
              setCurrentAdIndex(index);
              progressAnim.setValue(0);
              Animated.timing(progressAnim, {
                toValue: 1,
                duration: 4000,
                useNativeDriver: false,
              }).start();
            }}
          >
            <View 
              style={[
                styles.paginationDot,
                index === currentAdIndex && styles.paginationDotActive
              ]}
            >
              {index === currentAdIndex && (
                <Animated.View 
                  style={[
                    styles.paginationFill,
                    {
                      transform: [{
                        scale: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.3, 1]
                        })
                      }]
                    }
                  ]} 
                />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.navigationContainer}>
        <TouchableOpacity 
          style={styles.navButton}
          onPress={() => {
            const prevIndex = (currentAdIndex - 1 + PREMIUM_ADS_DATA.length) % PREMIUM_ADS_DATA.length;
            setCurrentAdIndex(prevIndex);
            progressAnim.setValue(0);
          }}
        >
          <Ionicons name="chevron-back" size={20} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.navButton}
          onPress={nextAd}
        >
          <Ionicons name="chevron-forward" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 16,
    position: 'relative',
  },
  bannerContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
  },
  bannerTouchable: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  backgroundImage: {
    width: '100%',
    height: 180,
  },
  backgroundImageStyle: {
    borderRadius: 24,
  },
  overlayGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badgeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopLeftRadius: 24,
    borderBottomRightRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },
  textContent: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 8,
    lineHeight: 18,
  },
  description: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  timerText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 4,
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 8,
  },
  ctaContainer: {
    justifyContent: 'flex-start',
  },
  ctaButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ctaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginRight: 6,
  },
  progressBarContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDotActive: {
    backgroundColor: 'rgba(255, 106, 0, 0.3)',
  },
  paginationFill: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff6a00',
  },
  navigationContainer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    transform: [{ translateY: -20 }],
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});