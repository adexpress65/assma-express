import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";

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

export async function searchGlobal(text: string): Promise<SearchResultItem[]> {
  if (!text || text.trim().length < 2) return [];

  const searchRaw = text.toLowerCase().trim();
  const searchWords = searchRaw.split(/\s+/).filter(w => w.length > 2); // Ex: ["chaussure", "homme"]

  try {
    // 1. On cherche d'abord les catégories qui correspondent aux mots (ex: Catégorie "Homme")
    const catQuery = query(
      collection(db, "categories"),
      where("nameLower", ">=", searchWords[searchWords.length - 1]), // On teste souvent le dernier mot (souvent le genre/catégorie)
      where("nameLower", "<=", searchWords[searchWords.length - 1] + "\uf8ff"),
      limit(5)
    );
    
    const [productsSnap, categoriesSnap, companiesSnap] = await Promise.all([
      getDocs(query(collection(db, "products"), limit(80))), // On récupère un échantillon plus large pour le filtrage croisé
      getDocs(catQuery),
      getDocs(query(collection(db, "companies"), where("nameLower", ">=", searchRaw), limit(5)))
    ]);

    const results: SearchResultItem[] = [];
    const foundCategoryNames = categoriesSnap.docs.map(d => d.data().nameLower);

    // 🔍 LOGIQUE PRODUITS : PERTINENCE ÉLARGIE
    productsSnap.forEach((doc) => {
      const data = doc.data();
      const nameLower = (data.nameLower || data.name || "").toLowerCase();
      const categoryLower = (data.categoryName || data.category || "").toLowerCase();
      const descriptionLower = (data.description || "").toLowerCase();

      // Le produit est valide si :
      // - Un des mots de la recherche est dans le nom
      // - OU un des mots correspond à la catégorie du produit
      // - OU le produit appartient à une catégorie trouvée plus haut
      const matchesAnyWord = searchWords.some(word => 
        nameLower.includes(word) || 
        categoryLower.includes(word) ||
        descriptionLower.includes(word)
      );

      if (matchesAnyWord) {
        results.push({
          id: doc.id,
          type: "product",
          name: data.name || "Sans nom",
          imageUrl: data.mainImage || data.imageUrl || data.image || null,
          price: data.price,
          currency: data.currency || "XOF",
          supplier: data.companyName || data.supplier,
          category: data.categoryName || data.category,
          featured: data.featured === true,
        });
      }
    });

    // 📂 AJOUT DES CATÉGORIES TROUVÉES
    categoriesSnap.forEach((doc) => {
      const data = doc.data();
      results.push({
        id: doc.id,
        type: "category",
        name: data.name || "Sans nom",
        imageUrl: data.imageUrl || data.image || null,
      });
    });

    // 🏢 AJOUT DES ENTREPRISES
    companiesSnap.forEach((doc) => {
      const data = doc.data();
      results.push({
        id: doc.id,
        type: "company",
        name: data.name || "Sans nom",
        imageUrl: data.logo || data.imageUrl || null,
      });
    });

    // 🗄️ TRI PAR PERTINENCE
    // On met en haut les produits qui contiennent TOUS les mots, puis ceux qui n'en contiennent qu'un
    return results.sort((a, b) => {
        const countMatches = (item: SearchResultItem) => {
            let score = 0;
            const target = (item.name + " " + (item.category || "")).toLowerCase();
            searchWords.forEach(w => { if (target.includes(w)) score++; });
            if (item.featured) score += 0.5;
            return score;
        };
        return countMatches(b) - countMatches(a);
    }).slice(0, 30); // On limite à 30 résultats finaux

  } catch (error) {
    console.error("Search Error:", error);
    return [];
  }
}