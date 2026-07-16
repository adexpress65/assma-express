// app/intro.tsx - VERSION CORRIGÉE AVEC LOGIQUE ANTI-RÉPÉTITION
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
  PanResponder,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import LoginModal from '../../src/components/account/LoginModal';
import { useAuth } from '../../src/contexts/AuthContext';
import { db } from '@/config/firebase';
import { COLORS } from '@/constants/Theme';

const { width, height } = Dimensions.get('window');

/** Images B2B (secours) — remplacées par de vrais visuels produits si Firestore répond. */
const FALLBACK_SHOWCASE: { uri: string; caption: string }[] = [
  {
    uri: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80',
    caption: 'Logistique & entrepôts',
  },
  {
    uri: 'https://images.unsplash.com/photo-1565514021063-600440df7e8a?w=1200&q=80',
    caption: 'Équipements professionnels',
  },
  {
    uri: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=1200&q=80',
    caption: 'Grossistes & stocks',
  },
  {
    uri: 'https://images.unsplash.com/photo-1563771910408-296953d7a1c0?w=1200&q=80',
    caption: 'Industrie & matériaux',
  },
];

const SPLASH_TAGLINES = [
  'Fournisseurs vérifiés',
  'Achats B2B simplifiés',
  'Livraison & suivi centralisés',
  'Votre marketplace pro',
];

function SplashLoadingScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState(FALLBACK_SHOWCASE);
  const [slideIndex, setSlideIndex] = useState(0);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const kenBurns = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(db, 'products'),
          where('status', '==', 'published'),
          limit(8)
        );
        const snap = await getDocs(q);
        const fromDb: { uri: string; caption: string }[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as Record<string, unknown>;
          const uri =
            (typeof d.mainImage === 'string' && d.mainImage) ||
            (typeof d.imageUrl === 'string' && d.imageUrl) ||
            (Array.isArray(d.images) && typeof d.images[0] === 'string' && d.images[0]);
          if (uri && fromDb.length < 6) {
            fromDb.push({
              uri,
              caption:
                (typeof d.name === 'string' && d.name.slice(0, 42)) || 'Produit partenaire',
            });
          }
        });
        if (!cancelled && fromDb.length >= 2) setItems(fromDb.slice(0, 7));
      } catch {
        /* Firestore indisponible ou index : on garde le fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    Animated.spring(logoScale, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [logoScale]);

  useEffect(() => {
    const kb = Animated.loop(
      Animated.sequence([
        Animated.timing(kenBurns, {
          toValue: 1.09,
          duration: 14000,
          useNativeDriver: true,
        }),
        Animated.timing(kenBurns, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    kb.start();
    return () => kb.stop();
  }, [kenBurns]);

  useEffect(() => {
    if (items.length === 0) return;
    const id = setInterval(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true,
      }).start(() => {
        setSlideIndex((i) => (i + 1) % items.length);
        setTaglineIndex((i) => (i + 1) % SPLASH_TAGLINES.length);
        Animated.timing(fade, {
          toValue: 1,
          duration: 520,
          useNativeDriver: true,
        }).start();
      });
    }, 3800);
    return () => clearInterval(id);
  }, [fade, items.length]);

  const current = items[slideIndex % Math.max(items.length, 1)] ?? items[0];

  return (
    <View style={splashStyles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Animated.View
        style={[
          splashStyles.imageWrap,
          {
            opacity: fade,
            transform: [{ scale: kenBurns }],
          },
        ]}
      >
        {current ? (
          <Image
            source={{ uri: current.uri }}
            style={splashStyles.bgImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={400}
          />
        ) : null}
      </Animated.View>

      <LinearGradient
        colors={['rgba(15,23,42,0.25)', 'rgba(15,23,42,0.75)', 'rgba(10,15,30,0.92)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${COLORS.primary}55`, 'transparent']}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={splashStyles.orangeGlow}
      />

      <View style={[splashStyles.safeTop, { paddingTop: Math.max(insets.top, 16) }]}>
        <Animated.Text style={[splashStyles.brandSmall, { transform: [{ scale: logoScale }] }]}>
          A2EXPRESS
        </Animated.Text>
        <Text style={splashStyles.brandTag}>Marketplace B2B</Text>
      </View>

      <View style={splashStyles.centerBlock}>
        <View style={splashStyles.lottieRing}>
          <View style={splashStyles.lottieRingBorder}>
            <LottieView
              source={require('../../assets/animations/loading-pulse.json')}
              autoPlay
              loop
              style={splashStyles.lottie}
            />
          </View>
        </View>
        <Text style={splashStyles.loadingTitle}>Chargement de votre espace…</Text>
        <Text style={splashStyles.caption} numberOfLines={2}>
          {current?.caption ?? ' '}
        </Text>
        <Animated.Text style={splashStyles.tagline}>
          {SPLASH_TAGLINES[taglineIndex]}
        </Animated.Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          splashStyles.thumbRow,
          { paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        {items.map((it, i) => (
          <View
            key={`${it.uri}-${i}`}
            style={[
              splashStyles.thumb,
              i === slideIndex % items.length && splashStyles.thumbActive,
            ]}
          >
            <Image source={{ uri: it.uri }} style={splashStyles.thumbImg} contentFit="cover" />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  imageWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  bgImage: {
    width,
    height: height * 1.15,
  },
  orangeGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: height * 0.45,
  },
  safeTop: {
    paddingHorizontal: 24,
    zIndex: 2,
  },
  brandSmall: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  brandTag: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.8,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    zIndex: 2,
  },
  lottieRing: {
    marginBottom: 20,
  },
  lottieRingBorder: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  lottie: {
    width: 96,
    height: 96,
  },
  loadingTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  caption: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
    minHeight: 40,
    paddingHorizontal: 8,
  },
  tagline: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  thumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    zIndex: 2,
    minHeight: 56,
    justifyContent: 'center',
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    opacity: 0.45,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: {
    opacity: 1,
    borderColor: COLORS.primary,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
});
const SWIPE_THRESHOLD = 50;
const INTRO_SEEN_KEY = '@a2express_intro_seen';

// Données des slides
const introSlides = [
  {
    id: 1,
    title: "La Plateforme B2B Express d'Afrique",
    description: "Connectez-vous avec +10 000 fournisseurs vérifiés dans toute l'Afrique",
    animation: require('../../assets/animations/network-globe.json'),
    color: ['#667eea', '#764ba2'],
    stats: "+50 000 entreprises"
  },
  {
    id: 2,
    title: "Transactions 100% Sécurisées",
    description: "Paiements cryptés et inspection des marchandises garantie",
    animation: require('../../assets/animations/security-shield.json'),
    color: ['#f093fb', '#f5576c']
  },
  {
    id: 3,
    title: "Logistique Express",
    description: "Transport rapide, dédouanement et livraison optimisés pour vous",
    animation: require('../../assets/animations/logistics-truck.json'),
    color: ['#4facfe', '#00f2fe']
  },
  {
    id: 4,
    title: "Rejoignez l'Élite des Affaires",
    description: "95% de satisfaction parmi nos 10 000 entreprises partenaires",
    animation: require('../../assets/animations/success-celebration.json'),
    color: ['#43e97b', '#38f9d7'],
    stats: "Évaluation 4.9/5"
  }
];

export default function IntroScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isChecking, setIsChecking] = useState(true); // Reste true par défaut
  
  const { user, isLoading } = useAuth();
  const router = useRouter();
  
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  const scaleAnimation = useRef(new Animated.Value(0.9)).current;
  
  // Références pour les animations Lottie
  const lottieRefs = useRef<(LottieView | null)[]>([]);
  
  // Création des animations de particules (réduites à 15 pour optimiser)
  const particleCount = 15;
  const particles = useRef(
    Array.from({ length: particleCount }, () => ({
      x: new Animated.Value(Math.random() * width),
      y: new Animated.Value(Math.random() * height),
      scale: new Animated.Value(Math.random() * 0.5 + 0.5),
      opacity: new Animated.Value(Math.random() * 0.3 + 0.2),
      rotation: new Animated.Value(Math.random() * 360),
      speed: Math.random() * 2 + 1,
      size: Math.random() * 8 + 4,
      color: `rgba(255, 255, 255, ${Math.random() * 0.4 + 0.1})`,
    }))
  ).current;

  // Animation des particules (optimisée)
  useEffect(() => {
    particles.forEach((particle, index) => {
      const floatAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(particle.y, {
            toValue: particle.y._value - Math.random() * 100 - 50,
            duration: Math.random() * 3000 + 2000,
            useNativeDriver: true,
          }),
          Animated.timing(particle.y, {
            toValue: particle.y._value,
            duration: Math.random() * 3000 + 2000,
            useNativeDriver: true,
          }),
        ])
      );

      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(particle.scale, {
            toValue: 1.2,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(particle.scale, {
            toValue: 0.8,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );

      const rotateAnimation = Animated.loop(
        Animated.timing(particle.rotation, {
          toValue: 360,
          duration: Math.random() * 8000 + 4000,
          useNativeDriver: true,
        })
      );

      setTimeout(() => {
        floatAnimation.start();
        pulseAnimation.start();
        rotateAnimation.start();
      }, index * 100);
    });

    return () => {
      particles.forEach(particle => {
        particle.x.stopAnimation();
        particle.y.stopAnimation();
        particle.scale.stopAnimation();
        particle.opacity.stopAnimation();
        particle.rotation.stopAnimation();
      });
    };
  }, []);

  // Animation des particules quand le slide change
  useEffect(() => {
    particles.forEach(particle => {
      Animated.parallel([
        Animated.timing(particle.x, {
          toValue: Math.random() * width,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(particle.y, {
          toValue: Math.random() * height * 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(particle.opacity, {
          toValue: Math.random() * 0.4 + 0.1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [currentSlide]);

  // Jouer l'animation Lottie quand le slide change
  useEffect(() => {
    const lottieRef = lottieRefs.current[currentSlide];
    if (lottieRef) {
      setTimeout(() => {
        lottieRef.play();
      }, 300);
    }
  }, [currentSlide]);

  // LOGIQUE ANTI-RÉPÉTITION CORRIGÉE
  useEffect(() => {
    const checkIntroStatus = async () => {
      // Attendre que le chargement de l'auth soit terminé
      if (!isLoading) {
        try {
          // Vérifier si l'intro a déjà été vue
          const introSeen = await AsyncStorage.getItem(INTRO_SEEN_KEY);
          
          // Condition de redirection : utilisateur connecté OU intro déjà vue
          if (user || introSeen === 'true') {
            console.log('⏩ Redirection immédiate vers (tabs)');
            // Redirection sans délai pour éviter le flash
            router.replace('/(tabs)');
          } else {
            // Aucune condition remplie, on affiche l'intro
            setIsChecking(false);
          }
        } catch (error) {
          console.error('Erreur lors de la vérification AsyncStorage:', error);
          // En cas d'erreur, on affiche l'intro par sécurité
          setIsChecking(false);
        }
      }
    };

    checkIntroStatus();
  }, [isLoading, user]); // Dépendances correctes

  const slide = introSlides[currentSlide] || introSlides[0];

  const nextSlide = () => {
    if (isAnimating || currentSlide >= introSlides.length - 1) return;
    
    setIsAnimating(true);
    
    Animated.parallel([
      Animated.spring(slideAnimation, {
        toValue: -width * 0.8,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnimation, {
        toValue: 0.8,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentSlide(prev => Math.min(prev + 1, introSlides.length - 1));
      
      slideAnimation.setValue(width * 0.8);
      fadeAnimation.setValue(0);
      scaleAnimation.setValue(0.8);
      
      Animated.parallel([
        Animated.spring(slideAnimation, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(fadeAnimation, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnimation, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsAnimating(false);
      });
    });
  };

  const prevSlide = () => {
    if (isAnimating || currentSlide <= 0) return;
    
    setIsAnimating(true);
    
    Animated.parallel([
      Animated.spring(slideAnimation, {
        toValue: width * 0.8,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnimation, {
        toValue: 0.8,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentSlide(prev => Math.max(prev - 1, 0));
      
      slideAnimation.setValue(-width * 0.8);
      fadeAnimation.setValue(0);
      scaleAnimation.setValue(0.8);
      
      Animated.parallel([
        Animated.spring(slideAnimation, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(fadeAnimation, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnimation, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsAnimating(false);
      });
    });
  };

  const handleSwipe = (gestureState: any) => {
    if (isAnimating) return;
    
    if (Math.abs(gestureState.dx) > SWIPE_THRESHOLD) {
      if (gestureState.dx < 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isAnimating,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && !isAnimating;
      },
      onPanResponderRelease: (_, gestureState) => {
        handleSwipe(gestureState);
      },
      onPanResponderTerminate: (_, gestureState) => {
        handleSwipe(gestureState);
      },
    })
  ).current;

  // FONCTION SKIP AVEC ENREGISTREMENT
  const skipIntro = async () => {
    try {
      // Enregistrer que l'intro a été vue AVANT la redirection
      await AsyncStorage.setItem(INTRO_SEEN_KEY, 'true');
      
      if (!user) {
        setShowLoginModal(true);
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
    }
  };

  // FONCTION START AVEC ENREGISTREMENT
  const handleStart = async () => {
    try {
      // Enregistrer que l'intro a été vue AVANT la redirection
      await AsyncStorage.setItem(INTRO_SEEN_KEY, 'true');
      
      if (!user) {
        setShowLoginModal(true);
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement:', error);
    }
  };

  const handleLoginSuccess = () => {
    setShowLoginModal(false);
    router.replace('/(tabs)');
  };

  // Rendu des particules
  const renderParticles = () => {
    return particles.map((particle, index) => (
      <Animated.View
        key={`particle-${index}`}
        style={[
          styles.particle,
          {
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            borderRadius: particle.size / 2,
            transform: [
              { translateX: particle.x },
              { translateY: particle.y },
              { scale: particle.scale },
              { rotate: particle.rotation.interpolate({
                inputRange: [0, 360],
                outputRange: ['0deg', '360deg']
              })}
            ],
            opacity: particle.opacity,
            shadowColor: '#fff',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: particle.size / 2,
          }
        ]}
      />
    ));
  };

  // Particules spéciales pour le dernier slide
  const renderCelebrationParticles = () => {
    if (currentSlide !== introSlides.length - 1) return null;

    const celebrationColors = [
      '#FF6B8B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2', '#EF476F'
    ];

    return Array.from({ length: 15 }).map((_, index) => {
      const color = celebrationColors[Math.floor(Math.random() * celebrationColors.length)];
      return (
        <Animated.View
          key={`celeb-${index}`}
          style={[
            styles.celebrationParticle,
            {
              backgroundColor: color,
              width: Math.random() * 12 + 8,
              height: Math.random() * 12 + 8,
              borderRadius: 6,
              left: Math.random() * width,
              top: Math.random() * height * 0.6,
              transform: [
                { 
                  translateY: new Animated.Value(0).interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -Math.random() * 200 - 100]
                  })
                },
                {
                  scale: new Animated.Value(1).interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1, 0]
                  })
                }
              ],
              opacity: new Animated.Value(0).interpolate({
                inputRange: [0, 0.3, 0.7, 1],
                outputRange: [0, 1, 1, 0]
              })
            }
          ]}
        />
      );
    });
  };

  // Écran de chargement pendant la vérification
  if (isChecking || isLoading) {
    return <SplashLoadingScreen />;
  }

  // Si on arrive ici, c'est qu'on doit afficher l'intro
  return (
    <LinearGradient
      colors={slide.color}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Particules flottantes */}
      {renderParticles()}
      
      {/* Particules de célébration pour le dernier slide */}
      {renderCelebrationParticles()}
      
      {/* Effet de scintillement */}
      <View style={styles.sparkleContainer}>
        {Array.from({ length: 8 }).map((_, index) => (
          <Animated.View
            key={`sparkle-${index}`}
            style={[
              styles.sparkle,
              {
                left: Math.random() * width,
                top: Math.random() * height * 0.8,
                opacity: new Animated.Value(0).interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.random() * 0.6 + 0.4]
                })
              }
            ]}
          />
        ))}
      </View>

      <View style={styles.header}>
        <Text style={styles.logo}>A2Express</Text>
        <TouchableOpacity style={styles.skipButton} onPress={skipIntro}>
          <Text style={styles.skipText}>Se connecter</Text>
        </TouchableOpacity>
      </View>

      <Animated.View 
        style={[
          styles.animatedContent,
          {
            transform: [
              { translateX: slideAnimation },
              { scale: scaleAnimation }
            ],
            opacity: fadeAnimation,
          }
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.content}>
          <View style={styles.animationContainer}>
            <LottieView
              ref={ref => {
                lottieRefs.current[currentSlide] = ref;
              }}
              source={slide.animation}
              autoPlay={true}
              loop={true}
              style={styles.lottieAnimation}
            />
            
            {slide.stats && (
              <View style={styles.floatingStats}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                  style={styles.statsBadge}
                >
                  <Text style={styles.statsText}>{slide.stats}</Text>
                </LinearGradient>
              </View>
            )}
            
            {/* Effet de halo autour de l'animation */}
            <Animated.View 
              style={[
                styles.haloEffect,
                {
                  opacity: new Animated.Value(1).interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.1, 0.3]
                  }),
                  transform: [
                    { scale: new Animated.Value(1).interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1.1]
                    })}
                  ]
                }
              ]} 
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
            
            <View style={styles.swipeHint}>
              <Text style={styles.swipeHintText}>
                {currentSlide === introSlides.length - 1 
                  ? "Touchez le bouton pour commencer" 
                  : "Glissez pour continuer"}
              </Text>
              {currentSlide < introSlides.length - 1 && (
                <View style={styles.swipeArrowContainer}>
                  <Ionicons name="arrow-forward" size={24} color="rgba(255,255,255,0.8)" />
                </View>
              )}
            </View>
          </View>
        </View>
      </Animated.View>

      <View style={styles.bottomSection}>
        <View style={styles.dotsContainer}>
          {introSlides.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                if (!isAnimating) {
                  if (index > currentSlide) {
                    nextSlide();
                  } else if (index < currentSlide) {
                    prevSlide();
                  }
                }
              }}
              activeOpacity={0.7}
            >
              <Animated.View
                style={[
                  styles.dot,
                  index === currentSlide && styles.dotActive,
                  index === currentSlide && {
                    transform: [
                      { scale: new Animated.Value(1).interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2]
                      })}
                    ]
                  }
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {currentSlide === introSlides.length - 1 && (
          <TouchableOpacity 
            style={styles.startButton} 
            onPress={handleStart}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#fff', '#f8f9fa']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startButtonGradient}
            >
              <Text style={styles.startButtonText}>
                {user ? 'Accéder à l\'app' : 'Démarrer avec A2Express'}
              </Text>
              <View style={styles.startButtonIcon}>
                <Ionicons name="rocket" size={18} color="#fff" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress Bar animée */}
      <View style={styles.progressContainer}>
        <Animated.View 
          style={[
            styles.progressBar,
            {
              width: `${((currentSlide + 1) / introSlides.length) * 100}%`,
              backgroundColor: slide.color[0]
            }
          ]}
        />
      </View>

      <LoginModal
        visible={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    zIndex: 10,
  },
  logo: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  skipButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  skipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  animatedContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  animationContainer: {
    width: width * 0.8,
    height: height * 0.4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
  },
  lottieAnimation: {
    width: '100%',
    height: '100%',
    zIndex: 3,
  },
  haloEffect: {
    position: 'absolute',
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: (width * 0.9) / 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    zIndex: 2,
  },
  floatingStats: {
    position: 'absolute',
    top: 20,
    right: -20,
    zIndex: 4,
  },
  statsBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  statsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  textContainer: {
    alignItems: 'center',
    zIndex: 5,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 38,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    letterSpacing: 0.3,
  },
  description: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    letterSpacing: 0.2,
    fontWeight: '400',
    marginBottom: 40,
    paddingHorizontal: 20,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  swipeHint: {
    alignItems: 'center',
  },
  swipeHintText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  swipeArrowContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSection: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 6,
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 24,
    height: 10,
    borderRadius: 5,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
  startButton: {
    width: width * 0.85,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  startButtonGradient: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  startButtonText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginRight: 12,
  },
  startButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    zIndex: 10,
  },
  progressBar: {
    height: '100%',
    borderRadius: 1.5,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 3,
  },
  particle: {
    position: 'absolute',
    zIndex: 1,
  },
  celebrationParticle: {
    position: 'absolute',
    zIndex: 2,
  },
  sparkleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  sparkle: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 3,
  },
});
