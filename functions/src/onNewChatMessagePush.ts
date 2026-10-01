import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

function extractPossibleOwnerUids(data: Record<string, unknown> | undefined): string[] {
  if (!data) return [];
  const candidates: unknown[] = [
    data.ownerUid,
    data.ownerId,
    data.sellerUid,
    data.uid,
    data.userId,
    data.createdBy,
  ];
  const out = new Set<string>();
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const clean = c.trim();
    if (clean) out.add(clean);
  }
  return [...out];
}

/**
 * Envoie une notification push Expo aux participants (client ou boutiquier) quand un message est créé.
 */
export const onNewChatMessagePush = onDocumentCreated(
  {
    document: "conversations/{conversationId}/messages/{messageId}",
  },
  async (event) => {
    const snap = event.data;
    if (!snap?.exists) return;

    const msg = snap.data() || {};
    const conversationId = event.params.conversationId as string;
    const senderId = msg.senderId as string | undefined;
    
    console.log(`[Push Chat] Nouveau message ID: ${event.params.messageId} dans conv: ${conversationId} par senderId: ${senderId}`);
    
    if (!senderId) return;

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
    const kind = String(conv.conversationKind || conv.type || "");
    const participants = (conv.participants as string[] | undefined) || [];
    const sellerUid = typeof conv.sellerUid === "string" ? conv.sellerUid.trim() : "";
    const clientUid = typeof conv.clientUid === "string" ? conv.clientUid.trim() : "";
    // L'app écrit `muted.{uid}` ; `mute` n'est conservé que pour d'anciens documents.
    const muted =
      (conv.muted as Record<string, boolean> | undefined) ||
      (conv.mute as Record<string, boolean> | undefined) ||
      {};

    console.log(`[Push Chat] Kind=${kind} Participants bruts :`, participants);

    const recipientSet = new Set<string>();
    const allowList = new Set(
      [
        ...participants,
        sellerUid,
        clientUid,
      ].filter((id) => typeof id === "string" && id.trim()),
    );

    for (const p of allowList) {
      if (p && p !== senderId) {
        if (muted[p]) {
          console.log(`[Push Chat] Participant ${p} ignoré car muté.`);
        } else {
          recipientSet.add(p);
        }
      }
    }

    // Anciens fils : si un participant est un companyId, résoudre le owner (jamais le sender).
    const db = admin.firestore();
    const currentRecipients = [...recipientSet];
    for (const candidate of currentRecipients) {
      const userSnap = await db.collection("users").doc(candidate).get();
      if (userSnap.exists) continue;
      const companySnap = await db.collection("companies").doc(candidate).get();
      if (!companySnap.exists) continue;
      const owners = extractPossibleOwnerUids(
        companySnap.data() as Record<string, unknown>,
      );
      recipientSet.delete(candidate);
      for (const ownerUid of owners) {
        if (ownerUid !== senderId && !muted[ownerUid]) recipientSet.add(ownerUid);
      }
    }

    const recipients = [...recipientSet];
    console.log(`[Push Chat] Destinataires finaux calculés (recipients) :`, recipients);

    if (recipients.length === 0) {
      console.log(`[Push Chat] Aucun destinataire trouvé, abandon de l'envoi.`);
      return;
    }

    // Mise en forme du titre et du message
    const title = String(conv.companyName || conv.title || "Nouveau message");
    const senderName = String(msg.senderName || "Quelqu’un");
    let preview = "";
    const t = msg.type as string | undefined;

    if (t === "image") {
      preview = String(msg.text || "").trim() || "📷 Image";
    } else if (t === "file") {
      preview = String(msg.fileName || "📎 Fichier");
    } else if (t === "product_payment") {
      const productName = String(msg.product?.name || "Produit");
      preview = `🛍️ ${productName}`;
    } else {
      preview = String(msg.text || "").trim() || "Nouveau message";
    }

    if (preview.length > 100) {
      preview = `${preview.slice(0, 100)}…`;
    }

    const body = `${senderName}: ${preview}`;

    const { sendPushToUserIds } = await import("./notifications");
    const report = await sendPushToUserIds(recipients, title, body, {
      type: "new_message",
      conversationId,
      senderId,
    });

    if (report.accepted > 0) {
      console.log(
        `[Push Chat] ${report.accepted}/${report.requested} notification(s) acceptée(s) par Expo pour :`,
        recipients,
      );
    }
    if (report.failed > 0) {
      console.error(
        `[Push Chat] ${report.failed}/${report.requested} envoi(s) en échec — codes :`,
        [...new Set(report.errorCodes)],
      );
    }
    if (report.requested === 0) {
      console.warn(
        `[Push Chat] Aucun jeton push pour les destinataires :`,
        recipients,
      );
    }
  },
);