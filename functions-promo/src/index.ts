/**
 * Codebase léger dédié aux promos push — évite le timeout d’analyse Firebase (10 s)
 * causé par le gros `functions/` (recherche image, Pinecone, etc.).
 */
import * as admin from "firebase-admin";
import { onInit } from "firebase-functions/v2/core";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import Expo, { type ExpoPushMessage } from "expo-server-sdk";

onInit(() => {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
});

const expo = new Expo();

function stringifyData(data: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<void> {
  const valid = messages.filter((m) => Expo.isExpoPushToken(String(m.to)));
  if (valid.length === 0) return;

  const chunks = expo.chunkPushNotifications(valid);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === "error") {
          console.error("[push-promo] ticket error", ticket.message, chunk[i]?.to);
        }
      });
    } catch (e) {
      console.error("[push-promo] batch error", e);
    }
  }
}

async function sendProductPromoToAllUsers(
  title: string,
  body: string,
  productId: string,
  imageUrl?: string,
): Promise<{ success: boolean; count: number }> {
  const db = admin.firestore();
  const usersSnapshot = await db.collection("users").get();
  const messages: ExpoPushMessage[] = [];

  const useImage =
    !!imageUrl &&
    (imageUrl.startsWith("https://") || imageUrl.startsWith("http://"));

  usersSnapshot.forEach((docSnap) => {
    const token = docSnap.data().pushToken as string | undefined;
    if (!token || !Expo.isExpoPushToken(token)) return;

    const msg: ExpoPushMessage = {
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
      msg.richContent = { image: imageUrl! };
    }

    messages.push(msg);
  });

  if (messages.length === 0) {
    return { success: false, count: 0 };
  }

  await sendExpoPushMessages(messages);
  return { success: true, count: messages.length };
}

function normalizeTokenRole(raw: unknown): string {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (
    value === "super-admin" ||
    value === "super_admin" ||
    value === "superadmin" ||
    value === "super admin"
  ) {
    return "super-admin";
  }
  return value;
}

async function assertSuperAdmin(request: {
  auth?: { uid: string; token: Record<string, unknown> };
}): Promise<void> {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Connexion requise");
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
    throw new HttpsError(
      "permission-denied",
      "Action réservée aux super-administrateurs",
    );
  }
}

export const sendProductPromoBroadcast = onCall(
  {
    region: "europe-west1",
    cors: true,
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (request) => {
    await assertSuperAdmin(request);

    const title = String(request.data?.title || "").trim();
    const body = String(request.data?.body || "").trim();
    const productId = String(request.data?.productId || "").trim();
    const imageUrlRaw = request.data?.imageUrl;
    const imageUrl =
      typeof imageUrlRaw === "string" && /^https?:\/\//i.test(imageUrlRaw.trim())
        ? imageUrlRaw.trim()
        : undefined;

    if (!title || title.length > 100) {
      throw new HttpsError(
        "invalid-argument",
        "Titre requis (100 caractères max).",
      );
    }
    if (!body || body.length > 240) {
      throw new HttpsError(
        "invalid-argument",
        "Texte requis (240 caractères max).",
      );
    }
    if (!productId || productId.length > 200) {
      throw new HttpsError("invalid-argument", "Identifiant produit requis.");
    }

    const result = await sendProductPromoToAllUsers(
      title,
      body,
      productId,
      imageUrl,
    );

    if (!result.success || result.count === 0) {
      return {
        ok: false,
        sent: 0,
        message:
          "Aucun token push valide trouvé (utilisateurs sans app / sans permission).",
      };
    }

    return { ok: true, sent: result.count };
  },
);
