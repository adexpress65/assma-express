/**
 * Frais d'entrepôt d'origine — uniquement pour les lignes catalogue 0 FCFA (price ≤ 1).
 * Une fois par hub distinct présent dans le panier / commande.
 */

export const WAREHOUSE_FEES_DOC_PATH = "config/warehouseFees" as const;

export const ZERO_FCFA_UNAVAILABLE_MESSAGE =
  "Article temporairement indisponible à la livraison";

export interface WarehouseFeeEntry {
  id: string;
  label: string;
  feeUsd: number;
  active: boolean;
  sortOrder: number;
}

export interface WarehouseFeesConfig {
  currency: "USD";
  usdToXof: number;
  warehouses: WarehouseFeeEntry[];
  updatedAt?: unknown;
  updatedBy?: string | null;
}

export interface WarehouseFeeLine {
  warehouseId: string;
  label: string;
  feeUsd: number;
  feeXof: number;
}

export interface WarehouseFeeBreakdown {
  lines: WarehouseFeeLine[];
  warehouseFeeTotal: number;
}

export const DEFAULT_WAREHOUSE_FEES_CONFIG: WarehouseFeesConfig = {
  currency: "USD",
  usdToXof: 625,
  warehouses: [
    {
      id: "guangzhou",
      label: "Guangzhou",
      feeUsd: 1.9,
      active: true,
      sortOrder: 1,
    },
    {
      id: "yiwu",
      label: "Yiwu",
      feeUsd: 2.3,
      active: true,
      sortOrder: 2,
    },
  ],
};

/** Ligne catalogue « 0 FCFA » (section / feed : price ∈ {0, 1}). */
export function isZeroFcfaCatalogPrice(price: unknown): boolean {
  const n = Number(price);
  return Number.isFinite(n) && n <= 1;
}

export function normalizeWarehouseId(id: unknown): string | null {
  if (id == null) return null;
  const s = String(id).trim().toLowerCase();
  return s.length > 0 ? s : null;
}

export function parseWarehouseFeesConfig(raw: unknown): WarehouseFeesConfig {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const usdToXofRaw = Number(data.usdToXof);
  const usdToXof =
    Number.isFinite(usdToXofRaw) && usdToXofRaw > 0
      ? usdToXofRaw
      : DEFAULT_WAREHOUSE_FEES_CONFIG.usdToXof;

  const list = Array.isArray(data.warehouses) ? data.warehouses : [];
  const warehouses: WarehouseFeeEntry[] = list
    .map((row, index) => {
      const r = (row && typeof row === "object" ? row : {}) as Record<
        string,
        unknown
      >;
      const id = normalizeWarehouseId(r.id);
      if (!id) return null;
      const feeUsd = Number(r.feeUsd);
      return {
        id,
        label: String(r.label || id).trim() || id,
        feeUsd: Number.isFinite(feeUsd) && feeUsd >= 0 ? feeUsd : 0,
        active: r.active !== false,
        sortOrder: Number(r.sortOrder) || index + 1,
      } satisfies WarehouseFeeEntry;
    })
    .filter((x): x is WarehouseFeeEntry => x != null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    currency: "USD",
    usdToXof,
    warehouses:
      warehouses.length > 0
        ? warehouses
        : DEFAULT_WAREHOUSE_FEES_CONFIG.warehouses,
    updatedAt: data.updatedAt,
    updatedBy:
      data.updatedBy != null ? String(data.updatedBy) : null,
  };
}

export function findWarehouse(
  config: WarehouseFeesConfig,
  warehouseId: string | null | undefined,
): WarehouseFeeEntry | null {
  const id = normalizeWarehouseId(warehouseId);
  if (!id) return null;
  return (
    config.warehouses.find((w) => w.id === id && w.active) ??
    config.warehouses.find((w) => w.id === id) ??
    null
  );
}

export function usdToXofAmount(feeUsd: number, usdToXof: number): number {
  const rate =
    Number.isFinite(usdToXof) && usdToXof > 0
      ? usdToXof
      : DEFAULT_WAREHOUSE_FEES_CONFIG.usdToXof;
  const usd = Number(feeUsd);
  if (!Number.isFinite(usd) || usd < 0) return 0;
  return Math.round(usd * rate);
}

export type WarehouseFeeItemLike = {
  price?: number | null;
  originWarehouseId?: string | null;
  originWarehouseLabel?: string | null;
};

/**
 * Un hub = une fois. Ignore les lignes à prix normal (price > 1).
 */
export function computeWarehouseFeeBreakdown(
  items: WarehouseFeeItemLike[],
  config: WarehouseFeesConfig,
): WarehouseFeeBreakdown {
  const seen = new Set<string>();
  const lines: WarehouseFeeLine[] = [];

  for (const item of items) {
    if (!isZeroFcfaCatalogPrice(item.price)) continue;
    const id = normalizeWarehouseId(item.originWarehouseId);
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const hub = findWarehouse(config, id);
    const label =
      hub?.label ||
      (item.originWarehouseLabel
        ? String(item.originWarehouseLabel).trim()
        : id);
    const feeUsd = hub?.feeUsd ?? 0;
    lines.push({
      warehouseId: id,
      label,
      feeUsd,
      feeXof: usdToXofAmount(feeUsd, config.usdToXof),
    });
  }

  lines.sort((a, b) => a.label.localeCompare(b.label, "fr"));
  const warehouseFeeTotal = lines.reduce((sum, l) => sum + l.feeXof, 0);
  return { lines, warehouseFeeTotal };
}

/** True si une ligne 0 FCFA n’a pas d’entrepôt valide (actif dans la grille). */
export function zeroFcfaLineMissingWarehouse(
  item: WarehouseFeeItemLike,
  config: WarehouseFeesConfig,
): boolean {
  if (!isZeroFcfaCatalogPrice(item.price)) return false;
  const hub = findWarehouse(config, item.originWarehouseId);
  return !hub || !hub.active;
}

export function anyZeroFcfaMissingWarehouse(
  items: WarehouseFeeItemLike[],
  config: WarehouseFeesConfig,
): boolean {
  return items.some((item) => zeroFcfaLineMissingWarehouse(item, config));
}

export function formatWarehouseFeeUsd(feeUsd: number): string {
  const n = Number(feeUsd);
  if (!Number.isFinite(n)) return "0,00$";
  // Affichage type capture : 1,90$
  return `${n.toFixed(2).replace(".", ",")}$`;
}

export function warehouseFeeHintLabel(
  warehouseId: string | null | undefined,
  config: WarehouseFeesConfig,
): string | null {
  const hub = findWarehouse(config, warehouseId);
  if (!hub || !hub.active) return null;
  return `+ frais d'entrepôt à partir de ${formatWarehouseFeeUsd(hub.feeUsd)}`;
}
