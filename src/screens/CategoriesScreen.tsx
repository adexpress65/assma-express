// screens/CategoriesScreen.tsx - VERSION MODIFIÉE
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { getCategories, Category } from "../services/firebase/categoriesService";
import { getProductsByCategory, Product, getAllProducts } from "../services/firebase/productsService"; // ✅ AJOUT de getAllProducts
import { getAllCompanies, getCompanyById, Company } from "../services/firebase/companyService";

const { width } = Dimensions.get("window");

// ✅ MODIFICATION DU MENU SPÉCIAL - Ajout de "Machine"
const SPECIAL_MENU = [
  { name: "🏪 Boutiques", id: "boutiques", type: "special" },
  { name: "En vedette", id: "en-vedette", type: "special" },
  { name: "Offres spéciales", id: "offres-speciales", type: "special" },
];

// ✅ AJOUT DE LA CATÉGORIE MACHINE AUX FILTRES D'EXCLUSION (à enlever si elle existe déjà)
const EXCLUDED_CATEGORIES = [
  "Maison & Jardin", 
  "Électronique",
  // "Machines Industrielles" // À RETIRER si on veut l'afficher
];

// ✅ FONCTION POUR CHARGER TOUS LES PRODUITS POUR "EN VEDETTE"
async function loadAllProducts(): Promise<Product[]> {
  try {
    console.log("📥 Chargement de tous les produits pour 'En vedette'...");
    const allProducts = await getAllProducts();
    console.log(`✅ ${allProducts.length} produits chargés pour 'En vedette'`);
    return allProducts;
  } catch (error) {
    console.error("❌ Erreur chargement produits 'En vedette':", error);
    return [];
  }
}

// ✅ Fonction pour les images de catégories - AJOUT DE LA CATÉGORIE MACHINE
function getCategoryImage(categoryName: string, categoryId?: string): string {
  const imageMap: Record<string, string> = {
    "Mode & Accessoires": "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=300&fit=crop",
    "Beauté & Santé": "https://images.unsplash.com/photo-1522338242990-e1e8f8c5c8c4?w=400&h=300&fit=crop",
    "Automobile & Motos": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=400&h=300&fit=crop",
    "Jouets & Loisirs": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&h=300&fit=crop",
    "Matériaux de Construction": "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=400&h=300&fit=crop",
    "Équipements de Bureau": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop",
    "Articles de Fête": "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=300&fit=crop",
    "Produits pour Animaux": "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&h=300&fit=crop",
    "Sécurité & Protection": "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=300&fit=crop",
    "Produits Industriels": "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=300&fit=crop",
    "Machine": "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=300&fit=crop",
    "Machines Industrielles": "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=300&fit=crop",
    "default": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop"
  };
  
  return imageMap[categoryName] || imageMap["default"];
}

// ✅ Fonction pour les images de boutiques par défaut (inchangée)
function getShopImage(shopType?: string, shopName?: string): string {
  const imageMap: Record<string, string> = {
    "retail": "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&h=300&fit=crop",
    "wholesale": "https://images.unsplash.com/photo-1583912086085-0b5c0c0b5c5a?w=400&h=300&fit=crop",
    "manufacturer": "https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=300&fit=crop",
    "service": "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop",
    "default": "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop"
  };
  
  if (shopType && imageMap[shopType]) {
    return imageMap[shopType];
  }
  
  const defaultImages = [
    "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1583912086085-0b5c0c0b5c5a?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop",
    "https://images.unsplash.com/photo-1545235617-9465d2a55698?w=400&h=300&fit=crop"
  ];
  
  if (shopName) {
    const index = shopName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % defaultImages.length;
    return defaultImages[index];
  }
  
  return imageMap["default"];
}

