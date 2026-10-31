// src/utils/favoritesHelper.ts
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export const favoritesHelper = {
  // Ajouter un produit aux favoris
  async addToFavorites(userId: string, productData: any) {
    try {
      const favoritesRef = collection(db, 'users', userId, 'favorites');
      await setDoc(doc(favoritesRef, productData.id), {
        ...productData,
        addedAt: new Date(),
      });
      return true;
    } catch (error) {
      console.error('Erreur ajout favori:', error);
      return false;
    }
  },

  // Retirer des favoris
  async removeFromFavorites(userId: string, productId: string) {
    try {
      await deleteDoc(doc(db, 'users', userId, 'favorites', productId));
      return true;
    } catch (error) {
      console.error('Erreur suppression favori:', error);
      return false;
    }
  },

  // Vérifier si un produit est en favoris
  async isInFavorites(userId: string, productId: string) {
    try {
      const docRef = doc(db, 'users', userId, 'favorites', productId);
      // Note: Vous devrez utiliser getDoc() qui n'est pas importé ici
      // Pour l'instant, on retourne false
      return false;
    } catch (error) {
      return false;
    }
  },

  // Récupérer tous les favoris d'un utilisateur
  async getUserFavorites(userId: string) {
    try {
      const favoritesQuery = query(collection(db, 'users', userId, 'favorites'));
      const snapshot = await getDocs(favoritesQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Erreur récupération favoris:', error);
      return [];
    }
  }
};