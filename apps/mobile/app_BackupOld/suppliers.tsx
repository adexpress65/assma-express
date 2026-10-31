import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  StatusBar,
  Animated,
  RefreshControl,
  Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";

const { width } = Dimensions.get("window");

/* =========================
   Types
   ========================= */
interface Product {
  id: string;
  name: string;
  image: string;
  price: string;
  originalPrice?: string;
  discount?: number;
  moq: string;
  colors?: string;
  isAd?: boolean;
  isSuper?: boolean;
  isVerified?: boolean;
}

interface Supplier {
  id: string;
  name: string;
  logo: string;
  verified: boolean;
  verificationLevel: string;
  details: string;
  responseTime: string;
  deliveryRate: string;
  isAd?: boolean;
  isSuper?: boolean;
  products: Product[];
}

// Type correct pour les icÃ´nes Ionicons
type IoniconName = keyof typeof Ionicons.glyphMap;

/* =========================
   DonnÃ©es exactes des captures
   ========================= */
const headerTabs = [
  { id: "all", label: "Tous", active: true },
  { id: "clothing", label: "VÃªtements et accessoires" },
  { id: "vehicles", label: "VÃ©hicules et transports" },
];

const quickServices: { icon: IoniconName; label: string }[] = [
  { icon: "grid-outline", label: "CatÃ©gories" },
  { icon: "document-text-outline", label: "Demander un devis  " },
  { icon: "business-outline", label: "Salon en ligne  " },
  { icon: "storefront-outline", label: "Salle d'exposition  " },
  { icon: "camera-outline", label: "Recherche image" },
  { icon: "airplane-outline", label: "Logistique" },
];

// DonnÃ©es pour la section 3 rangÃ©es de 2 colonnes (comme dans les captures)
const electronicProducts: Product[] = [
  { 
    id: "1", 
    name: "Chargeur sans fil", 
    image: "https://picsum.photos/150/150?random=31", 
    price: "2 500 F CFA", 
    moq: "5 piÃ¨ces"
  },
   { 
    id: "2", 
    name: "Chargeur sans fil", 
    image: "https://picsum.photos/150/150?random=31", 
    price: "2 500 F CFA", 
    moq: "5 piÃ¨ces"
  },
   { 
    id: "3", 
    name: "Chargeur sans fil", 
    image: "https://picsum.photos/150/150?random=31", 
    price: "2 500 F CFA", 
    moq: "5 piÃ¨ces"
  },
  { 
    id: "4", 
    name: "Support tÃ©lÃ©phone", 
    image: "https://picsum.photos/150/150?random=32", 
    price: "6 000 F CFA", 
    moq: "2 piÃ¨ces"
  },
  { 
    id: "5", 
    name: "Ã‰couteurs Bluetooth", 
    image: "https://picsum.photos/150/150?random=33", 
    price: "4 000 F CFA", 
    moq: "3 piÃ¨ces"
  },
  { 
    id: "6", 
    name: "CÃ¢bles USB", 
    image: "https://picsum.photos/150/150?random=34", 
    price: "3 200 F CFA", 
    originalPrice: "4 000 F CFA", 
    discount: 20, 
    moq: "4 piÃ¨ces"
  },
  { 
    id: "7", 
    name: "Power Bank", 
    image: "https://picsum.photos/150/150?random=35", 
    price: "5 500 F CFA", 
    moq: "1 piÃ¨ce"
  },
  { 
    id: "8", 
    name: "Adaptateur USB-C", 
    image: "https://picsum.photos/150/150?random=36", 
    price: "1 800 F CFA", 
    moq: "10 piÃ¨ces"
  },
];