// ✅ Fonction pour formater la date Firebase (inchangée)
function formatFirebaseDate(timestamp: any): string {
  if (!timestamp) return "Date inconnue";
  
  try {
    if (timestamp.toDate) {
      const date = timestamp.toDate();
      return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    return "Date format inconnu";
  } catch (error) {
    console.error("Erreur formatage date:", error);
    return "Date invalide";
  }
}

// ✅ Types existants
interface CategoryWithPreview extends Category {
  previewImage: string;
  formattedDate: string;
}

interface Shop extends Company {
  type: "shop";
}

export default function CategoriesScreen() {
  const [menuIndex, setMenuIndex] = useState(0);
  const [categories, setCategories] = useState<CategoryWithPreview[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<CategoryWithPreview[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryProducts, setSelectedCategoryProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]); // ✅ NOUVEAU: Produits en vedette
  const [featuredLoading, setFeaturedLoading] = useState(false); // ✅ NOUVEAU: Loading pour en vedette
  const router = useRouter();

  // ✅ CHARGEMENT DES CATÉGORIES DEPUIS FIRESTORE - MODIFICATION POUR INCLURE MACHINE
  useEffect(() => {
    let mounted = true;

    async function loadCategories() {
      try {
        console.log("📥 Chargement des catégories depuis Firestore...");
        const cats = await getCategories();
        
        console.log(`📊 ${cats.length} catégories chargées depuis Firebase`);
        
        const catsWithPreview: CategoryWithPreview[] = cats.map(cat => ({
          ...cat,
          previewImage: cat.imageUrl || getCategoryImage(cat.name, cat.id),
          formattedDate: formatFirebaseDate(cat.createdAt),
          description: cat.description || "Pas de description",
          isActive: cat.isActive !== undefined ? cat.isActive : true,
          productCount: cat.productCount || 0
        }));

        // ✅ MODIFICATION: Filtrer les catégories mais INCLURE "Machine"
        const filtered = catsWithPreview.filter(cat => 
          !EXCLUDED_CATEGORIES.includes(cat.name)
        );

        // ✅ AJOUT MANUEL DE LA CATÉGORIE "MACHINE" SI ELLE N'EXISTE PAS
        if (!filtered.some(cat => cat.name === "Machine")) {
          const machineCategory: CategoryWithPreview = {
            id: "machine",
            name: "Machine",
            description: "Machines industrielles et équipements",
            previewImage: getCategoryImage("Machine"),
            formattedDate: new Date().toLocaleDateString('fr-FR'),
            isActive: true,
            productCount: 0,
            imageUrl: null,
            createdAt: null,
            updatedAt: null
          };
          filtered.push(machineCategory);
        }

        if (mounted) {
          setCategories(catsWithPreview);
          setFilteredCategories(filtered);
          console.log(`✅ ${filtered.length} catégories après filtrage`);
        }
      } catch (error) {
        console.error("❌ Erreur chargement catégories Firestore:", error);
        const fallbackCategories: CategoryWithPreview[] = [
          {
            id: "mode-accessoires",
            name: "Mode & Accessoires",
            description: "Vêtements, chaussures, accessoires de mode",
            imageUrl: null,
            previewImage: getCategoryImage("Mode & Accessoires"),
            isActive: true,
            productCount: 25,
            createdAt: null,
            updatedAt: null,
            formattedDate: "27 novembre 2025"
          },
          // ✅ AJOUT DE MACHINE DANS LE FALLBACK
          {
            id: "machine",
            name: "Machine",
            description: "Machines industrielles et équipements",
            previewImage: getCategoryImage("Machine"),
            isActive: true,
            productCount: 0,
            imageUrl: null,
            createdAt: null,
            updatedAt: null,
            formattedDate: "27 novembre 2025"
          }
        ];
        
        if (mounted) {
          setCategories(fallbackCategories);
          setFilteredCategories(fallbackCategories);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ CHARGEMENT DES BOUTIQUES (inchangé)
  const loadShops = async () => {
    setShopsLoading(true);
    
    try {
      console.log('🏪 Chargement des boutiques depuis Firestore...');
      
      const companies = await getAllCompanies();
      
      console.log(`✅ ${companies.length} entreprises réelles chargées`);
      
      if (companies.length === 0) {
        console.log('ℹ️ Aucune entreprise trouvée dans la base');
        setShops([]);
        return;
      }
      
      const shopsData: Shop[] = companies.map(company => ({
        ...company,
        type: "shop" as const,
        productCount: company.productCount || 0,
        shopImage: company.logo || getShopImage(company.businessType, company.name),
        formattedDescription: company.description || 
          `Entreprise ${company.businessType || 'commerciale'}`
      }));
      
      setShops(shopsData);
      console.log(`🏪 ${shopsData.length} boutiques disponibles`);
      
    } catch (error) {
      console.error('❌ Erreur chargement boutiques:', error);
      setShops([]);
      
    } finally {
      setShopsLoading(false);
    }
  };

  // ✅ NOUVELLE FONCTION: Charger tous les produits pour "En vedette"
  const loadFeaturedProducts = async () => {
    setFeaturedLoading(true);
    setSelectedCategoryProducts([]);
    
    try {
      console.log('⭐ Chargement des produits en vedette...');
      
      const allProducts = await loadAllProducts();
      
      if (allProducts && allProducts.length > 0) {
        console.log(`✅ ${allProducts.length} produits chargés pour 'En vedette'`);
        setFeaturedProducts(allProducts);
        
        // Pour compatibilité avec le code existant
        setSelectedCategoryProducts(allProducts);
      } else {
        console.log('ℹ️ Aucun produit trouvé pour "En vedette"');
        setFeaturedProducts([]);
        setSelectedCategoryProducts([]);
      }
    } catch (error) {
      console.error('❌ Erreur chargement produits en vedette:', error);
      setFeaturedProducts([]);
      setSelectedCategoryProducts([]);
    } finally {
      setFeaturedLoading(false);
    }
  };

  // ✅ Fonctions existantes inchangées
  const handleCategoryImageError = (categoryId: string, categoryName: string) => {
    console.log(`🔄 Fallback image catégorie pour: ${categoryName}`);
    
    setFilteredCategories(prev => prev.map(cat => 
      cat.id === categoryId 
        ? { ...cat, previewImage: getCategoryImage(categoryName, categoryId) }
        : cat
    ));
  };

  const handleProductImageError = (productId: string, productName: string) => {
    console.log(`🔄 Fallback image produit pour: ${productName}`);
    
    setSelectedCategoryProducts(prev => prev.map(product => 
      product.id === productId 
        ? { 
            ...product, 
            imageUrl: `https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop`
          }
        : product
    ));
  };

  const handleShopImageError = (shopId: string, shopName: string) => {
    console.log(`🔄 Fallback image boutique pour: ${shopName}`);
    
    setShops(prev => prev.map(shop => 
      shop.id === shopId 
        ? { 
            ...shop, 
            shopImage: getShopImage(shop.businessType, shop.name)
          }
        : shop
    ));
  };

  // ✅ Construction du menu gauche avec la catégorie Machine
  const leftMenu = [...SPECIAL_MENU, ...filteredCategories.map(cat => ({
    name: cat.name,
    id: cat.id,
    type: "category" as const,
    productCount: cat.productCount
  }))];

  // ✅ CHARGEMENT DES PRODUITS D'UNE CATÉGORIE (inchangé)
  const loadCategoryProducts = async (categoryId: string, categoryName: string) => {
    setProductsLoading(true);
    setSelectedCategoryProducts([]);
    setFeaturedProducts([]);
    
    try {
      console.log(`📥 Chargement produits pour catégorie: ${categoryName} (${categoryId})`);
      
      const products = await getProductsByCategory(categoryId);
      
      if (products && products.length > 0) {
        console.log(`✅ ${products.length} produits chargés pour ${categoryName}`);
        setSelectedCategoryProducts(products);
      } else {
        console.log(`ℹ️ Aucun produit trouvé pour ${categoryName}, affichage d'un exemple`);
        
        const mockProducts: Product[] = [
          {
            id: `mock-${categoryId}-1`,
            name: `Produit exemple ${categoryName}`,
            description: `Un produit de qualité dans la catégorie ${categoryName}`,
            price: 14990,
            imageUrl: getCategoryImage(categoryName, categoryId),
            companyId: "QJEMuZPjssOv4bxYTS9PJCpmWk82",
            companyName: "Tidio",
            categoryId: categoryId,
            categoryName: categoryName,
            sellerId: "mock-seller",
            sellerName: "Vendeur Partenaire",
            stockQuantity: 10,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];
        
        setSelectedCategoryProducts(mockProducts);
      }
    } catch (error) {
      console.error(`❌ Erreur chargement produits pour ${categoryName}:`, error);
      
      const fallbackProduct: Product = {
        id: `fallback-${categoryId}`,
        name: `Produit ${categoryName}`,
        description: `Découvrez notre sélection de produits ${categoryName.toLowerCase()}`,
        price: 9990,
        imageUrl: getCategoryImage(categoryName, categoryId),
        companyId: "EHhsm0tVmxOjLpX3ejKivuBjoT62",
        companyName: "Entreprise Exemple",
        categoryId: categoryId,
        categoryName: categoryName,
        sellerId: "default-seller",
        sellerName: "Fournisseur Officiel",
        stockQuantity: 5,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      setSelectedCategoryProducts([fallbackProduct]);
    } finally {
      setProductsLoading(false);
    }
  };

  // ✅ MODIFICATION: Gestion du clic sur le menu
  const handleMenuClick = async (index: number, item: any) => {
    setMenuIndex(index);
    
    if (item.type === "category") {
      await loadCategoryProducts(item.id, item.name);
      setFeaturedProducts([]);
    } else if (item.id === "boutiques") {
      await loadShops();
      setSelectedCategoryProducts([]);
      setFeaturedProducts([]);
    } else if (item.id === "en-vedette") {
      // ✅ CHARGEMENT DE TOUS LES PRODUITS POUR "EN VEDETTE"
      await loadFeaturedProducts();
      setShops([]);
    } else {
      setSelectedCategoryProducts([]);
      setFeaturedProducts([]);
    }
  };

  // ✅ RENDU DE LA SECTION "EN VEDETTE"
  const renderFeaturedSection = () => {
    if (featuredLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff6a00" />
          <Text style={styles.loadingText}>Chargement des produits...</Text>
          <Text style={styles.loadingSubtext}>Récupération de tous les produits</Text>
        </View>
      );
    }

    if (featuredProducts.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/4076/4076506.png' }}
            style={styles.emptyImage}
          />
          <Text style={styles.emptyTitle}>Aucun produit disponible</Text>
          <Text style={styles.emptySubtext}>
            Les produits seront ajoutés prochainement
          </Text>
        </View>
      );
    }

    return (
      <>
        <View style={styles.headerContainer}>
          <Text style={styles.rightTitle}>Tous nos produits</Text>
          <Text style={styles.categoryCount}>
            {featuredProducts.length} produits disponibles
          </Text>
          <Text style={styles.featuredHint}>
            ⭐ Tous les produits de notre plateforme avec leurs entreprises
          </Text>
        </View>
        
        <FlatList
          data={featuredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.productsGrid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.productCard}
              onPress={() => navigateToCompanyProducts(item)}
              activeOpacity={0.8}
            >
              <View style={styles.productHeader}>
                <Image
                  source={{ uri: item.imageUrl || getCategoryImage(item.categoryName || "default") }}
                  style={styles.productImage}
                  onError={() => handleProductImageError(item.id, item.name)}
                />
                {item.companyName && (
                  <View style={styles.companyTag}>
                    <Text style={styles.companyTagText} numberOfLines={1}>
                      {item.companyName}
                    </Text>
                  </View>
                )}
                {item.categoryName && (
                  <View style={styles.categoryTag}>
                    <Text style={styles.categoryTagText} numberOfLines={1}>
                      {item.categoryName}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.productDescription} numberOfLines={2}>
                  {item.description || "Produit de qualité"}
                </Text>
                <Text style={styles.productPrice}>
                  {item.price?.toLocaleString('fr-FR') || "0"} F CFA
                </Text>
                {item.stockQuantity !== undefined && (
                  <View style={styles.stockContainer}>
                    <View style={[
                      styles.stockDot,
                      item.stockQuantity > 0 ? styles.inStockDot : styles.outOfStockDot
                    ]} />
                    <Text style={[
                      styles.stockStatus,
                      item.stockQuantity > 0 ? styles.inStock : styles.outOfStock
                    ]}>
                      {item.stockQuantity > 0 ? `${item.stockQuantity} en stock` : "Rupture"}
                    </Text>
                  </View>
                )}
                <View style={styles.companyInfo}>
                  <Text style={styles.companyInfoText}>
                    Entreprise: {item.companyName || "Non spécifiée"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </>
    );
  };

  // ✅ Reste des fonctions existantes inchangées
  const navigateToCategoryProducts = (categoryId: string, categoryName: string) => {
    router.push({
      pathname: "/category-products",
      params: { 
        id: categoryId, 
        name: encodeURIComponent(categoryName) 
      },
    });
  };

  const navigateToShop = (shop: Shop) => {
    console.log('🏪 Navigation vers boutique:', {
      shopId: shop.id,
      shopName: shop.name,
      productCount: shop.productCount
    });
    
    router.push({
      pathname: `/store/${shop.id}`,
      params: { 
        name: encodeURIComponent(shop.name),
        description: encodeURIComponent(shop.description || ''),
        logo: encodeURIComponent(shop.logo || ''),
        fromCategories: "true"
      },
    });
  };

  const navigateToCompanyProducts = (product: Product) => {
    console.log('🏪 Navigation vers boutique avec produit présélectionné:', {
      productId: product.id,
      productName: product.name,
      companyId: product.companyId,
      companyName: product.companyName
    });
    
    if (product.companyId && product.companyName) {
      router.push({
        pathname: `/store/${product.companyId}`,
        params: { 
          name: encodeURIComponent(product.companyName),
          preselectedProductId: product.id,
          productName: encodeURIComponent(product.name),
          productPrice: product.price?.toString() || '0',
          productImage: encodeURIComponent(product.imageUrl || ''),
          fromCategory: "true"
        },
      });
    } else {
      console.log('⚠️ Pas d\'entreprise associée, navigation directe vers produit');
      router.push(`/product/${product.id}`);
    }
  };

  // ✅ RENDU DES BOUTIQUES (inchangé)
  const renderShopsSection = () => {
    if (shopsLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff6a00" />
          <Text style={styles.loadingText}>Chargement des boutiques...</Text>
          <Text style={styles.loadingSubtext}>Connexion à Firestore</Text>
        </View>
      );
    }

    if (shops.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Image 
            source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3637/3637732.png' }}
            style={styles.emptyImage}
          />
          <Text style={styles.emptyTitle}>Aucune boutique disponible</Text>
          <Text style={styles.emptySubtext}>
            Les boutiques seront disponibles bientôt
          </Text>
          <TouchableOpacity 
            style={styles.browseButton}
            onPress={() => setMenuIndex(1)}
          >
            <Text style={styles.browseButtonText}>Voir les catégories</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        <View style={styles.headerContainer}>
          <Text style={styles.rightTitle}>Nos Boutiques</Text>
          <Text style={styles.categoryCount}>
            {shops.length} boutiques partenaires
          </Text>
        </View>
        
        <FlatList
          data={shops}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.categoriesGrid}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.shopCard}
              onPress={() => navigateToShop(item)}
              activeOpacity={0.8}
            >
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: item.shopImage }}
                  style={styles.shopImage}
                  resizeMode="cover"
                  onError={() => handleShopImageError(item.id, item.name)}
                />
                <View style={styles.shopBadge}>
                  <Text style={styles.shopBadgeText}>
                    {item.businessType === 'retail' ? '🏪' : 
                     item.businessType === 'wholesale' ? '📦' : 
                     item.businessType === 'manufacturer' ? '🏭' : '🏢'}
                  </Text>
                </View>
                {item.isActive === false && (
                  <View style={styles.inactiveOverlay}>
                    <Text style={styles.inactiveText}>Fermé</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.shopInfo}>
                <Text numberOfLines={2} style={styles.shopName}>
                  {item.name}
                </Text>
                <Text style={styles.shopType}>
                  {item.businessType === 'retail' ? 'Boutique de détail' : 
                   item.businessType === 'wholesale' ? 'Grossiste' : 
                   item.businessType === 'manufacturer' ? 'Fabricant' : 'Service'}
                </Text>
                <Text style={styles.shopDescription} numberOfLines={2}>
                  {item.formattedDescription}
                </Text>
                {item.productCount > 0 && (
                  <Text style={styles.productCount}>
                    {item.productCount} produit{item.productCount > 1 ? 's' : ''}
                  </Text>
                )}
                <View style={styles.cardFooter}>
                  <Text style={styles.previewLink}>
                    Visiter la boutique
                  </Text>
                  <Text style={styles.arrow}>→</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      </>
    );
  };

  // ✅ ÉCRAN DE CHARGEMENT PRINCIPAL (inchangé)
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6a00" />
        <Text style={styles.loadingText}>Chargement des catégories...</Text>
        <Text style={styles.loadingSubtext}>Connexion à Firebase</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* 📌 MENU GAUCHE - LISTE DES CATÉGORIES */}
      <View style={styles.leftCol}>
        <FlatList
          data={leftMenu}
          keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[
                styles.leftItem, 
                index === menuIndex && styles.leftItemActive,
                item.type === "category" && styles.categoryItem
              ]}
              onPress={() => handleMenuClick(index, item)}
              activeOpacity={0.7}
            >
              <View style={styles.leftItemContent}>
                <Text
                  style={[
                    styles.leftText, 
                    index === menuIndex && styles.leftTextActive
                  ]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                {item.type === "category" && item.productCount > 0 && (
                  <Text style={styles.productCountBadge}>
                    {item.productCount}
                  </Text>
                )}
                {item.id === "en-vedette" && featuredProducts.length > 0 && (
                  <Text style={styles.featuredBadge}>
                    {featuredProducts.length}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* 📦 CONTENU PRINCIPAL */}
      <View style={styles.rightCol}>
        {menuIndex === 0 ? ( // ✅ "Boutiques" est sélectionné
          renderShopsSection()
        ) : menuIndex === 1 ? ( // ✅ "En vedette" est sélectionné
          renderFeaturedSection()
        ) : menuIndex === 2 ? (
          // AFFICHAGE DES RECOMMANDATIONS (Offres spéciales)
          <>
            <View style={styles.headerContainer}>
              <Text style={styles.rightTitle}>Nos Catégories</Text>
              <Text style={styles.categoryCount}>
                {filteredCategories.length} catégories disponibles
              </Text>
            </View>
            
            {filteredCategories.length === 0 ? (
              <View style={styles.emptyState}>
                <Image 
                  source={{ uri: 'https://cdn-icons-png.flaticon.com/512/4076/4076506.png' }}
                  style={styles.emptyImage}
                />
                <Text style={styles.emptyTitle}>Aucune catégorie disponible</Text>
                <Text style={styles.emptySubtext}>
                  Les catégories seront bientôt ajoutées
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredCategories}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={styles.categoriesGrid}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.previewCard}
                    onPress={() => navigateToCategoryProducts(item.id, item.name)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.imageContainer}>
                      <Image
                        source={{ uri: item.previewImage }}
                        style={styles.previewImage}
                        resizeMode="cover"
                        onError={() => handleCategoryImageError(item.id, item.name)}
                      />
                      {item.isActive === false && (
                        <View style={styles.inactiveBadge}>
                          <Text style={styles.inactiveText}>Inactif</Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.categoryInfo}>
                      <Text numberOfLines={2} style={styles.previewName}>
                        {item.name}
                      </Text>
                      {item.productCount > 0 && (
                        <Text style={styles.productCount}>
                          {item.productCount} produit{item.productCount > 1 ? 's' : ''}
                        </Text>
                      )}
                      <Text style={styles.previewDescription} numberOfLines={2}>
                        {item.description}
                      </Text>
                      <View style={styles.cardFooter}>
                        <Text style={styles.previewLink}>
                          Voir produits
                        </Text>
                        {item.productCount > 0 && (
                          <Text style={styles.arrow}>→</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        ) : productsLoading ? (
          // CHARGEMENT DES PRODUITS D'UNE CATÉGORIE
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#ff6a00" />
            <Text style={styles.loadingText}>Chargement des produits...</Text>
          </View>
        ) : selectedCategoryProducts.length > 0 ? (
          // LISTE DES PRODUITS DE LA CATÉGORIE SÉLECTIONNÉE
          <FlatList
            data={selectedCategoryProducts}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.productsGrid}
            ListHeaderComponent={() => (
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>
                  {leftMenu[menuIndex]?.name || "Catégorie"}
                </Text>
                <Text style={styles.productTotal}>
                  {selectedCategoryProducts.length} produit{selectedCategoryProducts.length > 1 ? 's' : ''} disponible{selectedCategoryProducts.length > 1 ? 's' : ''}
                </Text>
                <Text style={styles.navigationHint}>
                  👆 Cliquez sur un produit pour voir l'entreprise et tous ses produits
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.productCard}
                onPress={() => navigateToCompanyProducts(item)}
                activeOpacity={0.8}
              >
                <View style={styles.productHeader}>
                  <Image
                    source={{ uri: item.imageUrl || getCategoryImage(item.categoryName || "default") }}
                    style={styles.productImage}
                    onError={() => handleProductImageError(item.id, item.name)}
                  />
                  {item.companyName && (
                    <View style={styles.companyTag}>
                      <Text style={styles.companyTagText} numberOfLines={1}>
                        {item.companyName}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.productDescription} numberOfLines={2}>
                    {item.description || "Produit de qualité"}
                  </Text>
                  <Text style={styles.productPrice}>
                    {item.price?.toLocaleString('fr-FR') || "0"} F CFA
                  </Text>
                  {item.stockQuantity !== undefined && (
                    <View style={styles.stockContainer}>
                      <View style={[
                        styles.stockDot,
                        item.stockQuantity > 0 ? styles.inStockDot : styles.outOfStockDot
                      ]} />
                      <Text style={[
                        styles.stockStatus,
                        item.stockQuantity > 0 ? styles.inStock : styles.outOfStock
                      ]}>
                        {item.stockQuantity > 0 ? `${item.stockQuantity} en stock` : "Rupture"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.companyInfo}>
                    <Text style={styles.companyInfoText}>
                      Vendu par: {item.companyName || "Entreprise partenaire"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        ) : (
          // AUCUN PRODUIT DANS LA CATÉGORIE
          <View style={styles.emptyState}>
            <Image 
              source={{ uri: 'https://cdn-icons-png.flaticon.com/512/4076/4076506.png' }}
              style={styles.emptyImage}
            />
            <Text style={styles.emptyTitle}>Aucun produit disponible</Text>
            <Text style={styles.emptySubtext}>
              Cette catégorie ne contient pas encore de produits
            </Text>
            <TouchableOpacity 
              style={styles.browseButton}
              onPress={() => setMenuIndex(0)}
            >
              <Text style={styles.browseButtonText}>Parcourir les boutiques</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ✅ STYLES - AJOUT DES NOUVEAUX STYLES
const LEFT_W = Math.min(140, Math.round(width * 0.3));
const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    flexDirection: "row", 
    backgroundColor: "#fff" 
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
  },
  center: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center" 
  },
  leftCol: { 
    width: LEFT_W, 
    backgroundColor: "#f8f9fa",
    borderRightWidth: 1,
    borderRightColor: "#e9ecef",
  },
  leftItem: { 
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  leftItemActive: { 
    backgroundColor: "#fff", 
    borderLeftWidth: 4, 
    borderLeftColor: "#ff6a00",
  },
  categoryItem: {
    paddingLeft: 16,
  },
  leftItemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftText: { 
    fontSize: 13, 
    color: "#495057",
    flex: 1,
    fontFamily: "System",
  },
  leftTextActive: { 
    color: "#ff6a00", 
    fontWeight: "600",
  },
  productCountBadge: {
    backgroundColor: "#e9ecef",
    color: "#6c757d",
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  featuredBadge: {
    backgroundColor: "#ff6a00",
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  rightCol: { 
    flex: 1,
    backgroundColor: "#fff",
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  rightTitle: { 
    fontSize: 20, 
    fontWeight: "700", 
    color: "#212529",
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 14,
    color: "#6c757d",
  },
  featuredHint: {
    fontSize: 12,
    color: "#ff6a00",
    marginTop: 4,
    fontStyle: "italic",
  },
  columnWrapper: {
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  categoriesGrid: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  productsGrid: {
    paddingTop: 0,
    paddingBottom: 20,
  },
  // Styles pour les boutiques
  shopCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  shopImage: {
    width: "100%",
    height: 120,
    backgroundColor: "#f8f9fa",
  },
  shopBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255, 106, 0, 0.9)",
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  shopBadgeText: {
    fontSize: 14,
  },
  inactiveOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  shopInfo: {
    padding: 12,
  },
  shopName: { 
    fontSize: 14, 
    fontWeight: "600", 
    color: "#212529",
    marginBottom: 2,
  },
  shopType: {
    fontSize: 11,
    color: "#ff6a00",
    fontWeight: "600",
    marginBottom: 4,
  },
  shopDescription: {
    fontSize: 12,
    color: "#6c757d",
    marginBottom: 8,
    lineHeight: 16,
  },
  // Styles existants
  previewCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  imageContainer: {
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: 120,
    backgroundColor: "#f8f9fa",
  },
  inactiveBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(108, 117, 125, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  inactiveText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  categoryInfo: {
    padding: 12,
  },
  previewName: { 
    fontSize: 14, 
    fontWeight: "600", 
    color: "#212529",
    marginBottom: 4,
  },
  previewDescription: {
    fontSize: 12,
    color: "#6c757d",
    marginBottom: 8,
    lineHeight: 16,
  },
  productCount: {
    fontSize: 11,
    color: "#ff6a00",
    fontWeight: "600",
    marginBottom: 4,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  previewLink: { 
    fontSize: 12, 
    color: "#ff6a00", 
    fontWeight: "600",
  },
  arrow: {
    fontSize: 12,
    color: "#ff6a00",
    fontWeight: "600",
  },
  categoryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212529",
    marginBottom: 4,
  },
  productTotal: {
    fontSize: 14,
    color: "#6c757d",
    marginBottom: 8,
  },
  navigationHint: {
    fontSize: 12,
    color: "#ff6a00",
    fontStyle: "italic",
    marginTop: 4,
  },
  productCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  productHeader: {
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: 120,
    backgroundColor: "#f8f9fa",
  },
  companyTag: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(255, 106, 0, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    maxWidth: "90%",
  },
  categoryTag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(108, 117, 125, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    maxWidth: "90%",
  },
  companyTagText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  categoryTagText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  productInfo: {
    padding: 12,
  },
  productName: { 
    fontSize: 13, 
    fontWeight: "600", 
    color: "#212529",
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 11,
    color: "#6c757d",
    marginBottom: 8,
    lineHeight: 14,
  },
  productPrice: { 
    fontSize: 14, 
    fontWeight: "700", 
    color: "#ff6a00",
    marginBottom: 4,
  },
  stockContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  inStockDot: {
    backgroundColor: "#28a745",
  },
  outOfStockDot: {
    backgroundColor: "#dc3545",
  },
  stockStatus: {
    fontSize: 11,
    fontWeight: "600",
  },
  inStock: {
    color: "#28a745",
  },
  outOfStock: {
    color: "#dc3545",
  },
  companyInfo: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  companyInfoText: {
    fontSize: 10,
    color: "#666",
    fontStyle: "italic",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  emptyImage: {
    width: 120,
    height: 120,
    marginBottom: 24,
    opacity: 0.6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#495057",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#6c757d",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  browseButton: {
    backgroundColor: "#ff6a00",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});