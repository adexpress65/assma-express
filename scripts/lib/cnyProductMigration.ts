import type { DocumentData, Firestore } from "firebase-admin/firestore";

/** Taux utilisé lors du 1er run de updateExchangeRates (fallback si config absente). */
export const FALLBACK_CNY_RATE = 83.82;
/** Prix actuel < ce seuil (et sans priceCurrency) → suspect CNY saisi comme FCFA. */
export const DEFAULT_MAX_XOF_SUSPECT = 2000;
export const BATCH_SIZE = 400;

export type ProductPriceRow = {
  id: string;
  name: string;
  sellerId: string;
  companyId: string;
  companyName: string;
  price: number;
  basePrice: number | null;
  originalPrice: number | null;
  currency: string;
  priceCurrency: string | null;
  priceOriginal: number | null;
  priceXOF: number | null;
  variantCount: number;
  reasons: string[];
};

export function argValue(argv: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const hit = argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

export function parseNumberArg(argv: string[], name: string, fallback: number): number {
  const raw = argValue(argv, name);
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parseIdList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function asFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function sellerOf(data: DocumentData): {
  sellerId: string;
  companyId: string;
  companyName: string;
} {
  const sellerId = String(data.sellerId || data.sellerUid || data.companyId || "").trim();
  const companyId = String(data.companyId || data.sellerId || "").trim();
  const companyName = String(
    data.companyName || data.supplier || data.sellerName || "(sans nom)",
  ).trim();
  return { sellerId, companyId, companyName };
}

const CHINA_RE =
  /(chine|china|chinese|中國|中国|guangzhou|shenzhen|yiwu|foshan|zhejiang|guangdong|shanghai|beijing|hangzhou|ningbo|wenzhou|dongguan|义乌|佛山|深圳|广州)/i;
const CJK_RE = /[\u4e00-\u9fff]/;
const CN_COMPANY_RE = /co\.?\s*,?\s*ltd/i;

export function looksChineseOrigin(text: string): boolean {
  if (!text) return false;
  return CHINA_RE.test(text) || CJK_RE.test(text) || CN_COMPANY_RE.test(text);
}

export function isZeroDollarsShopName(name: string): boolean {
  const n = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /(zero|0)\s*dollars?/.test(n);
}

export function companyOriginBlob(company: DocumentData | undefined): string {
  if (!company) return "";
  return [
    company.country,
    company.location,
    company.city,
    company.address,
    company.origin,
    company.name,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function loadExchangeRateCny(
  firestore: Firestore,
  override?: number,
): Promise<{ rate: number; source: string }> {
  if (override != null && Number.isFinite(override) && override > 0) {
    return { rate: override, source: "--rate" };
  }

  const snap = await firestore.collection("config").doc("exchangeRates").get();
  if (snap.exists) {
    const n = asFiniteNumber(snap.data()?.CNY);
    if (n != null && n > 0) {
      return { rate: n, source: "config/exchangeRates" };
    }
  }

  return { rate: FALLBACK_CNY_RATE, source: `fallback ${FALLBACK_CNY_RATE}` };
}

export function looksLikeCnyAmount(amount: number, maxSuspect: number, refPrice: number): boolean {
  if (amount <= 0) return false;
  return amount <= Math.max(maxSuspect * 2, refPrice * 20);
}

export function buildCnyPatch(
  data: DocumentData,
  rate: number,
  maxSuspect: number,
): {
  patch: Record<string, unknown>;
  oldPrice: number;
  priceXOF: number;
  variantConverted: number;
} {
  const oldPrice = asFiniteNumber(data.price) ?? 0;
  const priceXOF = Math.round(oldPrice * rate);
  const oldCompare = asFiniteNumber(data.originalPrice);

  const patch: Record<string, unknown> = {
    priceOriginal: oldPrice,
    priceCurrency: "CNY",
    priceXOF,
    price: priceXOF,
    currency: "XOF",
    exchangeRateUsed: rate,
  };

  if (oldCompare != null && looksLikeCnyAmount(oldCompare, maxSuspect, oldPrice)) {
    patch.originalPriceOriginal = oldCompare;
    patch.originalPrice = Math.round(oldCompare * rate);
  }

  let variantConverted = 0;
  if (Array.isArray(data.variants)) {
    patch.variants = data.variants.map((v: Record<string, unknown>) => {
      const entered = asFiniteNumber(v.priceOriginal) ?? asFiniteNumber(v.price) ?? 0;
      if (!looksLikeCnyAmount(entered, maxSuspect, oldPrice)) return v;
      variantConverted += 1;
      return {
        ...v,
        priceOriginal: entered,
        price: Math.round(entered * rate),
      };
    });
  }

  return { patch, oldPrice, priceXOF, variantConverted };
}
