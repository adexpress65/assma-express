/**
 * Migration professionnelle des produits : `defaultLocale`, `localizedNames` / `localizedDescriptions`
 * (aligné avec apps/mobile/src/utils/productLocale.ts et onProductWrite).
 *
 * Usage (depuis le dossier `functions/`, après `npm run build`) :
 *   node lib/backfillProductI18n.js [--dry-run] [--translate] [--limit=N] [--skip=N]
 *
 * Documents triés par ID (ordre stable). `--skip` permet d’enchaîner les lots sans tout retraiter.
 *
 * - Sans --translate : structure seulement (fr depuis name/description), idempotent.
 * - --translate : remplit en + ar + zh via Google Cloud Translation API v2 (nécessite une clé API).
 *
 * Variables d'environnement :
 * - GOOGLE_TRANSLATE_API_KEY : clé API (projet GCP avec Cloud Translation activée).
 * - GOOGLE_APPLICATION_CREDENTIALS : compte de service Firebase Admin (déjà utilisé pour les scripts).
 */

import * as admin from "firebase-admin";
import { FieldPath } from "firebase-admin/firestore";
import { translateText } from "./services/translateService";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

function parseArgs(): {
  dryRun: boolean;
  translate: boolean;
  limit?: number;
  skip: number;
} {
  const argv = process.argv.slice(2);
  const limitRaw = argv.find((a) => a.startsWith("--limit="));
  let limit: number | undefined;
  if (limitRaw) {
    const n = Number(limitRaw.split("=")[1]);
    if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
  }
  const skipRaw = argv.find((a) => a.startsWith("--skip="));
  let skip = 0;
  if (skipRaw) {
    const n = Number(skipRaw.split("=")[1]);
    if (Number.isFinite(n) && n >= 0) skip = Math.floor(n);
  }
  return {
    dryRun: argv.includes("--dry-run"),
    translate: argv.includes("--translate"),
    limit,
    skip,
  };
}

async function main(): Promise<void> {
  const { dryRun, translate, limit, skip: skipInitial } = parseArgs();
  const apiKey = (process.env.GOOGLE_TRANSLATE_API_KEY || "").trim();
  if (translate && !apiKey) {
    console.error(
      "Erreur : --translate nécessite GOOGLE_TRANSLATE_API_KEY (API Cloud Translation activée sur le projet GCP).",
    );
    process.exit(1);
  }

  const snap = await db
    .collection("products")
    .orderBy(FieldPath.documentId())
    .get();
  let skipRemaining = skipInitial;
  let examined = 0;
  let updated = 0;
  let batch = db.batch();
  let batchOps = 0;

  console.log(
    `[backfill] ${snap.docs.length} document(s) produit(s), skip=${skipInitial}, limit=${limit ?? "aucun"}`,
  );

  const commit = async () => {
    if (batchOps === 0) return;
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
    if (limit != null && examined >= limit) break;
    examined++;

    if (examined % 50 === 0 || examined === 1) {
      console.log(
        `[backfill] … examinés=${examined} (après skip), mis à jour=${updated}`,
      );
    }

    const data = doc.data();
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const desc = typeof data.description === "string" ? data.description.trim() : "";

    const prevLn =
      data.localizedNames &&
      typeof data.localizedNames === "object" &&
      !Array.isArray(data.localizedNames)
        ? { ...(data.localizedNames as Record<string, string>) }
        : {};
    const prevLd =
      data.localizedDescriptions &&
      typeof data.localizedDescriptions === "object" &&
      !Array.isArray(data.localizedDescriptions)
        ? { ...(data.localizedDescriptions as Record<string, string>) }
        : {};

    const localizedNames = { ...prevLn };
    const localizedDescriptions = { ...prevLd };

    if (name && !localizedNames.fr) localizedNames.fr = name;
    if (desc && !localizedDescriptions.fr) localizedDescriptions.fr = desc;

    const patch: Record<string, unknown> = {
      defaultLocale:
        typeof data.defaultLocale === "string" && data.defaultLocale.trim()
          ? data.defaultLocale.trim()
          : "fr",
      localizedNames,
      localizedDescriptions,
    };

    if (name) patch.name_fr = name;
    if (desc) patch.description_fr = desc;

    if (translate && apiKey) {
      try {
        if (name && !localizedNames.en) {
          await new Promise((r) => setTimeout(r, 100));
          const en = await translateText(name, "fr", "en", apiKey);
          if (en) {
            localizedNames.en = en;
            patch.name_en = en;
          }
        }
        if (desc && !localizedDescriptions.en) {
          await new Promise((r) => setTimeout(r, 100));
          const den = await translateText(desc, "fr", "en", apiKey);
          if (den) {
            localizedDescriptions.en = den;
            patch.description_en = den;
          }
        }
        if (name && !localizedNames.ar) {
          await new Promise((r) => setTimeout(r, 100));
          const ar = await translateText(name, "fr", "ar", apiKey);
          if (ar) {
            localizedNames.ar = ar;
            patch.name_ar = ar;
          }
        }
        if (desc && !localizedDescriptions.ar) {
          await new Promise((r) => setTimeout(r, 100));
          const dar = await translateText(desc, "fr", "ar", apiKey);
          if (dar) {
            localizedDescriptions.ar = dar;
            patch.description_ar = dar;
          }
        }
        if (name && !localizedNames.zh) {
          await new Promise((r) => setTimeout(r, 100));
          const zh = await translateText(name, "fr", "zh", apiKey);
          if (zh) {
            localizedNames.zh = zh;
            patch.name_zh = zh;
          }
        }
        if (desc && !localizedDescriptions.zh) {
          await new Promise((r) => setTimeout(r, 100));
          const dzh = await translateText(desc, "fr", "zh", apiKey);
          if (dzh) {
            localizedDescriptions.zh = dzh;
            patch.description_zh = dzh;
          }
        }
        patch.localizedNames = localizedNames;
        patch.localizedDescriptions = localizedDescriptions;
      } catch (e) {
        console.error(`[${doc.id}] traduction :`, e);
        continue;
      }
    }

    let mustWrite = false;
    for (const [k, v] of Object.entries(patch)) {
      const cur = (data as Record<string, unknown>)[k];
      if (JSON.stringify(cur) !== JSON.stringify(v)) {
        mustWrite = true;
        break;
      }
    }
    if (!mustWrite) continue;

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

  console.log(
    JSON.stringify(
      {
        dryRun,
        translate,
        skip: skipInitial,
        limit: limit ?? null,
        examined,
        updated,
        note: dryRun
          ? "Aucune écriture (dry-run)."
          : "Terminé. onProductWrite mettra à jour Algolia à chaque doc.",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
