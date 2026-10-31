/**
 * Lecture seule du stock produit.
 * Ne calcule / n'écrit rien : reprend le mapping déjà utilisé par productsService.
 */

/** Aligné sur le détail produit (`item.stock > 10` = en stock vs stock faible). */
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;

export type StockStatusKey = "out" | "low" | "ok";

export type ProductStockRow = {
  id: string;
  name: string;
  stock: number;
  unlimitedStock: boolean;
  companyId: string;
  companyName: string;
  mainImage?: string;
};

export function readUnlimitedStock(
  data: Record<string, unknown> | undefined,
): boolean {
  return data?.unlimitedStock === true;
}

export function readProductStock(data: Record<string, unknown> | undefined): number {
  if (!data) return 0;
  const raw = data.stockQuantity ?? data.stock;
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function getStockStatus(
  stock: number,
  threshold: number = DEFAULT_LOW_STOCK_THRESHOLD,
  unlimitedStock: boolean = false,
): StockStatusKey {
  if (unlimitedStock) return "ok";
  if (stock <= 0) return "out";
  if (stock < threshold) return "low";
  return "ok";
}

export function mapProductStockDoc(
  id: string,
  data: Record<string, unknown>,
): ProductStockRow {
  const images = Array.isArray(data.images) ? data.images : [];
  const mainImage =
    (typeof data.mainImage === "string" && data.mainImage) ||
    (typeof data.imageUrl === "string" && data.imageUrl) ||
    (typeof data.image === "string" && data.image) ||
    (typeof images[0] === "string" ? images[0] : undefined);

  const companyName =
    (typeof data.companyName === "string" && data.companyName) ||
    (typeof data.supplier === "string" && data.supplier) ||
    (typeof data.sellerName === "string" && data.sellerName) ||
    "";

  return {
    id,
    name: typeof data.name === "string" && data.name ? data.name : "Sans nom",
    stock: readProductStock(data),
    unlimitedStock: readUnlimitedStock(data),
    companyId: String(data.companyId || data.sellerId || data.supplierId || ""),
    companyName,
    mainImage,
  };
}

export function sortByStockAsc(rows: ProductStockRow[]): ProductStockRow[] {
  return [...rows].sort((a, b) => {
    if (a.unlimitedStock !== b.unlimitedStock) {
      return a.unlimitedStock ? 1 : -1;
    }
    return a.stock - b.stock || a.name.localeCompare(b.name, "fr");
  });
}
