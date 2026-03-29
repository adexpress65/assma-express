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

export async function searchGlobal(
  text: string,
  options?: {
    limitFinal?: number;
    productsFetchLimit?: number;
    includeCompanies?: boolean;
  }
): Promise<SearchResultItem[]> {
  if (!text || text.trim().length < 2) return [];

  const limitFinal = options?.limitFinal ?? 30;
  // 💡 CONSEIL : On augmente ici pour scanner plus de produits dans Firebase
  const productsFetchLimit = options?.productsFetchLimit ?? 200; 
  const includeCompanies = options?.includeCompanies ?? true;

  const searchRaw = text.toLowerCase().trim();
  
  // ✅ AJOUT ICI : Filtrage des mots inutiles (Stop Words)
  const stopWords = ['de', 'la', 'le', 'les', 'pour', 'avec', 'une', 'des', 'dans', 'sur', 'par'];
  
  const searchWords = searchRaw.split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.includes(w));

  if (searchWords.length === 0) {
    searchWords.push(searchRaw);
  }

  // ... (garde ton code pour les requêtes Firebase catQuery, productsSnapPromise, etc.)

  try {
    // 1. On cherche d'abord les catégories qui correspondent aux mots (ex: Catégorie "Homme")
    const catQuery = query(
      collection(db, "categories"),
      where("nameLower", ">=", searchWords[searchWords.length - 1]), // On teste souvent le dernier mot (souvent le genre/catégorie)
      where("nameLower", "<=", searchWords[searchWords.length - 1] + "\uf8ff"),
      limit(5)
    );

    const productsSnapPromise = getDocs(
      query(collection(db, "products"), limit(productsFetchLimit))
    );
    const categoriesSnapPromise = getDocs(catQuery);
    const companiesSnapPromise = includeCompanies
      ? getDocs(
          query(
            collection(db, "companies"),
            where("nameLower", ">=", searchRaw),
            limit(5)
          )
        )
      : Promise.resolve({ docs: [] } as any);

    const [productsSnap, categoriesSnap, companiesSnap] = await Promise.all([
      productsSnapPromise,
      categoriesSnapPromise,
      companiesSnapPromise,
    ]);

    const results: SearchResultItem[] = [];
    const foundCategoryNames = categoriesSnap.docs.map(d => d.data().nameLower);

    // 🔍 LOGIQUE PRODUITS : PERTINENCE ÉLARGIE
productsSnap.forEach((doc) => {
  const data = doc.data();
  
  // Normalisation pour la recherche
  const nameLower = (data.nameLower || data.name || "").toLowerCase();
  const categoryLower = (data.categoryName || "").toLowerCase();
  const descriptionLower = (data.description || "").toLowerCase();

  const matchesAnyWord = searchWords.some(word => 
    nameLower.includes(word) || 
    categoryLower.includes(word) ||
    descriptionLower.includes(word)
  );

  if (matchesAnyWord) {
    // ✅ CORRECTION IMAGE : On utilise 'mainImage' en priorité comme dans ton export
    // Si mainImage est vide, on prend imageUrl, sinon la première image de l'array
    const productImg = data.mainImage || data.imageUrl || (data.images && data.images[0]) || null;

    results.push({
      id: doc.id,
      type: "product",
      name: data.name || "Boucles d'oreilles",
      imageUrl: productImg, // Cette URL Firebase s'affichera maintenant
      price: data.price || 0,
      currency: data.currency || "XOF",
      supplier: data.supplier || data.companyName || "A2Express",
      category: data.categoryName || "Mode",
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
    companiesSnap.docs.forEach((doc: any) => {
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
// 🗄️ TRI PAR PERTINENCE AMÉLIORÉ
// 🗄️ NOUVEAU SYSTÈME DE TRI PAR PERTINENCE (ULTRA PRÉCIS)
// 🗄️ NOUVEAU SYSTÈME DE TRI PAR PERTINENCE (ULTRA PRÉCIS)
return results.sort((a, b) => {
    const calculateScore = (item: SearchResultItem) => {
        let score = 0;
        const name = (item.name || "").toLowerCase();
        const cat = (item.category || "").toLowerCase();
        
        // 1. On compte les mots trouvés
        const wordsInName = searchWords.filter(word => name.includes(word));
        const wordsInCat = searchWords.filter(word => cat.includes(word));

        // 🔥 LE SECRET DU MATCH EXACT :
        // Si le nom du produit contient TOUS les mots envoyés par l'IA, on donne un score énorme.
        if (wordsInName.length === searchWords.length) {
            score += 2000; 
        }

        // 2. Bonus de position : Si le nom COMMENCE par le premier mot-clé (souvent le plus important)
        if (name.startsWith(searchWords[0])) {
            score += 500;
        }

        // 3. Bonus proportionnel
        score += wordsInName.length * 100;
        score += wordsInCat.length * 20;

        // 4. Bonus "Featured" (pour tes produits premium)
        if (item.featured) score += 50;

        return score;
    };

    return calculateScore(b) - calculateScore(a);
}).slice(0, limitFinal);

  } catch (error) {
    console.error("Search Error:", error);
    return [];
  }
}