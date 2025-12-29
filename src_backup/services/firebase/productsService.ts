import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  getDoc, 
  orderBy, 
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  imageUrl: string;
  categoryId: string;
  categoryName?: string;
  sellerId: string;
  seller: string;
  stock: number;
  rating: number;
  sales: number;
  status: 'approved' | 'pending' | 'rejected';
  isPremium: boolean;
  wholesalePrice?: number;
  minOrder?: number;
  tags: string[];
  features?: string[];
  createdAt: any;
  updatedAt: any;
}

export interface CreateProductData {
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  imageUrl: string;
  categoryId: string;
  categoryName?: string;
  stock: number;
  wholesalePrice?: number;
  minOrder?: number;
  tags: string[];
  features?: string[];
}

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
        originalPrice: data.originalPrice,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        sellerId: data.sellerId,
        seller: data.seller,
        stock: data.stock || 0,
        rating: data.rating || 0,
        sales: data.sales || 0,
        status: data.status || 'pending',
        isPremium: data.isPremium || false,
        wholesalePrice: data.wholesalePrice,
        minOrder: data.minOrder,
        tags: data.tags || [],
        features: data.features || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      } as Product;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur récupération produit:', error);
    return null;
  }
};

export const getProductsByCategory = async (categoryId: string): Promise<Product[]> => {
  try {
    const q = query(
      collection(db, 'products'), 
      where('categoryId', '==', categoryId),
      where('status', '==', 'approved'),
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
        price: data.price,
        originalPrice: data.originalPrice,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        sellerId: data.sellerId,
        seller: data.seller,
        stock: data.stock || 0,
        rating: data.rating || 0,
        sales: data.sales || 0,
        status: data.status || 'approved',
        isPremium: data.isPremium || false,
        wholesalePrice: data.wholesalePrice,
        minOrder: data.minOrder,
        tags: data.tags || [],
        features: data.features || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    console.log(`✅ ${products.length} produits approuvés chargés pour catégorie: ${categoryId}`);
    return products;
  } catch (error) {
    console.error('❌ Erreur récupération produits par catégorie:', error);
    return [];
  }
};

export const getAllProducts = async (): Promise<Product[]> => {
  try {
    const q = query(
      collection(db, 'products'),
      where('status', '==', 'approved'),
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
        price: data.price,
        originalPrice: data.originalPrice,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        sellerId: data.sellerId,
        seller: data.seller,
        stock: data.stock || 0,
        rating: data.rating || 0,
        sales: data.sales || 0,
        status: data.status || 'approved',
        isPremium: data.isPremium || false,
        wholesalePrice: data.wholesalePrice,
        minOrder: data.minOrder,
        tags: data.tags || [],
        features: data.features || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    console.log(`✅ ${products.length} produits approuvés chargés`);
    return products;
  } catch (error) {
    console.error('❌ Erreur récupération tous les produits:', error);
    return [];
  }
};

export const getAllProductsForAdmin = async (): Promise<Product[]> => {
  try {
    const q = query(
      collection(db, 'products'),
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
        price: data.price,
        originalPrice: data.originalPrice,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        sellerId: data.sellerId,
        seller: data.seller,
        stock: data.stock || 0,
        rating: data.rating || 0,
        sales: data.sales || 0,
        status: data.status || 'pending',
        isPremium: data.isPremium || false,
        wholesalePrice: data.wholesalePrice,
        minOrder: data.minOrder,
        tags: data.tags || [],
        features: data.features || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    console.log(`✅ ${products.length} produits chargés (tous statuts)`);
    return products;
  } catch (error) {
    console.error('❌ Erreur récupération produits admin:', error);
    return [];
  }
};

export const getProductsBySeller = async (sellerId: string): Promise<Product[]> => {
  try {
    const q = query(
      collection(db, 'products'),
      where('sellerId', '==', sellerId),
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
        price: data.price,
        originalPrice: data.originalPrice,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        sellerId: data.sellerId,
        seller: data.seller,
        stock: data.stock || 0,
        rating: data.rating || 0,
        sales: data.sales || 0,
        status: data.status || 'pending',
        isPremium: data.isPremium || false,
        wholesalePrice: data.wholesalePrice,
        minOrder: data.minOrder,
        tags: data.tags || [],
        features: data.features || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    console.log(`✅ ${products.length} produits chargés pour vendeur: ${sellerId}`);
    return products;
  } catch (error) {
    console.error('❌ Erreur récupération produits vendeur:', error);
    return [];
  }
};

export const getPendingProducts = async (): Promise<Product[]> => {
  try {
    const q = query(
      collection(db, 'products'),
      where('status', '==', 'pending'),
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
        price: data.price,
        originalPrice: data.originalPrice,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        sellerId: data.sellerId,
        seller: data.seller,
        stock: data.stock || 0,
        rating: data.rating || 0,
        sales: data.sales || 0,
        status: data.status || 'pending',
        isPremium: data.isPremium || false,
        wholesalePrice: data.wholesalePrice,
        minOrder: data.minOrder,
        tags: data.tags || [],
        features: data.features || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    console.log(`✅ ${products.length} produits en attente chargés`);
    return products;
  } catch (error) {
    console.error('❌ Erreur récupération produits en attente:', error);
    return [];
  }
};

export const getTrendingProducts = async (maxResults: number = 10): Promise<Product[]> => {
  try {
    const q = query(
      collection(db, 'products'),
      where('status', '==', 'approved'),
      where('sales', '>=', 10),
      orderBy('sales', 'desc'),
      limit(maxResults)
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
        originalPrice: data.originalPrice,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        sellerId: data.sellerId,
        seller: data.seller,
        stock: data.stock || 0,
        rating: data.rating || 0,
        sales: data.sales || 0,
        status: data.status || 'approved',
        isPremium: data.isPremium || false,
        wholesalePrice: data.wholesalePrice,
        minOrder: data.minOrder,
        tags: data.tags || [],
        features: data.features || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    console.log(`✅ ${products.length} produits tendances chargés`);
    return products;
  } catch (error) {
    console.error('❌ Erreur récupération produits tendances:', error);
    return [];
  }
};

export const getNewArrivals = async (maxResults: number = 10): Promise<Product[]> => {
  try {
    const q = query(
      collection(db, 'products'),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
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
        originalPrice: data.originalPrice,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        sellerId: data.sellerId,
        seller: data.seller,
        stock: data.stock || 0,
        rating: data.rating || 0,
        sales: data.sales || 0,
        status: data.status || 'approved',
        isPremium: data.isPremium || false,
        wholesalePrice: data.wholesalePrice,
        minOrder: data.minOrder,
        tags: data.tags || [],
        features: data.features || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    console.log(`✅ ${products.length} nouvelles arrivées chargées`);
    return products;
  } catch (error) {
    console.error('❌ Erreur récupération nouvelles arrivées:', error);
    return [];
  }
};

export const getFlashSales = async (maxResults: number = 10): Promise<Product[]> => {
  try {
    const q = query(
      collection(db, 'products'),
      where('status', '==', 'approved'),
      where('originalPrice', '>', 0),
      orderBy('originalPrice', 'desc'),
      limit(maxResults)
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
        originalPrice: data.originalPrice,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        sellerId: data.sellerId,
        seller: data.seller,
        stock: data.stock || 0,
        rating: data.rating || 0,
        sales: data.sales || 0,
        status: data.status || 'approved',
        isPremium: data.isPremium || false,
        wholesalePrice: data.wholesalePrice,
        minOrder: data.minOrder,
        tags: data.tags || [],
        features: data.features || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    console.log(`✅ ${products.length} produits en solde chargés`);
    return products;
  } catch (error) {
    console.error('❌ Erreur récupération produits en solde:', error);
    return [];
  }
};

export const getPremiumProducts = async (maxResults: number = 10): Promise<Product[]> => {
  try {
    const q = query(
      collection(db, 'products'),
      where('status', '==', 'approved'),
      where('isPremium', '==', true),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
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
        originalPrice: data.originalPrice,
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        categoryName: data.categoryName,
        sellerId: data.sellerId,
        seller: data.seller,
        stock: data.stock || 0,
        rating: data.rating || 0,
        sales: data.sales || 0,
        status: data.status || 'approved',
        isPremium: data.isPremium || false,
        wholesalePrice: data.wholesalePrice,
        minOrder: data.minOrder,
        tags: data.tags || [],
        features: data.features || [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    console.log(`✅ ${products.length} produits premium chargés`);
    return products;
  } catch (error) {
    console.error('❌ Erreur récupération produits premium:', error);
    return [];
  }
};

export const createProduct = async (
  productData: CreateProductData, 
  sellerId: string, 
  sellerName: string
): Promise<string | null> => {
  try {
    const productWithMetadata = {
      ...productData,
      sellerId,
      seller: sellerName,
      rating: 0,
      sales: 0,
      status: 'pending',
      isPremium: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const docRef = await addDoc(collection(db, 'products'), productWithMetadata);
    console.log(`✅ Produit créé avec ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('❌ Erreur création produit:', error);
    return null;
  }
};

export const updateProduct = async (
  productId: string, 
  updateData: Partial<CreateProductData>
): Promise<boolean> => {
  try {
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      ...updateData,
      updatedAt: Timestamp.now()
    });
    
    console.log(`✅ Produit ${productId} mis à jour`);
    return true;
  } catch (error) {
    console.error('❌ Erreur mise à jour produit:', error);
    return false;
  }
};

export const deleteProduct = async (productId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, 'products', productId));
    console.log(`✅ Produit ${productId} supprimé`);
    return true;
  } catch (error) {
    console.error('❌ Erreur suppression produit:', error);
    return false;
  }
};

export const updateProductStatus = async (
  productId: string, 
  status: 'approved' | 'pending' | 'rejected'
): Promise<boolean> => {
  try {
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      status,
      updatedAt: Timestamp.now()
    });
    
    console.log(`✅ Statut produit ${productId} mis à jour: ${status}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur mise à jour statut produit:', error);
    return false;
  }
};

export const updateProductStock = async (
  productId: string, 
  newStock: number
): Promise<boolean> => {
  try {
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      stock: newStock,
      updatedAt: Timestamp.now()
    });
    
    console.log(`✅ Stock produit ${productId} mis à jour: ${newStock}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur mise à jour stock produit:', error);
    return false;
  }
};

export const searchProducts = async (searchTerm: string): Promise<Product[]> => {
  try {
    const allProducts = await getAllProducts();
    
    const filteredProducts = allProducts.filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.tags && product.tags.some(tag => 
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      ))
    );
    
    console.log(`✅ ${filteredProducts.length} produits trouvés pour: "${searchTerm}"`);
    return filteredProducts;
  } catch (error) {
    console.error('❌ Erreur recherche produits:', error);
    return [];
  }
};