// DonnÃ©es des fournisseurs exactes comme dans les captures
const suppliersData: Supplier[] = [
  {
    id: "1",
    name: "Flyedi Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=1",
    verified: true,
    verificationLevel: "Verified 3 yrs",
    details: "130+ personnel Â· 5,200+ mÂ² Â· US$15,000,000+",
    responseTime: "â‰¤3h",
    deliveryRate: "100.0%",
    isSuper: true,
    products: [
      { id: "p1", name: "Chaussures cuir homme", image: "https://picsum.photos/100/100?random=111", price: "873 F CFA", moq: "2 piÃ¨ces (MOQ)" },
      { id: "p2", name: "Baskets sport", image: "https://picsum.photos/100/100?random=112", price: "750 F CFA", moq: "2 piÃ¨ces (MOQ)" },
      { id: "p3", name: "Chaussures luxury", image: "https://picsum.photos/100/100?random=113", price: "14 878 F CFA", moq: "1 piÃ¨ce (MOQ)" },
    ],
  },
  {
    id: "2",
    name: "Shenzhen Cms Cosmetics Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=2",
    verified: true,
    verificationLevel: "Verified 5 yrs",
    details: "20+ personnel Â· 2,300+ mÂ² Â· US$440,000+",
    responseTime: "â‰¤4h",
    deliveryRate: "99.6%",
    isSuper: true,
    products: [
      { id: "p1", name: "Pinceaux maquillage", image: "https://picsum.photos/100/100?random=121", price: "2 094 F CFA", originalPrice: "2 617 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p2", name: "Kit cosmÃ©tiques", image: "https://picsum.photos/100/100?random=122", price: "8 134 F CFA", moq: "2 jeux (MOQ)" },
      { id: "p3", name: "Outils beautÃ©", image: "https://picsum.photos/100/100?random=123", price: "1 163 F CFA", moq: "1 jeu (MOQ)" },
    ],
  },
  {
    id: "3",
    name: "Guangzhou Shiyi Watch Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=3",
    verified: true,
    verificationLevel: "Verified 8 yrs",
    details: "20+ personnel Â· 330+ mÂ² Â· US$510,000+",
    responseTime: "â‰¤1h",
    deliveryRate: "97.3%",
    isSuper: true,
    products: [
      { id: "p1", name: "Montre quartz", image: "https://picsum.photos/100/100?random=131", price: "2 335 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p2", name: "Montre connectÃ©e", image: "https://picsum.photos/100/100?random=132", price: "2 686 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p3", name: "Montre luxury", image: "https://picsum.photos/100/100?random=133", price: "1 868 F CFA", moq: "1 piÃ¨ce (MOQ)" },
    ],
  },
  {
    id: "4",
    name: "Guangzhou Shiyi Watch Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=3",
    verified: true,
    verificationLevel: "Verified 8 yrs",
    details: "20+ personnel Â· 330+ mÂ² Â· US$510,000+",
    responseTime: "â‰¤1h",
    deliveryRate: "97.3%",
    isSuper: true,
    products: [
      { id: "p1", name: "Montre quartz", image: "https://picsum.photos/100/100?random=131", price: "2 335 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p2", name: "Montre connectÃ©e", image: "https://picsum.photos/100/100?random=132", price: "2 686 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p3", name: "Montre luxury", image: "https://picsum.photos/100/100?random=133", price: "1 868 F CFA", moq: "1 piÃ¨ce (MOQ)" },
    ],
  },
  {
    id: "5",
    name: "Shenzhen Jaster Technology Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=4",
    verified: true,
    verificationLevel: "Verified 5 yrs",
    details: "60+ personnel Â· 2,300+ mÂ² Â· US$210,000+",
    responseTime: "â‰¤3h",
    deliveryRate: "99.6%",
    isSuper: true,
    isAd: true,
    products: [
      { id: "p1", name: "TÃ©lÃ©phone portable", image: "https://picsum.photos/100/100?random=141", price: "514 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p2", name: "Smartphone", image: "https://picsum.photos/100/100?random=142", price: "643 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p3", name: "Accessoire mobile", image: "https://picsum.photos/100/100?random=143", price: "374 F CFA", moq: "1 piÃ¨ce (MOQ)" },
    ],
  },
  {
    id: "6",
    name: "Guangzhou Shiyi Watch Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=3",
    verified: true,
    verificationLevel: "Verified 8 yrs",
    details: "20+ personnel Â· 330+ mÂ² Â· US$510,000+",
    responseTime: "â‰¤1h",
    deliveryRate: "97.3%",
    isSuper: true,
    products: [
      { id: "p1", name: "Montre quartz", image: "https://picsum.photos/100/100?random=131", price: "2 335 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p2", name: "Montre connectÃ©e", image: "https://picsum.photos/100/100?random=132", price: "2 686 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p3", name: "Montre luxury", image: "https://picsum.photos/100/100?random=133", price: "1 868 F CFA", moq: "1 piÃ¨ce (MOQ)" },
    ],
  },
  {
    id: "7",
    name: "Guangzhou Shiyi Watch Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=3",
    verified: true,
    verificationLevel: "Verified 8 yrs",
    details: "20+ personnel Â· 330+ mÂ² Â· US$510,000+",
    responseTime: "â‰¤1h",
    deliveryRate: "97.3%",
    isSuper: true,
    products: [
      { id: "p1", name: "Montre quartz", image: "https://picsum.photos/100/100?random=131", price: "2 335 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p2", name: "Montre connectÃ©e", image: "https://picsum.photos/100/100?random=132", price: "2 686 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p3", name: "Montre luxury", image: "https://picsum.photos/100/100?random=133", price: "1 868 F CFA", moq: "1 piÃ¨ce (MOQ)" },
    ],
  },
  {
    id: "8",
    name: "Guangzhou Shiyi Watch Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=3",
    verified: true,
    verificationLevel: "Verified 8 yrs",
    details: "20+ personnel Â· 330+ mÂ² Â· US$510,000+",
    responseTime: "â‰¤1h",
    deliveryRate: "97.3%",
    isSuper: true,
    products: [
      { id: "p1", name: "Montre quartz", image: "https://picsum.photos/100/100?random=131", price: "2 335 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p2", name: "Montre connectÃ©e", image: "https://picsum.photos/100/100?random=132", price: "2 686 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p3", name: "Montre luxury", image: "https://picsum.photos/100/100?random=133", price: "1 868 F CFA", moq: "1 piÃ¨ce (MOQ)" },
    ],
  },
  {
    id: "9",
    name: "Guangzhou Shiyi Watch Co., Ltd.",
    logo: "https://picsum.photos/50/50?random=3",
    verified: true,
    verificationLevel: "Verified 8 yrs",
    details: "20+ personnel Â· 330+ mÂ² Â· US$510,000+",
    responseTime: "â‰¤1h",
    deliveryRate: "97.3%",
    isSuper: true,
    products: [
      { id: "p1", name: "Montre quartz", image: "https://picsum.photos/100/100?random=131", price: "2 335 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p2", name: "Montre connectÃ©e", image: "https://picsum.photos/100/100?random=132", price: "2 686 F CFA", moq: "1 piÃ¨ce (MOQ)" },
      { id: "p3", name: "Montre luxury", image: "https://picsum.photos/100/100?random=133", price: "1 868 F CFA", moq: "1 piÃ¨ce (MOQ)" },
    ],
  },
  
];

