// src/components/premium/IndustrialMachinesPremium.tsx - VERSION COMPLÈTE AVEC PRODUITS D'EXEMPLE
import React, { useEffect, useState } from "react";
import { 
  View, Text, StyleSheet, ScrollView, 
  TouchableOpacity, Dimensions, ActivityIndicator,
  Animated
} from "react-native";
import { useRouter } from "expo-router";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../config/firebase";
import ProductCardPremium from "./ProductCardPremium";

const { width } = Dimensions.get("window");

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  imageUrl?: string;
  rating: number;
  supplier: string;
  minOrder: number;
  deliveryTime: string;
  isVerified: boolean;
  stock: number;
  power?: string;
  capacity?: string;
  warranty?: string;
  categoryId?: string;
}

// ✅ PRODUITS D'EXEMPLE POUR L'AFFICHAGE IMMÉDIAT
const SAMPLE_PRODUCTS: Product[] = [
  {
    id: "machine-1",
    name: "Presse Hydraulique Industrielle 50T",
    price: 28500,
    originalPrice: 32000,
    image: "https://images.unsplash.com/photo-1581091226033-d5c48150dbaa?w=300&h=200&fit=crop",
    rating: 4.8,
    supplier: "Global Machinery Corp",
    minOrder: 1,
    deliveryTime: "15-20 jours",
    isVerified: true,
    stock: 8,
    power: "45KW",
    capacity: "50 tonnes",
    warranty: "2 ans"
  },
  {
    id: "machine-2",
    name: "Tour CNC Professionnel",
    price: 42000,
    originalPrice: 48000,
    image: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=300&h=200&fit=crop",
    rating: 4.9,
    supplier: "Tech Innovators Ltd",
    minOrder: 1,
    deliveryTime: "20-25 jours",
    isVerified: true,
    stock: 5,
    power: "55KW",
    capacity: "Précision 0.001mm",
    warranty: "3 ans"
  },
  {
    id: "machine-3",
    name: "Soudeuse Automatique MIG/MAG",
    price: 18700,
    originalPrice: 21000,
    image: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=300&h=200&fit=crop",
    rating: 4.6,
    supplier: "Industrial Solutions",
    minOrder: 2,
    deliveryTime: "10-15 jours",
    isVerified: true,
    stock: 12,
    power: "35KW",
    capacity: "8mm acier",
    warranty: "18 mois"
  },
  {
    id: "machine-4",
    name: "Perceuse Radiale Professionnelle",
    price: 12500,
    originalPrice: 14500,
    image: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=300&h=200&fit=crop",
    rating: 4.7,
    supplier: "Precision Tools Co",
    minOrder: 1,
    deliveryTime: "12-18 jours",
    isVerified: true,
    stock: 15,
    power: "22KW",
    capacity: "Ø32mm max",
    warranty: "2 ans"
  },
  {
    id: "machine-5",
    name: "Compresseur Industriel 100L",
    price: 8900,
    originalPrice: 10500,
    image: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=300&h=200&fit=crop",
    rating: 4.5,
    supplier: "Air Power Systems",
    minOrder: 1,
    deliveryTime: "8-12 jours",
    isVerified: true,
    stock: 20,
    power: "15KW",
    capacity: "100L - 10 bars",
    warranty: "2 ans"
  },
  {
    id: "machine-6",
    name: "Scie Circulaire Automatique",
    price: 15600,
    originalPrice: 17500,
    image: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=300&h=200&fit=crop",
    rating: 4.4,
    supplier: "Cutting Edge Tech",
    minOrder: 1,
    deliveryTime: "14-21 jours",
    isVerified: true,
    stock: 10,
    power: "18KW",
    capacity: "Ø400mm",
    warranty: "18 mois"
  }
];

