import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

function extractPossibleOwnerUids(data: Record<string, unknown> | undefined): string[] {
  if (!data) return [];
  const candidates: unknown[] = [
    data.uid,
    data.ownerId,
    data.sellerUid,
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
 * Envoie une vraie notification push Expo aux autres participants quand un message
 * est créé dans conversations/{id}/messages (le client ne peut pas notifier l’autre appareil).
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
    if (!senderId) return;

    const convSnap = await admin
      .firestore()
      .collection("conversations")
      .doc(conversationId)
      .get();
    if (!convSnap.exists) return;

    const conv = convSnap.data() || {};
    const participants = (conv.participants as string[] | undefined) || [];
    const mute = (conv.mute as Record<string, boolean> | undefined) || {};
    const title = String(conv.title || "Nouveau message");

    const initialRecipients = participants.filter(
      (uid) => uid && uid !== senderId && !mute[uid],
    );
    const recipientSet = new Set<string>(initialRecipients);

    // Sécurité marketplace: certains anciens fils peuvent contenir companyId dans participants.
    // On tente de résoudre vers l'UID propriétaire de la boutique.
    const db = admin.firestore();
    for (const candidate of initialRecipients) {
      const userSnap = await db.collection("users").doc(candidate).get();
      if (userSnap.exists) continue;
      const companySnap = await db.collection("companies").doc(candidate).get();
      if (companySnap.exists) {
        const owners = extractPossibleOwnerUids(
          companySnap.data() as Record<string, unknown>,
        );
        for (const ownerUid of owners) {
          if (ownerUid !== senderId) recipientSet.add(ownerUid);
        }
      }
    }
    // Renfort: si la conversation porte un companyId explicite, notifier son owner uid.
    const companyId =
      typeof conv.companyId === "string" && conv.companyId ? conv.companyId : null;
    if (companyId) {
      const companySnap = await db.collection("companies").doc(companyId).get();
      if (companySnap.exists) {
        const owners = extractPossibleOwnerUids(
          companySnap.data() as Record<string, unknown>,
        );
        for (const ownerUid of owners) {
          if (ownerUid !== senderId) recipientSet.add(ownerUid);
        }
      }
      // Notifier aussi les comptes utilisateurs liés à cette boutique.
      const members = await db
        .collection("users")
        .where("companyId", "==", companyId)
        .get();
      members.forEach((memberDoc) => {
        const uid = memberDoc.id;
        if (uid && uid !== senderId) {
          recipientSet.add(uid);
        }
      });
    }
    const recipients = [...recipientSet];
    if (recipients.length === 0) return;

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
    await sendPushToUserIds(recipients, title, body, {
      type: "new_message",
      conversationId,
      senderId,
    });
  },
);
