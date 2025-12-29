// apps/mobile/src/components/home/AdBanner.tsx
import React, { useRef, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

//  DONNÉES DES PUBS DÉFILANTES
const ADS_DATA = [
  {
    id: 1,
    title: " Soldes Flash - Jusqu'à -70%",
    description: "Fin dans 02:15:33  Vite, profitez-en !",
    bgColor: "#ff4444",
    textColor: "#fff",
    icon: "flash",
    timer: true
  },
  {
    id: 2, 
    title: " Livraison Gratuite dès 20€",
    description: "Valable aujourd'hui seulement  Commande rapide",
    bgColor: "#4caf50",
    textColor: "#fff",
    icon: "rocket",
    timer: false
  },
  {
    id: 3,
    title: " Nouveaux Smartphones 2024",
    description: "Dernières technologies  Garantie 2 ans",
    bgColor: "#2196f3", 
    textColor: "#fff",
    icon: "phone-portrait",
    timer: true
  },
  {
    id: 4,
    title: " Ventes Privées ASMA Express",
    description: "Accès exclusif membres  Prix de gros",
    bgColor: "#9c27b0",
    textColor: "#fff",
    icon: "diamond",
    timer: false
  },
  {
    id: 5,
    title: " Électronique à -50%",
    description: "Smartphones, tablettes, accessoires  Stock limité",
    bgColor: "#ff9800",
    textColor: "#fff", 
    icon: "hardware-chip",
    timer: true
  }
];

export default function AdBanner() {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const nextAd = () => {
    // Animation de transition
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -50,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      setCurrentAdIndex((prev) => (prev + 1) % ADS_DATA.length);
      // Reset des animations
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
    });
  };

  React.useEffect(() => {
    const interval = setInterval(nextAd, 4000); // Change toutes les 4 secondes
    return () => clearInterval(interval); // CORRECTION
  }, []);

  const currentAd = ADS_DATA[currentAdIndex];

  return (
    <Animated.View 
      style={[
        styles.adContainer,
        { 
          backgroundColor: currentAd.bgColor,
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }]
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.adContent} 
        activeOpacity={0.7}
        onPress={() => router.push(/product/)}
      >
        {/* Icône */}
        <View style={styles.iconContainer}>
          <Ionicons 
            name={currentAd.icon as any} 
            size={20} 
            color={currentAd.textColor} 
          />
        </View>

        {/* Contenu texte */}
        <View style={styles.textContainer}>
          <Text style={[styles.adTitle, { color: currentAd.textColor }]}>
            {currentAd.title}
          </Text>
          <Text style={[styles.adDescription, { color: currentAd.textColor }]}>
            {currentAd.description}
          </Text>
        </View>

        {/* Indicateurs de progression */}
        <View style={styles.indicatorsContainer}>
          {ADS_DATA.map((_, index) => (
            <View 
              key={index}
              style={[
                styles.indicator,
                index === currentAdIndex && styles.indicatorActive
              ]}
            />
          ))}
        </View>

        {/* Flèche */}
        <Ionicons 
          name="chevron-forward" 
          size={18} 
          color={currentAd.textColor} 
          style={styles.arrow}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  adContainer: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 14,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  adContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconContainer: {
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 10,
  },
  textContainer: {
    flex: 1,
  },
  adTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  adDescription: {
    fontSize: 12,
    opacity: 0.95,
    fontWeight: '500',
  },
  indicatorsContainer: {
    flexDirection: 'row',
    marginRight: 12,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 2,
  },
  indicatorActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    transform: [{ scale: 1.2 }],
  },
  arrow: {
    opacity: 0.8,
  },
});
