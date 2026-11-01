import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";
import crypto from "crypto";
import admin from "firebase-admin";
import { Expo } from "expo-server-sdk";
import { FedaPay, Transaction } from "fedapay";

dotenv.config();

/* =========================
   🔥 FIREBASE INIT
========================= */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = admin.firestore();
const expo = new Expo();

/* =========================
   💰 CONFIGURATION PAIEMENTS
========================= */

/* --- FEDAPAY --- */
FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY);
FedaPay.setEnvironment("live");

/* =========================
   🚀 EXPRESS SETUP
========================= */
const app = express();
app.use(cors());

/* ✅ ROUTE ROOT */
app.get("/", (req, res) => {
  res.send("A2Express backend running");
});

app.use((req, res, next) => {
  const rawUrls = [
    "/webhook/fedapay",
    "/webhook/paydunya",
  ];
  if (rawUrls.includes(req.originalUrl)) {
    express.raw({ type: "application/json" })(req, res, next);
  } else {
    // 💡 Ajout du type 'application/*+json' pour capturer les webhooks NGenius
    express.json({
      type: ['application/json', 'application/*+json'],
      // Le corps brut est conservé : la signature HMAC du webhook NGenius porte
      // sur les octets reçus, pas sur le JSON réencodé.
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })(req, res, next);
  }
});

/* =========================
   🔐 HELPERS
========================= */

const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 10000);
const NG_TIMEOUT_MS = Number(process.env.NG_TIMEOUT_MS || HTTP_TIMEOUT_MS);
const NG_TOKEN_TTL_BUFFER_MS = Number(process.env.NG_TOKEN_TTL_BUFFER_MS || 60000);

