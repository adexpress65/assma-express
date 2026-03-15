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
// 1. Composants d'affichage extraits et mémoïsés
// ------------------------------------------------------------

// Carte produit verticale
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
    itemsPerRow = 3, // Nouvelle prop (défaut: 2)
    maxItems, // Nouvelle prop optionnelle
  }: {
    title: string;
    subtitle?: string;
    products: Product[];
    onProductPress: (product: Product) => void;
    onSeeAll?: () => void;
    loading?: boolean;
    itemsPerRow?: number; // Nombre de colonnes
    maxItems?: number; // Nombre max d'articles
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
            <View key={rowIndex} style={styles.verticalRow}>
              {row.map((product) => (
                <View key={product.id} style={styles.verticalCardWrapper}>
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
    prevProps.products.length === nextProps.products.length &&
    prevProps.products.every((p, i) => p.id === nextProps.products[i]?.id)
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
        rotationKey: `${p.id}-${Date.now()}-${Math.random()}`,
      }));
    },
    [rotationCache]
  );

  const performRotation = useCallback(() => {
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
              15
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
              limit(20)
            )
          ),
          getDocs(
            query(
              collection(db, "products"),
              where("trending", "==", true),
              limit(20)
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
              limit(20)
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
          featuredProducts: shuffleArray(featuredPool).slice(0, 8),
          trendingProducts: shuffleArray(trendingPool).slice(0, 10),
          specialOffers: shuffleArray(offersPool).slice(0, 8),
          popularProducts: allPopular,
          newArrivals: shuffleArray(newArrivalsPool).slice(0, 15),
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
  // Handlers pour la navigation
  // ------------------------------------------------------------
  const handleProductPress = useCallback(
    (item: Product) => {
      if (item.originalLink) {
        router.push({
          pathname: "/webview",
          params: { url: item.originalLink, title: item.name },
        });
      } else {
        router.push(`/product/${item.id}`);
      }
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

// Dans PremiumHomeScreen, remplacez le handler existant par :
// Version avec IDs des produits pour éviter de passer trop de données
// Dans PremiumHomeScreen, modifiez le handler :
// Dans PremiumHomeScreen, modifiez le handler pour inclure mainImage
// Dans PremiumHomeScreen, modifiez le handler :
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
    images: p.images, // AJOUTER CE CHAMP
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

  // Render item pour la FlatList (popular products)
  const renderPopularItem = useCallback(
    ({ item }: { item: Product }) => (
      <PopularProductItem item={item} onPress={handleProductPress} />
    ),
    [handleProductPress]
  );

  // ------------------------------------------------------------
  // Header mémoïsé (avec les nouvelles props onSeeAll)
  // ------------------------------------------------------------
  const renderHeader = useMemo(
    () => (
      <View style={styles.headerContent}>
        <View style={{ height: HEADER_HEIGHT }} />

        <AnimatedQuickActions />

        <HeroBanner />

        {homeData.featuredProducts.length > 0 && (
          <PremiumSpecialOffers
            products={homeData.featuredProducts}
            title={t("homeScreen.featuredProductsTitle")}
            subtitle={t("homeScreen.featuredProductsSubtitle")}
            onSeeAll={handleSeeAllOffers} // Redirection vers /premium-offers
          />
        )}

        <VerticalProductSection
          title="Tendances du Moment"
          subtitle="Les produits les plus demandés"
          products={homeData.trendingProducts}
          onProductPress={handleProductPress}
          onSeeAll={handleSeeAllTrending} // Redirection vers /trending
          loading={loadingSections}
        />

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
  title="Plus d'articles"
  subtitle="Equipements professionnels"
  products={homeData.industrialMachines}
  onProductPress={handleProductPress}
  onSeeAll={handleSeeAllIndustrial}
  loading={loadingSections}
  // Ajouter ces props pour contrôler l'affichage
  itemsPerRow={3} // Nombre de colonnes
  maxItems={20} // Nombre maximum d'articles à afficher
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

// Styles (inchangés)
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