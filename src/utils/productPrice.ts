/**
 * Prix catalogue : le vendeur peut saisir dans une devise étrangère,
 * le client ne voit jamais que le montant en F CFA (XOF).
 *
 * Produits existants sans `priceCurrency` → traités comme XOF (aucun calcul).
 */

export type ProductPriceCurrency = 'XOF' | 'CNY' | 'USD';

export const PRODUCT_PRICE_CURRENCIES: {
  code: ProductPriceCurrency;
  label: string;
  symbol: string;
  /** Libellé court pour les champs vendeur */
  inputHint: string;
}[] = [
  { code: 'XOF', label: 'XOF (F CFA)', symbol: 'F', inputHint: 'F CFA' },
  { code: 'CNY', label: 'CNY (¥)', symbol: '¥', inputHint: '¥' },
  { code: 'USD', label: 'USD ($)', symbol: '$', inputHint: '$' },
];

/** Taux par défaut (1 unité étrangère → XOF) si `config/exchangeRates` est absent. */
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  XOF: 1,
  CNY: 84.5,
  USD: 610,
};

/** Pas d’ajustement rapide pertinents par devise. Absent = masquer les boutons. */
export const PRICE_ADJUSTMENT_STEPS: Record<
  ProductPriceCurrency,
  { amount: number; label: string }[]
> = {
  XOF: [
    { amount: 500, label: '+500 F' },
    { amount: 1000, label: '+1000 F' },
  ],
  CNY: [
    { amount: 5, label: '+5 ¥' },
    { amount: 10, label: '+10 ¥' },
  ],
  USD: [
    { amount: 5, label: '+5 $' },
    { amount: 10, label: '+10 $' },
  ],
};

export function isProductPriceCurrency(value: unknown): value is ProductPriceCurrency {
  return value === 'XOF' || value === 'CNY' || value === 'USD';
}

export function parseProductPriceCurrency(value: unknown): ProductPriceCurrency {
  if (typeof value === 'string') {
    const code = value.trim().toUpperCase();
    if (isProductPriceCurrency(code)) return code;
  }
  return 'XOF';
}

export function getCurrencyMeta(code: ProductPriceCurrency) {
  return (
    PRODUCT_PRICE_CURRENCIES.find((c) => c.code === code) ||
    PRODUCT_PRICE_CURRENCIES[0]
  );
}

export function getRateToXOF(
  currency: string | undefined | null,
  rates: Record<string, number> | undefined | null,
): number {
  const code = (currency || 'XOF').toUpperCase();
  if (code === 'XOF') return 1;
  const fromDoc = rates?.[code];
  if (typeof fromDoc === 'number' && Number.isFinite(fromDoc) && fromDoc > 0) {
    return fromDoc;
  }
  const fallback = DEFAULT_EXCHANGE_RATES[code];
  return typeof fallback === 'number' && fallback > 0 ? fallback : 1;
}

/**
 * Conversion vers F CFA.
 * XOF : retourne le montant tel quel, aucun calcul (comportement historique).
 */
export function convertToXOF(
  amount: number,
  currency: string | undefined | null,
  rates: Record<string, number> | undefined | null,
): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const code = (currency || 'XOF').toUpperCase();
  if (code === 'XOF') return n;
  return Math.round(n * getRateToXOF(code, rates));
}

type PriceSource = {
  priceXOF?: unknown;
  priceXof?: unknown;
  price?: unknown;
} | null | undefined;

/**
 * Prix affiché au client : uniquement le montant XOF.
 * Jamais `priceOriginal` (montant saisi par le vendeur dans sa devise).
 * Fallback : `price` des documents existants (déjà en F CFA).
 */
export function getClientPriceXOF(source: PriceSource): number {
  if (!source) return 0;
  const explicit = source.priceXOF ?? source.priceXof;
  const explicitNum = Number(explicit);
  if (explicit != null && Number.isFinite(explicitNum)) return explicitNum;
  const fallback = Number(source.price);
  return Number.isFinite(fallback) ? fallback : 0;
}

export type CatalogPriceFields = {
  /** Prix de vente client — toujours XOF (champ historique, inchangé pour XOF). */
  price: number;
  basePrice: number;
  originalPrice: number | null;
  currency: 'XOF';
  priceAdjustment: number;
  priceOriginal: number;
  priceCurrency: ProductPriceCurrency;
  priceXOF: number;
  exchangeRateUsed: number;
  originalPriceOriginal: number | null;
};

/**
 * Champs prix à persister sur le document produit.
 * Pour XOF : `price`, `basePrice`, `originalPrice`, `currency`, `priceAdjustment`
 * sont strictement identiques à l’existant ; les nouveaux champs s’ajoutent à côté.
 */
export function buildCatalogPriceFields(input: {
  basePrice: number;
  finalPrice: number;
  originalPriceInput: number | null;
  priceAdjustment: number;
  priceCurrency: ProductPriceCurrency;
  rates: Record<string, number>;
}): CatalogPriceFields {
  const currency = parseProductPriceCurrency(input.priceCurrency);
  const priceOriginal = Number(input.finalPrice) || 0;
  const priceXOF = convertToXOF(priceOriginal, currency, input.rates);
  const originalPriceOriginal =
    input.originalPriceInput != null && Number.isFinite(input.originalPriceInput)
      ? input.originalPriceInput
      : null;
  const originalPriceXOF =
    originalPriceOriginal != null
      ? convertToXOF(originalPriceOriginal, currency, input.rates)
      : null;

  return {
    price: priceXOF,
    basePrice: input.basePrice,
    originalPrice: originalPriceXOF,
    currency: 'XOF',
    priceAdjustment: input.priceAdjustment,
    priceOriginal,
    priceCurrency: currency,
    priceXOF,
    exchangeRateUsed: getRateToXOF(currency, input.rates),
    originalPriceOriginal,
  };
}
