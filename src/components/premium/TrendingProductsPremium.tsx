// src/components/premium/TrendingProductsPremium.tsx - VERSION CORRIGÉE
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { collection, query, limit, orderBy, getDocs, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

// ✅ UTILISER VOTRE HOOK EXISTANT
import useAppNavigation from '../../hooks/useAppNavigation';
import ProductCardPremium from './ProductCardPremium';

const { width } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  rating: number;
  supplier: string;
  minOrder: number;
  deliveryTime: string;
  isVerified: boolean;
  stock: number;
  orders?: number;
  views?: number;
  categoryId?: string;
}

interface TrendingProductsPremiumProps {
  products?: Product[];
}

// ✅ PRODUITS TENDANCES D'EXEMPLE AVEC CATEGORYID
const TRENDING_SAMPLE_PRODUCTS: Product[] = [
  {
    id: "trend-1",
    name: "Smartphone Android 5G Haut de Gamme",
    price: 18900,
    originalPrice: 22000,
    imageUrl: "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=300&h=200&fit=crop",
    rating: 4.7,
    supplier: "Tech Innovation Ltd",
    minOrder: 1,
    deliveryTime: "3-5 jours",
    isVerified: true,
    stock: 25,
    orders: 1247,
    views: 5689,
    categoryId: "electronique"
  },
  // ... autres produits avec categoryId
];

