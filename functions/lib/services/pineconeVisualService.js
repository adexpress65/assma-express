"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.querySimilarMerged = exports.querySimilarDoublePass = exports.MAX_PINECONE_MERGED_RESULTS = exports.deleteProductVector = exports.upsertProductVector = exports.isPineconeConfigured = exports.DEFAULT_PINECONE_INDEX_NAME = void 0;
const pinecone_1 = require("@pinecone-database/pinecone");
const clipService_1 = require("./clipService");
let client = null;
exports.DEFAULT_PINECONE_INDEX_NAME = "a2express-products";
function resolvedIndexName() {
    const n = process.env.PINECONE_INDEX_NAME;
    return n != null && String(n).trim().length > 0
        ? String(n).trim()
        : exports.DEFAULT_PINECONE_INDEX_NAME;
}
function isPineconeConfigured() {
    const key = process.env.PINECONE_API_KEY;
    return Boolean(key && key.length > 0);
}
exports.isPineconeConfigured = isPineconeConfigured;
function getIndex() {
    if (!isPineconeConfigured()) {
        throw new Error("Pinecone non configuré (PINECONE_API_KEY)");
    }
    if (!client) {
        client = new pinecone_1.Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    }
    const idx = client.index(resolvedIndexName());
    const ns = process.env.PINECONE_NAMESPACE;
    return ns != null && String(ns).length > 0 ? idx.namespace(String(ns)) : idx;
}
async function upsertProductVector(productId, values, meta) {
    if (values.length !== clipService_1.CLIP_DIMS) {
        throw new Error(`Embedding dimension ${values.length} ≠ index CLIP ${clipService_1.CLIP_DIMS}`);
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
exports.upsertProductVector = upsertProductVector;
async function deleteProductVector(productId) {
    if (!isPineconeConfigured())
        return;
    const index = getIndex();
    await index.deleteOne(productId);
}
exports.deleteProductVector = deleteProductVector;
exports.MAX_PINECONE_MERGED_RESULTS = 96;
async function querySimilarDoublePass(vector, limit) {
    if (vector.length !== clipService_1.CLIP_DIMS) {
        throw new Error(`querySimilarDoublePass: dimension ${vector.length} ≠ index CLIP ${clipService_1.CLIP_DIMS}`);
    }
    const index = getIndex();
    const cap = Math.min(Math.max(limit, 1), exports.MAX_PINECONE_MERGED_RESULTS);
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
    const bestById = new Map();
    const consider = (m) => {
        if (!m.id)
            return;
        const score = m.score ?? 0;
        const row = {
            id: m.id,
            score,
            metadata: m.metadata,
        };
        const prev = bestById.get(m.id);
        if (!prev || score > prev.score)
            bestById.set(m.id, row);
    };
    for (const m of internalRes.matches || [])
        consider(m);
    for (const m of broadRes.matches || [])
        consider(m);
    return Array.from(bestById.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, cap);
}
exports.querySimilarDoublePass = querySimilarDoublePass;
async function querySimilarMerged(vecImage, vecText, limit) {
    if (!vecText?.length || vecText.length !== clipService_1.CLIP_DIMS) {
        return querySimilarDoublePass(vecImage, limit);
    }
    const cap = Math.min(Math.max(limit, 1), exports.MAX_PINECONE_MERGED_RESULTS);
    const perQuery = Math.min(exports.MAX_PINECONE_MERGED_RESULTS, Math.max(cap, 40));
    const [img, txt] = await Promise.all([
        querySimilarDoublePass(vecImage, perQuery),
        querySimilarDoublePass(vecText, perQuery),
    ]);
    const byId = new Map();
    for (const m of img) {
        if (!m.id)
            continue;
        byId.set(m.id, {
            id: m.id,
            score: m.score ?? 0,
            metadata: m.metadata,
        });
    }
    for (const m of txt) {
        if (!m.id)
            continue;
        const s = m.score ?? 0;
        const prev = byId.get(m.id);
        if (!prev) {
            byId.set(m.id, {
                id: m.id,
                score: s * 0.94,
                metadata: m.metadata,
            });
        }
        else {
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
exports.querySimilarMerged = querySimilarMerged;
//# sourceMappingURL=pineconeVisualService.js.map