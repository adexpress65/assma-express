import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
  Image,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  collection,
  getDocs,
  limit,
  query,
  orderBy,
  where,
  startAfter,
  doc,
  getDoc
} from "firebase/firestore";
import { db } from "../../src/config/firebase";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";


// Composants Premium (supposés déjà optimisés individuellement)
import PremiumHeader from "../../src/components/premium/PremiumHeader";
import AnimatedQuickActions from "../../src/components/premium/AnimatedQuickActions";
import HeroBanner from "../../src/components/premium/HeroBanner";
import PremiumSpecialOffers from "../../src/components/premium/PremiumSpecialOffers";
import CategoryGridPremium from "../../src/components/premium/CategoryGridPremium";
import ProductCardPremium from "../../src/components/premium/ProductCardPremium";
import NewArrivalsPremium from "../../src/components/premium/NewArrivalsPremium";
import PremiumAdBanner from "../../src/components/premium/PremiumAdBanner";
import PremiumSuppliersSection from "../../src/components/premium/PremiumSuppliersSection";
import FloatingCartButton from "../../src/components/premium/FloatingCartButton";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HEADER_HEIGHT = Platform.OS === "ios" ? 160 : 145;
const PAGE_SIZE = 20;
const MAX_POPULAR_PRODUCTS = 200;

