"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichHitsWithPhashIfMissing = exports.fetchPhashHexByProductIds = exports.fetchEmbeddingsByProductIds = exports.fetchProductsByIds = exports.rankTopK = exports.loadEmbeddingsPaginated = exports.loadAllEmbeddings = exports.parseProductEmbedding = exports.cosineSimilarity = exports.l2NormalizeVector = exports.maxFirestoreEmbeddingDocs = exports.EMBEDDINGS_COLLECTION = void 0;
const firestore_1 = require("firebase-admin/firestore");
exports.EMBEDDINGS_COLLECTION = "product_image_embeddings";
function maxFirestoreEmbeddingDocs() {
    const n = Number(process.env.MAX_FIRESTORE_EMBEDDING_DOCS);
    if (Number.isFinite(n) && n >= 100)
        return Math.min(Math.floor(n), 20000);
    return 3000;
}
exports.maxFirestoreEmbeddingDocs = maxFirestoreEmbeddingDocs;
function l2NormalizeVector(a) {
    const n = Math.sqrt(a.reduce((s, x) => s + x * x, 0)) || 1;
    return a.map((x) => x / n);
}
exports.l2NormalizeVector = l2NormalizeVector;
function cosineSimilarity(a, b) {
    const n = Math.min(a.length, b.length);
    if (n === 0)
        return 0;
    const na = l2NormalizeVector(a.slice(0, n));
    const nb = l2NormalizeVector(b.slice(0, n));
    let s = 0;
    for (let i = 0; i < n; i += 1) {
        s += na[i] * nb[i];
    }
    return s;
}
exports.cosineSimilarity = cosineSimilarity;
function parseProductEmbedding(data) {
    let emb = data.embedding;
    if (!emb && typeof data.embeddingJson === "string") {
        try {
            emb = JSON.parse(data.embeddingJson);
        }
        catch {
            return null;
        }
    }
    if (!Array.isArray(emb) || emb.length < 64)
        return null;
    return emb.map((x) => Number(x));
}
exports.parseProductEmbedding = parseProductEmbedding;
async function loadAllEmbeddings(db) {
    const { rows } = await loadEmbeddingsPaginated(db);
    return rows;
}
exports.loadAllEmbeddings = loadAllEmbeddings;
async function loadEmbeddingsPaginated(db) {
    const maxDocs = maxFirestoreEmbeddingDocs();
    const pageSize = 500;
    const out = [];
    let last = null;
    let truncated = false;
    while (out.length < maxDocs) {
        const take = Math.min(pageSize, maxDocs - out.length);
        let q = db
            .collection(exports.EMBEDDINGS_COLLECTION)
            .select("embedding", "embeddingJson", "productId", "perceptualHashHex")
            .orderBy(firestore_1.FieldPath.documentId())
            .limit(take);
        if (last)
            q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty)
            break;
        snap.forEach((doc) => {
            if (out.length >= maxDocs)
                return;
            const d = doc.data();
            const productId = String(d.productId || doc.id);
            const embedding = parseProductEmbedding(d);
            if (!embedding)
                return;
            const perceptualHashHex = typeof d.perceptualHashHex === "string" && d.perceptualHashHex.length === 16
                ? d.perceptualHashHex
                : undefined;
            out.push({ docId: doc.id, productId, embedding, perceptualHashHex });
        });
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < take)
            break;
        if (out.length >= maxDocs) {
            truncated = true;
            break;
        }
    }
    if (out.length >= maxDocs)
        truncated = true;
    return { rows: out, truncated, maxDocs };
}
exports.loadEmbeddingsPaginated = loadEmbeddingsPaginated;
function rankTopK(queryVec, rows, topK) {
    return rows
        .map((r) => ({ ...r, score: cosineSimilarity(queryVec, r.embedding) }))
        .sort((x, y) => y.score - x.score)
        .slice(0, topK);
}
exports.rankTopK = rankTopK;
const PRODUCT_CHUNK = 10;
async function fetchProductsByIds(db, productIds) {
    const map = new Map();
    const unique = [...new Set(productIds)];
    const chunks = [];
    for (let i = 0; i < unique.length; i += PRODUCT_CHUNK) {
        chunks.push(unique.slice(i, i + PRODUCT_CHUNK));
    }
    const maps = await Promise.all(chunks.map(async (slice) => {
        const refs = slice.map((id) => db.collection("products").doc(id));
        const snaps = await db.getAll(...refs);
        const m = new Map();
        snaps.forEach((s) => {
            if (s.exists)
                m.set(s.id, s.data() || {});
        });
        return m;
    }));
    for (const m of maps) {
        for (const [k, v] of m)
            map.set(k, v);
    }
    return map;
}
exports.fetchProductsByIds = fetchProductsByIds;
const EMB_CHUNK = 10;
async function fetchEmbeddingsByProductIds(db, productIds) {
    const out = new Map();
    const unique = [...new Set(productIds)];
    const chunks = [];
    for (let i = 0; i < unique.length; i += EMB_CHUNK) {
        chunks.push(unique.slice(i, i + EMB_CHUNK));
    }
    const maps = await Promise.all(chunks.map(async (slice) => {
        const refs = slice.map((id) => db.collection(exports.EMBEDDINGS_COLLECTION).doc(id));
        const snaps = await db.getAll(...refs);
        const m = new Map();
        snaps.forEach((s) => {
            if (!s.exists)
                return;
            const emb = parseProductEmbedding(s.data() || {});
            if (emb)
                m.set(s.id, emb);
        });
        return m;
    }));
    for (const m of maps) {
        for (const [k, v] of m)
            out.set(k, v);
    }
    return out;
}
exports.fetchEmbeddingsByProductIds = fetchEmbeddingsByProductIds;
async function fetchPhashHexByProductIds(db, productIds) {
    const out = new Map();
    const unique = [...new Set(productIds)];
    const chunks = [];
    for (let i = 0; i < unique.length; i += EMB_CHUNK) {
        chunks.push(unique.slice(i, i + EMB_CHUNK));
    }
    for (const slice of chunks) {
        const refs = slice.map((id) => db.collection(exports.EMBEDDINGS_COLLECTION).doc(id));
        const snaps = await db.getAll(...refs);
        snaps.forEach((s) => {
            if (!s.exists)
                return;
            const ph = (s.data() || {}).perceptualHashHex;
            if (typeof ph === "string" && ph.length === 16)
                out.set(s.id, ph);
        });
    }
    return out;
}
exports.fetchPhashHexByProductIds = fetchPhashHexByProductIds;
async function enrichHitsWithPhashIfMissing(db, hits) {
    const missing = hits
        .filter((h) => !h.vectorMetadata?.perceptualHashHex)
        .map((h) => h.productId);
    if (!missing.length)
        return;
    const map = await fetchPhashHexByProductIds(db, missing);
    for (const h of hits) {
        const ph = map.get(h.productId);
        if (!ph)
            continue;
        h.vectorMetadata = { ...h.vectorMetadata, perceptualHashHex: ph };
    }
}
exports.enrichHitsWithPhashIfMissing = enrichHitsWithPhashIfMissing;
//# sourceMappingURL=visualSearchCore.js.map