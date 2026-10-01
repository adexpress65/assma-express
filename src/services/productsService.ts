// services/firebase/productsService.ts
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  QueryConstraint,
  limit,
  orderBy,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getClientPriceXOF } from '../utils/productPrice';

// ============= INTERFACES =============
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  mainImage?: string;
  thumbnail?: string;
  images?: string[];
  categoryId: string;
  categoryName: string;
  companyId: string;
  companyName: string;
  sellerId: string;
  sellerName: string;
  featured?: boolean;
  newArrival?: boolean;
  stockQuantity: number;
  rating?: number;
  reviewCount?: number;
  isActive: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  tags?: string[];
  specifications?: Record<string, string>;
}

// ============= CONFIGURATION DU CACHE =============
const CACHE_TTL = 5 * 60 * 1000; 
const PRODUCTS_COLLECTION = 'products';
const MAX_CACHE_LIMIT = 500; // On ne met en cache global que les 500 premiers produits

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class ProductsCache {
  private allProductsCache: CacheEntry<Product[]> | null = null;
  private categoriesCache: Map<string, CacheEntry<Product[]>> = new Map();
  private pendingPromises: Map<string, Promise<any>> = new Map();

  private isValid(entry: CacheEntry<any> | null): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL;
  }

  getAllProducts(): Product[] | null {
    return this.isValid(this.allProductsCache) ? this.allProductsCache!.data : null;
  }

  getProductsByCategory(categoryId: string): Product[] | null {
    const entry = this.categoriesCache.get(categoryId);
    return this.isValid(entry) ? entry!.data : null;
  }

  setAllProducts(products: Product[]): void {
    this.allProductsCache = { data: products, timestamp: Date.now() };
    this.updateCategoryCachesFromAllProducts(products);
  }

  private updateCategoryCachesFromAllProducts(products: Product[]): void {
    const categoriesMap = new Map<string, Product[]>();
    products.forEach(product => {
      if (!categoriesMap.has(product.categoryId)) categoriesMap.set(product.categoryId, []);
      categoriesMap.get(product.categoryId)!.push(product);
    });
    categoriesMap.forEach((catProducts, categoryId) => {
      this.categoriesCache.set(categoryId, { data: catProducts, timestamp: Date.now() });
    });
  }

  setProductsByCategory(categoryId: string, products: Product[]): void {
    this.categoriesCache.set(categoryId, { data: products, timestamp: Date.now() });
  }

  getPendingPromise(key: string): Promise<any> | undefined {
    return this.pendingPromises.get(key);
  }

  setPendingPromise(key: string, promise: Promise<any>): void {
    this.pendingPromises.set(key, promise);
    promise.finally(() => this.pendingPromises.delete(key));
  }

  clear(): void {
    this.allProductsCache = null;
    this.categoriesCache.clear();
    this.pendingPromises.clear();
  }

  cleanExpired(): void {
    if (this.allProductsCache && !this.isValid(this.allProductsCache)) this.allProductsCache = null;
    for (const [id, entry] of this.categoriesCache.entries()) {
      if (!this.isValid(entry)) this.categoriesCache.delete(id);
    }
  }
}

const productsCache = new ProductsCache();

// ============= TRANSFORMATEUR =============
const transformProduct = (doc: any): Product => {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name || '',
    description: data.description || '',
    price: getClientPriceXOF(data),
    originalPrice: data.originalPrice,
    imageUrl: data.imageUrl || data.mainImage || data.thumbnail,
    mainImage: data.mainImage,
    thumbnail: data.thumbnail,
    images: data.images || [],
    categoryId: data.categoryId || '',
    categoryName: data.categoryName || '',
    companyId: data.companyId || '',
    companyName: data.companyName || '',
    sellerId: data.sellerId || '',
    sellerName: data.sellerName || '',
    featured: !!data.featured,
    newArrival: !!data.newArrival,
    stockQuantity: data.stockQuantity || 0,
    rating: data.rating || 0,
    reviewCount: data.reviewCount || 0,
    isActive: data.isActive !== undefined ? data.isActive : true,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    tags: data.tags || [],
    specifications: data.specifications || {}
  };
};

// ============= API PUBLIQUE =============

/**
 * 1. PAGINATION (La méthode la plus sûre pour la croissance)
 */
export const getProductsPaginated = async (
  lastDoc?: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number = 10,
  categoryId?: string
): Promise<{ products: Product[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> => {
  
  const productsRef = collection(db, PRODUCTS_COLLECTION);
  const constraints: QueryConstraint[] = [
    where('isActive', '==', true),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1)
  ];

  if (categoryId) constraints.unshift(where('categoryId', '==', categoryId));
  if (lastDoc) constraints.push(startAfter(lastDoc));

  const q = query(productsRef, ...constraints);
  const snapshot = await getDocs(q);
  
  const hasMore = snapshot.docs.length > pageSize;
  const resultDocs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
  const products = resultDocs.map(transformProduct);
  const newLastDoc = resultDocs.length > 0 ? resultDocs[resultDocs.length - 1] : null;

  return { products, lastDoc: newLastDoc, hasMore };
};

/**
 * 2. CHARGEMENT GLOBAL (Utilisé par le cache et les petits catalogues)
 */
export const getAllProducts = async (): Promise<Product[]> => {
  productsCache.cleanExpired();
  const cached = productsCache.getAllProducts();
  if (cached) return cached;

  const pendingKey = 'getAllProducts';
  const pending = productsCache.getPendingPromise(pendingKey);
  if (pending) return pending;

  const promise = (async () => {
    const productsRef = collection(db, PRODUCTS_COLLECTION);
    const q = query(productsRef, where('isActive', '==', true), limit(MAX_CACHE_LIMIT));
    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(transformProduct);
    productsCache.setAllProducts(products);
    return products;
  })();

  productsCache.setPendingPromise(pendingKey, promise);
  return promise;
};

/**
 * 3. RECHERCHE PAR NOM (Nouvelle fonction pour éviter de rater des produits)
 */
export const searchProductsByName = async (searchTerm: string): Promise<Product[]> => {
  if (!searchTerm) return [];
  
  // On commence par chercher dans le cache local pour la rapidité
  const cached = productsCache.getAllProducts();
  if (cached) {
    const localResults = cached.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (localResults.length > 5) return localResults; // Si on a assez de résultats, on s'arrête là
  }

  // Sinon, on fait une petite requête ciblée sur Firestore
  const productsRef = collection(db, PRODUCTS_COLLECTION);
  // Note: Firestore n'est pas idéal pour le "contains", on fait une recherche par préfixe
  const q = query(
    productsRef, 
    where('name', '>=', searchTerm), 
    where('name', '<=', searchTerm + '\uf8ff'),
    limit(20)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(transformProduct);
};

/**
 * 4. FONCTIONS UTILITAIRES
 */
export const getProductsByCategory = async (categoryId: string): Promise<Product[]> => {
  if (!categoryId) return [];
  const cached = productsCache.getProductsByCategory(categoryId);
  if (cached) return cached;

  const result = await getProductsPaginated(null, 40, categoryId);
  productsCache.setProductsByCategory(categoryId, result.products);
  return result.products;
};

export const getFeaturedProducts = async (limitCount: number = 20): Promise<Product[]> => {
  const all = await getAllProducts();
  return all.filter(p => p.featured).slice(0, limitCount);
};

export const clearProductsCache = () => productsCache.clear();