// apps/mobile/src/config/firebase-api.ts
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';

// Interfaces (conservées identiques)
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

// Fonction toImage adaptée
export function toImage(path?: string): string {
  if (!path) return "https://via.placeholder.com/200x200?text=No+Image";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return "https://via.placeholder.com/200x200?text=No+Image";
}

// API Firebase de base
export const firebaseApi = {
  // 📦 Charger toutes les catégories
  async categories(): Promise<Category[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'categories'));
      const categories = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      
      console.log(`🔥 Firebase: ${categories.length} catégories chargées`);
      return categories;
    } catch (error) {
      console.error('❌ Erreur chargement catégories Firebase:', error);
      return []; // Retourne un tableau vide au lieu de throw
    }
  },

  // 📦 Charger tous les produits
  async products(): Promise<Product[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const products = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      console.log(`🔥 Firebase: ${products.length} produits chargés`);
      return products;
    } catch (error) {
      console.error('❌ Erreur chargement produits Firebase:', error);
      return [];
    }
  },

  // ✅ Charger les produits d'une catégorie
  async productsByCategoryId(categoryId: string): Promise<Product[]> {
    try {
      const q = query(
        collection(db, 'products'), 
        where('categoryId', '==', categoryId)
      );
      const querySnapshot = await getDocs(q);
      const products = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      console.log(`🔥 Firebase: ${products.length} produits pour catégorie ${categoryId}`);
      return products;
    } catch (error) {
      console.error('❌ Erreur chargement produits par catégorie Firebase:', error);
      // Fallback simple
      const allProducts = await this.products();
      return allProducts.filter(p => String(p.categoryId) === String(categoryId));
    }
  }
};

export default firebaseApi;