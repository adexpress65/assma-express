// apps/mobile/src/constants/Config.ts
import { COLORS } from './Theme';

export const DELIVERY_MODES = ['pickup', 'home', 'unknown'] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const DELIVERY_MODE_UNCONFIRMED_MESSAGE =
  'Mode de livraison non renseigné, à confirmer avec le client.';

/** Chaîne logistique commune jusqu'à l'entrepôt. */
export const FULFILLMENT_SHARED_CHAIN = [
  'prise_en_charge',
  'preparation',
  'route_entrepot',
  'transit_international',
  'arrivee_entrepot',
] as const;

export const FULFILLMENT_PICKUP_TAIL = ['pret_retrait', 'recupere'] as const;
export const FULFILLMENT_HOME_TAIL = ['en_livraison', 'livre'] as const;

/** Legacy : commandes migrées avant la branche retrait/domicile. */
export const FULFILLMENT_LEGACY_TERMINAL = 'termine' as const;

/** Toutes les valeurs valides (y compris termine historique). */
export const FULFILLMENT_STATUS_CHAIN = [
  ...FULFILLMENT_SHARED_CHAIN,
  ...FULFILLMENT_PICKUP_TAIL,
  ...FULFILLMENT_HOME_TAIL,
  FULFILLMENT_LEGACY_TERMINAL,
] as const;

export type FulfillmentStatus = (typeof FULFILLMENT_STATUS_CHAIN)[number];

/**
 * Mapping de migration / repli UI : ancien `status` mixte → fulfillmentStatus.
 * pending / cancelled / failed : pas de logistique.
 * `delivered` reste `termine` (pas de rétro-écriture vers recupere/livre).
 */
export const LEGACY_STATUS_TO_FULFILLMENT: Record<string, FulfillmentStatus> = {
  paid: 'prise_en_charge',
  confirmed: 'prise_en_charge',
  processing: 'preparation',
  shipped: 'arrivee_entrepot',
  delivered: 'termine',
};

/** Onglets / badges logistique. */
export const ORDER_STATUS_CONFIG = {
  prise_en_charge: {
    label: 'Prise en charge',
    color: COLORS.primary,
    icon: 'cube-outline' as const,
    bgColor: 'rgba(255, 106, 0, 0.1)',
    nextAction: 'Passer en préparation',
  },
  preparation: {
    label: 'En cours de préparation',
    color: COLORS.info,
    icon: 'cog-outline' as const,
    bgColor: 'rgba(23, 162, 184, 0.1)',
    nextAction: "En route vers l'entrepôt",
  },
  route_entrepot: {
    label: "En route vers l'entrepôt",
    color: '#2563EB',
    icon: 'car-outline' as const,
    bgColor: 'rgba(37, 99, 235, 0.1)',
    nextAction: 'Transit international',
  },
  transit_international: {
    label: 'Transit international',
    color: '#7C3AED',
    icon: 'airplane-outline' as const,
    bgColor: 'rgba(124, 58, 237, 0.12)',
    nextAction: "Arrivée à l'entrepôt",
  },
  arrivee_entrepot: {
    label: "Arrivée à l'entrepôt",
    color: '#0F766E',
    icon: 'business-outline' as const,
    bgColor: 'rgba(15, 118, 110, 0.1)',
  },
  pret_retrait: {
    label: 'Prêt au retrait',
    color: '#D97706',
    icon: 'storefront-outline' as const,
    bgColor: 'rgba(217, 119, 6, 0.12)',
    nextAction: 'Marquer comme récupéré',
  },
  recupere: {
    label: 'Récupéré',
    color: COLORS.success,
    icon: 'checkmark-done-outline' as const,
    bgColor: 'rgba(40, 167, 69, 0.1)',
  },
  en_livraison: {
    label: 'En livraison',
    color: '#2563EB',
    icon: 'bicycle-outline' as const,
    bgColor: 'rgba(37, 99, 235, 0.1)',
    nextAction: 'Marquer comme livré',
  },
  livre: {
    label: 'Livré',
    color: COLORS.success,
    icon: 'home-outline' as const,
    bgColor: 'rgba(40, 167, 69, 0.1)',
  },
  termine: {
    label: 'Avis',
    color: '#7C3AED',
    icon: 'star-outline' as const,
    bgColor: 'rgba(124, 58, 237, 0.12)',
  },
} as const;

/** Avis : nouveaux terminaux + termine historique (non rétro-migré). */
export const REVIEW_FULFILLMENT_STATUSES: readonly FulfillmentStatus[] = [
  'recupere',
  'livre',
  'termine',
];

export function isDeliveryMode(value: unknown): value is DeliveryMode {
  return value === 'pickup' || value === 'home' || value === 'unknown';
}

