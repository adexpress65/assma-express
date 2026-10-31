export type AdminOrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "failed";

export const FULFILLMENT_SHARED_CHAIN = [
  "prise_en_charge",
  "preparation",
  "route_entrepot",
  "transit_international",
  "arrivee_entrepot",
] as const;

export const FULFILLMENT_PICKUP_TAIL = ["pret_retrait", "recupere"] as const;
export const FULFILLMENT_HOME_TAIL = ["en_livraison", "livre"] as const;

export const FULFILLMENT_STATUS_CHAIN = [
  ...FULFILLMENT_SHARED_CHAIN,
  ...FULFILLMENT_PICKUP_TAIL,
  ...FULFILLMENT_HOME_TAIL,
  "termine",
] as const;

export type FulfillmentStatus = (typeof FULFILLMENT_STATUS_CHAIN)[number];
export type DeliveryMode = "pickup" | "home" | "unknown";

const LEGACY_STATUS_TO_FULFILLMENT: Record<string, FulfillmentStatus> = {
  paid: "prise_en_charge",
  confirmed: "prise_en_charge",
  processing: "preparation",
  shipped: "arrivee_entrepot",
  delivered: "termine",
};

const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  prise_en_charge: "Prise en charge",
  preparation: "En cours de préparation",
  route_entrepot: "En route vers l'entrepôt",
  transit_international: "Transit international",
  arrivee_entrepot: "Arrivée à l'entrepôt",
  pret_retrait: "Prêt au retrait",
  recupere: "Récupéré",
  en_livraison: "En livraison",
  livre: "Livré",
  termine: "Terminé",
};

export function isFulfillmentStatus(value: unknown): value is FulfillmentStatus {
  return (FULFILLMENT_STATUS_CHAIN as readonly string[]).includes(String(value));
}

export function normalizeDeliveryMode(value: unknown): DeliveryMode | undefined {
  const s = String(value ?? "").toLowerCase().trim();
  if (s === "pickup" || s === "retrait") return "pickup";
  if (s === "home" || s === "domicile" || s === "delivery") return "home";
  if (s === "unknown") return "unknown";
  return undefined;
}

export const DELIVERY_MODE_UNCONFIRMED_MESSAGE =
  "Mode de livraison non renseigné, à confirmer avec le client.";

export function isDeliveryModeUnconfirmed(value: unknown): boolean {
  const mode = normalizeDeliveryMode(value);
  return mode !== "pickup" && mode !== "home";
}

export function shouldConfirmDeliveryMode(data: {
  deliveryMode?: unknown;
  clientOutdated?: unknown;
}): boolean {
  return (
    normalizeDeliveryMode(data.deliveryMode) === "unknown" ||
    data.clientOutdated === true
  );
}

export function nextFulfillmentStatus(
  current: FulfillmentStatus | undefined | null,
  deliveryMode?: unknown,
): FulfillmentStatus | undefined {
  if (!current || current === "termine" || current === "recupere" || current === "livre") {
    return undefined;
  }
  const mode = normalizeDeliveryMode(deliveryMode);
  const chain: FulfillmentStatus[] = [...FULFILLMENT_SHARED_CHAIN];
  if (mode === "pickup") chain.push(...FULFILLMENT_PICKUP_TAIL);
  else if (mode === "home") chain.push(...FULFILLMENT_HOME_TAIL);
  const i = chain.indexOf(current);
  if (i < 0 || i >= chain.length - 1) return undefined;
  return chain[i + 1];
}

export function deliveryModeLabel(value: unknown): string | undefined {
  const mode = normalizeDeliveryMode(value);
  if (mode === "pickup") return "Retrait à l'entrepôt";
  if (mode === "home") return "Livraison à domicile";
  if (mode === "unknown") return DELIVERY_MODE_UNCONFIRMED_MESSAGE;
  return undefined;
}

export function resolveFulfillmentStatus(data: {
  fulfillmentStatus?: unknown;
  status?: unknown;
}): FulfillmentStatus | undefined {
  if (isFulfillmentStatus(data.fulfillmentStatus)) return data.fulfillmentStatus;
  const legacy = String(data.status ?? "").toLowerCase().trim();
  return LEGACY_STATUS_TO_FULFILLMENT[legacy];
}

export function fulfillmentStatusLabel(status: FulfillmentStatus): string {
  return FULFILLMENT_LABELS[status];
}

const NEXT: Partial<Record<AdminOrderStatus, AdminOrderStatus>> = {
  pending: "confirmed",
  confirmed: "processing",
  processing: "shipped",
  shipped: "delivered",
};

