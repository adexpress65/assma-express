import Constants from "expo-constants";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";

/* ===============================
   🔧 CONFIGURATION DE BASE
   Les produits / catégories viennent de Firestore uniquement (plus d’API Prisma).
================================ */
export const API_HOST = "http://10.203.128.242:4000";
export const API_BASE =
  Constants.expoConfig?.extra?.API_URL || `${API_HOST}/api`;

/* ===============================
   💳 BACKEND PAIEMENT (externe)
================================ */
export const PAYMENT_API_URL =
  process.env.EXPO_PUBLIC_PAYMENT_API_URL ?? "https://ngenius-backend.onrender.com";

export const PAYMENT_ENDPOINTS = {
  ngenius: `${PAYMENT_API_URL}/create-payment`,
  fedapay: `${PAYMENT_API_URL}/create-fedapay-payment`,
  paydunya: `${PAYMENT_API_URL}/create-paydunya-payment`,
} as const;

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
  imageUrl?: string;
}

/* ===============================
   🧠 toImage — chemins relatifs / uploads (héritage)
================================ */
export function toImage(path?: string): string {
  if (!path) return "https://via.placeholder.com/200x200?text=No+Image";

  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  return `${API_HOST}${path.startsWith("/") ? path : "/" + path}`;
}

/* ===============================
   🚀 Données catalogue — Firestore
================================ */
export const api = {
  async categories(): Promise<Category[]> {
    const snap = await getDocs(query(collection(db, "categories"), limit(150)));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name || ""),
        image: data.imageUrl || data.image,
        folder: data.folder,
        createdAt: data.createdAt?.toString?.(),
      };
    });
  },

  async products(): Promise<Product[]> {
    const snap = await getDocs(
      query(collection(db, "products"), limit(80)),
    );
    return snap.docs.map((d) => {
      const data = d.data();
      const img = data.mainImage || data.imageUrl || data.image;
      return {
        id: d.id,
        name: String(data.name || ""),
        price: Number(data.price) || 0,
        description: data.description ? String(data.description) : undefined,
        categoryId: data.categoryId ? String(data.categoryId) : undefined,
        imageUrl: img ? toImage(String(img)) : undefined,
        image: img ? toImage(String(img)) : undefined,
      };
    });
  },

  async productsByCategoryId(categoryId: string): Promise<Product[]> {
    const q = query(
      collection(db, "products"),
      where("categoryId", "==", categoryId),
      limit(200),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      const img = data.mainImage || data.imageUrl || data.image;
      return {
        id: d.id,
        name: String(data.name || ""),
        price: Number(data.price) || 0,
        description: data.description ? String(data.description) : undefined,
        categoryId: data.categoryId ? String(data.categoryId) : undefined,
        imageUrl: img ? toImage(String(img)) : undefined,
        image: img ? toImage(String(img)) : undefined,
      };
    });
  },

  async productsByCategoryIdFallback(categoryId: string): Promise<Product[]> {
    return this.productsByCategoryId(categoryId);
  },

  async productsByCategory(categoryName: string): Promise<Product[]> {
    const categories = await this.categories();
    const category = categories.find(
      (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
    );
    if (category) {
      return this.productsByCategoryId(category.id);
    }
    return [];
  },
};

export default api;
