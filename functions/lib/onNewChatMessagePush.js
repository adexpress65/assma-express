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
function extractPossibleOwnerUids(data) {
    if (!data)
        return [];
    const candidates = [
        data.uid,
        data.ownerId,
        data.sellerUid,
        data.userId,
        data.createdBy,
    ];
    const out = new Set();
    for (const c of candidates) {
        if (typeof c !== "string")
            continue;
        const clean = c.trim();
        if (clean)
            out.add(clean);
    }
    return [...out];
}
exports.onNewChatMessagePush = (0, firestore_1.onDocumentCreated)({
    document: "conversations/{conversationId}/messages/{messageId}",
}, async (event) => {
    const snap = event.data;
    if (!snap?.exists)
        return;
    const msg = snap.data() || {};
    const conversationId = event.params.conversationId;
    const senderId = msg.senderId;
    console.log(`[Push Chat] Nouveau message ID: ${event.params.messageId} dans conv: ${conversationId} par senderId: ${senderId}`);
    if (!senderId)
        return;
    const convSnap = await admin
        .firestore()
        .collection("conversations")
        .doc(conversationId)
        .get();
    if (!convSnap.exists) {
        console.log(`[Push Chat] Conversation ${conversationId} introuvable.`);
        return;
    }
    const conv = convSnap.data() || {};
    const participants = conv.participants || [];
    const muted = conv.muted ||
        conv.mute ||
        {};
    console.log(`[Push Chat] Participants bruts :`, participants);
    console.log(`[Push Chat] Map muted :`, muted);
    const recipientSet = new Set();
    for (const p of participants) {
        if (p && p !== senderId) {
            if (muted[p]) {
                console.log(`[Push Chat] Participant ${p} ignoré car muté.`);
            }
            else {
                recipientSet.add(p);
            }
        }
    }
    const possibleClientUids = [
        conv.createdBy,
        conv.userId,
        conv.customerId,
        conv.clientId,
    ];
    for (const cUid of possibleClientUids) {
        if (typeof cUid === "string" && cUid.trim() && cUid !== senderId) {
            const cleanUid = cUid.trim();
            if (muted[cleanUid]) {
                console.log(`[Push Chat] Client secours ${cleanUid} ignoré car muté.`);
            }
            else {
                recipientSet.add(cleanUid);
            }
        }
    }
    const db = admin.firestore();
    const currentRecipients = [...recipientSet];
    for (const candidate of currentRecipients) {
        const userSnap = await db.collection("users").doc(candidate).get();
        if (userSnap.exists)
            continue;
        const companySnap = await db.collection("companies").doc(candidate).get();
        if (companySnap.exists) {
            const owners = extractPossibleOwnerUids(companySnap.data());
            for (const ownerUid of owners) {
                if (ownerUid !== senderId && !muted[ownerUid])
                    recipientSet.add(ownerUid);
            }
        }
    }
    const companyId = typeof conv.companyId === "string" && conv.companyId ? conv.companyId : null;
    if (companyId) {
        const companySnap = await db.collection("companies").doc(companyId).get();
        if (companySnap.exists) {
            const owners = extractPossibleOwnerUids(companySnap.data());
            for (const ownerUid of owners) {
                if (ownerUid !== senderId && !muted[ownerUid])
                    recipientSet.add(ownerUid);
            }
        }
        const members = await db
            .collection("users")
            .where("companyId", "==", companyId)
            .get();
        members.forEach((memberDoc) => {
            const uid = memberDoc.id;
            if (uid && uid !== senderId && !muted[uid]) {
                recipientSet.add(uid);
            }
        });
    }
    const recipients = [...recipientSet];
    console.log(`[Push Chat] Destinataires finaux calculés (recipients) :`, recipients);
    if (recipients.length === 0) {
        console.log(`[Push Chat] Aucun destinataire trouvé, abandon de l'envoi.`);
        return;
    }
    const title = String(conv.companyName || conv.title || "Nouveau message");
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
    const report = await sendPushToUserIds(recipients, title, body, {
        type: "new_message",
        conversationId,
        senderId,
    });
    if (report.accepted > 0) {
        console.log(`[Push Chat] ${report.accepted}/${report.requested} notification(s) acceptée(s) par Expo pour :`, recipients);
    }
    if (report.failed > 0) {
        console.error(`[Push Chat] ${report.failed}/${report.requested} envoi(s) en échec — codes :`, [...new Set(report.errorCodes)]);
    }
    if (report.requested === 0) {
        console.warn(`[Push Chat] Aucun jeton push pour les destinataires :`, recipients);
    }
});
//# sourceMappingURL=onNewChatMessagePush.js.map