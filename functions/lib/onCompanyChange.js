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
Object.defineProperty(exports, "__esModule", { value: true });
exports.onCompanyUpdated = exports.onCompanyDeleted = exports.deactivateProductsForCompany = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const algoliaProducts_1 = require("./algoliaProducts");
const PRODUCT_PAGE_SIZE = 400;
const FUNCTION_TIMEOUT_SECONDS = 540;
function isCompanyCatalogActive(data) {
    if (!data)
        return false;
    return data.isActive !== false;
}
async function loadAlgoliaIndex() {
    const { default: algoliasearch } = await Promise.resolve().then(() => __importStar(require("algoliasearch")));
    return (0, algoliaProducts_1.createAlgoliaProductsIndex)(algoliasearch);
}
async function deactivateProductsForCompany(companyId, reason) {
    const db = admin.firestore();
    const col = db.collection("products");
    let last;
    let scanned = 0;
    let deactivated = 0;
    const algoliaIds = [];
    for (;;) {
        let q = col
            .where("companyId", "==", companyId)
            .orderBy(admin.firestore.FieldPath.documentId())
            .limit(PRODUCT_PAGE_SIZE);
        if (last) {
            q = q.startAfter(last);
        }
        const snap = await q.get();
        if (snap.empty)
            break;
        const batch = db.batch();
        let ops = 0;
        const now = admin.firestore.FieldValue.serverTimestamp();
        for (const docSnap of snap.docs) {
            scanned += 1;
            algoliaIds.push(docSnap.id);
            if (docSnap.data()?.isActive === false)
                continue;
            batch.update(docSnap.ref, {
                isActive: false,
                updatedAt: now,
            });
            ops += 1;
            deactivated += 1;
        }
        if (ops > 0) {
            await batch.commit();
        }
        last = snap.docs[snap.docs.length - 1];
        if (snap.size < PRODUCT_PAGE_SIZE)
            break;
    }
    try {
        const index = await loadAlgoliaIndex();
        await (0, algoliaProducts_1.deleteProductIdsFromAlgolia)(index, algoliaIds);
    }
    catch (err) {
        console.error("[onCompanyChange] Algolia cascade failed", {
            companyId,
            reason,
            err,
        });
    }
    console.log(JSON.stringify({
        msg: "onCompanyChange cascade",
        reason,
        companyId,
        scanned,
        deactivated,
        algolia: algoliaIds.length,
    }));
    return { scanned, deactivated, algolia: algoliaIds.length };
}
exports.deactivateProductsForCompany = deactivateProductsForCompany;
exports.onCompanyDeleted = (0, firestore_1.onDocumentDeleted)({
    document: "companies/{companyId}",
    timeoutSeconds: FUNCTION_TIMEOUT_SECONDS,
    memory: "512MiB",
}, async (event) => {
    const companyId = event.params.companyId;
    if (!companyId)
        return;
    await deactivateProductsForCompany(companyId, "deleted");
});
exports.onCompanyUpdated = (0, firestore_1.onDocumentUpdated)({
    document: "companies/{companyId}",
    timeoutSeconds: FUNCTION_TIMEOUT_SECONDS,
    memory: "512MiB",
}, async (event) => {
    const companyId = event.params.companyId;
    if (!companyId)
        return;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after)
        return;
    const wasActive = isCompanyCatalogActive(before);
    const isActive = isCompanyCatalogActive(after);
    if (wasActive && !isActive) {
        await deactivateProductsForCompany(companyId, "suspended");
        return;
    }
});
//# sourceMappingURL=onCompanyChange.js.map