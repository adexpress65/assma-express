import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface Category {
  id: string;
  name: string;
  description: string;
  image: string;
  productCount: number;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

// ✅ RÉCUPÉRER TOUTES LES CATÉGORIES
export const getCategories = async (): Promise<Category[]> => {
  try {
    const q = query(
      collection(db, 'categories'), 
      orderBy('name', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const categories: Category[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      categories.push({
        id: doc.id,
        name: data.name,
        description: data.description || '',
        image: data.image || '',
        productCount: data.productCount || 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    console.log(`✅ ${categories.length} catégories chargées`);
    return categories;
  } catch (error) {
    console.error('❌ Erreur récupération catégories:', error);
    return [];
  }
};

// ✅ RÉCUPÉRER UNE CATÉGORIE PAR ID
export const getCategoryById = async (categoryId: string): Promise<Category | null> => {
  try {
    const categoryDoc = await getDoc(doc(db, 'categories', categoryId));
    
    if (categoryDoc.exists()) {
      const data = categoryDoc.data();
      return {
        id: categoryDoc.id,
        name: data.name,
        description: data.description || '',
        image: data.image || '',
        productCount: data.productCount || 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      } as Category;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Erreur récupération catégorie:', error);
    return null;
  }
};

// ✅ RÉCUPÉRER LES CATÉGORIES POPULAIRES
export const getPopularCategories = async (limit: number = 8): Promise<Category[]> => {
  try {
    const q = query(
      collection(db, 'categories'),
      orderBy('productCount', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const categories: Category[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      categories.push({
        id: doc.id,
        name: data.name,
        description: data.description || '',
        image: data.image || '',
        productCount: data.productCount || 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      });
    });
    
    // Retourner les catégories les plus populaires
    return categories.slice(0, limit);
  } catch (error) {
    console.error('❌ Erreur récupération catégories populaires:', error);
    return [];
  }
};