export function isChosenDeliveryMode(value: unknown): value is 'pickup' | 'home' {
  return value === 'pickup' || value === 'home';
}

export function normalizeDeliveryMode(value: unknown): DeliveryMode | undefined {
  const s = String(value ?? '').toLowerCase().trim();
  if (s === 'pickup' || s === 'retrait') return 'pickup';
  if (s === 'home' || s === 'domicile' || s === 'delivery') return 'home';
  if (s === 'unknown') return 'unknown';
  return undefined;
}

/** Pas de branche finale tant que pickup/home n'est pas confirmé. */
export function isDeliveryModeUnconfirmed(value: unknown): boolean {
  const mode = normalizeDeliveryMode(value);
  return mode !== 'pickup' && mode !== 'home';
}

/** Filet OTA : commande créée sans choix (deliveryMode=unknown / clientOutdated). */
export function shouldConfirmDeliveryMode(data: {
  deliveryMode?: unknown;
  clientOutdated?: unknown;
}): boolean {
  return (
    normalizeDeliveryMode(data.deliveryMode) === 'unknown' ||
    data.clientOutdated === true
  );
}

export function isFulfillmentStatus(value: unknown): value is FulfillmentStatus {
  return (FULFILLMENT_STATUS_CHAIN as readonly string[]).includes(String(value));
}

export function isReviewFulfillmentStatus(value: unknown): boolean {
  return (REVIEW_FULFILLMENT_STATUSES as readonly string[]).includes(String(value));
}

function chainForDeliveryMode(deliveryMode?: DeliveryMode | null): FulfillmentStatus[] {
  const chain: FulfillmentStatus[] = [...FULFILLMENT_SHARED_CHAIN];
  if (deliveryMode === 'pickup') chain.push(...FULFILLMENT_PICKUP_TAIL);
  else if (deliveryMode === 'home') chain.push(...FULFILLMENT_HOME_TAIL);
  return chain;
}

export function nextFulfillmentStatus(
  current: FulfillmentStatus | undefined | null,
  deliveryMode?: unknown,
): FulfillmentStatus | undefined {
  if (!current || current === 'termine' || current === 'recupere' || current === 'livre') {
    return undefined;
  }
  const mode = normalizeDeliveryMode(deliveryMode);
  const chain = chainForDeliveryMode(mode);
  const i = chain.indexOf(current);
  if (i < 0 || i >= chain.length - 1) return undefined;
  return chain[i + 1];
}

export function deliveryModeLabel(value: unknown): string | undefined {
  const mode = normalizeDeliveryMode(value);
  if (mode === 'pickup') return "Retrait à l'entrepôt";
  if (mode === 'home') return 'Livraison à domicile';
  if (mode === 'unknown') return DELIVERY_MODE_UNCONFIRMED_MESSAGE;
  return undefined;
}

/** Libellé du bouton « passer à l'étape suivante » (branche pickup/home à l'entrepôt). */
export function fulfillmentAdvanceLabel(
  current: FulfillmentStatus | undefined | null,
  next: FulfillmentStatus,
): string {
  if (current && current in ORDER_STATUS_CONFIG) {
    const ui = ORDER_STATUS_CONFIG[current];
    if ('nextAction' in ui && ui.nextAction) return ui.nextAction;
  }
  if (next === 'pret_retrait') return 'Marquer prêt au retrait';
  if (next === 'en_livraison') return 'Mettre en livraison';
  return getFulfillmentUi(next).label;
}

/** Champ persisté s'il est valide, sinon approximation depuis l'ancien status. */
export function resolveFulfillmentStatus(data: {
  fulfillmentStatus?: unknown;
  status?: unknown;
}): FulfillmentStatus | undefined {
  if (isFulfillmentStatus(data.fulfillmentStatus)) {
    return data.fulfillmentStatus;
  }
  const legacy = String(data.status ?? '').toLowerCase().trim();
  return LEGACY_STATUS_TO_FULFILLMENT[legacy];
}

export function getFulfillmentUi(status: FulfillmentStatus | undefined) {
  if (status && status in ORDER_STATUS_CONFIG) {
    return ORDER_STATUS_CONFIG[status];
  }
  return ORDER_STATUS_CONFIG.prise_en_charge;
}

export const APP_CONFIG = {
  supportPhone: '+22370000000', // Remplace par ton vrai numéro Mali
  supportWhatsApp: '+22370000000',
  /** Contact pour litiges / annulation côté acheteur B2B */
  supportEmail: 'support@a2-expres.com',
  currency: 'FCFA',
  defaultShippingCost: 2000,
  /**
   * URL de suivi colis (optionnel). Si vide, seul le numéro est affiché (pas d’URL factice).
   * Exemple : https://exemple-transporteur.com/track?num=
   */
  shippingTrackingUrlBase: '' as string,
};
