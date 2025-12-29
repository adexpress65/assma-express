// src/services/firebase/categoriesService.ts
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface Category {
  id: string;
  name: string;
  image: string;
  productCount: number;
}

export const getCategories = async (): Promise<Category[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, 'categories'));
    const categories: Category[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      categories.push({
        id: doc.id,
        name: data.name,
        image: data.image,
        productCount: data.productCount
      });
    });
    
    return categories;
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    return [];
  }
};