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
exports.runBackfillEmbeddings = void 0;
const admin = __importStar(require("firebase-admin"));
const clipService_1 = require("./services/clipService");
const pineconeVisualService_1 = require("./services/pineconeVisualService");
const visualIndexMetadata_1 = require("./services/visualIndexMetadata");
const visualSearchCore_1 = require("./services/visualSearchCore");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
function productImageUrl(data) {
    const u = data.mainImage || data.imageUrl || data.image;
    if (!u || typeof u !== "string")
        return null;
    const t = u.trim();
    if (t.startsWith("http://") || t.startsWith("https://"))
        return t;
    return null;
}
async function main() {
    const lim = Math.min(Math.max(Number(process.env.BACKFILL_LIMIT) || 8000, 1), 8000);
    const snap = await db.collection("products").limit(lim).get();
    console.log(`[backfill] ${snap.size} documents products`);
    let ok = 0;
    let skip = 0;
    let fail = 0;
    for (const doc of snap.docs) {
        const data = doc.data();
        const url = productImageUrl(data);
        if (!url) {
            skip += 1;
            continue;
        }
        try {
            const { embedding, perceptualHashHex } = await (0, clipService_1.embedImageFromUrlWithPHash)(url);
            const meta = (0, visualIndexMetadata_1.visualMetadataFromProduct)(doc.id, data, {
                perceptualHashHex,
            });
            await db.collection(visualSearchCore_1.EMBEDDINGS_COLLECTION).doc(doc.id).set({
                productId: doc.id,
                embedding,
                perceptualHashHex,
                dims: clipService_1.CLIP_DIMS,
                modelId: clipService_1.CLIP_MODEL_ID,
                sourceImageUrl: url,
                price: meta.price,
                catalogScope: meta.catalogScope,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            if ((0, pineconeVisualService_1.isPineconeConfigured)()) {
                await (0, pineconeVisualService_1.upsertProductVector)(doc.id, embedding, meta);
            }
            ok += 1;
            if (ok % 25 === 0) {
                console.log(`[backfill] ${ok} indexés…`);
            }
        }
        catch (e) {
            fail += 1;
            console.warn(`[backfill] échec ${doc.id}`, e?.message || e);
        }
    }
    console.log("[backfill] terminé", { ok, skip, fail });
}
exports.runBackfillEmbeddings = main;
const isMain = typeof require !== "undefined" && require.main === module;
if (isMain) {
    main()
        .then(() => process.exit(0))
        .catch((e) => {
        console.error(e);
        process.exit(1);
    });
}
//# sourceMappingURL=backfillEmbeddings.js.map