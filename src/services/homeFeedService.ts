/**
 * @file homeFeedService.ts
 * @description Couche données de l'accueil : requêtes Firestore, cache mémoire + disque
 * et déduplication du préchargement lancé au démarrage de l'application.
 *
 * Le but est que `app/(tabs)/index.tsx` puisse peindre son premier frame avec de vraies
 * données (snapshot mémoire synchrone) au lieu d'attendre une lecture AsyncStorage
 * suivie d'une cascade de requêtes réseau.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "../config/firebase";
import {
  fetchCompanyDisplayNameMap,
  resolveSupplierLabels,
} from "../utils/companyDisplayName";
import { getClientPriceXOF } from "../utils/productPrice";

/** Traducteur injecté : `normalizeProduct` traduit les noms qui sont des clés i18n. */
export type Translate = (key: string) => string;

export interface Product {
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
  companyId?: string;
  /** companyData.name sur le document Firestore produit */
  embeddedCompanyName?: string;
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

export interface HomeDataState {
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

export const DEFAULT_CATEGORIES: HomeDataState["categories"] = [
  { id: "1", name: "category.electronics", icon: "?", color: "#ff6a00" },
  { id: "2", name: "category.clothing", icon: "??", color: "#4CAF50" },
  { id: "3", name: "category.machinery", icon: "??", color: "#2196F3" },
  { id: "4", name: "category.materials", icon: "??", color: "#9C27B0" },
];

export const EMPTY_POOLS: HomeDataState["pools"] = {
  featured: [],
  trending: [],
  offers: [],
  newArrivals: [],
  industrial: [],
};

export const EMPTY_HOME_DATA: HomeDataState = {
  featuredProducts: [],
  trendingProducts: [],
  specialOffers: [],
  popularProducts: [],
  newArrivals: [],
  industrialMachines: [],
  suppliersWithProducts: [],
  categories: DEFAULT_CATEGORIES,
  pools: EMPTY_POOLS,
};

export const HOME_CACHE_KEY = "premium-home-cache-v3";
export const HOME_CACHE_TTL_MS = 10 * 60 * 1000;
export const FREE_CACHE_KEY = "premium-free-cache-v1";

/** Premier chargement du flux « populaires » : un peu plus large pour remplir l’écran. */
export const POPULAR_INITIAL_LIMIT = 24;
/** Surcroît Firestore avant dédoublonnage inter-sections (featured / trending / newArrival). */
const FLAGGED_FETCH_LIMIT = 30;
const FEATURED_DISPLAY_LIMIT = 20;
const TRENDING_DISPLAY_LIMIT = 20;
const NEW_ARRIVALS_DISPLAY_LIMIT = 16;
/** Aligné sur `shop/zero-dollars` : prix 0 ou 1 FCFA, affichés du plus récent au plus ancien. */
export const ZERO_DOLLARS_FEED_LIMIT = 50;
/** Au-delà de ce délai, un préchargement de démarrage est considéré comme périmé. */
const PREFETCH_MAX_AGE_MS = 90 * 1000;

export const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

function timestampMs(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    typeof (value as { toMillis?: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function docCreatedMsSnap(d: QueryDocumentSnapshot): number {
  return timestampMs(d.data()?.createdAt);
}

/** Aligné sur l’écran catégorie : seuls les documents `isActive == true` sont catalogue. */
export function isActiveProductDoc(d: QueryDocumentSnapshot): boolean {
  return d.data()?.isActive === true;
}

/** Activité récente d’une company : updatedAt > createdAt > lastActive*. */
function docActivityMs(d: QueryDocumentSnapshot): number {
  const data = d.data() ?? {};
  return Math.max(
    timestampMs(data.updatedAt),
    timestampMs(data.createdAt),
    timestampMs(data.lastActiveAt),
    timestampMs(data.lastActive),
  );
}

type FlaggedProductField = "featured" | "trending" | "newArrival";

/**
 * Produits flaggés, plus récents d’abord. Si l’index composite Firestore
 * (flag + createdAt) n’existe pas encore, on retombe sur un overscan + tri client.
 */
async function fetchFlaggedProductDocs(
  flag: FlaggedProductField,
  maxDocs: number,
): Promise<QueryDocumentSnapshot[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "products"),
        where(flag, "==", true),
        where("isActive", "==", true),
        orderBy("createdAt", "desc"),
        limit(maxDocs),
      ),
    );
    return snap.docs.filter(isActiveProductDoc);
  } catch (e) {
    if (__DEV__) {
      console.warn(
        `[home] ${flag} — requête isActive+orderBy indisponible, fallback`,
        e,
      );
    }
    try {
      const snap = await getDocs(
        query(
          collection(db, "products"),
          where(flag, "==", true),
          orderBy("createdAt", "desc"),
          limit(Math.min(maxDocs * 3, 80)),
        ),
      );
      return snap.docs.filter(isActiveProductDoc).slice(0, maxDocs);
    } catch {
      try {
        const snap = await getDocs(
          query(
            collection(db, "products"),
            where(flag, "==", true),
            limit(Math.min(maxDocs * 3, 80)),
          ),
        );
        return [...snap.docs]
          .filter(isActiveProductDoc)
          .sort((a, b) => docCreatedMsSnap(b) - docCreatedMsSnap(a))
          .slice(0, maxDocs);
      } catch {
        return [];
      }
    }
  }
}

const SUPPLIER_TARGET = 6;
const SUPPLIER_OVERSCAN = 24;
const PRODUCTS_PER_SUPPLIER = 3;

async function fetchVerifiedCompanyDocs(
  maxDocs: number,
): Promise<QueryDocumentSnapshot[]> {
  const compare = (a: QueryDocumentSnapshot, b: QueryDocumentSnapshot) =>
    docActivityMs(b) - docActivityMs(a);

  try {
    const snap = await getDocs(
      query(
        collection(db, "companies"),
        where("isVerified", "==", true),
        orderBy("updatedAt", "desc"),
        limit(maxDocs),
      ),
    );
    return [...snap.docs]
      .filter((d) => d.data()?.isActive !== false)
      .sort(compare);
  } catch (e1) {
    try {
      const snap = await getDocs(
        query(
          collection(db, "companies"),
          where("isVerified", "==", true),
          orderBy("createdAt", "desc"),
          limit(maxDocs),
        ),
      );
      return [...snap.docs]
        .filter((d) => d.data()?.isActive !== false)
        .sort(compare);
    } catch (e2) {
      if (__DEV__) {
        console.warn(
          "[home] fournisseurs — orderBy indisponible, tri côté client",
          e2 ?? e1,
        );
      }
      try {
        const snap = await getDocs(
          query(
            collection(db, "companies"),
            where("isVerified", "==", true),
            limit(maxDocs),
          ),
        );
        return [...snap.docs]
          .filter((d) => d.data()?.isActive !== false)
          .sort(compare);
      } catch {
        return [];
      }
    }
  }
}

async function fetchRecentProductsForCompanies(
  companyIds: string[],
  translate: Translate,
): Promise<Map<string, Product[]>> {
  const productsBySupplier = new Map<string, Product[]>();
  if (companyIds.length === 0) return productsBySupplier;

  const chunks: string[][] = [];
  for (let i = 0; i < companyIds.length; i += 10) {
    chunks.push(companyIds.slice(i, i + 10));
  }

  const snaps = await Promise.all(
    chunks.map(async (ids) => {
      const maxDocs = Math.min(ids.length * 8, 40);
      try {
        return await getDocs(
          query(
            collection(db, "products"),
            where("companyId", "in", ids),
            where("isActive", "==", true),
            orderBy("createdAt", "desc"),
            limit(maxDocs),
          ),
        );
      } catch (e) {
        if (__DEV__) {
          console.warn(
            "[home] produits fournisseurs — requête isActive indisponible, fallback",
            e,
          );
        }
        try {
          return await getDocs(
            query(
              collection(db, "products"),
              where("companyId", "in", ids),
              orderBy("createdAt", "desc"),
              limit(maxDocs),
            ),
          );
        } catch (e2) {
          if (__DEV__) {
            console.warn(
              "[home] produits fournisseurs — orderBy indisponible, tri côté client",
              e2,
            );
          }
          return getDocs(
            query(
              collection(db, "products"),
              where("companyId", "in", ids),
              limit(Math.min(maxDocs * 2, 80)),
            ),
          );
        }
      }
    }),
  );

  for (const snap of snaps) {
    const docs = [...snap.docs].sort(
      (a, b) => docCreatedMsSnap(b) - docCreatedMsSnap(a),
    );
    for (const doc of docs) {
      if (!isActiveProductDoc(doc)) continue;
      const companyId =
        typeof doc.data()?.companyId === "string"
          ? String(doc.data().companyId).trim()
          : "";
      if (!companyId) continue;
      const list = productsBySupplier.get(companyId) ?? [];
      if (list.length >= PRODUCTS_PER_SUPPLIER) continue;
      list.push(normalizeProduct(doc, translate));
      productsBySupplier.set(companyId, list);
    }
  }

  return productsBySupplier;
}

/** Normalisation produit (identique à l'ancienne implémentation locale de l'accueil). */
export function normalizeProduct(doc: any, translate: Translate): Product {
  const data = doc.data();
  const companyData = data.companyData;
  const embeddedFromSnapshot =
    companyData &&
    typeof companyData === "object" &&
    typeof (companyData as { name?: string }).name === "string"
      ? String((companyData as { name: string }).name).trim()
      : "";
  const name = data.name || "";
  const rawCat = data.categoryName || data.category || "";
  const cleanCategory =
    rawCat === "Uncategorized" || rawCat === "uncategorized" ? "" : rawCat;

  const createdAtMillis =
    typeof data?.createdAt?.toMillis === "function"
      ? data.createdAt.toMillis()
      : typeof data?.createdAt === "number"
        ? data.createdAt
        : null;

  const catalogName = name.includes(".") ? translate(name) : name;

  return {
    ...(typeof data === "object" && data ? data : {}),
    id: doc.id,
    name: catalogName,
    price: getClientPriceXOF(data),
    originalPrice: Number(data.originalPrice) || getClientPriceXOF(data),
    imageUrl: data.mainImage || data.imageUrl || null,
    mainImage: data.mainImage || data.imageUrl || null,
    createdAt: createdAtMillis,
    rating: data.rating || 0,
    stock: data.stockQuantity || data.stock || 0,
    supplier: data.supplier || data.companyName || "Fournisseur",
    companyName: data.companyName || "",
    companyId:
      typeof data.companyId === "string" && data.companyId.trim() !== ""
        ? data.companyId.trim()
        : "",
    embeddedCompanyName: embeddedFromSnapshot || undefined,
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
}

/** Même critère que la page boutique Zéro $ : `price` ∈ {0, 1}, tri `createdAt` décroissant si l’index existe. */
export async function fetchZeroDollarsProductDocs(
  maxDocs: number,
): Promise<QueryDocumentSnapshot[]> {
  try {
    const q = query(
      collection(db, "products"),
      where("price", "in", [0, 1]),
      where("isActive", "==", true),
      orderBy("createdAt", "desc"),
      limit(maxDocs),
    );
    const snap = await getDocs(q);
    return snap.docs.filter(isActiveProductDoc);
  } catch (e) {
    if (__DEV__) {
      console.warn(
        "[home] Zéro $ — requête isActive+orderBy indisponible, fallback",
        e,
      );
    }
    try {
      const q2 = query(
        collection(db, "products"),
        where("price", "in", [0, 1]),
        orderBy("createdAt", "desc"),
        limit(Math.min(maxDocs * 3, 100)),
      );
      const snap = await getDocs(q2);
      return [...snap.docs]
        .filter(isActiveProductDoc)
        .sort((a, b) => docCreatedMsSnap(b) - docCreatedMsSnap(a))
        .slice(0, maxDocs);
    } catch {
      try {
        const q3 = query(
          collection(db, "products"),
          where("price", "in", [0, 1]),
          limit(Math.min(maxDocs * 3, 100)),
        );
        const snap = await getDocs(q3);
        return [...snap.docs]
          .filter(isActiveProductDoc)
          .sort((a, b) => docCreatedMsSnap(b) - docCreatedMsSnap(a))
          .slice(0, maxDocs);
      } catch {
        return [];
      }
    }
  }
}

export async function fetchSuppliersWithProducts(
  translate: Translate,
): Promise<any[]> {
  try {
    const companyDocs = await fetchVerifiedCompanyDocs(SUPPLIER_OVERSCAN);
    if (companyDocs.length === 0) return [];

    const suppliers = companyDocs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const productsBySupplier = await fetchRecentProductsForCompanies(
      suppliers.map((s) => s.id),
      translate,
    );

    return suppliers
      .map((supplier) => {
        const products = [...(productsBySupplier.get(supplier.id) || [])]
          .sort(
            (a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0),
          )
          .slice(0, PRODUCTS_PER_SUPPLIER);
        return {
          ...supplier,
          products,
          productCount: products.length,
        };
      })
      .filter((s) => s.productCount > 0)
      .slice(0, SUPPLIER_TARGET);
  } catch (e) {
    console.error("fetchSuppliersWithProducts error", e);
    return [];
  }
}

export type HomeFeedResult = {
  home: HomeDataState;
  /** Pool « Zéro $ » complet (non persisté : volumineux et très volatil). */
  zeroPool: Product[];
  /** Curseur de pagination des « populaires » (non sérialisable). */
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
  companyNameById: Map<string, string>;
};

async function fetchPopularProductDocs(
  maxDocs: number,
): Promise<QueryDocumentSnapshot[]> {
  try {
    const snap = await getDocs(
      query(
        collection(db, "products"),
        where("isActive", "==", true),
        orderBy("createdAt", "desc"),
        limit(maxDocs),
      ),
    );
    return snap.docs.filter(isActiveProductDoc);
  } catch (e) {
    if (__DEV__) {
      console.warn(
        "[home] populaires — requête isActive indisponible, fallback",
        e,
      );
    }
    const snap = await getDocs(
      query(
        collection(db, "products"),
        orderBy("createdAt", "desc"),
        limit(Math.min(maxDocs * 3, 80)),
      ),
    );
    return snap.docs.filter(isActiveProductDoc).slice(0, maxDocs);
  }
}

/**
 * Charge en parallèle toutes les sections de l'accueil.
 * Fonction pure (aucun state React) : appelable avant le montage de l'écran.
 */
export async function fetchHomeFeed(
  translate: Translate,
): Promise<HomeFeedResult> {
  const [featDocs, trendDocs, popDocs, newDocs, suppliersWithProducts, zeroDollarDocs] =
    await Promise.all([
      fetchFlaggedProductDocs("featured", FLAGGED_FETCH_LIMIT),
      fetchFlaggedProductDocs("trending", FLAGGED_FETCH_LIMIT),
      fetchPopularProductDocs(POPULAR_INITIAL_LIMIT),
      fetchFlaggedProductDocs("newArrival", FLAGGED_FETCH_LIMIT),
      fetchSuppliersWithProducts(translate),
      fetchZeroDollarsProductDocs(ZERO_DOLLARS_FEED_LIMIT).catch(
        (): QueryDocumentSnapshot[] => [],
      ),
    ]);

  const companyIdSet = new Set<string>();
  const collectCompanyIds = (docs: QueryDocumentSnapshot[]) => {
    docs.forEach((d) => {
      const id = d.data()?.companyId;
      if (typeof id === "string" && id.trim() !== "") {
        companyIdSet.add(id.trim());
      }
    });
  };
  collectCompanyIds(featDocs);
  collectCompanyIds(trendDocs);
  collectCompanyIds(popDocs);
  collectCompanyIds(newDocs);
  zeroDollarDocs.forEach((d) => {
    const id = d.data()?.companyId;
    if (typeof id === "string" && id.trim() !== "") {
      companyIdSet.add(id.trim());
    }
  });
  suppliersWithProducts.forEach((s: { id?: string }) => {
    if (typeof s?.id === "string" && s.id) companyIdSet.add(s.id);
  });

  // Ne pas attendre companies/{id} : le feed se peint avec embeddedCompanyName /
  // companyName déjà sur le produit. Les noms live remplissent la Map en fond.
  const companyNameById = new Map<string, string>();
  void fetchCompanyDisplayNameMap(db, [...companyIdSet])
    .then((liveNames) => {
      liveNames.forEach((label, id) => companyNameById.set(id, label));
    })
    .catch(() => {});

  const mapProduct = (doc: QueryDocumentSnapshot) =>
    resolveSupplierLabels(normalizeProduct(doc, translate), companyNameById);

  const zeroPool = zeroDollarDocs.map((doc) => mapProduct(doc));
  const featuredPool = featDocs.map((doc) => mapProduct(doc));
  const trendingPool = trendDocs.map((doc) => mapProduct(doc));
  const newArrivalsPool = newDocs.map((doc) => mapProduct(doc));
  const allPopular = popDocs.map((doc) => mapProduct(doc));

  const suppliersWithProductsResolved = suppliersWithProducts.map(
    (s: {
      id?: string;
      name?: string;
      products?: Product[];
      [key: string]: unknown;
    }) => {
      const resolved = resolveSupplierLabels(
        {
          supplier: String(s.name || ""),
          companyName: s.name != null ? String(s.name) : undefined,
          companyId: s.id,
        },
        companyNameById,
      );
      return {
        ...s,
        name: resolved.supplier,
        products: Array.isArray(s.products)
          ? s.products.map((p) => resolveSupplierLabels(p, companyNameById))
          : s.products,
      };
    },
  );

  const seenProductIds = new Set<string>();

  const featuredProducts = featuredPool
    .filter((product) => Boolean(product?.id))
    .slice(0, FEATURED_DISPLAY_LIMIT);
  featuredProducts.forEach((product) => seenProductIds.add(product.id));

  const trendingProducts = trendingPool
    .filter((product) => product?.id && !seenProductIds.has(product.id))
    .slice(0, TRENDING_DISPLAY_LIMIT);
  trendingProducts.forEach((product) => seenProductIds.add(product.id));

  const newArrivals = newArrivalsPool
    .filter((product) => product?.id && !seenProductIds.has(product.id))
    .slice(0, NEW_ARRIVALS_DISPLAY_LIMIT);

  const home: HomeDataState = {
    featuredProducts,
    trendingProducts,
    specialOffers: [],
    popularProducts: allPopular,
    newArrivals,
    industrialMachines: [],
    suppliersWithProducts: suppliersWithProductsResolved,
    categories: DEFAULT_CATEGORIES,
    pools: {
      featured: featuredProducts,
      trending: trendingProducts,
      offers: [],
      newArrivals,
      industrial: [],
    },
  };

  return {
    home,
    zeroPool,
    lastDoc: popDocs[popDocs.length - 1] ?? null,
    hasMore: popDocs.length >= 20,
    companyNameById,
  };
}

// ------------------------------------------------------------
// Cache mémoire + disque
// ------------------------------------------------------------

let memoryHomeData: HomeDataState | null = null;
let memoryHomeCachedAt: number | null = null;
let memoryFreeProducts: Product[] | null = null;
let diskPrimePromise: Promise<void> | null = null;

/**
 * Lecture synchrone du dernier feed connu.
 * Renseignée par `primeHomeFeedCache()` (démarrage) ou par `writeHomeFeedCache()`.
 */
export function getHomeDataSnapshot(): HomeDataState | null {
  return memoryHomeData;
}

/** Horodatage du cache home actuellement en mémoire (ms epoch), ou null. */
export function getHomeCacheTimestamp(): number | null {
  return memoryHomeCachedAt;
}

/**
 * True si aucune donnée, timestamp manquant, ou age > HOME_CACHE_TTL_MS (10 min).
 * Un cache périmé peut toujours être peint (SWR) mais ne doit pas bloquer un refresh.
 */
export function isHomeCacheStale(): boolean {
  if (!memoryHomeData) return true;
  if (typeof memoryHomeCachedAt !== "number" || memoryHomeCachedAt <= 0) {
    return true;
  }
  return Date.now() - memoryHomeCachedAt > HOME_CACHE_TTL_MS;
}

/** Lecture synchrone de la fenêtre « Zéro $ » précédemment affichée. */
export function getFreeProductsSnapshot(): Product[] | null {
  return memoryFreeProducts;
}

/**
 * Charge le cache disque en mémoire, une seule fois par session.
 * Appelée au démarrage pour que l'accueil dispose de données dès son premier render.
 * Le TTL est lu : un cache trop vieux reste utilisable pour le paint, mais est marqué stale.
 */
export function primeHomeFeedCache(): Promise<void> {
  if (diskPrimePromise) return diskPrimePromise;

  diskPrimePromise = (async () => {
    try {
      const [freeRaw, homeRaw] = await Promise.all([
        AsyncStorage.getItem(FREE_CACHE_KEY),
        AsyncStorage.getItem(HOME_CACHE_KEY),
      ]);

      if (freeRaw && !memoryFreeProducts) {
        try {
          const parsed = JSON.parse(freeRaw) as Product[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryFreeProducts = parsed;
          }
        } catch {
          /* cache corrompu : ignoré */
        }
      }

      if (homeRaw && !memoryHomeData) {
        try {
          const parsed = JSON.parse(homeRaw) as {
            timestamp?: number;
            data?: HomeDataState;
          };
          if (parsed?.data) {
            const timestamp =
              typeof parsed.timestamp === "number" && parsed.timestamp > 0
                ? parsed.timestamp
                : 0;
            memoryHomeCachedAt = timestamp;
            memoryHomeData = {
              ...parsed.data,
              categories: parsed.data.categories?.length
                ? parsed.data.categories
                : DEFAULT_CATEGORIES,
              pools: parsed.data.pools || EMPTY_POOLS,
            };
            if (__DEV__ && isHomeCacheStale()) {
              const ageMin =
                timestamp > 0
                  ? Math.round((Date.now() - timestamp) / 60000)
                  : null;
              console.log(
                `[home] cache disque périmé (TTL ${HOME_CACHE_TTL_MS / 60000} min${
                  ageMin != null ? `, âge ${ageMin} min` : ", sans timestamp"
                }) — paint SWR puis refresh réseau`,
              );
            }
          }
        } catch {
          /* cache corrompu : ignoré */
        }
      }
    } catch {
      /* AsyncStorage indisponible : on repart du réseau */
    }
  })();

  return diskPrimePromise;
}

export function writeHomeFeedCache(data: HomeDataState): void {
  memoryHomeData = data;
  memoryHomeCachedAt = Date.now();
  void AsyncStorage.setItem(
    HOME_CACHE_KEY,
    JSON.stringify({ timestamp: memoryHomeCachedAt, data }),
  ).catch(() => {});
}

export function writeFreeProductsCache(items: Product[]): void {
  memoryFreeProducts = items;
  void AsyncStorage.setItem(FREE_CACHE_KEY, JSON.stringify(items)).catch(
    () => {},
  );
}

// ------------------------------------------------------------
// Préchargement réseau dédupliqué (démarrage → montage de l'accueil)
// ------------------------------------------------------------

let prefetchPromise: Promise<HomeFeedResult> | null = null;
let prefetchStartedAt = 0;

/**
 * Lance (ou réutilise) le chargement réseau du feed.
 * Appelée pendant le splash pour que les requêtes Firestore soient déjà résolues
 * lorsque l'accueil se monte.
 */
export function startHomeFeedPrefetch(
  translate: Translate,
): Promise<HomeFeedResult> {
  if (prefetchPromise) return prefetchPromise;

  prefetchStartedAt = Date.now();
  prefetchPromise = fetchHomeFeed(translate)
    .then((result) => {
      memoryHomeData = result.home;
      memoryHomeCachedAt = Date.now();
      return result;
    })
    .catch((error) => {
      // Un échec ne doit pas empoisonner la session : l'accueil refera l'appel.
      prefetchPromise = null;
      throw error;
    });

  return prefetchPromise;
}

/**
 * Récupère le préchargement de démarrage s'il est encore frais, puis le libère
 * (les rafraîchissements suivants doivent repartir du réseau).
 */
export function takeHomeFeedPrefetch(): Promise<HomeFeedResult> | null {
  if (!prefetchPromise) return null;
  if (Date.now() - prefetchStartedAt > PREFETCH_MAX_AGE_MS) {
    prefetchPromise = null;
    return null;
  }
  const pending = prefetchPromise;
  prefetchPromise = null;
  return pending;
}
