import type { Firestore } from "firebase-admin/firestore";
import type { ImageVisualFingerprint } from "./clipService";
import {
  embedClipText,
  embedClipVectorOnly,
  embedImageWithFingerprint,
} from "./clipService";
import {
  isPineconeConfigured,
  MAX_PINECONE_MERGED_RESULTS,
  querySimilarMerged,
} from "./pineconeVisualService";
import {
  loadEmbeddingsPaginated,
  rankTopK,
  fetchProductsByIds,
  type RankedRow,
} from "./visualSearchCore";
import { catalogScopeFromProduct } from "./visualIndexMetadata";

export type ImageSearchHit = {
  productId: string;
  score: number;
  /** Présent si la source est Pinecone (prix / image / scope indexés). */
  vectorMetadata?: {
    price?: number;
    imageUrl?: string;
    catalogScope?: string;
    /** pHash produit (hex 16 car.) — Firestore ou métadonnée Pinecone `pHash`. */
    perceptualHashHex?: string;
  };
};

/** Plafond candidats retournés par Pinecone / repli Firestore — aligné sur `MAX_PINECONE_MERGED_RESULTS`. */
export const MAX_VECTOR_CANDIDATES = MAX_PINECONE_MERGED_RESULTS;

export type SearchProductByImageTimings = {
  embedClipMs: number;
  /** Embedding CLIP texte (hybride intention + image). */
  embedTextMs?: number;
  vectorQueryMs: number;
  firestorePaginatedMs: number;
  firestoreProductsMs: number;
  rankTopKMs: number;
  totalMs: number;
};

/** Entrée embedding : URI texte ou buffer brut (multipart). */
export type EmbedImageInput = string | { kind: "buffer"; buffer: Buffer };

/**
 * Accepte une URL https, une data URL `data:image/...;base64,...`, ou un buffer brut.
 * Délègue à `embedImageWithFingerprint` (CLIP + empreinte couleur/forme).
 */
export async function embedImageUri(
  imageUri: EmbedImageInput,
  fallbackMime = "image/jpeg",
): Promise<number[]> {
  const { embedding } = await embedImageWithFingerprint(imageUri, fallbackMime);
  return embedding;
}

function logSearchTimings(
  vectorStore: string,
  engine: string,
  timings: SearchProductByImageTimings,
): void {
  console.info(
    "[searchProductByImage]",
    JSON.stringify({
      vectorStore,
      engine,
      ...timings,
    }),
  );
}

/** Logs diagnostics (pas le vecteur complet — 512 floats). */
function logQueryEmbeddingStats(vec: number[]): void {
  if (!vec.length) return;
  const approxNorm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  console.info(
    "[searchProductByImage] queryEmbeddingStats",
    JSON.stringify({
      dims: vec.length,
      l2NormApprox: Math.round(approxNorm * 1e6) / 1e6,
      headSample: vec.slice(0, 4).map((x) => Math.round(x * 1e5) / 1e5),
    }),
  );
}

function logVectorHitsPreview(
  label: string,
  matches: { productId: string; score: number }[],
): void {
  const top = matches.slice(0, 5).map((m, i) => ({
    rank: i + 1,
    productId: m.productId,
    similarity: Math.round(m.score * 1e5) / 1e5,
  }));
  console.info(
    `[searchProductByImage] ${label}`,
    JSON.stringify({ count: matches.length, top5: top }),
  );
}

/**
 * Pipeline : embedding CLIP (vision 512-D) → Pinecone (cosine, double passe) ou repli Firestore paginé.
 * Les embeddings produits sont toujours lus depuis le stockage (Pinecone / Firestore), jamais recalculés ici.
 *
 * @param hybridCaption — Phrase courte (catégorie + mots-clés Gemini) pour une 2ᵉ requête CLIP **texte** fusionnée avec l’image (cross-modal).
 */
