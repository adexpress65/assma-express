// mobile/app/PremiumHomeScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import { 
  StyleSheet, 
  StatusBar, 
  View, 
  RefreshControl, 
  Text, 
  FlatList,
  Animated,
  Dimensions,
  Platform
} from "react-native";
import { collection, getDocs, limit, query, orderBy, where } from "firebase/firestore";
import { db } from "../../src/config/firebase";

// Composants Premium
import PremiumHeader from "../../src/components/premium/PremiumHeader";
import AnimatedQuickActions from "../../src/components/premium/AnimatedQuickActions";
import PremiumTabHeader from "../../src/components/premium/PremiumTabHeader";
import HeroBanner from "../../src/components/premium/HeroBanner";
import PremiumSpecialOffers from "../../src/components/premium/PremiumSpecialOffers";
import CategoryGridPremium from "../../src/components/premium/CategoryGridPremium";
import ProductCardPremium from "../../src/components/premium/ProductCardPremium";
import NewArrivalsPremium from "../../src/components/premium/NewArrivalsPremium";
import IndustrialMachinesPremium from "../../src/components/premium/IndustrialMachinesPremium";
import PremiumAdBanner from "../../src/components/premium/PremiumAdBanner";
import PremiumSuppliersSection from "../../src/components/premium/PremiumSuppliersSection";
import TrendingProductsPremium from "../../src/components/premium/TrendingProductsPremium";
import FloatingCartButton from "../../src/components/premium/FloatingCartButton";
import SupplierShowcase from "../../src/components/premium/SupplierShowcase";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Normalisation améliorée des produits
const normalizeProduct = (doc: any) => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || "Produit Premium",
    price: data.price ?? data.originalPrice ?? 0,
    originalPrice: data.originalPrice || data.price || 0,
    categoryId: data.categoryId || data.category || null,
    imageUrl: data.imageUrl || data.image || "https://via.placeholder.com/300x300/ff6a00/ffffff?text=Assma+Express",
    rating: data.rating || 4.5,
    stock: data.stock || 99,
    supplier: data.supplier || "Fournisseur Certifié",
    minOrder: data.minOrder || 1,
    deliveryTime: data.deliveryTime || "2-5 jours",
    isVerified: data.isVerified || true,
    ...data,
  };
};

// Données de catégories par défaut premium
const PREMIUM_CATEGORIES = [
  { id: '1', name: 'Électronique', icon: '📱', color: '#ff6a00', count: 1245 },
  { id: '2', name: 'Vêtements', icon: '👕', color: '#4CAF50', count: 892 },
  { id: '3', name: 'Machines', icon: '⚙️', color: '#2196F3', count: 567 },
  { id: '4', name: 'Matériaux', icon: '🏗️', color: '#9C27B0', count: 734 },
  { id: '5', name: 'Automobile', icon: '🚗', color: '#FF9800', count: 456 },
  { id: '6', name: 'Équipement Médical', icon: '🏥', color: '#F44336', count: 321 },
  { id: '7', name: 'Meubles', icon: '🪑', color: '#795548', count: 678 },
  { id: '8', name: 'Jardinage', icon: '🌿', color: '#4CAF50', count: 234 },
];

