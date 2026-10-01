/**
 * Cascade boutique → produits.
 *
 * - Suppression de `companies/{companyId}` : tous les produits de cette boutique
 *   passent `isActive=false` (jamais de delete du document produit).
 * - Suspension (`isActive` true → false) : même désactivation.
 * - Réactivation (`isActive` false → true) : on ne republie PAS les produits
 *   (action manuelle explicite, pour ne pas réafficher des SKU désactivés
 *   pour une autre raison).
 *
 * Algolia : même sémantique qu’une suppression de produit dans `onProductWrite`
 * (`deleteObject` / `deleteObjects`). `onProductWrite` retire aussi l’objet à
 * l’écriture `isActive=false` ; le passage ici est un filet (lots + boutique
 * déjà inactive).
 */

import * as admin from "firebase-admin";
import {
  onDocumentDeleted,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {
  createAlgoliaProductsIndex,
  deleteProductIdsFromAlgolia,
} from "./algoliaProducts";

const PRODUCT_PAGE_SIZE = 400;
const FUNCTION_TIMEOUT_SECONDS = 540;

function isCompanyCatalogActive(
  data: admin.firestore.DocumentData | undefined,
): boolean {
  if (!data) return false;
  return data.isActive !== false;
}

async function loadAlgoliaIndex() {
  const { default: algoliasearch } = await import("algoliasearch");
  return createAlgoliaProductsIndex(algoliasearch);
}

/**
 * Désactive tous les produits `companyId == boutique` par pages, sans jamais
 * supprimer les documents. Retire ensuite ces IDs de l’index Algolia.
 */
export async function deactivateProductsForCompany(
  companyId: string,
  reason: "deleted" | "suspended",
): Promise<{ scanned: number; deactivated: number; algolia: number }> {
  const db = admin.firestore();
  const col = db.collection("products");
  let last: admin.firestore.QueryDocumentSnapshot | undefined;
  let scanned = 0;
  let deactivated = 0;
  const algoliaIds: string[] = [];

  for (;;) {
    let q: admin.firestore.Query = col
      .where("companyId", "==", companyId)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(PRODUCT_PAGE_SIZE);
    if (last) {
      q = q.startAfter(last);
    }

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let ops = 0;
    const now = admin.firestore.FieldValue.serverTimestamp();

    for (const docSnap of snap.docs) {
      scanned += 1;
      algoliaIds.push(docSnap.id);
      if (docSnap.data()?.isActive === false) continue;
      batch.update(docSnap.ref, {
        isActive: false,
        updatedAt: now,
      });
      ops += 1;
      deactivated += 1;
    }

    if (ops > 0) {
      await batch.commit();
    }

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PRODUCT_PAGE_SIZE) break;
  }

  try {
    const index = await loadAlgoliaIndex();
    await deleteProductIdsFromAlgolia(index, algoliaIds);
  } catch (err) {
    console.error("[onCompanyChange] Algolia cascade failed", {
      companyId,
      reason,
      err,
    });
  }

  console.log(
    JSON.stringify({
      msg: "onCompanyChange cascade",
      reason,
      companyId,
      scanned,
      deactivated,
      algolia: algoliaIds.length,
    }),
  );

  return { scanned, deactivated, algolia: algoliaIds.length };
}

export const onCompanyDeleted = onDocumentDeleted(
  {
    document: "companies/{companyId}",
    timeoutSeconds: FUNCTION_TIMEOUT_SECONDS,
    memory: "512MiB",
  },
  async (event) => {
    const companyId = event.params.companyId as string;
    if (!companyId) return;
    await deactivateProductsForCompany(companyId, "deleted");
  },
);

export const onCompanyUpdated = onDocumentUpdated(
  {
    document: "companies/{companyId}",
    timeoutSeconds: FUNCTION_TIMEOUT_SECONDS,
    memory: "512MiB",
  },
  async (event) => {
    const companyId = event.params.companyId as string;
    if (!companyId) return;

    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after) return;

    const wasActive = isCompanyCatalogActive(before);
    const isActive = isCompanyCatalogActive(after);

    if (wasActive && !isActive) {
      await deactivateProductsForCompany(companyId, "suspended");
      return;
    }

    // Réactivation boutique : ne pas republier les produits automatiquement.
  },
);
