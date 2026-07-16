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
exports.sendProductPromoBroadcast = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const notifications_1 = require("./notifications");
exports.sendProductPromoBroadcast = (0, https_1.onCall)({
    region: "europe-west1",
    cors: true,
    timeoutSeconds: 540,
    memory: "512MiB",
}, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Connexion requise");
    }
    const db = admin.firestore();
    const adminSnap = await db.collection("users").doc(request.auth.uid).get();
    const role = String(adminSnap.data()?.role || "").trim();
    if (role !== "super-admin") {
        throw new https_1.HttpsError("permission-denied", "Action réservée aux super-administrateurs");
    }
    const title = String(request.data?.title || "").trim();
    const body = String(request.data?.body || "").trim();
    const productId = String(request.data?.productId || "").trim();
    const imageUrlRaw = request.data?.imageUrl;
    const imageUrl = typeof imageUrlRaw === "string" && /^https?:\/\//i.test(imageUrlRaw.trim())
        ? imageUrlRaw.trim()
        : undefined;
    if (!title || title.length > 100) {
        throw new https_1.HttpsError("invalid-argument", "Titre requis (100 caractères max).");
    }
    if (!body || body.length > 240) {
        throw new https_1.HttpsError("invalid-argument", "Texte requis (240 caractères max).");
    }
    if (!productId || productId.length > 200) {
        throw new https_1.HttpsError("invalid-argument", "Identifiant produit requis.");
    }
    const result = await (0, notifications_1.sendProductPromoToAllUsers)(title, body, productId, imageUrl);
    if (!result.success || result.count === 0) {
        return {
            ok: false,
            sent: 0,
            message: "Aucun token push valide trouvé (utilisateurs sans app / sans permission).",
        };
    }
    return { ok: true, sent: result.count };
});
//# sourceMappingURL=sendProductPromoBroadcast.js.map