// utils/migration.ts - MIGRER LES PRODUITS EXISTANTS
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const migrateExistingProducts = async () => {
  try {
    const productsSnapshot = await getDocs(collection(db, 'products'));
    const migrationPromises: Promise<void>[] = [];

    productsSnapshot.forEach((productDoc) => {
      const productData = productDoc.data();
      
      // Vérifier si le produit a déjà la nouvelle structure
      if (!productData.createdBy || !productData.companyId) {
        const updatedProduct = {
          // Garder les données existantes
          ...productData,
          
          // Ajouter les champs manquants
          createdBy: productData.creatorId ? 'admin' : 'company',
          creatorId: productData.creatorId || productData.companyId,
          status: 'published',
          currency: productData.currency || 'XOF',
          isVerified: productData.isVerified || false,
          featured: productData.featured || false,
          viewCount: productData.viewCount || 0,
          favoriteCount: productData.favoriteCount || 0,
          updatedAt: new Date(),
        };

        migrationPromises.push(
          updateDoc(doc(db, 'products', productDoc.id), updatedProduct)
        );
        
        console.log(`🔄 Migration produit: ${productDoc.id}`);
      }
    });

    await Promise.all(migrationPromises);
    console.log(`✅ Migration terminée: ${migrationPromises.length} produits mis à jour`);
    
  } catch (error) {
    console.error('❌ Erreur migration:', error);
  }
};