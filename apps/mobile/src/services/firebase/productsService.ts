// src/services/firebase/productsService.ts
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  type DocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { withTimeout } from '../../utils/promise';
import { getClientPriceXOF } from '../../utils/productPrice';

/** Limite le temps d’attente Firestore sur les écrans liste (évite blocages > 1 min). */
const PRODUCTS_LIST_READ_TIMEOUT_MS = 12_000;

export interface Product {
  id: string;
  name: string;
  description: string;
  name_en?: string;
  name_fr?: string;
  name_zh?: string;
  name_zh_CN?: string;
  description_en?: string;
  description_fr?: string;
  description_zh?: string;
  description_zh_CN?: string;
  translations?: Record<string, unknown>;
  i18n?: Record<string, unknown>;
  localized?: Record<string, unknown>;
  locale?: Record<string, unknown>;
  price: number;
  image: string;
  imageUrl: string;
  mainImage?: string;
  categoryId: string;
  /** Affichage filtres boutique */
  categoryName?: string;
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
  supplier?: string;
  originWarehouseId?: string | null;
  originWarehouseLabel?: string | null;
}

const DEFAULT_SHOP_PAGE = 28;

function mapProductDoc(docSnap: QueryDocumentSnapshot | DocumentSnapshot): Product {
  const data = docSnap.data();
  if (!data) {
    return {
      id: docSnap.id,
      name: '',
      description: '',
      price: 0,
      image: '',
      imageUrl: '',
      categoryId: '',
      stock: 0,
      createdAt: null,
      updatedAt: null,
    };
  }
  return {
    id: docSnap.id,
    name: data.name,
    description: data.description || '',
    name_en: data.name_en || data.nameEn,
    name_fr: data.name_fr || data.nameFr,
    name_zh: data.name_zh || data.nameZh,
    name_zh_CN: data.name_zh_CN || data.name_zhCN || data.nameZhCn,
    description_en: data.description_en || data.descriptionEn,
    description_fr: data.description_fr || data.descriptionFr,
    description_zh: data.description_zh || data.descriptionZh,
    description_zh_CN: data.description_zh_CN || data.description_zhCN || data.descriptionZhCn,
    translations: data.translations,
    i18n: data.i18n,
    localized: data.localized,
    locale: data.locale,
    price: getClientPriceXOF(data),
    image: data.image || '',
    imageUrl: data.imageUrl || data.image || '',
    mainImage: data.mainImage,
    categoryId: data.categoryId || '',
    categoryName: data.categoryName || data.category || '',
    stock: data.stock || data.stockQuantity || 0,
    companyId: data.companyId,
    companyName: data.companyName || data.sellerName || '',
    sellerId: data.sellerId,
    sellerName: data.sellerName,
    isActive: data.isActive !== false,
    stockQuantity: data.stockQuantity || data.stock || 0,
    supplier: data.supplier,
    originWarehouseId: data.originWarehouseId ?? null,
    originWarehouseLabel: data.originWarehouseLabel ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export type CompanyProductSource = 'companyId' | 'sellerId';

/**
 * Pagination boutique (évite de télécharger tout le catalogue Firestore).
 */
export async function getProductsByCompanyPage(
  companyId: string,
  pageSize: number,
  source: CompanyProductSource,
  lastDoc?: QueryDocumentSnapshot | null,
): Promise<{
  products: Product[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}> {
  try {
    const coll = collection(db, 'products');
    const field = source === 'companyId' ? 'companyId' : 'sellerId';
    const buildQuery = (includeActive: boolean) => {
      const parts = includeActive
        ? [
            where(field, '==', companyId),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
          ]
        : [where(field, '==', companyId), orderBy('createdAt', 'desc')];
      return lastDoc
        ? query(coll, ...parts, startAfter(lastDoc), limit(pageSize))
        : query(coll, ...parts, limit(pageSize));
    };

    let snapshot: QuerySnapshot;
    try {
      snapshot = await withTimeout(
        getDocs(buildQuery(true)),
        PRODUCTS_LIST_READ_TIMEOUT_MS,
        { docs: [] } as QuerySnapshot,
      );
    } catch (activeErr) {
      console.warn('[getProductsByCompanyPage] isActive index fallback', activeErr);
      snapshot = await withTimeout(
        getDocs(buildQuery(false)),
        PRODUCTS_LIST_READ_TIMEOUT_MS,
        { docs: [] } as QuerySnapshot,
      );
    }

    const visibleDocs = snapshot.docs.filter((d) => d.data()?.isActive === true);
    const products = visibleDocs.map(mapProductDoc);
    const newLast =
      snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    return {
      products,
      lastDoc: newLast,
      hasMore: snapshot.docs.length === pageSize,
    };
  } catch (e) {
    console.error('[getProductsByCompanyPage]', e);
    return { products: [], lastDoc: null, hasMore: false };
  }
}

/** Première page : `companyId`, sinon `sellerId`. */
export async function getProductsByCompanyFirstPage(
  companyId: string,
  pageSize = DEFAULT_SHOP_PAGE,
): Promise<{
  products: Product[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
  source: CompanyProductSource;
}> {
  const byCompany = await getProductsByCompanyPage(
    companyId,
    pageSize,
    'companyId',
    null,
  );
  if (byCompany.products.length > 0) {
    return { ...byCompany, source: 'companyId' };
  }
  const bySeller = await getProductsByCompanyPage(
    companyId,
    pageSize,
    'sellerId',
    null,
  );
  return { ...bySeller, source: 'sellerId' };
}

// ✅ FONCTION MANQUANTE : Récupérer les produits par entreprise
export const getProductsByCompany = async (companyId: string): Promise<Product[]> => {
  try {
    console.log('📦 Recherche produits pour entreprise:', companyId);
    
    // Essayer d'abord par companyId
    /** Sans limite, un grossiste avec des milliers de SKU bloquait l’ouverture de la boutique plusieurs minutes. */
    const COMPANY_PRODUCTS_CAP = 300;
    const loadCompanyDocs = async (field: 'companyId' | 'sellerId') => {
      try {
        return await getDocs(
          query(
            collection(db, 'products'),
            where(field, '==', companyId),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
            limit(COMPANY_PRODUCTS_CAP),
          ),
        );
      } catch (indexErr) {
        console.warn('[getProductsByCompany] isActive index fallback', field, indexErr);
        return getDocs(
          query(
            collection(db, 'products'),
            where(field, '==', companyId),
            orderBy('createdAt', 'desc'),
            limit(COMPANY_PRODUCTS_CAP),
          ),
        );
      }
    };

    const querySnapshot = await loadCompanyDocs('companyId');
    const products: Product[] = querySnapshot.docs
      .filter((d) => d.data()?.isActive === true)
      .map((d) => {
      const p = mapProductDoc(d);
      return { ...p, companyId: p.companyId || companyId };
    });
    
    console.log(`✅ ${products.length} produits trouvés pour l'entreprise ${companyId}`);
    
    // Si aucun produit trouvé, essayer par sellerId
    if (products.length === 0) {
      console.log('🔄 Aucun produit par companyId, essai par sellerId...');
      const sellerSnapshot = await loadCompanyDocs('sellerId');
      products.push(
        ...sellerSnapshot.docs
          .filter((d) => d.data()?.isActive === true)
          .map((d) => {
          const p = mapProductDoc(d);
          return { ...p, companyId: p.companyId || companyId };
        }),
      );
      
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
      if (productDoc.data()?.isActive !== true) {
        return null;
      }
      return mapProductDoc(productDoc);
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
      where('categoryId', '==', categoryId),
      orderBy('createdAt', 'desc'),
      limit(200),
    );

    const querySnapshot = await getDocs(q);
    const products: Product[] = querySnapshot.docs.map(mapProductDoc);
    
    return products;
  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    return [];
  }
};

/**
 * Récupère uniquement les derniers produits (pour affichage rapide).
 * Evite de télécharger toute la collection (très lent).
 */
export const getLatestProducts = async (count: number): Promise<Product[]> => {
  try {
    const q = query(
      collection(db, 'products'),
      orderBy('createdAt', 'desc'),
      limit(count)
    );

    const querySnapshot = await withTimeout<QuerySnapshot | null>(
      getDocs(q),
      PRODUCTS_LIST_READ_TIMEOUT_MS,
      null,
    );
    if (querySnapshot === null) {
      if (__DEV__) {
        console.warn('[getLatestProducts] timeout');
      }
      return [];
    }
    const products: Product[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      products.push({
        id: docSnap.id,
        name: data.name,
        description: data.description || '',
        price: getClientPriceXOF(data),
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId || '',
        stock: data.stock || data.stockQuantity || 0,
        companyId: data.companyId,
        companyName: data.companyName,
        sellerId: data.sellerId,
        sellerName: data.sellerName,
        isActive: data.isActive !== false,
        stockQuantity: data.stockQuantity || data.stock || 0,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    return products;
  } catch (error) {
    console.error('❌ Erreur récupération derniers produits:', error);
    return [];
  }
};

/**
 * Pagination simple par catégorie (ordre par createdAt desc).
 */
export const getProductsByCategoryPaginated = async (
  categoryId: string,
  pageSize: number,
  lastDoc?: QueryDocumentSnapshot
): Promise<{
  products: Product[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}> => {
  try {
    const baseQuery = query(
      collection(db, 'products'),
      where('categoryId', '==', categoryId),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    const q = lastDoc
      ? query(
          collection(db, 'products'),
          where('categoryId', '==', categoryId),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(pageSize)
        )
      : baseQuery;

    const querySnapshot = await withTimeout<QuerySnapshot | null>(
      getDocs(q),
      PRODUCTS_LIST_READ_TIMEOUT_MS,
      null,
    );
    if (querySnapshot === null) {
      if (__DEV__) {
        console.warn('[getProductsByCategoryPaginated] timeout', { categoryId });
      }
      return { products: [], lastDoc: null, hasMore: false };
    }
    const products: Product[] = [];

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      products.push({
        id: docSnap.id,
        name: data.name,
        description: data.description || '',
        price: getClientPriceXOF(data),
        image: data.image || '',
        imageUrl: data.imageUrl || data.image || '',
        categoryId: data.categoryId,
        stock: data.stock || 0,
        companyId: data.companyId,
        companyName: data.companyName,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    const newLastDoc =
      querySnapshot.docs.length > 0
        ? querySnapshot.docs[querySnapshot.docs.length - 1]
        : null;

    return {
      products,
      lastDoc: newLastDoc,
      hasMore: querySnapshot.docs.length === pageSize,
    };
  } catch (error) {
    console.error('❌ Erreur pagination produits par catégorie:', error);
    return { products: [], lastDoc: null, hasMore: false };
  }
};

/**
 * @deprecated Ne lit plus toute la collection (risque minutes + quota). Derniers produits seulement.
 */
export const getAllProducts = async (): Promise<Product[]> => {
  try {
    const querySnapshot = await getDocs(
      query(
        collection(db, 'products'),
        orderBy('createdAt', 'desc'),
        limit(120),
      ),
    );
    return querySnapshot.docs.map(mapProductDoc);
  } catch (error) {
    console.error('Erreur lors de la récupération de tous les produits:', error);
    return [];
  }
};