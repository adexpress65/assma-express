import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const introSlides = [
  {
    id: 1,
    title: "Plateforme B2B N°1 en Afrique",
    description: "Connectez-vous avec +10 000 fournisseurs vérifiés à travers le continent",
    image: "https://images.unsplash.com/photo-1563013541-666ab0851fbd?w=400",
    stats: "+50 000 entreprises"
  },
  {
    id: 2,
    title: "Transactions Sécurisées",
    description: "Paiement protégé et inspection des marchandises garantie",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400",
    icon: "🔒"
  },
  {
    id: 3,
    title: "Logistique Intégrée",
    description: "Transport, dédouanement et livraison simplifiés",
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400",
    icon: "🚚"
  },
  {
    id: 4,
    title: "Rejoignez Notre Réseau",
    description: "+5 000 entreprises africaines nous font déjà confiance",
    image: "https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=400",
    stats: "95% de satisfaction"
  }
];

export default function IntroScreen() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const router = useRouter();

  const nextSlide = () => {
    if (currentSlide < introSlides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      // Dernier slide - rediriger vers l'app principale
      router.replace('/'); // ← CHANGÉ ICI
    }
  };

  const skipIntro = () => {
    router.replace('/'); // ← CHANGÉ ICI
  };

  const slide = introSlides[currentSlide];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Image de fond */}
      <Image 
        source={{ uri: slide.image }} 
        style={styles.backgroundImage}
        blurRadius={2}
      />
      
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.3)']}
        style={styles.gradient}
      />
      
      {/* Bouton Skip */}
      <TouchableOpacity style={styles.skipButton} onPress={skipIntro}>
        <Text style={styles.skipText}>Passer</Text>
      </TouchableOpacity>

      {/* Contenu principal */}
      <View style={styles.content}>
        {/* Icône ou statistique */}
        <View style={styles.iconContainer}>
          {slide.icon ? (
            <Text style={styles.icon}>{slide.icon}</Text>
          ) : slide.stats ? (
            <View style={styles.statsBadge}>
              <Text style={styles.statsText}>{slide.stats}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.description}>{slide.description}</Text>
      </View>

      {/* Indicateurs de progression */}
      <View style={styles.dotsContainer}>
        {introSlides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentSlide && styles.dotActive
            ]}
          />
        ))}
      </View>

      {/* Bouton suivant */}
      <TouchableOpacity style={styles.nextButton} onPress={nextSlide}>
        <Text style={styles.nextButtonText}>
          {currentSlide === introSlides.length - 1 ? 'Commencer' : 'Suivant'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradient: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  skipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginBottom: 120,
  },
  iconContainer: {
    marginBottom: 30,
  },
  icon: {
    fontSize: 60,
    textAlign: 'center',
  },
  statsBadge: {
    backgroundColor: 'rgba(255,106,0,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  statsText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 34,
  },
  description: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#ff6a00',
    width: 20,
  },
  nextButton: {
    backgroundColor: '#ff6a00',
    marginHorizontal: 40,
    marginBottom: 60,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
