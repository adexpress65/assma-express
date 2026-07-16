import { Pinecone } from "@pinecone-database/pinecone";
import { CLIP_DIMS } from "./clipService";
import type { VisualVectorMetadata } from "./visualIndexMetadata";

let client: Pinecone | null = null;

/** Index production A2Express (512-D, cosine) — surcharge possible via PINECONE_INDEX_NAME. */
export const DEFAULT_PINECONE_INDEX_NAME = "a2express-products";

function resolvedIndexName(): string {
  const n = process.env.PINECONE_INDEX_NAME;
  return n != null && String(n).trim().length > 0
    ? String(n).trim()
    : DEFAULT_PINECONE_INDEX_NAME;
}

/**
 * Variables d’environnement (Firebase Functions / backfill local) :
 * - PINECONE_API_KEY (obligatoire pour Pinecone)
 * - PINECONE_INDEX_NAME (optionnel, défaut : a2express-products)
 */
export function isPineconeConfigured(): boolean {
  const key = process.env.PINECONE_API_KEY;
  return Boolean(key && key.length > 0);
}

function getIndex() {
  if (!isPineconeConfigured()) {
    throw new Error("Pinecone non configuré (PINECONE_API_KEY)");
  }
  if (!client) {
    client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY as string });
  }
  const idx = client.index(resolvedIndexName());
  const ns = process.env.PINECONE_NAMESPACE;
  return ns != null && String(ns).length > 0 ? idx.namespace(String(ns)) : idx;
}

export async function upsertProductVector(
  productId: string,
  values: number[],
  meta: VisualVectorMetadata,
): Promise<void> {
  if (values.length !== CLIP_DIMS) {
    throw new Error(`Embedding dimension ${values.length} ≠ index CLIP ${CLIP_DIMS}`);
  }
  const index = getIndex();
  await index.upsert([
    {
      id: productId,
      values,
      metadata: {
        productId: meta.productId,
        price: meta.price,
        imageUrl: meta.imageUrl,
        catalogScope: meta.catalogScope,
        ...(meta.perceptualHashHex
          ? { pHash: meta.perceptualHashHex }
          : {}),
      },
    },
  ]);
}

export async function deleteProductVector(productId: string): Promise<void> {
  if (!isPineconeConfigured()) return;
  const index = getIndex();
  await index.deleteOne(productId);
}

export type PineconeVisualMatch = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
};

/**
 * Plafond de voisins fusionnés renvoyés au pipeline CLIP (Pinecone double requête).
 * Tenir aligné avec `MAX_VECTOR_CANDIDATES` dans `searchProductByImage.ts`.
 */
export const MAX_PINECONE_MERGED_RESULTS = 96;

/**
 * Double passe : requête « interne » (catalogScope) + requête globale, en parallèle.
 * Fusion par **meilleur cosinus** sur l’union des deux (pas « interne d’abord jusqu’à cap ») :
 * sinon 40 lignes internes peuvent occuper tout le quota et le produit pertinent (souvent hors scope interne) n’apparaît jamais.
 */
export async function querySimilarDoublePass(
  vector: number[],
  limit: number,
): Promise<PineconeVisualMatch[]> {
  if (vector.length !== CLIP_DIMS) {
    throw new Error(
      `querySimilarDoublePass: dimension ${vector.length} ≠ index CLIP ${CLIP_DIMS}`,
    );
  }
  const index = getIndex();
  const cap = Math.min(Math.max(limit, 1), MAX_PINECONE_MERGED_RESULTS);
  const internalTopK = Math.min(200, Math.max(cap * 2, 48));
  const broadTopK = Math.min(250, Math.max(cap * 3, 64));

  const [internalRes, broadRes] = await Promise.all([
    index.query({
      vector,
      topK: internalTopK,
      includeMetadata: true,
      filter: { catalogScope: { $eq: "internal" } },
    }),
    index.query({
      vector,
      topK: broadTopK,
      includeMetadata: true,
    }),
  ]);

  const bestById = new Map<string, PineconeVisualMatch>();

  const consider = (m: { id?: string; score?: number; metadata?: unknown }) => {
    if (!m.id) return;
    const score = m.score ?? 0;
    const row: PineconeVisualMatch = {
      id: m.id,
      score,
      metadata: m.metadata as Record<string, unknown> | undefined,
    };
    const prev = bestById.get(m.id);
    if (!prev || score > prev.score) bestById.set(m.id, row);
  };

  for (const m of internalRes.matches || []) consider(m);
  for (const m of broadRes.matches || []) consider(m);

  return Array.from(bestById.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, cap);
}

/**
 * Requête Pinecone **image** + **texte** (même index d’embeddings image produit).
 * Le texte (intention / catégorie / mots-clés) retrouve souvent le SKU exact quand la photo seule est trop éloignée du packshot.
 */
export async function querySimilarMerged(
  vecImage: number[],
  vecText: number[] | null | undefined,
  limit: number,
): Promise<PineconeVisualMatch[]> {
  if (!vecText?.length || vecText.length !== CLIP_DIMS) {
    return querySimilarDoublePass(vecImage, limit);
  }
  const cap = Math.min(Math.max(limit, 1), MAX_PINECONE_MERGED_RESULTS);
  const perQuery = Math.min(MAX_PINECONE_MERGED_RESULTS, Math.max(cap, 40));
  const [img, txt] = await Promise.all([
    querySimilarDoublePass(vecImage, perQuery),
    querySimilarDoublePass(vecText, perQuery),
  ]);
  const byId = new Map<string, PineconeVisualMatch>();
  for (const m of img) {
    if (!m.id) continue;
    byId.set(m.id, {
      id: m.id,
      score: m.score ?? 0,
      metadata: m.metadata,
    });
  }
  for (const m of txt) {
    if (!m.id) continue;
    const s = m.score ?? 0;
    const prev = byId.get(m.id);
    if (!prev) {
      byId.set(m.id, {
        id: m.id,
        score: s * 0.94,
        metadata: m.metadata,
      });
    } else {
      byId.set(m.id, {
        id: m.id,
        score: Math.max(prev.score, s),
        metadata: prev.metadata ?? m.metadata,
      });
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, cap);
}
