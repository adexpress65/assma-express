import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import {
  collection,
  getDocs,
  limit,
  query,
  orderBy,
  where,
  startAfter,
} from "firebase/firestore";
import { db } from "../../src/config/firebase";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";


// Composants Premium (supposés déjà optimisés individuellement)
import PremiumHeader, {
  PremiumHeaderStats,
  PremiumHeaderTopBar,
  PREMIUM_HEADER_SEARCH_HEIGHT,
  PREMIUM_HEADER_TOP_BAR_HEIGHT,
} from "../../src/components/premium/PremiumHeader";
import SearchOverlay from "@/components/SearchOverlay";
import AnimatedQuickActions from "../../src/components/premium/AnimatedQuickActions";
import FreeProductsSection from "../../src/components/premium/FreeProductsSection";
import HeroBanner from "../../src/components/premium/HeroBanner";
import PremiumSpecialOffers from "../../src/components/premium/PremiumSpecialOffers";
import CategoryGridPremium from "../../src/components/premium/CategoryGridPremium";
import ProductCardPremium from "../../src/components/premium/ProductCardPremium";
import { isZeroDollarsShop } from "../../src/utils/zeroDollarsShop";
import ZeroDollarsFreeBadge from "../../src/components/ZeroDollarsFreeBadge";
import NewArrivalsPremium from "../../src/components/premium/NewArrivalsPremium";
import PremiumAdBanner from "../../src/components/premium/PremiumAdBanner";
import PremiumSuppliersSection from "../../src/components/premium/PremiumSuppliersSection";
import FloatingCartButton from "../../src/components/premium/FloatingCartButton";
import { warmVisualSearchIndex } from "../../src/services/visualSearchService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BASE_HEADER_HEIGHT = PREMIUM_HEADER_TOP_BAR_HEIGHT + PREMIUM_HEADER_SEARCH_HEIGHT + 4;
const QUICK_ACTIONS_HEIGHT = 48;
const HEADER_TOP_SPACER = 10;
const HEADER_BACKGROUND = "#ff7a00";
const PAGE_SIZE = 20;
const MAX_POPULAR_PRODUCTS = 200;
const HOME_CACHE_KEY = "premium-home-cache-v3";
const HOME_CACHE_TTL_MS = 10 * 60 * 1000;
const FREE_CACHE_KEY = "premium-free-cache-v1";

// Configuration du rafraîchissement aléatoire
const ROTATION_INTERVAL_MIN = 4000;
const ROTATION_INTERVAL_MAX = 6000;
const FREE_ROTATION_INTERVAL_MIN = 8000;
const FREE_ROTATION_INTERVAL_MAX = 12000;
const ROTATION_SECTIONS = [
  "featured",
  "trending",
  "offers",
  "newArrivals",
  "industrial",
] as const;
type RotationSection = (typeof ROTATION_SECTIONS)[number];

// Types stricts
interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string | null;
  mainImage?: string | null;
  images?: string[];
  createdAt?: number | null;
  rating: number;
  stock: number;
  supplier: string;
  companyName?: string;
  minOrder: number;
  deliveryTime: string;
  isVerified: boolean;
  featured?: boolean;
  trending?: boolean;
  specialOffer?: boolean;
  newArrival?: boolean;
  industrial?: boolean;
  categoryName?: string;
  categoryId?: string;
  category?: string;
  originalLink?: string;
  hasFreeShipping?: boolean;
  freeShippingBadge?: string | null;
  rotationKey?: string;
}

interface HomeDataState {
  featuredProducts: Product[];
  trendingProducts: Product[];
  specialOffers: Product[];
  popularProducts: Product[];
  newArrivals: Product[];
  industrialMachines: Product[];
  suppliersWithProducts: any[];
  categories: Array<{ id: string; name: string; icon: string; color: string }>;
  pools: {
    featured: Product[];
    trending: Product[];
    offers: Product[];
    newArrivals: Product[];
    industrial: Product[];
  };
}

const DEFAULT_CATEGORIES: HomeDataState["categories"] = [
  { id: "1", name: "category.electronics", icon: "?", color: "#ff6a00" },
  { id: "2", name: "category.clothing", icon: "??", color: "#4CAF50" },
  { id: "3", name: "category.machinery", icon: "??", color: "#2196F3" },
  { id: "4", name: "category.materials", icon: "??", color: "#9C27B0" },
];

const EMPTY_POOLS: HomeDataState["pools"] = {
  featured: [],
  trending: [],
  offers: [],
  newArrivals: [],
  industrial: [],
};

// Cache pour les produits récemment affichés
class RotationCache {
  private cache: Map<string, Set<string>> = new Map();
  private maxSize: number = 20;

  constructor() {
    ROTATION_SECTIONS.forEach((section) => {
      this.cache.set(section, new Set());
    });
  }

  add(section: RotationSection, productId: string) {
    const sectionCache = this.cache.get(section);
    if (sectionCache) {
      sectionCache.add(productId);
      if (sectionCache.size > this.maxSize) {
        const firstItem = sectionCache.values().next().value;
        sectionCache.delete(firstItem);
      }
    }
  }

  has(section: RotationSection, productId: string): boolean {
    return this.cache.get(section)?.has(productId) || false;
  }

  clear(section: RotationSection) {
    this.cache.set(section, new Set());
  }
}

// Utilitaires
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const getRandomInterval = () =>
  Math.floor(
    Math.random() * (ROTATION_INTERVAL_MAX - ROTATION_INTERVAL_MIN + 1)
  ) + ROTATION_INTERVAL_MIN;

