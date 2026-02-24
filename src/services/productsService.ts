// screens/CategoriesScreen.tsx - VERSION CORRIGÉE
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
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { getCategories, Category } from "../services/firebase/categoriesService";
import { getProductsByCategory, Product, getAllProducts } from "../services/firebase/productsService";
import { getAllCompanies, getCompanyById, Company } from "../services/firebase/companyService";
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';

const { width } = Dimensions.get("window");

// ✅ MODIFICATION: Réorganisation du menu spécial pour mettre "Boutiques" en premier
const SPECIAL_MENU = [
  { name: "🏪 Boutiques", id: "boutiques", type: "special", icon: "storefront" },
  { name: "⭐ En vedette", id: "en-vedette", type: "special", icon: "star" },
  { name: "🔥 Offres spéciales", id: "offres-speciales", type: "special", icon: "local-fire-department" },
];

// ✅ MODIFICATION: Exclusion des catégories spécifiques
const EXCLUDED_CATEGORIES = [
  "Maison & Jardin", 
  "Électronique",
];

// ✅ NOUVEAU: Promotions en vedette pour le header
const FEATURED_PROMOTIONS = [
  { id: "1", title: "Femmes XXXL", subtitle: "Offres du nouvel an", time: "Fin: 8 janvier, 07:59 GMT+00:00", color: "#FF6B8B" },
  { id: "2", title: "Pour vous", subtitle: "Mode & Accessoires", time: "Promo spéciale", color: "#4ECDC4" },
  { id: "3", title: "Électronique", subtitle: "Smartphones & Tablettes", time: "Réductions jusqu'à -30%", color: "#45B7D1" },
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

// ✅ Fonction pour les images de catégories
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

// ✅ Fonction pour les images de boutiques
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

// ✅ Fonction pour formater la date Firebase
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

// ✅ Types
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
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const router = useRouter();

  // ✅ CORRECTION: Charger automatiquement les boutiques au démarrage
  useEffect(() => {
    let mounted = true;

    async function loadInitialData() {
      try {
        console.log("📥 Chargement initial des données...");
        
        // 1. Charger les catégories
        const cats = await getCategories();
        
        const catsWithPreview: CategoryWithPreview[] = cats.map(cat => ({
          ...cat,
          previewImage: cat.imageUrl || getCategoryImage(cat.name, cat.id),
          formattedDate: formatFirebaseDate(cat.createdAt),
          description: cat.description || "Pas de description",
          isActive: cat.isActive !== undefined ? cat.isActive : true,
          productCount: cat.productCount || 0
        }));

        // Filtrer les catégories
        const filtered = catsWithPreview.filter(cat => 
          !EXCLUDED_CATEGORIES.includes(cat.name)
        );

        // Ajouter Machine si nécessaire
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
        }

        // 2. ✅ CORRECTION IMPORTANTE: Charger automatiquement les boutiques
        await loadShops();
        
      } catch (error) {
        console.error("❌ Erreur chargement initial:", error);
        
        // Fallback
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
          // Charger les boutiques même en fallback
          await loadShops();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadInitialData();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ CHARGEMENT DES BOUTIQUES
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

  // ✅ Charger les produits en vedette
  const loadFeaturedProducts = async () => {
    setFeaturedLoading(true);
    setSelectedCategoryProducts([]);
    
    try {
      console.log('⭐ Chargement des produits en vedette...');
      
      const allProducts = await loadAllProducts();
      
      if (allProducts && allProducts.length > 0) {
        console.log(`✅ ${allProducts.length} produits chargés pour 'En vedette'`);
        setFeaturedProducts(allProducts);
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

  // ✅ Gestion des erreurs d'images
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

  // ✅ Construction du menu gauche
  const leftMenu = [...SPECIAL_MENU, ...filteredCategories.map(cat => ({
    name: cat.name,
    id: cat.id,
    type: "category" as const,
    productCount: cat.productCount,
    icon: getCategoryIcon(cat.name)
  }))];

  // ✅ Fonction pour obtenir les icônes des catégories
  function getCategoryIcon(categoryName: string): string {
    const iconMap: Record<string, string> = {
      "Mode & Accessoires": "shirt",
      "Beauté & Santé": "spa",
      "Automobile & Motos": "car",
      "Jouets & Loisirs": "toys",
      "Machine": "build",
      "Matériaux de Construction": "construction",
      "Équipements de Bureau": "business-center",
      "Articles de Fête": "cake",
      "Produits pour Animaux": "pets",
      "Sécurité & Protection": "security",
      "Produits Industriels": "factory",
    };
    return iconMap[categoryName] || "category";
  }

  // ✅ Charger les produits d'une catégorie
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

  // ✅ Gestion du clic sur le menu
  const handleMenuClick = async (index: number, item: any) => {
    setMenuIndex(index);
    
    if (item.type === "category") {
      await loadCategoryProducts(item.id, item.name);
      setFeaturedProducts([]);
    } else if (item.id === "boutiques") {
      // Boutiques déjà chargées, pas besoin de recharger
      setSelectedCategoryProducts([]);
      setFeaturedProducts([]);
    } else if (item.id === "en-vedette") {
      await loadFeaturedProducts();
      setShops([]);
    } else {
      setSelectedCategoryProducts([]);
      setFeaturedProducts([]);
    }
  };

  // ✅ NOUVEAU: Rendu du header avec promotions
  const renderPromotionsHeader = () => {
    return (
      <View style={styles.promotionsHeader}>
        <Text style={styles.promotionsTitle}>🔥 Offres spéciales</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.promotionsScroll}
        >
          {FEATURED_PROMOTIONS.map((promo) => (
            <TouchableOpacity 
              key={promo.id} 
              style={[styles.promotionCard, { backgroundColor: promo.color }]}
              onPress={() => console.log('Promotion cliquée:', promo.title)}
            >
              <View style={styles.promotionContent}>
                <Text style={styles.promotionTitle}>{promo.title}</Text>
                <Text style={styles.promotionSubtitle}>{promo.subtitle}</Text>
                <View style={styles.timeContainer}>
                  <MaterialIcons name="access-time" size={12} color="#fff" />
                  <Text style={styles.timeText}>{promo.time}</Text>
                </View>
              </View>
              <View style={styles.promotionIcon}>
                <MaterialIcons name="local-offer" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // ✅ RENDU DES BOUTIQUES - DESIGN AMÉLIORÉ
  const renderShopsSection = () => {
    if (shopsLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff6a00" />
          <Text style={styles.loadingText}>Chargement des boutiques...</Text>
        </View>
      );
    }

    if (shops.length === 0) {
      return (
        <View style={styles.emptyState}>
          <FontAwesome name="store" size={80} color="#e0e0e0" />
          <Text style={styles.emptyTitle}>Aucune boutique disponible</Text>
          <Text style={styles.emptySubtext}>
            Les boutiques seront disponibles bientôt
          </Text>
        </View>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header des boutiques */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>🏪 Nos Boutiques</Text>
            <Text style={styles.sectionSubtitle}>
              {shops.length} boutiques partenaires - Découvrez nos vendeurs
            </Text>
          </View>
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="filter" size={18} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Liste des boutiques */}
        <View style={styles.shopsGrid}>
          {shops.map((shop) => (
            <TouchableOpacity
              key={shop.id}
              style={styles.shopCard}
              onPress={() => navigateToShop(shop)}
              activeOpacity={0.8}
            >
              <View style={styles.shopImageContainer}>
                <Image
                  source={{ uri: shop.shopImage }}
                  style={styles.shopImage}
                  onError={() => handleShopImageError(shop.id, shop.name)}
                />
                <View style={[styles.shopBadge, 
                  shop.businessType === 'retail' ? styles.retailBadge :
                  shop.businessType === 'wholesale' ? styles.wholesaleBadge :
                  styles.manufacturerBadge
                ]}>
                  <Text style={styles.shopBadgeText}>
                    {shop.businessType === 'retail' ? '🏪' : 
                     shop.businessType === 'wholesale' ? '📦' : 
                     '🏭'}
                  </Text>
                </View>
                {shop.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  </View>
                )}
              </View>
              
              <View style={styles.shopInfo}>
                <Text style={styles.shopName} numberOfLines={1}>
                  {shop.name}
                </Text>
                <Text style={styles.shopType} numberOfLines={1}>
                  {shop.businessType === 'retail' ? 'Boutique de détail' : 
                   shop.businessType === 'wholesale' ? 'Grossiste' : 
                   'Fabricant'}
                </Text>
                
                <View style={styles.shopStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="cube-outline" size={12} color="#666" />
                    <Text style={styles.statText}>
                      {shop.productCount || 0} produits
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.statText}>
                      {shop.rating?.toFixed(1) || '4.5'}
                    </Text>
                  </View>
                </View>

                <View style={styles.shopTags}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      {shop.isActive ? '🟢 Ouvert' : '🔴 Fermé'}
                    </Text>
                  </View>
                  {shop.minOrder && (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>
                        Min: {shop.minOrder}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity 
                  style={styles.visitButton}
                  onPress={() => navigateToShop(shop)}
                >
                  <Text style={styles.visitButtonText}>Visiter</Text>
                  <Ionicons name="arrow-forward" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  };

  // ✅ RENDU DE LA SECTION "EN VEDETTE"
  const renderFeaturedSection = () => {
    if (featuredLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff6a00" />
          <Text style={styles.loadingText}>Chargement des produits...</Text>
        </View>
      );
    }

    if (featuredProducts.length === 0) {
      return (
        <View style={styles.emptyState}>
          <MaterialIcons name="star-border" size={80} color="#e0e0e0" />
          <Text style={styles.emptyTitle}>Aucun produit en vedette</Text>
          <Text style={styles.emptySubtext}>
            Les produits vedettes seront ajoutés prochainement
          </Text>
        </View>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>⭐ Produits en vedette</Text>
            <Text style={styles.sectionSubtitle}>
              {featuredProducts.length} produits sélectionnés pour vous
            </Text>
          </View>
          <TouchableOpacity style={styles.filterButton}>
            <Ionicons name="options" size={18} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.productsGrid}>
          {featuredProducts.map((product) => (
            <TouchableOpacity
              key={product.id}
              style={styles.productCard}
              onPress={() => navigateToCompanyProducts(product)}
              activeOpacity={0.8}
            >
              <View style={styles.productImageContainer}>
                <Image
                  source={{ uri: product.imageUrl || getCategoryImage(product.categoryName || "default") }}
                  style={styles.productImage}
                  onError={() => handleProductImageError(product.id, product.name)}
                />
                <View style={styles.productBadge}>
                  <Text style={styles.productBadgeText}>⭐</Text>
                </View>
              </View>
              
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {product.name}
                </Text>
                <Text style={styles.productDescription} numberOfLines={2}>
                  {product.description || "Produit de qualité"}
                </Text>
                
                <View style={styles.priceRow}>
                  <Text style={styles.productPrice}>
                    {product.price?.toLocaleString('fr-FR') || "0"} F CFA
                  </Text>
                  {product.originalPrice && product.price && product.originalPrice > product.price && (
                    <Text style={styles.originalPrice}>
                      {product.originalPrice.toLocaleString('fr-FR')} F CFA
                    </Text>
                  )}
                </View>

                <View style={styles.productMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="business-outline" size={12} color="#666" />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {product.companyName || "Vendeur"}
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons name="cube-outline" size={12} color="#666" />
                    <Text style={styles.metaText}>
                      {product.stockQuantity || 0} en stock
                    </Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.addToCartButton}>
                  <Ionicons name="cart-outline" size={14} color="#fff" />
                  <Text style={styles.addToCartText}>Ajouter</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  };

  // ✅ Navigation vers une boutique
  const navigateToShop = (shop: Shop) => {
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

  // ✅ Navigation vers les produits d'une entreprise
  const navigateToCompanyProducts = (product: Product) => {
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
      router.push(`/product/${product.id}`);
    }
  };

  // ✅ Navigation vers les produits d'une catégorie
  const navigateToCategoryProducts = (categoryId: string, categoryName: string) => {
    router.push({
      pathname: "/category-products",
      params: { 
        id: categoryId, 
        name: encodeURIComponent(categoryName) 
      },
    });
  };

  // ✅ ÉCRAN DE CHARGEMENT PRINCIPAL
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6a00" />
        <Text style={styles.loadingText}>Préparation des catégories...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* 📌 MENU GAUCHE - LISTE DES CATÉGORIES */}
      <View style={styles.leftCol}>
        <View style={styles.leftHeader}>
          <Text style={styles.leftTitle}>Catégories</Text>
          <TouchableOpacity style={styles.searchButton}>
            <Ionicons name="search-outline" size={18} color="#666" />
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={leftMenu}
          keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[
                styles.leftItem, 
                index === menuIndex && styles.leftItemActive,
              ]}
              onPress={() => handleMenuClick(index, item)}
              activeOpacity={0.7}
            >
              <View style={styles.leftItemContent}>
                <View style={styles.iconContainer}>
                  {item.icon ? (
                    <MaterialIcons 
                      name={item.icon} 
                      size={18} 
                      color={index === menuIndex ? "#ff6a00" : "#666"} 
                    />
                  ) : (
                    <Ionicons 
                      name={item.type === "special" ? "star-outline" : "cube-outline"} 
                      size={18} 
                      color={index === menuIndex ? "#ff6a00" : "#666"} 
                    />
                  )}
                </View>
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
              </View>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* 📦 CONTENU PRINCIPAL */}
      <View style={styles.rightCol}>
        {menuIndex === 0 ? ( // ✅ "Boutiques" - AFFICHÉ PAR DÉFAUT
          <>
            {renderPromotionsHeader()}
            {renderShopsSection()}
          </>
        ) : menuIndex === 1 ? ( // ✅ "En vedette"
          <>
            {renderPromotionsHeader()}
            {renderFeaturedSection()}
          </>
        ) : menuIndex === 2 ? ( // ✅ "Offres spéciales"
          <>
            {renderPromotionsHeader()}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>🔥 Offres spéciales</Text>
                <Text style={styles.sectionSubtitle}>
                  Promotions et réductions exclusives
                </Text>
              </View>
            </View>
            {/* Ici vous pouvez ajouter les offres spéciales */}
          </>
        ) : (
          // ✅ Catégories normales
          <>
            {renderPromotionsHeader()}
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  {leftMenu[menuIndex]?.name || "Catégorie"}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Découvrez tous nos produits dans cette catégorie
                </Text>
              </View>
              <TouchableOpacity style={styles.filterButton}>
                <Ionicons name="filter" size={18} color="#666" />
              </TouchableOpacity>
            </View>
            
            {productsLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#ff6a00" />
                <Text style={styles.loadingText}>Chargement des produits...</Text>
              </View>
            ) : selectedCategoryProducts.length > 0 ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.productsGrid}>
                  {selectedCategoryProducts.map((product) => (
                    <TouchableOpacity
                      key={product.id}
                      style={styles.productCard}
                      onPress={() => navigateToCompanyProducts(product)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.productImageContainer}>
                        <Image
                          source={{ uri: product.imageUrl || getCategoryImage(product.categoryName || "default") }}
                          style={styles.productImage}
                          onError={() => handleProductImageError(product.id, product.name)}
                        />
                        <View style={styles.categoryTag}>
                          <Text style={styles.categoryTagText}>
                            {product.categoryName}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.productInfo}>
                        <Text style={styles.productName} numberOfLines={2}>
                          {product.name}
                        </Text>
                        <Text style={styles.productDescription} numberOfLines={2}>
                          {product.description || "Produit de qualité"}
                        </Text>
                        
                        <View style={styles.priceRow}>
                          <Text style={styles.productPrice}>
                            {product.price?.toLocaleString('fr-FR') || "0"} F CFA
                          </Text>
                          {product.stockQuantity !== undefined && (
                            <View style={styles.stockBadge}>
                              <Ionicons 
                                name={product.stockQuantity > 0 ? "checkmark-circle" : "close-circle"} 
                                size={12} 
                                color={product.stockQuantity > 0 ? "#28a745" : "#dc3545"} 
                              />
                              <Text style={[
                                styles.stockText,
                                product.stockQuantity > 0 ? styles.inStock : styles.outOfStock
                              ]}>
                                {product.stockQuantity > 0 ? `${product.stockQuantity} en stock` : "Rupture"}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.productMeta}>
                          <View style={styles.metaItem}>
                            <Ionicons name="business-outline" size={12} color="#666" />
                            <Text style={styles.metaText} numberOfLines={1}>
                              {product.companyName || "Vendeur"}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity style={styles.viewButton}>
                          <Text style={styles.viewButtonText}>Voir l'entreprise</Text>
                          <Ionicons name="arrow-forward" size={14} color="#ff6a00" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons name="category" size={80} color="#e0e0e0" />
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
          </>
        )}
      </View>
    </View>
  );
}

// ✅ STYLES AMÉLIORÉS - INSPIRÉS DE LA CAPTURE
const LEFT_W = Math.min(160, Math.round(width * 0.3));
const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    flexDirection: "row", 
    backgroundColor: "#f8f9fa" 
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  center: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center",
    padding: 20,
  },
  // Styles pour le menu gauche
  leftCol: { 
    width: LEFT_W, 
    backgroundColor: "#fff",
    borderRightWidth: 1,
    borderRightColor: "#e9ecef",
  },
  leftHeader: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  leftTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#212529",
  },
  searchButton: {
    padding: 4,
  },
  leftItem: { 
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f8f9fa",
  },
  leftItemActive: { 
    backgroundColor: "#fff8f0", 
    borderLeftWidth: 4, 
    borderLeftColor: "#ff6a00",
  },
  leftItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 30,
    alignItems: "center",
    marginRight: 8,
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
  // Styles pour la colonne droite
  rightCol: { 
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  // Header des promotions
  promotionsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  promotionsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#212529",
    marginBottom: 12,
  },
  promotionsScroll: {
    marginHorizontal: -4,
  },
  promotionCard: {
    width: 200,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  promotionContent: {
    flex: 1,
  },
  promotionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  promotionSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 8,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    fontSize: 11,
    color: "#fff",
    marginLeft: 4,
    opacity: 0.9,
  },
  promotionIcon: {
    marginLeft: 12,
  },
  // Header des sections
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#212529",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6c757d",
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
  },
  // Grid des boutiques
  shopsGrid: {
    padding: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  shopCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  shopImageContainer: {
    position: "relative",
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
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  retailBadge: {
    backgroundColor: "#4ECDC4",
  },
  wholesaleBadge: {
    backgroundColor: "#45B7D1",
  },
  manufacturerBadge: {
    backgroundColor: "#FF6B8B",
  },
  shopBadgeText: {
    fontSize: 14,
    color: "#fff",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#28a745",
    width: 20,
    height: 20,
    borderRadius: 10,
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
    marginBottom: 4,
  },
  shopType: {
    fontSize: 11,
    color: "#6c757d",
    marginBottom: 8,
  },
  shopStats: {
    flexDirection: "row",
    marginBottom: 8,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  statText: {
    fontSize: 11,
    color: "#666",
    marginLeft: 4,
  },
  shopTags: {
    flexDirection: "row",
    marginBottom: 12,
  },
  tag: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  tagText: {
    fontSize: 10,
    color: "#666",
    fontWeight: "500",
  },
  visitButton: {
    backgroundColor: "#ff6a00",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 6,
  },
  visitButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginRight: 4,
  },
  // Grid des produits
  productsGrid: {
    padding: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  productCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  productImageContainer: {
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: 140,
    backgroundColor: "#f8f9fa",
  },
  productBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255, 106, 0, 0.9)",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  productBadgeText: {
    fontSize: 14,
    color: "#fff",
  },
  categoryTag: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryTagText: {
    fontSize: 10,
    color: "#fff",
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
    lineHeight: 16,
  },
  productDescription: {
    fontSize: 11,
    color: "#6c757d",
    marginBottom: 8,
    lineHeight: 14,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ff6a00",
  },
  originalPrice: {
    fontSize: 11,
    color: "#999",
    textDecorationLine: "line-through",
  },
  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  stockText: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  inStock: {
    color: "#28a745",
  },
  outOfStock: {
    color: "#dc3545",
  },
  productMeta: {
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#666",
    marginLeft: 4,
    flex: 1,
  },
  addToCartButton: {
    backgroundColor: "#ff6a00",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 6,
  },
  addToCartText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#ff6a00",
    borderRadius: 6,
  },
  viewButtonText: {
    color: "#ff6a00",
    fontSize: 12,
    fontWeight: "600",
    marginRight: 4,
  },
  // États vides
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#495057",
    marginTop: 16,
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