import React, { useEffect, useState, useMemo, memo, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocalizedProductText, languageVariants } from "../utils/productLocale";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  TextInput,
  InteractionManager,
} from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCategories, Category } from "../services/firebase/categoriesService";
import {
  getProductsByCategoryPaginated,
  getLatestProducts,
  Product,
} from "../services/firebase/productsService";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

const { width } = Dimensions.get("window");
const SIDEBAR_WIDTH = 100;
/** Première page produits : un peu plus petit = réponse Firestore plus rapide. */
const CATEGORY_PAGE_SIZE = 18;
const CATEGORIES_TAB_CACHE_KEY = "categories-tab-shell-v2";
const CATEGORIES_TAB_CACHE_TTL_MS = 10 * 60 * 1000;

type CategoryShellCache = {
  ts: number;
  rows: Array<{
    id: string;
    name: string;
    displayKey: string;
    productCount: number;
    name_en?: string;
    name_fr?: string;
    name_zh?: string;
    name_zh_CN?: string;
    nameZh?: string;
    nameZhCn?: string;
    name_cn?: string;
    localizedNames?: Record<string, unknown>;
    nameTranslations?: Record<string, unknown>;
    names?: Record<string, unknown>;
    i18n?: Record<string, unknown>;
    translations?: Record<string, unknown>;
    localized?: Record<string, unknown>;
    locale?: Record<string, unknown>;
    raw?: Record<string, unknown>;
  }>;
  menuIndex: number;
  activeCategoryId: string;
};

// ============= 1. LOGIQUE DE R?PARATION ET FUSION =============

/**
 * R?pare les erreurs d'encodage (? -> ?) et supprime les bruits
 */
const fixEncoding = (str: string): string => {
  if (!str) return "";
  try {
    // Tente de r?parer l'encodage ISO-8859-1 vers UTF-8
    return decodeURIComponent(escape(str)).replace(/\?/g, "");
  } catch (e) {
    // Si d?j? en UTF-8, on nettoie juste les "?"
    return str.replace(/\?/g, "");
  }
};

/**
 * Cle de dedoublonnage (minuscules, sans accents).
 * Pas de regroupement par mots-cles (electronique / maison / jardin).
 */
const categoryDedupKey = (name: string): string => {
  const clean = fixEncoding(name).trim();
  if (!clean) return "";
  return clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

/** Evite les doublons Firestore avec le meme id. */
const dedupeById = (cats: Category[]): Category[] => {
  const byId = new Map<string, Category>();
  cats.forEach((cat) => {
    if (!cat?.id) return;
    if (!byId.has(cat.id)) byId.set(cat.id, cat);
  });
  return Array.from(byId.values());
};

/** Évite les doublons d’id lors de fusions / courses pagination ↔ changement de catégorie. */
const mergeProductsById = (prev: Product[], incoming: Product[]): Product[] => {
  const seen = new Set(prev.map((p) => p.id).filter(Boolean));
  const out = [...prev];
  for (const p of incoming) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
};

const cleanCategories = (cats: Category[]): Category[] => {
  const map = new Map<string, Category>();
  const translatableKeys = [
    "name_en",
    "name_fr",
    "name_zh",
    "name_zh_CN",
    "nameZh",
    "nameZhCn",
    "name_cn",
    "localizedNames",
    "nameTranslations",
    "names",
    "i18n",
  ] as const;

  cats.forEach((cat) => {
    const nameRaw = cat.name || "";
    const displayName = fixEncoding(nameRaw).trim();
    const key = categoryDedupKey(nameRaw); // ex: "maison"

    if (!key) return;

    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.productCount = (existing.productCount || 0) + (cat.productCount || 0);
      for (const k of translatableKeys) {
        const existingVal = (existing as Record<string, unknown>)[k];
        const incomingVal = (cat as Record<string, unknown>)[k];
        if (!existingVal && incomingVal) {
          (existing as Record<string, unknown>)[k] = incomingVal;
        }
      }
    } else {
      // ON GARDE l'id original (cat.id) pour Firebase
      // MAIS on ajoute une propriété "displayKey" pour React
      map.set(key, { 
        ...cat, 
        name: displayName,
        // On crée une propriété personnalisée pour la prop 'key' de FlatList
        displayKey: key 
      });
    }
  });

  return Array.from(map.values());
};

