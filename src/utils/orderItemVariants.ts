/**
 * Variantes d'une ligne de commande (couleur + taille + quantité).
 * Une déclinaison distincte doit toujours rester visible : jamais seulement la première.
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
  return pickNonEmptyStr(
    item.selectedSize,
    item.size,
    item.variantSize,
  );
}

function readNestedVariantArrays(item: Record<string, unknown>): unknown[] {
  const candidates = [
    item.variantLines,
    item.variants,
    item.selectedVariants,
    item.variantBreakdown,
    item.selections,
    item.matrixItems,
  ];
  for (const raw of candidates) {
    if (Array.isArray(raw) && raw.length > 0) return raw;
  }
  return [];
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

/** Toutes les déclinaisons d'une ligne (tableau imbriqué ou variante unique). */
export function getOrderItemVariantLines(
  item: Record<string, unknown>,
): OrderVariantLine[] {
  const nested = readNestedVariantArrays(item)
    .map(normalizeNestedVariant)
    .filter((line): line is OrderVariantLine => line != null);

  if (nested.length > 0) return nested;

  const fallbackQty = Number(item.quantity ?? item.qty ?? 1);
  return [
    {
      color: getOrderItemColor(item),
      size: getOrderItemSize(item),
      quantity: Number.isFinite(fallbackQty) && fallbackQty > 0
        ? Math.floor(fallbackQty)
        : 1,
    },
  ];
}

export function formatVariantAttrs(line: Pick<OrderVariantLine, "color" | "size">): string {
  const parts: string[] = [];
  if (line.color) parts.push(line.color);
  if (line.size) parts.push(`Taille: ${line.size}`);
  return parts.join(" • ");
}

/** Ex. `3 × Teste chaussures — Noir • Taille: 39` */
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
  const sku = pickNonEmptyStr(item.sku, item.variantId);
  return [cartId || lineId || productId || name || "line", color, size, sku, String(index)]
    .join("|");
}

/** Clé de déduplication : produit + couleur + taille (jamais le produit seul). */
export function getOrderLineDedupeKey(
  item: Record<string, unknown>,
  index: number,
): string {
  const lines = getOrderItemVariantLines(item);
  const productId = pickNonEmptyStr(item.productId, item.product_id);
  const cartId = pickNonEmptyStr(item.cartId);
  const lineId = pickNonEmptyStr(item.id);
  const name = pickNonEmptyStr(item.name, item.productName, item.title);
  const sku = pickNonEmptyStr(item.sku, item.variantId);
  const productKey = productId || name || cartId || lineId || `line-${index}`;

  if (lines.length > 1) {
    const breakdown = lines
      .map((line) => `${line.color || "NS"}:${line.size || "NS"}:${line.quantity}`)
      .join(",");
    return `grouped|${productKey}|${cartId || lineId || index}|${breakdown}`;
  }

  const line = lines[0];
  const color = line?.color || getOrderItemColor(item) || "NS";
  const size = line?.size || getOrderItemSize(item) || "NS";
  return `${productKey}|${color}|${size}|${sku || ""}`;
}

export function buildCartLineId(
  productId: string,
  size?: string | null,
  color?: string | null,
): string {
  return `${productId}-${size || "NS"}-${color || "NS"}`;
}

export function buildPersistedVariantLines(
  color: string | null | undefined,
  size: string | null | undefined,
  quantity: number,
): Array<{ color: string | null; size: string | null; quantity: number }> {
  return [
    {
      color: color ?? null,
      size: size ?? null,
      quantity,
    },
  ];
}
