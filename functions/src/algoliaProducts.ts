/**
 * Index catalogue Algolia — partagé entre `onProductWrite` (écriture / suppression
 * d’un produit) et la cascade boutique (`onCompanyChange`).
 *
 * Un produit désactivé (`isActive === false`) doit quitter l’index exactement
 * comme un document `products/{id}` supprimé : `deleteObject` / `deleteObjects`.
 * On ne supprime jamais le document Firestore produit dans la cascade boutique.
 */

export const ALGOLIA_APP_ID = "ZYRHOXK3WR";
export const ALGOLIA_ADMIN_KEY = "db3194e274569db32e5938952f5a3ffd";
export const ALGOLIA_INDEX_NAME = "products";

const DELETE_CHUNK = 1000;

export function createAlgoliaProductsIndex(
  algoliasearchFn: typeof import("algoliasearch").default,
) {
  const client = algoliasearchFn(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
  return client.initIndex(ALGOLIA_INDEX_NAME);
}

/** `isActive === false` uniquement : un champ absent reste considéré indexable. */
export function shouldRemoveProductFromAlgolia(
  data: { isActive?: unknown } | undefined | null,
): boolean {
  return data?.isActive === false;
}

export async function deleteProductIdsFromAlgolia(
  index: ReturnType<typeof createAlgoliaProductsIndex>,
  productIds: string[],
): Promise<void> {
  const ids = [
    ...new Set(
      productIds.filter((id) => typeof id === "string" && id.length > 0),
    ),
  ];
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    const chunk = ids.slice(i, i + DELETE_CHUNK);
    if (chunk.length === 1) {
      await index.deleteObject(chunk[0]);
    } else {
      await index.deleteObjects(chunk);
    }
  }
}
