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
exports.sendPushToUserIds = exports.sendGlobalPushNotification = exports.sendExpoPushMessages = void 0;
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
    const out = new Set();
    for (const candidate of [...directCandidates, ...fromArray]) {
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
async function sendExpoPushMessages(messages) {
    const valid = messages.filter((m) => expo_server_sdk_1.default.isExpoPushToken(String(m.to)));
    if (valid.length === 0)
        return;
    const chunks = expo.chunkPushNotifications(valid);
    for (const chunk of chunks) {
        try {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            tickets.forEach((ticket, i) => {
                if (ticket.status === "error") {
                    console.error("[push] ticket error", ticket.message, ticket.details, chunk[i]?.to);
                }
            });
        }
        catch (e) {
            console.error("[push] batch error", e);
        }
    }
}
exports.sendExpoPushMessages = sendExpoPushMessages;
async function sendGlobalPushNotification(title, body, data = {}) {
    const db = admin.firestore();
    const usersSnapshot = await db.collection("users").get();
    const messages = [];
    usersSnapshot.forEach((docSnap) => {
        const token = docSnap.data().pushToken;
        if (token && expo_server_sdk_1.default.isExpoPushToken(token)) {
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
exports.sendGlobalPushNotification = sendGlobalPushNotification;
async function sendPushToUserIds(userIds, title, body, data = {}) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0)
        return;
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
    for (const snap of snaps) {
        const tokens = extractExpoTokens((snap.data() || {}));
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
exports.sendPushToUserIds = sendPushToUserIds;
//# sourceMappingURL=notifications.js.map