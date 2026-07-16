import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { normalizeShopLabel } from '@/utils/zeroDollarsShop';

/**
 * Nom affiché canonique pour l’ancienne boutique (données dénormalisées / cache).
 * Les produits à jour utilisent surtout companyId + collection `companies`.
 */
export const YIWU_GLOBAL_EXPORT88_DISPLAY_NAME =
  'Yiwu Global Export88 Co, Ltd';

function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function pickCompanyNameFromFirestoreData(data: Record<string, unknown>): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as {
    name?: string;
    companyName?: string;
    displayName?: string;
    /** Parfois présent sur les docs `companies` (doublon normalisé) */
    nameLower?: string;
    name_lower?: string;
    sellerInfo?: { shopName?: string };
  };
  const fromNested =
    d.sellerInfo && typeof d.sellerInfo === 'object'
      ? String((d.sellerInfo as { shopName?: string }).shopName || '').trim()
      : '';
  return (
    String(d.name || '').trim() ||
    String(d.companyName || '').trim() ||
    String(d.displayName || '').trim() ||
    fromNested ||
    String(d.nameLower || '').trim() ||
    String(d.name_lower || '').trim()
  );
}

/**
 * Charge les noms à jour depuis `companies` (par lot de 10, limite Firestore `in`).
 */
export async function fetchCompanyDisplayNameMap(
  db: Firestore,
  companyIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(companyIds.filter((id) => typeof id === 'string' && id.length > 0))];
  if (unique.length === 0) return map;

  const chunks = chunkIds(unique, 10);
  await Promise.all(
    chunks.map(async (ids) => {
      const q = query(collection(db, 'companies'), where(documentId(), 'in', ids));
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const label = pickCompanyNameFromFirestoreData(
          docSnap.data() as Record<string, unknown>
        );
        if (label) map.set(docSnap.id, label);
      });
    })
  );
  return map;
}

/** Anciennes variantes « Kiss… » dans les champs supplier / companyName des produits. */
export function remapLegacyVendorLabel(raw: string | undefined | null): string {
  if (raw == null) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';
  const n = normalizeShopLabel(trimmed);
  if (!n) return trimmed;

  const compact = n.replace(/\s+/g, '');
  if (compact.includes('kiss')) {
    if (
      compact.includes('group') ||
      compact.includes('88') ||
      compact.includes('grp') ||
      n.includes('kiss group')
    ) {
      return YIWU_GLOBAL_EXPORT88_DISPLAY_NAME;
    }
  }
  if (
    compact === 'kissgroup' ||
    compact === 'kissgroup88' ||
    compact === 'kissgr' ||
    n === 'kiss group' ||
    n === 'kiss group 88'
  ) {
    return YIWU_GLOBAL_EXPORT88_DISPLAY_NAME;
  }
  return trimmed;
}

export type SupplierResolvable = {
  companyId?: string | null;
  companyName?: string | null;
  supplier: string;
  /** Copie dénormalisée sur le produit (`companyData.name`) — repli si `companies/{id}` absent ou non chargé */
  embeddedCompanyName?: string | null;
};

/**
 * Ordre de résolution du nom affiché :
 * 1) Document `companies/{companyId}` (source de vérité, renommage global)
 * 2) `companyData.name` embarqué sur le produit (cohérent tant que vous resynchronisez à la création/màj produit)
 * 3) `companyName` / `supplier` + correctifs legacy (ex. KissGroup)
 */
export function resolveSupplierLabels<T extends SupplierResolvable>(
  product: T,
  companyNameById?: Map<string, string>
): T {
  const cid =
    product.companyId != null && String(product.companyId).trim() !== ''
      ? String(product.companyId).trim()
      : '';

  if (cid && companyNameById?.has(cid)) {
    const live = companyNameById.get(cid);
    if (live && live.trim() !== '') {
      return { ...product, supplier: live, companyName: live };
    }
  }

  const embeddedRaw =
    product.embeddedCompanyName != null
      ? String(product.embeddedCompanyName).trim()
      : '';
  if (embeddedRaw !== '') {
    const fromEmbedded =
      remapLegacyVendorLabel(embeddedRaw) || embeddedRaw;
    return {
      ...product,
      supplier: fromEmbedded,
      companyName: fromEmbedded,
    };
  }

  const supplierRemapped = remapLegacyVendorLabel(product.supplier) || product.supplier;
  const companyRaw = product.companyName != null ? String(product.companyName) : '';
  const companyRemapped = companyRaw
    ? remapLegacyVendorLabel(companyRaw) || companyRaw
    : supplierRemapped;

  return {
    ...product,
    supplier: supplierRemapped,
    companyName: companyRemapped,
  };
}

export function displaySellerName(
  src: {
    seller?: string | null;
    companyName?: string | null;
    companyId?: string | null;
    embeddedCompanyName?: string | null;
  },
  companyNameById?: Map<string, string>,
  fallback = 'Fournisseur'
): string {
  const supplier = String(src.seller || src.companyName || fallback).trim() || fallback;
  const resolved = resolveSupplierLabels(
    {
      supplier,
      companyName: src.companyName != null ? String(src.companyName) : undefined,
      companyId: src.companyId != null ? String(src.companyId) : undefined,
      embeddedCompanyName:
        src.embeddedCompanyName != null
          ? String(src.embeddedCompanyName)
          : undefined,
    },
    companyNameById
  );
  return resolved.supplier || fallback;
}
