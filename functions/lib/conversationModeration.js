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
exports.conversationModeration = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const BATCH = 400;
async function deleteQueryDocsInChunks(docs) {
    const db = admin.firestore();
    for (let i = 0; i < docs.length; i += BATCH) {
        const b = db.batch();
        docs.slice(i, i + BATCH).forEach((d) => b.delete(d.ref));
        await b.commit();
    }
}
exports.conversationModeration = (0, https_1.onCall)({
    region: "europe-west1",
    cors: true,
}, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Connexion requise");
    }
    const uid = request.auth.uid;
    const conversationId = String(request.data?.conversationId || "").trim();
    const action = request.data?.action;
    if (!conversationId || !action) {
        throw new https_1.HttpsError("invalid-argument", "conversationId et action requis");
    }
    const db = admin.firestore();
    const cref = db.collection("conversations").doc(conversationId);
    const csnap = await cref.get();
    if (!csnap.exists) {
        throw new https_1.HttpsError("not-found", "Conversation introuvable");
    }
    const data = csnap.data();
    const participants = (data.participants || []);
    if (!participants.includes(uid)) {
        throw new https_1.HttpsError("permission-denied", "Vous n’êtes pas dans cette conversation");
    }
    const msgsSnap = await cref.collection("messages").get();
    const typingSnap = await cref.collection("typing").get();
    if (action === "clearMessages") {
        await deleteQueryDocsInChunks(msgsSnap.docs);
        await cref.update({
            lastMessage: "",
            lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            messageCount: 0,
        });
        return { ok: true, cleared: msgsSnap.size };
    }
    if (action === "deleteThread") {
        const isPair = participants.length === 2;
        const isCreator = data.createdBy === uid;
        const admins = (data.admins || []);
        const isAdmin = admins.includes(uid);
        if (!isPair && !isCreator && !isAdmin) {
            throw new https_1.HttpsError("permission-denied", "Seuls les deux participants ou le créateur peuvent supprimer ce fil");
        }
        await deleteQueryDocsInChunks(msgsSnap.docs);
        await deleteQueryDocsInChunks(typingSnap.docs);
        await cref.delete();
        return { ok: true, deleted: true };
    }
    throw new https_1.HttpsError("invalid-argument", "action inconnue");
});
//# sourceMappingURL=conversationModeration.js.map