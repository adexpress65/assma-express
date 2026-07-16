"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCachedVisualSearch = exports.getCachedVisualSearch = exports.buildVisualSearchCacheKey = exports.hashImageBuffer = exports.hashImagePayload = void 0;
const crypto_1 = require("crypto");
const MAX_ENTRIES = 250;
const DEFAULT_TTL_MS = 4 * 60 * 1000;
const store = new Map();
function hashImagePayload(payloadUri) {
    const h = (0, crypto_1.createHash)("sha256");
    const maxChunk = 400000;
    if (payloadUri.length > maxChunk) {
        h.update(payloadUri.slice(0, maxChunk));
        h.update(`|len=${payloadUri.length}`);
    }
    else {
        h.update(payloadUri);
    }
    return h.digest("hex");
}
exports.hashImagePayload = hashImagePayload;
function hashImageBuffer(buf) {
    return (0, crypto_1.createHash)("sha256").update(buf).digest("hex");
}
exports.hashImageBuffer = hashImageBuffer;
function buildVisualSearchCacheKey(input) {
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
exports.buildVisualSearchCacheKey = buildVisualSearchCacheKey;
function getCachedVisualSearch(key) {
    const v = store.get(key);
    if (!v)
        return null;
    if (Date.now() > v.expiresAt) {
        store.delete(key);
        return null;
    }
    return v.payload;
}
exports.getCachedVisualSearch = getCachedVisualSearch;
function setCachedVisualSearch(key, payload, ttlMs = DEFAULT_TTL_MS) {
    while (store.size >= MAX_ENTRIES) {
        const first = store.keys().next().value;
        if (first === undefined)
            break;
        store.delete(first);
    }
    store.set(key, { payload, expiresAt: Date.now() + ttlMs });
}
exports.setCachedVisualSearch = setCachedVisualSearch;
//# sourceMappingURL=visualSearchCache.js.map