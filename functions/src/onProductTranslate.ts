/**
 * Traduction automatique des titres / descriptions produit vers en, ar, zh
 * (aligné avec `getLocalizedProductText` et `onProductWrite` / Algolia).
 *
 * Déclencheur : écriture sur `products/{id}`. Ne réécrit que si le texte source
 * change ou si des traductions manquent (évite boucles et travail inutile).
 *
 * Configuration :
 *   firebase functions:secrets:set GOOGLE_TRANSLATE_API_KEY
 * (clé API avec Cloud Translation API activée sur le projet GCP.)
 *
 * Désactiver par produit : `disableAutoTranslate: true` sur le document.
 */

import * as admin from "firebase-admin";
import type { DocumentData } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { translateText } from "./services/translateService";
import { googleTranslateApiKey } from "./translateParams";

const TARGET_LANGS = ["en", "ar", "zh"] as const;

function getSourceLocale(data: DocumentData): string {
  const raw = data.defaultLocale;
  if (typeof raw === "string" && raw.trim()) return raw.trim().toLowerCase();
  return "fr";
}

function sourceNameAndDesc(data: DocumentData): {
  locale: string;
  name: string;
  description: string;
} {
  const locale = getSourceLocale(data);
  const ln =
    data.localizedNames &&
    typeof data.localizedNames === "object" &&
    !Array.isArray(data.localizedNames)
      ? (data.localizedNames as Record<string, string>)
      : {};
  const ld =
    data.localizedDescriptions &&
    typeof data.localizedDescriptions === "object" &&
    !Array.isArray(data.localizedDescriptions)
      ? (data.localizedDescriptions as Record<string, string>)
      : {};
  const name = (ln[locale] || (typeof data.name === "string" ? data.name : "") || "").trim();
  const description = (
    ld[locale] ||
    (typeof data.description === "string" ? data.description : "") ||
    ""
  ).trim();
  return { locale, name, description };
}

/** Empreinte du contenu source uniquement (ignore les traductions). */
function sourceFingerprint(data: DocumentData | undefined): string {
  if (!data) return "";
  const { locale, name, description } = sourceNameAndDesc(data);
  return `${locale}|${name}|${description}`;
}

function needsAnyTranslation(
  data: DocumentData,
  sourceLocale: string,
  sourceName: string,
  sourceDesc: string,
): boolean {
  const ln =
    data.localizedNames &&
    typeof data.localizedNames === "object" &&
    !Array.isArray(data.localizedNames)
      ? (data.localizedNames as Record<string, string>)
      : {};
  const ld =
    data.localizedDescriptions &&
    typeof data.localizedDescriptions === "object" &&
    !Array.isArray(data.localizedDescriptions)
      ? (data.localizedDescriptions as Record<string, string>)
      : {};

  if (sourceName) {
    for (const t of TARGET_LANGS) {
      if (t === sourceLocale) continue;
      if (!(ln[t] || "").trim()) return true;
    }
  }
  if (sourceDesc) {
    for (const t of TARGET_LANGS) {
      if (t === sourceLocale) continue;
      if (!(ld[t] || "").trim()) return true;
    }
  }
  return false;
}

const DELAY_MS = 120;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Champs plats `name_xx` / `description_xx` pour Algolia (même convention que l’app). */
function patchFlatSourceFields(
  patch: Record<string, unknown>,
  sourceLocale: string,
  sourceName: string,
  sourceDesc: string,
): void {
  const map: Record<string, { n: string; d: string }> = {
    fr: { n: "name_fr", d: "description_fr" },
    en: { n: "name_en", d: "description_en" },
    zh: { n: "name_zh", d: "description_zh" },
    ar: { n: "name_ar", d: "description_ar" },
  };
  const m = map[sourceLocale];
  if (!m) return;
  if (sourceName) patch[m.n] = sourceName;
  if (sourceDesc) patch[m.d] = sourceDesc;
}

export const onProductTranslate = onDocumentWritten(
  {
    document: "products/{productId}",
    region: "europe-west1",
    secrets: [googleTranslateApiKey],
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;

    const data = after.data();
    if (!data) return;

    if (data.disableAutoTranslate === true) return;

    const apiKey = googleTranslateApiKey.value().trim();
    if (!apiKey) {
      console.warn("onProductTranslate: GOOGLE_TRANSLATE_API_KEY vide, abandon.");
      return;
    }

    const before = event.data?.before;
    const fpBefore = sourceFingerprint(before?.data());
    const fpAfter = sourceFingerprint(data);
    const sourceChanged = fpBefore !== fpAfter;

    const { locale: sourceLocale, name: sourceName, description: sourceDesc } =
      sourceNameAndDesc(data);

    if (!sourceName && !sourceDesc) return;

    if (!sourceChanged && !needsAnyTranslation(data, sourceLocale, sourceName, sourceDesc)) {
      return;
    }

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

    if (sourceName) localizedNames[sourceLocale] = sourceName;
    if (sourceDesc) localizedDescriptions[sourceLocale] = sourceDesc;

    const patch: Record<string, unknown> = {
      localizedNames,
      localizedDescriptions,
      defaultLocale: sourceLocale,
      i18nAutoTranslatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    patchFlatSourceFields(patch, sourceLocale, sourceName, sourceDesc);

    try {
      for (const target of TARGET_LANGS) {
        if (target === sourceLocale) continue;

        if (sourceName) {
          if (sourceChanged || !(localizedNames[target] || "").trim()) {
            await sleep(DELAY_MS);
            const translated = await translateText(
              sourceName,
              sourceLocale,
              target,
              apiKey,
            );
            if (translated) {
              localizedNames[target] = translated;
              if (target === "en") patch.name_en = translated;
              if (target === "zh") patch.name_zh = translated;
              if (target === "ar") patch.name_ar = translated;
            }
          }
        }

        if (sourceDesc) {
          if (sourceChanged || !(localizedDescriptions[target] || "").trim()) {
            await sleep(DELAY_MS);
            const translated = await translateText(
              sourceDesc,
              sourceLocale,
              target,
              apiKey,
            );
            if (translated) {
              localizedDescriptions[target] = translated;
              if (target === "en") patch.description_en = translated;
              if (target === "zh") patch.description_zh = translated;
              if (target === "ar") patch.description_ar = translated;
            }
          }
        }
      }

      patch.localizedNames = localizedNames;
      patch.localizedDescriptions = localizedDescriptions;

      const unchanged =
        JSON.stringify(prevLn) === JSON.stringify(localizedNames) &&
        JSON.stringify(prevLd) === JSON.stringify(localizedDescriptions);
      if (unchanged) return;

      await after.ref.update(patch);
    } catch (e) {
      console.error(`onProductTranslate [${after.id}]:`, e);
    }
  },
);
