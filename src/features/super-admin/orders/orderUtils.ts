import type { Timestamp } from "firebase/firestore";

export function firestoreToDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const ts = value as Timestamp;
  if (typeof ts?.toDate === "function") {
    try {
      return ts.toDate();
    } catch {
      return null;
    }
  }
  return null;
}

export function formatAdminOrderDate(value: unknown): string {
  const d = firestoreToDate(value);
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatAdminCurrency(
  amount: number,
  currency: string = "XOF",
): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.length === 3 ? currency : "XOF",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    return `${(Number(amount) || 0).toLocaleString("fr-FR")} ${currency}`;
  }
}

/** Résumé articles / boutiques pour la liste admin (logique type marketplace). */
export type OrderItemsAdminSummary = {
  lineCount: number;
  qtyTotal: number;
  supplierNames: string[];
  /** Ligne courte pour la carte liste */
  displaySuppliers: string;
  searchBlob: string;
};

export type AdminShipping = {
  fullName?: string;
  phone?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  apartment?: string;
  building?: string;
  floor?: string;
  deliveryNote?: string;
};

function tryPickShipping(o: unknown): AdminShipping | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const fullName =
    String(r.fullName || r.name || r.recipientName || "").trim() || undefined;
  const phone =
    String(r.phone || r.phoneNumber || r.mobile || "").trim() || undefined;
  const street =
    String(r.street || r.line1 || r.addressLine1 || "").trim() || undefined;
  const city = String(r.city || "").trim() || undefined;
  const postalCode = String(r.postalCode || r.zip || "").trim() || undefined;
  const country = String(r.country || "").trim() || undefined;
  const apartment =
    String(r.apartment || r.apt || r.unit || "").trim() || undefined;
  const building =
    String(r.building || r.immeuble || "").trim() || undefined;
  const floor = String(r.floor || r.etage || "").trim() || undefined;
  const deliveryNote =
    String(
      r.deliveryNote || r.deliveryNotes || r.notes || r.instructions || "",
    ).trim() || undefined;
  if (fullName || phone || street) {
    return {
      fullName,
      phone,
      street,
      city,
      postalCode,
      country,
      apartment,
      building,
      floor,
      deliveryNote,
    };
  }
  return null;
}

/** Adresse livraison : plusieurs schémas possibles selon le flux checkout / API. */
export function normalizeShippingFromOrder(
  data: Record<string, unknown>,
): AdminShipping {
  return (
    tryPickShipping(data.shippingAddress) ||
    tryPickShipping(data.address) ||
    tryPickShipping(data.deliveryAddress) ||
    tryPickShipping(data.shipping) ||
    {}
  );
}

export function extractOrderItemsArray(data: Record<string, unknown>): unknown[] {
  const orderData = data.orderData;
  const nestedItems =
    orderData && typeof orderData === "object" && !Array.isArray(orderData)
      ? (orderData as Record<string, unknown>).items
      : undefined;

  const candidates: unknown[] = [
    data.items,
    data.lineItems,
    data.orderItems,
    nestedItems,
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

/**
 * Résumé à partir du document commande Firestore (pas seulement `items`).
 */
export function summarizeOrderItemsForAdmin(
  data: Record<string, unknown>,
): OrderItemsAdminSummary {
  const items = extractOrderItemsArray(data);
  const empty: OrderItemsAdminSummary = {
    lineCount: 0,
    qtyTotal: 0,
    supplierNames: [],
    displaySuppliers: "",
    searchBlob: "",
  };
  if (!Array.isArray(items) || items.length === 0) {
    return {
      ...empty,
      displaySuppliers: "Aucun article",
    };
  }

  const rawNames: string[] = [];
  let qtyTotal = 0;

  for (const raw of items) {
    const it = raw as Record<string, unknown>;
    qtyTotal += Number(it.quantity) || 0;
    const label = String(
      it.companyName || it.supplier || it.seller || it.storeName || "",
    )
      .trim()
      .replace(/\s+/g, " ");
    if (label) rawNames.push(label);
  }

  const supplierNames = [...new Set(rawNames)];
  const lineCount = items.length;
  const q = qtyTotal > 0 ? qtyTotal : lineCount;

  let displaySuppliers: string;
  if (supplierNames.length === 0) {
    displaySuppliers = "Fournisseurs non renseignés";
  } else if (supplierNames.length === 1) {
    displaySuppliers = supplierNames[0];
  } else if (supplierNames.length === 2) {
    displaySuppliers = `${supplierNames[0]} · ${supplierNames[1]}`;
  } else {
    displaySuppliers = `${supplierNames[0]} +${supplierNames.length - 1} autres`;
  }

  return {
    lineCount,
    qtyTotal: q,
    supplierNames,
    displaySuppliers,
    searchBlob: supplierNames.join(" ").toLowerCase(),
  };
}

/** Nettoie une URL d’image produit (Storage / caractères invisibles). */

export function getCleanProductImageUrl(item: Record<string, unknown>): string | null {
  const raw =
    item.imageUrl ??
    item.image ??
    item.photoURL ??
    (Array.isArray(item.photos) ? item.photos[0] : undefined);
  let uri = typeof raw === "string" ? raw : null;
  if (!uri) return null;
  try {
    let clean = uri.trim().replace(/[\s\u0000-\u001F\u007F-\u009F\uFEFF]+/g, "");
    if (clean.includes("/products/") && !clean.includes("products%2F")) {
      clean = clean.replace("/products/", "/products%2F");
    }
    return clean;
  } catch {
    return uri;
  }
}
