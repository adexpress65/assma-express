"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchProductByImage = exports.embedImageUri = exports.MAX_VECTOR_CANDIDATES = void 0;
const clipService_1 = require("./clipService");
const pineconeVisualService_1 = require("./pineconeVisualService");
const visualSearchCore_1 = require("./visualSearchCore");
const visualIndexMetadata_1 = require("./visualIndexMetadata");
exports.MAX_VECTOR_CANDIDATES = pineconeVisualService_1.MAX_PINECONE_MERGED_RESULTS;
async function embedImageUri(imageUri, fallbackMime = "image/jpeg") {
    const { embedding } = await (0, clipService_1.embedImageWithFingerprint)(imageUri, fallbackMime);
    return embedding;
}
exports.embedImageUri = embedImageUri;
function logSearchTimings(vectorStore, engine, timings) {
    console.info("[searchProductByImage]", JSON.stringify({
        vectorStore,
        engine,
        ...timings,
    }));
}
function logQueryEmbeddingStats(vec) {
    if (!vec.length)
        return;
    const approxNorm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
    console.info("[searchProductByImage] queryEmbeddingStats", JSON.stringify({
        dims: vec.length,
        l2NormApprox: Math.round(approxNorm * 1e6) / 1e6,
        headSample: vec.slice(0, 4).map((x) => Math.round(x * 1e5) / 1e5),
    }));
}
function logVectorHitsPreview(label, matches) {
    const top = matches.slice(0, 5).map((m, i) => ({
        rank: i + 1,
        productId: m.productId,
        similarity: Math.round(m.score * 1e5) / 1e5,
    }));
    console.info(`[searchProductByImage] ${label}`, JSON.stringify({ count: matches.length, top5: top }));
}
async function searchProductByImage(db, imageUri, limit, fallbackMime = "image/jpeg", hybridCaption) {
    const tStart = Date.now();
    const timings = {
        embedClipMs: 0,
        vectorQueryMs: 0,
        firestorePaginatedMs: 0,
        firestoreProductsMs: 0,
        rankTopKMs: 0,
        totalMs: 0,
    };
    const tEmbedStart = Date.now();
    let queryVec;
    let queryFingerprint;
    let queryPHash;
    const clipOnly = process.env.VISUAL_SEARCH_CLIP_ONLY === "1";
    try {
        if (clipOnly) {
            queryVec = await (0, clipService_1.embedClipVectorOnly)(imageUri, fallbackMime);
            queryFingerprint = undefined;
            queryPHash = undefined;
        }
        else {
            const emb = await (0, clipService_1.embedImageWithFingerprint)(imageUri, fallbackMime);
            queryVec = emb.embedding;
            queryFingerprint = emb.fingerprint;
            queryPHash = emb.perceptualHashHex;
        }
        timings.embedClipMs = Date.now() - tEmbedStart;
        logQueryEmbeddingStats(queryVec);
    }
    catch (e) {
        timings.embedClipMs = Date.now() - tEmbedStart;
        timings.totalMs = Date.now() - tStart;
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[searchProductByImage] CLIP / image pipeline failed:", msg);
        logSearchTimings((0, pineconeVisualService_1.isPineconeConfigured)() ? "pinecone" : "firestore", "clip_embed_failed", timings);
        return {
            hits: [],
            engine: "clip_embed_failed",
            vectorStore: (0, pineconeVisualService_1.isPineconeConfigured)() ? "pinecone" : "firestore",
            timings,
            clipEmbedError: msg.slice(0, 500),
            queryPHash: undefined,
        };
    }
    const cap = Math.min(Math.max(limit, 1), exports.MAX_VECTOR_CANDIDATES);
    if (!(0, pineconeVisualService_1.isPineconeConfigured)() &&
        process.env.VISUAL_SEARCH_PINECONE_ONLY === "1") {
        timings.totalMs = Date.now() - tStart;
        console.error("[searchProductByImage] VISUAL_SEARCH_PINECONE_ONLY sans PINECONE_API_KEY — repli Firestore désactivé.");
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
    if ((0, pineconeVisualService_1.isPineconeConfigured)()) {
        let textVec = null;
        const capTrim = hybridCaption?.trim();
        if (capTrim && capTrim.length > 4) {
            const tTxt = Date.now();
            try {
                textVec = await (0, clipService_1.embedClipText)(capTrim);
                timings.embedTextMs = Date.now() - tTxt;
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.warn("[searchProductByImage] embedClipText (hybride) ignoré:", msg.slice(0, 200));
            }
        }
        const tVec = Date.now();
        const matches = await (0, pineconeVisualService_1.querySimilarMerged)(queryVec, textVec, cap);
        timings.vectorQueryMs = Date.now() - tVec;
        timings.totalMs = Date.now() - tStart;
        const engineTag = textVec ? "clip_cosine_pinecone_hybrid" : "clip_cosine_pinecone_double_pass";
        logSearchTimings("pinecone", engineTag, timings);
        logVectorHitsPreview("pinecone_matches", matches.map((m) => ({ productId: m.id, score: m.score })));
        return {
            vectorStore: "pinecone",
            hits: matches.map((m) => ({
                productId: m.id,
                score: m.score,
                vectorMetadata: {
                    price: typeof m.metadata?.price === "number"
                        ? m.metadata.price
                        : Number(m.metadata?.price) || undefined,
                    imageUrl: typeof m.metadata?.imageUrl === "string"
                        ? m.metadata.imageUrl
                        : undefined,
                    catalogScope: typeof m.metadata?.catalogScope === "string"
                        ? m.metadata.catalogScope
                        : undefined,
                    perceptualHashHex: typeof m.metadata?.pHash === "string"
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
    const { rows, truncated, maxDocs } = await (0, visualSearchCore_1.loadEmbeddingsPaginated)(db);
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
    const ranked = (0, visualSearchCore_1.rankTopK)(queryVec, rows, Math.min(rows.length, cap * 2));
    timings.rankTopKMs = Date.now() - tRank;
    logVectorHitsPreview("firestore_ranked", ranked.map((r) => ({ productId: r.productId, score: r.score })));
    const tProd = Date.now();
    const products = await (0, visualSearchCore_1.fetchProductsByIds)(db, ranked.map((r) => r.productId));
    timings.firestoreProductsMs = Date.now() - tProd;
    const internal = [];
    const external = [];
    for (const r of ranked) {
        const p = products.get(r.productId);
        if ((0, visualIndexMetadata_1.catalogScopeFromProduct)(p) === "internal")
            internal.push(r);
        else
            external.push(r);
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
exports.searchProductByImage = searchProductByImage;
//# sourceMappingURL=searchProductByImage.js.map