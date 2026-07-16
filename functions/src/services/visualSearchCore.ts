import {
  FieldPath,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

/** Collection Firestore : un doc par produit, id = productId */
export const EMBEDDINGS_COLLECTION = "product_image_embeddings";

/** Plafond lecture scan Firestore (évite les scans de dizaines de milliers de docs). Préférer Pinecone en prod. */
export function maxFirestoreEmbeddingDocs(): number {
  const n = Number(process.env.MAX_FIRESTORE_EMBEDDING_DOCS);
  if (Number.isFinite(n) && n >= 100) return Math.min(Math.floor(n), 20_000);
  return 3000;
}

export function l2NormalizeVector(a: number[]): number[] {
  const n = Math.sqrt(a.reduce((s, x) => s + x * x, 0)) || 1;
  return a.map((x) => x / n);
}

/**
 * Cosinus entre deux vecteurs (L2-normalisés idéalement).
 * Re-normalise les deux entrées : robuste si les embeddings Firestore ont dérivé (float JSON)
 * ou si un ancien backfill n’était pas normalisé exactement comme la requête CLIP.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  const na = l2NormalizeVector(a.slice(0, n));
  const nb = l2NormalizeVector(b.slice(0, n));
  let s = 0;
  for (let i = 0; i < n; i += 1) {
    s += na[i]! * nb[i]!;
  }
  return s;
}

export type EmbeddingRow = {
  docId: string;
  productId: string;
  embedding: number[];
  /** pHash stocké sur le doc `product_image_embeddings` (optionnel jusqu’au backfill). */
  perceptualHashHex?: string;
};

/** Parse l’embedding stocké dans un doc `product_image_embeddings`. */
export function parseProductEmbedding(data: DocumentData): number[] | null {
  let emb = data.embedding;
  if (!emb && typeof data.embeddingJson === "string") {
    try {
      emb = JSON.parse(data.embeddingJson);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(emb) || emb.length < 64) return null;
  return emb.map((x: unknown) => Number(x));
}

/**
 * @deprecated Utiliser `loadEmbeddingsPaginated` — évite de charger toute la collection d’un coup.
 */
export async function loadAllEmbeddings(db: Firestore): Promise<EmbeddingRow[]> {
  const { rows } = await loadEmbeddingsPaginated(db);
  return rows;
}

/**
 * Charge les embeddings par pages (champs minimaux) avec plafond strict.
 * Ne recompute rien : uniquement lecture des vecteurs stockés.
 */
export async function loadEmbeddingsPaginated(
  db: Firestore,
): Promise<{ rows: EmbeddingRow[]; truncated: boolean; maxDocs: number }> {
  const maxDocs = maxFirestoreEmbeddingDocs();
  const pageSize = 500;
  const out: EmbeddingRow[] = [];
  let last: QueryDocumentSnapshot | null = null;
  let truncated = false;

  while (out.length < maxDocs) {
    const take = Math.min(pageSize, maxDocs - out.length);
    let q = db
      .collection(EMBEDDINGS_COLLECTION)
      .select("embedding", "embeddingJson", "productId", "perceptualHashHex")
      .orderBy(FieldPath.documentId())
      .limit(take);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    snap.forEach((doc) => {
      if (out.length >= maxDocs) return;
      const d = doc.data();
      const productId = String(d.productId || doc.id);
      const embedding = parseProductEmbedding(d);
      if (!embedding) return;
      const perceptualHashHex =
        typeof d.perceptualHashHex === "string" && d.perceptualHashHex.length === 16
          ? d.perceptualHashHex
          : undefined;
      out.push({ docId: doc.id, productId, embedding, perceptualHashHex });
    });

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < take) break;
    if (out.length >= maxDocs) {
      truncated = true;
      break;
    }
  }

  if (out.length >= maxDocs) truncated = true;

  return { rows: out, truncated, maxDocs };
}

export type RankedRow = EmbeddingRow & { score: number };

export function rankTopK(
  queryVec: number[],
  rows: EmbeddingRow[],
  topK: number,
): RankedRow[] {
  return rows
    .map((r) => ({ ...r, score: cosineSimilarity(queryVec, r.embedding) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, topK);
}

const PRODUCT_CHUNK = 10;

export async function fetchProductsByIds(
  db: Firestore,
  productIds: string[],
): Promise<Map<string, DocumentData>> {
  const map = new Map<string, DocumentData>();
  const unique = [...new Set(productIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += PRODUCT_CHUNK) {
    chunks.push(unique.slice(i, i + PRODUCT_CHUNK));
  }
  const maps = await Promise.all(
    chunks.map(async (slice) => {
      const refs = slice.map((id) => db.collection("products").doc(id));
      const snaps = await db.getAll(...refs);
      const m = new Map<string, DocumentData>();
      snaps.forEach((s) => {
        if (s.exists) m.set(s.id, s.data() || {});
      });
      return m;
    }),
  );
  for (const m of maps) {
    for (const [k, v] of m) map.set(k, v);
  }
  return map;
}

const EMB_CHUNK = 10;

/**
 * Embeddings pour dédoublonnage visuel (cosinus inter-candidats).
 * Doc id = productId dans `product_image_embeddings`.
 * Appeler avec une liste déjà plafonnée (ex. top 30).
 */
export async function fetchEmbeddingsByProductIds(
  db: Firestore,
  productIds: string[],
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  const unique = [...new Set(productIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += EMB_CHUNK) {
    chunks.push(unique.slice(i, i + EMB_CHUNK));
  }
  const maps = await Promise.all(
    chunks.map(async (slice) => {
      const refs = slice.map((id) =>
        db.collection(EMBEDDINGS_COLLECTION).doc(id),
      );
      const snaps = await db.getAll(...refs);
      const m = new Map<string, number[]>();
      snaps.forEach((s) => {
        if (!s.exists) return;
        const emb = parseProductEmbedding(s.data() || {});
        if (emb) m.set(s.id, emb);
      });
      return m;
    }),
  );
  for (const m of maps) {
    for (const [k, v] of m) out.set(k, v);
  }
  return out;
}

/**
 * pHash stocké sur `product_image_embeddings` (complète les métadonnées Pinecone manquantes).
 */
export async function fetchPhashHexByProductIds(
  db: Firestore,
  productIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(productIds)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += EMB_CHUNK) {
    chunks.push(unique.slice(i, i + EMB_CHUNK));
  }
  for (const slice of chunks) {
    const refs = slice.map((id) =>
      db.collection(EMBEDDINGS_COLLECTION).doc(id),
    );
    const snaps = await db.getAll(...refs);
    snaps.forEach((s) => {
      if (!s.exists) return;
      const ph = (s.data() || {}).perceptualHashHex;
      if (typeof ph === "string" && ph.length === 16) out.set(s.id, ph);
    });
  }
  return out;
}

export type HitWithOptionalPhash = {
  productId: string;
  vectorMetadata?: { perceptualHashHex?: string };
};

/**
 * Renseigne `vectorMetadata.perceptualHashHex` depuis Firestore quand absent (anciens index Pinecone).
 */
export async function enrichHitsWithPhashIfMissing(
  db: Firestore,
  hits: HitWithOptionalPhash[],
): Promise<void> {
  const missing = hits
    .filter((h) => !h.vectorMetadata?.perceptualHashHex)
    .map((h) => h.productId);
  if (!missing.length) return;
  const map = await fetchPhashHexByProductIds(db, missing);
  for (const h of hits) {
    const ph = map.get(h.productId);
    if (!ph) continue;
    h.vectorMetadata = { ...h.vectorMetadata, perceptualHashHex: ph };
  }
}
