/**
 * Évite les doublons visuels quand Firestore contient la même ligne deux fois
 * (ex. fusion panier + webhook, ou items + lineItems identiques).
 *
 * Ne fusionne JAMAIS deux déclinaisons distinctes (couleur / taille différentes)
 * d'un même produit : 3× Noir 39 et 5× Blanc 40 restent deux lignes.
 */

import {
  getOrderItemColor,
  getOrderItemSize,
  getOrderItemVariantLines,
  getOrderLineDedupeKey,
} from "./orderItemVariants";

export function pickOrderItemsArray(data: Record<string, unknown>): unknown[] {
  const orderData = data.orderData;
  const nested =
    orderData && typeof orderData === "object" && !Array.isArray(orderData)
      ? (orderData as Record<string, unknown>).items
      : undefined;

  const candidates: unknown[] = [
    data.items,
    data.lineItems,
    data.orderItems,
    nested,
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  return [];
}

function mergeVariantLines(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): void {
  const merged = [
    ...getOrderItemVariantLines(existing),
    ...getOrderItemVariantLines(incoming),
  ];
  const byVariant = new Map<string, { color: string; size: string; quantity: number }>();
  for (const line of merged) {
    const key = `${line.color || "NS"}|${line.size || "NS"}`;
    const prev = byVariant.get(key);
    if (prev) prev.quantity += line.quantity;
    else byVariant.set(key, { ...line });
  }
  existing.variantLines = Array.from(byVariant.values());
}

/**
 * Fusionne uniquement les vraies copies (même produit ET même combinaison couleur+taille).
 */
export function dedupeOrderLineItems(items: unknown[]): unknown[] {
  const byKey = new Map<string, Record<string, unknown>>();

  items.forEach((raw, index) => {
    const it = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const key = getOrderLineDedupeKey(it, index);
    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const price = Number(it.price ?? it.unitPrice ?? 0) || 0;
    const color = getOrderItemColor(it) || null;
    const size = getOrderItemSize(it) || null;

    if (byKey.has(key)) {
      const ex = byKey.get(key)!;
      ex.quantity = Number(ex.quantity ?? 0) + qty;
      if ((Number(ex.price) || 0) === 0 && price > 0) ex.price = price;
      if (!ex.image && it.image) ex.image = it.image;
      if (!ex.imageUrl && it.imageUrl) ex.imageUrl = it.imageUrl;
      mergeVariantLines(ex, { ...it, quantity: qty });
    } else {
      const variantLines = getOrderItemVariantLines({ ...it, quantity: qty });
      byKey.set(key, {
        ...it,
        quantity: qty,
        price,
        selectedColor: it.selectedColor ?? color,
        selectedSize: it.selectedSize ?? size,
        color: it.color ?? color,
        size: it.size ?? size,
        variantLines,
      });
    }
  });

  return Array.from(byKey.values());
}