const ngeniusHttp = axios.create({
  timeout: NG_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

let ngTokenCache = {
  token: null,
  expiresAt: 0,
};
let ngTokenPendingPromise = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowMs = () => Date.now();
const NGENIUS_SUCCESS_STATES = new Set(["PURCHASED", "CAPTURED", "PAID", "COMPLETED", "SUCCESS"]);
const NGENIUS_FAILURE_STATES = new Set(["FAILED", "CANCELLED", "EXPIRED", "DECLINED"]);

function normalizeDeliveryMode(raw) {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "pickup" || s === "retrait") return "pickup";
  if (s === "home" || s === "domicile" || s === "delivery") return "home";
  if (s === "unknown") return "unknown";
  return null;
}

/**
 * Ne fait jamais échouer la création : pickup/home si fourni, sinon "unknown"
 * + flags pour repérer un client non à jour (fenêtre OTA).
 */
function persistableDeliveryMode(raw, meta = {}) {
  const normalized = normalizeDeliveryMode(raw);
  if (normalized === "pickup" || normalized === "home") {
    return { deliveryMode: normalized };
  }
  console.warn("[order-create] deliveryMode absent — client non à jour", {
    requestId: meta.requestId || null,
    orderId: meta.orderId || null,
    provider: meta.provider || null,
    received: raw == null || raw === "" ? null : String(raw),
  });
  return {
    deliveryMode: "unknown",
    clientOutdated: true,
    deliveryModeInferred: true,
    deliveryModeSource: "missing_payload_outdated_client",
  };
}

function uniqueTrimmedStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * NGenius envoie souvent sa propre `reference` (UUID) en premier, alors que
 * notre document Firestore est `ORD-…` (`merchantOrderReference`).
 */
function collectNgeniusOrderRefs(payload = {}) {
  const eventOrder = payload?.eventData?.order || {};
  const order = payload?.order || {};
  const embedded = payload?._embedded?.order?.[0] || {};
  return uniqueTrimmedStrings([
    eventOrder.merchantOrderReference,
    order.merchantOrderReference,
    payload.merchantOrderReference,
    embedded.merchantOrderReference,
    payload?.eventData?.merchantOrderReference,
    eventOrder.reference,
    order.reference,
    payload.reference,
    payload.orderId,
    embedded.reference,
  ]);
}

async function resolveFirestoreOrderId(payload = {}) {
  const refs = collectNgeniusOrderRefs(payload);

  for (const id of refs) {
    if (!id.startsWith("ORD-")) continue;
    const snap = await db.collection("orders").doc(id).get();
    if (snap.exists) return id;
  }

  for (const id of refs) {
    const snap = await db.collection("orders").doc(id).get();
    if (snap.exists) return id;
  }

  for (const ref of refs) {
    const byNg = await db
      .collection("orders")
      .where("ngeniusOrderReference", "==", ref)
      .limit(1)
      .get();
    if (!byNg.empty) return byNg.docs[0].id;

    const byOrderId = await db
      .collection("orders")
      .where("orderId", "==", ref)
      .limit(1)
      .get();
    if (!byOrderId.empty) return byOrderId.docs[0].id;
  }

  return refs[0] || null;
}

function extractNgeniusEventName(payload = {}) {
  return String(
    payload?.eventName ||
      payload?.event ||
      payload?.type ||
      payload?.eventData?.eventName ||
      payload?.eventData?.name ||
      "",
  )
    .toUpperCase()
    .trim();
}

const NGENIUS_SUCCESS_EVENTS = [
  "PURCHASED",
  "CAPTURED",
  "SALE_CAPTURED",
  "AUTHORISED",
  "AUTHORIZED",
  "PAID",
  "SUCCESS",
];
const NGENIUS_FAILURE_EVENTS = [
  "FAILED",
  "CANCELLED",
  "CANCELED",
  "DECLINED",
  "EXPIRED",
  "REJECTED",
];

function eventNameMatches(eventName, tokens) {
  if (!eventName) return false;
  return tokens.some((token) => eventName.includes(token));
}

function extractNgeniusPaymentState(payload = {}) {
  return (
    payload?.payment?.state ||
    payload?.state ||
    payload?._embedded?.payment?.[0]?.state ||
    payload?._embedded?.payments?.[0]?.state ||
    null
  );
}

function isNgeniusPaymentSuccessful(state) {
  return typeof state === "string" && NGENIUS_SUCCESS_STATES.has(state.trim().toUpperCase());
}

function isNgeniusPaymentFailure(state) {
  return typeof state === "string" && NGENIUS_FAILURE_STATES.has(state.trim().toUpperCase());
}

/* --- Signature HMAC des webhooks NGenius --- */

/** En-têtes possibles selon la configuration de l'outlet NGenius. */
const NG_WEBHOOK_SIGNATURE_HEADERS = [
  "x-ni-signature",
  "x-ngenius-signature",
  "x-webhook-signature",
  "x-signature",
  "x-hub-signature-256",
  "signature",
];

function getWebhookSignatureHeaders() {
  const configured = String(process.env.NG_WEBHOOK_SIGNATURE_HEADER || "")
    .toLowerCase()
    .trim();
  if (!configured) return NG_WEBHOOK_SIGNATURE_HEADERS;
  return [configured, ...NG_WEBHOOK_SIGNATURE_HEADERS.filter((h) => h !== configured)];
}

function extractWebhookSignature(req) {
  for (const header of getWebhookSignatureHeaders()) {
    const value = req.headers[header];
    if (typeof value === "string" && value.trim()) {
      return { header, value: value.trim() };
    }
  }
  return null;
}

/** Retire un éventuel préfixe d'algorithme (`sha256=`, `hmac-sha256:`, ...). */
function stripSignatureScheme(signature) {
  const match = /^(?:sha-?256|hmac-?sha-?256)[=\s:]+(.*)$/i.exec(signature);
  return match ? match[1].trim() : signature;
}

function timingSafeEqualString(expected, received) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Compare la signature reçue au HMAC SHA256 du corps brut.
 * NGenius peut transmettre le digest en hexadécimal ou en base64 : les deux
 * encodages sont testés, toujours en comparaison à temps constant.
 */
function isValidNgeniusWebhookSignature(rawBody, receivedSignature, secret) {
  if (!rawBody || !rawBody.length || !receivedSignature || !secret) return false;

  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest();
  const candidate = stripSignatureScheme(receivedSignature);

  return (
    timingSafeEqualString(digest.toString("hex"), candidate.toLowerCase()) ||
    timingSafeEqualString(digest.toString("base64"), candidate)
  );
}

/**
 * NGenius identifie ses commandes par une référence propre (différente de notre orderId).
 * On la conserve à la création pour pouvoir réinterroger l'état réel du paiement.
 */
function extractNgeniusOrderReference(orderResponseData = {}) {
  const direct = orderResponseData?.reference;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const urn = orderResponseData?._id;
  if (typeof urn === "string" && urn.includes(":")) {
    const tail = urn.split(":").pop();
    if (tail && tail.trim()) return tail.trim();
  }

  return null;
}

/**
 * Types de média acceptés par la passerelle, du plus spécifique au plus générique.
 * `ngeniusHttp` impose `application/json` par défaut : sans surcharge explicite,
 * la passerelle répond 415 Unsupported Media Type sur cette lecture d'ordre.
 */
const NG_ORDER_MEDIA_TYPES = [
  "application/vnd.ni-payment.v2+json",
  "application/json",
];

async function fetchNgeniusOrder(orderReference, requestId) {
  const token = await getAccessToken({ requestId });
  const url = `${process.env.NG_GATEWAY_URL}/transactions/outlets/${process.env.NG_OUTLET}/orders/${encodeURIComponent(orderReference)}`;

  let lastError = null;

  for (const mediaType of NG_ORDER_MEDIA_TYPES) {
    try {
      const response = await ngeniusHttp.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: mediaType,
          "Content-Type": mediaType,
          Realm: "OBMali",
          "X-Request-Id": String(requestId),
        },
      });

      return response?.data || {};
    } catch (error) {
      lastError = error;
      if (error?.response?.status !== 415) throw error;

      console.error("[ngenius][get-order] 415 Unsupported Media Type", {
        requestId,
        orderReference,
        url,
        sentAccept: mediaType,
        sentContentType: mediaType,
        responseHeaders: error?.response?.headers,
        responseData: error?.response?.data,
      });
    }
  }

  throw lastError;
}

