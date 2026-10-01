// apps/mobile/src/utils/authPatch.ts
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { resolveAuthorizedRole } from '@/utils/resolveAuthRole';

/**
 * 🔥 PATCH URGENT : Forcer la lecture du rôle sans écrire
 * Cette fonction contourne complètement le bug de l'AuthContext
 */
export const forceLoadUserRole = async (userId: string): Promise<string> => {
  try {
    console.log(`🔍 Force load role for user: ${userId}`);

    if (auth.currentUser && auth.currentUser.uid === userId) {
      const userDoc = await getDoc(doc(db, 'users', userId));
      const firestoreRole = userDoc.exists() ? userDoc.data()?.role : undefined;
      return resolveAuthorizedRole(auth.currentUser, firestoreRole);
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      const data = userDoc.data();
      console.warn('[auth-role] custom claim absent (pas de session), fallback Firestore', {
        uid: userId,
        firestoreRole: data.role,
      });
      return data.role || 'customer';
    }

    console.warn(`⚠️ Aucun document pour l'utilisateur: ${userId}`);
    return 'customer';
  } catch (error) {
    console.error('❌ Erreur forceLoadUserRole:', error);
    return 'customer';
  }
};

/**
 * Vérifier et corriger le rôle si nécessaire
 */
export const verifyAndFixUserRole = async (userId: string, expectedRole: string): Promise<boolean> => {
  try {
    const currentRole = await forceLoadUserRole(userId);
    
    if (currentRole !== expectedRole) {
      console.warn(`⚠️ Incohérence de rôle détectée: ${currentRole} ≠ ${expectedRole}`);
      console.warn(`👤 UserId: ${userId}`);
      
      // Ne pas corriger automatiquement, juste logger
      // La correction doit être manuelle
      
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erreur vérification rôle:', error);
    return false;
  }
};

/**
 * Log détaillé de l'état de l'utilisateur
 */
export const debugUserState = async (userId: string) => {
  console.log('=== DEBUG USER STATE ===');
  
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      console.log('📄 Document Firestore:', data);
      console.log('🆔 ID:', userId);
      console.log('🎭 Rôle:', data.role || 'NON DÉFINI');
      console.log('📅 Créé le:', data.createdAt?.toDate());
      console.log('🔄 Mis à jour le:', data.updatedAt?.toDate());
      console.log('🔗 Provider:', data.providerId);
    } else {
      console.log('❌ Aucun document Firestore');
    }
  } catch (error) {
    console.error('❌ Erreur debug:', error);
  }
  
  console.log('========================');
};