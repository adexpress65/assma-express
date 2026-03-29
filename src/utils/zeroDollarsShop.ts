/**
 * Détection de la boutique « Zéro Dollars » (tolère accents / casse / espaces).
 */
export function normalizeShopLabel(s: string | undefined | null): string {
  if (!s || typeof s !== "string") return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Retourne true si le nom de boutique correspond à « Zéro Dollars » ou variantes proches.
 */
export function isZeroDollarsShop(source: {
  companyName?: string | null;
  supplier?: string | null;
  seller?: string | null;
  name?: string | null;
}): boolean {
  const parts = [source.companyName, source.supplier, source.seller, source.name]
    .filter((x) => x != null && String(x).trim() !== "")
    .map((s) => normalizeShopLabel(String(s)));

  return parts.some((n) => {
    if (!n) return false;
    return /(zero|0)\s*dollars?/.test(n) || /\b0\s*dollars?/.test(n);
  });
}

export function isZeroDollarsProduct(source: {
  price?: number | null;
  basePrice?: number | null;
  companyName?: string | null;
  supplier?: string | null;
  seller?: string | null;
  name?: string | null;
}): boolean {
  const byShop = isZeroDollarsShop(source);
  if (!byShop) return false;
  const raw = source.price ?? source.basePrice ?? 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return false;
  return n <= 1;
}