function safeUrl(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function getRequestId(req) {
  return (
    req.headers["x-request-id"] ||
    req.headers["x-correlation-id"] ||
    `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  );
}

function computeTokenExpiryMs(tokenResponseData) {
  const fallbackTtlMs = Number(process.env.NG_TOKEN_TTL_MS || 14 * 60 * 1000);
  const expiresInSec = Number(tokenResponseData?.expires_in || tokenResponseData?.expiresIn || 0);
  if (Number.isFinite(expiresInSec) && expiresInSec > 0) {
    return nowMs() + expiresInSec * 1000 - NG_TOKEN_TTL_BUFFER_MS;
  }
  return nowMs() + fallbackTtlMs;
}

async function getAccessToken({ requestId = "n/a", forceRefresh = false } = {}) {
  const stillValid = ngTokenCache.token && nowMs() < ngTokenCache.expiresAt;
  if (!forceRefresh && stillValid) {
    return ngTokenCache.token;
  }

  if (!forceRefresh && ngTokenPendingPromise) {
    return ngTokenPendingPromise;
  }

  ngTokenPendingPromise = (async () => {
    const authUrl = `${process.env.NG_GATEWAY_URL}/identity/auth/access-token`;
    const headers = {
      Authorization: `Basic ${process.env.NG_KEY}`,
      "Content-Type": "application/vnd.ni-identity.v1+json",
      Realm: "OBMali",
      "X-Request-Id": String(requestId),
    };

    const maxAttempts = 2;
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startedAt = nowMs();
      try {
        const response = await ngeniusHttp.post(authUrl, null, { headers });
        const token = response?.data?.access_token;
        if (!token) {
          throw new Error("NGenius access_token manquant");
        }
        ngTokenCache = {
          token,
          expiresAt: computeTokenExpiryMs(response.data),
        };
        console.log("[ngenius][token] success", {
          requestId,
          attempt,
          latencyMs: nowMs() - startedAt,
          timeoutMs: NG_TIMEOUT_MS,
          expiresAt: ngTokenCache.expiresAt,
        });
        return token;
      } catch (error) {
        lastError = error;
        const status = error?.response?.status;
        const retryable = !status || status >= 500 || status === 429;
        console.error("[ngenius][token] error", {
          requestId,
          attempt,
          status,
          retryable,
          latencyMs: nowMs() - startedAt,
          message: error?.message,
          data: error?.response?.data,
        });
        if (!retryable || attempt === maxAttempts) {
          break;
        }
        await wait(250 * attempt);
      }
    }
    throw lastError;
  })();

  try {
    return await ngTokenPendingPromise;
  } finally {
    ngTokenPendingPromise = null;
  }
}

async function sendOrderEmail(userId, orderId) {
  try {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    if (!apiKey || !fromEmail) return;

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data() || {};
    const toEmail = userData.email;
    if (!toEmail) return;

    const orderSnap = await db.collection("orders").doc(orderId).get();
    const orderData = orderSnap.exists ? orderSnap.data() || {} : {};

    const total = orderData.total || orderData.summary?.total || 0;
    const items = Array.isArray(orderData.items) ? orderData.items : [];
    const previewItems = items.slice(0, 3).map((it) => `- ${it.name || "Produit"} x${it.quantity || 1}`).join("\n");

    const subject = `Confirmation de votre commande ${orderId}`;
    const text =
      `Bonjour ${userData.displayName || ""}\n\n` +
      `Nous vous confirmons la réception de votre paiement pour la commande ${orderId}.\n\n` +
      `Montant total: ${total} XOF\n` +
      (previewItems ? `Articles principaux:\n${previewItems}\n\n` : "") +
      `Vous pouvez suivre l'état de votre commande directement dans l'application A2Express.\n\n` +
      `Merci pour votre confiance.\n` +
      `L'équipe A2Express`;

    await axios.post(
      "https://api.sendgrid.com/v3/mail/send",
      {
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: fromEmail, name: "A2Express" },
        subject,
        content: [{ type: "text/plain", value: text }],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Erreur email SendGrid:", error.response?.data || error.message);
  }
}

async function sendPushNotification(userId, orderId) {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return;

    const pushToken = userDoc.data().pushToken; 
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;

    const messages = [
      {
        to: pushToken,
        sound: "default",
        title: "Paiement confirmé 🎉",
        body: `Commande #${orderId.slice(0, 8)} payée avec succès.`,
        data: { orderId },
      },
    ];

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }

    await sendOrderEmail(userId, orderId);
  } catch (error) {
    console.error("Erreur notification Expo:", error);
  }
}

function newProductIdempotencyKey(productId) {
  return `new_product:${String(productId || "").trim()}`;
}

