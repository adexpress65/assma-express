// apps/mobile/app/special-offers.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, StyleSheet, SafeAreaView, ScrollView, 
  Text, ActivityIndicator, RefreshControl,
  TouchableOpacity 
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';
import PremiumSpecialOffers from '@/components/premium/PremiumSpecialOffers';
import AnimatedQuickActions from '@/components/premium/AnimatedQuickActions';

export default function SpecialOffersScreen() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Fonction pour récupérer les produits en offre spéciale
  const fetchSpecialOffers = async () => {
    try {
      console.log("📡 Récupération des offres spéciales...");
      
      // Requête Firestore pour les produits avec specialOffer: true
      const specialOfferQuery = query(
        collection(db, "products"), 
        where("specialOffer", "==", true),
        limit(20)
      );
      
      const querySnapshot = await getDocs(specialOfferQuery);
      
      const productsData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || data.title || "Offre Spéciale",
          price: data.price || 0,
          originalPrice: data.originalPrice || data.price || 0,
          imageUrl: data.imageUrl || data.mainImage || data.images?.[0] || 
                    "https://via.placeholder.com/300x300/ff6a00/ffffff?text=Offre+Spéciale",
          rating: data.rating || 4.5,
          supplier: data.supplier || data.companyName || "Fournisseur",
          minOrder: data.minOrder || 1,
          deliveryTime: data.deliveryTime || "3-5 jours",
          isVerified: data.isVerified || true,
          specialOffer: data.specialOffer || false,
          category: data.categoryName || data.category || "Offre Spéciale",
          soldCount: data.soldCount || Math.floor(Math.random() * 100),
          stock: data.stockQuantity || data.stock || 10,
        };
      });
      
      console.log(`✅ ${productsData.length} offres spéciales récupérées`);
      setProducts(productsData);
      
    } catch (error) {
      console.error("❌ Erreur:", error);
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    fetchSpecialOffers();
  }, []);
  
  const onRefresh = () => {
    setRefreshing(true);
    fetchSpecialOffers();
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={["#ff4444", "#ff6a00"]}
            tintColor="#ff6a00"
          />
        }
      >
        {/* Header avec QuickActions */}
        <View style={styles.header}>
          <AnimatedQuickActions />
        </View>
        
        {/* Titre de la page */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>🔥 Offres Spéciales</Text>
          <Text style={styles.subtitle}>
            {products.length > 0 
              ? `${products.length} offres exclusives` 
              : 'Promotions limitées'
            }
          </Text>
        </View>
        
        {/* Section des produits */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ff6a00" />
              <Text style={styles.loadingText}>Chargement...</Text>
            </View>
          ) : products.length > 0 ? (
            <PremiumSpecialOffers 
              products={products}
              title=""
              subtitle=""
              showTimer={true}
              showProgress={true}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Aucune offre spéciale</Text>
              <Text style={styles.emptyText}>
                Créez des produits avec l'option "Offres spéciales" activée.
              </Text>
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => router.push('/add-product')}
              >
                <Text style={styles.createButtonText}>+ Créer une offre</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        
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
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ff4444',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingTop: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
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
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#ff6a00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  spacer: {
    height: 60,
  },
});