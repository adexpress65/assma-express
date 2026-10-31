import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { productsIndex } from "@/config/algolia";
import type { AlgoliaHit } from "@/types/product";

export type SearchResultItem = {
  id: string;
  type: "product" | "category" | "company";
  name: string;
  imageUrl?: string | null;
  price?: number;
  currency?: string;
  supplier?: string;
  category?: string;
  featured?: boolean;
};

function isFirestoreResourceExhausted(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return (
    code === "resource-exhausted" ||
    String((err as Error)?.message || "").toLowerCase().includes("resource-exhausted") ||
    String((err as Error)?.message || "").toLowerCase().includes("quota")
  );
}

/**
 * Suggestions globales : produits via **Algolia** (0 lecture Firestore produit),
 * catégories + entreprises via Firestore (≤ ~10 docs par recherche).
 */
export async function searchGlobal(
  text: string,
  options?: {
    limitFinal?: number;
    /** @deprecated ignoré — produits servis par Algolia */
    productsFetchLimit?: number;
    includeCompanies?: boolean;
  }
): Promise<SearchResultItem[]> {
  if (!text || text.trim().length < 2) return [];

  const limitFinal = options?.limitFinal ?? 30;
  const includeCompanies = options?.includeCompanies ?? true;

  const searchRaw = text.toLowerCase().trim();

  const stopWords = ['de', 'la', 'le', 'les', 'pour', 'avec', 'une', 'des', 'dans', 'sur', 'par'];

  const searchWords = searchRaw.split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.includes(w));

  if (searchWords.length === 0) {
    searchWords.push(searchRaw);
  }

  try {
    const catQuery = query(
      collection(db, "categories"),
      where("nameLower", ">=", searchWords[searchWords.length - 1]),
      where("nameLower", "<=", searchWords[searchWords.length - 1] + "\uf8ff"),
      limit(5)
    );

    const companiesQuery = includeCompanies
      ? query(
          collection(db, "companies"),
          where("nameLower", ">=", searchRaw),
          limit(5)
        )
      : null;

    const algoliaPromise = productsIndex
      .search<AlgoliaHit>(text.trim(), {
        hitsPerPage: Math.min(limitFinal, 40),
        typoTolerance: true,
        removeStopWords: ['fr'],
      })
      .then((r) => r.hits || [])
      .catch((e) => {
        console.warn("[searchGlobal] Algolia produits:", e);
        return [] as AlgoliaHit[];
      });

    let categoriesDocs: { id: string; data: () => Record<string, unknown> }[] = [];
    let companiesDocs: { id: string; data: () => Record<string, unknown> }[] = [];

    try {
      const [cats, comps] = await Promise.all([
        getDocs(catQuery),
        companiesQuery ? getDocs(companiesQuery) : Promise.resolve({ docs: [] } as any),
      ]);
      categoriesDocs = cats.docs;
      companiesDocs = comps.docs;
    } catch (e) {
      if (isFirestoreResourceExhausted(e)) {
        console.warn("[searchGlobal] Firestore quota / erreur — catégories & entreprises ignorées");
      } else {
        throw e;
      }
    }

    const productHits = await algoliaPromise;

    const results: SearchResultItem[] = [];

    productHits.forEach((hit) => {
      const img =
        hit.mainImage || hit.imageUrl || hit.image ||
        (Array.isArray(hit.images) ? hit.images[0] : null);
      results.push({
        id: String(hit.objectID),
        type: "product",
        name: String(hit.name || "Produit"),
        imageUrl: img ? String(img) : null,
        price: Number(hit.price ?? 0),
        currency: hit.currency || "XOF",
        supplier: String(hit.supplier || hit.companyName || "A2Express"),
        category: String(hit.categoryName || hit.category || ""),
        featured: hit.featured === true,
      });
    });

    categoriesDocs.forEach((doc) => {
      const data = doc.data();
      results.push({
        id: doc.id,
        type: "category",
        name: String(data.name || "Sans nom"),
        imageUrl: (data.imageUrl || data.image || null) as string | null,
      });
    });

    companiesDocs.forEach((doc) => {
      const data = doc.data();
      results.push({
        id: doc.id,
        type: "company",
        name: String(data.name || "Sans nom"),
        imageUrl: (data.logo || data.imageUrl || null) as string | null,
      });
    });

    return results.sort((a, b) => {
      const calculateScore = (item: SearchResultItem) => {
        let score = 0;
        const name = (item.name || "").toLowerCase();
        const cat = (item.category || "").toLowerCase();

        const wordsInName = searchWords.filter((word) => name.includes(word));
        const wordsInCat = searchWords.filter((word) => cat.includes(word));

        if (wordsInName.length === searchWords.length) {
          score += 2000;
        }
        if (searchWords[0] && name.startsWith(searchWords[0])) {
          score += 500;
        }
        score += wordsInName.length * 100;
        score += wordsInCat.length * 20;
        if (item.featured) score += 50;
        if (item.type === "product") score += 15;
        return score;
      };

      return calculateScore(b) - calculateScore(a);
    }).slice(0, limitFinal);
  } catch (error) {
    if (isFirestoreResourceExhausted(error)) {
      console.warn("[searchGlobal] Quota Firestore — tentative Algolia seule");
      try {
        const r = await productsIndex.search<AlgoliaHit>(text.trim(), {
          hitsPerPage: Math.min(limitFinal, 40),
          typoTolerance: true,
          removeStopWords: ['fr'],
        });
        return (r.hits || []).map((hit) => {
          const img =
            hit.mainImage || hit.imageUrl || hit.image ||
            (Array.isArray(hit.images) ? hit.images[0] : null);
          return {
            id: String(hit.objectID),
            type: "product" as const,
            name: String(hit.name || "Produit"),
            imageUrl: img ? String(img) : null,
            price: Number(hit.price ?? 0),
            currency: hit.currency || "XOF",
            supplier: String(hit.supplier || hit.companyName || "A2Express"),
            category: String(hit.categoryName || hit.category || ""),
            featured: hit.featured === true,
          };
        });
      } catch {
        return [];
      }
    }
    console.error("Search Error:", error);
    return [];
  }
}
