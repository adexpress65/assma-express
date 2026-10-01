import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  mapProductStockDoc,
  sortByStockAsc,
  type ProductStockRow,
} from "./productStock";

/** Même ordre de grandeur que le catalogue vendeur / la liste web-admin. */
const STOCK_LIST_LIMIT = 200;

const OWNER_FIELDS = ["companyId", "sellerId", "supplierId"] as const;

export type CompanyFilterOption = {
  id: string;
  name: string;
};

function uniqueOwnerIds(ids: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function queryProductsByField(
  field: (typeof OWNER_FIELDS)[number],
  value: string,
): Promise<ProductStockRow[]> {
  const snap = await getDocs(
    query(
      collection(db, "products"),
      where(field, "==", value),
      limit(STOCK_LIST_LIMIT),
    ),
  );
  return snap.docs.map((d) =>
    mapProductStockDoc(d.id, d.data() as Record<string, unknown>),
  );
}

/**
 * Produits du fournisseur connecté.
 * Reprend les clés déjà utilisées (companyId, sellerId, supplierId) sans écriture.
 */
export async function fetchSellerProductStock(
  ownerIds: Array<string | undefined | null>,
): Promise<ProductStockRow[]> {
  const ids = uniqueOwnerIds(ownerIds);
  const byId = new Map<string, ProductStockRow>();

  for (const ownerId of ids) {
    for (const field of OWNER_FIELDS) {
      try {
        const rows = await queryProductsByField(field, ownerId);
        for (const row of rows) {
          if (!byId.has(row.id)) byId.set(row.id, row);
        }
      } catch (e) {
        console.error(`Erreur lecture produits (${field}):`, e);
      }
    }
  }

  return sortByStockAsc(Array.from(byId.values()));
}

/**
 * Vue Super-admin : catalogue multi-fournisseurs, lecture seule.
 * Filtre entreprise = mêmes where que le dashboard fournisseur.
 */
export async function fetchAdminProductStock(
  companyId?: string | null,
): Promise<ProductStockRow[]> {
  if (companyId) {
    return fetchSellerProductStock([companyId]);
  }

  const productsRef = collection(db, "products");
  const snap = await getDocs(
    query(productsRef, orderBy("createdAt", "desc"), limit(STOCK_LIST_LIMIT)),
  ).catch(async () =>
    getDocs(query(productsRef, limit(STOCK_LIST_LIMIT))),
  );

  return sortByStockAsc(
    snap.docs.map((d) =>
      mapProductStockDoc(d.id, d.data() as Record<string, unknown>),
    ),
  );
}

export async function fetchCompaniesForStockFilter(): Promise<
  CompanyFilterOption[]
> {
  const snap = await getDocs(
    query(collection(db, "companies"), orderBy("name", "asc")),
  ).catch(async () => getDocs(collection(db, "companies")));

  return snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: String(data.name || d.id),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
