import * as admin from "firebase-admin";
import type { DocumentData } from "firebase-admin/firestore";
import { createHash } from "crypto";
import Busboy from "busboy";
import { Readable } from "stream";
import { onRequest, type Request } from "firebase-functions/v2/https";
import { pineconeApiKey } from "./pineconeParams";
import type { ImageVisualFingerprint } from "./services/clipService";
import {
  MAX_VECTOR_CANDIDATES,
  type EmbedImageInput,
  type ImageSearchHit,
} from "./services/searchProductByImage";
import {
  buildVisualSearchCacheKey,
  getCachedVisualSearch,
  hashImageBuffer,
  hashImagePayload,
  setCachedVisualSearch,
} from "./services/visualSearchCache";
import { VISUAL_SEARCH_RECALL_LOCK } from "./services/visualSearchRecallLock";

const MULTIPART_MAX_IMAGE_BYTES = 22 * 1024 * 1024;
const MIN_UPLOAD_IMAGE_BYTES = 500;

/** Phrase pour CLIP texte (cross-modal) : catégorie + mots-clés / indices image (déjà dans le corps JSON / meta). */
function buildVisualHybridCaption(body: Record<string, unknown>): string | undefined {
  const parts: string[] = [];
  const hint =
    typeof body.categoryHint === "string" ? body.categoryHint.trim() : "";
  if (hint) parts.push(hint);
  const pushArr = (key: "intentKeywords" | "imageHints") => {
    const arr = body[key];
    if (!Array.isArray(arr)) return;
    for (const x of arr) {
      if (typeof x === "string" && x.trim()) parts.push(x.trim());
    }
  };
  pushArr("intentKeywords");
  pushArr("imageHints");
  const uniq = [...new Set(parts.map((p) => p.replace(/\s+/g, " ").trim()))].filter(Boolean);
  const s = uniq.join(". ").slice(0, 470).trim();
  return s.length > 4 ? s : undefined;
}

/**
 * multipart/form-data : champ fichier `image` + optionnel `meta` (JSON des options, même clés que le corps JSON historique).
 */
async function parseMultipartVisualRequest(req: Request): Promise<{
  imageBuffer: Buffer | null;
  body: Record<string, unknown>;
}> {
  const raw = req.rawBody;
  if (!Buffer.isBuffer(raw) || raw.length === 0) {
    return { imageBuffer: null, body: {} };
  }
  return new Promise((resolve, reject) => {
    let imageBuffer: Buffer | null = null;
    let meta = "";
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MULTIPART_MAX_IMAGE_BYTES, files: 2 },
    });
    bb.on("file", (name, file) => {
      if (name !== "image") {
        file.resume();
        return;
      }
      const chunks: Buffer[] = [];
      file.on("data", (c: Buffer) => chunks.push(c));
      file.on("limit", () => {
        reject(new Error("Fichier image trop volumineux."));
      });
      file.on("error", reject);
      file.on("end", () => {
        imageBuffer = Buffer.concat(chunks);
      });
    });
    bb.on("field", (fieldname, val) => {
      if (fieldname === "meta" && typeof val === "string") meta = val;
    });
    bb.on("error", reject);
    bb.on("finish", () => {
      let body: Record<string, unknown> = {};
      if (meta.trim()) {
        try {
          const o = JSON.parse(meta) as unknown;
          if (o && typeof o === "object" && !Array.isArray(o)) {
            body = o as Record<string, unknown>;
          }
        } catch {
          body = {};
        }
      }
      resolve({ imageBuffer, body });
    });
    Readable.from(raw).pipe(bb);
  });
}

const FAST_PATH_TOP = 10;
/** Budget réservé au dédup embeddings (ms) — en dessous, on saute le fetch Firestore. */
const DEDUP_BUDGET_HEADROOM_MS = 400;

function hitsByProductId(hits: ImageSearchHit[]): Map<string, ImageSearchHit> {
  const m = new Map<string, ImageSearchHit>();
  for (const h of hits) m.set(h.productId, h);
  return m;
}

function defaultBudgetMs(): number {
  const n = Number(process.env.VISUAL_SEARCH_BUDGET_MS);
  if (Number.isFinite(n) && n >= 1000) return Math.min(Math.floor(n), 30_000);
  return 5000;
}

function nowMs(): number {
  return Date.now();
}

type ApiResultRow = Record<string, unknown>;

