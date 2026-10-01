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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendProductPromoBroadcast = void 0;
const admin = __importStar(require("firebase-admin"));
const core_1 = require("firebase-functions/v2/core");
const https_1 = require("firebase-functions/v2/https");
const expo_server_sdk_1 = __importDefault(require("expo-server-sdk"));
(0, core_1.onInit)(() => {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
});
const expo = new expo_server_sdk_1.default();
function stringifyData(data) {
    const out = {};
    for (const [k, v] of Object.entries(data)) {
        if (v !== undefined && v !== null)
            out[k] = String(v);
    }
    return out;
}
async function sendExpoPushMessages(messages) {
    const valid = messages.filter((m) => expo_server_sdk_1.default.isExpoPushToken(String(m.to)));
    if (valid.length === 0)
        return;
    const chunks = expo.chunkPushNotifications(valid);
    for (const chunk of chunks) {
        try {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            tickets.forEach((ticket, i) => {
                if (ticket.status === "error") {
                    console.error("[push-promo] ticket error", ticket.message, chunk[i]?.to);
                }
            });
        }
        catch (e) {
            console.error("[push-promo] batch error", e);
        }
    }
}
async function sendProductPromoToAllUsers(title, body, productId, imageUrl) {
    const db = admin.firestore();
    const usersSnapshot = await db.collection("users").get();
    const messages = [];
    const useImage = !!imageUrl &&
        (imageUrl.startsWith("https://") || imageUrl.startsWith("http://"));
    usersSnapshot.forEach((docSnap) => {
        const token = docSnap.data().pushToken;
        if (!token || !expo_server_sdk_1.default.isExpoPushToken(token))
            return;
        const msg = {
            to: token,
            sound: "default",
            title,
            body,
            data: stringifyData({
                project: "A2Express",
                type: "product_promo",
                productId,
            }),
            priority: "high",
            channelId: "default",
        };
        if (useImage) {
            msg.mutableContent = true;
            msg.richContent = { image: imageUrl };
        }
        messages.push(msg);
    });
    if (messages.length === 0) {
        return { success: false, count: 0 };
    }
    await sendExpoPushMessages(messages);
    return { success: true, count: messages.length };
}
function normalizeTokenRole(raw) {
    const value = String(raw ?? "")
        .trim()
        .toLowerCase();
    if (value === "super-admin" ||
        value === "super_admin" ||
        value === "superadmin" ||
        value === "super admin") {
        return "super-admin";
    }
    return value;
}
async function assertSuperAdmin(request) {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Connexion requise");
    }
    const fromClaim = normalizeTokenRole(request.auth.token?.role);
    if (fromClaim === "super-admin") {
        return;
    }
    console.warn("[auth-role] custom claim absent, fallback Firestore", {
        uid: request.auth.uid,
        tokenRole: request.auth.token?.role ?? null,
    });
    const db = admin.firestore();
    const adminSnap = await db.collection("users").doc(request.auth.uid).get();
    const fromFs = normalizeTokenRole(adminSnap.data()?.role);
    if (fromFs !== "super-admin") {
        throw new https_1.HttpsError("permission-denied", "Action réservée aux super-administrateurs");
    }
}
exports.sendProductPromoBroadcast = (0, https_1.onCall)({
    region: "europe-west1",
    cors: true,
    timeoutSeconds: 540,
    memory: "512MiB",
}, async (request) => {
    await assertSuperAdmin(request);
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
    const result = await sendProductPromoToAllUsers(title, body, productId, imageUrl);
    if (!result.success || result.count === 0) {
        return {
            ok: false,
            sent: 0,
            message: "Aucun token push valide trouvé (utilisateurs sans app / sans permission).",
        };
    }
    return { ok: true, sent: result.count };
});
//# sourceMappingURL=index.js.map