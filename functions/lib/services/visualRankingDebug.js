"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.focusProductAnalysis = exports.explainGapVsLeader = exports.perResultPageDebug = exports.finalOrderTopN = exports.compositeOrderTopN = exports.vectorOrderTopN = void 0;
const visualRanking_1 = require("./visualRanking");
function vectorOrderTopN(hits, n = 5) {
    return hits.slice(0, n).map((h, i) => ({
        rank: i + 1,
        productId: h.productId,
        vectorSimilarity: h.score,
    }));
}
exports.vectorOrderTopN = vectorOrderTopN;
function compositeOrderTopN(scored, n = 5) {
    const sorted = [...scored].sort((a, b) => b.compositeScore - a.compositeScore);
    return sorted.slice(0, n).map((s, i) => ({
        rank: i + 1,
        productId: s.productId,
        similarity: s.cosine,
        compositeScore: s.compositeScore,
        components: s.components,
    }));
}
exports.compositeOrderTopN = compositeOrderTopN;
function finalOrderTopN(diversified, n = 5) {
    return diversified.slice(0, n).map((s, i) => ({
        rank: i + 1,
        productId: s.productId,
        similarity: s.cosine,
        finalScore: s.compositeScore,
        components: s.components,
    }));
}
exports.finalOrderTopN = finalOrderTopN;
function perResultPageDebug(diversified, offset, pageLimit) {
    const slice = diversified.slice(offset, offset + pageLimit);
    return slice.map((s, idx) => ({
        rank: offset + idx + 1,
        productId: s.productId,
        similarity: s.cosine,
        finalScore: s.compositeScore,
        components: s.components,
    }));
}
exports.perResultPageDebug = perResultPageDebug;
function weightedEcoDelta(focus, leader) {
    const w = visualRanking_1.RANKING_WEIGHTS;
    return {
        cosineWeighted: w.cosine * (focus.components.cosineTerm - leader.components.cosineTerm),
        popularityWeighted: w.popularity *
            (focus.components.popularityTerm - leader.components.popularityTerm),
        priceWeighted: w.price * (focus.components.priceTerm - leader.components.priceTerm),
        categoryWeighted: w.category *
            (focus.components.categoryTerm - leader.components.categoryTerm),
    };
}
function visualBlendDeltaNotes(focus, leader) {
    const f = focus.components.visualBlend;
    const l = leader.components.visualBlend;
    if (f === undefined || l === undefined)
        return {};
    return { focusBlend: f, leaderBlend: l, delta: f - l };
}
function explainGapVsLeader(focus, leader, options) {
    const notes = [];
    const simDelta = focus.cosine - leader.cosine;
    const scoreDelta = focus.compositeScore - leader.compositeScore;
    if (focus.productId === leader.productId) {
        return {
            summary: "focus_is_leader",
            largestPenalties: [],
            notes: ["Le produit focus est déjà en tête."],
        };
    }
    const eco = weightedEcoDelta(focus, leader);
    const axes = [
        { axis: "cosine_term_weighted", deltaApprox: eco.cosineWeighted },
        { axis: "popularity_term_weighted", deltaApprox: eco.popularityWeighted },
        { axis: "price_term_weighted", deltaApprox: eco.priceWeighted },
        { axis: "category_intent_term_weighted", deltaApprox: eco.categoryWeighted },
    ];
    if (options?.useVisualBlend && focus.components.visualBlend != null) {
        const vb = visualBlendDeltaNotes(focus, leader);
        if (vb.delta !== undefined) {
            axes.push({
                axis: "visual_blend_approx",
                deltaApprox: vb.delta * 0.82,
            });
        }
    }
    const largestPenalties = [...axes]
        .filter((a) => a.deltaApprox < -1e-6)
        .sort((a, b) => a.deltaApprox - b.deltaApprox)
        .slice(0, 4);
    if (simDelta < -0.02) {
        notes.push(`Similarité vectorielle (CLIP) plus faible pour le focus (${simDelta.toFixed(4)} vs leader).`);
    }
    if (focus.components.categoryTerm < leader.components.categoryTerm - 0.08) {
        notes.push("Intention / catégorie : terme plus bas pour le focus (mots-clés ou hint).");
    }
    if (focus.components.popularityTerm < leader.components.popularityTerm - 0.08) {
        notes.push("Popularité / ventes : terme plus bas pour le focus.");
    }
    if (focus.components.priceTerm < leader.components.priceTerm - 0.08) {
        notes.push("Prix relatif au pool : terme plus bas (souvent produit plus cher que la médiane du lot).");
    }
    if (focus.components.colorTerm != null &&
        leader.components.colorTerm != null &&
        focus.components.colorTerm < leader.components.colorTerm - 0.1) {
        notes.push("Couleur / histogramme : similarité couleur plus faible que le leader (empreinte image).");
    }
    if (focus.components.shapeTerm != null &&
        leader.components.shapeTerm != null &&
        focus.components.shapeTerm < leader.components.shapeTerm - 0.1) {
        notes.push("Forme / bords : similarité de structure plus faible que le leader.");
    }
    let summary = `Écart score final ≈ ${scoreDelta.toFixed(4)} (focus vs leader).`;
    if (largestPenalties.length > 0) {
        summary += ` Pénalités pondérées les plus fortes : ${largestPenalties
            .map((x) => `${x.axis} (${x.deltaApprox.toFixed(4)})`)
            .join(", ")}.`;
    }
    else {
        summary +=
            " Pas de pénalité nette sur les termes éco classiques ; vérifier boosts cosinus ou ordre tête vectorielle / pHash.";
    }
    return { summary, largestPenalties, notes };
}
exports.explainGapVsLeader = explainGapVsLeader;
function focusProductAnalysis(input) {
    const { focusProductId, hits, diversified, queryFingerprint } = input;
    const vectorIdx = hits.findIndex((h) => h.productId === focusProductId);
    const finalIdx = diversified.findIndex((h) => h.productId === focusProductId);
    if (finalIdx < 0) {
        return {
            focusProductId,
            inVectorHits: vectorIdx >= 0,
            vectorRank: vectorIdx >= 0 ? vectorIdx + 1 : null,
            inFinalRanking: false,
            hint: "Produit absent du classement final (filtré par similarité / intention, ou hors page candidate).",
        };
    }
    const focus = diversified[finalIdx];
    const leader = diversified[0];
    const explain = explainGapVsLeader(focus, leader, {
        useVisualBlend: queryFingerprint,
    });
    return {
        focusProductId,
        vectorRank: vectorIdx >= 0 ? vectorIdx + 1 : null,
        vectorSimilarity: vectorIdx >= 0 ? hits[vectorIdx].score : null,
        finalRank: finalIdx + 1,
        focus: {
            similarity: focus.cosine,
            finalScore: focus.compositeScore,
            components: focus.components,
        },
        leader: {
            productId: leader.productId,
            similarity: leader.cosine,
            finalScore: leader.compositeScore,
            components: leader.components,
        },
        delta: {
            similarity: focus.cosine - leader.cosine,
            finalScore: focus.compositeScore - leader.compositeScore,
        },
        explain,
    };
}
exports.focusProductAnalysis = focusProductAnalysis;
//# sourceMappingURL=visualRankingDebug.js.map