const sampleProducts: Product[] = [
  { id: "1", name: "Montre connectÃ©e premium", image: "https://picsum.photos/150/150?random=51", price: "3 373 F CFA", moq: "1 piÃ¨ce (MOQ)", isSuper: true },
  { id: "2", name: "CosmÃ©tiques bio naturels", image: "https://picsum.photos/150/150?random=52", price: "2 907 F CFA", moq: "2 piÃ¨ces (MOQ)", isSuper: true },
  { id: "3", name: "Ã‰quipement sportif pro", image: "https://picsum.photos/150/150?random=53", price: "17 436 F CFA", moq: "1 piÃ¨ce (MOQ)", isSuper: true },
];

/* =========================
   Composants
   ========================= */

// Header avec recherche
const SearchHeader = () => {
  const [searchQuery, setSearchQuery] = useState("chaussures pour hommes dans ML");
  
  return (
    <View style={styles.header}>
      <Text style={styles.mainTitle}>Produits Fabricants Mondial</Text>
      
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.cameraButton}>
            <Ionicons name="camera-outline" size={22} color="#666" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Rechercher</Text>
        </TouchableOpacity>
      </View>

      {/* Onglets */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {headerTabs.map((tab) => (
          <TouchableOpacity 
            key={tab.id} 
            style={[styles.tab, tab.active && styles.activeTab]}
          >
            <Text style={[styles.tabText, tab.active && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Section Services B2B
const ServicesSection = () => (
  <View style={styles.servicesSection}>
    <Text style={styles.sectionTitle}>Services B2B</Text>
    <View style={styles.servicesGrid}>
      {quickServices.map((service, index) => (
        <TouchableOpacity key={index} style={styles.serviceItem}>
          <View style={styles.serviceIcon}>
            <Ionicons name={service.icon} size={24} color="#ff6a00" />
          </View>
          <Text style={styles.serviceLabel}>{service.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

// Section 3 rangÃ©es de 2 colonnes
const ProductsGridSection = () => (
  <View style={styles.productsGridSection}>
    <Text style={styles.sectionTitle}>Gadgets Tech & Ã‰lectronique</Text>
    
    {/* RangÃ©e 1 */}
    <View style={styles.productRow}>
      <View style={styles.productCard}>
        <Image source={{ uri: electronicProducts[0].image }} style={styles.productImage} />
        <Text style={styles.productName}>{electronicProducts[0].name}</Text>
        <Text style={styles.productPrice}>{electronicProducts[0].price}</Text>
        <Text style={styles.productMoq}>{electronicProducts[0].moq}</Text>
      </View>
      
      <View style={styles.productCard}>
        <Image source={{ uri: electronicProducts[1].image }} style={styles.productImage} />
        <Text style={styles.productName}>{electronicProducts[1].name}</Text>
        <Text style={styles.productPrice}>{electronicProducts[1].price}</Text>
        <Text style={styles.productMoq}>{electronicProducts[1].moq}</Text>
      </View>
    </View>

    {/* RangÃ©e 2 */}
    <View style={styles.productRow}>
      <View style={styles.productCard}>
        <Image source={{ uri: electronicProducts[2].image }} style={styles.productImage} />
        <Text style={styles.productName}>{electronicProducts[2].name}</Text>
        <Text style={styles.productPrice}>{electronicProducts[2].price}</Text>
        <Text style={styles.productMoq}>{electronicProducts[2].moq}</Text>
        <View style={styles.hotBadge}>
          <Text style={styles.badgeText}>Hot</Text>
        </View>
      </View>
      
      <View style={styles.productCard}>
        <Image source={{ uri: electronicProducts[3].image }} style={styles.productImage} />
        <Text style={styles.productName}>{electronicProducts[3].name}</Text>
        <View style={styles.priceContainer}>
          <Text style={styles.productPrice}>{electronicProducts[3].price}</Text>
          <Text style={styles.originalPrice}>{electronicProducts[3].originalPrice}</Text>
        </View>
        <Text style={styles.productMoq}>{electronicProducts[3].moq}</Text>
        <View style={styles.discountBadge}>
          <Text style={styles.badgeText}>-20%</Text>
        </View>
      </View>
    </View>

    {/* RangÃ©e 3 */}
    <View style={styles.productRow}>
      <View style={styles.productCard}>
        <Image source={{ uri: electronicProducts[4].image }} style={styles.productImage} />
        <Text style={styles.productName}>{electronicProducts[4].name}</Text>
        <Text style={styles.productPrice}>{electronicProducts[4].price}</Text>
        <Text style={styles.productMoq}>{electronicProducts[4].moq}</Text>
        <View style={styles.newBadge}>
          <Text style={styles.badgeText}>Nouveau</Text>
        </View>
      </View>
      
      <View style={styles.productCard}>
        <Image source={{ uri: electronicProducts[5].image }} style={styles.productImage} />
        <Text style={styles.productName}>{electronicProducts[5].name}</Text>
        <Text style={styles.productPrice}>{electronicProducts[5].price}</Text>
        <Text style={styles.productMoq}>{electronicProducts[5].moq}</Text>
      </View>
    </View>
  </View>
);

// Section Ã‰chantillons
const SamplesSection = () => (
  <View style={styles.samplesSection}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Testez des produits avec nos Ã©chantillons</Text>
      <TouchableOpacity>
        <Text style={styles.seeAllText}>Voir tout</Text>
      </TouchableOpacity>
    </View>
    
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.samplesScroll}>
      {sampleProducts.map((product) => (
        <View key={product.id} style={styles.sampleCard}>
          {product.isSuper && (
            <View style={styles.superBadge}>
              <Text style={styles.superBadgeText}>Super</Text>
            </View>
          )}
          <Image source={{ uri: product.image }} style={styles.sampleImage} />
          <Text style={styles.sampleName}>{product.name}</Text>
          <Text style={styles.samplePriceLabel}>Prix de l'Ã©chantillon : {product.price}</Text>
          <Text style={styles.sampleMoq}>{product.moq}</Text>
        </View>
      ))}
    </ScrollView>
  </View>
);

// Section Fournisseurs
const SuppliersSection = () => (
  <View style={styles.suppliersSection}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>Fabricants vÃ©rifiÃ©s</Text>
      <TouchableOpacity>
        <Text style={styles.seeAllText}>Voir tout</Text>
      </TouchableOpacity>
    </View>

    {suppliersData.map((supplier) => (
      <View key={supplier.id} style={styles.supplierCard}>
        {/* En-tÃªte du fournisseur */}
        <View style={styles.supplierHeader}>
          <View style={styles.supplierInfo}>
            {supplier.isSuper && (
              <View style={styles.superTag}>
                <Text style={styles.superTagText}>Super</Text>
              </View>
            )}
            <Text style={styles.supplierName}>{supplier.name}</Text>
            {supplier.isAd && (
              <View style={styles.adBadge}>
                <Text style={styles.adBadgeText}>Ad</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.supplierDetails}>
            {supplier.verificationLevel} Â· {supplier.details}
          </Text>
          
          <Text style={styles.supplierStats}>
            Temps de rÃ©ponse {supplier.responseTime} Â· Livraison dans les dÃ©lais {supplier.deliveryRate}
          </Text>
        </View>

        {/* Produits du fournisseur */}
        <View style={styles.supplierProducts}>
          {supplier.products.map((product, index) => (
            <View key={product.id} style={styles.supplierProduct}>
              <Image source={{ uri: product.image }} style={styles.supplierProductImage} />
              <View style={styles.supplierProductInfo}>
                <Text style={styles.supplierProductPrice}>{product.price}</Text>
                {product.originalPrice && (
                  <Text style={styles.supplierProductOriginalPrice}>{product.originalPrice}</Text>
                )}
                <Text style={styles.supplierProductMoq}>{product.moq}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    ))}
  </View>
);

/* =========================
   Ã‰cran principal
   ========================= */
export default function AlibabaScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#ff6a00" barStyle="light-content" />
      
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6a00" />
        }
      >
        {/* Header avec recherche */}
        <SearchHeader />

        {/* BanniÃ¨re promo */}
        <View style={styles.promoBanner}>
          <Text style={styles.promoText}>BÃ©nÃ©ficiez de jusqu'Ã  20% de rÃ©duction</Text>
        </View>

        {/* Services B2B */}
        <ServicesSection />

        {/* Produits en grille 3x2 */}
        <ProductsGridSection />

        {/* Ã‰chantillons */}
        <SamplesSection />

        {/* Fournisseurs */}
        <SuppliersSection />

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

/* =========================
   Styles professionnels
   ========================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  spacer: {
    height: 100,
  },

  // Header
  header: {
    backgroundColor: "#fff",
    paddingTop: Constants.statusBarHeight + 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 12,
    textAlign: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    marginRight: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 8,
    fontSize: 16,
    color: "#1a1a1a",
  },
  cameraButton: {
    padding: 4,
  },
  searchButton: {
    backgroundColor: "#ff6a00",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  tabsContainer: {
    marginHorizontal: -16,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: "#ff6a00",
  },
  tabText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  activeTabText: {
    color: "#ff6a00",
    fontWeight: "700",
  },

  // BanniÃ¨re promo
  promoBanner: {
    backgroundColor: "#ff6a00",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  promoText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  // Services B2B
  servicesSection: {
    padding: 16,
    backgroundColor: "#fafafa",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  serviceItem: {
    width: (width - 48) / 3,
    alignItems: "center",
    marginBottom: 16,
  },
  serviceIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff0e6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  serviceLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },

  // Grille produits 3x2
  productsGridSection: {
    padding: 16,
    backgroundColor: "#fff",
  },
  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  productCard: {
    width: (width - 48) / 2,
    backgroundColor: "#fafafa",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    position: "relative",
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ff6a00",
    marginBottom: 2,
  },
  productMoq: {
    fontSize: 12,
    color: "#666",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  originalPrice: {
    fontSize: 12,
    color: "#999",
    textDecorationLine: "line-through",
    marginLeft: 4,
  },

  // Badges
  discountBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#ff0000",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#00a650",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hotBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#ff6a00",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },

  // Ã‰chantillons
  samplesSection: {
    padding: 16,
    backgroundColor: "#fafafa",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  seeAllText: {
    color: "#ff6a00",
    fontWeight: "600",
    fontSize: 14,
  },
  samplesScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  sampleCard: {
    width: 160,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    alignItems: "center",
    position: "relative",
  },
  superBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#ffd700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  superBadgeText: {
    color: "#333",
    fontSize: 10,
    fontWeight: "bold",
  },
  sampleImage: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  sampleName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 4,
  },
  samplePriceLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
    textAlign: "center",
  },
  sampleMoq: {
    fontSize: 11,
    color: "#999",
  },

  // Fournisseurs
  suppliersSection: {
    padding: 16,
    backgroundColor: "#fff",
  },
  supplierCard: {
    backgroundColor: "#fafafa",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e8e8e8",
  },
  supplierHeader: {
    marginBottom: 12,
  },
  supplierInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    flexWrap: "wrap",
  },
  superTag: {
    backgroundColor: "#ffd700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  superTagText: {
    color: "#333",
    fontSize: 12,
    fontWeight: "bold",
  },
  supplierName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginRight: 8,
  },
  adBadge: {
    backgroundColor: "#ff6a00",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  supplierDetails: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  supplierStats: {
    fontSize: 13,
    color: "#00a650",
    fontWeight: "600",
  },
  supplierProducts: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  supplierProduct: {
    alignItems: "center",
    width: (width - 80) / 3,
  },
  supplierProductImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 4,
  },
  supplierProductInfo: {
    alignItems: "center",
  },
  supplierProductPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ff6a00",
    marginBottom: 2,
  },
  supplierProductOriginalPrice: {
    fontSize: 11,
    color: "#999",
    textDecorationLine: "line-through",
    marginBottom: 2,
  },
  supplierProductMoq: {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
  },
});

