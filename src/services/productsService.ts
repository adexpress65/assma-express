// services/firebase/productsService.ts
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  Timestamp 
} from "firebase/firestore";
import { db } from "../config/firebase";

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  image?: string;
  images?: string[];
  categoryId: string;
  category?: string;
  featured?: boolean;
  inStock?: boolean;
  stock?: number;
  brand?: string;
  sellerId?: string;
  sellerName?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  status?: string;
  verified?: boolean;
  discount?: number;
}

// ✅ Récupérer les produits par catégorie (celle que vous avez déjà)
export async function getProductsByCategory(categoryId: string): Promise<Product[]> {
  try {
    console.log(`📥 Chargement produits catégorie ${categoryId}...`);
    const ref = collection(db, "products");
    const q = query(
      ref, 
      where("categoryId", "==", categoryId),
      where("status", "==", "active"),
      limit(50)
    );

    const snap = await getDocs(q);
    const products = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        discount: data.originalPrice && data.price 
          ? Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100)
          : 0
      } as Product;
    });

    console.log(`📦 ${products.length} produits chargés pour catégorie ${categoryId}`);
    return products;
  } catch (error) {
    console.error("❌ Erreur Firestore (getProductsByCategory):", error);
    return [];
  }
}

// ✅ Produits en vedette (featured: true)
export async function getFeaturedProducts(): Promise<Product[]> {
  try {
    console.log("⭐ Chargement produits en vedette...");
    const ref = collection(db, "products");
    
    const q = query(
      ref, 
      where("featured", "==", true),
      where("status", "==", "active"),
      limit(20)
    );

    const snap = await getDocs(q);
    
    // Si aucun produit n'est marqué comme featured, prendre les derniers produits
    if (snap.empty) {
      console.log("⚠️ Aucun produit featured, chargement des derniers produits...");
      const q2 = query(
        ref,
        where("status", "==", "active"),
        orderBy("createdAt", "desc"),
        limit(10)
      );
      const snap2 = await getDocs(q2);
      const products = snap2.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          discount: data.originalPrice && data.price 
            ? Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100)
            : 0,
          featured: true // On les marque comme featured pour l'affichage
        } as Product;
      });
      
      console.log(`🌟 ${products.length} derniers produits chargés (fallback)`);
      return products;
    }

    const products = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        discount: data.originalPrice && data.price 
          ? Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100)
          : 0
      } as Product;
    });

    console.log(`🌟 ${products.length} produits en vedette chargés`);
    return products;
  } catch (error) {
    console.error("❌ Erreur Firestore (getFeaturedProducts):", error);
    return [];
  }
}

// ✅ Offres spéciales (produits avec réduction)
export async function getSpecialOffers(): Promise<Product[]> {
  try {
    console.log("🎯 Chargement offres spéciales...");
    const ref = collection(db, "products");
    
    // Prendre tous les produits actifs
    const q = query(
      ref, 
      where("status", "==", "active"),
      limit(100)
    );

    const snap = await getDocs(q);
    
    // Filtrer côté client pour les produits avec réduction
    const allProducts = snap.docs.map((doc) => {
      const data = doc.data();
      const discount = data.originalPrice && data.price 
        ? Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100)
        : 0;
      
      return {
        id: doc.id,
        ...data,
        discount
      } as Product;
    });

    // Prendre les produits avec discount > 0
    const specialOffers = allProducts
      .filter(product => (product.discount || 0) > 0)
      .sort((a, b) => (b.discount || 0) - (a.discount || 0))
      .slice(0, 20);

    console.log(`🔥 ${specialOffers.length} offres spéciales trouvées`);
    return specialOffers;
  } catch (error) {
    console.error("❌ Erreur Firestore (getSpecialOffers):", error);
    return [];
  }
}

// ✅ Nouveaux produits
export async function getNewArrivals(): Promise<Product[]> {
  try {
    console.log("🆕 Chargement nouveaux produits...");
    const ref = collection(db, "products");
    
    const q = query(
      ref, 
      where("status", "==", "active"),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const snap = await getDocs(q);
    const products = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        discount: data.originalPrice && data.price 
          ? Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100)
          : 0
      } as Product;
    });

    console.log(`📦 ${products.length} nouveaux produits chargés`);
    return products;
  } catch (error) {
    console.error("❌ Erreur Firestore (getNewArrivals):", error);
    return [];
  }
}

// ✅ Récupérer un produit par ID
export async function getProductById(productId: string): Promise<Product | null> {
  try {
    console.log(`📥 Chargement produit ${productId}...`);
    const ref = collection(db, "products");
    const q = query(ref, where("__name__", "==", productId));

    const snap = await getDocs(q);
    
    if (snap.empty) {
      console.log(`⚠️ Produit ${productId} non trouvé`);
      return null;
    }

    const data = snap.docs[0].data();
    const product = {
      id: snap.docs[0].id,
      ...data,
      discount: data.originalPrice && data.price 
        ? Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100)
        : 0
    } as Product;

    console.log(`✅ Produit ${productId} chargé: ${product.name}`);
    return product;
  } catch (error) {
    console.error("❌ Erreur Firestore (getProductById):", error);
    return null;
  }
}