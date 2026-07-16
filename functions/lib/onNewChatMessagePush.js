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
exports.onNewChatMessagePush = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
exports.onNewChatMessagePush = (0, firestore_1.onDocumentCreated)({
    document: "conversations/{conversationId}/messages/{messageId}",
}, async (event) => {
    const snap = event.data;
    if (!snap?.exists)
        return;
    const msg = snap.data() || {};
    const conversationId = event.params.conversationId;
    const senderId = msg.senderId;
    if (!senderId)
        return;
    const convSnap = await admin
        .firestore()
        .collection("conversations")
        .doc(conversationId)
        .get();
    if (!convSnap.exists)
        return;
    const conv = convSnap.data() || {};
    const participants = conv.participants || [];
    const mute = conv.mute || {};
    const title = String(conv.title || "Nouveau message");
    const initialRecipients = participants.filter((uid) => uid && uid !== senderId && !mute[uid]);
    const recipientSet = new Set(initialRecipients);
    const db = admin.firestore();
    for (const candidate of initialRecipients) {
        const userSnap = await db.collection("users").doc(candidate).get();
        if (userSnap.exists)
            continue;
        const companySnap = await db.collection("companies").doc(candidate).get();
        if (companySnap.exists) {
            const ownerUid = companySnap.data()?.uid;
            if (typeof ownerUid === "string" && ownerUid && ownerUid !== senderId) {
                recipientSet.add(ownerUid);
            }
        }
    }
    const companyId = typeof conv.companyId === "string" && conv.companyId ? conv.companyId : null;
    if (companyId) {
        const companySnap = await db.collection("companies").doc(companyId).get();
        if (companySnap.exists) {
            const ownerUid = companySnap.data()?.uid;
            if (typeof ownerUid === "string" && ownerUid && ownerUid !== senderId) {
                recipientSet.add(ownerUid);
            }
        }
    }
    const recipients = [...recipientSet];
    if (recipients.length === 0)
        return;
    const senderName = String(msg.senderName || "Quelqu’un");
    let preview = "";
    const t = msg.type;
    if (t === "image") {
        preview = String(msg.text || "").trim() || "📷 Image";
    }
    else if (t === "file") {
        preview = String(msg.fileName || "📎 Fichier");
    }
    else if (t === "product_payment") {
        const productName = String(msg.product?.name || "Produit");
        preview = `🛍️ ${productName}`;
    }
    else {
        preview = String(msg.text || "").trim() || "Nouveau message";
    }
    if (preview.length > 100) {
        preview = `${preview.slice(0, 100)}…`;
    }
    const body = `${senderName}: ${preview}`;
    const { sendPushToUserIds } = await Promise.resolve().then(() => __importStar(require("./notifications")));
    await sendPushToUserIds(recipients, title, body, {
        type: "new_message",
        conversationId,
        senderId,
    });
});
//# sourceMappingURL=onNewChatMessagePush.js.map