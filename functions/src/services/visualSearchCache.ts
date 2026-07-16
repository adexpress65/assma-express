import { createHash } from "crypto";

/** Entrées max en mémoire (instances Cloud Functions chaudes). */
const MAX_ENTRIES = 250;
const DEFAULT_TTL_MS = 4 * 60 * 1000;

type CacheEntry = {
  payload: unknown;
  expiresAt: number;
};

const store = new Map<string, CacheEntry>();

/**
 * Empreinte stable du contenu image (URI / data URL) pour le cache.
 * Les très gros base64 sont hachés par morceaux + longueur pour limiter la mémoire CPU.
 */
export function hashImagePayload(payloadUri: string): string {
  const h = createHash("sha256");
  const maxChunk = 400_000;
  if (payloadUri.length > maxChunk) {
    h.update(payloadUri.slice(0, maxChunk));
    h.update(`|len=${payloadUri.length}`);
  } else {
    h.update(payloadUri);
  }
  return h.digest("hex");
}

/** Empreinte cache pour un buffer image (upload multipart). */
export function hashImageBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function buildVisualSearchCacheKey(input: {
  imageHash: string;
  fastPath: boolean;
  pageLimit: number;
  offset: number;
  minSimilarity: number;
  duplicateSimilarityThreshold: number;
  deepDiversify: boolean;
  categoryHint: string;
  /** Empreinte courte du libellé hybride CLIP texte (même image + texte différent = clé différente). */
  hybridTextDigest?: string;
}): string {
  const hint = input.categoryHint.slice(0, 64);
  const hy = (input.hybridTextDigest || "").slice(0, 24);
  if (input.fastPath) {
    return hy ? `v2:fp:${input.imageHash}:${hy}` : `v2:fp:${input.imageHash}`;
  }
  return [
    "v2:full",
    input.imageHash,
    String(input.pageLimit),
    String(input.offset),
    String(input.minSimilarity),
    String(input.duplicateSimilarityThreshold),
    input.deepDiversify ? "1" : "0",
    hint,
    hy,
  ].join(":");
}

export function getCachedVisualSearch(key: string): unknown | null {
  const v = store.get(key);
  if (!v) return null;
  if (Date.now() > v.expiresAt) {
    store.delete(key);
    return null;
  }
  return v.payload;
}

export function setCachedVisualSearch(
  key: string,
  payload: unknown,
  ttlMs = DEFAULT_TTL_MS,
): void {
  while (store.size >= MAX_ENTRIES) {
    const first = store.keys().next().value;
    if (first === undefined) break;
    store.delete(first);
  }
  store.set(key, { payload, expiresAt: Date.now() + ttlMs });
}
