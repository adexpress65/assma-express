"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rankableFromProduct = exports.normalizeImageKey = exports.diversifyResults = exports.fetchFingerprintMapForRankables = exports.promoteScoredRowToFirst = exports.buildHeadOrdered = exports.takePinnedRawHits = exports.scoreRankableHitsVisual = exports.blendVisualSimilarity = exports.MAX_FINGERPRINT_FETCH = exports.EXACT_MATCH_COSINE = exports.HEAD_DIVERSITY_SKIP = exports.PIN_RAW_TOP_K = exports.VISUAL_BLEND_WEIGHTS = exports.scoreRankableHits = exports.applyWeights = exports.legacyCategoryHintTerm = exports.computeScore = exports.applyCosineSimilarityBoost = exports.filterRankablesPreservingHeadAndHighSimilarity = exports.VECTOR_HEAD_CATEGORY_EXEMPT = exports.HIGH_SIMILARITY_NEVER_FILTER = exports.filterResultsPreservingVectorTop3 = exports.filterResults = exports.categoriesCompatibleForDedup = exports.normalizeCategoryKey = exports.computeIntentCategoryTerm = exports.extractIntentKeywords = exports.RANKING_WEIGHTS = exports.MAX_EMBEDDING_DEDUP_FETCH = exports.ADAPTIVE_WEAK_TOP_SIMILARITY = exports.getConfidenceGateMin = exports.CONFIDENCE_GATE_MIN_TOP_SIMILARITY = exports.DEFAULT_DUPLICATE_SIMILARITY = exports.DEFAULT_MIN_SIMILARITY = void 0;
const clipService_1 = require("./clipService");
const visualSearchCore_1 = require("./visualSearchCore");
const visualSearchRecallLock_1 = require("./visualSearchRecallLock");
exports.DEFAULT_MIN_SIMILARITY = 0.23;
exports.DEFAULT_DUPLICATE_SIMILARITY = 0.97;
exports.CONFIDENCE_GATE_MIN_TOP_SIMILARITY = 0.3;
function getConfidenceGateMin() {
    const n = Number(process.env.VISUAL_SEARCH_CONFIDENCE_GATE_MIN);
    if (Number.isFinite(n) && n >= 0.15 && n <= 0.95)
        return n;
    return exports.CONFIDENCE_GATE_MIN_TOP_SIMILARITY;
}
exports.getConfidenceGateMin = getConfidenceGateMin;
exports.ADAPTIVE_WEAK_TOP_SIMILARITY = 0.48;
exports.MAX_EMBEDDING_DEDUP_FETCH = 18;
exports.RANKING_WEIGHTS = {
    cosine: 0.7,
    popularity: 0.12,
    price: 0.1,
    category: 0.08,
};
const STOPWORDS = new Set([
    "le",
    "la",
    "les",
    "un",
    "une",
    "des",
    "de",
    "du",
    "et",
    "ou",
    "pour",
    "avec",
    "sans",
    "sur",
    "dans",
    "the",
    "a",
    "an",
    "and",
    "or",
    "for",
    "with",
    "from",
    "new",
    "hot",
    "sale",
]);
function extractIntentKeywords(...sources) {
    const seen = new Set();
    const out = [];
    for (const src of sources) {
        if (!src || typeof src !== "string")
            continue;
        const normalized = src
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\u00c0-\u024f\s-]/gi, " ");
        const parts = normalized.split(/[\s,/|+]+/).filter(Boolean);
        for (let p of parts) {
            p = p.replace(/^-+|-+$/g, "").trim();
            if (p.length < 3 || STOPWORDS.has(p))
                continue;
            if (!seen.has(p)) {
                seen.add(p);
                out.push(p);
            }
        }
    }
    return out.slice(0, 24);
}
exports.extractIntentKeywords = extractIntentKeywords;
function computeIntentCategoryTerm(p, intentKeywords) {
    if (!intentKeywords.length)
        return 0;
    const cat = (p.categoryName || "").toLowerCase();
    const nm = (p.name || "").toLowerCase();
    const blob = `${cat} ${nm}`;
    let hits = 0;
    for (const kw of intentKeywords) {
        if (kw.length >= 3 && blob.includes(kw))
            hits += 1;
    }
    const overlap = hits / intentKeywords.length;
    let prefixBonus = 0;
    const sorted = [...intentKeywords].sort((a, b) => b.length - a.length);
    const longest = sorted[0];
    if (longest && longest.length >= 6 && blob.includes(longest)) {
        prefixBonus = 0.15;
    }
    return Math.min(1, overlap * 0.85 + prefixBonus);
}
exports.computeIntentCategoryTerm = computeIntentCategoryTerm;
function normalizeCategoryKey(categoryName) {
    if (!categoryName || typeof categoryName !== "string")
        return "";
    return categoryName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .slice(0, 56);
}
exports.normalizeCategoryKey = normalizeCategoryKey;
function categoriesCompatibleForDedup(a, b) {
    const ka = normalizeCategoryKey(a.categoryName);
    const kb = normalizeCategoryKey(b.categoryName);
    if (!ka || !kb)
        return true;
    if (ka === kb)
        return true;
    if (ka.includes(kb) || kb.includes(ka))
        return true;
    const ta = new Set(ka.split(/\s+/).filter((t) => t.length > 2));
    const tb = new Set(kb.split(/\s+/).filter((t) => t.length > 2));
    let inter = 0;
    for (const x of ta)
        if (tb.has(x))
            inter += 1;
    if (inter >= 2)
        return true;
    return false;
}
exports.categoriesCompatibleForDedup = categoriesCompatibleForDedup;
function filterResults(items, minSimilarity = exports.DEFAULT_MIN_SIMILARITY) {
    return items.filter((x) => x.cosine >= minSimilarity);
}
exports.filterResults = filterResults;
function filterResultsPreservingVectorTop3(items, minSimilarity, vectorTop3ProductIds) {
    const top3 = new Set(vectorTop3ProductIds.slice(0, 3));
    return items.filter((x) => x.cosine >= minSimilarity || top3.has(x.productId));
}
exports.filterResultsPreservingVectorTop3 = filterResultsPreservingVectorTop3;
exports.HIGH_SIMILARITY_NEVER_FILTER = 0.9;
exports.VECTOR_HEAD_CATEGORY_EXEMPT = visualSearchRecallLock_1.VISUAL_SEARCH_RECALL_LOCK.vectorHeadCategoryExempt;
function filterRankablesPreservingHeadAndHighSimilarity(items, vectorHitsOrdered, minSimilarity, categoryHint, intentKeywordSources) {
    const headN = Math.min(exports.VECTOR_HEAD_CATEGORY_EXEMPT, vectorHitsOrdered.length);
    const topHead = new Set(vectorHitsOrdered.slice(0, headN).map((h) => h.productId));
    const indexById = new Map();
    vectorHitsOrdered.forEach((h, i) => indexById.set(h.productId, i));
    const intentKeywords = extractIntentKeywords(categoryHint ?? "", ...intentKeywordSources.map((x) => String(x)));
    return items.filter((r) => {
        if (r.cosine > exports.HIGH_SIMILARITY_NEVER_FILTER)
            return true;
        if (topHead.has(r.productId))
            return true;
        if (r.cosine < minSimilarity)
            return false;
        const idx = indexById.get(r.productId);
        if (idx !== undefined && idx < headN)
            return true;
        return passesCategoryIntentFilter(r, intentKeywords, categoryHint);
    });
}
exports.filterRankablesPreservingHeadAndHighSimilarity = filterRankablesPreservingHeadAndHighSimilarity;
function passesCategoryIntentFilter(r, intentKeywords, categoryHint) {
    if (intentKeywords.length > 0) {
        return (computeIntentCategoryTerm(r, intentKeywords) >=
            visualSearchRecallLock_1.VISUAL_SEARCH_RECALL_LOCK.intentCategoryTermMin);
    }
    const hint = (categoryHint || "").trim();
    if (hint.length < 3)
        return true;
    return legacyCategoryHintTerm(r, categoryHint) >= 0.5;
}
function applyCosineSimilarityBoost(compositeScore, cosine) {
    let s = clamp01(compositeScore);
    if (cosine > 0.97)
        return clamp01(s + 0.7);
    if (cosine > 0.92)
        return clamp01(s + 0.3);
    return s;
}
exports.applyCosineSimilarityBoost = applyCosineSimilarityBoost;
function clamp01(x) {
    if (x <= 0)
        return 0;
    if (x >= 1)
        return 1;
    return x;
}
function computeScore(p, ctx) {
    const cosineTerm = clamp01(p.cosine);
    let popularityTerm = 0;
    if (ctx.maxSold > 0 && p.soldCount > 0) {
        popularityTerm = clamp01(Math.log(1 + p.soldCount) / Math.log(1 + ctx.maxSold));
    }
    else {
        popularityTerm = clamp01((p.rating || 0) / 5);
    }
    let priceTerm = 0.5;
    if (ctx.maxPrice > ctx.minPrice && ctx.minPrice >= 0) {
        priceTerm =
            1 -
                (p.price - ctx.minPrice) / (ctx.maxPrice - ctx.minPrice + 1e-9);
        priceTerm = clamp01(priceTerm);
    }
    const categoryTerm = ctx.intentKeywords.length > 0
        ? computeIntentCategoryTerm(p, ctx.intentKeywords)
        : legacyCategoryHintTerm(p, ctx.categoryHint);
    return { cosineTerm, popularityTerm, priceTerm, categoryTerm };
}
exports.computeScore = computeScore;
function legacyCategoryHintTerm(p, categoryHint) {
    const hint = (categoryHint || "").trim().toLowerCase();
    if (hint.length < 3)
        return 0;
    const cat = (p.categoryName || "").toLowerCase();
    const nm = (p.name || "").toLowerCase();
    const token = hint.split(/\s+/).find((t) => t.length >= 4) || hint.slice(0, 48);
    if (token && (cat.includes(token) || nm.includes(token)))
        return 1;
    return 0;
}
exports.legacyCategoryHintTerm = legacyCategoryHintTerm;
function applyWeights(components, weights = exports.RANKING_WEIGHTS) {
    return (weights.cosine * components.cosineTerm +
        weights.popularity * components.popularityTerm +
        weights.price * components.priceTerm +
        weights.category * components.categoryTerm);
}
exports.applyWeights = applyWeights;
function scoreRankableHits(items, options) {
    if (!items.length)
        return [];
    const mergedWeights = {
        ...exports.RANKING_WEIGHTS,
        ...options?.weights,
    };
    const hint = options?.categoryHint ?? null;
    const extra = options?.intentKeywords ?? [];
    const intentKeywords = extractIntentKeywords(hint, ...extra.map((x) => String(x)));
    const prices = items.map((i) => Math.max(0, Number(i.price) || 0));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const soldCounts = items.map((i) => Math.max(0, i.soldCount));
    const maxSold = Math.max(1, ...soldCounts);
    const ctx = {
        minPrice,
        maxPrice,
        maxSold,
        categoryHint: hint,
        intentKeywords,
        weights: mergedWeights,
    };
    return items.map((p) => {
        const components = computeScore(p, ctx);
        if (options?.frozenCategoryNeutralIds?.has(p.productId)) {
            components.categoryTerm = 0.5;
        }
        let compositeScore = applyWeights(components, mergedWeights);
        compositeScore = applyCosineSimilarityBoost(compositeScore, p.cosine);
        return { ...p, compositeScore, components };
    });
}
exports.scoreRankableHits = scoreRankableHits;
exports.VISUAL_BLEND_WEIGHTS = { clip: 0.7, color: 0.2, shape: 0.1 };
exports.PIN_RAW_TOP_K = 3;
exports.HEAD_DIVERSITY_SKIP = 5;
exports.EXACT_MATCH_COSINE = 0.995;
exports.MAX_FINGERPRINT_FETCH = 28;
function blendVisualSimilarity(cosine, queryFp, productFp) {
    let colorTerm = cosine;
    let shapeTerm = cosine;
    if (productFp) {
        const c = (0, clipService_1.compareVisualFingerprints)(queryFp, productFp);
        colorTerm = c.colorSim;
        shapeTerm = c.shapeSim;
    }
    let blend = exports.VISUAL_BLEND_WEIGHTS.clip * cosine +
        exports.VISUAL_BLEND_WEIGHTS.color * colorTerm +
        exports.VISUAL_BLEND_WEIGHTS.shape * shapeTerm;
    if (colorTerm > 0.9)
        blend = Math.min(1, blend + 0.06);
    if (shapeTerm > 0.9)
        blend = Math.min(1, blend + 0.06);
    return { blend: clamp01(blend), colorTerm, shapeTerm };
}
exports.blendVisualSimilarity = blendVisualSimilarity;
function scoreRankableHitsVisual(items, queryFp, productFpMap, options) {
    if (!items.length)
        return [];
    const mergedWeights = {
        ...exports.RANKING_WEIGHTS,
        ...options?.weights,
    };
    const hint = options?.categoryHint ?? null;
    const extra = options?.intentKeywords ?? [];
    const intentKeywords = extractIntentKeywords(hint, ...extra.map((x) => String(x)));
    const prices = items.map((i) => Math.max(0, Number(i.price) || 0));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const soldCounts = items.map((i) => Math.max(0, i.soldCount));
    const maxSold = Math.max(1, ...soldCounts);
    const ctx = {
        minPrice,
        maxPrice,
        maxSold,
        categoryHint: hint,
        intentKeywords,
        weights: mergedWeights,
    };
    return items.map((p) => {
        const eco = computeScore(p, ctx);
        if (options?.frozenCategoryNeutralIds?.has(p.productId)) {
            eco.categoryTerm = 0.5;
        }
        const { blend, colorTerm, shapeTerm } = blendVisualSimilarity(p.cosine, queryFp, productFpMap.get(p.productId));
        let compositeScore = clamp01(0.82 * blend +
            0.06 * eco.popularityTerm +
            0.06 * eco.priceTerm +
            0.06 * eco.categoryTerm);
        compositeScore = applyCosineSimilarityBoost(compositeScore, p.cosine);
        return {
            ...p,
            compositeScore,
            components: {
                cosineTerm: eco.cosineTerm,
                popularityTerm: eco.popularityTerm,
                priceTerm: eco.priceTerm,
                categoryTerm: eco.categoryTerm,
                colorTerm,
                shapeTerm,
                visualBlend: blend,
            },
        };
    });
}
exports.scoreRankableHitsVisual = scoreRankableHitsVisual;
function takePinnedRawHits(rawHits, scoredById, k = exports.PIN_RAW_TOP_K) {
    return rawHits
        .slice(0, k)
        .map((h) => scoredById.get(h.productId))
        .filter((x) => x != null);
}
exports.takePinnedRawHits = takePinnedRawHits;
function buildHeadOrdered(hits, scoredById, options) {
    const maxHead = options?.maxHead ?? exports.HEAD_DIVERSITY_SKIP;
    const ordered = [];
    const seen = new Set();
    for (let i = 0; i < Math.min(3, hits.length); i++) {
        const id = hits[i].productId;
        ordered.push(id);
        seen.add(id);
    }
    const restSorted = [...scoredById.values()]
        .filter((s) => !seen.has(s.productId))
        .sort((a, b) => b.compositeScore - a.compositeScore);
    for (const s of restSorted) {
        if (ordered.length >= maxHead)
            break;
        ordered.push(s.productId);
        seen.add(s.productId);
    }
    return ordered
        .map((id) => scoredById.get(id))
        .filter((x) => x != null);
}
exports.buildHeadOrdered = buildHeadOrdered;
function promoteScoredRowToFirst(list, productId) {
    const idx = list.findIndex((x) => x.productId === productId);
    if (idx <= 0)
        return list;
    const copy = [...list];
    const [row] = copy.splice(idx, 1);
    return [row, ...copy];
}
exports.promoteScoredRowToFirst = promoteScoredRowToFirst;
async function fetchFingerprintMapForRankables(rankables, maxProducts, concurrency = 5) {
    const m = new Map();
    const slice = rankables.slice(0, maxProducts);
    for (let i = 0; i < slice.length; i += concurrency) {
        const chunk = slice.slice(i, i + concurrency);
        const pairs = await Promise.all(chunk.map(async (r) => {
            const fp = await (0, clipService_1.fetchFingerprintFromImageUrl)(r.imageUrl);
            return [r.productId, fp];
        }));
        for (const [id, fp] of pairs)
            m.set(id, fp);
    }
    return m;
}
exports.fetchFingerprintMapForRankables = fetchFingerprintMapForRankables;
function diversifyResults(scored, embeddings, options) {
    const thr = options?.duplicateThreshold ?? exports.DEFAULT_DUPLICATE_SIMILARITY;
    const categoryAware = options?.categoryAwareDedup ?? true;
    const protectTopK = Math.max(0, Math.floor(options?.protectTopK ?? 0));
    const neverRemoveAbove = options?.neverRemoveEmbeddingCosineAbove ?? exports.HIGH_SIMILARITY_NEVER_FILTER;
    const sorted = [...scored].sort((a, b) => b.compositeScore - a.compositeScore);
    const chosen = [];
    const seenImageKeys = new Set();
    for (const cand of sorted) {
        if (cand.cosine > neverRemoveAbove) {
            chosen.push(cand);
            continue;
        }
        if (chosen.length < protectTopK) {
            const imgKey = normalizeImageKey(cand.imageUrl);
            if (imgKey && seenImageKeys.has(imgKey))
                continue;
            if (imgKey)
                seenImageKeys.add(imgKey);
            chosen.push(cand);
            continue;
        }
        let tooClose = false;
        for (const prev of chosen) {
            const embC = embeddings.get(cand.productId);
            const embP = embeddings.get(prev.productId);
            if (embC && embP && embC.length === embP.length) {
                const sim = (0, visualSearchCore_1.cosineSimilarity)(embC, embP);
                if (sim >= thr) {
                    if (categoryAware && !categoriesCompatibleForDedup(cand, prev)) {
                        continue;
                    }
                    tooClose = true;
                    break;
                }
            }
        }
        if (tooClose)
            continue;
        const imgKey = normalizeImageKey(cand.imageUrl);
        if (imgKey && seenImageKeys.has(imgKey))
            continue;
        if (imgKey)
            seenImageKeys.add(imgKey);
        chosen.push(cand);
    }
    return chosen;
}
exports.diversifyResults = diversifyResults;
function normalizeImageKey(url) {
    if (!url || typeof url !== "string")
        return "";
    try {
        const u = url.split("?")[0].trim().toLowerCase();
        return u.length > 20 ? u.slice(-80) : u;
    }
    catch {
        return "";
    }
}
exports.normalizeImageKey = normalizeImageKey;
function rankableFromProduct(productId, cosine, data, fallbackPrice, fallbackImage) {
    const d = data || {};
    const price = Number(d.price ?? fallbackPrice ?? 0) || 0;
    const sold = Number(d.soldCount ?? d.orders ?? 0) || 0;
    const rating = Number(d.rating ?? 0) || 0;
    const categoryName = (d.categoryName || d.category || null);
    const categoryId = (d.categoryId != null ? String(d.categoryId) : null);
    const name = (d.name || null);
    const imageUrl = (d.mainImage || d.imageUrl || d.image || fallbackImage || null);
    return {
        productId,
        cosine,
        price,
        soldCount: sold,
        rating,
        categoryName,
        categoryId,
        name,
        imageUrl,
    };
}
exports.rankableFromProduct = rankableFromProduct;
//# sourceMappingURL=visualRanking.js.map