export default function IndustrialMachinesPremium() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // ✅ STRATÉGIE INTELLIGENTE : Essayer Firestore d'abord, puis fallback
    const loadProducts = async () => {
      try {
        console.log("🔍 Recherche des machines industrielles...");
        
        // Essayer de charger depuis Firestore
        const productsQuery = query(
          collection(db, "products"),
          where("name", ">=", "Machine"),
          where("name", "<", "Machinez"),
          limit(6)
        );

        const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
          const firestoreProducts = snapshot.docs.map((doc) => {
            const data = doc.data();
            console.log('🏭 Produit Firestore trouvé:', data.name);
            return {
              id: doc.id,
              name: data.name || "Machine Industrielle",
              price: data.price || Math.floor(Math.random() * 50000) + 10000,
              originalPrice: data.originalPrice || Math.floor(Math.random() * 60000) + 12000,
              image: data.image || data.imageUrl || "https://via.placeholder.com/300x200/4A6572/ffffff?text=Machine+Industrielle",
              imageUrl: data.imageUrl || data.image,
              rating: data.rating || 4.2 + Math.random() * 0.8,
              supplier: data.supplier || "Fournisseur Industriel Certifié",
              minOrder: data.minOrder || Math.floor(Math.random() * 5) + 1,
              deliveryTime: data.deliveryTime || "15-30 jours",
              isVerified: data.isVerified !== undefined ? data.isVerified : true,
              stock: data.stock || Math.floor(Math.random() * 50) + 10,
              power: data.power || `${Math.floor(Math.random() * 50) + 10}KW`,
              capacity: data.capacity || `${Math.floor(Math.random() * 1000) + 500}kg/h`,
              warranty: data.warranty || "2 ans",
              categoryId: data.categoryId
            };
          });

          if (firestoreProducts.length > 0) {
            console.log(`🎯 ${firestoreProducts.length} machines chargées depuis Firestore`);
            setProducts(firestoreProducts);
          } else {
            // ✅ FALLBACK : Utiliser les produits d'exemple
            console.log("🔄 Aucune machine dans Firestore, utilisation des produits d'exemple");
            setProducts(SAMPLE_PRODUCTS);
          }
          
          setLoading(false);
          
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }).start();
        }, (error) => {
          // En cas d'erreur Firestore, utiliser les produits d'exemple
          console.log("❌ Erreur Firestore, utilisation des produits d'exemple");
          setProducts(SAMPLE_PRODUCTS);
          setLoading(false);
          
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }).start();
        });

        return () => unsubscribe();
        
      } catch (error) {
        console.error("❌ Erreur chargement machines:", error);
        // ✅ TOUJOURS des produits d'exemple en fallback
        setProducts(SAMPLE_PRODUCTS);
        setLoading(false);
        
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      }
    };

    loadProducts();
  }, []);

const navigateToMachinesCategory = () => {
  console.log('🔄 Navigation vers catégorie machines');
  router.push({
    pathname: "/category/[id]",
    params: { 
      id: "machines_industrielles"
    },
  });
};

  // ✅ CORRECTION : Navigation vers les détails produit
  const navigateToProductDetails = (product: Product) => {
    console.log('🔄 Navigation vers produit machine:', product.id);
    
    router.push({
      pathname: "/product/[id]",
      params: { 
        id: product.id,
        name: encodeURIComponent(product.name || ''),
        price: product.price?.toString() || '0',
        image: encodeURIComponent(product.imageUrl || product.image || ''),
        description: encodeURIComponent('Machine industrielle professionnelle' || ''),
        categoryId: product.categoryId || 'machines'
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#ff6a00" />
        <Text style={styles.loadingText}>Chargement des machines industrielles...</Text>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <LinearGradient
            colors={['#4A6572', '#344955']}
            style={styles.iconContainer}
          >
            <Ionicons name="construct" size={24} color="#fff" />
          </LinearGradient>
          <View>
            <Text style={styles.title}>Machines Industrielles</Text>
            <Text style={styles.subtitle}>
              {products.length} équipements professionnels disponibles
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.seeAllButton}
          onPress={navigateToMachinesCategory}
        >
          <Text style={styles.seeAllText}>Explorer</Text>
          <Ionicons name="arrow-forward" size={16} color="#ff6a00" />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Ionicons name="flash" size={16} color="#4CAF50" />
          <Text style={styles.statNumber}>{products.length}</Text>
          <Text style={styles.statLabel}>Machines</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="business" size={16} color="#2196F3" />
          <Text style={styles.statNumber}>6+</Text>
          <Text style={styles.statLabel}>Fournisseurs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="globe" size={16} color="#FF9800" />
          <Text style={styles.statNumber}>15+</Text>
          <Text style={styles.statLabel}>Pays</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {products.map((item, index) => (
          <View key={item.id} style={styles.card}>
            <ProductCardPremium 
              product={item}
              onPress={() => navigateToProductDetails(item)}
            />
            
            {index < 3 && (
              <LinearGradient
                colors={['#FFD700', '#FFA000']}
                style={styles.topBadge}
              >
                <Ionicons name="trophy" size={12} color="#fff" />
                <Text style={styles.topBadgeText}>TOP {index + 1}</Text>
              </LinearGradient>
            )}

            {item.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#fff" />
                <Text style={styles.verifiedText}>Verifié</Text>
              </View>
            )}

            {item.originalPrice && item.originalPrice > item.price && (
              <LinearGradient
                colors={['#ff4444', '#ff6a00']}
                style={styles.discountBadge}
              >
                <Text style={styles.discountText}>
                  -{Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}%
                </Text>
              </LinearGradient>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🔧 Équipements industriels certifiés • Livraison mondiale • Support technique 24/7
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: "#fff",
    paddingVertical: 24,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  loaderContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 106, 0, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 106, 0, 0.2)",
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ff6a00",
    marginRight: 4,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "rgba(74, 101, 114, 0.05)",
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(74, 101, 114, 0.1)",
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: "#4A6572",
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(74, 101, 114, 0.2)",
  },
  scrollContainer: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  card: {
    width: width * 0.75,
    backgroundColor: "#fff",
    borderRadius: 20,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    overflow: "hidden",
    position: 'relative',
  },
  topBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  topBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 2,
  },
  verifiedBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(76, 175, 80, 0.95)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 10,
  },
  verifiedText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    marginLeft: 2,
  },
  discountBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  discountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  footer: {
    paddingHorizontal: 20,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  footerText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
});