const LABELS: Record<AdminOrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  failed: "Échouée",
};

export function normalizeOrderStatus(raw: unknown): AdminOrderStatus {
  const s = String(raw ?? "pending")
    .toLowerCase()
    .trim();
  if (s === "paid") return "confirmed";
  if (s in LABELS) return s as AdminOrderStatus;
  return "pending";
}

export function orderStatusLabel(status: AdminOrderStatus): string {
  return LABELS[status];
}

export function nextOrderStatus(
  status: AdminOrderStatus,
): AdminOrderStatus | undefined {
  return NEXT[status];
}

export function isPaymentConfirmed(data: Record<string, unknown>): boolean {
  const paidAt = data.paidAt;
  if (paidAt != null) {
    if (typeof paidAt === "object" && paidAt !== null && "toDate" in paidAt) {
      return true;
    }
    if (paidAt instanceof Date) return true;
  }
  const ps = String(data.paymentStatus ?? data.paymentState ?? "")
    .toLowerCase()
    .trim();
  return ["paid", "completed", "success", "succeeded", "captured", "paid_out"].includes(
    ps,
  );
}

export function extractOrderItems(raw: Record<string, unknown>): Array<Record<string, unknown>> {
  const nested =
    raw.orderData && typeof raw.orderData === "object" && !Array.isArray(raw.orderData)
      ? (raw.orderData as Record<string, unknown>).items
      : undefined;
  const candidates = [raw.items, raw.lineItems, raw.orderItems, raw.products, raw.lines, nested];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c as Array<Record<string, unknown>>;
  }
  return [];
}

export function formatMoney(amount?: number, currency = "XOF"): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency === "FCFA" ? "XOF" : currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatDate(value: unknown): string {
  if (!value) return "—";
  let d: Date | null = null;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    d = (value as { toDate: () => Date }).toDate();
  } else if (typeof value === "object" && value !== null && "seconds" in value) {
    d = new Date((value as { seconds: number }).seconds * 1000);
  } else if (typeof value === "string" || typeof value === "number") {
    d = new Date(value);
  }
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SHIPPING_METHOD_LABELS: Record<string, string> = {
  free_shipping: "Livraison Offerte",
  vol_express: "Vol Express",
  vol_cargo: "Vol Cargo",
  voie_maritime: "Voie Maritime",
};

function stripShippingLabelNoise(value: string): string {
  return String(value || "")
    .replace(/[🎁✈️🚢🎉]/g, "")
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
    .replace(/[\u2600-\u27BF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getShippingMethodLabel(
  methodId?: string | null,
  fallbackName?: string | null,
): string {
  const id = String(methodId || "").trim();
  if (id && SHIPPING_METHOD_LABELS[id]) return SHIPPING_METHOD_LABELS[id];
  const cleaned = stripShippingLabelNoise(String(fallbackName || ""));
  if (cleaned) return cleaned;
  if (id && !["Standard", "standard"].includes(id)) {
    return id.replace(/_/g, " ");
  }
  return "";
}

export function resolveOrderShippingMethod(order: Record<string, unknown>): {
  name: string;
  delay: string;
  type?: string;
} {
  const FALLBACK = "Non spécifié";
  const shipping =
    order.shipping && typeof order.shipping === "object"
      ? (order.shipping as Record<string, unknown>)
      : null;
  const option =
    shipping?.option && typeof shipping.option === "object"
      ? (shipping.option as Record<string, unknown>)
      : null;

  const methodId = String(
    order.shippingMethod || shipping?.method || option?.id || "",
  ).trim();

  let name = getShippingMethodLabel(
    methodId,
    String(order.shippingMethodName || option?.name || ""),
  );
  if (!name && typeof shipping?.details === "string") {
    const details = stripShippingLabelNoise(shipping.details);
    name = details.split(" - ")[0]?.trim() || details;
  }

  let delay = String(
    order.shippingMethodDelay ||
      order.shippingEstimatedDays ||
      option?.deliveryTime ||
      "",
  ).trim();
  if (!delay && typeof shipping?.details === "string") {
    const parts = shipping.details.split(" - ");
    if (parts.length > 1) delay = parts.slice(1).join(" - ").trim();
  }
  if (!delay || delay === FALLBACK) delay = "";

  let type = String(order.shippingMethodType || option?.type || "").trim();
  if (methodId === "vol_cargo") type = "cargo";
  if (methodId === "voie_maritime" || type === "sea") type = "maritime";
  if (methodId === "free_shipping") type = "free";
  if (methodId === "vol_express") type = "air";

  return {
    name: name || FALLBACK,
    delay,
    type: type || undefined,
  };
}