export default function TrendingProductsPremium({ products: propProducts }: TrendingProductsPremiumProps) {
  // ✅ UTILISER VOTRE HOOK EXISTANT
  const { navigateTo } = useAppNavigation();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTrendingProducts = async () => {
      try {
        console.log("🔥 Chargement des produits tendances...");
        
        if (propProducts && propProducts.length > 0) {
          console.log("✅ Utilisation des produits passés en props");
          const productsWithImages = propProducts.map(product => ({
            ...product,
            imageUrl: product.imageUrl || `https://images.unsplash.com/photo-${1500000000000 + product.id.charCodeAt(0)}?w=300&h=300&fit=crop`
          }));
          setProducts(productsWithImages);
          setLoading(false);
          return;
        }

        let foundProducts: Product[] = [];

        const queries = [
          query(collection(db, "products"), orderBy("orders", "desc"), limit(6)),
          query(collection(db, "products"), orderBy("createdAt", "desc"), limit(6)),
          query(collection(db, "products"), where("stock", ">", 20), limit(6)),
          query(collection(db, "products"), limit(6))
        ];

        for (const q of queries) {
          try {
            const snapshot = await getDocs(q);
            if (snapshot.docs.length > 0) {
              foundProducts = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  name: data.name || "Produit Tendances",
                  price: data.price || Math.floor(Math.random() * 50000) + 5000,
                  originalPrice: data.originalPrice || Math.floor(Math.random() * 60000) + 6000,
                  imageUrl: data.images?.[0] || data.imageUrl || `https://images.unsplash.com/photo-${1500000000000 + doc.id.charCodeAt(0)}?w=300&h=300&fit=crop`,
                  rating: data.rating || 4.0 + Math.random() * 1.0,
                  supplier: data.supplier || "Fournisseur Premium",
                  minOrder: data.minOrder || Math.floor(Math.random() * 5) + 1,
                  deliveryTime: data.deliveryTime || "5-10 jours",
                  isVerified: data.isVerified !== undefined ? data.isVerified : true,
                  stock: data.stock || Math.floor(Math.random() * 100) + 10,
                  orders: data.orders || Math.floor(Math.random() * 1000) + 100,
                  views: data.views || Math.floor(Math.random() * 5000) + 500,
                  categoryId: data.categoryId || 'trending' // ✅ IMPORTANT
                };
              });
              console.log(`🔥 ${foundProducts.length} produits tendances chargés depuis Firestore`);
              break;
            }
          } catch (error) {
            console.log(`⚠️ Requête tendances échouée, tentative suivante...`);
          }
        }

        if (foundProducts.length === 0) {
          console.log("🔄 Aucun produit trouvé, utilisation des produits tendances d'exemple");
          foundProducts = TRENDING_SAMPLE_PRODUCTS;
        }

        setProducts(foundProducts);
        
      } catch (error) {
        console.error("❌ Erreur chargement produits tendances:", error);
        setProducts(TRENDING_SAMPLE_PRODUCTS);
      } finally {
        setLoading(false);
      }
    };

    loadTrendingProducts();
  }, [propProducts]);

  // ✅ Grouper les produits par 2
  const groupedProducts = products.reduce((acc: Product[][], _, i, arr) => {
    if (i % 2 === 0) acc.push(arr.slice(i, i + 2));
    return acc;
  }, []);

  // ✅ NAVIGATION EN 2 ÉTAPES
  const handleProductPress = (product: Product) => {
    console.log('🔥 Navigation produit tendance:', product.id);
    navigateTo.productDetail(product.id, product.categoryId || 'trending');
  };

  const navigateToTrendingExplore = () => {
    navigateTo.category('trending', 'Produits Tendances');
  };

  // ✅ Rendu des groupes
  const renderProductGroup = ({ item, index }: { item: Product[], index: number }) => (
    <View style={styles.productGroup}>
      {item.map((product, productIndex) => (
        <View key={product.id} style={styles.productWrapper}>
          <ProductCardPremium 
            product={product}
            onPress={() => handleProductPress(product)}
            style={styles.productCard}
          />
          
          {/* Badge de rang */}
          <View style={[
            styles.rankBadge,
            (index * 2 + productIndex) === 0 && styles.rankOne,
            (index * 2 + productIndex) === 1 && styles.rankTwo,
            (index * 2 + productIndex) === 2 && styles.rankThree,
          ]}>
            <Text style={styles.rankText}>#{index * 2 + productIndex + 1}</Text>
          </View>

          {/* Indicateur de popularité */}
          <View style={styles.popularityBar}>
            <View 
              style={[
                styles.popularityFill,
                { width: `${85 - ((index * 2 + productIndex) * 15)}%` }
              ]} 
            />
          </View>

          {/* Badge "Vendu" */}
          {(index * 2 + productIndex) < 2 && (
            <View style={styles.bestSellerBadge}>
              <Ionicons name="flash" size={10} color="#fff" />
              <Text style={styles.bestSellerText}>Vendu</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6a00" />
        <Text style={styles.loadingText}>Chargement des tendances...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Ionicons name="trending-up" size={24} color="#ff6a00" />
          <Text style={styles.title}>Tendances du Moment</Text>
          <View style={styles.trendIndicator}>
            <Ionicons name="arrow-up" size={14} color="#4CAF50" />
            <Text style={styles.trendText}>+24%</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.seeAllButton}
          onPress={navigateToTrendingExplore}
        >
          <Text style={styles.seeAllText}>Explorer</Text>
          <Ionicons name="arrow-forward" size={16} color="#ff6a00" />
        </TouchableOpacity>
      </View>

      {/* Liste des produits */}
      <FlatList
        data={groupedProducts}
        renderItem={renderProductGroup}
        keyExtractor={(_, index) => `trending-group-${index}`}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.productsContainer}
      />

      {/* Statistiques */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {products.reduce((sum, p) => sum + (p.views || 0), 0).toLocaleString().substring(0, 3)}K
          </Text>
          <Text style={styles.statLabel}>Vues aujourd'hui</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {products.reduce((sum, p) => sum + (p.orders || 0), 0).toLocaleString().substring(0, 3)}
          </Text>
          <Text style={styles.statLabel}>Commandes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>94%</Text>
          <Text style={styles.statLabel}>Satisfaction</Text>
        </View>
      </View>

      {/* Bannière promotionnelle */}
      <TouchableOpacity 
        style={styles.promoBanner}
        onPress={navigateToTrendingExplore}
      >
        <LinearGradient
          colors={['#ff6a00', '#ff8c00']}
          style={styles.promoGradient}
        >
          <View style={styles.promoContent}>
            <Ionicons name="flash" size={20} color="#fff" />
            <Text style={styles.promoText}>Livraison EXPRESS offerte sur les produits tendances</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8f9fa',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#333',
    marginLeft: 8,
    marginRight: 12,
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 2,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  seeAllText: {
    color: '#ff6a00',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  productsContainer: {
    paddingHorizontal: 12,
  },
  productGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productWrapper: {
    flex: 1,
    marginHorizontal: 4,
    position: 'relative',
  },
  productCard: {
    width: '100%',
  },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  rankOne: {
    backgroundColor: '#FFD700',
  },
  rankTwo: {
    backgroundColor: '#C0C0C0',
  },
  rankThree: {
    backgroundColor: '#CD7F32',
  },
  rankText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  popularityBar: {
    position: 'absolute',
    bottom: 60,
    left: 12,
    right: 12,
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  popularityFill: {
    height: '100%',
    backgroundColor: '#ff6a00',
    borderRadius: 2,
  },
  bestSellerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 10,
  },
  bestSellerText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
    marginLeft: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ff6a00',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#f0f0f0',
  },
  promoBanner: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  promoGradient: {
    padding: 12,
  },
  promoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
    textAlign: 'center',
  },
});