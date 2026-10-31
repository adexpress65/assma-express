import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import type { VisualSearchDescriptor } from "@/services/imageSearchGemini";
import type { AlgoliaHit } from "@/types/product";
import { computeImageHash } from "@/utils/imageHash";
import {
  paceFirestorePage,
  VISUAL_FIRESTORE_PAGE_SIZE,
  VISUAL_INDEX_MAX_PAGES,
} from "@/services/visualSearchFirestoreScan";

const STORAGE_KEY = "visual-search-index-v2";
const STORAGE_META_KEY = `${STORAGE_KEY}:meta`;
const STORAGE_CHUNK_PREFIX = `${STORAGE_KEY}:chunk:`;
const INDEX_TTL_MS = 6 * 60 * 60 * 1000;
const VECTOR_SIZE = 48;
const STORAGE_CHUNK_SIZE = 40;

type VisualIndexItem = {
  objectID: string;
  name: string;
  price: number;
  currency: string;
  supplier: string;
  companyName: string;
  companyId?: string;
  mainImage?: string;
  imageUrl?: string;
  image?: string;
  images: string[];
  featured: boolean;
  updatedAt: number;
  category?: string;
  categoryName?: string;
  imageHashes: string[];
  mainImageHash?: string;
  searchableText: string;
  tokens: string[];
  vector: number[];
};

export type VisualSearchResult = Omit<VisualIndexItem, "searchableText" | "tokens" | "vector"> & {
  visualScore: number;
};

let memoryCache: { items: VisualIndexItem[]; timestamp: number } | null = null;

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(...values: Array<string | undefined | null>): string[] {
  const parts = values
    .flatMap((value) => normalizeText(String(value || "")).split(" "))
    .filter((token) => token.length >= 2);

  return Array.from(new Set(parts));
}

function getTimestamp(value: any): number {
  if (typeof value?.toMillis === "function") {
    return value.toMillis();
  }

  if (typeof value === "number") {
    return value;
  }

  return 0;
}

function sanitizeImageUrl(value?: string | null): string | undefined {
  if (!value || typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes("firebasestorage.googleapis.com") && !trimmed.includes("alt=media")) {
    return trimmed.includes("?") ? `${trimmed}&alt=media` : `${trimmed}?alt=media`;
  }

  return trimmed;
}

function extractImageTokens(images: string[]): string[] {
  return Array.from(
    new Set(
      images.flatMap((image) => {
        const fileName = image.split("/").pop() || image;
        const baseName = fileName.replace(/\.[a-z0-9]+$/i, "");
        return tokenize(baseName);
      })
    )
  );
}

