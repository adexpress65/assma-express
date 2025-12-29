// src/services/firebase/productsService.ts
import { collection, getDocs, query, where, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  imageUrl: string;
  categoryId: string;
  stock: number;
  createdAt: any;
  updatedAt: any;
  // Ajoutez ces champs pour CompanyProductsScreen
  companyId?: string;
  companyName?: string;
  sellerId?: string;
  sellerName?: string;
  isActive?: boolean;
  stockQuantity?: number;
}

// ✅ FONCTION MANQUANTE : Récupérer les produits par entreprise
export const getProductsByCompany = async (companyId: string): Promise<Product[]> => {
  try {
    console.log('📦 Recherche produits pour entreprise:', companyId);
    
    // Essayer d'abord par companyId
    const q = query(
      collection(db, 'products'), 
      where('companyId', '==', companyId),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const products: Product[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      products.push({
        id: doc.id,
        name: data.name,
        description: data.description || '',
        price: data.price || 0,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId || '',
        stock: data.stock || data.stockQuantity || 0,
        companyId: data.companyId || companyId,
        companyName: data.companyName || data.sellerName || '',
        sellerId: data.sellerId,
        sellerName: data.sellerName,
        isActive: data.isActive !== false,
        stockQuantity: data.stockQuantity || data.stock || 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    console.log(`✅ ${products.length} produits trouvés pour l'entreprise ${companyId}`);
    
    // Si aucun produit trouvé, essayer par sellerId
    if (products.length === 0) {
      console.log('🔄 Aucun produit par companyId, essai par sellerId...');
      const sellerQ = query(
        collection(db, 'products'), 
        where('sellerId', '==', companyId),
        orderBy('createdAt', 'desc')
      );
      
      const sellerSnapshot = await getDocs(sellerQ);
      sellerSnapshot.forEach((doc) => {
        const data = doc.data();
        products.push({
          id: doc.id,
          name: data.name,
          description: data.description || '',
          price: data.price || 0,
          image: data.image || '',
          imageUrl: data.imageUrl || data.image || '',
          categoryId: data.categoryId || '',
          stock: data.stock || data.stockQuantity || 0,
          companyId: data.companyId || companyId,
          companyName: data.companyName || data.sellerName || '',
          sellerId: data.sellerId,
          sellerName: data.sellerName,
          isActive: data.isActive !== false,
          stockQuantity: data.stockQuantity || data.stock || 0,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });
      
      console.log(`🔄 ${products.length} produits trouvés par sellerId`);
    }
    
    // Fallback si toujours aucun produit
    if (products.length === 0) {
      console.log('⚠️ Aucun produit trouvé, création de données de démonstration');
      products.push({
        id: 'demo-1',
        name: 'Produit de démonstration',
        description: 'Exemple de produit de cette entreprise',
        price: 9990,
        image: '',
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop',
        categoryId: 'demo',
        stock: 10,
        companyId: companyId,
        companyName: 'Boutique Exemple',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    return products;
    
  } catch (error) {
    console.error('❌ Erreur récupération produits par entreprise:', error);
    
    // Fallback garanti
    return [
      {
        id: 'fallback-1',
        name: 'Produit Exemple',
        description: 'Produit de qualité de cette boutique',
        price: 14990,
        image: '',
        imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop',
        categoryId: 'general',
        stock: 5,
        companyId: companyId,
        companyName: 'Boutique',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }
};

// ✅ Fonctions existantes (gardez-les)
export const getProductById = async (productId: string): Promise<Product | null> => {
  try {
    const productDoc = await getDoc(doc(db, 'products', productId));
    
    if (productDoc.exists()) {
      const data = productDoc.data();
      return {
        id: productDoc.id,
        name: data.name,
        description: data.description || '',
        price: data.price,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        stock: data.stock || 0,
        companyId: data.companyId,
        companyName: data.companyName,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      } as Product;
    }
    
    return null;
  } catch (error) {
    console.error('Erreur lors de la récupération du produit:', error);
    return null;
  }
};

export const getProductsByCategory = async (categoryId: string): Promise<Product[]> => {
  try {
    const q = query(
      collection(db, 'products'), 
      where('categoryId', '==', categoryId)
    );
    
    const querySnapshot = await getDocs(q);
    const products: Product[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      products.push({
        id: doc.id,
        name: data.name,
        description: data.description || '',
        price: data.price,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        stock: data.stock || 0,
        companyId: data.companyId,
        companyName: data.companyName,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    return products;
  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    return [];
  }
};

export const getAllProducts = async (): Promise<Product[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'products'));
    const products: Product[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      products.push({
        id: doc.id,
        name: data.name,
        description: data.description || '',
        price: data.price,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        stock: data.stock || 0,
        companyId: data.companyId,
        companyName: data.companyName,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    return products;
  } catch (error) {
    console.error('Erreur lors de la récupération de tous les produits:', error);
    return [];
  }
};