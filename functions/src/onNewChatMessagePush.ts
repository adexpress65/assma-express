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
    const participants = (conv.participants as string[] | undefined) || [];
    // L'app écrit `muted.{uid}` ; `mute` n'est conservé que pour d'anciens documents.
    const muted =
      (conv.muted as Record<string, boolean> | undefined) ||
      (conv.mute as Record<string, boolean> | undefined) ||
      {};

    console.log(`[Push Chat] Participants bruts :`, participants);
    console.log(`[Push Chat] Map muted :`, muted);

    const recipientSet = new Set<string>();

    // 1. Ajouter les participants directs (hors expéditeur)
    for (const p of participants) {
      if (p && p !== senderId) {
        if (muted[p]) {
          console.log(`[Push Chat] Participant ${p} ignoré car muté.`);
        } else {
          recipientSet.add(p);
        }
      }
    }

    // 2. SECOURS CLIENT : Si l'UID du client est dans createdBy / userId / customerId
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
        } else {
          recipientSet.add(cleanUid);
        }
      }
    }

    // 3. SECOURS BOUTIQUE : Si un destinataire est un ID de boutique, résoudre vers l'UID du propriétaire
    const db = admin.firestore();
    const currentRecipients = [...recipientSet];
    for (const candidate of currentRecipients) {
      const userSnap = await db.collection("users").doc(candidate).get();
      if (userSnap.exists) continue; // C'est déjà un UID utilisateur valide

      const companySnap = await db.collection("companies").doc(candidate).get();
      if (companySnap.exists) {
        const owners = extractPossibleOwnerUids(
          companySnap.data() as Record<string, unknown>,
        );
        for (const ownerUid of owners) {
          if (ownerUid !== senderId && !muted[ownerUid]) recipientSet.add(ownerUid);
        }
      }
    }

    // Renfort Boutique si conv.companyId existe
    const companyId =
      typeof conv.companyId === "string" && conv.companyId ? conv.companyId : null;
    if (companyId) {
      const companySnap = await db.collection("companies").doc(companyId).get();
      if (companySnap.exists) {
        const owners = extractPossibleOwnerUids(
          companySnap.data() as Record<string, unknown>,
        );
        for (const ownerUid of owners) {
          if (ownerUid !== senderId && !muted[ownerUid]) recipientSet.add(ownerUid);
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