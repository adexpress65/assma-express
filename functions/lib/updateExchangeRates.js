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
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateExchangeRates = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const DOC_PATH = { collection: "config", id: "exchangeRates" };
function asPositiveNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}
async function fetchRatesToXof() {
    const errors = [];
    try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        if (res.ok) {
            const json = (await res.json());
            const xof = asPositiveNumber(json?.rates?.XOF);
            const cny = asPositiveNumber(json?.rates?.CNY);
            if (xof && cny) {
                return {
                    USD: Math.round(xof * 100) / 100,
                    CNY: Math.round((xof / cny) * 100) / 100,
                    source: "open.er-api.com",
                };
            }
        }
        else {
            errors.push(`open.er-api HTTP ${res.status}`);
        }
    }
    catch (e) {
        errors.push(`open.er-api: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
        const res = await fetch("https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json");
        if (res.ok) {
            const json = (await res.json());
            const xof = asPositiveNumber(json?.usd?.xof);
            const cny = asPositiveNumber(json?.usd?.cny);
            if (xof && cny) {
                return {
                    USD: Math.round(xof * 100) / 100,
                    CNY: Math.round((xof / cny) * 100) / 100,
                    source: "fawazahmed0/currency-api",
                };
            }
        }
        else {
            errors.push(`currency-api HTTP ${res.status}`);
        }
    }
    catch (e) {
        errors.push(`currency-api: ${e instanceof Error ? e.message : String(e)}`);
    }
    throw new Error(`Impossible de récupérer les taux (${errors.join(" | ")})`);
}
exports.updateExchangeRates = (0, scheduler_1.onSchedule)({
    schedule: "0 6,18 * * *",
    timeZone: "Africa/Abidjan",
    region: "europe-west1",
    retryCount: 2,
}, async () => {
    if (admin.apps.length === 0) {
        admin.initializeApp();
    }
    const { CNY, USD, source } = await fetchRatesToXof();
    const payload = {
        XOF: 1,
        CNY,
        USD,
        source,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await admin
        .firestore()
        .collection(DOC_PATH.collection)
        .doc(DOC_PATH.id)
        .set(payload, { merge: true });
    console.log(`[exchangeRates] MAJ ${source} CNY=${CNY} USD=${USD}`);
});
//# sourceMappingURL=updateExchangeRates.js.map