export default function PremiumHomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('recommended');
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Animation améliorée pour le header
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -100],
    extrapolate: 'clamp',
  });

  const [homeData, setHomeData] = useState({
    specialOffers: [],
    categories: PREMIUM_CATEGORIES,
    popularProducts: [],
    newArrivals: [],
    industrialMachines: [],
    premiumSuppliers: [],
    trendingProducts: [],
    featuredProducts: [],
    suppliersWithProducts: [], // NOUVEAU: Fournisseurs avec leurs produits
  });

  // 📦 FONCTION POUR RÉCUPÉRER LES FOURNISSEURS AVEC LEURS PRODUITS
  const fetchSuppliersWithProducts = async () => {
    try {
      console.log('🔄 Chargement des fournisseurs avec produits...');
      
      // 1. Récupérer les fournisseurs vérifiés
      const suppliersQuery = query(
        collection(db, 'companies'),
        where('verified', '==', true),
        limit(12)
      );
      
      const suppliersSnap = await getDocs(suppliersQuery);
      const suppliers = suppliersSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`🏪 ${suppliers.length} fournisseurs trouvés`);

      // 2. Pour chaque fournisseur, récupérer 2-3 produits
      const suppliersWithProducts = await Promise.all(
        suppliers.map(async (supplier) => {
          try {
            const productsQuery = query(
              collection(db, 'products'),
              where('companyId', '==', supplier.id),
              limit(3)
            );
            
            const productsSnap = await getDocs(productsQuery);
            const products = productsSnap.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));

            return {
              ...supplier,
              products: products.length > 0 ? products.map(normalizeProduct) : [],
              productCount: products.length
            };
          } catch (error) {
            console.log(`⚠️ Erreur produits pour ${supplier.name}:`, error);
            return {
              ...supplier,
              products: [],
              productCount: 0
            };
          }
        })
      );

      // Filtrer les fournisseurs avec au moins 1 produit
      const validSuppliers = suppliersWithProducts.filter(s => s.productCount > 0);
      
      console.log(`📦 ${validSuppliers.length} fournisseurs avec produits valides`);
      return validSuppliers;

    } catch (error) {
      console.error('❌ Erreur chargement fournisseurs:', error);
      return [];
    }
  };

  const fetchHomeData = async () => {
    try {
      // ✅ REQUÊTES CORRECTES AVEC LES NOUVEAUX CHAMPS FIRESTORE
      const featuredQuery = query(
        collection(db, "products"), 
        where("featured", "==", true),
        limit(8)
      );
      
      const trendingQuery = query(
        collection(db, "products"), 
        where("trending", "==", true),
        limit(8)
      );
      
      const specialOffersQuery = query(
        collection(db, "products"), 
        where("specialOffer", "==", true),
        limit(8)
      );
      
      const newArrivalsQuery = query(
        collection(db, "products"), 
        where("newArrival", "==", true),
        limit(8)
      );
      
      const industrialQuery = query(
        collection(db, "products"), 
        where("industrial", "==", true),
        limit(8)
      );
      
      const premiumSuppliersQuery = query(
        collection(db, "products"), 
        where("premiumSupplier", "==", true),
        limit(8)
      );

      // Récupération de tous les produits populaires (pour la liste principale)
      const popularQuery = query(
        collection(db, "products"), 
        orderBy("createdAt", "desc"), 
        limit(12)
      );

      // ✅ AJOUT: Récupérer les fournisseurs avec produits
      const suppliersWithProducts = await fetchSuppliersWithProducts();

      const [
        featuredSnap, 
        trendingSnap, 
        specialOffersSnap, 
        newArrivalsSnap, 
        industrialSnap, 
        premiumSuppliersSnap,
        popularSnap
      ] = await Promise.all([
        getDocs(featuredQuery),
        getDocs(trendingQuery),
        getDocs(specialOffersQuery),
        getDocs(newArrivalsQuery),
        getDocs(industrialQuery),
        getDocs(premiumSuppliersQuery),
        getDocs(popularQuery),
      ]);

      const featuredProducts = featuredSnap.docs.map(normalizeProduct);
      const trendingProducts = trendingSnap.docs.map(normalizeProduct);
      const specialOffers = specialOffersSnap.docs.map(normalizeProduct);
      const newArrivals = newArrivalsSnap.docs.map(normalizeProduct);
      const industrialMachines = industrialSnap.docs.map(normalizeProduct);
      const premiumSuppliers = premiumSuppliersSnap.docs.map(normalizeProduct);
      const popularProducts = popularSnap.docs.map(normalizeProduct);

      // Simulation de données premium si Firestore vide
      const generatePremiumData = () => {
        const mockProducts = Array.from({ length: 12 }, (_, i) => ({
          id: `premium-${i}`,
          name: `Produit Premium ${i + 1}`,
          price: Math.floor(Math.random() * 1000) + 50,
          originalPrice: Math.floor(Math.random() * 1500) + 100,
          imageUrl: `https://via.placeholder.com/300x300/00${i}0ff/ffffff?text=Produit+${i + 1}`,
          rating: 4 + Math.random(),
          supplier: `Fournisseur ${i + 1}`,
          minOrder: Math.floor(Math.random() * 100) + 1,
          deliveryTime: `${Math.floor(Math.random() * 5) + 1}-7 jours`,
          isVerified: true,
          categoryId: `cat-${(i % 8) + 1}`,
          featured: i === 0,
          trending: i < 3,
          specialOffer: i % 2 === 0,
          newArrival: true,
          industrial: i % 4 === 0,
          premiumSupplier: i < 6,
        }));
        return mockProducts;
      };

      // Générer des fournisseurs mock si nécessaire
      const generateMockSuppliers = () => {
        const mockSuppliers = Array.from({ length: 6 }, (_, i) => ({
          id: `supplier-${i}`,
          name: `Boutique Premium ${i + 1}`,
          logo: `https://via.placeholder.com/100x100/ff6a00/ffffff?text=B${i + 1}`,
          description: `Fournisseur certifié de produits de qualité ${i + 1}`,
          location: ['Dakar', 'Abidjan', 'Lomé', 'Cotonou', 'Bamako'][i % 5],
          verified: true,
          products: generatePremiumData().slice(0, 3),
          productCount: 3,
        }));
        return mockSuppliers;
      };

      setHomeData({
        specialOffers: specialOffers.length > 0 ? specialOffers : generatePremiumData().filter(p => p.specialOffer).slice(0, 8),
        categories: PREMIUM_CATEGORIES,
        popularProducts: popularProducts.length > 0 ? popularProducts : generatePremiumData().slice(0, 12),
        newArrivals: newArrivals.length > 0 ? newArrivals : generatePremiumData().filter(p => p.newArrival).slice(0, 8),
        industrialMachines: industrialMachines.length > 0 ? industrialMachines : generatePremiumData().filter(p => p.industrial).slice(0, 8),
        premiumSuppliers: premiumSuppliers.length > 0 ? premiumSuppliers : generatePremiumData().filter(p => p.premiumSupplier).slice(0, 8),
        trendingProducts: trendingProducts.length > 0 ? trendingProducts : generatePremiumData().filter(p => p.trending).slice(0, 8),
        featuredProducts: featuredProducts.length > 0 ? featuredProducts : generatePremiumData().filter(p => p.featured).slice(0, 6),
        // ✅ NOUVEAU: Fournisseurs avec produits
        suppliersWithProducts: suppliersWithProducts.length > 0 ? suppliersWithProducts : generateMockSuppliers(),
      });
    } catch (e) {
      console.log("Firestore fetch error", e);
      // Données de secours premium avec les nouveaux champs
      const fallbackData = Array.from({ length: 20 }, (_, i) => ({
        id: `fallback-${i}`,
        name: `Produit Assma Express ${i + 1}`,
        price: Math.floor(Math.random() * 2000) + 100,
        originalPrice: Math.floor(Math.random() * 2500) + 200,
        imageUrl: `https://via.placeholder.com/300x300/ff6a00/ffffff?text=Assma+${i + 1}`,
        rating: 4.2 + Math.random() * 0.8,
        supplier: `Fournisseur Certifié ${i + 1}`,
        minOrder: Math.floor(Math.random() * 50) + 10,
        deliveryTime: "3-5 jours",
        isVerified: true,
        categoryId: `cat-${(i % 8) + 1}`,
        featured: i === 0,
        trending: i < 4,
        specialOffer: i % 3 === 0,
        newArrival: true,
        industrial: i % 5 === 0,
        premiumSupplier: i < 8,
      }));

      // Fournisseurs de secours
      const fallbackSuppliers = Array.from({ length: 6 }, (_, i) => ({
        id: `fallback-supplier-${i}`,
        name: `Boutique Partenaire ${i + 1}`,
        logo: `https://via.placeholder.com/100x100/ff6a00/ffffff?text=BP${i + 1}`,
        description: `Fournisseur partenaire certifié ${i + 1}`,
        location: ['Dakar', 'Abidjan', 'Lomé', 'Cotonou', 'Bamako'][i % 5],
        verified: true,
        products: fallbackData.slice(i * 2, i * 2 + 3),
        productCount: 3,
      }));
      
      setHomeData(prev => ({
        ...prev,
        specialOffers: fallbackData.filter(p => p.specialOffer).slice(0, 8),
        popularProducts: fallbackData.slice(0, 12),
        newArrivals: fallbackData.filter(p => p.newArrival).slice(0, 8),
        industrialMachines: fallbackData.filter(p => p.industrial).slice(0, 8),
        premiumSuppliers: fallbackData.filter(p => p.premiumSupplier).slice(0, 8),
        trendingProducts: fallbackData.filter(p => p.trending).slice(0, 8),
        featuredProducts: fallbackData.filter(p => p.featured).slice(0, 6),
        suppliersWithProducts: fallbackSuppliers,
      }));
    }
  };

  useEffect(() => {
    fetchHomeData();
  }, []);

  const renderProductGroup = ({ item, index }: { item: any[], index: number }) => (
    <View style={styles.productGroup}>
      {item.map((product: any, productIndex: number) => (
        <ProductCardPremium 
          key={product.id} 
          product={product} 
          style={[
            styles.productCard,
            productIndex === 0 && styles.firstCard,
            productIndex === item.length - 1 && styles.lastCard
          ]}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#ff6a00" barStyle="light-content" />
      
      {/* Header fixe avec animation */}
      <Animated.View style={[
        styles.headerContainer, 
        { transform: [{ translateY: headerTranslateY }] }
      ]}>
        <PremiumHeader />
      </Animated.View>

      <Animated.FlatList
        data={homeData.popularProducts.reduce((acc, _, i, arr) => {
          if (i % 2 === 0) acc.push(arr.slice(i, i + 2));
          return acc;
        }, [])}
        keyExtractor={(group, index) => `product-group-${index}`}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            {/* ESPACE POUR LE HEADER FIXE - AUGMENTÉ */}
            <View style={styles.headerSpacer} />
            
            <View style={styles.topSection}>
              <AnimatedQuickActions />
              <HeroBanner />
              
              {/* Section des boutons Flashdeal, Tendance, Premium, Fournisseur */}
              <View style={styles.tabSection}>
                <PremiumTabHeader activeTab={activeTab} onTabChange={setActiveTab} />
              </View>
            </View>
            
            {/* ✅ CORRESPONDANCE ENTRE LES SECTIONS ET LES DONNÉES */}
            
            {/* Produits VEDETTES - featured: true */}
            {homeData.featuredProducts.length > 0 && (
              <PremiumSpecialOffers 
                products={homeData.featuredProducts} 
                title="Produits Vedettes"
                subtitle="Découvrez nos produits en avant"
              />
            )}
            
            {/* Produits TENDANCES - trending: true */}
            {homeData.trendingProducts.length > 0 && (
              <TrendingProductsPremium products={homeData.trendingProducts} />
            )}
            
            {/* Catégories */}
            <CategoryGridPremium categories={homeData.categories} />
            
            {/* ✅ NOUVELLE SECTION: FOURNISSEURS AVEC PRODUITS */}
            {homeData.suppliersWithProducts && homeData.suppliersWithProducts.length > 0 && (
              <SupplierShowcase 
                suppliers={homeData.suppliersWithProducts}
                title="Boutiques Partenaires"
                subtitle="Découvrez nos fournisseurs vérifiés et leurs produits"
              />
            )}
            
            {/* Bannière publicitaire */}
            <PremiumAdBanner />
            
            {/* OFFRES SPÉCIALES - specialOffer: true */}
            {homeData.specialOffers.length > 0 && (
              <PremiumSpecialOffers 
                products={homeData.specialOffers}
                title="Offres Spéciales"
                subtitle="Promotions et bonnes affaires"
              />
            )}
          </View>
        }
        renderItem={renderProductGroup}
        ListFooterComponent={
          <View style={styles.footerContent}>
            {/* FOURNISSEURS PREMIUM - premiumSupplier: true */}
            {homeData.premiumSuppliers.length > 0 && (
              <PremiumSuppliersSection products={homeData.premiumSuppliers} />
            )}
            
            {/* NOUVEAUTÉS - newArrival: true */}
            {homeData.newArrivals.length > 0 && (
              <NewArrivalsPremium products={homeData.newArrivals} />
            )}
            
            {/* MACHINES INDUSTRIELLES - industrial: true */}
            {homeData.industrialMachines.length > 0 && (
              <IndustrialMachinesPremium products={homeData.industrialMachines} />
            )}
            
            {/* Footer simple */}
            <View style={styles.simpleFooter}>
              <Text style={styles.footerText}>info@assma-expresse.com</Text>
              <Text style={styles.footerText}>© 2024 Assma Express</Text>
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {
              setRefreshing(true);
              fetchHomeData().finally(() => setRefreshing(false));
            }}
            colors={["#ff6a00", "#ff8c00", "#ffa500"]}
            tintColor="#ff6a00"
          />
        }
        contentContainerStyle={styles.listContent}
      />

      <FloatingCartButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#ffffff" 
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerContent: {
    backgroundColor: '#fff',
  },
  headerSpacer: {
    height: 180,
  },
  topSection: {
    backgroundColor: '#fff',
  },
  tabSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 0,
    paddingVertical: 0,
    minHeight: 80,
  },
  listContent: {
    paddingBottom: 30,
  },
  productGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  productCard: {
    flex: 1,
    marginHorizontal: 4,
    width: '48%',
    minWidth: '48%',
  },
  firstCard: {
    marginLeft: 0,
  },
  lastCard: {
    marginRight: 0,
  },
  footerContent: {
    marginTop: 20,
  },
  simpleFooter: {
    padding: 20,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    marginTop: 10,
    backgroundColor: '#f8f9fa',
  },
  footerText: { 
    fontSize: 12, 
    color: "#666",
    marginBottom: 4,
  },
});