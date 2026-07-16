/**
 * Évite les doublons visuels quand Firestore contient la même ligne deux fois
 * (ex. fusion panier + webhook, ou items + lineItems identiques).
 */

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

/**
 * Fusionne les lignes qui représentent le même produit (même productId ou même nom+variante).
 */
export function dedupeOrderLineItems(items: unknown[]): unknown[] {
  const byKey = new Map<string, Record<string, unknown>>();

  items.forEach((raw, index) => {
    const it = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const pid = String(it.productId ?? it.product_id ?? "").trim();
    const lineId = String(it.id ?? it.cartId ?? "").trim();
    const name = String(it.name ?? it.productName ?? it.title ?? "").trim();
    const variant = [it.size, it.color, it.sku]
      .map((x) => (x != null ? String(x) : ""))
      .filter(Boolean)
      .join("|");

    let key = pid || lineId;
    if (!key && name) key = `${name}|${variant}`;
    if (!key) key = `line-${index}`;

    const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
    const price = Number(it.price ?? it.unitPrice ?? 0) || 0;

    if (byKey.has(key)) {
      const ex = byKey.get(key)!;
      ex.quantity = Number(ex.quantity ?? 0) + qty;
      if ((Number(ex.price) || 0) === 0 && price > 0) ex.price = price;
      if (!ex.image && it.image) ex.image = it.image;
      if (!ex.imageUrl && it.imageUrl) ex.imageUrl = it.imageUrl;
    } else {
      byKey.set(key, { ...it, quantity: qty, price });
    }
  });

  return Array.from(byKey.values());
}