function buildSearchableText(data: Record<string, any>, images: string[]): string {
  return [
    data.name,
    data.nameLower,
    data.brand,
    data.model,
    data.sku,
    data.categoryName,
    data.category,
    data.description,
    data.shortDescription,
    data.supplier,
    data.companyName,
    data.color,
    data.colors,
    data.material,
    data.materials,
    Array.isArray(data.tags) ? data.tags.join(" ") : data.tags,
    Array.isArray(data.keywords) ? data.keywords.join(" ") : data.keywords,
    Array.isArray(data.searchKeywords) ? data.searchKeywords.join(" ") : data.searchKeywords,
    extractImageTokens(images).join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

function hashToken(token: string): number {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildVector(tokens: string[]): number[] {
  const vector = new Array<number>(VECTOR_SIZE).fill(0);

  tokens.forEach((token) => {
    const hash = hashToken(token);
    const bucket = hash % VECTOR_SIZE;
    const direction = hash % 2 === 0 ? 1 : -1;
    vector[bucket] += direction * (1 + Math.min(token.length, 10) / 10);
  });

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!norm) {
    return vector;
  }

  return vector.map((value) => value / norm);
}

function cosineSimilarity(left: number[], right: number[]): number {
  let sum = 0;
  for (let index = 0; index < VECTOR_SIZE; index += 1) {
    sum += (left[index] || 0) * (right[index] || 0);
  }
  return sum;
}

function mapToIndexItem(docSnap: any): VisualIndexItem | null {
  const data = docSnap.data() as Record<string, any>;

  if (data?.status === "draft" || data?.isActive === false) {
    return null;
  }

  const images = [
    sanitizeImageUrl(data.mainImage),
    sanitizeImageUrl(data.imageUrl),
    sanitizeImageUrl(data.image),
    ...(Array.isArray(data.images) ? data.images.map((item) => sanitizeImageUrl(item)) : []),
  ].filter(Boolean) as string[];

  const searchableText = buildSearchableText(data, images);
  const tokens = tokenize(searchableText);

  if (!tokens.length) {
    return null;
  }

  return {
    objectID: docSnap.id,
    name: String(data.name || "Produit"),
    price: Number(data.price) || 0,
    currency: String(data.currency || "XOF"),
    supplier: String(data.supplier || data.companyName || "Fournisseur"),
    companyName: String(data.companyName || data.supplier || "Fournisseur"),
    companyId: data.companyId ? String(data.companyId) : undefined,
    mainImage: images[0],
    imageUrl: sanitizeImageUrl(data.imageUrl) || images[0],
    image: sanitizeImageUrl(data.image) || images[0],
    images,
    featured: Boolean(data.featured),
    updatedAt: getTimestamp(data.updatedAt) || getTimestamp(data.createdAt),
    category: data.category ? String(data.category) : undefined,
    categoryName: data.categoryName ? String(data.categoryName) : undefined,
    imageHashes: Array.isArray(data.imageHashes)
      ? data.imageHashes.map((item: unknown) => String(item)).filter(Boolean)
      : [],
    mainImageHash: data.mainImageHash ? String(data.mainImageHash) : undefined,
    searchableText: normalizeText(searchableText),
    tokens,
    vector: buildVector(tokens),
  };
}

async function fetchAndBuildIndex(): Promise<VisualIndexItem[]> {
  const col = collection(db, "products");
  const items: VisualIndexItem[] = [];
  let last: QueryDocumentSnapshot | undefined;

  for (let page = 0; page < VISUAL_INDEX_MAX_PAGES; page += 1) {
    await paceFirestorePage(page);
    const q = last
      ? query(col, orderBy(documentId()), startAfter(last), limit(VISUAL_FIRESTORE_PAGE_SIZE))
      : query(col, orderBy(documentId()), limit(VISUAL_FIRESTORE_PAGE_SIZE));
    const snapshot = await getDocs(q);
    if (snapshot.empty) break;

    for (const docSnap of snapshot.docs) {
      const row = mapToIndexItem(docSnap);
      if (row) items.push(row);
    }

    last = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.docs.length < VISUAL_FIRESTORE_PAGE_SIZE) break;
  }

  return items;
}

function isDiskOrSqliteQuotaError(error: unknown): boolean {
  const m = error instanceof Error ? error.message : String(error);
  return /SQLITE_FULL|disk is full|code\s*13|SQLITE_IOERR/i.test(m);
}

/** Supprime méta + morceaux + clé monolithique legacy (libère de la place si quota SQLite plein). */
async function clearVisualIndexPersistence(): Promise<void> {
  const keys: string[] = [STORAGE_KEY, STORAGE_META_KEY];
  try {
    const metaRaw = await AsyncStorage.getItem(STORAGE_META_KEY);
    if (metaRaw) {
      const meta = JSON.parse(metaRaw) as { chunkCount?: number };
      const n = typeof meta?.chunkCount === "number" && meta.chunkCount > 0 ? meta.chunkCount : 0;
      for (let i = 0; i < n; i += 1) {
        keys.push(`${STORAGE_CHUNK_PREFIX}${i}`);
      }
    }
  } catch {
    // ignore
  }
  await AsyncStorage.multiRemove(keys).catch(() => {});
}

async function persistIndex(items: VisualIndexItem[]): Promise<void> {
  const writeChunks = async (chunkSize: number) => {
    const timestamp = Date.now();
    const chunks: VisualIndexItem[][] = [];
    for (let index = 0; index < items.length; index += chunkSize) {
      chunks.push(items.slice(index, index + chunkSize));
    }
    const payloads: Array<[string, string]> = chunks.map((chunk, index) => [
      `${STORAGE_CHUNK_PREFIX}${index}`,
      JSON.stringify(chunk),
    ]);
    await AsyncStorage.multiSet([
      [STORAGE_META_KEY, JSON.stringify({ timestamp, chunkCount: chunks.length })],
      ...payloads,
    ]);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  };

  try {
    await writeChunks(STORAGE_CHUNK_SIZE);
  } catch (e) {
    if (!isDiskOrSqliteQuotaError(e)) throw e;
    await clearVisualIndexPersistence();
    try {
      await writeChunks(Math.max(12, Math.floor(STORAGE_CHUNK_SIZE / 2)));
    } catch (e2) {
      await clearVisualIndexPersistence();
      if (!isDiskOrSqliteQuotaError(e2)) throw e2;
      console.warn(
        "[visual-search-index] AsyncStorage plein (SQLITE_FULL) — index non écrit sur disque ; il reste valable en mémoire jusqu’au redémarrage. Libérez de l’espace sur l’appareil.",
      );
    }
  }
}

async function getPersistedIndex(): Promise<{ items: VisualIndexItem[]; timestamp: number } | null> {
  try {
    const metaRaw = await AsyncStorage.getItem(STORAGE_META_KEY);
    if (!metaRaw) {
      // Compatibilité: si l'ancien gros blob existe encore et fait planter Android,
      // on le supprime silencieusement pour repartir sur un index frais.
      try {
        await AsyncStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      return null;
    }

    const meta = JSON.parse(metaRaw) as { timestamp?: number; chunkCount?: number };
    if (typeof meta?.timestamp !== "number" || typeof meta?.chunkCount !== "number") {
      return null;
    }

    const chunkKeys = Array.from({ length: meta.chunkCount }, (_, index) => `${STORAGE_CHUNK_PREFIX}${index}`);
    const chunkEntries = await AsyncStorage.multiGet(chunkKeys);
    const items = chunkEntries.flatMap(([, value]) => {
      if (!value) return [];
      try {
        const parsed = JSON.parse(value) as VisualIndexItem[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    });

    return {
      items,
      timestamp: meta.timestamp,
    };
  } catch (e) {
    if (isDiskOrSqliteQuotaError(e)) {
      await clearVisualIndexPersistence().catch(() => {});
    }
    try {
      await AsyncStorage.multiRemove([STORAGE_KEY, STORAGE_META_KEY]);
    } catch {
      // ignore
    }
    return null;
  }
}

async function getVisualIndex(forceRefresh = false): Promise<VisualIndexItem[]> {
  if (!forceRefresh && memoryCache && Date.now() - memoryCache.timestamp < INDEX_TTL_MS) {
    return memoryCache.items;
  }

  if (!forceRefresh) {
    const persisted = await getPersistedIndex();
    if (persisted && Date.now() - persisted.timestamp < INDEX_TTL_MS) {
      memoryCache = persisted;
      return persisted.items;
    }
  }

  const freshItems = await fetchAndBuildIndex();
  memoryCache = {
    items: freshItems,
    timestamp: Date.now(),
  };
  try {
    await persistIndex(freshItems);
  } catch (e) {
    console.warn("[visual-search-index] persistIndex", e);
  }
  return freshItems;
}

function buildDescriptorTokens(descriptor: VisualSearchDescriptor): string[] {
  const weightedTokens = [
    ...tokenize(descriptor.searchQuery),
    ...tokenize(...descriptor.keywords, ...descriptor.labels),
    ...tokenize(...descriptor.entities, ...descriptor.detectedText),
    ...tokenize(...descriptor.colors, ...descriptor.materials),
  ];

  return Array.from(new Set(weightedTokens));
}

function buildDescriptorVector(descriptor: VisualSearchDescriptor): number[] {
  const weightedTokens = [
    ...tokenize(descriptor.searchQuery, descriptor.searchQuery),
    ...tokenize(...descriptor.keywords, ...descriptor.keywords),
    ...tokenize(...descriptor.labels, ...descriptor.labels),
    ...tokenize(...descriptor.entities, ...descriptor.entities),
    ...tokenize(...descriptor.detectedText, ...descriptor.detectedText),
    ...tokenize(...descriptor.colors),
    ...tokenize(...descriptor.materials),
  ];

  return buildVector(weightedTokens);
}

export async function warmVisualSearchIndex(): Promise<void> {
  try {
    await getVisualIndex(false);
  } catch (error) {
    console.warn("visual-search-index", error);
  }
}

/** Hit grille à partir d’un match exact `mainImageHash` / `imageHashes` (index local). */
export function visualSearchResultToAlgoliaHit(r: VisualSearchResult): AlgoliaHit {
  return {
    objectID: r.objectID,
    name: r.name,
    price: r.price,
    currency: r.currency,
    supplier: r.supplier,
    companyName: r.companyName,
    companyId: r.companyId,
    mainImage: r.mainImage,
    imageUrl: r.imageUrl ?? r.mainImage,
    category: r.category,
    categoryName: r.categoryName,
    visualScore: r.visualScore,
    similarity: 0.995,
    sourceType: "firebase",
    isExactImageMatch: true,
  };
}

/** Vide le cache disque + mémoire de l’index visuel (utile si SQLITE_FULL / stockage saturé). */
export async function clearVisualSearchIndexStorage(): Promise<void> {
  memoryCache = null;
  await clearVisualIndexPersistence();
}

export async function findExactProductByImageHash(
  imageUri: string,
  options?: { forceRefresh?: boolean }
): Promise<VisualSearchResult | null> {
  if (!imageUri) {
    return null;
  }

  const inputHash = await computeImageHash(imageUri);
  if (!inputHash) {
    return null;
  }

  const items = await getVisualIndex(options?.forceRefresh ?? false);
  const exact = items.find((item) =>
    item.mainImageHash === inputHash || item.imageHashes.includes(inputHash)
  );

  if (!exact) {
    return null;
  }

  const { searchableText, tokens, vector, ...rest } = exact;
  return {
    ...rest,
    visualScore: 100000,
  };
}

export async function searchProductsByVisualDescriptor(
  descriptor: VisualSearchDescriptor,
  options?: {
    limit?: number;
    forceRefresh?: boolean;
    /** Si défini, seuls les produits de cette catégorie (champ Firestore `category`) */
    restrictToCategoryId?: string;
    /** Sinon, filtre par nom de catégorie normalisé */
    restrictToCategoryName?: string;
    /** Filtre OR sur plusieurs categoryName (recherche visuelle) */
    restrictToCategoryNames?: string[];
  }
): Promise<VisualSearchResult[]> {
  const limitResults = options?.limit ?? 40;
  let items = await getVisualIndex(options?.forceRefresh ?? false);

  if (options?.restrictToCategoryId) {
    const id = String(options.restrictToCategoryId);
    items = items.filter((item) => String(item.category || '') === id);
  } else if (options?.restrictToCategoryName) {
    const target = normalizeText(options.restrictToCategoryName);
    items = items.filter(
      (item) => normalizeText(String(item.categoryName || '')) === target,
    );
  } else if (options?.restrictToCategoryNames?.length) {
    const allowed = new Set(
      options.restrictToCategoryNames.map((c) => normalizeText(String(c))),
    );
    items = items.filter((item) => {
      const cn = normalizeText(String(item.categoryName || ''));
      if (!cn) return true;
      return allowed.has(cn);
    });
  }

  const descriptorTokens = buildDescriptorTokens(descriptor);
  const descriptorVector = buildDescriptorVector(descriptor);
  const ocrTokens = tokenize(...descriptor.detectedText, ...descriptor.entities);
  const colorTokens = tokenize(...descriptor.colors);
  const materialTokens = tokenize(...descriptor.materials);

  const ranked = items
    .map((item) => {
      const matchedTokens = descriptorTokens.filter((token) => item.searchableText.includes(token));
      const ocrMatches = ocrTokens.filter((token) => item.searchableText.includes(token));
      const colorMatches = colorTokens.filter((token) => item.searchableText.includes(token));
      const materialMatches = materialTokens.filter((token) => item.searchableText.includes(token));
      const imageNameMatches = descriptorTokens.filter((token) =>
        item.images.some((image) => image.toLowerCase().includes(token))
      );

      const coverage = descriptorTokens.length ? matchedTokens.length / descriptorTokens.length : 0;
      const similarity = cosineSimilarity(descriptorVector, item.vector);

      const score =
        similarity * 100 +
        coverage * 90 +
        ocrMatches.length * 35 +
        colorMatches.length * 12 +
        materialMatches.length * 10 +
        imageNameMatches.length * 18 +
        (item.featured ? 8 : 0);

      return {
        ...item,
        visualScore: Number(score.toFixed(2)),
        _matchedTokens: matchedTokens.length,
        _ocrMatches: ocrMatches.length,
      };
    })
    .filter((item) => item.visualScore >= 18 || item._ocrMatches > 0 || item._matchedTokens >= 2)
    .sort((left, right) => {
      if (right.visualScore !== left.visualScore) {
        return right.visualScore - left.visualScore;
      }
      return right.updatedAt - left.updatedAt;
    })
    .slice(0, limitResults)
    .map(({ searchableText, tokens, vector, _matchedTokens, _ocrMatches, ...rest }) => rest);

  return ranked;
}
