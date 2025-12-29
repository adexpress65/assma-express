// src/services/searchService.ts
import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";

/**
 * Types retournés vers SearchResults
 */
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

/**
 * Recherche globale
 */
export async function searchGlobal(text: string): Promise<SearchResultItem[]> {
  if (!text || text.trim().length < 2) return [];

  const search = text.toLowerCase().trim();
  const results: SearchResultItem[] = [];

  // ==========================
  // 🔍 PRODUITS
  // ==========================
  const productsQuery = query(
    collection(db, "products"),
    where("nameLower", ">=", search),
    where("nameLower", "<=", search + "\uf8ff"),
    limit(10)
  );

  const productsSnap = await getDocs(productsQuery);

  productsSnap.forEach((doc) => {
    const data = doc.data();

    results.push({
      id: doc.id,
      type: "product",
      name: data.name,
      imageUrl: data.mainImage || data.imageUrl || null,
      price: data.price,
      currency: data.currency || "XOF",
      supplier: data.companyName || data.supplier,
      category: data.categoryName,
      featured: data.featured === true,
    });
  });

  // ==========================
  // 📂 CATÉGORIES
  // ==========================
  const categoriesQuery = query(
    collection(db, "categories"),
    where("nameLower", ">=", search),
    where("nameLower", "<=", search + "\uf8ff"),
    limit(5)
  );

  const categoriesSnap = await getDocs(categoriesQuery);

  categoriesSnap.forEach((doc) => {
    const data = doc.data();

    results.push({
      id: doc.id,
      type: "category",
      name: data.name,
      imageUrl: data.imageUrl || null,
    });
  });

  // ==========================
  // 🏢 ENTREPRISES
  // ==========================
  const companiesQuery = query(
    collection(db, "companies"),
    where("nameLower", ">=", search),
    where("nameLower", "<=", search + "\uf8ff"),
    limit(5)
  );

  const companiesSnap = await getDocs(companiesQuery);

  companiesSnap.forEach((doc) => {
    const data = doc.data();

    results.push({
      id: doc.id,
      type: "company",
      name: data.name,
      imageUrl: data.logo || data.imageUrl || null,
      featured: data.verified === true,
    });
  });

  return results;
}
