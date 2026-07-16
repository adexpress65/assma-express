"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visualMetadataFromProduct = exports.catalogScopeFromProduct = void 0;
function catalogScopeFromProduct(data) {
    if (!data)
        return "external";
    const sid = data.sellerId;
    const cid = data.companyId;
    const hasSeller = sid != null && String(sid).trim().length > 0;
    const hasCompany = cid != null && String(cid).trim().length > 0;
    return hasSeller || hasCompany ? "internal" : "external";
}
exports.catalogScopeFromProduct = catalogScopeFromProduct;
function visualMetadataFromProduct(productId, data, extras) {
    const raw = data.mainImage || data.imageUrl || data.image;
    const url = raw != null && typeof raw === "string" ? raw.trim() : "";
    return {
        productId,
        price: Number(data.price) || 0,
        imageUrl: url,
        catalogScope: catalogScopeFromProduct(data),
        ...(extras?.perceptualHashHex
            ? { perceptualHashHex: extras.perceptualHashHex }
            : {}),
    };
}
exports.visualMetadataFromProduct = visualMetadataFromProduct;
//# sourceMappingURL=visualIndexMetadata.js.map