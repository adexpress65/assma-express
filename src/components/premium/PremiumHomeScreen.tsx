// PremiumHomeScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import { 
  StyleSheet, 
  StatusBar, 
  View, 
  RefreshControl, 
  Text, 
  Animated, 
  Dimensions, 
  Platform, 
  TouchableOpacity 
} from "react-native";
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, query, orderBy, where } from "firebase/firestore";
import { db } from "../../src/config/firebase";
import { useTranslation } from 'react-i18next';

// Composants Premium
import PremiumHeader from "../../src/components/premium/PremiumHeader";
import AnimatedQuickActions from "../../src/components/premium/AnimatedQuickActions";
import HeroBanner from "../../src/components/premium/HeroBanner";
import PremiumSpecialOffers from "../../src/components/premium/PremiumSpecialOffers";
import CategoryGridPremium from "../../src/components/premium/CategoryGridPremium";
import ProductCardPremium from "../../src/components/premium/ProductCardPremium";
import NewArrivalsPremium from "../../src/components/premium/NewArrivalsPremium";
import IndustrialMachinesPremium from "../../src/components/premium/IndustrialMachinesPremium";
import PremiumAdBanner from "../../src/components/premium/PremiumAdBanner";
import PremiumSuppliersSection from "../../src/components/premium/PremiumSuppliersSection";
import TrendingProductsPremium from "../../src/components/premium/TrendingProductsPremium";
import FloatingAIButton from "../../src/components/premium/FloatingAIButton";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const normalizeProduct = (doc: any) => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || "Produit sans nom",
    price: data.price || 0,
    originalPrice: data.originalPrice || data.price || 0,
    categoryId: data.categoryId || null,
    imageUrl: data.mainImage || data.imageUrl || "https://via.placeholder.com/300x300/ff6a00/ffffff?text=Assma",
    rating: data.rating || 0,
    stock: data.stockQuantity || 0,
    supplier: data.supplier || "A2Express Marketplace",
    minOrder: data.minOrder || 1,
    deliveryTime: data.deliveryTime || "N/A",
    isVerified: data.isVerified || false,
    ...data
  };
};

const PREMIUM_CATEGORIES = [
  { id: '1', name: 'category.electronics', icon: '📱', color: '#ff6a00' },
  { id: '2', name: 'category.clothing', icon: '👕', color: '#4CAF50' },
  { id: '3', name: 'category.machinery', icon: '🏭', color: '#2196F3' },
  { id: '4', name: 'category.materials', icon: '🧱', color: '#9C27B0' },
  { id: '5', name: 'category.automotive', icon: '🚗', color: '#FF9800' },
  { id: '6', name: 'category.medicalEquipment', icon: '🏥', color: '#F44336' },
  { id: '7', name: 'category.furniture', icon: '🛋️', color: '#795548' },
  { id: '8', name: 'category.gardening', icon: '🌿', color: '#4CAF50' },
];

