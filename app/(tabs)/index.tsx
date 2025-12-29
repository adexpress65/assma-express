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
  Platform,
  TouchableOpacity
} from "react-native";
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, query, orderBy, where } from "firebase/firestore";
import { db } from "@/config/firebase";

// Composants Premium
import PremiumHeader from "../../src/components/premium/PremiumHeader";
import AnimatedQuickActions from "../../src/components/premium/AnimatedQuickActions";
import PremiumTabHeader from "../../src/components/premium/PremiumTabHeader"; // Import conservé mais non utilisé
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Types d'interface
interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  categoryId?: string | null;
  imageUrl: string;
  rating: number;
  stock: number;
  supplier: string;
  minOrder: number;
  deliveryTime: string;
  isVerified: boolean;
  featured?: boolean;
  trending?: boolean;
  specialOffer?: boolean;
  newArrival?: boolean;
  industrial?: boolean;
  premiumSupplier?: boolean;
  category?: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
}

interface HomeData {
  specialOffers: Product[];
  categories: Category[];
  popularProducts: Product[];
  newArrivals: Product[];
  industrialMachines: Product[];
  premiumSuppliers: Product[];
  trendingProducts: Product[];
  featuredProducts: Product[];
}

// Normalisation améliorée des produits
const normalizeProduct = (doc: any): Product => {
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
const PREMIUM_CATEGORIES: Category[] = [
  { id: '1', name: 'Électronique', icon: '📱', color: '#ff6a00', count: 1245 },
  { id: '2', name: 'Vêtements', icon: '👕', color: '#4CAF50', count: 892 },
  { id: '3', name: 'Machines', icon: '🏭', color: '#2196F3', count: 567 },
  { id: '4', name: 'Matériaux', icon: '🧱', color: '#9C27B0', count: 734 },
  { id: '5', name: 'Automobile', icon: '🚗', color: '#FF9800', count: 456 },
  { id: '6', name: 'Équipement Médical', icon: '🏥', color: '#F44336', count: 321 },
  { id: '7', name: 'Meubles', icon: '🛋️', color: '#795548', count: 678 },
  { id: '8', name: 'Jardinage', icon: '🌿', color: '#4CAF50', count: 234 },
];

export default function PremiumHomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('recommended');
  const scrollY = useRef(new Animated.Value(0)).current;
  const [searchQuery, setSearchQuery] = useState('');
  const flatListRef = useRef(null);
  
  // Animation pour l'opacité du header (au lieu de la translation)
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 1],
    extrapolate: 'clamp',
  });

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [0, 0],
    extrapolate: 'clamp',
  });

  const [homeData, setHomeData] = useState<HomeData>({
    specialOffers: [],
    categories: PREMIUM_CATEGORIES,
    popularProducts: [],
    newArrivals: [],
    industrialMachines: [],
    premiumSuppliers: [],
    trendingProducts: [],
    featuredProducts: [],
  });

  // ✅ Fonction de recherche améliorée
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (query.trim() === '') {
      // Si la recherche est vide, revenir aux données normales
      fetchHomeData();
      return;
    }
    
    // Recherche dans les produits existants
    const filteredProducts = [
      ...homeData.specialOffers,
      ...homeData.popularProducts,
      ...homeData.newArrivals,
      ...homeData.industrialMachines,
      ...homeData.premiumSuppliers,
      ...homeData.trendingProducts,
      ...homeData.featuredProducts
    ].filter(product => 
      product.name.toLowerCase().includes(query.toLowerCase()) ||
      product.supplier.toLowerCase().includes(query.toLowerCase()) ||
      product.category?.toLowerCase().includes(query.toLowerCase())
    );

    // Mettre à jour les produits populaires avec les résultats de recherche
    setHomeData(prev => ({
      ...prev,
      popularProducts: filteredProducts.slice(0, 12)
    }));

    // Rediriger vers la page de résultats si on veut séparer
    // router.push({
    //   pathname: '/search/results',
    //   params: { query }
    // });
  };

  const navigateToCategory = (product: Product) => {
    console.log("🔗 Navigation vers catégorie du produit:", product.name);
    
    if (product.categoryId) {
      router.push(`/category/${product.categoryId}`);
    } else if (product.category) {
      const categorySlug = product.category.toLowerCase().replace(/\s+/g, '-');
      router.push(`/category/${categorySlug}`);
    } else {
      router.push(`/category/tous`);
    }
  };

  const fetchHomeData = async () => {
    try {
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

      const popularQuery = query(
        collection(db, "products"), 
        orderBy("createdAt", "desc"), 
        limit(12)
      );

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

      const generatePremiumData = (): Product[] => {
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

      setHomeData({
        specialOffers: specialOffers.length > 0 ? specialOffers : generatePremiumData().filter(p => p.specialOffer).slice(0, 8),
        categories: PREMIUM_CATEGORIES,
        popularProducts: popularProducts.length > 0 ? popularProducts : generatePremiumData().slice(0, 12),
        newArrivals: newArrivals.length > 0 ? newArrivals : generatePremiumData().filter(p => p.newArrival).slice(0, 8),
        industrialMachines: industrialMachines.length > 0 ? industrialMachines : generatePremiumData().filter(p => p.industrial).slice(0, 8),
        premiumSuppliers: premiumSuppliers.length > 0 ? premiumSuppliers : generatePremiumData().filter(p => p.premiumSupplier).slice(0, 8),
        trendingProducts: trendingProducts.length > 0 ? trendingProducts : generatePremiumData().filter(p => p.trending).slice(0, 8),
        featuredProducts: featuredProducts.length > 0 ? featuredProducts : generatePremiumData().filter(p => p.featured).slice(0, 6),
      });
    } catch (e) {
      console.log("Firestore fetch error", e);
      const fallbackData: Product[] = Array.from({ length: 20 }, (_, i) => ({
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
      
      setHomeData(prev => ({
        ...prev,
        specialOffers: fallbackData.filter(p => p.specialOffer).slice(0, 8),
        popularProducts: fallbackData.slice(0, 12),
        newArrivals: fallbackData.filter(p => p.newArrival).slice(0, 8),
        industrialMachines: fallbackData.filter(p => p.industrial).slice(0, 8),
        premiumSuppliers: fallbackData.filter(p => p.premiumSupplier).slice(0, 8),
        trendingProducts: fallbackData.filter(p => p.trending).slice(0, 8),
        featuredProducts: fallbackData.filter(p => p.featured).slice(0, 6),
      }));
    }
  };

  useEffect(() => {
    fetchHomeData();
  }, []);

  const renderProductGroup = ({ item, index }: { item: Product[], index: number }) => (
    <View style={styles.productGroup}>
      {item.map((product: Product, productIndex: number) => (
        <TouchableOpacity
          key={product.id}
          style={[
            styles.productCard,
            productIndex === 0 && styles.firstCard,
            productIndex === item.length - 1 && styles.lastCard,
            styles.productTouchable
          ]}
          activeOpacity={0.8}
          onPress={() => navigateToCategory(product)}
        >
          <ProductCardPremium product={product} />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#ff6a00" barStyle="light-content" />
      
      {/* ✅ MODIFIÉ : Header FIXE qui ne bouge plus */}
      <View style={styles.fixedHeaderContainer}>
        <PremiumHeader 
          onSearch={handleSearch}
          sticky={true}
        />
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={homeData.popularProducts.reduce((acc, _, i, arr) => {
          if (i % 2 === 0) acc.push(arr.slice(i, i + 2));
          return acc;
        }, [] as Product[][])}
        keyExtractor={(group, index) => `product-group-${index}`}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            {/* ✅ MODIFIÉ : Espace réduit car header est fixe au-dessus */}
            <View style={styles.headerSpacer} />
            
            <View style={styles.topSection}>
              <AnimatedQuickActions />
              <HeroBanner />
              
              {/* ✅ MODIFICATION : Section PremiumTabHeader masquée */}
              {false && (
                <View style={styles.tabSection}>
                  <PremiumTabHeader activeTab={activeTab} onTabChange={setActiveTab} />
                </View>
              )}
              {/* Alternative : commenter la section */}
              {/* 
              <View style={styles.tabSection}>
                <PremiumTabHeader activeTab={activeTab} onTabChange={setActiveTab} />
              </View>
              */}
            </View>
            
            {homeData.featuredProducts.length > 0 && (
              <PremiumSpecialOffers 
                products={homeData.featuredProducts} 
                title="Produits Vedettes"
                subtitle="Découvrez nos produits en avant"
              />
            )}
            
            {homeData.trendingProducts.length > 0 && (
              <TrendingProductsPremium products={homeData.trendingProducts} />
            )}
            
            <CategoryGridPremium categories={homeData.categories} />
            
            <PremiumAdBanner />
            
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
            {homeData.premiumSuppliers.length > 0 && (
              <PremiumSuppliersSection products={homeData.premiumSuppliers} />
            )}
            
            {homeData.newArrivals.length > 0 && (
              <NewArrivalsPremium products={homeData.newArrivals} />
            )}
            
            {homeData.industrialMachines.length > 0 && (
              <IndustrialMachinesPremium products={homeData.industrialMachines} />
            )}
            
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
  // ✅ MODIFIÉ : Header fixe positionné de manière absolue
  fixedHeaderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    // Pas de shadow ici car elle est dans PremiumHeader
  },
  headerContent: {
    backgroundColor: '#fff',
  },
  // ✅ MODIFIÉ : Espacement réduit pour le header fixe
  headerSpacer: {
    height: 160, // Ajusté selon la hauteur réelle de votre header
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
  productTouchable: {
    borderRadius: 16,
    overflow: 'hidden',
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