/** Filtre noms vides / bruit uniquement (pas productCount). */
const filterUsableCategories = (cats: Category[]): Category[] => {
  return cats
    .filter((c) => {
      const n = (c.name || "").trim();
      // Un seul caractère peut être un libellé valide (ex. CJK).
      if (n.length < 1) return false;
      if (n === "?" || /^[\s?.]+$/.test(n)) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
};

// ============= 2. COMPOSANTS UI M?MO?S?S =============

const ProductCard = memo(
  function ProductCard({
    product,
    uiLanguage,
    onPress,
  }: {
    product: Product;
    uiLanguage: string;
    onPress: () => void;
  }) {
    const displayName = useMemo(
      () =>
        getLocalizedProductText(
          product.name,
          "name",
          product as unknown as Record<string, unknown>,
          uiLanguage,
        ),
      [product, uiLanguage],
    );
    return (
      <TouchableOpacity style={styles.inspiCard} onPress={onPress}>
        <View style={styles.inspiImageWrapper}>
          <Image
            source={{
              uri: product.mainImage || product.imageUrl || "https://via.placeholder.com/150",
            }}
            style={styles.inspiImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={50}
          />
          <View style={styles.scanBadge}>
            <Ionicons name="scan-outline" size={12} color="#666" />
          </View>
        </View>
        <View style={styles.inspiContent}>
          <Text style={styles.inspiPriceText}>
            {Math.round(Number(product.price)).toLocaleString()} FCFA
          </Text>
          <Text style={styles.inspiMinQty} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
      </TouchableOpacity>
    );
  },
  (prev, next) =>
    prev.product.id === next.product.id &&
    prev.uiLanguage === next.uiLanguage &&
    prev.product.name === next.product.name &&
    (prev.product.mainImage || prev.product.imageUrl) ===
      (next.product.mainImage || next.product.imageUrl),
);

const SIDEBAR_ROW_HEIGHT = 65;

const getLocalizedCategoryName = (
  category: Category & Record<string, unknown>,
  language: string,
): string => {
  const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  };

  const getByKeysCaseInsensitive = (
    obj: Record<string, unknown>,
    keys: string[],
  ): string | null => {
    const lowerMap = new Map<string, unknown>();
    Object.entries(obj).forEach(([k, v]) => lowerMap.set(k.toLowerCase(), v));
    for (const key of keys) {
      const v = lowerMap.get(key.toLowerCase());
      if (typeof v === "string" && v.trim()) return fixEncoding(v).trim();
    }
    return null;
  };

  const languageAliases = (lang: string): string[] => {
    const l = lang.toLowerCase();
    if (l.startsWith("zh")) return ["zh", "zh-cn", "zh_cn", "cn", "zh-hans", "zh_hans"];
    if (l.startsWith("fr")) return ["fr"];
    if (l.startsWith("en")) return ["en"];
    return [l];
  };

  const resolveInBuckets = (source: Record<string, unknown>, variants: string[]): string | null => {
    const buckets = [
      source.translations,
      source.localized,
      source.locale,
      source.i18n,
      source.localizedNames,
      source.nameTranslations,
      source.names,
    ];
    for (const bucketValue of buckets) {
      const bucket = asRecord(bucketValue);
      if (!bucket) continue;

      for (const v of variants) {
        for (const alias of languageAliases(v)) {
          const direct = bucket[alias];
          if (typeof direct === "string" && direct.trim()) return fixEncoding(direct).trim();

          const directObj = asRecord(direct);
          if (directObj) {
            const fromLangObj = getByKeysCaseInsensitive(directObj, ["name", "title", "label", "category"]);
            if (fromLangObj) return fromLangObj;
          }

          const fieldObj =
            asRecord(bucket.name) ||
            asRecord(bucket.title) ||
            asRecord(bucket.label) ||
            asRecord(bucket.category);
          if (fieldObj) {
            const fromField = getByKeysCaseInsensitive(fieldObj, [alias, alias.replace(/-/g, "_")]);
            if (fromField) return fromField;
          }
        }
      }
    }
    return null;
  };

  const variants = languageVariants(language);
  const sources: Record<string, unknown>[] = [
    category as Record<string, unknown>,
    ...(asRecord((category as Record<string, unknown>).raw) ? [asRecord((category as Record<string, unknown>).raw)!] : []),
  ];

  for (const source of sources) {
    const fromBuckets = resolveInBuckets(source, variants);
    if (fromBuckets) return fromBuckets;
  }

  for (const source of sources) {
    for (const v of variants) {
    const normalized = v.toLowerCase();
    const underscored = normalized.replace(/-/g, "_");
    const compact = underscored.replace(/_/g, "");
    const camelSuffix = underscored.replace(/(^|_)(\w)/g, (_m, _p1, c: string) => c.toUpperCase());
    const candidates = [
      `name_${normalized}`,
      `name_${underscored}`,
      `name_${compact}`,
      `name${camelSuffix}`,
      `name_${normalized.toUpperCase()}`,
      `name_${underscored.toUpperCase()}`,
      `name_${compact.toUpperCase()}`,
    ];
      const direct = getByKeysCaseInsensitive(source, candidates);
      if (direct) return direct;
      if (normalized.startsWith("zh")) {
        const zh = getByKeysCaseInsensitive(source, [
          "nameZh",
          "nameZhCn",
          "name_zh",
          "name_zh_CN",
          "name_cn",
        ]);
        if (zh) return zh;
      }
    }
  }

  const fallback = [
    category.name,
    category.label,
    category.title,
    category.categoryName,
    (category as Record<string, unknown>).categoryLabel,
  ].find((v) => typeof v === "string" && String(v).trim().length > 0);
  return fixEncoding(String(fallback || "")).trim();
};

const SidebarCategoryRow = memo(function SidebarCategoryRow({
  name,
  active,
  onPress,
  onPressIn,
}: {
  name: string;
  active: boolean;
  onPress: () => void;
  onPressIn: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.sidebarItem, active && styles.sidebarItemActive]}
      onPressIn={onPressIn}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {active ? <View style={styles.activeIndicator} /> : null}
      <Text style={[styles.sidebarText, active && styles.sidebarTextActive]} numberOfLines={2}>
        {name}
      </Text>
    </TouchableOpacity>
  );
});

