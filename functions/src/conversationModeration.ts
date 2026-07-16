import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const BATCH = 400;

async function deleteQueryDocsInChunks(
  docs: admin.firestore.QueryDocumentSnapshot[],
): Promise<void> {
  const db = admin.firestore();
  for (let i = 0; i < docs.length; i += BATCH) {
    const b = db.batch();
    docs.slice(i, i + BATCH).forEach((d) => b.delete(d.ref));
    await b.commit();
  }
}

/**
 * Nettoyage / suppression de conversations côté serveur (contourne les règles client
 * qui bloquent souvent delete sur les sous-collections messages).
 */
export const conversationModeration = onCall(
  {
    region: "europe-west1",
    cors: true,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Connexion requise");
    }
    const uid = request.auth.uid;
    const conversationId = String(request.data?.conversationId || "").trim();
    const action = request.data?.action as string;
    if (!conversationId || !action) {
      throw new HttpsError("invalid-argument", "conversationId et action requis");
    }

    const db = admin.firestore();
    const cref = db.collection("conversations").doc(conversationId);
    const csnap = await cref.get();
    if (!csnap.exists) {
      throw new HttpsError("not-found", "Conversation introuvable");
    }
    const data = csnap.data()!;
    const participants = (data.participants || []) as string[];
    if (!participants.includes(uid)) {
      throw new HttpsError("permission-denied", "Vous n’êtes pas dans cette conversation");
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
      const admins = (data.admins || []) as string[];
      const isAdmin = admins.includes(uid);
      if (!isPair && !isCreator && !isAdmin) {
        throw new HttpsError(
          "permission-denied",
          "Seuls les deux participants ou le créateur peuvent supprimer ce fil",
        );
      }
      await deleteQueryDocsInChunks(msgsSnap.docs);
      await deleteQueryDocsInChunks(typingSnap.docs);
      await cref.delete();
      return { ok: true, deleted: true };
    }

    throw new HttpsError("invalid-argument", "action inconnue");
  },
);
