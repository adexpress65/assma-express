import type { ShippingMethodType, ShippingOption } from '../types/order';

const FALLBACK = 'Non spécifié';

export const SHIPPING_METHOD_LABELS: Record<string, string> = {
  free_shipping: 'Livraison Offerte',
  vol_express: 'Vol Express',
  vol_cargo: 'Vol Cargo',
  voie_maritime: 'Voie Maritime',
};

/** Retire emojis / symboles pour un libellé stockable et affichable de façon stable. */
export function stripShippingLabelNoise(value: string): string {
  return String(value || '')
    // Emojis courants des cartes checkout + plages BMP / complémentaire (compat Hermes)
    .replace(/[🎁✈️🚢🎉]/g, '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2600-\u27BF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Libellé canonique à partir d'un id technique (vol_express → Vol Express). */
export function getShippingMethodLabel(
  methodId?: string | null,
  fallbackName?: string | null,
): string {
  const id = String(methodId || '').trim();
  if (id && SHIPPING_METHOD_LABELS[id]) return SHIPPING_METHOD_LABELS[id];

  const cleaned = stripShippingLabelNoise(String(fallbackName || ''));
  if (cleaned) return cleaned;

  if (id && !['Standard', 'standard'].includes(id)) {
    return id.replace(/_/g, ' ');
  }
  return '';
}

/** Normalise le type métier (air / cargo / maritime / free). */
export function resolveShippingMethodType(
  methodId?: string | null,
  optionType?: string | null,
): ShippingMethodType | undefined {
  const id = String(methodId || '').trim();
  if (id === 'vol_cargo') return 'cargo';
  if (id === 'voie_maritime') return 'maritime';
  if (id === 'free_shipping') return 'free';
  if (id === 'vol_express') return 'air';
  const t = String(optionType || '').trim();
  if (t === 'sea') return 'maritime';
  if (t === 'free' || t === 'air' || t === 'cargo' || t === 'maritime') return t;
  return t || undefined;
}

export function buildShippingMethodFields(selection: {
  method: string;
  option: Pick<ShippingOption, 'name' | 'deliveryTime' | 'type' | 'id'>;
}) {
  const methodId = String(selection.method || selection.option.id || '').trim();
  const delay = String(selection.option.deliveryTime || '').trim();
  const type = resolveShippingMethodType(methodId, selection.option.type);
  const name = getShippingMethodLabel(methodId, selection.option.name);
  return {
    shippingMethod: methodId,
    shippingMethodName: name,
    shippingMethodDelay: delay,
    shippingEstimatedDays: delay,
    shippingMethodType: type,
  };
}

export type ResolvedOrderShippingMethod = {
  name: string;
  delay: string;
  type?: string;
  methodId?: string;
  /** true si au moins un champ utile a été trouvé */
  isSpecified: boolean;
};

/**
 * Lit le mode de transport depuis un document commande (schémas anciens et nouveaux).
 */
export function resolveOrderShippingMethod(
  order: Record<string, unknown> | null | undefined,
): ResolvedOrderShippingMethod {
  if (!order || typeof order !== 'object') {
    return { name: FALLBACK, delay: FALLBACK, isSpecified: false };
  }

  const shipping = (order.shipping && typeof order.shipping === 'object'
    ? (order.shipping as Record<string, unknown>)
    : null) as Record<string, unknown> | null;
  const option =
    shipping?.option && typeof shipping.option === 'object'
      ? (shipping.option as Record<string, unknown>)
      : null;

  const methodId = String(
    order.shippingMethod ||
      shipping?.method ||
      option?.id ||
      '',
  ).trim();

  let name = getShippingMethodLabel(
    methodId,
    String(order.shippingMethodName || option?.name || ''),
  );

  if (!name && typeof shipping?.details === 'string') {
    const details = stripShippingLabelNoise(shipping.details);
    if (details) {
      name = details.split(' - ')[0]?.trim() || details;
    }
  }

  let delay = String(
    order.shippingMethodDelay ||
      order.shippingEstimatedDays ||
      option?.deliveryTime ||
      '',
  ).trim();

  if (!delay && typeof shipping?.details === 'string') {
    const parts = shipping.details.split(' - ');
    if (parts.length > 1) delay = parts.slice(1).join(' - ').trim();
  }

  // Ne jamais afficher "Non spécifié" comme délai utile
  if (!delay || delay === FALLBACK) delay = '';

  const type = resolveShippingMethodType(
    methodId,
    String(order.shippingMethodType || option?.type || ''),
  );

  const isSpecified = Boolean(name);
  return {
    name: name || FALLBACK,
    delay,
    type,
    methodId: methodId || undefined,
    isSpecified,
  };
}

export function shippingMethodIcon(type?: string): string {
  if (type === 'maritime' || type === 'sea') return '🚢';
  if (type === 'free') return '🎁';
  return '✈️';
}
