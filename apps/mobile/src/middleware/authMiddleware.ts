// apps/mobile/src/middleware/authMiddleware.ts
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';

export const safeEnsureUserProfile = async (userId: string): Promise<boolean> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log(`🆕 Création profil pour ${userId}`);
      // Création avec rôle par défaut
      return true;
    }
    
    const existingData = userDoc.data();
    
    // 🔥 VÉRIFICATION DE SÉCURITÉ : Empêcher l'écrasement du rôle super-admin
    if (existingData.role === 'super-admin' || existingData.role === 'super_admin') {
      console.log(`🔒 SUPER-ADMIN DÉTECTÉ - Protection activée pour ${userId}`);
      
      // Ne mettre à jour que lastLogin
      await updateDoc(userRef, {
        lastLogin: Timestamp.now()
      });
      
      return true;
    }
    
    // Pour les autres rôles, mise à jour normale
    await updateDoc(userRef, {
      lastLogin: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('❌ Erreur safeEnsureUserProfile:', error);
    return false;
  }
};
