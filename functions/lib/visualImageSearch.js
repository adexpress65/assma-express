"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.visualImageSearch = void 0;
const admin = __importStar(require("firebase-admin"));
const crypto_1 = require("crypto");
const busboy_1 = __importDefault(require("busboy"));
const stream_1 = require("stream");
const https_1 = require("firebase-functions/v2/https");
const pineconeParams_1 = require("./pineconeParams");
const searchProductByImage_1 = require("./services/searchProductByImage");
const visualSearchCache_1 = require("./services/visualSearchCache");
const visualSearchRecallLock_1 = require("./services/visualSearchRecallLock");
const MULTIPART_MAX_IMAGE_BYTES = 22 * 1024 * 1024;
const MIN_UPLOAD_IMAGE_BYTES = 500;
function buildVisualHybridCaption(body) {
    const parts = [];
    const hint = typeof body.categoryHint === "string" ? body.categoryHint.trim() : "";
    if (hint)
        parts.push(hint);
    const pushArr = (key) => {
        const arr = body[key];
        if (!Array.isArray(arr))
            return;
        for (const x of arr) {
            if (typeof x === "string" && x.trim())
                parts.push(x.trim());
        }
    };
    pushArr("intentKeywords");
    pushArr("imageHints");
    const uniq = [...new Set(parts.map((p) => p.replace(/\s+/g, " ").trim()))].filter(Boolean);
    const s = uniq.join(". ").slice(0, 470).trim();
    return s.length > 4 ? s : undefined;
}
async function parseMultipartVisualRequest(req) {
    const raw = req.rawBody;
    if (!Buffer.isBuffer(raw) || raw.length === 0) {
        return { imageBuffer: null, body: {} };
    }
    return new Promise((resolve, reject) => {
        let imageBuffer = null;
        let meta = "";
        const bb = (0, busboy_1.default)({
            headers: req.headers,
            limits: { fileSize: MULTIPART_MAX_IMAGE_BYTES, files: 2 },
        });
        bb.on("file", (name, file) => {
            if (name !== "image") {
                file.resume();
                return;
            }
            const chunks = [];
            file.on("data", (c) => chunks.push(c));
            file.on("limit", () => {
                reject(new Error("Fichier image trop volumineux."));
            });
            file.on("error", reject);
            file.on("end", () => {
                imageBuffer = Buffer.concat(chunks);
            });
        });
        bb.on("field", (fieldname, val) => {
            if (fieldname === "meta" && typeof val === "string")
                meta = val;
        });
        bb.on("error", reject);
        bb.on("finish", () => {
            let body = {};
            if (meta.trim()) {
                try {
                    const o = JSON.parse(meta);
                    if (o && typeof o === "object" && !Array.isArray(o)) {
                        body = o;
                    }
                }
                catch {
                    body = {};
                }
            }
            resolve({ imageBuffer, body });
        });
        stream_1.Readable.from(raw).pipe(bb);
    });
}
const FAST_PATH_TOP = 10;
const DEDUP_BUDGET_HEADROOM_MS = 400;
function hitsByProductId(hits) {
    const m = new Map();
    for (const h of hits)
        m.set(h.productId, h);
    return m;
}
function defaultBudgetMs() {
    const n = Number(process.env.VISUAL_SEARCH_BUDGET_MS);
    if (Number.isFinite(n) && n >= 1000)
        return Math.min(Math.floor(n), 30000);
    return 5000;
}
function nowMs() {
    return Date.now();
}
function mapRowToApi(row, p, hitMap, opts) {
    const metaFromHit = hitMap.get(row.productId);
    const metaPrice = metaFromHit?.vectorMetadata?.price;
    const metaImg = metaFromHit?.vectorMetadata?.imageUrl;
    const scope = metaFromHit?.vectorMetadata?.catalogScope ?? null;
    const visualScore = Math.round(row.compositeScore * 10000) / 100;
    const exactP = opts?.exactMatchPHashProductId === row.productId ? true : undefined;
    const rankField = opts?.rank !== undefined ? { rank: opts.rank } : {};
    const debugFields = opts?.debugRanking === true
        ? { finalScore: row.compositeScore }
        : {};
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
            null),
        categoryId: (p.categoryId || null),
        categoryName: (p.categoryName || p.category || null),
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
exports.visualImageSearch = (0, https_1.onRequest)({
    cors: true,
    region: "europe-west1",
    memory: "2GiB",
    timeoutSeconds: 60,
    secrets: [pineconeParams_1.pineconeApiKey],
}, async (req, res) => {
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Méthode non autorisée" });
        return;
    }
    const timings = {};
    const tReq = nowMs();
    try {
        const { searchProductByImage } = await Promise.resolve().then(() => __importStar(require("./services/searchProductByImage")));
        const { fetchProductsByIds, fetchEmbeddingsByProductIds, } = await Promise.resolve().then(() => __importStar(require("./services/visualSearchCore")));
        const { filterRankablesPreservingHeadAndHighSimilarity, scoreRankableHits, scoreRankableHitsVisual, diversifyResults, rankableFromProduct, buildHeadOrdered, fetchFingerprintMapForRankables, HEAD_DIVERSITY_SKIP, HIGH_SIMILARITY_NEVER_FILTER, MAX_FINGERPRINT_FETCH, DEFAULT_MIN_SIMILARITY, DEFAULT_DUPLICATE_SIMILARITY, getConfidenceGateMin, MAX_EMBEDDING_DEDUP_FETCH, RANKING_WEIGHTS, VECTOR_HEAD_CATEGORY_EXEMPT, } = await Promise.resolve().then(() => __importStar(require("./services/visualRanking")));
        const ct = String(req.headers["content-type"] || "").toLowerCase();
        let body = {};
        let imageBufferIn = null;
        if (ct.includes("multipart/form-data")) {
            try {
                const parsed = await parseMultipartVisualRequest(req);
                imageBufferIn = parsed.imageBuffer;
                body = parsed.body;
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                res.status(400).json({ error: `Requête multipart invalide : ${msg}` });
                return;
            }
        }
        else {
            body =
                req.body && typeof req.body === "object"
                    ? req.body
                    : {};
            if (ct.includes("application/json") &&
                req.rawBody &&
                Buffer.isBuffer(req.rawBody) &&
                req.rawBody.length > 0 &&
                (Object.keys(body).length === 0 ||
                    (typeof body.imageBase64 !== "string" &&
                        typeof body.imageUri !== "string"))) {
                try {
                    const parsed = JSON.parse(req.rawBody.toString("utf8"));
                    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        body = { ...body, ...parsed };
                    }
                }
                catch {
                }
            }
        }
        const mimeType = typeof body.mimeType === "string" ? body.mimeType : "image/jpeg";
        const pageLimit = Math.min(Math.max(Number(body.limit) || 10, 1), 50);
        const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
        const minSimilarity = typeof body.minSimilarity === "number" && !Number.isNaN(body.minSimilarity)
            ? body.minSimilarity
            : DEFAULT_MIN_SIMILARITY;
        const duplicateSimilarityThreshold = typeof body.duplicateSimilarityThreshold === "number" &&
            !Number.isNaN(body.duplicateSimilarityThreshold)
            ? body.duplicateSimilarityThreshold
            : DEFAULT_DUPLICATE_SIMILARITY;
        const categoryHint = typeof body.categoryHint === "string" ? body.categoryHint.trim() : "";
        const fastPath = body.fastPath === true;
        const fastPathEnrichProducts = body.fastPathEnrichProducts === true;
        const skipCache = body.skipCache === true;
        const rankingDebug = body.rankingDebug === true ||
            process.env.VISUAL_SEARCH_RANKING_DEBUG === "1";
        const focusProductIdRaw = typeof body.focusProductId === "string"
            ? body.focusProductId.trim()
            : typeof body.debugFocusProductId === "string"
                ? body.debugFocusProductId.trim()
                : "";
        const focusProductId = focusProductIdRaw.length > 0 ? focusProductIdRaw : undefined;
        const skipCacheEffective = skipCache || rankingDebug;
        const deepDiversify = body.deepDiversify === true;
        const budgetMs = Math.min(Math.max(typeof body.budgetMs === "number" && !Number.isNaN(body.budgetMs)
            ? body.budgetMs
            : defaultBudgetMs(), 2000), 12000);
        const deadline = nowMs() + budgetMs;
        const intentFromBody = [];
        if (Array.isArray(body.intentKeywords)) {
            for (const x of body.intentKeywords) {
                if (typeof x === "string" && x.trim())
                    intentFromBody.push(x.trim());
            }
        }
        if (Array.isArray(body.imageHints)) {
            for (const x of body.imageHints) {
                if (typeof x === "string" && x.trim())
                    intentFromBody.push(x.trim());
            }
        }
        const imageUriRaw = typeof body.imageUri === "string" ? body.imageUri.trim() : "";
        const imageBase64 = body.imageBase64;
        if (imageBufferIn != null &&
            imageBufferIn.length > 0 &&
            imageBufferIn.length < MIN_UPLOAD_IMAGE_BYTES) {
            res.status(400).json({
                error: "Fichier image trop petit ou incomplet (upload tronqué ?).",
            });
            return;
        }
        let imageInput;
        if (imageBufferIn && imageBufferIn.length >= MIN_UPLOAD_IMAGE_BYTES) {
            imageInput = { kind: "buffer", buffer: imageBufferIn };
        }
        else if (imageUriRaw) {
            imageInput = imageUriRaw;
        }
        else if (imageBase64 && typeof imageBase64 === "string") {
            const clean = imageBase64
                .replace(/^data:image\/\w+;base64,/i, "")
                .trim();
            imageInput = `data:${mimeType};base64,${clean}`;
        }
        else {
            res.status(400).json({
                error: "Fournir le fichier « image » (multipart), ou imageUri (URL https), ou imageBase64 (JSON).",
            });
            return;
        }
        const hybridCaption = buildVisualHybridCaption(body);
        const hybridTextDigest = hybridCaption
            ? (0, crypto_1.createHash)("sha256").update(hybridCaption).digest("hex").slice(0, 20)
            : "";
        const imageHash = typeof imageInput === "object" && imageInput.kind === "buffer"
            ? (0, visualSearchCache_1.hashImageBuffer)(imageInput.buffer)
            : (0, visualSearchCache_1.hashImagePayload)(imageInput);
        const cacheKey = (0, visualSearchCache_1.buildVisualSearchCacheKey)({
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
            const cached = (0, visualSearchCache_1.getCachedVisualSearch)(cacheKey);
            if (cached != null) {
                timings.cacheLookupMs = nowMs() - tReq;
                console.info("[visualImageSearch]", JSON.stringify({
                    phase: "cache_hit",
                    cacheKeyPrefix: cacheKey.slice(0, 32),
                    timings,
                }));
                res.json(cached);
                return;
            }
        }
        const vectorFetchLimit = fastPath
            ? Math.min(24, FAST_PATH_TOP + 4)
            : searchProductByImage_1.MAX_VECTOR_CANDIDATES;
        const db = admin.firestore();
        const tVec = nowMs();
        const { hits, engine, indexedApprox, vectorStore, firestoreScanTruncated, firestoreEmbeddingMaxDocs, timings: vectorTimings, clipEmbedError, queryFingerprint, queryPHash, } = await searchProductByImage(db, imageInput, vectorFetchLimit, mimeType, hybridCaption);
        timings.vectorSearchMs = nowMs() - tVec;
        if (!hits.length) {
            const clipHint = clipEmbedError != null && clipEmbedError.length > 0
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
        const { enrichHitsWithPhashIfMissing } = await Promise.resolve().then(() => __importStar(require("./services/visualSearchCore")));
        await enrichHitsWithPhashIfMissing(db, hits);
        const hitMap = hitsByProductId(hits);
        const topSimilarity = hits[0].score;
        const confidenceGateMin = getConfidenceGateMin();
        const lowVectorConfidence = topSimilarity < confidenceGateMin;
        const vectorTop5Raw = hits.slice(0, 5).map((h, i) => ({
            rank: i + 1,
            productId: h.productId,
            vectorSimilarity: h.score,
        }));
        console.info("[visualImageSearch]", JSON.stringify({
            phase: "vector_hits",
            topSimilarity,
            confidenceGateMin,
            lowVectorConfidence,
            vectorTop5Raw,
            vectorCandidatesFetched: hits.length,
        }));
        if (fastPath) {
            const { findExactPHashProductId, PHASH_EXACT_MAX_HAMMING } = await Promise.resolve().then(() => __importStar(require("./services/perceptualHash")));
            const phMatchFast = findExactPHashProductId(queryPHash, hits.map((h) => ({
                productId: h.productId,
                perceptualHashHex: h.vectorMetadata?.perceptualHashHex,
            })), PHASH_EXACT_MAX_HAMMING);
            let slice = hits.slice(0, FAST_PATH_TOP);
            if (phMatchFast) {
                const idx = slice.findIndex((h) => h.productId === phMatchFast.productId);
                if (idx > 0) {
                    const copy = [...slice];
                    const [row] = copy.splice(idx, 1);
                    slice = [row, ...copy].slice(0, FAST_PATH_TOP);
                }
            }
            let products = new Map();
            if (fastPathEnrichProducts && nowMs() < deadline) {
                const tProd = nowMs();
                products = await fetchProductsByIds(db, slice.map((h) => h.productId));
                timings.productFetchMs = nowMs() - tProd;
            }
            const exactPidFast = phMatchFast?.productId;
            const results = slice.map((h) => {
                const p = products.get(h.productId);
                const meta = h.vectorMetadata;
                const visualScore = Math.round(h.score * 10000) / 100;
                const exactP = exactPidFast === h.productId ? { exactMatchPHash: true } : {};
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
                        null),
                    categoryId: (p.categoryId || null),
                    categoryName: (p.categoryName || p.category || null),
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
                            note: "Les résultats sont renvoyés malgré un cosinus #1 bas ; comparez `vectorTop5Raw`.",
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
                                note: "Pas de scoring composite ni diversification ; similarity = score vectoriel brut.",
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
            if (!skipCacheEffective)
                (0, visualSearchCache_1.setCachedVisualSearch)(cacheKey, payload);
            console.info("[visualImageSearch]", JSON.stringify({
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
            }));
            res.json(payload);
            return;
        }
        const ids = hits.map((h) => h.productId);
        const tProdFull = nowMs();
        const products = await fetchProductsByIds(db, ids);
        timings.productFetchMs = nowMs() - tProdFull;
        if (nowMs() > deadline) {
            const slice = hits.slice(offset, offset + pageLimit);
            const quickResults = slice.map((h) => {
                const p = products.get(h.productId);
                const meta = h.vectorMetadata;
                const visualScore = Math.round(h.score * 10000) / 100;
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
                        null),
                    categoryId: (p.categoryId || null),
                    categoryName: (p.categoryName || p.category || null),
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
            return rankableFromProduct(h.productId, h.score, p, metaPrice, metaImg ?? null);
        });
        const tRank = nowMs();
        const vectorTop3Ids = hits
            .slice(0, VECTOR_HEAD_CATEGORY_EXEMPT)
            .map((h) => h.productId);
        const frozenCategoryNeutralIds = new Set(vectorTop3Ids);
        const filtered = filterRankablesPreservingHeadAndHighSimilarity(rankables, hits, minSimilarity, categoryHint || undefined, intentFromBody);
        let fpMap = new Map();
        if (queryFingerprint && filtered.length > 0) {
            const tFp = nowMs();
            fpMap = await fetchFingerprintMapForRankables(filtered, MAX_FINGERPRINT_FETCH, 5);
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
        const restSorted = [...restScored].sort((a, b) => b.compositeScore - a.compositeScore);
        let embMap = new Map();
        let skippedEmbeddingDedup = false;
        let partialReason;
        const timeForDedup = deepDiversify && nowMs() < deadline - DEDUP_BUDGET_HEADROOM_MS;
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
        }
        else if (deepDiversify && !timeForDedup) {
            skippedEmbeddingDedup = true;
            partialReason = "skipped_embeddings_low_time";
        }
        else if (!deepDiversify) {
            skippedEmbeddingDedup = true;
        }
        const tDiv = nowMs();
        const dedupProtectTopK = Math.min(visualSearchRecallLock_1.VISUAL_SEARCH_RECALL_LOCK.diversifyProtectTopKMax, Math.max(pageLimit, visualSearchRecallLock_1.VISUAL_SEARCH_RECALL_LOCK.diversifyProtectTopKMinFromPage));
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
        let exactMatchPHashProductId = null;
        let phashHammingDistance;
        const { findExactPHashProductId, PHASH_EXACT_MAX_HAMMING } = await Promise.resolve().then(() => __importStar(require("./services/perceptualHash")));
        const { promoteScoredRowToFirst } = await Promise.resolve().then(() => __importStar(require("./services/visualRanking")));
        const phMatchFull = findExactPHashProductId(queryPHash, hits.map((h) => ({
            productId: h.productId,
            perceptualHashHex: h.vectorMetadata?.perceptualHashHex,
        })), PHASH_EXACT_MAX_HAMMING);
        if (phMatchFull) {
            exactMatchPHashProductId = phMatchFull.productId;
            phashHammingDistance = phMatchFull.distance;
            diversified = promoteScoredRowToFirst(diversified, phMatchFull.productId);
        }
        const totalRanked = diversified.length;
        const pageSlice = diversified.slice(offset, offset + pageLimit);
        const hasMore = offset + pageSlice.length < totalRanked;
        const timedOut = nowMs() > deadline;
        let rankingDebugMeta;
        if (rankingDebug) {
            const { vectorOrderTopN, compositeOrderTopN, finalOrderTopN, perResultPageDebug, focusProductAnalysis, } = await Promise.resolve().then(() => __importStar(require("./services/visualRankingDebug")));
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
            console.info("[visualRankingDebug]", JSON.stringify({
                imageHashPrefix: imageHash.slice(0, 12),
                focusProductId: focusProductId ?? null,
                ...rankingDebugMeta,
            }));
        }
        const results = pageSlice.map((row, i) => mapRowToApi(row, products.get(row.productId), hitMap, {
            exactMatchPHashProductId,
            rank: rankingDebug ? offset + i + 1 : undefined,
            debugRanking: rankingDebug,
        }));
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
                        note: "Pipeline complet appliqué ; cosinus #1 sous le plancher informatif — vérifier `vectorTop5Raw` et le catalogue.",
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
        if (!skipCacheEffective && !timedOut)
            (0, visualSearchCache_1.setCachedVisualSearch)(cacheKey, payload);
        console.info("[visualImageSearch]", JSON.stringify({
            phase: "full_path",
            rankingDebug,
            vectorTimings,
            timingsMs: payload.metadata.timingsMs,
            partial: payload.metadata.partial,
        }));
        res.json(payload);
    }
    catch (e) {
        console.error("visualImageSearch", e);
        res.status(500).json({ error: e?.message || "Erreur recherche image" });
    }
});
//# sourceMappingURL=visualImageSearch.js.map