function mapRowToApi(
  row: {
    productId: string;
    cosine: number;
    price: number;
    imageUrl: string | null;
    categoryId: string | null;
    categoryName: string | null;
    compositeScore: number;
    components: {
      cosineTerm: number;
      popularityTerm: number;
      priceTerm: number;
      categoryTerm: number;
      colorTerm?: number;
      shapeTerm?: number;
      visualBlend?: number;
    };
  },
  p: DocumentData | undefined,
  hitMap: Map<string, ImageSearchHit>,
  opts?: {
    exactMatchPHashProductId?: string | null;
    rank?: number;
    /** Duplique `compositeScore` sous le nom `finalScore` pour le débogage. */
    debugRanking?: boolean;
  },
): ApiResultRow {
  const metaFromHit = hitMap.get(row.productId);
  const metaPrice = metaFromHit?.vectorMetadata?.price;
  const metaImg = metaFromHit?.vectorMetadata?.imageUrl;
  const scope = metaFromHit?.vectorMetadata?.catalogScope ?? null;
  const visualScore = Math.round(row.compositeScore * 10_000) / 100;

  const exactP =
    opts?.exactMatchPHashProductId === row.productId ? true : undefined;

  const rankField =
    opts?.rank !== undefined ? { rank: opts.rank } : ({} as Record<string, never>);
  const debugFields =
    opts?.debugRanking === true
      ? { finalScore: row.compositeScore }
      : ({} as Record<string, never>);

  if (!p) {
    return {
      id: row.productId,
      name: "Produit",
      description: null,
      price: metaPrice ?? row.price,
      imageUrl: metaImg ?? row.imageUrl,
      categoryId: row.categoryId,
      categoryName: null,
      visualScore,
      similarity: row.cosine,
      compositeScore: row.compositeScore,
      rankingComponents: row.components,
      sourceType: "vector_clip",
      catalogScope: scope,
      ...(exactP ? { exactMatchPHash: true } : {}),
      ...rankField,
      ...debugFields,
    };
  }
  return {
    id: row.productId,
    name: p.name || "Produit",
    description: p.description ?? null,
    price: Number(p.price) || metaPrice || row.price || 0,
    imageUrl: (p.mainImage ||
      p.imageUrl ||
      p.image ||
      metaImg ||
      row.imageUrl ||
      null) as string | null,
    categoryId: (p.categoryId || null) as string | null,
    categoryName: (p.categoryName || p.category || null) as string | null,
    visualScore,
    similarity: row.cosine,
    compositeScore: row.compositeScore,
    rankingComponents: row.components,
    sourceType: "vector_clip",
    catalogScope: scope,
    ...(exactP ? { exactMatchPHash: true } : {}),
    ...rankField,
    ...debugFields,
  };
}

/**
 * POST `multipart/form-data` (recommandé) : fichier `image` + champ texte `meta` (JSON, mêmes clés que ci‑dessous).
 * POST JSON (historique) : corps JSON avec `imageBase64` / `imageUri`.
 *
 * POST JSON / meta multipart
 * - fastPath? (défaut false) — si true : top 10 hits **bruts** (ordre vectoriel), sans ranking / filtre / diversification.
 *   Optionnel : fastPathEnrichProducts? — si true, un seul batch getAll pour les noms (10 produits).
 * - skipCache? — ignorer le cache mémoire.
 * - rankingDebug? — journal détaillé + métadonnées `metadata.rankingDebug` (désactive le cache). Env : `VISUAL_SEARCH_RANKING_DEBUG=1`.
 * - focusProductId? ou debugFocusProductId? — analyser pourquoi ce produit n’est pas premier vs le leader (avec `rankingDebug`).
 * - limit?, offset?, minSimilarity?, duplicateSimilarityThreshold?, categoryHint?, intentKeywords?, imageHints?
 * - deepDiversify?, budgetMs?
 *
 * Cache : réponse mise en cache par hash d’image (TTL ~4 min, instance chaude).
 */