export default function PremiumHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [searchQuery, setSearchQuery] = useState('');
  
  const [homeData, setHomeData] = useState({
    specialOffers: [],
    categories: PREMIUM_CATEGORIES.map(cat => ({...cat, name: t(cat.name)})),
    popularProducts: [],
    newArrivals: [],
    industrialMachines: [],
    premiumSuppliers: [],
    trendingProducts: [],
    featuredProducts: [],
    suppliersWithProducts: [],
  });

  // Animation Header
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [0, -110],
    extrapolate: 'clamp',
  });

  const fetchSuppliersWithProducts = async () => {
    try {
      const suppliersQuery = query(collection(db, 'companies'), where('isVerified', '==', true), limit(6));
      const suppliersSnap = await getDocs(suppliersQuery);
      const suppliersWithProducts = await Promise.all(
        suppliersSnap.docs.map(async (supplierDoc) => {
          const productsQuery = query(collection(db, 'products'), where('companyId', '==', supplierDoc.id), where('isActive', '==', true), limit(3));
          const productsSnap = await getDocs(productsQuery);
          const products = productsSnap.docs.map(doc => normalizeProduct(doc));
          return { id: supplierDoc.id, ...supplierDoc.data(), products, productCount: products.length };
        })
      );
      return suppliersWithProducts.filter(s => s.productCount > 0);
    } catch (error) { return []; }
  };

  const fetchHomeData = async () => {
    try {
      const getActiveQuery = (flag: string) => query(collection(db, "products"), where("isActive", "==", true), where(flag, "==", true), limit(8));
      const [f, tSnap, sSnap, nSnap, iSnap, pSSnap, popSnap, sData] = await Promise.all([
        getDocs(getActiveQuery("featured")),
        getDocs(getActiveQuery("trending")),
        getDocs(getActiveQuery("specialOffer")),
        getDocs(getActiveQuery("newArrival")),
        getDocs(getActiveQuery("industrial")),
        getDocs(getActiveQuery("premiumSupplier")),
        getDocs(query(collection(db, "products"), where("isActive", "==", true), orderBy("createdAt", "desc"), limit(12))),
        fetchSuppliersWithProducts()
      ]);

      setHomeData({
        featuredProducts: f.docs.map(normalizeProduct),
        trendingProducts: tSnap.docs.map(normalizeProduct),
        specialOffers: sSnap.docs.map(normalizeProduct),
        newArrivals: nSnap.docs.map(normalizeProduct),
        industrialMachines: iSnap.docs.map(normalizeProduct),
        premiumSuppliers: pSSnap.docs.map(normalizeProduct),
        popularProducts: popSnap.docs.map(normalizeProduct),
        categories: PREMIUM_CATEGORIES.map(cat => ({...cat, name: t(cat.name)})),
        suppliersWithProducts: sData
      });
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchHomeData(); }, []);

  const renderProductGroup = ({ item }: { item: any[] }) => (
    <View style={styles.productGroup}>
      {item.map((product: any) => (
        <View key={product.id} style={styles.productCard}>
          <ProductCardPremium product={product} onPress={() => router.push(`/product/${product.id}`)} />
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#ff6a00" barStyle="light-content" />
      
      {/* Header en position absolue */}
      <Animated.View style={[styles.headerContainer, { transform: [{ translateY: headerTranslateY }] }]}>
        <PremiumHeader onSearch={(q) => setSearchQuery(q)} />
      </Animated.View>

      <Animated.FlatList
        data={homeData.popularProducts.reduce((acc: any[], _, i, arr) => {
          if (i % 2 === 0) acc.push(arr.slice(i, i + 2));
          return acc;
        }, [])}
        keyExtractor={(_, index) => `product-group-${index}`}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        // On utilise scrollIndicatorInsets pour que la barre de scroll ne soit pas cachée
        scrollIndicatorInsets={{ top: 110 }}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <AnimatedQuickActions />
            <HeroBanner />
            
            {homeData.featuredProducts.length > 0 && (
              <PremiumSpecialOffers products={homeData.featuredProducts} title={t('homeScreen.featuredProductsTitle')} />
            )}
            
            {homeData.trendingProducts.length > 0 && (
              <TrendingProductsPremium products={homeData.trendingProducts} />
            )}
            
            <CategoryGridPremium categories={homeData.categories} />
            
            <PremiumAdBanner />
            
            {homeData.specialOffers.length > 0 && (
              <PremiumSpecialOffers products={homeData.specialOffers} title={t('homeScreen.specialOffersTitle')} />
            )}
          </View>
        }
        renderItem={renderProductGroup}
        ListFooterComponent={
          <View style={styles.footerContent}>
            {homeData.suppliersWithProducts.length > 0 && (
              <PremiumSuppliersSection suppliers={homeData.suppliersWithProducts} />
            )}
            
            {homeData.newArrivals.length > 0 && (
              <NewArrivalsPremium products={homeData.newArrivals} />
            )}
            
            {homeData.industrialMachines.length > 0 && (
              <IndustrialMachinesPremium products={homeData.industrialMachines} />
            )}
            
            <View style={styles.simpleFooter}>
              <Text style={styles.footerText}>A2Express Marketplace • B2B Africa</Text>
              <Text style={styles.footerText}>© 2026 Tous droits réservés</Text>
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
            progressViewOffset={120} // Très important pour voir le loader sous le header
            colors={["#ff6a00"]}
          />
        }
        contentContainerStyle={styles.listContent}
      />

      <FloatingAIButton />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  headerContainer: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 1000,
    height: 120, // Taille fixe du header
    backgroundColor: '#fff' 
  },
  headerContent: { 
    marginTop: 120, // On pousse le contenu vers le bas EXACTEMENT de la taille du header
    backgroundColor: '#fff' 
  },
  listContent: { 
    paddingBottom: 100 // Augmenté pour être sûr de voir le footer et laisser de la place au bouton AI
  },
  productGroup: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    marginBottom: 12 
  },
  productCard: { 
    width: (SCREEN_WIDTH - 44) / 2, // Calcul précis pour 2 colonnes avec marges
  },
  footerContent: { 
    marginTop: 20,
    backgroundColor: '#fff'
  },
  simpleFooter: { 
    padding: 60, 
    alignItems: "center", 
    backgroundColor: '#f8f9fa', 
    borderTopWidth: 1, 
    borderTopColor: '#eee' 
  },
  footerText: { fontSize: 12, color: "#666", marginBottom: 4 }
});