// screens/CategoriesScreen.tsx - CODE COMPLET
import React, { useEffect, useState, useRef } from "react";
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
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { getCategories, Category } from "../services/firebase/categoriesService";
import { useTranslation } from "react-i18next";
import {
  getProductsByCategory,
  Product,
  getAllProducts,
} from "../services/firebase/productsService";
import { getAllCompanies, Company } from "../services/firebase/companyService";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../contexts/CartContext";

const { width } = Dimensions.get("window");

// ============= FONCTIONS EXISTANTES =============
const formatPrice = (price: any): string => {
  if (price === null || price === undefined || price === "") {
    return "Prix sur demande";
  }
  
  const numPrice = Number(price);
  
  if (isNaN(numPrice) || !isFinite(numPrice)) {
    return "Prix sur demande";
  }
  
  const roundedPrice = Math.round(numPrice);
  
  return `${roundedPrice.toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  })} F CFA`;
};

const HEADER_PROMOTIONS = (t: any) => [
  {
    id: "materiel-usine",
    title: t("categories.headerPromotions.factoryEquipment.title"),
    subtitle: t("categories.headerPromotions.factoryEquipment.subtitle"),
    time: t("categories.headerPromotions.limitedStock"),
    color: "#4ECDC4",
    categoryId: "machine",
    action: "category",
    icon: "construct" as const,
  },
  {
    id: "produits-featured",
    title: t("categories.headerPromotions.featuredProducts.title"),
    subtitle: t("categories.headerPromotions.featuredProducts.subtitle"),
    time: t("categories.headerPromotions.topSales"),
    color: "#FF6B8B",
    categoryId: "en-vedette",
    action: "special",
    icon: "star" as const,
  },
  {
    id: "mode-accessoires",
    title: t("categories.headerPromotions.fashionAccessories.title"),
    subtitle: t("categories.headerPromotions.fashionAccessories.subtitle"),
    time: t("categories.headerPromotions.fastDelivery"),
    color: "#45B7D1",
    categoryId: "mode-accessoires",
    action: "category",
    icon: "shirt" as const,
  },
  {
    id: "beaute-sante",
    title: t("categories.headerPromotions.beautyHealth.title"),
    subtitle: t("categories.headerPromotions.beautyHealth.subtitle"),
    time: t("categories.headerPromotions.qualityGuaranteed"),
    color: "#96CEB4",
    categoryId: "beaute-sante",
    action: "category",
    icon: "heart" as const,
  },
  {
    id: "automobile",
    title: t("categories.headerPromotions.automotive.title"),
    subtitle: t("categories.headerPromotions.automotive.subtitle"),
    time: t("categories.headerPromotions.competitivePrices"),
    color: "#FFD166",
    categoryId: "automobile",
    action: "category",
    icon: "car" as const,
  },
];

const SPECIAL_MENU = (t: any) => [
  {
    name: t("categories.specialMenu.shops"),
    id: "boutiques",
    type: "special" as const,
    icon: "storefront" as const,
  },
  {
    name: t("categories.specialMenu.featured"),
    id: "en-vedette",
    type: "special" as const,
    icon: "star" as const,
  },
  {
    name: t("categories.specialMenu.newArrivals"),
    id: "nouveautes",
    type: "special" as const,
    icon: "cube" as const,
  },
];

const PRODUCTS_SECTION_TITLE = (t: any) => t("categories.popularProductsTitle");
const EXCLUDED_CATEGORIES = ["Maison & Jardin", "Électronique", "Vêtements", "Chaussures", "Sacs", "Machine"];

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
    default: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop",
  };
  return imageMap[categoryName] || imageMap.default;
}

function getCategoryIcon(categoryName: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    "Mode & Accessoires": "shirt",
    "Beauté & Santé": "heart",
    "Automobile & Motos": "car",
    "Jouets & Loisirs": "game-controller",
    "Matériaux de Construction": "construct",
    "Équipements de Bureau": "business",
    "Articles de Fête": "gift",
    "Produits pour Animaux": "paw",
    "Sécurité & Protection": "shield-checkmark",
    "Produits Industriels": "build",
    "Maison & Jardin": "home",
    "Électronique": "hardware-chip",
    "Vêtements": "shirt",
    "Chaussures": "footsteps",
    "Sacs": "bag",
    "Machine": "construct",
  };
  return map[categoryName] || "grid";
}

