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
  InteractionManager,
} from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Device from "expo-device";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import {
  collection,
  getDocs,
  limit,
  query,
  orderBy,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "../../src/config/firebase";
import {
  fetchCompanyDisplayNameMap,
  resolveSupplierLabels,
} from "../../src/utils/companyDisplayName";
import {
  EMPTY_HOME_DATA,
  fetchHomeFeed,
  getFreeProductsSnapshot,
  getHomeDataSnapshot,
  isActiveProductDoc,
  normalizeProduct,
  primeHomeFeedCache,
  shuffleArray,
  takeHomeFeedPrefetch,
  writeFreeProductsCache,
  writeHomeFeedCache,
  isHomeCacheStale,
  type HomeDataState,
  type HomeFeedResult,
  type Product,
} from "../../src/services/homeFeedService";
import { getLocalizedProductText } from "../../src/utils/productLocale";
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
import AnimatedQuickActions from "../../src/components/premium/AnimatedQuickActions";
import FreeProductsSection from "../../src/components/premium/FreeProductsSection";
import HeroBanner from "../../src/components/premium/HeroBanner";
import CategoryGridPremium from "../../src/components/premium/CategoryGridPremium";
import ProductCardPremium from "../../src/components/premium/ProductCardPremium";
import { isZeroDollarsShop } from "../../src/utils/zeroDollarsShop";
import ZeroDollarsFreeBadge from "../../src/components/ZeroDollarsFreeBadge";
import NewArrivalsPremium from "../../src/components/premium/NewArrivalsPremium";
import PremiumAdBanner from "../../src/components/premium/PremiumAdBanner";
import PremiumSuppliersSection from "../../src/components/premium/PremiumSuppliersSection";
import FloatingCartButton from "../../src/components/premium/FloatingCartButton";
import { warmVisualSearchIndex } from "../../src/services/visualSearchService";
import {
  getCategories,
  type Category,
} from "../../src/services/firebase/categoriesService";
import { useCurrency } from "../../src/contexts/CurrencyContext";
import { captureException } from "../../src/utils/errorReporting";
import {
  CarouselSectionSkeleton,
  ProductGridSkeleton,
} from "../../src/components/premium/HomeSectionSkeletons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BASE_HEADER_HEIGHT = PREMIUM_HEADER_TOP_BAR_HEIGHT + PREMIUM_HEADER_SEARCH_HEIGHT + 4;
const QUICK_ACTIONS_HEIGHT = 48;
const HEADER_TOP_SPACER = 10;
const HEADER_BACKGROUND = "#ff7a00";
/** Taille des pages suivantes (scroll infini). */
const PAGE_SIZE = 20;
const MAX_POPULAR_PRODUCTS = 200;
const HOME_PREFETCH_BATCH = 40;
const HOME_PREFETCH_NEAR_VIEWPORT = 12;
const ULTRA_LOW_RAM_MAX_BYTES = 2.2 * 1024 * 1024 * 1024;
const LOW_RAM_MAX_BYTES = 3 * 1024 * 1024 * 1024;
const MID_RAM_MAX_BYTES = 5 * 1024 * 1024 * 1024;
const FREE_DISPLAY_WINDOW = 10;
/** Pas de 1 = moins de cartes qui changent d’un coup (moins de flash). */
const FREE_ROTATION_STEP = 1;
const POPULAR_GRID_ITEM_ESTIMATED_SIZE = 300;
const PRODUCT_GRID_GUTTER = 10;

const AnimatedFlashList: any = Animated.createAnimatedComponent(FlashList as any);

function normalizeImageUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (
    trimmed.includes("firebasestorage.googleapis.com") &&
    !trimmed.includes("alt=media")
  ) {
    return trimmed.includes("?") ? `${trimmed}&alt=media` : `${trimmed}?alt=media`;
  }
  return trimmed;
}

type ListPerfTier = "ultra_low" | "low" | "medium" | "high";
type ListPerfConfig = {
  tier: ListPerfTier;
  initialNumToRender: number;
  maxToRenderPerBatch: number;
  windowSize: number;
  updateCellsBatchingPeriod: number;
  onEndReachedThreshold: number;
  removeClippedSubviews: boolean;
  prefetchBatch: number;
  prefetchNearViewport: number;
};