async function claimNotificationOnce(idempotencyKey, source = "ngenius-backend") {
  const key = String(idempotencyKey || "").trim();
  if (!key) return false;
  try {
    await db.collection("notification_dedup").doc(key).create({
      key,
      source,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (err) {
    if (err?.code === 6 || err?.code === "already-exists") return false;
    throw err;
  }
}

function uniqueExpoPushTokens(rawTokens) {
  const out = new Set();
  for (const candidate of rawTokens) {
    if (typeof candidate !== "string") continue;
    const token = candidate.trim();
    if (!token || !Expo.isExpoPushToken(token)) continue;
    out.add(token);
  }
  return [...out];
}

async function broadcastNotificationToAllUsers(payload) {
  const snap = await db.collection("users").where("pushToken", ">", "").get();
  const messages = [];
  const seenTokens = new Set();

  snap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const tokens = uniqueExpoPushTokens([
      data.pushToken,
      data.expoPushToken,
      data.notificationToken,
      data.fcmToken,
      ...(Array.isArray(data.pushTokens) ? data.pushTokens : []),
    ]);
    for (const token of tokens) {
      if (seenTokens.has(token)) continue;
      seenTokens.add(token);
      messages.push({
        to: token,
        sound: "default",
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
      });
    }
  });

  if (!messages.length) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }
}

async function updateStatus(orderId, status, extraFields = {}) {
  const ref = db.collection("orders").doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error("[updateStatus] commande introuvable", { orderId, status });
    return;
  }

  const oldStatus = snap.data().status;

  await ref.set({
    status,
    ...extraFields,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  if (status === "paid" && oldStatus !== "paid") {
    await sendPushNotification(snap.data().userId, orderId);
  }
}

async function resolveSellerIdsFromItems(items = []) {
  const directIds = new Set();
  const missingProductIds = new Set();

  for (const it of items || []) {
    const sid =
      (typeof it?.sellerId === "string" && it.sellerId.trim()) ||
      (typeof it?.companyId === "string" && it.companyId.trim()) ||
      (typeof it?.storeId === "string" && it.storeId.trim()) ||
      (typeof it?.merchantId === "string" && it.merchantId.trim()) ||
      null;
    if (sid) directIds.add(sid);

    const pid =
      (typeof it?.productId === "string" && it.productId.trim()) ||
      (typeof it?.id === "string" && it.id.trim()) ||
      null;
    if (!sid && pid) missingProductIds.add(pid);
  }

  if (missingProductIds.size > 0) {
    const refs = Array.from(missingProductIds).slice(0, 50).map((pid) => db.collection("products").doc(pid));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      if (!s.exists) continue;
      const d = s.data() || {};
      const sid =
        (typeof d?.sellerId === "string" && d.sellerId.trim()) ||
        (typeof d?.companyId === "string" && d.companyId.trim()) ||
        (typeof d?.storeId === "string" && d.storeId.trim()) ||
        (typeof d?.merchantId === "string" && d.merchantId.trim()) ||
        null;
      if (sid) directIds.add(sid);
    }
  }

  return Array.from(directIds);
}