// ============= 3. ?CRAN PRINCIPAL =============
export default function CategoriesScreen() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isMountedRef = useRef(true);
  /** Tirage-vers-bas : contourner le cache mémoire `getCategories` (2 min). */
  const forceNextCategoriesRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ?tats
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]); 
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]); 
  const [menuIndex, setMenuIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [categoryLastDoc, setCategoryLastDoc] = useState<any>(null);
  const [categoryHasMore, setCategoryHasMore] = useState(true);

  /** Lit le cache disque sans `setState` — fusion avec Firestore dans `initData` (évite d’écraser avec []). */
  const readShellCacheFromDisk = useCallback(async (): Promise<{
    rows: Category[];
    menuIndex: number;
    activeCategoryId: string;
  } | null> => {
    try {
      const raw = await AsyncStorage.getItem(CATEGORIES_TAB_CACHE_KEY);
      if (!raw || !isMountedRef.current) return null;
      const snap = JSON.parse(raw) as CategoryShellCache;
      if (
        !snap?.ts ||
        !Array.isArray(snap.rows) ||
        snap.rows.length === 0 ||
        Date.now() - snap.ts > CATEGORIES_TAB_CACHE_TTL_MS
      ) {
        return null;
      }
      const restored = snap.rows.map(
        (r) =>
          ({
            id: r.id,
            name: r.name,
            image: "",
            productCount: r.productCount ?? 0,
            displayKey: r.displayKey,
            name_en: r.name_en,
            name_fr: r.name_fr,
            name_zh: r.name_zh,
            name_zh_CN: r.name_zh_CN,
            nameZh: r.nameZh,
            nameZhCn: r.nameZhCn,
            name_cn: r.name_cn,
            localizedNames: r.localizedNames,
            nameTranslations: r.nameTranslations,
            names: r.names,
            i18n: r.i18n,
            translations: r.translations,
            localized: r.localized,
            locale: r.locale,
            raw: r.raw,
          }) as Category & { displayKey?: string },
      );
      return {
        rows: restored,
        menuIndex: snap.menuIndex,
        activeCategoryId: snap.activeCategoryId,
      };
    } catch {
      return null;
    }
  }, []);

  const persistShellCache = useCallback(
    async (cleaned: Category[], chosenId: string, menuIdx: number) => {
      try {
        const rows = cleaned.map((c) => ({
          id: c.id,
          name: c.name,
          displayKey: (c as Category & { displayKey?: string }).displayKey || c.id,
          productCount: c.productCount ?? 0,
          name_en: (c as Record<string, unknown>).name_en as string | undefined,
          name_fr: (c as Record<string, unknown>).name_fr as string | undefined,
          name_zh: (c as Record<string, unknown>).name_zh as string | undefined,
          name_zh_CN: (c as Record<string, unknown>).name_zh_CN as string | undefined,
          nameZh: (c as Record<string, unknown>).nameZh as string | undefined,
          nameZhCn: (c as Record<string, unknown>).nameZhCn as string | undefined,
          name_cn: (c as Record<string, unknown>).name_cn as string | undefined,
          localizedNames: (c as Record<string, unknown>).localizedNames as Record<string, unknown> | undefined,
          nameTranslations: (c as Record<string, unknown>).nameTranslations as Record<string, unknown> | undefined,
          names: (c as Record<string, unknown>).names as Record<string, unknown> | undefined,
          i18n: (c as Record<string, unknown>).i18n as Record<string, unknown> | undefined,
          translations: (c as Record<string, unknown>).translations as Record<string, unknown> | undefined,
          localized: (c as Record<string, unknown>).localized as Record<string, unknown> | undefined,
          locale: (c as Record<string, unknown>).locale as Record<string, unknown> | undefined,
          raw: (c as Record<string, unknown>).raw as Record<string, unknown> | undefined,
        }));
        const payload: CategoryShellCache = {
          ts: Date.now(),
          rows,
          menuIndex: menuIdx,
          activeCategoryId: chosenId,
        };
        await AsyncStorage.setItem(
          CATEGORIES_TAB_CACHE_KEY,
          JSON.stringify(payload),
        );
      } catch {
        /* ignore */
      }
    },
    [],
  );

  // Chargement Initial — shell dès les catégories ; « nouveautés » + grille en parallèle ; cache disque SWR.
  const initData = async () => {
    const forceCategories = forceNextCategoriesRef.current;
    try {
      // Cache disque + Firestore en parallèle ; si le réseau renvoie [] (timeout/erreur), on garde le cache disque.
      const [diskShell, allCats] = await Promise.all([
        !forceCategories ? readShellCacheFromDisk() : Promise.resolve(null),
        getCategories({ force: forceCategories }),
      ]);
      if (!isMountedRef.current) return;

      const sourceCats =
        allCats.length > 0 ? allCats : (diskShell?.rows ?? []);
      let cleaned = filterUsableCategories(
        cleanCategories(dedupeById(sourceCats)),
      );
      // Réseau renvoie des lignes illisibles / champs vides : dernier recours cache disque.
      if (cleaned.length === 0 && diskShell?.rows?.length) {
        cleaned = filterUsableCategories(
          cleanCategories(dedupeById(diskShell.rows)),
        );
      }
      setCategories(cleaned);
      setLoading(false);

      if (cleaned.length === 0) {
        return;
      }

      const prefExactKey = categoryDedupKey("Automobile et Moto");
      const autoKey = categoryDedupKey("Automobile");
      const motoKey = categoryDedupKey("Moto");

      const preferredCategory =
        cleaned.find((c) => categoryDedupKey(c.name) === prefExactKey) ||
        cleaned.find((c) => {
          const k = categoryDedupKey(c.name);
          return k.includes(autoKey) && k.includes(motoKey);
        }) ||
        cleaned
          .filter((c) => {
            const k = categoryDedupKey(c.name);
            return k.includes(autoKey) || k.includes(motoKey);
          })
          .reduce((best, cat) => {
            const bestScore = best.productCount || 0;
            const catScore = cat.productCount || 0;
            return catScore > bestScore ? cat : best;
          }, cleaned[0]);

      const bestByDemand = cleaned.reduce((best, cat) => {
        const bestScore = best.productCount || 0;
        const catScore = cat.productCount || 0;
        return catScore > bestScore ? cat : best;
      }, cleaned[0]);

      const chosen = preferredCategory || bestByDemand;
      const chosenIndex = cleaned.findIndex((c) => c.id === chosen.id);
      setActiveCategoryId(chosen.id);
      setMenuIndex(chosenIndex >= 0 ? chosenIndex : 0);

      // Chemin critique : grille catégorie d’abord (comme une marketplace). Les « nouveautés » arrivent après.
      await loadCategoryData(chosen.id, true);
      if (!isMountedRef.current) return;

      void persistShellCache(
        cleaned,
        chosen.id,
        chosenIndex >= 0 ? chosenIndex : 0,
      );

      void getLatestProducts(6).then((latest) => {
        if (isMountedRef.current) setRecentProducts(latest);
      });
    } catch (e) {
      console.error("Erreur lors du chargement :", e);
    } finally {
      forceNextCategoriesRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      void initData();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const imageUris = [
      ...recentProducts.map((item) => item.mainImage || item.imageUrl),
      ...displayedProducts.slice(0, 24).map((item) => item.mainImage || item.imageUrl),
    ]
      .filter(Boolean)
      .map((item) => String(item));

    if (!imageUris.length) {
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      Image.prefetch(imageUris, "memory-disk").catch(() => {});
    });
    return () => task.cancel();
  }, [displayedProducts, recentProducts]);

  const loadCategoryData = async (catId: string, reset: boolean) => {
    if (reset) {
      setCategoryLastDoc(null);
      setCategoryHasMore(true);
      setDisplayedProducts([]);
    }

    if (!reset && !categoryHasMore) return;
    if (!reset && loadingMoreProducts) return;
    if (reset) setProductsLoading(true);
    else setLoadingMoreProducts(true);

    try {
      const resp = await getProductsByCategoryPaginated(
        catId,
        CATEGORY_PAGE_SIZE,
        reset ? undefined : categoryLastDoc
      );

      setDisplayedProducts((prev) =>
        reset ? mergeProductsById([], resp.products) : mergeProductsById(prev, resp.products),
      );
      setCategoryLastDoc(resp.lastDoc);
      setCategoryHasMore(resp.hasMore);
    } catch (e) {
      console.error(e);
    } finally {
      setProductsLoading(false);
      setLoadingMoreProducts(false);
    }
  };

  const loadMoreForActiveCategory = () => {
    if (!activeCategoryId) return;
    if (productsLoading || loadingMoreProducts) return;
    void loadCategoryData(activeCategoryId, false);
  };

  // Filtrage local pour la recherche
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return displayedProducts;
    const query = searchQuery.toLowerCase();
    return displayedProducts.filter((p) => {
      const localizedName = getLocalizedProductText(
        p.name,
        "name",
        p as unknown as Record<string, unknown>,
        i18n.language,
      ).toLowerCase();
      const localizedDescription = getLocalizedProductText(
        p.description,
        "description",
        p as unknown as Record<string, unknown>,
        i18n.language,
      ).toLowerCase();
      return localizedName.includes(query) || localizedDescription.includes(query);
    });
  }, [displayedProducts, searchQuery, i18n.language]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => {
      map.set(
        cat.id,
        getLocalizedCategoryName(
          cat as Category & Record<string, unknown>,
          i18n.language,
        ) || cat.name,
      );
    });
    return map;
  }, [categories, i18n.language]);

  const renderListHeader = useCallback(
    () => (
      <View>
        <Text style={styles.rightSectionTitle}>{t("app.categoriesScreen.sectionNew")}</Text>

        <View style={styles.circularGrid}>
          {recentProducts && recentProducts.length > 0 ? (
            recentProducts.map((p, index) => (
              <TouchableOpacity
                key={`recent-circle-${index}-${p.id ?? ""}`}
                style={styles.circularContainer}
                onPress={() => router.push(`/product/${p.id}`)}
              >
                <View style={styles.circleImageWrapper}>
                  <Image
                    source={{ uri: p.mainImage || p.imageUrl }}
                    style={styles.circleImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={50}
                  />
                </View>
                <Text style={styles.circleText} numberOfLines={1}>
                  {t("app.categoriesScreen.badgeNew")}
                </Text>
              </TouchableOpacity>
            ))
          ) : null}
        </View>

        <Text style={styles.rightSectionTitle}>{t("app.categoriesScreen.sectionInspire")}</Text>
      </View>
    ),
    [t, recentProducts],
  );

  if (loading && categories.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff6a00" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.mainWrapper}>
      {/* HEADER DE RECHERCHE � sous la barre d��tat (heure, r�seau, batterie) */}
      <View
        style={[
          styles.topHeader,
          { paddingTop: insets.top + 8, paddingBottom: 10 },
        ]}
      >
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#999" />
          <TextInput 
            style={styles.searchInput} 
            placeholder={t("app.categoriesScreen.searchPlaceholder")}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
        </View>
      </View>

      <View style={styles.splitLayout}>
        {/* SIDEBAR GAUCHE (CATEGORIES) */}
        <View style={styles.leftColumn}>
<FlatList
  data={categories}
  keyExtractor={(item, index) =>
    `${(item as Category & { displayKey?: string }).displayKey || item.id || "cat"}-${index}`
  }
  initialNumToRender={16}
  maxToRenderPerBatch={20}
  windowSize={11}
  getItemLayout={(_, index) => ({
    length: SIDEBAR_ROW_HEIGHT,
    offset: SIDEBAR_ROW_HEIGHT * index,
    index,
  })}
  renderItem={({ item, index }) => (
    <SidebarCategoryRow
      name={categoryNameById.get(item.id) || item.name}
      active={menuIndex === index}
      onPressIn={() => {
        try {
          router.prefetch({
            pathname: "/category/[id]",
            params: {
              id: item.id,
              categoryName: categoryNameById.get(item.id) || item.name,
            },
          });
        } catch {
          /* optionnel */
        }
      }}
      onPress={() => {
        setMenuIndex(index);
        setActiveCategoryId(item.id);
        void loadCategoryData(item.id, true);
      }}
    />
  )}
  showsVerticalScrollIndicator={false}
/>
        </View>

        {/* CONTENU DROIT (GRILLE PRODUITS) */}
        <View style={styles.rightColumn}>
          <FlatList
            data={filteredProducts}
            keyExtractor={(item, index) => `${item.id ?? "product"}-${index}`}
            numColumns={2}
            ListHeaderComponent={renderListHeader}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                uiLanguage={i18n.language}
                onPress={() => router.push(`/product/${item.id}`)}
              />
            )}
            onRefresh={() => {
              setRefreshing(true);
              forceNextCategoriesRef.current = true;
              void initData();
            }}
            refreshing={refreshing}
            ListEmptyComponent={
              (productsLoading || loadingMoreProducts) ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <ActivityIndicator color="#ff6a00" />
                </View>
              ) : null
            }
            ListFooterComponent={
              loadingMoreProducts ? (
                <ActivityIndicator color="#ff6a00" style={{ margin: 20 }} />
              ) : (
                <View style={{ height: 40 }} />
              )
            }
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            removeClippedSubviews={true}
            onEndReachedThreshold={0.4}
            onEndReached={loadMoreForActiveCategory}
            initialNumToRender={10}
            maxToRenderPerBatch={12}
            windowSize={10}
            updateCellsBatchingPeriod={50}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  topHeader: {
    paddingHorizontal: 15,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f4",
    backgroundColor: "#fff",
  },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#f2f2f2", borderRadius: 20, paddingHorizontal: 15, height: 38 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#333" },
  splitLayout: { flex: 1, flexDirection: "row" },
  
  // Sidebar Styles
  leftColumn: { width: SIDEBAR_WIDTH, backgroundColor: "#f8f8f8" },
  sidebarItem: { height: 65, justifyContent: "center", alignItems: "center", padding: 5, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  sidebarItemActive: { backgroundColor: "#fff" },
  activeIndicator: { position: "absolute", left: 0, height: 25, width: 4, backgroundColor: "#ff6a00", borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  sidebarText: { fontSize: 11, color: "#666", textAlign: "center" },
  sidebarTextActive: { color: "#000", fontWeight: "bold" },
  
  // Right Column Styles
  rightColumn: { flex: 1, paddingHorizontal: 10 },
  rightSectionTitle: { fontSize: 14, fontWeight: "bold", marginVertical: 15, color: "#222" },
  circularGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  circularContainer: { width: "33.33%", alignItems: "center", marginBottom: 15 },
  circleImageWrapper: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f0f0f0", overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  circleImage: { width: "100%", height: "100%" },
  circleText: { fontSize: 10, color: "#999", marginTop: 6, fontWeight: "500" },
  
  // Product Card Styles
  inspiCard: { width: "48%", marginBottom: 15 },
  inspiImageWrapper: { width: "100%", aspectRatio: 1, borderRadius: 10, backgroundColor: "#f9f9f9", overflow: "hidden" },
  inspiImage: { width: "100%", height: "100%" },
  scanBadge: { position: "absolute", bottom: 6, left: 6, backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 12, padding: 4 },
  inspiContent: { paddingVertical: 8 },
  inspiPriceText: { fontSize: 14, fontWeight: "bold", color: "#ff6a00" },
  inspiMinQty: { fontSize: 11, color: "#666", marginTop: 2 }
});
