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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushToUserIds = exports.sendGlobalPushNotification = exports.sendExpoPushMessages = exports.uniqueExpoPushTokens = exports.claimNotificationOnce = exports.featuredProductIdempotencyKey = exports.newProductIdempotencyKey = void 0;
const admin = __importStar(require("firebase-admin"));
const expo_server_sdk_1 = __importDefault(require("expo-server-sdk"));
const expo = new expo_server_sdk_1.default();
function stringifyData(data) {
    const out = {};
    for (const [k, v] of Object.entries(data)) {
        if (v !== undefined && v !== null)
            out[k] = String(v);
    }
    return out;
}
function extractExpoTokens(data) {
    if (!data)
        return [];
    const directCandidates = [
        data.pushToken,
        data.expoPushToken,
        data.notificationToken,
        data.fcmToken,
    ];
    const fromArray = Array.isArray(data.pushTokens) ? data.pushTokens : [];
    return uniqueExpoPushTokens([...directCandidates, ...fromArray]);
}
function newProductIdempotencyKey(productId) {
    return `new_product:${String(productId || "").trim()}`;
}
exports.newProductIdempotencyKey = newProductIdempotencyKey;
function featuredProductIdempotencyKey(productId) {
    return `featured_product:${String(productId || "").trim()}`;
}
exports.featuredProductIdempotencyKey = featuredProductIdempotencyKey;
async function claimNotificationOnce(idempotencyKey, source = "cloud-functions") {
    const key = String(idempotencyKey || "").trim();
    if (!key)
        return false;
    const ref = admin.firestore().collection("notification_dedup").doc(key);
    try {
        await ref.create({
            key,
            source,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
    }
    catch (err) {
        const code = typeof err === "object" && err && "code" in err
            ? err.code
            : undefined;
        if (code === 6 || code === "already-exists")
            return false;
        throw err;
    }
}
exports.claimNotificationOnce = claimNotificationOnce;
function uniqueExpoPushTokens(rawTokens) {
    const out = new Set();
    for (const candidate of rawTokens) {
        if (typeof candidate !== "string")
            continue;
        const token = candidate.trim();
        if (!token)
            continue;
        if (!expo_server_sdk_1.default.isExpoPushToken(token))
            continue;
        out.add(token);
    }
    return [...out];
}
exports.uniqueExpoPushTokens = uniqueExpoPushTokens;
async function sendExpoPushMessages(messages) {
    const valid = messages.filter((m) => expo_server_sdk_1.default.isExpoPushToken(String(m.to)));
    const report = {
        requested: messages.length,
        accepted: 0,
        failed: messages.length - valid.length,
        errorCodes: [],
    };
    if (valid.length === 0)
        return report;
    const chunks = expo.chunkPushNotifications(valid);
    for (const chunk of chunks) {
        try {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            tickets.forEach((ticket, i) => {
                if (ticket.status === "error") {
                    report.failed += 1;
                    report.errorCodes.push(String(ticket.details?.error || "unknown"));
                    console.error("[push] ticket error", ticket.message, ticket.details, chunk[i]?.to);
                }
                else {
                    report.accepted += 1;
                }
            });
        }
        catch (e) {
            report.failed += chunk.length;
            report.errorCodes.push("batch_error");
            console.error("[push] batch error", e);
        }
    }
    return report;
}
exports.sendExpoPushMessages = sendExpoPushMessages;
async function sendGlobalPushNotification(title, body, data = {}) {
    const db = admin.firestore();
    const usersSnapshot = await db.collection("users").get();
    const messages = [];
    const seenTokens = new Set();
    usersSnapshot.forEach((docSnap) => {
        const tokens = extractExpoTokens((docSnap.data() || {}));
        for (const token of tokens) {
            if (seenTokens.has(token))
                continue;
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
exports.sendGlobalPushNotification = sendGlobalPushNotification;
async function sendPushToUserIds(userIds, title, body, data = {}) {
    const empty = {
        requested: 0,
        accepted: 0,
        failed: 0,
        errorCodes: [],
    };
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0)
        return empty;
    const db = admin.firestore();
    const refs = unique.map((uid) => db.collection("users").doc(uid));
    const snaps = [];
    const batchSize = 10;
    for (let i = 0; i < refs.length; i += batchSize) {
        const slice = refs.slice(i, i + batchSize);
        const part = await db.getAll(...slice);
        snaps.push(...part);
    }
    const messages = [];
    const seenTokens = new Set();
    const withoutToken = [];
    for (const snap of snaps) {
        const tokens = extractExpoTokens((snap.data() || {}));
        if (tokens.length === 0) {
            withoutToken.push(snap.id);
            continue;
        }
        for (const token of tokens) {
            if (seenTokens.has(token))
                continue;
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
    if (withoutToken.length > 0) {
        console.warn("[push] destinataires sans jeton Expo valide :", withoutToken);
    }
    return sendExpoPushMessages(messages);
}
exports.sendPushToUserIds = sendPushToUserIds;
//# sourceMappingURL=notifications.js.map