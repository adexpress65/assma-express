import * as admin from "firebase-admin";
import type { DocumentSnapshot } from "firebase-admin/firestore";
import Expo, { ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

/** Données Expo : valeurs string uniquement. */
function stringifyData(data: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

function extractExpoTokens(data: Record<string, unknown> | undefined): string[] {
  if (!data) return [];
  const directCandidates: unknown[] = [
    data.pushToken,
    data.expoPushToken,
    data.notificationToken,
    data.fcmToken,
  ];
  const fromArray = Array.isArray(data.pushTokens) ? data.pushTokens : [];
  const out = new Set<string>();
  for (const candidate of [...directCandidates, ...fromArray]) {
    if (typeof candidate !== "string") continue;
    const token = candidate.trim();
    if (!token) continue;
    if (!Expo.isExpoPushToken(token)) continue;
    out.add(token);
  }
  return [...out];
}

export async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<void> {
  const valid = messages.filter((m) => Expo.isExpoPushToken(String(m.to)));
  if (valid.length === 0) return;

  const chunks = expo.chunkPushNotifications(valid);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === "error") {
          console.error("[push] ticket error", ticket.message, ticket.details, chunk[i]?.to);
        }
      });
    } catch (e) {
      console.error("[push] batch error", e);
    }
  }
}

/**
 * Broadcast à tous les utilisateurs ayant un token Expo valide (produits mis en avant, annonces, etc.).
 */
export async function sendGlobalPushNotification(
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<{ success: boolean; count: number }> {
  const db = admin.firestore();
  const usersSnapshot = await db.collection("users").get();
  const messages: ExpoPushMessage[] = [];

  usersSnapshot.forEach((docSnap) => {
    const token = docSnap.data().pushToken as string | undefined;
    if (token && Expo.isExpoPushToken(token)) {
      messages.push({
        to: token,
        sound: "default",
        title,
        body,
        data: stringifyData({ project: "A2Express", ...data }),
        priority: "high",
        channelId: "default",
      });
    }
  });

  if (messages.length === 0) {
    return { success: false, count: 0 };
  }

  await sendExpoPushMessages(messages);
  return { success: true, count: messages.length };
}

/**
 * Push ciblée vers une liste d’UID Firebase (nouveaux messages, alertes compte, etc.).
 */
export async function sendPushToUserIds(
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return;

  const db = admin.firestore();
  const refs = unique.map((uid) => db.collection("users").doc(uid));
  const snaps: DocumentSnapshot[] = [];
  const batchSize = 10;
  for (let i = 0; i < refs.length; i += batchSize) {
    const slice = refs.slice(i, i + batchSize);
    const part = await db.getAll(...slice);
    snaps.push(...part);
  }

  const messages: ExpoPushMessage[] = [];
  for (const snap of snaps) {
    const tokens = extractExpoTokens(
      (snap.data() || {}) as Record<string, unknown>,
    );
    for (const token of tokens) {
      messages.push({
        to: token,
        sound: "default",
        title,
        body,
        data: stringifyData({ project: "A2Express", ...data }),
        priority: "high",
        channelId: "default",
      });
    }
  }

  await sendExpoPushMessages(messages);
}
