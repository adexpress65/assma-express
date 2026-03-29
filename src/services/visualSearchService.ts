import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  getDocs,
  limit,
  query,
} from "firebase/firestore";

import { db } from "@/config/firebase";
import type { VisualSearchDescriptor } from "@/services/imageSearchGemini";

const STORAGE_KEY = "visual-search-index-v2";
const INDEX_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_PRODUCTS = 450;
const VECTOR_SIZE = 48;

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
    searchableText: normalizeText(searchableText),
    tokens,
    vector: buildVector(tokens),
  };
}

async function fetchAndBuildIndex(): Promise<VisualIndexItem[]> {
  const snapshot = await getDocs(query(collection(db, "products"), limit(MAX_PRODUCTS)));

  return snapshot.docs
    .map((docSnap) => mapToIndexItem(docSnap))
    .filter(Boolean) as VisualIndexItem[];
}

async function persistIndex(items: VisualIndexItem[]): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      timestamp: Date.now(),
      items,
    })
  );
}

async function getPersistedIndex(): Promise<{ items: VisualIndexItem[]; timestamp: number } | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as { items?: VisualIndexItem[]; timestamp?: number };
    if (!Array.isArray(parsed?.items) || typeof parsed?.timestamp !== "number") {
      return null;
    }
    return {
      items: parsed.items,
      timestamp: parsed.timestamp,
    };
  } catch {
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
  await persistIndex(freshItems);
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

export async function searchProductsByVisualDescriptor(
  descriptor: VisualSearchDescriptor,
  options?: {
    limit?: number;
    forceRefresh?: boolean;
  }
): Promise<VisualSearchResult[]> {
  const limitResults = options?.limit ?? 40;
  const items = await getVisualIndex(options?.forceRefresh ?? false);
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
