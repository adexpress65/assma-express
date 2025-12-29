// src/app/trending.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, StyleSheet, SafeAreaView, ScrollView, 
  Text, ActivityIndicator, RefreshControl 
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import TrendingProductsPremium from '@/components/premium/TrendingProductsPremium';
import AnimatedQuickActions from '@/components/premium/AnimatedQuickActions';
import { Button } from "react-native";
import { createPayment } from "@/services/payment";



export default function TrendingScreen() {
  const params = useLocalSearchParams();
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Fonction pour récupérer les produits tendance
  const fetchTrendingProducts = async () => {
    try {
      console.log("📡 Récupération des produits tendance...");
      
      // Requête Firestore pour les produits avec trending: true
      const trendingQuery = query(
        collection(db, "products"), 
        where("trending", "==", true),
        limit(20) // Limite à 20 produits
      );
      
      const querySnapshot = await getDocs(trendingQuery);
      
      // Convertir les documents en tableau d'objets
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
      // En cas d'erreur, laisser le tableau vide
      setTrendingProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Charger les données au démarrage
  useEffect(() => {
    fetchTrendingProducts();
  }, []);
  
  // Fonction de rafraîchissement
  const onRefresh = () => {
    setRefreshing(true);
    fetchTrendingProducts();
  };
  
  // Fonction pour naviguer vers un produit
  const handleProductPress = (product) => {
    // Vous devrez ajuster cette navigation selon votre setup
    console.log("Produit sélectionné:", product.id);
    // Exemple: router.push(`/product/${product.id}`);
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={["#ff6a00", "#ff8c00", "#ffa500"]}
            tintColor="#ff6a00"
          />
        }
      >
        {/* En-tête avec les actions rapides */}
        <View style={styles.header}>
          <AnimatedQuickActions />
        </View>
        
        {/* Titre de la page */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>🔥 Produits Tendance</Text>
          <Text style={styles.subtitle}>
            {trendingProducts.length > 0 
              ? `${trendingProducts.length} produits populaires` 
              : 'Découvrez les produits les plus populaires du moment'
            }
          </Text>
        </View>
		
{/* 🔧 BOUTON TECHNIQUE – TEST PAIEMENT */}





        
        {/* Section principale des tendances */}
        <View style={styles.trendingContainer}>
          {loading ? (
            // Afficher un loader pendant le chargement
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff6a00" />
              <Text style={styles.loadingText}>Chargement des produits tendance...</Text>
            </View>
          ) : trendingProducts.length > 0 ? (
            // Afficher les produits tendance
            <TrendingProductsPremium 
              products={trendingProducts} // ✅ PASSER LES PRODUITS EN PROPS
              onProductPress={handleProductPress}
            />
          ) : (
            // Afficher un message si aucun produit
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Aucun produit tendance trouvé</Text>
              <Text style={styles.emptyText}>
                Les produits marqués comme "Tendances" apparaîtront ici.
              </Text>
              <Text style={styles.emptyHint}>
                Rafraîchissez ou ajoutez des produits avec l'option "📈 Tendances" activée.
              </Text>
            </View>
          )}
        </View>
        
        {/* Espace en bas */}
        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
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
  trendingContainer: {
    flex: 1,
    paddingTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  spacer: {
    height: 100,
  },
});