function resolveListPerfConfig(
  totalMemory: number | null,
  platform: string
): ListPerfConfig {
  if (typeof totalMemory === "number" && totalMemory > 0) {
    if (platform === "android" && totalMemory <= ULTRA_LOW_RAM_MAX_BYTES) {
      return {
        tier: "ultra_low",
        initialNumToRender: 3,
        maxToRenderPerBatch: 4,
        windowSize: 5,
        updateCellsBatchingPeriod: 90,
        onEndReachedThreshold: 0.78,
        removeClippedSubviews: true,
        prefetchBatch: 18,
        prefetchNearViewport: 6,
      };
    }
    if (totalMemory <= LOW_RAM_MAX_BYTES) {
      return {
        tier: "low",
        initialNumToRender: 4,
        maxToRenderPerBatch: 6,
        windowSize: 6,
        updateCellsBatchingPeriod: 70,
        onEndReachedThreshold: 0.72,
        removeClippedSubviews: platform === "android",
        prefetchBatch: 24,
        prefetchNearViewport: 8,
      };
    }
    if (totalMemory <= MID_RAM_MAX_BYTES) {
      return {
        tier: "medium",
        initialNumToRender: 6,
        maxToRenderPerBatch: 8,
        windowSize: 8,
        updateCellsBatchingPeriod: 55,
        onEndReachedThreshold: 0.66,
        removeClippedSubviews: platform === "android",
        prefetchBatch: 32,
        prefetchNearViewport: 10,
      };
    }
  }

  return {
    tier: "high",
    initialNumToRender: 8,
    maxToRenderPerBatch: 10,
    windowSize: 10,
    updateCellsBatchingPeriod: 45,
    onEndReachedThreshold: 0.62,
    removeClippedSubviews: platform === "android",
    prefetchBatch: HOME_PREFETCH_BATCH,
    prefetchNearViewport: HOME_PREFETCH_NEAR_VIEWPORT,
  };
}

