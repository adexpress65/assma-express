import Constants from "expo-constants";

/* ===============================
   🔧 CONFIGURATION DE BASE
================================ */
export const API_HOST = "http://192.168.190.242:4000"; // ✅ Adresse locale de ton serveur Express
export const API_BASE =
  Constants.expoConfig?.extra?.API_URL || `${API_HOST}/api`;

/* ===============================
   🧩 INTERFACES TYPESCRIPT
================================ */
export interface Category {
  id: string;
  name: string;
  image?: string;
  folder?: string;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
  description?: string;
  categoryId?: string;
  imageUrl?: string; // ✅ ton seed Prisma utilise ce champ
}

/* ===============================
   🧠 FONCTION toImage — UNIVERSAL FIX
================================ */
export function toImage(path?: string): string {
  if (!path) return "https://via.placeholder.com/200x200?text=No+Image";

  // ✅ Si c’est déjà une URL complète (hébergement distant)
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  // ✅ Corrige les chemins relatifs /uploads/...
  return `${API_HOST}${path.startsWith("/") ? path : "/" + path}`;
}

/* ===============================
   🚀 FONCTIONS API
================================ */
export const api = {
  // 📦 Charger toutes les catégories
  async categories(): Promise<Category[]> {
    const res = await fetch(`${API_BASE}/categories`);
    if (!res.ok) throw new Error("Erreur chargement catégories");
    return await res.json();
  },

  // 📦 Charger tous les produits
  async products(): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/products/all`);
    if (!res.ok) throw new Error("Erreur chargement produits");
    return await res.json();
  },

  // ✅ Charger les produits d'une catégorie via son ID
  async productsByCategoryId(categoryId: string): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/products/by-category/${categoryId}`);
    if (!res.ok) throw new Error("Erreur chargement produits par catégorie");
    return await res.json();
  },

  // 🪛 Fallback – filtrer côté client
  async productsByCategoryIdFallback(categoryId: string): Promise<Product[]> {
    try {
      const allProducts = await this.products();
      return allProducts.filter(
        (p: Product) => String(p.categoryId) === String(categoryId)
      );
    } catch (error) {
      console.error("Erreur filtrage produits par catégorie:", error);
      return [];
    }
  },

  // ⚠️ Ancienne méthode (par nom de catégorie)
  async productsByCategory(categoryName: string): Promise<Product[]> {
    console.warn(
      "⚠️ Attention: productsByCategory(name) utilise une ancienne route. Préfère productsByCategoryId(id)."
    );
    try {
      const res = await fetch(
        `${API_BASE}/products/category/${encodeURIComponent(categoryName)}`
      );
      if (res.ok) return await res.json();

      // fallback si la route échoue
      const categories = await this.categories();
      const category = categories.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      );
      if (category) {
        return await this.productsByCategoryIdFallback(category.id);
      }
      return [];
    } catch (error) {
      console.error("Erreur endpoint produits par catégorie:", error);
      return [];
    }
  },
};

export default api;