/* =========================
   🔔 ROUTE DE TEST
========================= */
app.post("/test-notification", async (req, res) => {
  const { userId, title, body } = req.body;
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const pushToken = userDoc.data().pushToken;
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      return res.status(400).json({ error: "Invalid token" });
    }

    const messages = [{
      to: pushToken,
      sound: "default",
      title: title || "Test A2Express",
      body: body || "Notification de test réussie !",
    }];

    let chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   💳 CREATE NGENIUS PAYMENT
========================= */

app.post("/create-payment", async (req, res) => {
  const requestId = getRequestId(req);
  const startedAt = nowMs();
  try {

    const {
      amount,
      orderId,
      userId,
      currencyCode = "XOF",
      items,
      summary,
      shippingAddress,
      deliveryMode,
      shippingMethod,
      shippingMethodName,
      shippingMethodDelay,
      shippingEstimatedDays,
      shippingMethodType,
      shipping,
    } = req.body;

    if (!amount || !orderId || !userId)
      return res.status(400).json({ error: "Missing fields" });

    if (!process.env.NG_GATEWAY_URL || !process.env.NG_OUTLET || !process.env.NG_KEY) {
      console.error("[create-payment] missing ngenius env", { requestId });
      return res.status(500).json({ error: "Configuration NGenius incomplète." });
    }

    const requestedCurrency = String(currencyCode || "XOF").toUpperCase();
    const configuredFallback = String(process.env.NG_FALLBACK_CURRENCY || "").toUpperCase().trim();
    const ngeniusCurrency =
      requestedCurrency === "XOF" || requestedCurrency === "XAF"
        ? (configuredFallback || requestedCurrency)
        : requestedCurrency;

    const supportedCurrencies = String(process.env.NG_SUPPORTED_CURRENCIES || "")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (supportedCurrencies.length > 0 && !supportedCurrencies.includes(ngeniusCurrency)) {
      console.error("[create-payment] unsupported currency for outlet", {
        requestId,
        requestedCurrency,
        ngeniusCurrency,
        supportedCurrencies,
      });
      return res.status(400).json({
        error: `Devise ${ngeniusCurrency} non supportée par cet outlet NGenius.`,
      });
    }

    // NGenius renvoie vers `redirectUrl` pour toutes les issues, y compris les
    // refus : le nom de la page ne vaut pas résultat. Basculer NG_REDIRECT_URL sur
    // /payment/return.html une fois la page publiée (l'app accepte les deux).
    const redirectUrl = safeUrl(process.env.NG_REDIRECT_URL || "https://a2-expres.com/payment/success.html");
    const cancelUrl = safeUrl(process.env.NG_CANCEL_URL || "https://a2-expres.com/payment/cancel.html");
    if (!redirectUrl || !cancelUrl) {
      console.error("[create-payment] invalid redirect/cancel url", {
        requestId,
        redirectUrl,
        cancelUrl,
      });
      return res.status(500).json({ error: "URLs de redirection invalides pour NGenius." });
    }

    const sellerIds = await resolveSellerIdsFromItems(items || []);
    const deliveryFields = persistableDeliveryMode(deliveryMode, {
      requestId,
      orderId,
      provider: "ngenius",
    });
    await db.collection("orders").doc(orderId).set({
      orderId,
      merchantOrderReference: orderId,
      userId,
      total: amount,
      currency: ngeniusCurrency,
      provider: "ngenius",
      status: "pending",
      paymentStatus: "pending",

      items: items || [],
      summary: summary || {},
      shippingAddress: shippingAddress || null,
      ...(shippingMethod ? { shippingMethod } : {}),
      ...(shippingMethodName ? { shippingMethodName } : {}),
      ...(shippingMethodDelay
        ? { shippingMethodDelay, shippingEstimatedDays: shippingMethodDelay }
        : shippingEstimatedDays
          ? { shippingEstimatedDays, shippingMethodDelay: shippingEstimatedDays }
          : {}),
      ...(shippingMethodType ? { shippingMethodType } : {}),
      ...(shipping ? { shipping } : {}),
      ...deliveryFields,
      ...(sellerIds.length === 1 ? { sellerId: sellerIds[0] } : {}),
      ...(sellerIds.length > 0 ? { sellerIds } : {}),

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const token = await getAccessToken({ requestId });

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "Montant invalide pour NGenius." });
    }
    const ZERO_DECIMAL_CURRENCIES = ["XOF", "XAF"];
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(ngeniusCurrency.toUpperCase());

    const value = isZeroDecimal
      ? Math.round(numericAmount)
      : Math.round(numericAmount * 100);
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: "Montant invalide pour NGenius." });
    }

    const notificationUrl = "https://ngenius-backend.onrender.com/webhook/ngenius";
    const ngOrderBody = {
      action: "SALE",
      amount: { currencyCode: ngeniusCurrency, value },
      reference: orderId,
      merchantOrderReference: orderId,
      merchantAttributes: {
        redirectUrl,
        cancelUrl,
        notificationUrl,
      },
    };

    const ngCallStartedAt = nowMs();
    const response = await ngeniusHttp.post(
      `${process.env.NG_GATEWAY_URL}/transactions/outlets/${process.env.NG_OUTLET}/orders`,
      ngOrderBody,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.ni-payment.v2+json",
          "Content-Type": "application/vnd.ni-payment.v2+json",
          Realm: "OBMali",
          "X-Request-Id": String(requestId),
        },
      }
    );

    const paymentUrl = response?.data?._links?.payment?.href;
    if (!paymentUrl || typeof paymentUrl !== "string") {
      return res.status(502).json({
        error: "NGenius n'a pas retourné une URL de paiement valide.",
      });
    }

    const ngeniusOrderReference = extractNgeniusOrderReference(response?.data);
    await db.collection("orders").doc(orderId).set(
      {
        ngeniusOrderReference,
        ngeniusOrderId: response?.data?._id || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log("[create-payment] ngenius order created", {
      requestId,
      orderId,
      ngeniusOrderReference,
      latencyMs: nowMs() - ngCallStartedAt,
    });

    res.json({ url: paymentUrl, requestId });

  } catch (e) {
    const providerData = e?.response?.data;
    const providerError = providerData?.error;
    const providerErrors = providerData?.errors;
    const errorsMessage = Array.isArray(providerErrors)
      ? providerErrors
          .map((item) => item?.message || item?.description || item?.detail || JSON.stringify(item))
          .filter(Boolean)
          .join(" | ")
      : "";
    const providerMessage =
      errorsMessage ||
      providerError?.message ||
      providerError?.description ||
      providerError?.detail ||
      providerData?.errorMessage ||
      providerData?.message;
    const providerStatus = Number(e?.response?.status) || 500;

    res.status(providerStatus >= 400 && providerStatus < 600 ? providerStatus : 500).json({
      error: providerMessage || e.message || "Erreur paiement NGenius",
      requestId,
    });
  }
});

