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
  return uniqueExpoPushTokens([...directCandidates, ...fromArray]);
}

/** Clé partagée Cloud Functions + ngenius-backend (`notification_dedup`). */
export function newProductIdempotencyKey(productId: string): string {
  return `new_product:${String(productId || "").trim()}`;
}

export function featuredProductIdempotencyKey(productId: string): string {
  return `featured_product:${String(productId || "").trim()}`;
}

/**
 * Verrou atomique Firestore : le premier appel gagne, les retries / autres
 * déclencheurs voient `already-exists` et n’envoient pas.
 */
export async function claimNotificationOnce(
  idempotencyKey: string,
  source = "cloud-functions",
): Promise<boolean> {
  const key = String(idempotencyKey || "").trim();
  if (!key) return false;
  const ref = admin.firestore().collection("notification_dedup").doc(key);
  try {
    await ref.create({
      key,
      source,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err && "code" in err
        ? (err as { code: unknown }).code
        : undefined;
    if (code === 6 || code === "already-exists") return false;
    throw err;
  }
}

/** Déduplique les jetons Expo (plusieurs comptes / champs sur le même device). */
export function uniqueExpoPushTokens(rawTokens: unknown[]): string[] {
  const out = new Set<string>();
  for (const candidate of rawTokens) {
    if (typeof candidate !== "string") continue;
    const token = candidate.trim();
    if (!token) continue;
    if (!Expo.isExpoPushToken(token)) continue;
    out.add(token);
  }
  return [...out];
}

/** Bilan réel d'un envoi : un ticket accepté par Expo n'est pas garanti livré, mais un ticket en erreur est un échec certain. */
export interface PushDeliveryReport {
  requested: number;
  accepted: number;
  failed: number;
  /** Codes Expo rencontrés (InvalidCredentials, DeviceNotRegistered, ...). */
  errorCodes: string[];
}

export async function sendExpoPushMessages(
  messages: ExpoPushMessage[],
): Promise<PushDeliveryReport> {
  const valid = messages.filter((m) => Expo.isExpoPushToken(String(m.to)));
  const report: PushDeliveryReport = {
    requested: messages.length,
    accepted: 0,
    failed: messages.length - valid.length,
    errorCodes: [],
  };
  if (valid.length === 0) return report;

  const chunks = expo.chunkPushNotifications(valid);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === "error") {
          report.failed += 1;
          report.errorCodes.push(String(ticket.details?.error || "unknown"));
          console.error("[push] ticket error", ticket.message, ticket.details, chunk[i]?.to);
        } else {
          report.accepted += 1;
        }
      });
    } catch (e) {
      report.failed += chunk.length;
      report.errorCodes.push("batch_error");
      console.error("[push] batch error", e);
    }
  }
  return report;
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
  const seenTokens = new Set<string>();

  usersSnapshot.forEach((docSnap) => {
    const tokens = extractExpoTokens(
      (docSnap.data() || {}) as Record<string, unknown>,
    );
    for (const token of tokens) {
      if (seenTokens.has(token)) continue;
      seenTokens.add(token);
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

  const report = await sendExpoPushMessages(messages);
  return { success: report.accepted > 0, count: report.accepted };
}

/**
 * Push ciblée vers une liste d’UID Firebase (nouveaux messages, alertes compte, etc.).
 */
export async function sendPushToUserIds(
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<PushDeliveryReport> {
  const empty: PushDeliveryReport = {
    requested: 0,
    accepted: 0,
    failed: 0,
    errorCodes: [],
  };
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return empty;

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
  const seenTokens = new Set<string>();
  const withoutToken: string[] = [];
  for (const snap of snaps) {
    const tokens = extractExpoTokens(
      (snap.data() || {}) as Record<string, unknown>,
    );
    if (tokens.length === 0) {
      withoutToken.push(snap.id);
      continue;
    }
    for (const token of tokens) {
      if (seenTokens.has(token)) continue;
      seenTokens.add(token);
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

  // Distingue « le destinataire n'a jamais enregistré de jeton » d'un échec de livraison.
  if (withoutToken.length > 0) {
    console.warn("[push] destinataires sans jeton Expo valide :", withoutToken);
  }

  return sendExpoPushMessages(messages);
}
