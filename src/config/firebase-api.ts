// apps/mobile/src/config/firebase-api.ts
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';
import { db } from './firebase';

// Interfaces
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

// Fonction toImage améliorée
export function toImage(path?: string): string {
  if (!path) return "https://via.placeholder.com/200x200?text=No+Image";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return "https://via.placeholder.com/200x200?text=No+Image";
}

// API Firebase avec gestion d'erreurs améliorée
export const firebaseApi = {
  // 📦 Charger toutes les catégories avec gestion offline
  async categories(): Promise<Category[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'categories'));
      const categories = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      
      console.log(`✅ Firebase: ${categories.length} catégories chargées`);
      return categories;
    } catch (error: any) {
      console.warn('⚠️ Mode offline - utilisation données en cache:', error?.message);
      
      // Données d'exemple en cas d'erreur
      const fallbackCategories: Category[] = [
        {
          id: '1',
          name: 'Électronique',
          image: 'https://via.placeholder.com/200x200?text=Électronique'
        },
        {
          id: '2', 
          name: 'Mode',
          image: 'https://via.placeholder.com/200x200?text=Mode'
        }
      ];
      
      return fallbackCategories;
    }
  },

  // 📦 Charger tous les produits avec gestion offline
  async products(): Promise<Product[]> {
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const products = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      console.log(`✅ Firebase: ${products.length} produits chargés`);
      return products;
    } catch (error: any) {
      console.warn('⚠️ Mode offline - utilisation données en cache:', error?.message);
      
      // Données d'exemple en cas d'erreur
      const fallbackProducts: Product[] = [
        {
          id: '1',
          name: 'Produit Exemple 1',
          price: 29.99,
          description: 'Description exemple',
          image: 'https://via.placeholder.com/200x200?text=Produit+1'
        },
        {
          id: '2',
          name: 'Produit Exemple 2', 
          price: 39.99,
          description: 'Description exemple',
          image: 'https://via.placeholder.com/200x200?text=Produit+2'
        }
      ];
      
      return fallbackProducts;
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
      
      console.log(`✅ Firebase: ${products.length} produits pour catégorie ${categoryId}`);
      return products;
    } catch (error: any) {
      console.warn('⚠️ Mode offline - fallback produits:', error?.message);
      
      // Fallback vers tous les produits filtrés
      try {
        const allProducts = await this.products();
        return allProducts.filter(p => String(p.categoryId) === String(categoryId));
      } catch {
        return [];
      }
    }
  }
};

export default firebaseApi;