export async function searchProductByImage(
  db: Firestore,
  imageUri: EmbedImageInput,
  limit: number,
  fallbackMime = "image/jpeg",
  hybridCaption?: string,
): Promise<{
  hits: ImageSearchHit[];
  engine: string;
  indexedApprox?: number;
  vectorStore: "pinecone" | "firestore";
  firestoreScanTruncated?: boolean;
  firestoreEmbeddingMaxDocs?: number;
  timings: SearchProductByImageTimings;
  /** Présent si l’embedding CLIP a échoué (image invalide, Sharp, etc.). */
  clipEmbedError?: string;
  /** Vecteur requête (512-D) — utile ranking / debug. */
  queryVec?: number[];
  /** Empreinte histogramme + aspect ratio (requête). */
  queryFingerprint?: ImageVisualFingerprint;
  /** pHash 64 bits (hex) de l’image requête — comparaison copie exacte. */
  queryPHash?: string;
}> {
  const tStart = Date.now();
  const timings: SearchProductByImageTimings = {
    embedClipMs: 0,
    vectorQueryMs: 0,
    firestorePaginatedMs: 0,
    firestoreProductsMs: 0,
    rankTopKMs: 0,
    totalMs: 0,
  };

  const tEmbedStart = Date.now();
  let queryVec: number[];
  let queryFingerprint: ImageVisualFingerprint | undefined;
  let queryPHash: string | undefined;
  /** CLIP seul (pas fingerprint/pHash) — debug / perf. `VISUAL_SEARCH_CLIP_ONLY=1` */
  const clipOnly = process.env.VISUAL_SEARCH_CLIP_ONLY === "1";
  try {
    if (clipOnly) {
      queryVec = await embedClipVectorOnly(imageUri, fallbackMime);
      queryFingerprint = undefined;
      queryPHash = undefined;
    } else {
      const emb = await embedImageWithFingerprint(imageUri, fallbackMime);
      queryVec = emb.embedding;
      queryFingerprint = emb.fingerprint;
      queryPHash = emb.perceptualHashHex;
    }
    timings.embedClipMs = Date.now() - tEmbedStart;
    logQueryEmbeddingStats(queryVec);
  } catch (e: unknown) {
    timings.embedClipMs = Date.now() - tEmbedStart;
    timings.totalMs = Date.now() - tStart;
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[searchProductByImage] CLIP / image pipeline failed:", msg);
    logSearchTimings(
      isPineconeConfigured() ? "pinecone" : "firestore",
      "clip_embed_failed",
      timings,
    );
    return {
      hits: [],
      engine: "clip_embed_failed",
      vectorStore: isPineconeConfigured() ? "pinecone" : "firestore",
      timings,
      clipEmbedError: msg.slice(0, 500),
      queryPHash: undefined,
    };
  }

  const cap = Math.min(Math.max(limit, 1), MAX_VECTOR_CANDIDATES);

  if (
    !isPineconeConfigured() &&
    process.env.VISUAL_SEARCH_PINECONE_ONLY === "1"
  ) {
    timings.totalMs = Date.now() - tStart;
    console.error(
      "[searchProductByImage] VISUAL_SEARCH_PINECONE_ONLY sans PINECONE_API_KEY — repli Firestore désactivé.",
    );
    return {
      hits: [],
      engine: "pinecone_required_not_configured",
      vectorStore: "firestore",
      timings,
      queryVec,
      queryFingerprint,
      queryPHash,
    };
  }

  if (isPineconeConfigured()) {
    let textVec: number[] | null = null;
    const capTrim = hybridCaption?.trim();
    if (capTrim && capTrim.length > 4) {
      const tTxt = Date.now();
      try {
        textVec = await embedClipText(capTrim);
        timings.embedTextMs = Date.now() - tTxt;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("[searchProductByImage] embedClipText (hybride) ignoré:", msg.slice(0, 200));
      }
    }

    const tVec = Date.now();
    const matches = await querySimilarMerged(queryVec, textVec, cap);
    timings.vectorQueryMs = Date.now() - tVec;
    timings.totalMs = Date.now() - tStart;
    const engineTag = textVec ? "clip_cosine_pinecone_hybrid" : "clip_cosine_pinecone_double_pass";
    logSearchTimings("pinecone", engineTag, timings);
    logVectorHitsPreview(
      "pinecone_matches",
      matches.map((m) => ({ productId: m.id, score: m.score })),
    );
    return {
      vectorStore: "pinecone",
      hits: matches.map((m) => ({
        productId: m.id,
        score: m.score,
        vectorMetadata: {
          price:
            typeof m.metadata?.price === "number"
              ? m.metadata.price
              : Number(m.metadata?.price) || undefined,
          imageUrl:
            typeof m.metadata?.imageUrl === "string"
              ? m.metadata.imageUrl
              : undefined,
          catalogScope:
            typeof m.metadata?.catalogScope === "string"
              ? m.metadata.catalogScope
              : undefined,
          perceptualHashHex:
            typeof m.metadata?.pHash === "string"
              ? m.metadata.pHash
              : undefined,
        },
      })),
      engine: textVec ? "clip_cosine_pinecone_hybrid" : "clip_cosine_pinecone_double_pass",
      timings,
      queryVec,
      queryFingerprint,
      queryPHash,
    };
  }

  const tLoad = Date.now();
  const { rows, truncated, maxDocs } = await loadEmbeddingsPaginated(db);
  timings.firestorePaginatedMs = Date.now() - tLoad;

  if (!rows.length) {
    timings.totalMs = Date.now() - tStart;
    logSearchTimings("firestore", "clip_cosine_firestore_double_pass", timings);
    return {
      hits: [],
      engine: "clip_cosine_firestore_double_pass",
      indexedApprox: 0,
      vectorStore: "firestore",
      firestoreScanTruncated: false,
      firestoreEmbeddingMaxDocs: maxDocs,
      timings,
      queryVec,
      queryFingerprint,
      queryPHash,
    };
  }

  const tRank = Date.now();
  const ranked = rankTopK(
    queryVec,
    rows,
    Math.min(rows.length, cap * 2),
  );
  timings.rankTopKMs = Date.now() - tRank;

  logVectorHitsPreview(
    "firestore_ranked",
    ranked.map((r) => ({ productId: r.productId, score: r.score })),
  );

  const tProd = Date.now();
  const products = await fetchProductsByIds(
    db,
    ranked.map((r) => r.productId),
  );
  timings.firestoreProductsMs = Date.now() - tProd;

  const internal: RankedRow[] = [];
  const external: RankedRow[] = [];
  for (const r of ranked) {
    const p = products.get(r.productId);
    if (catalogScopeFromProduct(p) === "internal") internal.push(r);
    else external.push(r);
  }

  const merged = [...internal, ...external].slice(0, cap);
  timings.totalMs = Date.now() - tStart;
  logSearchTimings("firestore", "clip_cosine_firestore_double_pass", timings);
  return {
    vectorStore: "firestore",
    hits: merged.map((r) => ({
      productId: r.productId,
      score: r.score,
      vectorMetadata: r.perceptualHashHex
        ? { perceptualHashHex: r.perceptualHashHex }
        : undefined,
    })),
    engine: "clip_cosine_firestore_double_pass",
    indexedApprox: rows.length,
    firestoreScanTruncated: truncated,
    firestoreEmbeddingMaxDocs: maxDocs,
    timings,
    queryVec,
    queryFingerprint,
    queryPHash,
  };
}
