import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";

const DOC_PATH = { collection: "config", id: "exchangeRates" };

type UsdQuote = {
  xof?: number;
  cny?: number;
  usd?: number;
};

function asPositiveNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Taux : 1 unité étrangère = N F CFA (XOF).
 * Sources gratuites sans clé, avec repli.
 */
async function fetchRatesToXof(): Promise<{ CNY: number; USD: number; source: string }> {
  const errors: string[] = [];

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (res.ok) {
      const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
      const xof = asPositiveNumber(json?.rates?.XOF);
      const cny = asPositiveNumber(json?.rates?.CNY);
      if (xof && cny) {
        return {
          USD: Math.round(xof * 100) / 100,
          CNY: Math.round((xof / cny) * 100) / 100,
          source: "open.er-api.com",
        };
      }
    } else {
      errors.push(`open.er-api HTTP ${res.status}`);
    }
  } catch (e) {
    errors.push(`open.er-api: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const res = await fetch(
      "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json",
    );
    if (res.ok) {
      const json = (await res.json()) as { usd?: UsdQuote };
      const xof = asPositiveNumber(json?.usd?.xof);
      const cny = asPositiveNumber(json?.usd?.cny);
      if (xof && cny) {
        return {
          USD: Math.round(xof * 100) / 100,
          CNY: Math.round((xof / cny) * 100) / 100,
          source: "fawazahmed0/currency-api",
        };
      }
    } else {
      errors.push(`currency-api HTTP ${res.status}`);
    }
  } catch (e) {
    errors.push(`currency-api: ${e instanceof Error ? e.message : String(e)}`);
  }

  throw new Error(`Impossible de récupérer les taux (${errors.join(" | ")})`);
}

/**
 * Met à jour `config/exchangeRates` 2 fois par jour.
 * Document : { CNY, USD, XOF, updatedAt, source } — 1 unité = N XOF.
 */
export const updateExchangeRates = onSchedule(
  {
    schedule: "0 6,18 * * *",
    timeZone: "Africa/Abidjan",
    region: "europe-west1",
    retryCount: 2,
  },
  async () => {
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
  },
);
