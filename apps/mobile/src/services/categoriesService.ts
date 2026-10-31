// services/firebase/categoriesService.ts
import {
  collection,
  getDocs,
  orderBy,
  query,
  QueryConstraint,
  DocumentData,
  QueryDocumentSnapshot
} from "firebase/firestore";
import { db } from "../../config/firebase";

// ============= TYPES =============
export interface Category {
  id: string;
  name: string;
  image?: string;
  slug: string; // Utile pour le filtrage et les URLs
}

// ============= CACHE =============
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

let categoriesCache: {
  data: Category[];
  timestamp: number;
} | null = null;

let pendingPromise: Promise<Category[]> | null = null;

// ============= TRANSFORM & NORMALISATION =============
const transformCategory = (doc: QueryDocumentSnapshot<DocumentData>): Category => {
  const data = doc.data();
  const name = data.name ?? "";
  return {
    id: doc.id,
    name: name,
    image: data.image || data.imageUrl,
    // On crée un slug pour fusionner facilement les doublons si besoin
    slug: name.toLowerCase().trim()
  };
};

// ============= FIRESTORE FETCH =============
const fetchCategoriesFromFirestore = async (): Promise<Category[]> => {
  try {
    console.log("🔥 Lecture Firestore des catégories");

    const categoriesRef = collection(db, "categories");
    const q = query(categoriesRef, orderBy("name", "asc"));
    const snap = await getDocs(q);

    const rawCategories = snap.docs.map(transformCategory);

    // OPTIONAL: Fusion des doublons par nom (sécurité supplémentaire)
    const uniqueMap = new Map<string, Category>();
    rawCategories.forEach(cat => {
      if (!uniqueMap.has(cat.slug)) {
        uniqueMap.set(cat.slug, cat);
      }
    });

    const finalCategories = Array.from(uniqueMap.values());
    console.log(`✅ ${finalCategories.length} catégories chargées`);
    return finalCategories;
  } catch (error) {
    console.error("❌ Erreur fetchCategories:", error);
    throw error;
  }
};

// ============= API PUBLIQUE =============
export async function getCategories(): Promise<Category[]> {
  const now = Date.now();

  // 1. Retour du cache si valide
  if (categoriesCache && now - categoriesCache.timestamp < CACHE_TTL) {
    return categoriesCache.data;
  }

  // 2. Retour de la promesse si une requête est déjà en cours
  if (pendingPromise) {
    return pendingPromise;
  }

  // 3. Lancement de la nouvelle requête
  pendingPromise = fetchCategoriesFromFirestore()
    .then((categories) => {
      categoriesCache = {
        data: categories,
        timestamp: Date.now(),
      };
      return categories;
    })
    .catch((err) => {
      // En cas d'erreur, on vide le cache pour permettre une tentative ultérieure
      categoriesCache = null;
      throw err;
    })
    .finally(() => {
      pendingPromise = null;
    });

  return pendingPromise;
}

// ============= UTILS =============
export function clearCategoriesCache(): void {
  categoriesCache = null;
  pendingPromise = null;
  console.log("🧹 Cache catégories vidé");
}

/**
 * Utile pour rafraîchir manuellement (ex: Pull-to-refresh)
 */
export async function refreshCategories(): Promise<Category[]> {
  clearCategoriesCache();
  return getCategories();
}