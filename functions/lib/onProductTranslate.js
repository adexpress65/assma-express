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
exports.onProductTranslate = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const translateService_1 = require("./services/translateService");
const translateParams_1 = require("./translateParams");
const TARGET_LANGS = ["en", "ar", "zh"];
function getSourceLocale(data) {
    const raw = data.defaultLocale;
    if (typeof raw === "string" && raw.trim())
        return raw.trim().toLowerCase();
    return "fr";
}
function sourceNameAndDesc(data) {
    const locale = getSourceLocale(data);
    const ln = data.localizedNames &&
        typeof data.localizedNames === "object" &&
        !Array.isArray(data.localizedNames)
        ? data.localizedNames
        : {};
    const ld = data.localizedDescriptions &&
        typeof data.localizedDescriptions === "object" &&
        !Array.isArray(data.localizedDescriptions)
        ? data.localizedDescriptions
        : {};
    const name = (ln[locale] || (typeof data.name === "string" ? data.name : "") || "").trim();
    const description = (ld[locale] ||
        (typeof data.description === "string" ? data.description : "") ||
        "").trim();
    return { locale, name, description };
}
function sourceFingerprint(data) {
    if (!data)
        return "";
    const { locale, name, description } = sourceNameAndDesc(data);
    return `${locale}|${name}|${description}`;
}
function needsAnyTranslation(data, sourceLocale, sourceName, sourceDesc) {
    const ln = data.localizedNames &&
        typeof data.localizedNames === "object" &&
        !Array.isArray(data.localizedNames)
        ? data.localizedNames
        : {};
    const ld = data.localizedDescriptions &&
        typeof data.localizedDescriptions === "object" &&
        !Array.isArray(data.localizedDescriptions)
        ? data.localizedDescriptions
        : {};
    if (sourceName) {
        for (const t of TARGET_LANGS) {
            if (t === sourceLocale)
                continue;
            if (!(ln[t] || "").trim())
                return true;
        }
    }
    if (sourceDesc) {
        for (const t of TARGET_LANGS) {
            if (t === sourceLocale)
                continue;
            if (!(ld[t] || "").trim())
                return true;
        }
    }
    return false;
}
const DELAY_MS = 120;
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
function patchFlatSourceFields(patch, sourceLocale, sourceName, sourceDesc) {
    const map = {
        fr: { n: "name_fr", d: "description_fr" },
        en: { n: "name_en", d: "description_en" },
        zh: { n: "name_zh", d: "description_zh" },
        ar: { n: "name_ar", d: "description_ar" },
    };
    const m = map[sourceLocale];
    if (!m)
        return;
    if (sourceName)
        patch[m.n] = sourceName;
    if (sourceDesc)
        patch[m.d] = sourceDesc;
}
exports.onProductTranslate = (0, firestore_1.onDocumentWritten)({
    document: "products/{productId}",
    region: "europe-west1",
    secrets: [translateParams_1.googleTranslateApiKey],
    memory: "512MiB",
    timeoutSeconds: 120,
}, async (event) => {
    const after = event.data?.after;
    if (!after?.exists)
        return;
    const data = after.data();
    if (!data)
        return;
    if (data.disableAutoTranslate === true)
        return;
    const apiKey = translateParams_1.googleTranslateApiKey.value().trim();
    if (!apiKey) {
        console.warn("onProductTranslate: GOOGLE_TRANSLATE_API_KEY vide, abandon.");
        return;
    }
    const before = event.data?.before;
    const fpBefore = sourceFingerprint(before?.data());
    const fpAfter = sourceFingerprint(data);
    const sourceChanged = fpBefore !== fpAfter;
    const { locale: sourceLocale, name: sourceName, description: sourceDesc } = sourceNameAndDesc(data);
    if (!sourceName && !sourceDesc)
        return;
    if (!sourceChanged && !needsAnyTranslation(data, sourceLocale, sourceName, sourceDesc)) {
        return;
    }
    const prevLn = data.localizedNames &&
        typeof data.localizedNames === "object" &&
        !Array.isArray(data.localizedNames)
        ? { ...data.localizedNames }
        : {};
    const prevLd = data.localizedDescriptions &&
        typeof data.localizedDescriptions === "object" &&
        !Array.isArray(data.localizedDescriptions)
        ? { ...data.localizedDescriptions }
        : {};
    const localizedNames = { ...prevLn };
    const localizedDescriptions = { ...prevLd };
    if (sourceName)
        localizedNames[sourceLocale] = sourceName;
    if (sourceDesc)
        localizedDescriptions[sourceLocale] = sourceDesc;
    const patch = {
        localizedNames,
        localizedDescriptions,
        defaultLocale: sourceLocale,
        i18nAutoTranslatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    patchFlatSourceFields(patch, sourceLocale, sourceName, sourceDesc);
    try {
        for (const target of TARGET_LANGS) {
            if (target === sourceLocale)
                continue;
            if (sourceName) {
                if (sourceChanged || !(localizedNames[target] || "").trim()) {
                    await sleep(DELAY_MS);
                    const translated = await (0, translateService_1.translateText)(sourceName, sourceLocale, target, apiKey);
                    if (translated) {
                        localizedNames[target] = translated;
                        if (target === "en")
                            patch.name_en = translated;
                        if (target === "zh")
                            patch.name_zh = translated;
                        if (target === "ar")
                            patch.name_ar = translated;
                    }
                }
            }
            if (sourceDesc) {
                if (sourceChanged || !(localizedDescriptions[target] || "").trim()) {
                    await sleep(DELAY_MS);
                    const translated = await (0, translateService_1.translateText)(sourceDesc, sourceLocale, target, apiKey);
                    if (translated) {
                        localizedDescriptions[target] = translated;
                        if (target === "en")
                            patch.description_en = translated;
                        if (target === "zh")
                            patch.description_zh = translated;
                        if (target === "ar")
                            patch.description_ar = translated;
                    }
                }
            }
        }
        patch.localizedNames = localizedNames;
        patch.localizedDescriptions = localizedDescriptions;
        const unchanged = JSON.stringify(prevLn) === JSON.stringify(localizedNames) &&
            JSON.stringify(prevLd) === JSON.stringify(localizedDescriptions);
        if (unchanged)
            return;
        await after.ref.update(patch);
    }
    catch (e) {
        console.error(`onProductTranslate [${after.id}]:`, e);
    }
});
//# sourceMappingURL=onProductTranslate.js.map