export const visualImageSearch = onRequest(
  {
    cors: true,
    region: "europe-west1",
    memory: "2GiB",
    timeoutSeconds: 60,
    secrets: [pineconeApiKey],
  },
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Méthode non autorisée" });
      return;
    }

    const timings: Record<string, number> = {};
    const tReq = nowMs();

    try {
      const { searchProductByImage } = await import(
        "./services/searchProductByImage"
      );
      const {
        fetchProductsByIds,
        fetchEmbeddingsByProductIds,
      } = await import("./services/visualSearchCore");
      const {
        filterRankablesPreservingHeadAndHighSimilarity,
        scoreRankableHits,
        scoreRankableHitsVisual,
        diversifyResults,
        rankableFromProduct,
        buildHeadOrdered,
        fetchFingerprintMapForRankables,
        HEAD_DIVERSITY_SKIP,
        HIGH_SIMILARITY_NEVER_FILTER,
        MAX_FINGERPRINT_FETCH,
        DEFAULT_MIN_SIMILARITY,
        DEFAULT_DUPLICATE_SIMILARITY,
        getConfidenceGateMin,
        MAX_EMBEDDING_DEDUP_FETCH,
        RANKING_WEIGHTS,
        VECTOR_HEAD_CATEGORY_EXEMPT,
      } = await import("./services/visualRanking");

      const ct = String(req.headers["content-type"] || "").toLowerCase();
      let body: Record<string, unknown> = {};
      let imageBufferIn: Buffer | null = null;

      if (ct.includes("multipart/form-data")) {
        try {
          const parsed = await parseMultipartVisualRequest(req as Request);
          imageBufferIn = parsed.imageBuffer;
          body = parsed.body;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          res.status(400).json({ error: `Requête multipart invalide : ${msg}` });
          return;
        }
      } else {
        body =
          req.body && typeof req.body === "object"
            ? (req.body as Record<string, unknown>)
            : {};
        /** Gen2 / proxy : `req.body` peut rester vide alors que le corps JSON est dans `rawBody`. */
        if (
          ct.includes("application/json") &&
          req.rawBody &&
          Buffer.isBuffer(req.rawBody) &&
          req.rawBody.length > 0 &&
          (Object.keys(body).length === 0 ||
            (typeof body.imageBase64 !== "string" &&
              typeof body.imageUri !== "string"))
        ) {
          try {
            const parsed = JSON.parse(req.rawBody.toString("utf8")) as unknown;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              body = { ...body, ...(parsed as Record<string, unknown>) };
            }
          } catch {
            /* ignore */
          }
        }
      }

      const mimeType =
        typeof body.mimeType === "string" ? body.mimeType : "image/jpeg";
      const pageLimit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);
      const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
      const minSimilarity =
        typeof body.minSimilarity === "number" && !Number.isNaN(body.minSimilarity)
          ? body.minSimilarity
          : DEFAULT_MIN_SIMILARITY;
      const duplicateSimilarityThreshold =
        typeof body.duplicateSimilarityThreshold === "number" &&
        !Number.isNaN(body.duplicateSimilarityThreshold)
          ? body.duplicateSimilarityThreshold
          : DEFAULT_DUPLICATE_SIMILARITY;
      const categoryHint =
        typeof body.categoryHint === "string" ? body.categoryHint.trim() : "";

      const fastPath = body.fastPath === true;
      const fastPathEnrichProducts = body.fastPathEnrichProducts === true;
      const skipCache = body.skipCache === true;
      /** Logs + métadonnées détaillées (désactive le cache pour éviter des réponses sans debug). */
      const rankingDebug =
        body.rankingDebug === true ||
        process.env.VISUAL_SEARCH_RANKING_DEBUG === "1";
      const focusProductIdRaw =
        typeof body.focusProductId === "string"
          ? body.focusProductId.trim()
          : typeof body.debugFocusProductId === "string"
            ? body.debugFocusProductId.trim()
            : "";
      const focusProductId =
        focusProductIdRaw.length > 0 ? focusProductIdRaw : undefined;
      const skipCacheEffective = skipCache || rankingDebug;
      const deepDiversify = body.deepDiversify === true;
      const budgetMs = Math.min(
        Math.max(
          typeof body.budgetMs === "number" && !Number.isNaN(body.budgetMs)
            ? body.budgetMs
            : defaultBudgetMs(),
          2000,
        ),
        12000,
      );
      const deadline = nowMs() + budgetMs;

      const intentFromBody: string[] = [];
      if (Array.isArray(body.intentKeywords)) {
        for (const x of body.intentKeywords) {
          if (typeof x === "string" && x.trim()) intentFromBody.push(x.trim());
        }
      }
      if (Array.isArray(body.imageHints)) {
        for (const x of body.imageHints) {
          if (typeof x === "string" && x.trim()) intentFromBody.push(x.trim());
        }
      }

      const imageUriRaw =
        typeof body.imageUri === "string" ? body.imageUri.trim() : "";
      const imageBase64 = body.imageBase64;

      if (
        imageBufferIn != null &&
        imageBufferIn.length > 0 &&
        imageBufferIn.length < MIN_UPLOAD_IMAGE_BYTES
      ) {
        res.status(400).json({
          error: "Fichier image trop petit ou incomplet (upload tronqué ?).",
        });
        return;
      }

      let imageInput: EmbedImageInput;
      if (imageBufferIn && imageBufferIn.length >= MIN_UPLOAD_IMAGE_BYTES) {
        imageInput = { kind: "buffer", buffer: imageBufferIn };
      } else if (imageUriRaw) {
        imageInput = imageUriRaw;
      } else if (imageBase64 && typeof imageBase64 === "string") {
        const clean = imageBase64
          .replace(/^data:image\/\w+;base64,/i, "")
          .trim();
        imageInput = `data:${mimeType};base64,${clean}`;
      } else {
        res.status(400).json({
          error:
            "Fournir le fichier « image » (multipart), ou imageUri (URL https), ou imageBase64 (JSON).",
        });
        return;
      }

      const hybridCaption = buildVisualHybridCaption(body);
      const hybridTextDigest = hybridCaption
        ? createHash("sha256").update(hybridCaption).digest("hex").slice(0, 20)
        : "";

      const imageHash =
        typeof imageInput === "object" && imageInput.kind === "buffer"
          ? hashImageBuffer(imageInput.buffer)
          : hashImagePayload(imageInput as string);
      const cacheKey = buildVisualSearchCacheKey({
        imageHash,
        fastPath,
        pageLimit,
        offset,
        minSimilarity,
        duplicateSimilarityThreshold,
        deepDiversify,
        categoryHint,
        hybridTextDigest,
      });

      if (!skipCacheEffective) {
        const cached = getCachedVisualSearch(cacheKey);
        if (cached != null) {
          timings.cacheLookupMs = nowMs() - tReq;
          console.info(
            "[visualImageSearch]",
            JSON.stringify({
              phase: "cache_hit",
              cacheKeyPrefix: cacheKey.slice(0, 32),
              timings,
            }),
          );
          res.json(cached);
          return;
        }
      }

      /**
       * LOCK rappel : toujours le plafond Pinecone (96). Ne pas réduire sans QA
       * (voir `.cursor/rules/visual-search-recall.mdc`).
       */
      const vectorFetchLimit = fastPath
        ? Math.min(24, FAST_PATH_TOP + 4)
        : MAX_VECTOR_CANDIDATES;

      const db = admin.firestore();

      const tVec = nowMs();
      const {
        hits,
        engine,
        indexedApprox,
        vectorStore,
        firestoreScanTruncated,
        firestoreEmbeddingMaxDocs,
        timings: vectorTimings,
        clipEmbedError,
        queryFingerprint,
        queryPHash,
      } = await searchProductByImage(
        db,
        imageInput,
        vectorFetchLimit,
        mimeType,
        hybridCaption,
      );
      timings.vectorSearchMs = nowMs() - tVec;

      if (!hits.length) {
        const clipHint =
          clipEmbedError != null && clipEmbedError.length > 0
            ? `Échec traitement image (CLIP) : ${clipEmbedError.slice(0, 220)}`
            : indexedApprox === 0
              ? "Aucun embedding indexé. Lancez npm run backfill:embeddings ; avec Pinecone, créez un index 512-D cosine et définissez PINECONE_*."
              : undefined;
        const payload = {
          results: [],
          metadata: {
            ...(indexedApprox !== undefined ? { indexed: indexedApprox } : {}),
            vectorStore,
            engine,
            vectorTimings,
            ...(clipEmbedError ? { clipEmbedError: clipEmbedError.slice(0, 400) } : {}),
            hint: clipHint,
            ...(firestoreScanTruncated !== undefined
              ? { firestoreScanTruncated }
              : {}),
            ...(firestoreEmbeddingMaxDocs !== undefined
              ? { firestoreEmbeddingMaxDocs }
              : {}),
            timingsMs: { ...timings, totalHandlerMs: nowMs() - tReq },
          },
        };
        res.json(payload);
        return;
      }

      const { enrichHitsWithPhashIfMissing } = await import(
        "./services/visualSearchCore"
      );
      await enrichHitsWithPhashIfMissing(db, hits);
      const hitMap = hitsByProductId(hits);

      const topSimilarity = hits[0].score;
      const confidenceGateMin = getConfidenceGateMin();
      const lowVectorConfidence =
        topSimilarity < confidenceGateMin;
      /** Toujours exposer les meilleurs scores bruts (debug / UX) — même si la suite applique des filtres. */
      const vectorTop5Raw = hits.slice(0, 5).map((h, i) => ({
        rank: i + 1,
        productId: h.productId,
        vectorSimilarity: h.score,
      }));
      console.info(
        "[visualImageSearch]",
        JSON.stringify({
          phase: "vector_hits",
          topSimilarity,
          confidenceGateMin,
          lowVectorConfidence,
          vectorTop5Raw,
          vectorCandidatesFetched: hits.length,
        }),
      );
      /** Anciennement : réponse vide si `topSimilarity < gate` — provoquait des « 0 résultat » avec voisins CLIP valides mais < 0,4. */

      /** --- FAST PATH : top 10 bruts, pas de ranking / filtre / diversification --- */
      if (fastPath) {
        const { findExactPHashProductId, PHASH_EXACT_MAX_HAMMING } = await import(
          "./services/perceptualHash"
        );
        const phMatchFast = findExactPHashProductId(
          queryPHash,
          hits.map((h) => ({
            productId: h.productId,
            perceptualHashHex: h.vectorMetadata?.perceptualHashHex,
          })),
          PHASH_EXACT_MAX_HAMMING,
        );
        let slice = hits.slice(0, FAST_PATH_TOP);
        if (phMatchFast) {
          const idx = slice.findIndex(
            (h) => h.productId === phMatchFast.productId,
          );
          if (idx > 0) {
            const copy = [...slice];
            const [row] = copy.splice(idx, 1);
            slice = [row!, ...copy].slice(0, FAST_PATH_TOP);
          }
        }
        let products = new Map<string, DocumentData>();
        if (fastPathEnrichProducts && nowMs() < deadline) {
          const tProd = nowMs();
          products = await fetchProductsByIds(
            db,
            slice.map((h) => h.productId),
          );
          timings.productFetchMs = nowMs() - tProd;
        }

        const exactPidFast = phMatchFast?.productId;
        const results = slice.map((h) => {
          const p = products.get(h.productId);
          const meta = h.vectorMetadata;
          const visualScore = Math.round(h.score * 10_000) / 100;
          const exactP =
            exactPidFast === h.productId ? ({ exactMatchPHash: true } as const) : {};
          if (!p) {
            return {
              id: h.productId,
              name: "Produit",
              description: null,
              price: meta?.price ?? 0,
              imageUrl: meta?.imageUrl ?? null,
              categoryId: null,
              categoryName: null,
              visualScore,
              similarity: h.score,
              compositeScore: h.score,
              sourceType: "vector_clip_fast",
              catalogScope: meta?.catalogScope ?? null,
              ...exactP,
            };
          }
          return {
            id: h.productId,
            name: p.name || "Produit",
            description: p.description ?? null,
            price: Number(p.price) || meta?.price || 0,
            imageUrl: (p.mainImage ||
              p.imageUrl ||
              p.image ||
              meta?.imageUrl ||
              null) as string | null,
            categoryId: (p.categoryId || null) as string | null,
            categoryName: (p.categoryName || p.category || null) as string | null,
            visualScore,
            similarity: h.score,
            compositeScore: h.score,
            sourceType: "vector_clip_fast",
            catalogScope: meta?.catalogScope ?? null,
            ...exactP,
          };
        });

        const payload = {
          results,
          metadata: {
            ...(indexedApprox !== undefined ? { indexed: indexedApprox } : {}),
            vectorStore,
            engine,
            vectorTimings,
            fastPath: true,
            fastPathEnrichProducts,
            returned: results.length,
            topSimilarity,
            confidence: lowVectorConfidence ? "low" : "ok",
            confidenceGateMin,
            ...(lowVectorConfidence
              ? {
                  lowConfidenceReason: "top_similarity_below_threshold",
                  note:
                    "Les résultats sont renvoyés malgré un cosinus #1 bas ; comparez `vectorTop5Raw`.",
                }
              : {}),
            vectorTop5Raw,
            ...(phMatchFast
              ? {
                  exactMatchPHashProductId: phMatchFast.productId,
                  phashHammingDistance: phMatchFast.distance,
                }
              : {}),
            cacheKeyHint: imageHash.slice(0, 12),
            timingsMs: {
              ...timings,
              rankingMs: 0,
              embeddingsMs: 0,
              diversificationMs: 0,
              totalHandlerMs: nowMs() - tReq,
            },
            ...(rankingDebug
              ? {
                  rankingDebug: {
                    mode: "fast_path",
                    note:
                      "Pas de scoring composite ni diversification ; similarity = score vectoriel brut.",
                    vectorTop5BeforeRanking: hits.slice(0, 5).map((h, i) => ({
                      rank: i + 1,
                      productId: h.productId,
                      vectorSimilarity: h.score,
                    })),
                  },
                }
              : {}),
          },
        };
        if (!skipCacheEffective) setCachedVisualSearch(cacheKey, payload);
        console.info(
          "[visualImageSearch]",
          JSON.stringify({
            phase: "fast_path",
            vectorTimings,
            timingsMs: payload.metadata.timingsMs,
            ...(rankingDebug
              ? {
                  rankingDebug: {
                    note: "fast_path: pas de scoring composite ; similarity = score vectoriel",
                    vectorTop5: hits.slice(0, 5).map((h, i) => ({
                      rank: i + 1,
                      productId: h.productId,
                      vectorSimilarity: h.score,
                    })),
                  },
                }
              : {}),
          }),
        );
        res.json(payload);
        return;
      }

      /** --- FULL PATH avec budget et réponses partielles --- */
      const ids = hits.map((h) => h.productId);
      const tProdFull = nowMs();
      const products = await fetchProductsByIds(db, ids);
      timings.productFetchMs = nowMs() - tProdFull;

      if (nowMs() > deadline) {
        const slice = hits.slice(offset, offset + pageLimit);
        const quickResults = slice.map((h) => {
          const p = products.get(h.productId);
          const meta = h.vectorMetadata;
          const visualScore = Math.round(h.score * 10_000) / 100;
          if (!p) {
            return {
              id: h.productId,
              name: "Produit",
              description: null,
              price: meta?.price ?? 0,
              imageUrl: meta?.imageUrl ?? null,
              categoryId: null,
              categoryName: null,
              visualScore,
              similarity: h.score,
              compositeScore: h.score,
              sourceType: "vector_clip_partial",
              catalogScope: meta?.catalogScope ?? null,
            };
          }
          return {
            id: h.productId,
            name: p.name || "Produit",
            description: p.description ?? null,
            price: Number(p.price) || meta?.price || 0,
            imageUrl: (p.mainImage ||
              p.imageUrl ||
              p.image ||
              meta?.imageUrl ||
              null) as string | null,
            categoryId: (p.categoryId || null) as string | null,
            categoryName: (p.categoryName || p.category || null) as string | null,
            visualScore,
            similarity: h.score,
            compositeScore: h.score,
            sourceType: "vector_clip_partial",
            catalogScope: meta?.catalogScope ?? null,
          };
        });
        res.json({
          results: quickResults,
          metadata: {
            ...(indexedApprox !== undefined ? { indexed: indexedApprox } : {}),
            vectorStore,
            engine,
            vectorTimings,
            partial: true,
            partialReason: "deadline_after_product_fetch",
            returned: quickResults.length,
            topSimilarity,
            budgetMs,
            timingsMs: { ...timings, totalHandlerMs: nowMs() - tReq },
          },
        });
        return;
      }

      const rankables = hits.map((h) => {
        const p = products.get(h.productId);
        const metaPrice = h.vectorMetadata?.price;
        const metaImg = h.vectorMetadata?.imageUrl;
        return rankableFromProduct(
          h.productId,
          h.score,
          p,
          metaPrice,
          metaImg ?? null,
        );
      });

      const tRank = nowMs();
      const vectorTop3Ids = hits
        .slice(0, VECTOR_HEAD_CATEGORY_EXEMPT)
        .map((h) => h.productId);
      const frozenCategoryNeutralIds = new Set(vectorTop3Ids);
      const filtered = filterRankablesPreservingHeadAndHighSimilarity(
        rankables,
        hits,
        minSimilarity,
        categoryHint || undefined,
        intentFromBody,
      );

      let fpMap = new Map<string, ImageVisualFingerprint | null>();
      if (queryFingerprint && filtered.length > 0) {
        const tFp = nowMs();
        fpMap = await fetchFingerprintMapForRankables(
          filtered,
          MAX_FINGERPRINT_FETCH,
          5,
        );
        timings.fingerprintFetchMs = nowMs() - tFp;
      }

      const scored = queryFingerprint
        ? scoreRankableHitsVisual(filtered, queryFingerprint, fpMap, {
            categoryHint: categoryHint || undefined,
            intentKeywords: intentFromBody,
            frozenCategoryNeutralIds,
          })
        : scoreRankableHits(filtered, {
            categoryHint: categoryHint || undefined,
            intentKeywords: intentFromBody,
            frozenCategoryNeutralIds,
          });
      timings.rankingMs = nowMs() - tRank;

      const scoredById = new Map(scored.map((s) => [s.productId, s]));
      const headOrdered = buildHeadOrdered(hits, scoredById, {
        maxHead: HEAD_DIVERSITY_SKIP,
      });
      const headIdSet = new Set(headOrdered.map((h) => h.productId));
      const restScored = scored.filter((s) => !headIdSet.has(s.productId));
      const restSorted = [...restScored].sort(
        (a, b) => b.compositeScore - a.compositeScore,
      );

      let embMap = new Map<string, number[]>();
      let skippedEmbeddingDedup = false;
      let partialReason: string | undefined;
      const timeForDedup =
        deepDiversify && nowMs() < deadline - DEDUP_BUDGET_HEADROOM_MS;

      if (timeForDedup && restSorted.length > 0) {
        const idsForDedup = [
          ...new Set([
            ...hits.slice(0, HEAD_DIVERSITY_SKIP).map((h) => h.productId),
            ...restSorted
              .slice(0, MAX_EMBEDDING_DEDUP_FETCH)
              .map((s) => s.productId),
          ]),
        ];
        const tEmb = nowMs();
        embMap = await fetchEmbeddingsByProductIds(db, idsForDedup);
        timings.embeddingsMs = nowMs() - tEmb;
        if (nowMs() > deadline) {
          partialReason = "deadline_after_embeddings";
        }
      } else if (deepDiversify && !timeForDedup) {
        skippedEmbeddingDedup = true;
        partialReason = "skipped_embeddings_low_time";
      } else if (!deepDiversify) {
        skippedEmbeddingDedup = true;
      }

      const tDiv = nowMs();
      /** Garder le haut du classement composite hors dédup embedding (sinon trop peu de lignes vs `limit`). */
      const dedupProtectTopK = Math.min(
        VISUAL_SEARCH_RECALL_LOCK.diversifyProtectTopKMax,
        Math.max(pageLimit, VISUAL_SEARCH_RECALL_LOCK.diversifyProtectTopKMinFromPage),
      );
      let diversifiedRest = diversifyResults(restSorted, embMap, {
        duplicateThreshold: duplicateSimilarityThreshold,
        categoryAwareDedup: true,
        protectTopK: dedupProtectTopK,
        neverRemoveEmbeddingCosineAbove: HIGH_SIMILARITY_NEVER_FILTER,
      });
      timings.diversificationMs = nowMs() - tDiv;

      let diversified = [...headOrdered, ...diversifiedRest];

      if (nowMs() > deadline && !partialReason) {
        partialReason = "deadline_after_diversification";
      }

      if (partialReason === "deadline_after_embeddings") {
        diversified = [
          ...headOrdered,
          ...[...restScored].sort((a, b) => b.compositeScore - a.compositeScore),
        ];
      }

      let exactMatchPHashProductId: string | null = null;
      let phashHammingDistance: number | undefined;
      const { findExactPHashProductId, PHASH_EXACT_MAX_HAMMING } = await import(
        "./services/perceptualHash"
      );
      const { promoteScoredRowToFirst } = await import(
        "./services/visualRanking"
      );
      const phMatchFull = findExactPHashProductId(
        queryPHash,
        hits.map((h) => ({
          productId: h.productId,
          perceptualHashHex: h.vectorMetadata?.perceptualHashHex,
        })),
        PHASH_EXACT_MAX_HAMMING,
      );
      if (phMatchFull) {
        exactMatchPHashProductId = phMatchFull.productId;
        phashHammingDistance = phMatchFull.distance;
        diversified = promoteScoredRowToFirst(
          diversified,
          phMatchFull.productId,
        );
      }

      const totalRanked = diversified.length;
      const pageSlice = diversified.slice(offset, offset + pageLimit);
      const hasMore = offset + pageSlice.length < totalRanked;
      const timedOut = nowMs() > deadline;

      let rankingDebugMeta: Record<string, unknown> | undefined;
      if (rankingDebug) {
        const {
          vectorOrderTopN,
          compositeOrderTopN,
          finalOrderTopN,
          perResultPageDebug,
          focusProductAnalysis,
        } = await import("./services/visualRankingDebug");
        rankingDebugMeta = {
          rankingWeights: RANKING_WEIGHTS,
          pipelineNotes: [
            "Ordre vectoriel brut = hits[] (Pinecone / scan Firestore).",
            "Après filtres : rankables réduits ; scoring composite (+ blend visuel si empreinte requête).",
            "top5ByCompositeOnly = tri pur par compositeScore (avant tête figée 1–3 vectorielle).",
            "top5AfterFinalRanking = liste après buildHeadOrdered + diversification + éventuelle promo pHash.",
            "Chaque résultat renvoyé inclut rank, similarity (= cosinus CLIP), compositeScore (final), rankingComponents.",
          ],
          vectorTop5BeforeRanking: vectorOrderTopN(hits, 5),
          top5AfterScoringByCompositeOnly: compositeOrderTopN(scored, 5),
          top5AfterFinalRanking: finalOrderTopN(diversified, 5),
          returnedPage: perResultPageDebug(diversified, offset, pageLimit),
          ...(focusProductId
            ? {
                focusComparison: focusProductAnalysis({
                  focusProductId,
                  hits,
                  diversified,
                  queryFingerprint: Boolean(queryFingerprint),
                }),
              }
            : {}),
        };
        console.info(
          "[visualRankingDebug]",
          JSON.stringify({
            imageHashPrefix: imageHash.slice(0, 12),
            focusProductId: focusProductId ?? null,
            ...rankingDebugMeta,
          }),
        );
      }

      const results = pageSlice.map((row, i) =>
        mapRowToApi(row, products.get(row.productId), hitMap, {
          exactMatchPHashProductId,
          rank: rankingDebug ? offset + i + 1 : undefined,
          debugRanking: rankingDebug,
        }),
      );

      const payload = {
        results,
        metadata: {
          ...(indexedApprox !== undefined ? { indexed: indexedApprox } : {}),
          vectorStore,
          engine,
          vectorTimings,
          returned: results.length,
          totalRanked,
          offset,
          limit: pageLimit,
          hasMore,
          minSimilarity,
          duplicateSimilarityThreshold,
          vectorCandidatesFetched: hits.length,
          topSimilarity,
          confidence: lowVectorConfidence ? "low" : "ok",
          confidenceGateMin,
          ...(lowVectorConfidence
            ? {
                lowConfidenceReason: "top_similarity_below_threshold",
                note:
                  "Pipeline complet appliqué ; cosinus #1 sous le plancher informatif — vérifier `vectorTop5Raw` et le catalogue.",
              }
            : {}),
          vectorTop5Raw,
          rankingHeadSize: HEAD_DIVERSITY_SKIP,
          vectorTop3Frozen: true,
          highSimilarityProtectedAbove: HIGH_SIMILARITY_NEVER_FILTER,
          categoryIntentAfterVectorRank3: true,
          vectorTop3Preserved: true,
          diversifyAfterRank: HEAD_DIVERSITY_SKIP + 1,
          ...(exactMatchPHashProductId
            ? {
                exactMatchPHashProductId,
                phashHammingDistance,
              }
            : {}),
          deepDiversify,
          deepDiversifyApplied: deepDiversify && !skippedEmbeddingDedup,
          embeddingDedupFetchCap: MAX_EMBEDDING_DEDUP_FETCH,
          budgetMs,
          timedOut,
          partial: Boolean(partialReason) || timedOut,
          partialReason: partialReason ?? (timedOut ? "budget_exceeded" : undefined),
          ...(firestoreScanTruncated !== undefined
            ? { firestoreScanTruncated }
            : {}),
          ...(firestoreEmbeddingMaxDocs !== undefined
            ? { firestoreEmbeddingMaxDocs }
            : {}),
          timingsMs: {
            ...timings,
            totalHandlerMs: nowMs() - tReq,
          },
          ...(rankingDebugMeta ? { rankingDebug: rankingDebugMeta } : {}),
        },
      };

      if (!skipCacheEffective && !timedOut) setCachedVisualSearch(cacheKey, payload);

      console.info(
        "[visualImageSearch]",
        JSON.stringify({
          phase: "full_path",
          rankingDebug,
          vectorTimings,
          timingsMs: payload.metadata.timingsMs,
          partial: payload.metadata.partial,
        }),
      );

      res.json(payload);
    } catch (e: any) {
      console.error("visualImageSearch", e);
      res.status(500).json({ error: e?.message || "Erreur recherche image" });
    }
  },
);