// Configuration du rafraîchissement aléatoire
// UX type marketplace (AliExpress-like): listes stables, pas de rotation auto agressive.
const ENABLE_HOME_ROTATION = false;
const ROTATION_INTERVAL_MIN = 4000;
const ROTATION_INTERVAL_MAX = 6000;
/** Rotation section Zéro $ : ~45–60 s pour un rythme très calme. */
const FREE_ROTATION_INTERVAL_MIN = 45_000;
const FREE_ROTATION_INTERVAL_MAX = 60_000;
/** Diffère l’index visuel (scan Firestore lourd) après le premier écran. */
const VISUAL_INDEX_DEFER_MS = 4000;
/** Scroll au-delà duquel on monte les sections sous le fold. */
const BELOW_FOLD_SCROLL_PX = 64;
const ROTATION_SECTIONS = [
  "featured",
  "trending",
  "offers",
  "newArrivals",
  "industrial",
] as const;
type RotationSection = (typeof ROTATION_SECTIONS)[number];

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
        if (firstItem) {
          sectionCache.delete(firstItem);
        }
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
    uiLanguage,
    currencyCode,
  }: {
    title: string;
    subtitle?: string;
    products: Product[];
    onProductPress: (product: Product) => void;
    onSeeAll?: () => void;
    loading?: boolean;
    /** Permet de re-rendre quand la langue change (libellés produits localisés). */
    uiLanguage: string;
    currencyCode: string;
  }) => {
    const listRef = useRef<FlatList<Product>>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const itemWidth = SCREEN_WIDTH * 0.75;
    const spacing = 12;
    const { formatPrice } = useCurrency();

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
                {getLocalizedProductText(
                  product.name,
                  "name",
                  product as unknown as Record<string, unknown>,
                  uiLanguage,
                )}
              </Text>
              <View style={styles.carouselPriceRow}>
                <Text style={styles.carouselPrice}>
                  {formatPrice(product.price)}
                </Text>
                {product.originalPrice && product.originalPrice > product.price && (
                  <Text style={styles.carouselOldPrice}>
                    {formatPrice(product.originalPrice)}
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
      [itemWidth, onProductPress, uiLanguage, formatPrice]
    );

    /** Squelette seulement si aucune donnée (cache vide) — avec cache, affichage immédiat. */
    if (loading && products.length === 0) {
      return (
        <View style={styles.carouselSection}>
          <View style={styles.carouselHeader}>
            <View>
              <Text style={styles.carouselTitle}>{title}</Text>
              {subtitle && <Text style={styles.carouselSubtitle}>{subtitle}</Text>}
            </View>
          </View>
          <CarouselSectionSkeleton cardWidthRatio={0.75} />
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
          contentContainerStyle={styles.carouselListContent}
          renderItem={renderCarouselItem}
          initialNumToRender={3}
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
    prevProps.uiLanguage === nextProps.uiLanguage &&
    prevProps.currencyCode === nextProps.currencyCode &&
    prevProps.products.length === nextProps.products.length &&
    prevProps.products.every((p, i) => p.id === nextProps.products[i]?.id)
);
HorizontalProductCarousel.displayName = "HorizontalProductCarousel";

// Carte produit verticale (pour la grille)
const VerticalProductCard = React.memo(
  ({
    product,
    onPress,
    uiLanguage,
    currencyCode,
  }: {
    product: Product;
    onPress: () => void;
    uiLanguage: string;
    currencyCode: string;
  }) => {
    const [imageError, setImageError] = useState(false);
    const { formatPrice } = useCurrency();

    const imageUrl = product.imageUrl || product.mainImage;
    const displayName = getLocalizedProductText(
      product.name,
      "name",
      product as unknown as Record<string, unknown>,
      uiLanguage,
    );
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
            {displayName}
          </Text>
          <View style={styles.verticalPriceRow}>
            <Text style={styles.verticalPrice}>
              {formatPrice(product.price)}
            </Text>
            {product.originalPrice && product.originalPrice > product.price && (
              <Text style={styles.verticalOldPrice}>
                {formatPrice(product.originalPrice)}
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
  (prevProps, nextProps) =>
    prevProps.product.id === nextProps.product.id &&
    prevProps.uiLanguage === nextProps.uiLanguage &&
    prevProps.currencyCode === nextProps.currencyCode
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
    uiLanguage,
    currencyCode,
  }: {
    title: string;
    subtitle?: string;
    products: Product[];
    onProductPress: (product: Product) => void;
    onSeeAll?: () => void;
    loading?: boolean;
    uiLanguage: string;
    currencyCode: string;
  }) => {
    const renderVerticalItem = useCallback(
      ({ item }: { item: Product }) => (
        <View style={styles.verticalCardWrapper}>
          <VerticalProductCard
            product={item}
            onPress={() => onProductPress(item)}
            uiLanguage={uiLanguage}
            currencyCode={currencyCode}
          />
        </View>
      ),
      [currencyCode, onProductPress, uiLanguage]
    );

    if (loading && products.length === 0) {
      return (
        <View style={styles.verticalSection}>
          <View style={styles.sectionHeaderVertical}>
            <View>
              <Text style={styles.sectionTitleVertical}>{title}</Text>
              {subtitle && (
                <Text style={styles.sectionSubtitleVertical}>{subtitle}</Text>
              )}
            </View>
          </View>
          <ProductGridSkeleton rows={2} />
        </View>
      );
    }

    if (products.length === 0) return null;

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
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          scrollEnabled={false}
          columnWrapperStyle={styles.verticalRow}
          renderItem={renderVerticalItem}
        />
      </View>
    );
  },
(prevProps, nextProps) =>
  prevProps.loading === nextProps.loading &&
  prevProps.title === nextProps.title &&
  prevProps.uiLanguage === nextProps.uiLanguage &&
  prevProps.currencyCode === nextProps.currencyCode &&
  JSON.stringify(prevProps.products.map(p => p.id)) ===
  JSON.stringify(nextProps.products.map(p => p.id))
);
VerticalProductSection.displayName = "VerticalProductSection";

// Item de la FlatList (produit populaire)
const PopularProductItem = React.memo(
  ({
    item,
    onPress,
  }: {
    item: Product;
    onPress: (product: Product) => void;
  }) => {
    const handlePress = useCallback(() => {
      onPress(item);
    }, [onPress, item]);

    return (
      <View style={styles.b2bCardWrapper}>
        <TouchableOpacity
          style={styles.productCardTouchable}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          <ProductCardPremium product={item} />
        </TouchableOpacity>
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.item === nextProps.item &&
    prevProps.item.id === nextProps.item.id &&
    prevProps.onPress === nextProps.onPress
);
PopularProductItem.displayName = "PopularProductItem";

// ------------------------------------------------------------
// Composant principal
// ------------------------------------------------------------
export default function PremiumHomeScreen() {
  const insets = useSafeAreaInsets();
  const HEADER_CONTENT_HEIGHT = BASE_HEADER_HEIGHT; // Modified: removed QUICK_ACTIONS_HEIGHT
  const HEADER_HEIGHT = HEADER_CONTENT_HEIGHT + insets.top + HEADER_TOP_SPACER;
  const { t, i18n } = useTranslation();
  const { currency } = useCurrency();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  /** Faux par défaut : le cache AsyncStorage réhydrate vite (pas d’écran vide « chargement » si données disque). */
  const [loadingSections, setLoadingSections] = useState(false);
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
  /** Erreur réseau / Firestore sur le chargement principal (bandeau + retry). */
  const [homeFetchError, setHomeFetchError] = useState<string | null>(null);
  /** Échec du chargement de la page suivante des populaires. */
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [listPerfConfig, setListPerfConfig] = useState<ListPerfConfig>(() =>
    resolveListPerfConfig(null, Platform.OS)
  );

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const rotationCache = useRef(new RotationCache()).current;
  const rotationTimeouts = useRef<NodeJS.Timeout[]>([]);
  
  // 🔒 NOUVEAU : Référence pour verrouiller la rotation pendant la navigation
  const isLocked = useRef(false);
  const companyNameByIdRef = useRef<Map<string, string>>(new Map());
  const prefetchedImageUrisRef = useRef<Set<string>>(new Set());
  const popularProductsRef = useRef<Product[]>([]);
  const prefetchNearViewportRef = useRef(HOME_PREFETCH_NEAR_VIEWPORT);
  const lastPrefetchAnchorIndexRef = useRef(-1);
  const onEndReachedLockRef = useRef(false);

  /**
   * Le cache disque est remonté en mémoire pendant le splash : on peint donc le premier
   * frame avec les dernières sections connues, sans passer par un état vide.
   */
  const [homeData, setHomeData] = useState<HomeDataState>(
    () => getHomeDataSnapshot() ?? EMPTY_HOME_DATA
  );
  /** Vrai si le premier render affichait déjà des produits : évite d'afficher les skeletons pour rien. */
  const paintedFromCacheRef = useRef(homeData.popularProducts.length > 0);
  const [homeCategories, setHomeCategories] = useState<Category[]>([]);
  const [belowFoldReady, setBelowFoldReady] = useState(false);
  const belowFoldReadyRef = useRef(false);

  const revealBelowFold = useCallback(() => {
    if (belowFoldReadyRef.current) return;
    belowFoldReadyRef.current = true;
    setBelowFoldReady(true);
  }, []);

  useEffect(() => {
    const totalMemory =
      typeof Device.totalMemory === "number" ? Device.totalMemory : null;
    const nextConfig = resolveListPerfConfig(totalMemory, Platform.OS);
    setListPerfConfig(nextConfig);

    if (__DEV__) {
      const totalGb =
        typeof totalMemory === "number"
          ? (totalMemory / 1024 / 1024 / 1024).toFixed(1)
          : "unknown";
      console.log(
        `[home:list-perf] tier=${nextConfig.tier} ram=${totalGb}GB initial=${nextConfig.initialNumToRender} batch=${nextConfig.maxToRenderPerBatch} window=${nextConfig.windowSize} clipped=${nextConfig.removeClippedSubviews}`
      );
    }
  }, []);

  useEffect(() => {
    popularProductsRef.current = homeData.popularProducts;
    // Reset l'ancre de préfetch quand la liste est remplacée (refresh/rehydratation).
    if (homeData.popularProducts.length < lastPrefetchAnchorIndexRef.current) {
      lastPrefetchAnchorIndexRef.current = -1;
    }
  }, [homeData.popularProducts]);

  useEffect(() => {
    prefetchNearViewportRef.current = listPerfConfig.prefetchNearViewport;
  }, [listPerfConfig.prefetchNearViewport]);

  useEffect(() => {
    if (!loadingMore) {
      onEndReachedLockRef.current = false;
    }
  }, [loadingMore, homeData.popularProducts.length]);
  
  // Feed dédié (Firestore) : prix 0–1, tri récent → ancien
  const [zeroDollarsFeed, setZeroDollarsFeed] = useState<Product[]>([]);
  // Pool "0 dollars" basé sur les produits récents, + sélection affichée qui tourne souvent
  const [freeProductsDisplayed, setFreeProductsDisplayed] = useState<Product[]>(
    () => getFreeProductsSnapshot() ?? []
  );
  const freeProductsDisplayedIdsRef = useRef<Set<string>>(
    new Set((getFreeProductsSnapshot() ?? []).map((p) => p.id))
  );
  const freeZeroRotationOffsetRef = useRef(0);
  const prevFreePoolLenRef = useRef(0);

  const freeProductsPool = useMemo(() => {
    if (zeroDollarsFeed.length > 0) {
      return zeroDollarsFeed;
    }

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
    zeroDollarsFeed,
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
    if (!ENABLE_HOME_ROTATION) {
      return;
    }
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
    if (!ENABLE_HOME_ROTATION) {
      rotationTimeouts.current.forEach(clearTimeout);
      rotationTimeouts.current = [];
      return;
    }
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

  // Rotation section « Zéro $ » : fenêtre glissante sur la liste déjà triée récent → ancien
  useEffect(() => {
    // Mode stable: on fige une fenêtre cohérente (pas de remplacement périodique des cartes).
    if (!ENABLE_HOME_ROTATION) {
      const pool = freeProductsPool;
      if (!pool.length) return;
      const stable = pool.slice(0, Math.min(FREE_DISPLAY_WINDOW, pool.length));
      setFreeProductsDisplayed(stable);
      freeProductsDisplayedIdsRef.current = new Set(stable.map((p) => p.id));
      writeFreeProductsCache(stable);
      return;
    }

    const pickNextFree = () => {
      if (isLocked.current) return;
      const pool = freeProductsPool;
      if (!pool.length) {
        return;
      }

      const n = pool.length;
      if (n !== prevFreePoolLenRef.current) {
        prevFreePoolLenRef.current = n;
        freeZeroRotationOffsetRef.current = 0;
      }

      const start = freeZeroRotationOffsetRef.current % n;
      const next: Product[] = [];
      const win = Math.min(FREE_DISPLAY_WINDOW, n);
      for (let i = 0; i < win; i++) {
        next.push(pool[(start + i) % n]);
      }
      freeZeroRotationOffsetRef.current =
        (freeZeroRotationOffsetRef.current + FREE_ROTATION_STEP) % n;

      setFreeProductsDisplayed(next);
      freeProductsDisplayedIdsRef.current = new Set(next.map((p) => p.id));

      writeFreeProductsCache(next);
    };

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
  // Chargement des données principales
  // ------------------------------------------------------------
  /**
   * Applique un feed au state. `pending` permet de réutiliser la requête déjà lancée
   * pendant le splash (`startHomeFeedPrefetch`) au lieu d'en émettre une nouvelle.
   */
  const fetchHomeData = useCallback(
    async (isRefresh = true, pending?: Promise<HomeFeedResult> | null) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
          setLoadingSections(true);
          setHasMore(true);
          setHomeFetchError(null);
          ROTATION_SECTIONS.forEach((section) => rotationCache.clear(section));
        }

        const result = await (pending ?? fetchHomeFeed(t));

        companyNameByIdRef.current = result.companyNameById;
        setZeroDollarsFeed(result.zeroPool);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
        setHomeFetchError(null);
        setHomeData(result.home);

        writeHomeFeedCache(result.home);
      } catch (error) {
        captureException(error, {
          screen: "PremiumHome",
          tags: { phase: "fetchHomeData" },
        });
        setHomeFetchError(
          "Impossible de mettre à jour l’accueil. Vérifiez votre connexion."
        );
      } finally {
        setRefreshing(false);
        setLoadingSections(false);
      }
    },
    [t, rotationCache]
  );

  // Chargement initial : cache mémoire (déjà peint) → prefetch du splash → réseau
  useEffect(() => {
    let isMounted = true;
    let cancelBgFetch: (() => void) | undefined;

    const bootstrapHome = async () => {
      // Le préchargement du splash a déjà émis les requêtes : on se contente de l'attendre.
      const pending = takeHomeFeedPrefetch();
      if (pending) {
        if (!paintedFromCacheRef.current) setLoadingSections(true);
        await fetchHomeData(false, pending);
        return;
      }

      // Sinon, on s'assure que le cache disque est en mémoire avant de décider quoi afficher.
      await primeHomeFeedCache();
      if (!isMounted) return;

      const cachedFree = getFreeProductsSnapshot();
      if (cachedFree?.length) {
        setFreeProductsDisplayed(cachedFree);
        freeProductsDisplayedIdsRef.current = new Set(cachedFree.map((p) => p.id));
      }

      const cachedHome = getHomeDataSnapshot();
      if (!cachedHome) {
        setLoadingSections(true);
        await fetchHomeData(false);
        return;
      }

      // Réhydratation immédiate (même TTL dépassé), puis SWR.
      // Le TTL est lu : un cache périmé ne doit jamais court-circuiter le refresh réseau.
      setHomeData(cachedHome);
      setLoadingSections(false);

      const cacheIsStale = isHomeCacheStale();
      if (cacheIsStale) {
        void fetchHomeData(false);
        return;
      }

      const id = setTimeout(() => {
        if (isMounted) void fetchHomeData(false);
      }, 0);
      cancelBgFetch = () => clearTimeout(id);
    };

    void bootstrapHome();

    return () => {
      isMounted = false;
      cancelBgFetch?.();
    };
  }, [fetchHomeData]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        if (!cancelled) void warmVisualSearchIndex();
      }, VISUAL_INDEX_DEFER_MS);
    });
    return () => {
      cancelled = true;
      task.cancel();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  /**
   * Une seule lecture catégories au départ : alimente CategoryGridPremium
   * et précharge les vignettes (sans 2e getDocs après interactions).
   */
  useEffect(() => {
    let mounted = true;
    void getCategories()
      .then((categories) => {
        if (mounted) setHomeCategories(categories);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!homeCategories.length) return;
    const task = InteractionManager.runAfterInteractions(() => {
      const uris = homeCategories
        .map((category) => normalizeImageUrl(category.image))
        .filter((uri): uri is string => Boolean(uri))
        .slice(0, 24);
      if (uris.length) {
        Image.prefetch(uris, "memory-disk").catch(() => {});
      }
    });
    return () => task.cancel();
  }, [homeCategories]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      revealBelowFold();
    });
    return () => task.cancel();
  }, [revealBelowFold]);

  const prefetchFromProducts = useCallback((products: Product[], max: number) => {
    const imageUris = products
      .flatMap((product) => [
        normalizeImageUrl(product.imageUrl),
        normalizeImageUrl(product.mainImage),
        ...((product.images || []).map((u) => normalizeImageUrl(u))),
      ])
      .filter((value): value is string => Boolean(value))
      .filter((value, index, array) => array.indexOf(value) === index)
      .filter((uri) => !prefetchedImageUrisRef.current.has(uri))
      .slice(0, max);

    if (!imageUris.length) return;

    imageUris.forEach((uri) => prefetchedImageUrisRef.current.add(uri));
    Image.prefetch(imageUris, "memory-disk").catch(() => {});
  }, []);

  useEffect(() => {
    const aboveFoldProducts = [
      ...homeData.featuredProducts,
      ...homeData.trendingProducts,
      ...homeData.newArrivals,
      ...homeData.popularProducts.slice(0, 30),
    ];

    const task = InteractionManager.runAfterInteractions(() => {
      prefetchFromProducts(aboveFoldProducts, listPerfConfig.prefetchBatch);
    });
    return () => task.cancel();
  }, [
    prefetchFromProducts,
    listPerfConfig.prefetchBatch,
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
    setLoadMoreError(false);
    try {
      const nextQ = query(
        collection(db, "products"),
        where("isActive", "==", true),
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(nextQ);
      if (!snap.empty) {
        const activeDocs = snap.docs.filter(isActiveProductDoc);
        const newCompanyIds = [
          ...new Set(
            activeDocs
              .map((d) => d.data()?.companyId)
              .filter(
                (id): id is string =>
                  typeof id === "string" && id.trim() !== ""
              )
              .map((id) => id.trim())
          ),
        ];
        const missing = newCompanyIds.filter(
          (id) => !companyNameByIdRef.current.has(id)
        );
        if (missing.length > 0) {
          const extra = await fetchCompanyDisplayNameMap(db, missing);
          extra.forEach((v, k) => companyNameByIdRef.current.set(k, v));
        }
        const nextItems = activeDocs.map((doc) =>
          resolveSupplierLabels(
            normalizeProduct(doc, t),
            companyNameByIdRef.current
          )
        );
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
      captureException(error, {
        screen: "PremiumHome",
        tags: { phase: "fetchMoreProducts" },
      });
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, lastVisible, homeData.popularProducts.length, t]);

  const buildCategoryPreviewPayload = useCallback(
    (item: Product) =>
      JSON.stringify({
        id: item.id,
        name: item.name,
        price: item.price,
        originalPrice: item.originalPrice || item.price,
        image:
          item.imageUrl ||
          item.mainImage ||
          (Array.isArray(item.images) && item.images[0] ? item.images[0] : "") ||
          "",
        images: item.images,
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

  const popularProductsData = useMemo(
    () => homeData.popularProducts,
    [homeData.popularProducts]
  );

  // Render item pour la FlashList (popular products)
  const renderPopularItem = useCallback(
    ({ item }: ListRenderItemInfo<Product>) => (
      <PopularProductItem
        item={item}
        onPress={handleProductPress}
      />
    ),
    [handleProductPress]
  );

  const keyExtractor = useCallback((item: Product) => item.id, []);

  const handleMomentumScrollBegin = useCallback(() => {
    onEndReachedLockRef.current = false;
  }, []);

  const handleEndReached = useCallback(() => {
    if (onEndReachedLockRef.current || loadingMore || !hasMore) {
      return;
    }
    onEndReachedLockRef.current = true;
    void fetchMoreProducts();
  }, [loadingMore, hasMore, fetchMoreProducts]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 35,
    minimumViewTime: 120,
  }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item?: Product; index?: number | null }> }) => {
      if (!Array.isArray(viewableItems) || viewableItems.length === 0) return;

      const indices = viewableItems
        .map((entry) => entry.index)
        .filter((index): index is number => typeof index === "number" && index >= 0);

      if (!indices.length) return;
      const maxVisibleIndex = Math.max(...indices);
      // Throttle léger : évite de recalculer le préfetch à chaque micro-scroll.
      if (maxVisibleIndex <= lastPrefetchAnchorIndexRef.current + 2) return;
      lastPrefetchAnchorIndexRef.current = maxVisibleIndex;
      const nearViewportCount = prefetchNearViewportRef.current;
      const nearViewport = popularProductsRef.current.slice(
        Math.max(0, maxVisibleIndex - 2),
        maxVisibleIndex + nearViewportCount
      );
      prefetchFromProducts(nearViewport, nearViewportCount);
    }
  ).current;

  const onMainListScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true }
      ),
    [scrollY]
  );

  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      if (value >= BELOW_FOLD_SCROLL_PX) {
        revealBelowFold();
      }
    });
    return () => {
      scrollY.removeListener(listenerId);
    };
  }, [scrollY, revealBelowFold]);

  const refreshControlNode = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={handleRefresh}
        colors={["#ff6a00"]}
        progressViewOffset={HEADER_HEIGHT}
      />
    ),
    [refreshing, handleRefresh, HEADER_HEIGHT]
  );

  const renderPopularEmpty = useCallback(() => {
    if (loadingSections) {
      return (
        <View style={styles.popularEmptyWrap}>
          <ActivityIndicator size="large" color="#ff6a00" />
          <Text style={styles.popularEmptyHint}>Chargement du catalogue…</Text>
        </View>
      );
    }
    if (homeFetchError) {
      return (
        <View style={styles.popularEmptyWrap}>
          <Ionicons name="cloud-offline-outline" size={40} color="#999" />
          <Text style={styles.popularEmptyTitle}>Aucun produit pour l’instant</Text>
          <Text style={styles.popularEmptyHint}>{homeFetchError}</Text>
          <TouchableOpacity
            style={styles.popularEmptyRetryBtn}
            onPress={() => void fetchHomeData(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.popularEmptyRetryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.popularEmptyWrap}>
        <Text style={styles.popularEmptyTitle}>Catalogue vide</Text>
        <Text style={styles.popularEmptyHint}>Revenez après le prochain import.</Text>
      </View>
    );
  }, [loadingSections, homeFetchError, fetchHomeData]);

  const handleRetryLoadMore = useCallback(() => {
    onEndReachedLockRef.current = false;
    void fetchMoreProducts();
  }, [fetchMoreProducts]);

  // ------------------------------------------------------------
  // Header mémoïsé avec les carrousels
  // ------------------------------------------------------------
  const renderHeader = useMemo(
    () => (
      <View style={styles.headerContent}>
        <View style={[styles.listHeaderSpacer, { height: HEADER_HEIGHT }]} />
        {homeFetchError ? (
          <View style={styles.homeErrorBanner}>
            <Ionicons name="warning-outline" size={20} color="#b45309" />
            <Text style={styles.homeErrorText}>{homeFetchError}</Text>
            <TouchableOpacity
              onPress={() => void fetchHomeData(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.homeErrorRetryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <PremiumHeaderStats />
        <View style={{ paddingVertical: 15 }}>
          <AnimatedQuickActions />
        </View>
        <FreeProductsSection products={freeProductsDisplayed} />

        <HeroBanner trendingProducts={homeData.trendingProducts} />

        {/* Section Produits en vedette */}
        {loadingSections && homeData.featuredProducts.length === 0 ? (
          <View style={{ marginTop: 30, marginBottom: 15 }}>
            <View style={styles.trendingHeaderContainer}>
              <View style={styles.trendingAccentBar} />
              <Text style={styles.trendingTitleText}>
                {t("app.premium.featuredHomeTitle")}
              </Text>
            </View>
            <CarouselSectionSkeleton cardWidthRatio={0.52} />
          </View>
        ) : null}
        {homeData.featuredProducts.length > 0 ? (
          <View style={{ marginTop: 30, marginBottom: 15 }}>
            
            {/* Header avec police ajustée et décalage */}
            <View style={styles.trendingHeaderContainer}>
              <View style={styles.trendingAccentBar} />
              <Text style={styles.trendingTitleText}>
                {t("app.premium.featuredHomeTitle")}
              </Text>
            </View>

            <FlatList
              data={homeData.featuredProducts}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => `featured-${item.id}`}
              initialNumToRender={3}
              maxToRenderPerBatch={3}
              windowSize={5}
              removeClippedSubviews={Platform.OS === "android"}
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
        ) : null}

        {/* Carousel des tendances du moment */}
        {homeData.trendingProducts.length > 0 && (
          <HorizontalProductCarousel
            title={t("app.premium.trendingSectionTitle")}
            subtitle={t("app.premium.trendingSectionSubtitle")}
            products={homeData.trendingProducts}
            onProductPress={handleProductPress}
            onSeeAll={handleSeeAllTrending}
            loading={loadingSections}
            uiLanguage={i18n.language}
            currencyCode={currency.code}
          />
        )}

        <CategoryGridPremium categories={homeCategories} />

        <PremiumAdBanner />

        {belowFoldReady && homeData.newArrivals.length > 0 && (
          <NewArrivalsPremium products={homeData.newArrivals} />
        )}

        {belowFoldReady && homeData.suppliersWithProducts.length > 0 && (
          <PremiumSuppliersSection suppliers={homeData.suppliersWithProducts} />
        )}

        {belowFoldReady ? (
          <VerticalProductSection
            title={t("newArrivals.homeGridTitle")}
            subtitle={t("newArrivals.homeGridSubtitle")}
            products={homeData.newArrivals}
            onProductPress={handleProductPress}
            onSeeAll={() => router.push('/new-arrivals')}
            loading={loadingSections}
            uiLanguage={i18n.language}
            currencyCode={currency.code}
          />
        ) : null}

        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>{t("app.premium.moreToExplore")}</Text>
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
      homeCategories,
      belowFoldReady,
      freeProductsDisplayed,
      loadingSections,
      handleProductPress,
      handleSeeAllTrending,
      handleSeeAllIndustrial,
      handleSeeAllOffers,
      handleSeeAllFeatured,
      HEADER_HEIGHT,
      homeFetchError,
      fetchHomeData,
      i18n.language,
      currency.code,
      t,
    ]
  );
  
  // Footer mémoïsé
  const renderFooter = useMemo(
    () => (
      <View style={styles.footerContent}>
        {loadMoreError ? (
          <TouchableOpacity
            style={styles.loadMoreErrorBox}
            onPress={handleRetryLoadMore}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh-outline" size={22} color="#ff6a00" />
            <Text style={styles.loadMoreErrorText}>
              Échec du chargement — toucher pour réessayer
            </Text>
          </TouchableOpacity>
        ) : null}
        {hasMore && !loadMoreError ? (
          <View style={styles.paginationSkeletonWrap}>
            <View style={styles.paginationSkeletonRow}>
              <View style={styles.paginationSkeletonCard} />
              <View style={styles.paginationSkeletonCard} />
            </View>
            {!loadingMore ? (
              <Text style={styles.paginationSkeletonHint}>Chargement des produits suivants…</Text>
            ) : null}
          </View>
        ) : null}
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
    [hasMore, loadingMore, loadMoreError, handleRetryLoadMore]
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
            <PremiumHeader />
          </Animated.View>
        </View>
      </View>

      <AnimatedFlashList
        data={popularProductsData}
        keyExtractor={keyExtractor}
        numColumns={2}
        nestedScrollEnabled
        estimatedItemSize={POPULAR_GRID_ITEM_ESTIMATED_SIZE}
        onEndReached={handleEndReached}
        onEndReachedThreshold={listPerfConfig.onEndReachedThreshold}
        onMomentumScrollBegin={handleMomentumScrollBegin}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListEmptyComponent={renderPopularEmpty}
        onScroll={onMainListScroll}
        ListHeaderComponent={renderHeader}
        renderItem={renderPopularItem}
        ListFooterComponent={renderFooter}
        refreshControl={refreshControlNode}
        contentContainerStyle={styles.listContent}
        initialNumToRender={listPerfConfig.initialNumToRender}
        drawDistance={listPerfConfig.windowSize * 240}
        removeClippedSubviews={listPerfConfig.removeClippedSubviews}
        extraData={listPerfConfig}
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
    paddingHorizontal: PRODUCT_GRID_GUTTER / 2,
    paddingBottom: 40,
  },
  b2bCardWrapper: {
    width: "100%",
    paddingHorizontal: PRODUCT_GRID_GUTTER / 2,
    marginBottom: 6,
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
  carouselListContent: {
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
  homeErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  homeErrorText: {
    flex: 1,
    fontSize: 13,
    color: "#92400e",
  },
  homeErrorRetryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ea580c",
  },
  popularEmptyWrap: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  popularEmptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
    marginTop: 12,
    textAlign: "center",
  },
  popularEmptyHint: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
  },
  popularEmptyRetryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#fff5eb",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ff6a00",
  },
  popularEmptyRetryText: {
    color: "#ff6a00",
    fontWeight: "700",
    fontSize: 15,
  },
  loadMoreErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 14,
    backgroundColor: "#fff5f5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  loadMoreErrorText: {
    flex: 1,
    fontSize: 14,
    color: "#b91c1c",
    fontWeight: "600",
  },
  paginationSkeletonWrap: {
    marginTop: 6,
    marginHorizontal: 12,
  },
  paginationSkeletonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  paginationSkeletonCard: {
    width: "48.5%",
    height: 290,
    borderRadius: 16,
    backgroundColor: "#efefef",
    borderWidth: 1,
    borderColor: "#f2f2f2",
  },
  paginationSkeletonHint: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 12,
    color: "#8a8a8a",
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