// Configuration du rafraîchissement aléatoire
const ROTATION_INTERVAL_MIN = 4000;
const ROTATION_INTERVAL_MAX = 6000;
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
  categoryId?: string
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
    const scrollViewRef = useRef<ScrollView>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const itemWidth = SCREEN_WIDTH * 0.75; // 75% de l'écran pour chaque item
    const spacing = 12;

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
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({
          x: index * (itemWidth + spacing),
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

        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled={false}
          snapToInterval={itemWidth + spacing}
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.carouselContent}
        >
         {products.map((product) => (
  <TouchableOpacity
    key={product.id}
    style={[styles.carouselItem, { width: itemWidth }]}
    onPress={() => onProductPress(product)}
    activeOpacity={0.9}
  >
              <View style={styles.carouselCard}>
                <View style={styles.carouselImageContainer}>
                  <Image
                    source={{ uri: product.imageUrl || product.mainImage || 'https://via.placeholder.com/300' }}
                    style={styles.carouselImage}
                    resizeMode="cover"
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
          ))}
        </ScrollView>

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
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          )}
          {discount > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-{discount}%</Text>
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
  const { t } = useTranslation();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSections, setLoadingSections] = useState(true);
  const scrollY = useRef(new Animated.Value(0)).current;

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
    categories: [
      { id: "1", name: "category.electronics", icon: "?", color: "#ff6a00" },
      { id: "2", name: "category.clothing", icon: "??", color: "#4CAF50" },
      { id: "3", name: "category.machinery", icon: "??", color: "#2196F3" },
      { id: "4", name: "category.materials", icon: "??", color: "#9C27B0" },
    ],
    pools: {
      featured: [],
      trending: [],
      offers: [],
      newArrivals: [],
      industrial: [],
    },
  });

  // Normalisation produit
  const normalizeProduct = useCallback((doc: any): Product => {
    const data = doc.data();
    const name = data.name || "";
    const rawCat = data.categoryName || data.category || "";
    const cleanCategory =
      rawCat === "Uncategorized" || rawCat === "uncategorized" ? "" : rawCat;

    return {
      id: doc.id,
      name: name.includes(".") ? t(name) : name,
      price: Number(data.price) || 0,
      originalPrice: Number(data.originalPrice) || Number(data.price),
      imageUrl: data.mainImage || data.imageUrl || null,
      mainImage: data.mainImage || data.imageUrl || null,
      rating: data.rating || 0,
      stock: data.stockQuantity || data.stock || 0,
      supplier: data.supplier || data.companyName || "Fournisseur",
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
          specS,
          popS,
          newS,
          indS,
          suppliersWithProducts,
        ] = await Promise.all([
          getDocs(
            query(
              collection(db, "products"),
              where("featured", "==", true),
              limit(30) // Augmenté pour avoir plus de produits dans le carousel
            )
          ),
          getDocs(
            query(
              collection(db, "products"),
              where("trending", "==", true),
              limit(30) // Augmenté pour avoir plus de produits dans le carousel
            )
          ),
          getDocs(
            query(
              collection(db, "products"),
              where("specialOffer", "==", true),
              limit(20)
            )
          ),
          getDocs(
            query(
              collection(db, "products"),
              orderBy("createdAt", "desc"),
              limit(60)
            )
          ),
          getDocs(
            query(
              collection(db, "products"),
              where("newArrival", "==", true),
              limit(30)
            )
          ),
          getDocs(
            query(
              collection(db, "products"),
              where("industrial", "==", true),
              limit(20)
            )
          ),
          fetchSuppliersWithProducts(),
        ]);

        const featuredPool = featS.docs.map((doc) => normalizeProduct(doc));
        const trendingPool = trendS.docs.map((doc) => normalizeProduct(doc));
        const offersPool = specS.docs.map((doc) => normalizeProduct(doc));
        const newArrivalsPool = newS.docs.map((doc) => normalizeProduct(doc));
        const industrialPool = indS.docs.map((doc) => normalizeProduct(doc));
        const allPopular = popS.docs.map((doc) => normalizeProduct(doc));

        setLastDoc(popS.docs[popS.docs.length - 1]);
        setHasMore(popS.docs.length >= 20);

        setHomeData((prev) => ({
          ...prev,
          // Featured Products : carousel avec beaucoup de produits
          featuredProducts: shuffleArray(featuredPool).slice(0, 20),
          // Trending Products : carousel avec beaucoup de produits
          trendingProducts: shuffleArray(trendingPool),
          specialOffers: shuffleArray(offersPool).slice(0, 8),
          popularProducts: allPopular,
          newArrivals: shuffleArray(newArrivalsPool).slice(0, 16),
          industrialMachines: shuffleArray(industrialPool).slice(0, 15),
          suppliersWithProducts,
          pools: {
            featured: featuredPool,
            trending: trendingPool,
            offers: offersPool,
            newArrivals: newArrivalsPool,
            industrial: industrialPool,
          },
        }));
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
    fetchHomeData();
  }, [fetchHomeData]);

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
        targetProductId: targetId 
      },
    });

    // 4. VERROU LONG (3 secondes)
    // On laisse le temps à la navigation de quitter l'écran complètement
    setTimeout(() => {
      isLocked.current = false;
    }, 3000);
  },
  [router]
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
        <View style={{ height: HEADER_HEIGHT }} />

        <AnimatedQuickActions />

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
          categories={homeData.categories.map((c) => ({
            ...c,
            name: t(c.name),
          }))}
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
  onProductPress={(product) => {
    // 1. Protection contre les clics multiples ou pendant une rotation
    if (isLocked.current) return;
    isLocked.current = true;

    // 2. Snapshot : On fige les données du produit cliqué immédiatement
    const productSnapshot = { ...product };
    const targetId = String(productSnapshot.id);
    const targetCategory = String(productSnapshot.categoryId || 'all');

    console.log("Navigation vers :", productSnapshot.name);

    // 3. Navigation avec les données figées
    router.push({
      pathname: `/category/${targetCategory}`,
      params: { targetProductId: targetId }
    });

    // 4. Verrouillage de sécurité pour laisser le temps à l'écran de changer
    setTimeout(() => {
      isLocked.current = false;
    }, 2500);
  }}
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
      homeData.categories,
      homeData.suppliersWithProducts,
      loadingSections,
      t,
      handleProductPress,
      handleSeeAllTrending,
      handleSeeAllIndustrial,
      handleSeeAllOffers,
      handleSeeAllFeatured,
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
      <StatusBar backgroundColor="#ff6a00" barStyle="light-content" />

      <View style={[styles.stickyHeader, { height: HEADER_HEIGHT }]}>
        <PremiumHeader onSearch={(q) => console.log(q)} />
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
    backgroundColor: "#ff6a00",
  },
  headerContent: {
    backgroundColor: "#fff",
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