// ------------------------------------------------------------
// 1. NOUVEAU COMPOSANT : Carousel horizontal pour produits
// ------------------------------------------------------------
const HorizontalProductCarousel = React.memo(
  ({
    title,
    subtitle,
    products,
    onProductPress,
    onSeeAll,
    loading = false,
  }: {
    title: string;
    subtitle?: string;
    products: Product[];
    onProductPress: (product: Product) => void;
    onSeeAll?: () => void;
    loading?: boolean;
  }) => {
    const listRef = useRef<FlatList<Product>>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const itemWidth = SCREEN_WIDTH * 0.75;
    const spacing = 12;

    const renderCarouselItem = useCallback(
      ({ item: product }: { item: Product }) => (
        <TouchableOpacity
          style={[styles.carouselItem, { width: itemWidth }]}
          onPress={() => onProductPress(product)}
          activeOpacity={0.9}
        >
          <View style={styles.carouselCard}>
            <View style={styles.carouselImageContainer}>
              <Image
                source={{ uri: product.imageUrl || product.mainImage || 'https://via.placeholder.com/300' }}
                style={styles.carouselImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />
              {product.isVerified && (
                <View style={styles.carouselVerifiedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                </View>
              )}
              {product.originalPrice && product.originalPrice > product.price && (
                <View style={styles.carouselDiscountBadge}>
                  <Text style={styles.carouselDiscountText}>
                    -{Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%
                  </Text>
                </View>
              )}
              {isZeroDollarsShop({
                supplier: product.supplier,
                companyName: product.companyName,
              }) && (
                <View style={styles.carouselZeroBadge}>
                  <ZeroDollarsFreeBadge compact />
                </View>
              )}
            </View>
            <View style={styles.carouselContent}>
              <Text style={styles.carouselProductName} numberOfLines={2}>
                {product.name}
              </Text>
              <View style={styles.carouselPriceRow}>
                <Text style={styles.carouselPrice}>
                  {product.price.toLocaleString()} CFA
                </Text>
                {product.originalPrice && product.originalPrice > product.price && (
                  <Text style={styles.carouselOldPrice}>
                    {product.originalPrice.toLocaleString()}
                  </Text>
                )}
              </View>
              <View style={styles.carouselMetaRow}>
                <Ionicons name="business-outline" size={12} color="#666" />
                <Text style={styles.carouselMetaText} numberOfLines={1}>
                  {product.supplier}
                </Text>
              </View>
              {product.rating > 0 && (
                <View style={styles.carouselRatingRow}>
                  <Ionicons name="star" size={12} color="#ffc107" />
                  <Text style={styles.carouselRatingText}>{product.rating.toFixed(1)}</Text>
                  <Text style={styles.carouselDot}>•</Text>
                  <Text style={styles.carouselDeliveryText}>{product.deliveryTime}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      ),
      [itemWidth, onProductPress]
    );

    if (loading) {
      return (
        <View style={styles.carouselSection}>
          <View style={styles.carouselHeader}>
            <View>
              <Text style={styles.carouselTitle}>{title}</Text>
              {subtitle && <Text style={styles.carouselSubtitle}>{subtitle}</Text>}
            </View>
            <ActivityIndicator size="small" color="#ff6a00" />
          </View>
          <View style={styles.carouselLoadingContainer}>
            <ActivityIndicator size="large" color="#ff6a00" />
          </View>
        </View>
      );
    }

    if (products.length === 0) return null;

    const handleScroll = (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / (itemWidth + spacing));
      setCurrentIndex(index);
    };

    const scrollToIndex = (index: number) => {
      if (listRef.current) {
        listRef.current.scrollToOffset({
          offset: index * (itemWidth + spacing),
          animated: true,
        });
      }
    };

    return (
      <View style={styles.carouselSection}>
        <View style={styles.carouselHeader}>
          <View>
            <Text style={styles.carouselTitle}>{title}</Text>
            {subtitle && <Text style={styles.carouselSubtitle}>{subtitle}</Text>}
          </View>
          {onSeeAll ? (
            <TouchableOpacity style={styles.carouselSeeAllButton} onPress={onSeeAll}>
              <Text style={styles.carouselSeeAllText}>Voir tout</Text>
              <Ionicons name="arrow-forward" size={16} color="#ff6a00" />
            </TouchableOpacity>
          ) : (
            <View style={styles.carouselSeeAllButton}>
              <Text style={styles.carouselSeeAllText}>Voir tout</Text>
              <Ionicons name="arrow-forward" size={16} color="#ff6a00" />
            </View>
          )}
        </View>

        <FlatList
          ref={listRef}
          data={products}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          snapToInterval={itemWidth + spacing}
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.carouselContent}
          renderItem={renderCarouselItem}
          initialNumToRender={4}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
          getItemLayout={(_, index) => ({
            length: itemWidth + spacing,
            offset: (itemWidth + spacing) * index,
            index,
          })}
        />

        {/* Indicateurs de pagination */}
        {products.length > 1 && (
          <View style={styles.carouselPagination}>
            {products.map((_, index) => (
              <TouchableOpacity
                key={products[index].id}
                onPress={() => scrollToIndex(index)}
                style={[
                  styles.carouselPaginationDot,
                  index === currentIndex && styles.carouselPaginationDotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.loading === nextProps.loading &&
    prevProps.title === nextProps.title &&
    prevProps.products.length === nextProps.products.length &&
    prevProps.products.every((p, i) => p.id === nextProps.products[i]?.id)
);
HorizontalProductCarousel.displayName = "HorizontalProductCarousel";

// Carte produit verticale (pour la grille)
const VerticalProductCard = React.memo(
  ({ product, onPress }: { product: Product; onPress: () => void }) => {
    const [imageError, setImageError] = useState(false);

    const imageUrl = product.imageUrl || product.mainImage;
    const discount =
      product.originalPrice && product.originalPrice > product.price
        ? Math.round(
            ((product.originalPrice - product.price) /
              product.originalPrice) *
              100
          )
        : 0;

    return (
      <TouchableOpacity
        style={styles.verticalCard}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <View style={styles.verticalCardImageContainer}>
          {imageError || !imageUrl ? (
            <View style={styles.verticalImageFallback}>
              <Ionicons name="image-outline" size={40} color="#CCC" />
              <Text style={styles.fallbackText}>Image indisponible</Text>
            </View>
          ) : (
            <Image
              source={{ uri: imageUrl }}
              style={styles.verticalCardImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
              onError={() => setImageError(true)}
            />
          )}
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discount}%</Text>
            </View>
          )}
          {isZeroDollarsShop({
            supplier: product.supplier,
            companyName: product.companyName,
          }) && (
            <View
              style={[
                styles.zeroDollarsBadgeVertical,
                { top: discount > 0 ? 36 : 8 },
              ]}
            >
              <ZeroDollarsFreeBadge compact />
            </View>
          )}
          {product.isVerified && (
            <View style={styles.verifiedBadgeVertical}>
              <Ionicons name="checkmark-circle" size={18} color="#22c55e" />
            </View>
          )}
        </View>
        <View style={styles.verticalCardContent}>
          <Text style={styles.verticalCardTitle} numberOfLines={2}>
            {product.name}
          </Text>
          <View style={styles.verticalPriceRow}>
            <Text style={styles.verticalPrice}>
              {product.price.toLocaleString()} CFA
            </Text>
            {product.originalPrice && product.originalPrice > product.price && (
              <Text style={styles.verticalOldPrice}>
                {product.originalPrice.toLocaleString()}
              </Text>
            )}
          </View>
          <View style={styles.verticalMeta}>
            <View style={styles.metaRow}>
              <Ionicons name="business-outline" size={12} color="#666" />
              <Text style={styles.metaText} numberOfLines={1}>
                {product.supplier}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="cube-outline" size={12} color="#666" />
              <Text style={styles.metaText}>MOQ: {product.minOrder} pcs</Text>
            </View>
          </View>
          {product.rating > 0 && (
            <View style={styles.verticalRating}>
              <Ionicons name="star" size={12} color="#ffc107" />
              <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.deliveryText}>{product.deliveryTime}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) => prevProps.product.id === nextProps.product.id
);
VerticalProductCard.displayName = "VerticalProductCard";

// Section verticale à 2 colonnes (avec onSeeAll)
const VerticalProductSection = React.memo(
  ({
    title,
    subtitle,
    products,
    onProductPress,
    onSeeAll,
    loading = false,
  }: {
    title: string;
    subtitle?: string;
    products: Product[];
    onProductPress: (product: Product) => void;
    onSeeAll?: () => void;
    loading?: boolean;
  }) => {
    if (loading) {
      return (
        <View style={styles.verticalSection}>
          <View style={styles.sectionHeaderVertical}>
            <View>
              <Text style={styles.sectionTitleVertical}>{title}</Text>
              {subtitle && (
                <Text style={styles.sectionSubtitleVertical}>{subtitle}</Text>
              )}
            </View>
            <ActivityIndicator size="small" color="#ff6a00" />
          </View>
          <View style={styles.loadingContainerVertical}>
            <ActivityIndicator size="large" color="#ff6a00" />
          </View>
        </View>
      );
    }

    if (products.length === 0) return null;

    // Diviser en paires pour 2 colonnes
    const rows: Product[][] = [];
    for (let i = 0; i < products.length; i += 2) {
      rows.push(products.slice(i, i + 2));
    }

    return (
      <View style={styles.verticalSection}>
        <View style={styles.sectionHeaderVertical}>
          <View>
            <Text style={styles.sectionTitleVertical}>{title}</Text>
            {subtitle && (
              <Text style={styles.sectionSubtitleVertical}>{subtitle}</Text>
            )}
          </View>
          {onSeeAll ? (
            <TouchableOpacity style={styles.seeAllButtonVertical} onPress={onSeeAll}>
              <Text style={styles.seeAllTextVertical}>Voir tout</Text>
              <Ionicons name="arrow-forward" size={16} color="#ff6a00" />
            </TouchableOpacity>
          ) : (
            <View style={styles.seeAllButtonVertical}>
              <Text style={styles.seeAllTextVertical}>Voir tout</Text>
              <Ionicons name="arrow-forward" size={16} color="#ff6a00" />
            </View>
          )}
        </View>
<View style={styles.verticalGrid}>
  {rows.map((row, rowIndex) => (
    // ❌ Ne pas utiliser rowIndex ici
    // ✅ Utiliser une clé basée sur les IDs des produits de la ligne
    <View key={`row-${row[0].id}-${row[1]?.id || 'none'}`} style={styles.verticalRow}>
      {row.map((product) => (
        <View key={`wrap-${product.id}`} style={styles.verticalCardWrapper}>
          <VerticalProductCard
            product={product}
            onPress={() => onProductPress(product)}
          />
        </View>
      ))}
      {row.length === 1 && <View style={styles.verticalCardWrapper} />}
    </View>
  ))}
</View>
      </View>
    );
  },
(prevProps, nextProps) =>
  prevProps.loading === nextProps.loading &&
  prevProps.title === nextProps.title &&
  JSON.stringify(prevProps.products.map(p => p.id)) ===
  JSON.stringify(nextProps.products.map(p => p.id))
);
VerticalProductSection.displayName = "VerticalProductSection";

// Item de la FlatList (produit populaire)
const PopularProductItem = React.memo(
  ({ item, onPress }: { item: Product; onPress: (product: Product) => void }) => (
    <View style={styles.b2bCardWrapper}>
      <TouchableOpacity
        style={styles.productCardTouchable}
        onPress={() => onPress(item)}
        activeOpacity={0.9}
      >
        <ProductCardPremium product={item} />
      </TouchableOpacity>
    </View>
  ),
  (prevProps, nextProps) => prevProps.item.id === nextProps.item.id
);
PopularProductItem.displayName = "PopularProductItem";

// ------------------------------------------------------------
// Composant principal
// ------------------------------------------------------------
export default function PremiumHomeScreen() {
  const insets = useSafeAreaInsets();
  const HEADER_CONTENT_HEIGHT = BASE_HEADER_HEIGHT; // Modified: removed QUICK_ACTIONS_HEIGHT
  const HEADER_HEIGHT = HEADER_CONTENT_HEIGHT + insets.top + HEADER_TOP_SPACER;
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSections, setLoadingSections] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;
  const SCROLL_DISTANCE = PREMIUM_HEADER_TOP_BAR_HEIGHT;
  const diffClamp = useMemo(
    () => Animated.diffClamp(scrollY, 0, SCROLL_DISTANCE),
    [scrollY]
  );
  const premiumHeaderInnerTranslateY = useMemo(
    () =>
      diffClamp.interpolate({
        inputRange: [0, SCROLL_DISTANCE],
        outputRange: [0, -SCROLL_DISTANCE],
        extrapolate: "clamp",
      }),
    [diffClamp]
  );
  const quickActionsOpacity = useMemo(
    () =>
      diffClamp.interpolate({
        inputRange: [0, QUICK_ACTIONS_HEIGHT],
        outputRange: [1, 0],
        extrapolate: "clamp",
      }),
    [diffClamp]
  );
  const quickActionsTranslateY = useMemo(
    () =>
      diffClamp.interpolate({
        inputRange: [0, QUICK_ACTIONS_HEIGHT],
        outputRange: [0, -QUICK_ACTIONS_HEIGHT],
        extrapolate: "clamp",
      }),
    [diffClamp]
  );

  const [lastVisible, setLastDoc] = useState<any>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const rotationCache = useRef(new RotationCache()).current;
  const rotationTimeouts = useRef<NodeJS.Timeout[]>([]);
  
  // 🔒 NOUVEAU : Référence pour verrouiller la rotation pendant la navigation
  const isLocked = useRef(false);

  const [homeData, setHomeData] = useState<HomeDataState>({
    featuredProducts: [],
    trendingProducts: [],
    specialOffers: [],
    popularProducts: [],
    newArrivals: [],
    industrialMachines: [],
    suppliersWithProducts: [],
    categories: DEFAULT_CATEGORIES,
    pools: EMPTY_POOLS,
  });
  
  // Pool "0 dollars" basé sur les produits récents, + sélection affichée qui tourne souvent
  const [freeProductsDisplayed, setFreeProductsDisplayed] = useState<Product[]>([]);
  const freeProductsDisplayedIdsRef = useRef<Set<string>>(new Set());

  const freeProductsPool = useMemo(() => {
    const combined: Product[] = [
      ...(homeData.featuredProducts || []),
      ...(homeData.trendingProducts || []),
      ...(homeData.newArrivals || []),
      ...(homeData.industrialMachines || []),
      ...(homeData.popularProducts || []),
    ];

    const recent = combined.sort(
      (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)
    );

    const filtered = recent.filter((p) => {
      if (!p) return false;
      const isFreePrice = Number(p.price || 0) <= 1;
      const isZeroShop = isZeroDollarsShop({
        supplier: p.supplier || "",
        companyName: p.companyName || "",
      });
      return isFreePrice || isZeroShop;
    });

    const uniqueMap = new Map<string, Product>();
    filtered.forEach((item) => {
      if (item?.id) uniqueMap.set(item.id, item);
    });
    return Array.from(uniqueMap.values());
  }, [
    homeData.featuredProducts,
    homeData.trendingProducts,
    homeData.newArrivals,
    homeData.industrialMachines,
    homeData.popularProducts,
  ]);

  const translatedCategories = useMemo(
    () =>
      homeData.categories.map((category) => ({
        ...category,
        name: t(category.name),
      })),
    [homeData.categories, t]
  );

  // Normalisation produit
  const normalizeProduct = useCallback((doc: any): Product => {
    const data = doc.data();
    const name = data.name || "";
    const rawCat = data.categoryName || data.category || "";
    const cleanCategory =
      rawCat === "Uncategorized" || rawCat === "uncategorized" ? "" : rawCat;

    const createdAtMillis =
      typeof data?.createdAt?.toMillis === "function"
        ? data.createdAt.toMillis()
        : (typeof data?.createdAt === "number" ? data.createdAt : null);

    return {
      id: doc.id,
      name: name.includes(".") ? t(name) : name,
      price: Number(data.price) || 0,
      originalPrice: Number(data.originalPrice) || Number(data.price),
      imageUrl: data.mainImage || data.imageUrl || null,
      mainImage: data.mainImage || data.imageUrl || null,
      createdAt: createdAtMillis,
      rating: data.rating || 0,
      stock: data.stockQuantity || data.stock || 0,
      supplier: data.supplier || data.companyName || "Fournisseur",
      companyName: data.companyName || "",
      minOrder: data.minOrder || 1,
      deliveryTime: data.deliveryTime || "N/A",
      isVerified: data.isVerified || false,
      featured: data.featured || false,
      trending: data.trending || false,
      specialOffer: data.specialOffer || false,
      newArrival: data.newArrival || false,
      industrial: data.industrial || false,
      categoryId: data.categoryId || data.category || "",
      categoryName: cleanCategory,
      originalLink: data.originalLink || "",
      hasFreeShipping: data.hasFreeShipping || false,
      freeShippingBadge: data.freeShippingBadge || null,
    };
  }, [t]);

  // Rotation (identique)
  const rotateSection = useCallback(
    (
      section: RotationSection,
      currentProducts: Product[],
      pool: Product[],
      count: number
    ): Product[] => {
      if (pool.length === 0) return currentProducts;
      const availableProducts = pool.filter(
        (p) =>
          !rotationCache.has(section, p.id) &&
          !currentProducts.some((cp) => cp.id === p.id)
      );
      const sourcePool =
        availableProducts.length >= count ? availableProducts : pool;
      const shuffled = shuffleArray(sourcePool);
      const selected = shuffled.slice(0, Math.min(count, sourcePool.length));
      selected.forEach((p) => rotationCache.add(section, p.id));
      return selected.map((p) => ({
        ...p,
      }));
    },
    [rotationCache]
  );

  const performRotation = useCallback(() => {
    // 🔒 NOUVEAU : Condition de garde - si verrouillé, on ne fait rien
    if (isLocked.current) {
      return;
    }

    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    setHomeData((prev) => {
      const sectionsToUpdate = shuffleArray([...ROTATION_SECTIONS]).slice(
        0,
        Math.floor(Math.random() * 3) + 1
      );
      const updates: Partial<HomeDataState> = {};
      sectionsToUpdate.forEach((section) => {
        switch (section) {
          case "featured":
            updates.featuredProducts = rotateSection(
              "featured",
              prev.featuredProducts,
              prev.pools.featured,
              20
            );
            break;
          case "trending":
            updates.trendingProducts = rotateSection(
              "trending",
              prev.trendingProducts,
              prev.pools.trending,
              20
            );
            break;
          case "offers":
            updates.specialOffers = rotateSection(
              "offers",
              prev.specialOffers,
              prev.pools.offers,
              20
            );
            break;
          case "newArrivals":
            updates.newArrivals = rotateSection(
              "newArrivals",
              prev.newArrivals,
              prev.pools.newArrivals,
              16
            );
            break;
          case "industrial":
            updates.industrialMachines = rotateSection(
              "industrial",
              prev.industrialMachines,
              prev.pools.industrial,
              20
            );
            break;
        }
      });
      return { ...prev, ...updates };
    });
  }, [rotateSection, fadeAnim]);

  // Effet de rotation
  useEffect(() => {
    rotationTimeouts.current.forEach(clearTimeout);
    rotationTimeouts.current = [];
    const scheduleNextRotation = () => {
      const interval = getRandomInterval();
      const timeout = setTimeout(() => {
        performRotation();
        scheduleNextRotation();
      }, interval);
      rotationTimeouts.current.push(timeout);
    };
    scheduleNextRotation();
    return () => {
      rotationTimeouts.current.forEach(clearTimeout);
    };
  }, [performRotation]);

  // Rotation spécifique pour la section "0 dollars" (doit changer souvent + rester récente)
  useEffect(() => {
    const pickNextFree = () => {
      if (isLocked.current) return;
      if (!freeProductsPool.length) {
        // Ne jamais effacer l'affichage : on garde la dernière sélection
        return;
      }

      const prevIds = freeProductsDisplayedIdsRef.current;
      const recentWindow = freeProductsPool.slice(0, 50); // priorité aux produits récents
      const candidates =
        recentWindow.filter((p) => !prevIds.has(p.id)).length >= 8
          ? recentWindow.filter((p) => !prevIds.has(p.id))
          : recentWindow;

      const next = shuffleArray(candidates).slice(0, 10);
      setFreeProductsDisplayed(next);
      freeProductsDisplayedIdsRef.current = new Set(next.map((p) => p.id));

      // Persister pour la prochaine session
      AsyncStorage.setItem(FREE_CACHE_KEY, JSON.stringify(next)).catch(() => {});
    };

    // initial
    pickNextFree();

    const getInterval = () =>
      Math.floor(
        Math.random() * (FREE_ROTATION_INTERVAL_MAX - FREE_ROTATION_INTERVAL_MIN + 1)
      ) + FREE_ROTATION_INTERVAL_MIN;

    let timer: NodeJS.Timeout | null = null;
    const schedule = () => {
      timer = setTimeout(() => {
        pickNextFree();
        schedule();
      }, getInterval());
    };
    schedule();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [freeProductsPool]);

  // ------------------------------------------------------------
  // OPTIMISATION FIRESTORE : fetchSuppliersWithProducts refactoré
  // ------------------------------------------------------------
  const fetchSuppliersWithProducts = useCallback(async () => {
    try {
      const suppliersQuery = query(
        collection(db, "companies"),
        where("isVerified", "==", true),
        limit(6)
      );
      const suppliersSnap = await getDocs(suppliersQuery);
      if (suppliersSnap.empty) return [];

      const suppliers = suppliersSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const supplierIds = suppliers.map((s) => s.id);
      const productsQuery = query(
        collection(db, "products"),
        where("companyId", "in", supplierIds),
        limit(18)
      );
      const productsSnap = await getDocs(productsQuery);

      const productsBySupplier = new Map<string, Product[]>();
      productsSnap.docs.forEach((doc) => {
        const product = normalizeProduct(doc);
        const companyId = doc.data().companyId;
        if (companyId) {
          if (!productsBySupplier.has(companyId)) {
            productsBySupplier.set(companyId, []);
          }
          productsBySupplier.get(companyId)!.push(product);
        }
      });

      const suppliersWithProducts = suppliers
        .map((supplier) => ({
          ...supplier,
          products: (productsBySupplier.get(supplier.id) || []).slice(0, 3),
          productCount: (productsBySupplier.get(supplier.id) || []).length,
        }))
        .filter((s) => s.productCount > 0);

      return shuffleArray(suppliersWithProducts);
    } catch (e) {
      console.error("fetchSuppliersWithProducts error", e);
      return [];
    }
  }, [normalizeProduct]);

  // ------------------------------------------------------------
  // Chargement des données principales
  // ------------------------------------------------------------
  const fetchHomeData = useCallback(
    async (isRefresh = true) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
          setLoadingSections(true);
          setHasMore(true);
          ROTATION_SECTIONS.forEach((section) => rotationCache.clear(section));
        }

        const [
          featS,
          trendS,
          popS,
          newS,
          suppliersWithProducts,
        ] = await Promise.all([
          getDocs(
            query(
              collection(db, "products"),
              where("featured", "==", true),
              limit(24)
            )
          ),
          getDocs(
            query(
              collection(db, "products"),
              where("trending", "==", true),
              limit(24)
            )
          ),
          getDocs(
            query(
              collection(db, "products"),
              orderBy("createdAt", "desc"),
              limit(32)
            )
          ),
          getDocs(
            query(
              collection(db, "products"),
              where("newArrival", "==", true),
              limit(20)
            )
          ),
          fetchSuppliersWithProducts(),
        ]);

        const featuredPool = featS.docs.map((doc) => normalizeProduct(doc));
        const trendingPool = trendS.docs.map((doc) => normalizeProduct(doc));
        const newArrivalsPool = newS.docs.map((doc) => normalizeProduct(doc));
        const allPopular = popS.docs.map((doc) => normalizeProduct(doc));

        setLastDoc(popS.docs[popS.docs.length - 1]);
        setHasMore(popS.docs.length >= 20);

        const nextHomeData: HomeDataState = {
          featuredProducts: shuffleArray(featuredPool).slice(0, 20),
          trendingProducts: shuffleArray(trendingPool),
          specialOffers: [],
          popularProducts: allPopular,
          newArrivals: shuffleArray(newArrivalsPool).slice(0, 16),
          industrialMachines: [],
          suppliersWithProducts,
          categories: DEFAULT_CATEGORIES,
          pools: {
            featured: featuredPool,
            trending: trendingPool,
            offers: [],
            newArrivals: newArrivalsPool,
            industrial: [],
          },
        };

        setHomeData(nextHomeData);

        void AsyncStorage.setItem(
          HOME_CACHE_KEY,
          JSON.stringify({
            timestamp: Date.now(),
            data: nextHomeData,
          })
        ).catch(() => {});
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setRefreshing(false);
        setLoadingSections(false);
      }
    },
    [normalizeProduct, fetchSuppliersWithProducts, rotationCache]
  );

  // Chargement initial
  useEffect(() => {
    let isMounted = true;

    const bootstrapHome = async () => {
      let shouldRefreshFromNetwork = true;

      try {
        // Charger le cache des produits "0 dollars" pour affichage immédiat
        try {
          const freeRaw = await AsyncStorage.getItem(FREE_CACHE_KEY);
          if (freeRaw) {
            const parsed = JSON.parse(freeRaw) as Product[];
            if (Array.isArray(parsed) && parsed.length > 0 && isMounted) {
              setFreeProductsDisplayed(parsed);
              freeProductsDisplayedIdsRef.current = new Set(parsed.map((p) => p.id));
            }
          }
        } catch {}

        const raw = await AsyncStorage.getItem(HOME_CACHE_KEY);
        if (!raw) {
          await fetchHomeData(false);
          shouldRefreshFromNetwork = false;
          return;
        }

        const parsed = JSON.parse(raw) as {
          timestamp?: number;
          data?: HomeDataState;
        };

        const isFresh =
          typeof parsed?.timestamp === "number" &&
          Date.now() - parsed.timestamp < HOME_CACHE_TTL_MS;

        if (isMounted && isFresh && parsed?.data) {
          setHomeData({
            ...parsed.data,
            categories: parsed.data.categories?.length
              ? parsed.data.categories
              : DEFAULT_CATEGORIES,
            pools: parsed.data.pools || EMPTY_POOLS,
          });
          setLoadingSections(false);
        }
      } catch {
      } finally {
        if (shouldRefreshFromNetwork) {
          void fetchHomeData(false);
        }
      }
    };

    void bootstrapHome();

    return () => {
      isMounted = false;
    };
  }, [fetchHomeData]);

  useEffect(() => {
    void warmVisualSearchIndex();
  }, []);

  useEffect(() => {
    const imageUris = [
      ...homeData.featuredProducts,
      ...homeData.trendingProducts,
      ...homeData.newArrivals,
      ...homeData.popularProducts.slice(0, 18),
    ]
      .flatMap((product) => [product.imageUrl, product.mainImage, ...(product.images || [])])
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index)
      .slice(0, 24)
      .map((item) => String(item));

    if (!imageUris.length) {
      return;
    }

    Image.prefetch(imageUris, "memory-disk").catch(() => {});
  }, [
    homeData.featuredProducts,
    homeData.trendingProducts,
    homeData.newArrivals,
    homeData.popularProducts,
  ]);

  // ------------------------------------------------------------
  // Chargement paginé (popular products)
  // ------------------------------------------------------------
  const fetchMoreProducts = useCallback(async () => {
    if (
      loadingMore ||
      !hasMore ||
      !lastVisible ||
      homeData.popularProducts.length >= MAX_POPULAR_PRODUCTS
    )
      return;
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
        const nextItems = snap.docs.map((doc) => normalizeProduct(doc));
        setHomeData((prev) => ({
          ...prev,
          popularProducts: [...prev.popularProducts, ...nextItems],
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
  }, [loadingMore, hasMore, lastVisible, homeData.popularProducts.length, normalizeProduct]);

  const buildCategoryPreviewPayload = useCallback(
    (item: Product) =>
      JSON.stringify({
        id: item.id,
        name: item.name,
        price: item.price,
        originalPrice: item.originalPrice || item.price,
        image: item.imageUrl || item.mainImage || "",
        rating: item.rating,
        supplier: item.supplier,
        companyName: item.companyName || item.supplier,
        minOrder: item.minOrder,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        hasFreeShipping: Boolean(item.hasFreeShipping),
      }),
    []
  );

  // ------------------------------------------------------------
  // Handlers pour la navigation en 2 ÉTAPES (avec verrouillage)
  // ------------------------------------------------------------
  const handleProductPress = useCallback(
    async (item: Product) => {
      // 1. BLOQUER LA ROTATION IMMÉDIATEMENT
      isLocked.current = true;

      // 2. CRÉER UNE COPIE FIGÉE DES DONNÉES (Deep Copy locale)
      // On ne se fie plus à l'objet 'item' qui peut être lié à l'état qui change
      const targetId = String(item.id);
      const targetCategory = String(item.categoryId || item.category || 'all');

      // 3. NAVIGATION AVEC LES DONNÉES FIGÉES
      router.push({
        pathname: `/category/${targetCategory}`,
        params: { 
          targetProductId: targetId,
          selectedProductData: buildCategoryPreviewPayload(item),
        },
      });

      // 4. VERROU LONG (3 secondes)
      // On laisse le temps à la navigation de quitter l'écran complètement
      setTimeout(() => {
        isLocked.current = false;
      }, 3000);
    },
    [buildCategoryPreviewPayload, router]
  );

  const handleRefresh = useCallback(() => {
    fetchHomeData(true);
  }, [fetchHomeData]);

  // Nouveaux callbacks pour les boutons "Voir tout"
  const handleSeeAllTrending = useCallback(() => {
    router.push('/trending');
  }, [router]);

  const handleSeeAllIndustrial = useCallback(() => {
    // Mélanger plusieurs catégories de produits
    const mixedProducts = [
      ...homeData.industrialMachines,
      ...homeData.featuredProducts,
      ...homeData.trendingProducts,
      ...homeData.specialOffers,
      ...homeData.newArrivals,
    ].filter(Boolean);

    // Éviter les doublons par ID
    const uniqueProducts = Array.from(
      new Map(mixedProducts.map(p => [p.id, p])).values()
    );

    // Ne garder que les données essentielles pour l'URL
    const productsForUrl = uniqueProducts.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice,
      mainImage: p.mainImage,
      imageUrl: p.imageUrl,
      images: p.images,
      supplier: p.supplier,
      rating: p.rating,
      originalLink: p.originalLink
    }));

    router.push({
      pathname: '/products-list',
      params: { 
        products: JSON.stringify(productsForUrl),
        title: 'Machines & Équipements',
        mixMode: 'true'
      }
    });
  }, [router, homeData]);

  const handleSeeAllOffers = useCallback(() => {
    router.push('/premium-offers');
  }, [router]);

  const handleSeeAllFeatured = useCallback(() => {
    router.push('/featured-products');
  }, [router]);

  // Render item pour la FlatList (popular products)
  const renderPopularItem = useCallback(
    ({ item }: { item: Product }) => (
      <PopularProductItem item={item} onPress={handleProductPress} />
    ),
    [handleProductPress]
  );

  // ------------------------------------------------------------
  // Header mémoïsé avec les carrousels
  // ------------------------------------------------------------
  const renderHeader = useMemo(
    () => (
      <View style={styles.headerContent}>
        <View style={[styles.listHeaderSpacer, { height: HEADER_HEIGHT }]} />
        <PremiumHeaderStats />
        <View style={{ paddingVertical: 15 }}>
          <AnimatedQuickActions />
        </View>
        <FreeProductsSection products={freeProductsDisplayed} />

        <HeroBanner />

        {/* Section Produits en vedette */}
        {homeData.featuredProducts.length > 0 && (
          <View style={{ marginTop: 30, marginBottom: 15 }}>
            
            {/* Header avec police ajustée et décalage */}
            <View style={styles.trendingHeaderContainer}>
              <View style={styles.trendingAccentBar} />
              <Text style={styles.trendingTitleText}>Produits en vedette</Text>
            </View>

            <FlatList
              data={homeData.featuredProducts}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `featured-${item.id}`}
              contentContainerStyle={{
                paddingHorizontal: 20, // Ajusté pour un alignement plus doux
              }}
              renderItem={({ item }) => (
                <View style={{ width: 200, marginRight: 15 }}>
                  <ProductCardPremium
                    product={item}
                    onPress={() => handleProductPress(item)}
                  />
                </View>
              )}
            />
          </View>
        )}

        {/* Carousel des tendances du moment */}
        {homeData.trendingProducts.length > 0 && (
          <HorizontalProductCarousel
            title="Tendances du Moment"
            subtitle="Les produits les plus demandés"
            products={homeData.trendingProducts}
            onProductPress={handleProductPress}
            onSeeAll={handleSeeAllTrending}
            loading={loadingSections}
          />
        )}

        <CategoryGridPremium
          categories={translatedCategories}
        />

        <PremiumAdBanner />

        {homeData.newArrivals.length > 0 && (
          <NewArrivalsPremium products={homeData.newArrivals} />
        )}

        {homeData.suppliersWithProducts.length > 0 && (
          <PremiumSuppliersSection suppliers={homeData.suppliersWithProducts} />
        )}

        <VerticalProductSection
          title="Nouveautés"
          subtitle="Les derniers arrivages"
          products={homeData.newArrivals}
          onProductPress={handleProductPress}
          onSeeAll={() => router.push('/new-arrivals')}
          loading={loadingSections}
        />

        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>{t("More to Explore")}</Text>
        </View>
      </View>
    ),
    [
      homeData.featuredProducts,
      homeData.trendingProducts,
      homeData.newArrivals,
      homeData.industrialMachines,
      translatedCategories,
      homeData.suppliersWithProducts,
      freeProductsDisplayed,
      loadingSections,
      handleProductPress,
      handleSeeAllTrending,
      handleSeeAllIndustrial,
      handleSeeAllOffers,
      handleSeeAllFeatured,
      HEADER_HEIGHT,
    ]
  );
  
  // Footer mémoïsé
  const renderFooter = useMemo(
    () => (
      <View style={styles.footerContent}>
        {loadingMore && (
          <ActivityIndicator
            size="large"
            color="#ff6a00"
            style={{ marginVertical: 20 }}
          />
        )}
        <View style={styles.simpleFooter}>
          <View style={styles.footerDivider} />
          <Text style={styles.footerText}>A2Express @ 2026</Text>
          <Text style={styles.footerSubText}>
            Votre partenaire import export de confiance
          </Text>
        </View>
      </View>
    ),
    [loadingMore]
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={HEADER_BACKGROUND} barStyle="dark-content" />

      <View
        style={[
          styles.stickyHeader,
          { height: HEADER_HEIGHT },
        ]}
      >
        <View
          style={{
            height: insets.top + HEADER_TOP_SPACER,
            backgroundColor: HEADER_BACKGROUND,
          }}
        />
        <View style={{ height: HEADER_CONTENT_HEIGHT, overflow: "hidden" }}>
          <Animated.View style={{ transform: [{ translateY: premiumHeaderInnerTranslateY }] }}>
            <PremiumHeaderTopBar />
            <PremiumHeader onSearch={(q) => console.log(q)} />
          </Animated.View>
        </View>
      </View>

      <Animated.FlatList
        data={homeData.popularProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.b2bColumnWrapper}
        onEndReached={fetchMoreProducts}
        onEndReachedThreshold={0.5}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        ListHeaderComponent={renderHeader}
        renderItem={renderPopularItem}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#ff6a00"]}
            progressViewOffset={HEADER_HEIGHT}
          />
        }
        contentContainerStyle={styles.listContent}
        // Optimisations FlatList
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS === "android"}
        updateCellsBatchingPeriod={50}
      />

      <FloatingCartButton />
    </View>
  );
}

// Styles (ajout des styles pour le carousel)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: HEADER_BACKGROUND,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: "#8f6544",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  headerContent: {
    backgroundColor: "#fff",
  },
  listHeaderSpacer: {
    width: "100%",
    backgroundColor: HEADER_BACKGROUND,
  },
  listContent: {
    paddingBottom: 40,
  },
  b2bColumnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: 12,
    gap: 12,
  },
  b2bCardWrapper: {
    width: "48.5%",
    marginBottom: 4,
  },
  productCardTouchable: {
    width: "100%",
  },
  
  // Styles pour le carousel
  carouselSection: {
    marginVertical: 20,
    paddingLeft: 16,
  },
  carouselHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingRight: 16,
  },
  carouselTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  carouselSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  carouselSeeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5EE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  carouselSeeAllText: {
    fontSize: 13,
    color: "#ff6a00",
    fontWeight: "600",
    marginRight: 4,
  },
  carouselLoadingContainer: {
    height: 280,
    justifyContent: "center",
    alignItems: "center",
  },
  carouselContent: {
    paddingRight: 16,
  },
  carouselItem: {
    marginRight: 12,
  },
  carouselCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  carouselImageContainer: {
    position: "relative",
    height: 200,
    backgroundColor: "#fafafa",
  },
  carouselImage: {
    width: "100%",
    height: "100%",
  },
  carouselVerifiedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 2,
  },
  carouselDiscountBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#ff4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  carouselZeroBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    zIndex: 2,
  },
  carouselDiscountText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  carouselContent: {
    padding: 12,
  },
  carouselProductName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    lineHeight: 20,
    marginBottom: 8,
    minHeight: 40,
  },
  carouselPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  carouselPrice: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ff6a00",
  },
  carouselOldPrice: {
    fontSize: 13,
    color: "#999",
    textDecorationLine: "line-through",
    marginLeft: 8,
  },
  carouselMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  carouselMetaText: {
    fontSize: 13,
    color: "#666",
    flex: 1,
  },
  carouselRatingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  carouselRatingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    marginLeft: 4,
  },
  carouselDot: {
    fontSize: 13,
    color: "#ccc",
    marginHorizontal: 4,
  },
  carouselDeliveryText: {
    fontSize: 13,
    color: "#999",
  },
  carouselPagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    gap: 8,
  },
  carouselPaginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ddd",
  },
  carouselPaginationDotActive: {
    width: 20,
    backgroundColor: "#ff6a00",
  },

  // Styles existants pour les sections verticales
  verticalSection: {
    marginVertical: 16,
    paddingHorizontal: 12,
  },
  sectionHeaderVertical: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitleVertical: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  featuredSectionContainer: {
    marginTop: 40, // Plus d'espace en haut pour faire respirer l'interface
    marginBottom: 20,
  },
  trendingHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 25, // Pousse le titre vers la droite (effet tendance)
    marginBottom: 20,
  },
  trendingAccentBar: {
    width: 6, // Un peu plus épais pour l'impact visuel
    height: 30, 
    backgroundColor: '#ff6a00', // Ton orange A2Express
    borderRadius: 4,
    marginRight: 15,
  },
  trendingTitleText: {
    fontSize: 18, // Taille augmentée pour l'effet "Wow"
    fontWeight: '900', // Extra Bold comme dans les magazines de mode
    color: '#1a1a1a',
    letterSpacing: 0.8, // Espacement des lettres pour le luxe
    textTransform: 'uppercase', // Pour un look Boutique Pro
  },
  featuredListContent: {
    paddingHorizontal: 25, // Aligné exactement sur le titre
    paddingBottom: 10,
  },
  featuredCardWrapper: {
    width: 230, // Légèrement agrandi pour mettre en valeur les produits
    marginRight: 20,
    // Optionnel : ajouter une ombre légère si ton ProductCardPremium n'en a pas
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionSubtitleVertical: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  seeAllButtonVertical: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5EE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  seeAllTextVertical: {
    fontSize: 13,
    color: "#ff6a00",
    fontWeight: "600",
    marginRight: 4,
  },
  loadingContainerVertical: {
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  verticalGrid: {
    gap: 12,
  },
  verticalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  verticalCardWrapper: {
    width: "48.5%",
  },
  verticalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  verticalCardImageContainer: {
    position: "relative",
    height: 180,
    backgroundColor: "#fafafa",
  },
  verticalCardImage: {
    width: "100%",
    height: "100%",
  },
  verticalImageFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  fallbackText: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
  },
  discountBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#ff4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  zeroDollarsBadgeVertical: {
    position: "absolute",
    left: 8,
    zIndex: 2,
  },
  verifiedBadgeVertical: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 2,
  },
  verticalCardContent: {
    padding: 12,
  },
  verticalCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    lineHeight: 20,
    marginBottom: 8,
    minHeight: 40,
  },
  verticalPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  verticalPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ff6a00",
  },
  verticalOldPrice: {
    fontSize: 12,
    color: "#999",
    textDecorationLine: "line-through",
    marginLeft: 8,
  },
  verticalMeta: {
    gap: 4,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: "#666",
    flex: 1,
  },
  verticalRating: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginLeft: 4,
  },
  dotSeparator: {
    fontSize: 12,
    color: "#ccc",
    marginHorizontal: 4,
  },
  deliveryText: {
    fontSize: 12,
    color: "#999",
  },
  sectionTitleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    letterSpacing: 0.5,
  },
  footerContent: {
    marginTop: 20,
  },
  simpleFooter: {
    padding: 40,
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    marginTop: 20,
  },
  footerDivider: {
    width: 50,
    height: 3,
    backgroundColor: "#ff6a00",
    marginBottom: 15,
    borderRadius: 2,
  },
  footerText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "bold",
    marginBottom: 5,
  },
  footerSubText: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
});
