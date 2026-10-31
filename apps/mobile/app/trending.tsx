// src/app/trending.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, StyleSheet, SafeAreaView, 
  Text, ActivityIndicator 
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import TrendingProductsPremium from '@/components/premium/TrendingProductsPremium';
import AnimatedQuickActions from '@/components/premium/AnimatedQuickActions';

export default function TrendingScreen() {
  const params = useLocalSearchParams();
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fonction pour récupérer les produits tendance
  const fetchTrendingProducts = async () => {
    try {
      console.log("📡 Récupération des produits tendance...");

      const trendingQuery = query(
        collection(db, "products"), 
        where("trending", "==", true),
        limit(20)
      );

      const querySnapshot = await getDocs(trendingQuery);

      const products = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || data.title || "Produit sans nom",
          price: data.price || 0,
          originalPrice: data.originalPrice || data.price || 0,
          imageUrl: data.imageUrl || data.mainImage || data.images?.[0] || 
                    "https://via.placeholder.com/300x300/ff6a00/ffffff?text=Produit+Tendance",
          rating: data.rating || 4.5,
          supplier: data.supplier || data.companyName || "Fournisseur",
          minOrder: data.minOrder || 1,
          deliveryTime: data.deliveryTime || "3-5 jours",
          isVerified: data.isVerified || false,
          trending: data.trending || false,
        };
      });

      console.log(`✅ ${products.length} produits tendance récupérés`);
      setTrendingProducts(products);
    } catch (error) {
      console.error("❌ Erreur lors de la récupération des produits tendance:", error);
      setTrendingProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrendingProducts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrendingProducts();
  };

  const handleProductPress = (product) => {
    console.log("Produit sélectionné:", product.id);
    // Implémentez votre navigation ici
    // router.push(`/product/${product.id}`);
  };

  // Construction du header personnalisé (AnimatedQuickActions + titre)
  const renderHeader = () => (
    <View>
      <AnimatedQuickActions />
      <View style={styles.titleContainer}>
        <Text style={styles.title}>🔥 Produits Tendance</Text>
        <Text style={styles.subtitle}>
          {trendingProducts.length > 0 
            ? `${trendingProducts.length} produits populaires` 
            : 'Découvrez les produits les plus populaires du moment'
          }
        </Text>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#ff6a00" />
          <Text style={styles.loadingText}>Chargement des produits tendance...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TrendingProductsPremium
        products={trendingProducts}
        headerComponent={renderHeader()}
        onProductPress={handleProductPress}
        loading={loading && !refreshing}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