/* =========================
   🔍 VERIFICATION ET MISE A JOUR MANUELLE
========================= */
app.post("/verify-ngenius-payment", async (req, res) => {
  const requestId = getRequestId(req);
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "orderId est requis." });
  }

  try {
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({
        success: false,
        verified: false,
        status: "FAILED",
        error: "Commande introuvable.",
        orderId,
        state: "UNKNOWN",
        isPaid: false,
        isFailed: false,
      });
    }

    const orderData = orderSnap.data() || {};

    // Une commande déjà réglée (webhook NGenius) n'est jamais réévaluée.
    if (orderData.paymentStatus === "paid" || orderData.status === "paid") {
      return res.json({
        success: true,
        verified: true,
        status: "PAID",
        orderId,
        state: "PURCHASED",
        isPaid: true,
        isFailed: false,
        source: "firestore",
      });
    }

    const orderReference =
      (typeof orderData.ngeniusOrderReference === "string" && orderData.ngeniusOrderReference.trim()) ||
      null;

    if (!orderReference) {
      console.error("[verify-ngenius-payment] référence NGenius absente", { requestId, orderId });
      return res.status(409).json({
        success: false,
        verified: false,
        status: "FAILED",
        error: "Référence NGenius introuvable pour cette commande.",
        orderId,
        state: "UNKNOWN",
        isPaid: false,
        isFailed: false,
      });
    }

    const ngOrder = await fetchNgeniusOrder(orderReference, requestId);
    const state = extractNgeniusPaymentState(ngOrder);
    const isPaid = isNgeniusPaymentSuccessful(state);
    const isFailed = isNgeniusPaymentFailure(state);

    console.log("[verify-ngenius-payment] état NGenius", {
      requestId,
      orderId,
      orderReference,
      state,
      isPaid,
      isFailed,
    });

    if (isPaid) {
      await updateStatus(orderId, "paid", {
        paymentStatus: "paid",
        paidAt: admin.firestore.FieldValue.serverTimestamp(),
        ngeniusPaymentState: state,
      });
    } else if (isFailed) {
      await updateStatus(orderId, "cancelled", {
        paymentStatus: "failed",
        ngeniusPaymentState: state,
      });
    } else {
      // État intermédiaire (AWAIT_3DS, STARTED, ...) : la commande reste en attente.
      await orderRef.set(
        {
          ngeniusPaymentState: state || "UNKNOWN",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await db.collection("payments").doc(orderId).set(
      {
        orderRef: orderId,
        paymentState: state || "UNKNOWN",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.json({
      success: true,
      verified: true,
      status: isPaid ? "PAID" : isFailed ? "FAILED" : "PENDING",
      orderId,
      state: state || "UNKNOWN",
      isPaid,
      isFailed,
      source: "ngenius",
    });

  } catch (error) {
    const httpStatus = Number(error?.response?.status) || null;

    console.error("❌ Erreur validation :", {
      requestId,
      orderId,
      httpStatus,
      message: error?.message,
      responseHeaders: error?.response?.headers,
      responseData: error?.response?.data,
    });

    if (httpStatus === 415) {
      console.error("[verify-ngenius-payment] 415 : type de média refusé par NGenius", {
        requestId,
        orderId,
        triedMediaTypes: NG_ORDER_MEDIA_TYPES,
        responseData: error?.response?.data,
      });
    }

    // La vérification a échoué techniquement : ce n'est PAS un refus de paiement.
    // La commande reste intacte en base, le webhook pourra encore la régler.
    return res.json({
      success: false,
      verified: false,
      status: "FAILED",
      orderId,
      state: "UNKNOWN",
      isPaid: false,
      isFailed: false,
      httpStatus,
      error: "Vérification NGenius indisponible.",
    });
  }
});
/* =========================
   💳 CREATE FEDAPAY PAYMENT
========================= */

app.post("/create-fedapay-payment", async (req, res) => {
  try {

    const {
      amount,
      orderId,
      userId,
      email,
      firstname,
      lastname,
      items,
      summary,
      shippingAddress,
      deliveryMode,
      shippingMethod,
      shippingMethodName,
      shippingMethodDelay,
      shippingEstimatedDays,
      shippingMethodType,
      shipping,
    } = req.body;

    if (!amount || !orderId || !userId) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const normalizedAmount = Math.round(Number(amount));
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return res.status(400).json({ error: "Montant invalide pour FedaPay." });
    }

    const safeFirstname = String(firstname || "").trim() || "Client";
    const safeLastname = String(lastname || "").trim() || "A2Express";
    const safeEmail = String(email || "").trim() || `${String(userId).trim()}@a2-expres.com`;

    const sellerIds = await resolveSellerIdsFromItems(items || []);
    const deliveryFields = persistableDeliveryMode(deliveryMode, {
      orderId,
      provider: "fedapay",
    });
    await db.collection("orders").doc(orderId).set({
      orderId,
      userId,
      total: normalizedAmount,
      provider: "fedapay",
      status: "pending",

      items: items || [],
      summary: summary || {},
      shippingAddress: shippingAddress || null,
      ...(shippingMethod ? { shippingMethod } : {}),
      ...(shippingMethodName ? { shippingMethodName } : {}),
      ...(shippingMethodDelay
        ? { shippingMethodDelay, shippingEstimatedDays: shippingMethodDelay }
        : shippingEstimatedDays
          ? { shippingEstimatedDays, shippingMethodDelay: shippingEstimatedDays }
          : {}),
      ...(shippingMethodType ? { shippingMethodType } : {}),
      ...(shipping ? { shipping } : {}),
      ...deliveryFields,
      ...(sellerIds.length === 1 ? { sellerId: sellerIds[0] } : {}),
      ...(sellerIds.length > 0 ? { sellerIds } : {}),

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const transaction = await Transaction.create({
      description: `Commande ${orderId}`,
      amount: normalizedAmount,
      currency: { iso: "XOF" },
      reference: orderId,
      callback_url: "https://ngenius-backend.onrender.com/webhook/fedapay",
      customer: {
        firstname: safeFirstname,
        lastname: safeLastname,
        email: safeEmail,
      },
    });

    const token = await transaction.generateToken();

    res.json({ url: token.url });

  } catch (e) {
    const providerData = e?.response?.data;
    const providerMessage =
      providerData?.message ||
      providerData?.error ||
      providerData?.description ||
      (Array.isArray(providerData?.errors) && providerData.errors.length > 0
        ? providerData.errors.map((item) => item?.message || JSON.stringify(item)).join(" | ")
        : null);

    const status = Number(e?.response?.status) || 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: providerMessage || e.message || "Erreur paiement FedaPay",
    });
  }
});

/* =========================
   💳 CREATE PAYDUNYA PAYMENT
========================= */

app.post("/create-paydunya-payment", async (req, res) => {
  try {

    const {
      amount,
      orderId,
      userId,
      items,
      summary,
      shippingAddress,
      deliveryMode,
      shippingMethod,
      shippingMethodName,
      shippingMethodDelay,
      shippingEstimatedDays,
      shippingMethodType,
      shipping,
    } = req.body;

    if (!amount || !orderId || !userId)
      return res.status(400).json({ error: "Missing fields" });

    const sellerIds = await resolveSellerIdsFromItems(items || []);
    const deliveryFields = persistableDeliveryMode(deliveryMode, {
      orderId,
      provider: "paydunya",
    });
    await db.collection("orders").doc(orderId).set({
      orderId,
      userId,
      total: amount,
      provider: "paydunya",
      status: "pending",

      items: items || [],
      summary: summary || {},
      shippingAddress: shippingAddress || null,
      ...(shippingMethod ? { shippingMethod } : {}),
      ...(shippingMethodName ? { shippingMethodName } : {}),
      ...(shippingMethodDelay
        ? { shippingMethodDelay, shippingEstimatedDays: shippingMethodDelay }
        : shippingEstimatedDays
          ? { shippingEstimatedDays, shippingMethodDelay: shippingEstimatedDays }
          : {}),
      ...(shippingMethodType ? { shippingMethodType } : {}),
      ...(shipping ? { shipping } : {}),
      ...deliveryFields,
      ...(sellerIds.length === 1 ? { sellerId: sellerIds[0] } : {}),
      ...(sellerIds.length > 0 ? { sellerIds } : {}),

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const response = await axios.post(
      "https://app.paydunya.com/api/v1/checkout-invoice/create",
      {
        invoice: {
          total_amount: amount,
          description: `Commande #${orderId}`,
        },
        store: { name: "A2Express" },
        custom_data: { order_id: orderId },
        actions: {
          cancel_url: "https://a2-expres.com/payment/cancel.html",
          return_url: "https://a2-expres.com/payment/success.html",
          callback_url: "https://ngenius-backend.onrender.com/webhook/paydunya",
        },
      },
      {
        headers: {
          "PAYDUNYA-MASTER-KEY": process.env.PAYDUNYA_MASTER_KEY,
          "PAYDUNYA-PRIVATE-KEY": process.env.PAYDUNYA_PRIVATE_KEY,
          "PAYDUNYA-TOKEN": process.env.PAYDUNYA_TOKEN,
          "PAYDUNYA-MODE": process.env.PAYDUNYA_MODE,
          "Content-Type": "application/json"
        }
      }
    );

    if (response.data.response_code !== "00") {
      return res.status(400).json({
        error: response.data.response_text,
      });
    }

    return res.json({
      url: response.data.response_text,
      token: response.data.token,
    });

  } catch (error) {
    return res.status(500).json({
      error: error.response?.data || error.message,
    });
  }
});

/* =========================
   🔔 WEBHOOKS
========================= */

/* --- WEBHOOK NGENIUS --- */
app.post("/webhook/ngenius", async (req, res) => {
  const requestId = getRequestId(req);
  const secret = process.env.NG_WEBHOOK_SECRET;

  if (!secret) {
    console.error("❌ [WEBHOOK NGENIUS] NG_WEBHOOK_SECRET absent : webhook refusé", {
      requestId,
    });
    return res.status(503).json({ error: "Webhook signature non configurée." });
  }

  const signature = extractWebhookSignature(req);

  if (!signature) {
    console.error("❌ [WEBHOOK NGENIUS] Signature absente", {
      requestId,
      receivedHeaders: Object.keys(req.headers),
    });
    return res.status(401).json({ error: "Signature manquante." });
  }

  if (!isValidNgeniusWebhookSignature(req.rawBody, signature.value, secret)) {
    console.error("❌ [WEBHOOK NGENIUS] Signature invalide", {
      requestId,
      signatureHeader: signature.header,
      rawBodyLength: req.rawBody?.length ?? 0,
    });
    return res.status(401).json({ error: "Signature invalide." });
  }

  console.log("✅ [WEBHOOK NGENIUS] Signature vérifiée", {
    requestId,
    signatureHeader: signature.header,
  });

  try {
    const payload = req.body;

    // 👇 LOGS DE DEBUG AJOUTÉS ICI 👇
    console.log("🔔 [WEBHOOK NGENIUS] Requête reçue !");
    console.log(JSON.stringify(payload, null, 2));

    const orderId = await resolveFirestoreOrderId(payload);
    const eventName = extractNgeniusEventName(payload);
    const state =
      payload?.eventData?.payment?.state ||
      payload?.payment?.state ||
      payload?.state ||
      payload?._embedded?.payment?.[0]?.state ||
      payload?._embedded?.payments?.[0]?.state ||
      null;

    const isSuccessful =
      isNgeniusPaymentSuccessful(state) ||
      eventNameMatches(eventName, NGENIUS_SUCCESS_EVENTS);
    const isFailed =
      !isSuccessful &&
      (isNgeniusPaymentFailure(state) ||
        eventNameMatches(eventName, NGENIUS_FAILURE_EVENTS));

    console.log("[WEBHOOK NGENIUS] Commande résolue", {
      requestId,
      orderId,
      eventName: eventName || null,
      state: state || null,
      isSuccessful,
      isFailed,
    });

    if (typeof orderId === "string" && orderId.trim()) {
      const cleanOrderId = orderId.trim();

      if (isSuccessful) {
        await updateStatus(cleanOrderId, "paid", {
          paymentStatus: "paid",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          ngeniusPaymentState: state || eventName || "PURCHASED",
        });
      } else if (isFailed) {
        await updateStatus(cleanOrderId, "cancelled", {
          paymentStatus: "failed",
          ngeniusPaymentState: state || eventName || "FAILED",
        });
      }

      await db.collection("payments").doc(cleanOrderId).set(
        {
          orderRef: cleanOrderId,
          paymentState: state || eventName || "UNKNOWN",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          raw: payload,
        },
        { merge: true }
      );
    } else {
      console.error("[WEBHOOK NGENIUS] Impossible de rattacher le webhook à une commande", {
        requestId,
        eventName: eventName || null,
        state: state || null,
      });
    }
  } catch (e) {
    console.error("❌ Erreur webhook NGenius :", e);
  }
  return res.sendStatus(200);
});

/* --- WEBHOOK FEDAPAY --- */
app.post("/webhook/fedapay", async (req, res) => {
  try {
    const event = JSON.parse(req.body.toString("utf8"));
    const orderId = event?.data?.reference;
    const eventName = event?.name;

    if (orderId) {
      if (eventName === "transaction.approved") {
        await updateStatus(orderId, "paid", {
          paymentStatus: "paid",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (
        eventName === "transaction.canceled" ||
        eventName === "transaction.declined"
      ) {
        await updateStatus(orderId, "cancelled", {
          paymentStatus: "failed",
        });
      }
      // Les événements d'attente (ex: transaction.created) sont ignorés
    }
    res.send("OK");
  } catch (e) {
    console.error("❌ Erreur webhook FedaPay :", e);
    res.sendStatus(400);
  }
});

/* --- WEBHOOK PAYDUNYA --- */
app.post("/webhook/paydunya", async (req, res) => {
  try {
    const payload = JSON.parse(req.body.toString("utf8"));
    const orderId = payload?.custom_data?.order_id;
    const paydunyaStatus = String(payload?.status || "").toLowerCase();

    if (orderId) {
      if (paydunyaStatus === "completed") {
        await updateStatus(orderId, "paid", {
          paymentStatus: "paid",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else if (
        paydunyaStatus === "cancelled" ||
        paydunyaStatus === "failed"
      ) {
        await updateStatus(orderId, "cancelled", {
          paymentStatus: "failed",
        });
      }
    }
    res.send("OK");
  } catch (e) {
    console.error("❌ Erreur webhook PayDunya :", e);
    res.sendStatus(400);
  }
});

app.post("/notify-new-product", async (req, res) => {
  try {
    const { productId, name, imageUrl } = req.body || {};

    if (!productId || !name) {
      return res.status(400).json({ error: "productId and name are required" });
    }

    const claimed = await claimNotificationOnce(
      newProductIdempotencyKey(productId),
      "ngenius-backend.notify-new-product",
    );
    if (!claimed) {
      return res.json({ ok: true, deduped: true });
    }

    await broadcastNotificationToAllUsers({
      title: "Nouveau produit sur A2Express",
      body: name,
      data: {
        type: "new_product",
        productId,
        imageUrl: imageUrl || null,
      },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("notify-new-product error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

app.post("/notify-keep-alive", async (req, res) => {
  try {
    await broadcastNotificationToAllUsers({
      title: "A2Express est ouvert pour vous",
      body: "Découvrez les nouveautés, les produits Zéro Dollars et les offres en cours.",
      data: {
        type: "keep_alive",
      },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("notify-keep-alive error:", e);
    res.status(500).json({ error: "internal_error" });
  }
});

/* =========================
   🟢 START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
  console.log(`🚀 A2Express backend LIVE on port ${PORT}`)
);