interface CategoryWithPreview extends Category {
  previewImage: string;
  formattedDate: string;
}

interface Shop extends Company {
  type: "shop";
  shopImage?: string;
  productCount?: number;
}

interface MenuItem {
  name: string;
  id: string;
  type: "category" | "special";
  productCount?: number;
  icon: keyof typeof Ionicons.glyphMap;
}

// ============= COMPOSANTS UI ALIEXPRESS STYLE =============

interface CategoryCardProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  isActive?: boolean;
  onPress: () => void;
  productCount?: number;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  title,
  icon,
  isActive = false,
  onPress,
  productCount,
}) => (
  <TouchableOpacity
    style={styles.categoryCard}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.categoryIconContainer, isActive && styles.categoryIconContainerActive]}>
      <Ionicons 
        name={icon} 
        size={20}
        color={isActive ? "#ff6a00" : "#666"} 
      />
    </View>
    <Text style={[styles.categoryTitle, isActive && styles.categoryTitleActive]} numberOfLines={2}>
      {title}
    </Text>
  </TouchableOpacity>
);

interface PromotionCardProps {
  title: string;
  subtitle: string;
  time: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

const PromotionCard: React.FC<PromotionCardProps> = ({
  title,
  subtitle,
  time,
  color,
  icon,
  onPress,
}) => (
  <TouchableOpacity
    style={[styles.promotionCard, { backgroundColor: color }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={styles.promotionIconContainer}>
      <Ionicons name={icon} size={24} color="#fff" />
    </View>
    <View style={styles.promotionContent}>
      <Text style={styles.promotionTitle}>{title}</Text>
      <Text style={styles.promotionSubtitle}>{subtitle}</Text>
      <View style={styles.timeContainer}>
        <Ionicons name="time-outline" size={10} color="#fff" />
        <Text style={styles.timeText}>{time}</Text>
      </View>
    </View>
  </TouchableOpacity>
);

interface ProductCardProps {
  product: Product;
  onPress: () => void;
  onAddToCart: (e: any) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPress,
  onAddToCart,
}) => {
  const getProductImage = () => {
    return product.mainImage || 
           product.imageUrl || 
           product.thumbnail || 
           getCategoryImage(product.categoryName || "default");
  };

  return (
    <TouchableOpacity
      style={styles.productCard}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.productImageContainer}>
        <Image
          source={{ uri: getProductImage() }}
          style={styles.productImage}
        />
        {product.featured && (
          <View style={styles.featuredBadge}>
            <Ionicons name="star" size={10} color="#fff" />
          </View>
        )}
        <TouchableOpacity
          style={styles.addToCartButton}
          onPress={onAddToCart}
        >
          <Ionicons name="cart-outline" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.productPrice}>
          {formatPrice(product.price)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

interface ShopCardProps {
  shop: Shop;
  onPress: () => void;
}

const ShopCard: React.FC<ShopCardProps> = ({ shop, onPress }) => {
  const getShopImage = () => {
    return shop.shopImage || shop.logo || "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&h=300&fit=crop";
  };

  const productCount = shop.productCount || 0;
  const rating = shop.rating || 0;

  return (
    <TouchableOpacity
      style={styles.shopCard}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.shopImageContainer}>
        <Image
          source={{ uri: getShopImage() }}
          style={styles.shopImage}
          resizeMode="cover"
        />
        {shop.verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        )}
      </View>
      
      <View style={styles.shopInfo}>
        <Text style={styles.shopName} numberOfLines={1}>
          {shop.name || "Boutique"}
        </Text>
        
        <View style={styles.shopStats}>
          <View style={styles.statItem}>
            <Ionicons name="cube-outline" size={10} color="#6c757d" />
            <Text style={styles.statText}>{productCount}</Text>
          </View>
          
          {rating > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="star" size={10} color="#FFD700" />
              <Text style={styles.statText}>{rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

interface DiscoverProductCardProps {
  product: Product;
  onPress: () => void;
  onAddToCart: (e: any) => void;
}

const DiscoverProductCard: React.FC<DiscoverProductCardProps> = ({
  product,
  onPress,
  onAddToCart,
}) => (
  <TouchableOpacity
    style={styles.discoverProductCard}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Image
      source={{ uri: product.mainImage || product.imageUrl || product.thumbnail || getCategoryImage(product.categoryName || "default") }}
      style={styles.discoverProductImage}
    />
    <View style={styles.discoverProductInfo}>
      <Text style={styles.discoverProductTitle} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={styles.discoverProductPrice}>
        {formatPrice(product.price)}
      </Text>
    </View>
  </TouchableOpacity>
);

// ============= COMPOSANT PRINCIPAL =============

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { addToCart } = useCart();
  const scrollViewRef = useRef<ScrollView>(null);
  
  // États
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
  const [newProducts, setNewProducts] = useState<Product[]>([]);
  const [newProductsLoading, setNewProductsLoading] = useState(false);
  const [discoverProducts, setDiscoverProducts] = useState<Product[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [currentPromotionIndex, setCurrentPromotionIndex] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Effets
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPromotionIndex((prev) => {
        const next = (prev + 1) % HEADER_PROMOTIONS(t).length;
        scrollViewRef.current?.scrollTo({ x: next * 180, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [t]);

  useEffect(() => {
    let mounted = true;
    async function loadInitialData() {
      try {
        const cats = await getCategories();
        const catsWithPreview: CategoryWithPreview[] = cats.map((cat) => ({
          ...cat,
          previewImage: cat.imageUrl || getCategoryImage(cat.name, cat.id),
          description: cat.description || t("categories.noDescription"),
          isActive: cat.isActive ?? true,
          productCount: cat.productCount || 0,
          formattedDate: new Date().toLocaleDateString(),
        }));

        const finalCats = catsWithPreview.filter((c) => 
          !EXCLUDED_CATEGORIES.includes(c.name)
        );

        if (mounted) {
          setCategories(catsWithPreview);
          setFilteredCategories(finalCats);
        }

        await loadShops();
        await loadDiscoverProducts();
      } catch (e) {
        console.error("Erreur lors du chargement initial:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadInitialData();
    return () => {
      mounted = false;
    };
  }, [t]);

  const loadShops = async () => {
    setShopsLoading(true);
    try {
      const companies = await getAllCompanies();
      const shopsData: Shop[] = companies.map((c) => ({
        ...c,
        type: "shop",
        productCount: c.productCount || 0,
        shopImage: c.logo || getCategoryImage(c.businessType || "default"),
      }));
      setShops(shopsData);
    } catch (e) {
      console.error("Erreur lors du chargement des shops:", e);
    } finally {
      setShopsLoading(false);
    }
  };

  const loadCategoryProducts = async (categoryId: string, categoryName: string) => {
    setProductsLoading(true);
    setSelectedCategoryProducts([]);
    setFeaturedProducts([]);
    setNewProducts([]);

    try {
      const products = await getProductsByCategory(categoryId);
      const unique = Array.from(new Map(products.map((p) => [p.id, p])).values());
      setSelectedCategoryProducts(unique.length ? unique : []);
    } catch (e) {
      console.error("Erreur lors du chargement des produits de la catégorie:", e);
      setSelectedCategoryProducts([]);
    } finally {
      setProductsLoading(false);
    }
  };

  const loadFeaturedProducts = async () => {
    setFeaturedLoading(true);
    setSelectedCategoryProducts([]);
    try {
      const allProducts = await getAllProducts();
      if (!allProducts?.length) {
        setFeaturedProducts([]);
        setSelectedCategoryProducts([]);
        return;
      }
      const products = allProducts
        .filter((p) => p.featured)
        .slice(0, 20);
      const unique = Array.from(new Map(products.map((p) => [p.id, p])).values());
      setFeaturedProducts(unique);
      setSelectedCategoryProducts(unique);
    } catch (e) {
      console.error("Erreur lors du chargement des produits vedettes:", e);
      setFeaturedProducts([]);
      setSelectedCategoryProducts([]);
    } finally {
      setFeaturedLoading(false);
    }
  };

  const loadNewProducts = async () => {
    setNewProductsLoading(true);
    setSelectedCategoryProducts([]);
    try {
      const allProducts = await getAllProducts();
      if (!allProducts?.length) {
        setNewProducts([]);
        setSelectedCategoryProducts([]);
        return;
      }
      const products = allProducts
        .filter((p) => p.newArrival)
        .slice(0, 20);
      const unique = Array.from(new Map(products.map((p) => [p.id, p])).values());
      setNewProducts(unique);
      setSelectedCategoryProducts(unique);
    } catch (e) {
      console.error("Erreur lors du chargement des nouveaux produits:", e);
      setNewProducts([]);
      setSelectedCategoryProducts([]);
    } finally {
      setNewProductsLoading(false);
    }
  };

  const loadDiscoverProducts = async () => {
    setDiscoverLoading(true);
    try {
      const all = await getAllProducts();
      const shuffled = all
        ? Array.from(new Map(all.map((p) => [p.id, p])).values())
            .sort(() => Math.random() - 0.5)
            .slice(0, 10)
        : [];
      setDiscoverProducts(shuffled);
    } catch (e) {
      console.error("Erreur lors du chargement des produits découverts:", e);
      setDiscoverProducts([]);
    } finally {
      setDiscoverLoading(false);
    }
  };

  // Handlers
  const handleMenuClick = async (index: number, item: MenuItem) => {
    setMenuIndex(index);
    if (item.type === "category") {
      await loadCategoryProducts(item.id, item.name);
      setFeaturedProducts([]);
      setNewProducts([]);
    } else if (item.id === "boutiques") {
      setSelectedCategoryProducts([]);
      setFeaturedProducts([]);
      setNewProducts([]);
    } else if (item.id === "en-vedette") {
      await loadFeaturedProducts();
      setShops([]);
      setNewProducts([]);
    } else if (item.id === "nouveautes") {
      await loadNewProducts();
      setShops([]);
      setFeaturedProducts([]);
    }
  };

  const navigateToProduct = (product: Product) => router.push(`/product/${product.id}`);

  const navigateToShop = (shop: Shop) => {
    router.push({
      pathname: `/store/${shop.id}`,
      params: {
        name: encodeURIComponent(shop.name),
        fromCategories: "true",
      },
    });
  };

  const openAddToCart = (product: Product) => {
    setSelectedProduct(product);
    setQuantity(1);
    setIsModalVisible(true);
  };

  const closeAddToCartModal = () => {
    setIsModalVisible(false);
    setSelectedProduct(null);
    setQuantity(1);
  };

  const handleAddToCart = () => {
    if (selectedProduct && quantity > 0) {
      addToCart(selectedProduct, quantity);
      closeAddToCartModal();
    }
  };

  const handlePromotionPress = (promo: any) => {
    if (promo.action === "category") {
      const target = leftMenu.find((it) => it.type === "category" && it.id === promo.categoryId);
      if (target) {
        const idx = leftMenu.indexOf(target);
        setMenuIndex(idx);
        loadCategoryProducts(target.id, target.name);
      }
    }
  };

  // Menu
  const leftMenu: MenuItem[] = [
    ...SPECIAL_MENU(t),
    ...filteredCategories.map((cat) => ({
      name: cat.name,
      id: cat.id,
      type: "category" as const,
      productCount: cat.productCount,
      icon: getCategoryIcon(cat.name),
    })),
  ];

  // Rendu des promotions
  const renderPromotionsHeader = () => (
    <View style={styles.promotionsHeader}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.promotionsScroll}
        contentContainerStyle={styles.promotionsScrollContent}
      >
        {HEADER_PROMOTIONS(t).map((promo) => (
          <PromotionCard
            key={promo.id}
            title={promo.title}
            subtitle={promo.subtitle}
            time={promo.time}
            color={promo.color}
            icon={promo.icon}
            onPress={() => handlePromotionPress(promo)}
          />
        ))}
      </ScrollView>
      <View style={styles.paginationDots}>
        {HEADER_PROMOTIONS(t).map((_, idx) => (
          <View
            key={idx}
            style={[styles.paginationDot, idx === currentPromotionIndex && styles.paginationDotActive]}
          />
        ))}
      </View>
    </View>
  );

  // Rendu de la grille de catégories
  const renderCategoryGrid = () => (
    <View style={styles.categoryGridContainer}>
      <Text style={styles.recommendedTitle}>Recommandé pour vous</Text>
      <View style={styles.categoryGrid}>
        {leftMenu.slice(0, 20).map((item, index) => (
          <CategoryCard
            key={`${item.type}-${item.id}-${index}`}
            title={item.name}
            icon={item.icon}
            isActive={index === menuIndex}
            onPress={() => handleMenuClick(index, item)}
          />
        ))}
      </View>
    </View>
  );

  // Rendu des produits
  const renderProductsGrid = (products: Product[], loading: boolean) => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff6a00" />
        </View>
      );
    }

    if (!products.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="grid-outline" size={60} color="#e0e0e0" />
          <Text style={styles.emptyTitle}>Aucun produit disponible</Text>
        </View>
      );
    }

    return (
      <View style={styles.productsGridContainer}>
        {products.slice(0, 12).map((item, index) => (
          <View 
            key={item.id} 
            style={[
              styles.productCardWrapper,
              index % 2 === 0 ? styles.leftColumn : styles.rightColumn
            ]}
          >
            <ProductCard
              product={item}
              onPress={() => navigateToProduct(item)}
              onAddToCart={(e) => {
                e.stopPropagation();
                openAddToCart(item);
              }}
            />
          </View>
        ))}
      </View>
    );
  };

  // Rendu des boutiques
  const renderShopsGrid = () => {
    if (shopsLoading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff6a00" />
        </View>
      );
    }

    if (!shops.length) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="storefront-outline" size={60} color="#e0e0e0" />
          <Text style={styles.emptyTitle}>Aucune boutique disponible</Text>
        </View>
      );
    }

    return (
      <View style={styles.shopsGridContainer}>
        {shops.slice(0, 6).map((item, index) => (
          <View 
            key={item.id} 
            style={[
              styles.shopCardWrapper,
              index % 2 === 0 ? styles.leftColumn : styles.rightColumn
            ]}
          >
            <ShopCard
              shop={item}
              onPress={() => navigateToShop(item)}
            />
          </View>
        ))}
      </View>
    );
  };

  // Rendu des produits découverts
  const renderDiscoverProducts = () => {
    if (discoverLoading || !discoverProducts.length) return null;

    return (
      <View style={styles.discoverSection}>
        <View style={styles.discoverHeader}>
          <Text style={styles.discoverTitle}>Produits populaires</Text>
          <TouchableOpacity
            style={styles.seeAllButton}
            onPress={() => router.push("/category-products")}
          >
            <Text style={styles.seeAllText}>Voir tout</Text>
            <Ionicons name="arrow-forward" size={12} color="#ff6a00" />
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.discoverScroll}
          contentContainerStyle={styles.discoverScrollContent}
        >
          {discoverProducts.map((product) => (
            <DiscoverProductCard
              key={product.id}
              product={product}
              onPress={() => navigateToProduct(product)}
              onAddToCart={(e) => {
                e.stopPropagation();
                openAddToCart(product);
              }}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  // Rendu du contenu principal
  const renderContent = () => {
    if (menuIndex === 0) {
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nos Boutiques</Text>
          </View>
          {renderShopsGrid()}
          {renderDiscoverProducts()}
        </>
      );
    } else if (menuIndex === 1) {
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Produits en Vedette</Text>
          </View>
          {renderProductsGrid(featuredProducts, featuredLoading)}
          {renderDiscoverProducts()}
        </>
      );
    } else if (menuIndex === 2) {
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nouveautés</Text>
          </View>
          {renderProductsGrid(newProducts, newProductsLoading)}
          {renderDiscoverProducts()}
        </>
      );
    } else {
      const categoryName = leftMenu[menuIndex]?.name || "Catégorie";
      return (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{categoryName}</Text>
          </View>
          {renderProductsGrid(selectedCategoryProducts, productsLoading)}
          {renderDiscoverProducts()}
        </>
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6a00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Promotions Carousel */}
        {renderPromotionsHeader()}

        {/* Categories Grid - Style AliExpress */}
        {renderCategoryGrid()}

        {/* Content Area */}
        <View style={styles.contentArea}>
          {renderContent()}
        </View>

        {/* Espace pour le bas */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ============= STYLES =============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  center: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  contentArea: {
    backgroundColor: "#f5f5f5",
  },
  promotionsHeader: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingBottom: 16,
  },
  promotionsScroll: {
    marginHorizontal: 4,
  },
  promotionsScrollContent: {
    paddingHorizontal: 12,
  },
  promotionCard: {
    width: 180,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 6,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  promotionIconContainer: {
    marginRight: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  promotionContent: {
    flex: 1,
  },
  promotionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 2,
  },
  promotionSubtitle: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 4,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    fontSize: 9,
    color: "#fff",
    marginLeft: 4,
    opacity: 0.9,
  },
  paginationDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ddd",
    marginHorizontal: 3,
  },
  paginationDotActive: {
    backgroundColor: "#ff6a00",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recommendedTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  categoryGridContainer: {
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 4,
    paddingBottom: 16,
  },
  categoryCard: {
    width: "25%",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  categoryIconContainerActive: {
    backgroundColor: "#fff8f0",
  },
  categoryTitle: {
    fontSize: 11,
    color: "#333",
    textAlign: "center",
    lineHeight: 14,
  },
  categoryTitleActive: {
    color: "#ff6a00",
    fontWeight: "600",
  },
  sectionHeader: {
    backgroundColor: "#fff",
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  productsGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    backgroundColor: "#fff",
  },
  shopsGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    backgroundColor: "#fff",
  },
  productCardWrapper: {
    width: "50%",
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  shopCardWrapper: {
    width: "50%",
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  leftColumn: {
    paddingLeft: 8,
    paddingRight: 4,
  },
  rightColumn: {
    paddingLeft: 4,
    paddingRight: 8,
  },
  productCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productImageContainer: {
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: 120,
    backgroundColor: "#f5f5f5",
  },
  addToCartButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "#ff6a00",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  productInfo: {
    padding: 8,
  },
  productName: {
    fontSize: 12,
    color: "#333",
    marginBottom: 4,
    lineHeight: 14,
    height: 28,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ff6a00",
  },
  featuredBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#ff6a00",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  shopCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  shopImageContainer: {
    position: "relative",
    width: "100%",
    height: 100,
  },
  shopImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f5f5f5",
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
    padding: 8,
  },
  shopName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 4,
  },
  shopStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statText: {
    fontSize: 10,
    color: "#6c757d",
    marginLeft: 2,
  },
  discoverSection: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    marginTop: 8,
  },
  discoverHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  discoverTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212529",
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  seeAllText: {
    fontSize: 12,
    color: "#ff6a00",
    marginRight: 4,
  },
  discoverScroll: {
    height: 160,
  },
  discoverScrollContent: {
    paddingHorizontal: 12,
  },
  discoverProductCard: {
    width: 120,
    marginRight: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
  },
  discoverProductImage: {
    width: "100%",
    height: 100,
    backgroundColor: "#f5f5f5",
  },
  discoverProductInfo: {
    padding: 8,
  },
  discoverProductTitle: {
    fontSize: 11,
    color: "#333",
    marginBottom: 4,
    lineHeight: 13,
    height: 26,
  },
  discoverProductPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ff6a00",
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  emptyTitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 12,
    textAlign: "center",
  },
  bottomSpacer: {
    height: 50,
  },
});