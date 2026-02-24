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
  TouchableOpacity,
  ActivityIndicator,
  FlatList
} from "react-native";
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, query, orderBy, where, startAfter } from "firebase/firestore";
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
import FloatingCartButton from "../../src/components/premium/FloatingCartButton";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_HEIGHT = Platform.OS === 'ios' ? 160 : 145;
const PAGE_SIZE = 20;
const MAX_POPULAR_PRODUCTS = 200; 

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  mainImage?: string;
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
  categoryName?: string;
  originalLink?: string; // Pour l'ouverture WebView
  // ? AJOUT: Champ pour la livraison gratuite
  hasFreeShipping?: boolean;
  freeShippingBadge?: string | null;
}

const shuffleArray = (array: any[]) => {
  let newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export default function PremiumHomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  
  const [lastVisible, setLastDoc] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // État pour l'animation de fondu
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [homeData, setHomeData] = useState({
    featuredProducts: [] as Product[],
    trendingProducts: [] as Product[],
    specialOffers: [] as Product[],
    popularProducts: [] as Product[],
    newArrivals: [] as Product[],
    industrialMachines: [] as Product[],
    suppliersWithProducts: [] as any[],
    categories: [
      { id: '1', name: 'category.electronics', icon: '??', color: '#ff6a00' },
      { id: '2', name: 'category.clothing', icon: '??', color: '#4CAF50' },
      { id: '3', name: 'category.machinery', icon: '??', color: '#2196F3' },
      { id: '4', name: 'category.materials', icon: '???', color: '#9C27B0' },
    ],
  });

  const normalizeProduct = (doc: any): Product => {
    const data = doc.data();
    const name = data.name || "";
    const rawCat = data.categoryName || data.category || "";
    const cleanCategory = rawCat === "Uncategorized" || rawCat === "uncategorized" ? "" : rawCat;

    return {
      id: doc.id,
      name: name.includes(".") ? t(name) : name,
      price: Number(data.price) || 0,
      originalPrice: Number(data.originalPrice) || Number(data.price),
      imageUrl: data.mainImage || data.imageUrl || "https://via.placeholder.com/600",
      mainImage: data.mainImage || data.imageUrl,
      rating: data.rating || 0,
      stock: data.stockQuantity || data.stock || 0,
      supplier: data.supplier || data.companyName || "",
      minOrder: data.minOrder || 1,
      deliveryTime: data.deliveryTime || "",
      isVerified: data.isVerified || false,
      featured: data.featured || false,
      trending: data.trending || false,
      specialOffer: data.specialOffer || false,
      newArrival: data.newArrival || false,
      industrial: data.industrial || false,
      categoryName: cleanCategory,
      originalLink: data.originalLink || "",
      // ? RÉCUPÉRATION: Champ livraison gratuite depuis Firestore
      hasFreeShipping: data.hasFreeShipping || false,
      freeShippingBadge: data.freeShippingBadge || null,
    };
  };

  const fetchHomeData = async (isRefresh = true) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setHasMore(true);
      }

      // Requêtes Firebase
      const [featS, trendS, specS, popS, newS, indS, supps] = await Promise.all([
        getDocs(query(collection(db, "products"), where("featured", "==", true), limit(20))),
        getDocs(query(collection(db, "products"), where("trending", "==", true), limit(20))),
        getDocs(query(collection(db, "products"), where("specialOffer", "==", true), limit(20))),
        getDocs(query(collection(db, "products"), orderBy("createdAt", "desc"), limit(60))), 
        getDocs(query(collection(db, "products"), where("newArrival", "==", true), limit(15))),
        getDocs(query(collection(db, "products"), where("industrial", "==", true), limit(15))),
        fetchSuppliersWithProducts()
      ]);

      const allPopular = popS.docs.map(doc => normalizeProduct(doc));

      setLastDoc(popS.docs[popS.docs.length - 1]);
      setHasMore(popS.docs.length >= 20);

      // Mise à jour de l'état avec Shuffle unique au chargement
      setHomeData(prev => ({
        ...prev,
        featuredProducts: shuffleArray(featS.docs.map(doc => normalizeProduct(doc))).slice(0, 8),
        trendingProducts: shuffleArray(trendS.docs.map(doc => normalizeProduct(doc))).slice(0, 10),
        specialOffers: shuffleArray(specS.docs.map(doc => normalizeProduct(doc))).slice(0, 8),
        popularProducts: allPopular, 
        newArrivals: shuffleArray(newS.docs.map(doc => normalizeProduct(doc))),
        industrialMachines: shuffleArray(indS.docs.map(doc => normalizeProduct(doc))),
        suppliersWithProducts: supps,
      }));
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchMoreProducts = async () => {
    if (loadingMore || !hasMore || !lastVisible || homeData.popularProducts.length >= MAX_POPULAR_PRODUCTS) return;
    setLoadingMore(true);
    try {
      const nextQ = query(
        collection(db, "products"), 
        orderBy("createdAt", "desc"), 
        startAfter(lastVisible), 
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(nextQ);
      if (!snap.empty) {
        const nextItems = snap.docs.map(doc => normalizeProduct(doc));
        setHomeData(prev => ({
          ...prev,
          popularProducts: [...prev.popularProducts, ...nextItems]
        }));
        setLastDoc(snap.docs[snap.docs.length - 1]);
        setHasMore(snap.docs.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Load More Error:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchSuppliersWithProducts = async () => {
    try {
      const q = query(collection(db, 'companies'), where('isVerified', '==', true), limit(6));
      const snap = await getDocs(q);
      const suppliers = await Promise.all(snap.docs.map(async (doc) => {
        const pQ = query(collection(db, 'products'), where('companyId', '==', doc.id), limit(3));
        const pSnap = await getDocs(pQ);
        return { 
          id: doc.id, 
          ...doc.data(), 
          products: pSnap.docs.map(p => normalizeProduct(p)),
          productCount: pSnap.docs.length 
        };
      }));
      return shuffleArray(suppliers.filter(s => s.productCount > 0));
    } catch (e) { 
      return []; 
    }
  };

  // LOGIQUE VITESSE : On ne met plus le setInterval ici pour éviter le changement brusque
  useEffect(() => {
    fetchHomeData();
  }, []);

  const handleProductPress = (item: Product) => {
    if (item.originalLink) {
      router.push({
        pathname: "/webview",
        params: { url: item.originalLink, title: item.name }
      });
    } else {
      router.push(`/product/${item.id}`);
    }
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <Animated.View style={{ width: '48%', marginBottom: 15, opacity: fadeAnim }}>
      <TouchableOpacity 
        style={styles.productCardWrapper}
        onPress={() => handleProductPress(item)}
        activeOpacity={0.8}
      >
        <ProductCardPremium 
          product={item} 
          // ? Le badge de livraison gratuite sera automatiquement affiché
          // car le composant ProductCardPremium reçoit maintenant le champ hasFreeShipping
        />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#ff6a00" barStyle="light-content" />
      
      {/* HEADER FIXE */}
      <View style={[styles.stickyHeader, { height: HEADER_HEIGHT }]}>
        <PremiumHeader onSearch={(q) => console.log(q)} />
      </View>

      <Animated.FlatList
        data={homeData.popularProducts}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        onEndReached={fetchMoreProducts}
        onEndReachedThreshold={0.5}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            {/* Espace pour le header sticky */}
            <View style={{ height: HEADER_HEIGHT }} />
            
            <AnimatedQuickActions />
            
            <HeroBanner />
            
            {/* ? SECTION VEDETTE - Affiche les produits avec hasFreeShipping */}
            {homeData.featuredProducts.length > 0 && (
              <PremiumSpecialOffers 
                products={homeData.featuredProducts} 
                title={t('homeScreen.featuredProductsTitle')} 
                subtitle={t('homeScreen.featuredProductsSubtitle')} 
                // Les produits avec hasFreeShipping=true auront le badge
              />
            )}
            
            {/* ? SECTION TENDANCES - Affiche les produits avec hasFreeShipping */}
            {homeData.trendingProducts.length > 0 && (
              <TrendingProductsPremium 
                products={homeData.trendingProducts}
                // Les produits avec hasFreeShipping=true auront le badge
              />
            )}

            <CategoryGridPremium 
              categories={homeData.categories.map(c => ({...c, name: t(c.name)}))} 
            />
            
            <PremiumAdBanner />
            
            {/* ? SECTION NOUVEAUTÉS - Affiche les produits avec hasFreeShipping */}
            {homeData.newArrivals.length > 0 && (
              <NewArrivalsPremium 
                products={homeData.newArrivals}
                // Les produits avec hasFreeShipping=true auront le badge
              />
            )}
            
            {homeData.suppliersWithProducts.length > 0 && (
              <PremiumSuppliersSection suppliers={homeData.suppliersWithProducts} />
            )}
            
            {/* ? SECTION MACHINES INDUSTRIELLES - Affiche les produits avec hasFreeShipping */}
            {homeData.industrialMachines.length > 0 && (
              <IndustrialMachinesPremium 
                products={homeData.industrialMachines}
                // Les produits avec hasFreeShipping=true auront le badge
              />
            )}

            {/* SECTION MORE TO EXPLORE */}
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>{t('More to Explore')}</Text>
            </View>
          </View>
        }
        renderItem={renderProductItem}
        ListFooterComponent={
          <View style={styles.footerContent}>
            {loadingMore && (
              <ActivityIndicator size="large" color="#ff6a00" style={{ marginVertical: 20 }} />
            )}
            <View style={styles.simpleFooter}>
              <View style={styles.footerDivider} />
              <Text style={styles.footerText}>A2Express @ 2026</Text>
              <Text style={styles.footerSubText}>Votre partenaire import export de confiance</Text>
            </View>
          </View>
        }
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => fetchHomeData(true)} 
            colors={["#ff6a00"]} 
            progressViewOffset={HEADER_HEIGHT} 
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
  stickyHeader: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 1000, 
    backgroundColor: '#ff6a00' 
  },
  headerContent: { 
    backgroundColor: '#fff' 
  },
  listContent: { 
    paddingBottom: 40 
  },
  columnWrapper: { 
    justifyContent: 'space-between', 
    paddingHorizontal: 12 
  },
  productCardWrapper: { 
    width: '100%', 
    marginBottom: 5 
  },
  sectionTitleContainer: { 
    paddingHorizontal: 16, 
    paddingVertical: 15,
    marginTop: 10
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#333',
    letterSpacing: 0.5
  },
  footerContent: { 
    marginTop: 20 
  },
  simpleFooter: { 
    padding: 40, 
    alignItems: "center", 
    backgroundColor: '#f8f9fa', 
    marginTop: 20 
  },
  footerDivider: {
    width: 50,
    height: 3,
    backgroundColor: '#ff6a00',
    marginBottom: 15,
    borderRadius: 2
  },
  footerText: { 
    fontSize: 15, 
    color: "#333", 
    fontWeight: 'bold', 
    marginBottom: 5 
  },
  footerSubText: {
    fontSize: 12,
    color: "#666",
    fontStyle: 'italic'
  }
});