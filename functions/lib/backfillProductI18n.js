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
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const translateService_1 = require("./services/translateService");
if (admin.apps.length === 0) {
    admin.initializeApp();
}
const db = admin.firestore();
function parseArgs() {
    const argv = process.argv.slice(2);
    const limitRaw = argv.find((a) => a.startsWith("--limit="));
    let limit;
    if (limitRaw) {
        const n = Number(limitRaw.split("=")[1]);
        if (Number.isFinite(n) && n > 0)
            limit = Math.floor(n);
    }
    const skipRaw = argv.find((a) => a.startsWith("--skip="));
    let skip = 0;
    if (skipRaw) {
        const n = Number(skipRaw.split("=")[1]);
        if (Number.isFinite(n) && n >= 0)
            skip = Math.floor(n);
    }
    return {
        dryRun: argv.includes("--dry-run"),
        translate: argv.includes("--translate"),
        limit,
        skip,
    };
}
async function main() {
    const { dryRun, translate, limit, skip: skipInitial } = parseArgs();
    const apiKey = (process.env.GOOGLE_TRANSLATE_API_KEY || "").trim();
    if (translate && !apiKey) {
        console.error("Erreur : --translate nécessite GOOGLE_TRANSLATE_API_KEY (API Cloud Translation activée sur le projet GCP).");
        process.exit(1);
    }
    const snap = await db
        .collection("products")
        .orderBy(firestore_1.FieldPath.documentId())
        .get();
    let skipRemaining = skipInitial;
    let examined = 0;
    let updated = 0;
    let batch = db.batch();
    let batchOps = 0;
    console.log(`[backfill] ${snap.docs.length} document(s) produit(s), skip=${skipInitial}, limit=${limit ?? "aucun"}`);
    const commit = async () => {
        if (batchOps === 0)
            return;
        if (!dryRun) {
            await batch.commit();
        }
        batch = db.batch();
        batchOps = 0;
    };
    for (const doc of snap.docs) {
        if (skipRemaining > 0) {
            skipRemaining--;
            continue;
        }
        if (limit != null && examined >= limit)
            break;
        examined++;
        if (examined % 50 === 0 || examined === 1) {
            console.log(`[backfill] … examinés=${examined} (après skip), mis à jour=${updated}`);
        }
        const data = doc.data();
        const name = typeof data.name === "string" ? data.name.trim() : "";
        const desc = typeof data.description === "string" ? data.description.trim() : "";
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
        if (name && !localizedNames.fr)
            localizedNames.fr = name;
        if (desc && !localizedDescriptions.fr)
            localizedDescriptions.fr = desc;
        const patch = {
            defaultLocale: typeof data.defaultLocale === "string" && data.defaultLocale.trim()
                ? data.defaultLocale.trim()
                : "fr",
            localizedNames,
            localizedDescriptions,
        };
        if (name)
            patch.name_fr = name;
        if (desc)
            patch.description_fr = desc;
        if (translate && apiKey) {
            try {
                if (name && !localizedNames.en) {
                    await new Promise((r) => setTimeout(r, 100));
                    const en = await (0, translateService_1.translateText)(name, "fr", "en", apiKey);
                    if (en) {
                        localizedNames.en = en;
                        patch.name_en = en;
                    }
                }
                if (desc && !localizedDescriptions.en) {
                    await new Promise((r) => setTimeout(r, 100));
                    const den = await (0, translateService_1.translateText)(desc, "fr", "en", apiKey);
                    if (den) {
                        localizedDescriptions.en = den;
                        patch.description_en = den;
                    }
                }
                if (name && !localizedNames.ar) {
                    await new Promise((r) => setTimeout(r, 100));
                    const ar = await (0, translateService_1.translateText)(name, "fr", "ar", apiKey);
                    if (ar) {
                        localizedNames.ar = ar;
                        patch.name_ar = ar;
                    }
                }
                if (desc && !localizedDescriptions.ar) {
                    await new Promise((r) => setTimeout(r, 100));
                    const dar = await (0, translateService_1.translateText)(desc, "fr", "ar", apiKey);
                    if (dar) {
                        localizedDescriptions.ar = dar;
                        patch.description_ar = dar;
                    }
                }
                if (name && !localizedNames.zh) {
                    await new Promise((r) => setTimeout(r, 100));
                    const zh = await (0, translateService_1.translateText)(name, "fr", "zh", apiKey);
                    if (zh) {
                        localizedNames.zh = zh;
                        patch.name_zh = zh;
                    }
                }
                if (desc && !localizedDescriptions.zh) {
                    await new Promise((r) => setTimeout(r, 100));
                    const dzh = await (0, translateService_1.translateText)(desc, "fr", "zh", apiKey);
                    if (dzh) {
                        localizedDescriptions.zh = dzh;
                        patch.description_zh = dzh;
                    }
                }
                patch.localizedNames = localizedNames;
                patch.localizedDescriptions = localizedDescriptions;
            }
            catch (e) {
                console.error(`[${doc.id}] traduction :`, e);
                continue;
            }
        }
        let mustWrite = false;
        for (const [k, v] of Object.entries(patch)) {
            const cur = data[k];
            if (JSON.stringify(cur) !== JSON.stringify(v)) {
                mustWrite = true;
                break;
            }
        }
        if (!mustWrite)
            continue;
        updated++;
        if (!dryRun) {
            batch.update(doc.ref, patch);
            batchOps++;
            if (batchOps >= 450) {
                await commit();
            }
        }
    }
    await commit();
    console.log(JSON.stringify({
        dryRun,
        translate,
        skip: skipInitial,
        limit: limit ?? null,
        examined,
        updated,
        note: dryRun
            ? "Aucune écriture (dry-run)."
            : "Terminé. onProductWrite mettra à jour Algolia à chaque doc.",
    }, null, 2));
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=backfillProductI18n.js.map