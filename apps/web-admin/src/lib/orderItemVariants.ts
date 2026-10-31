/**
 * Variantes d'une ligne de commande (couleur + taille + quantité).
 */

export type OrderVariantLine = {
  color: string;
  size: string;
  quantity: number;
};

const EMPTY_MARKERS = new Set(["", "ns", "n/a", "na", "undefined", "null", "-"]);

export function pickNonEmptyStr(...values: unknown[]): string {
  for (const value of values) {
    if (value == null) continue;
    const s = String(value).trim();
    if (!s) continue;
    if (EMPTY_MARKERS.has(s.toLowerCase())) continue;
    return s;
  }
  return "";
}

export function getOrderItemColor(item: Record<string, unknown>): string {
  return pickNonEmptyStr(
    item.selectedColor,
    item.color,
    item.colour,
    item.variantColor,
  );
}

export function getOrderItemSize(item: Record<string, unknown>): string {
  return pickNonEmptyStr(item.selectedSize, item.size, item.variantSize);
}

function normalizeNestedVariant(raw: unknown): OrderVariantLine | null {
  if (!raw || typeof raw !== "object") return null;
  const it = raw as Record<string, unknown>;
  const quantity = Number(it.quantity ?? it.qty ?? 0);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return {
    color: getOrderItemColor(it),
    size: getOrderItemSize(it),
    quantity: Math.floor(quantity),
  };
}

export function getOrderItemVariantLines(
  item: Record<string, unknown>,
): OrderVariantLine[] {
  const nestedCandidates = [
    item.variantLines,
    item.variants,
    item.selectedVariants,
    item.variantBreakdown,
    item.selections,
  ];
  for (const raw of nestedCandidates) {
    if (!Array.isArray(raw) || raw.length === 0) continue;
    const nested = raw
      .map(normalizeNestedVariant)
      .filter((line): line is OrderVariantLine => line != null);
    if (nested.length > 0) return nested;
  }

  const fallbackQty = Number(item.quantity ?? item.qty ?? 1);
  return [
    {
      color: getOrderItemColor(item),
      size: getOrderItemSize(item),
      quantity:
        Number.isFinite(fallbackQty) && fallbackQty > 0
          ? Math.floor(fallbackQty)
          : 1,
    },
  ];
}

export function formatVariantAttrs(
  line: Pick<OrderVariantLine, "color" | "size">,
): string {
  const parts: string[] = [];
  if (line.color) parts.push(line.color);
  if (line.size) parts.push(`Taille: ${line.size}`);
  return parts.join(" · ");
}

export function formatVariantQuantityLine(
  productName: string,
  line: OrderVariantLine,
  options?: { includeName?: boolean },
): string {
  const qty = line.quantity > 0 ? line.quantity : 1;
  const attrs = formatVariantAttrs(line);
  const includeName = options?.includeName !== false;
  const name = productName.trim() || "Produit";
  if (!includeName) {
    return attrs ? `${qty} × ${attrs}` : `${qty} ×`;
  }
  return attrs ? `${qty} × ${name} — ${attrs}` : `${qty} × ${name}`;
}

export function hasVisibleVariantAttrs(lines: OrderVariantLine[]): boolean {
  return lines.length > 1 || lines.some((line) => Boolean(line.color || line.size));
}

export function getOrderLineStableKey(
  item: Record<string, unknown>,
  index: number,
): string {
  const cartId = pickNonEmptyStr(item.cartId);
  const productId = pickNonEmptyStr(item.productId, item.product_id);
  const lineId = pickNonEmptyStr(item.id);
  const name = pickNonEmptyStr(item.name, item.productName, item.title);
  const color = getOrderItemColor(item);
  const size = getOrderItemSize(item);
  return [cartId || lineId || productId || name || "line", color, size, String(index)].join(
    "|",
  );
}
