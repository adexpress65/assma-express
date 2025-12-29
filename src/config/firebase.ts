// apps/mobile/src/config/firebase.ts

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  setPersistence,
  inMemoryPersistence
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ==============================
// CONFIGURATION FIREBASE
// ==============================
const firebaseConfig = {
  apiKey: "AIzaSyDRl3TmG0xLlkSXCEEaFsgQ8m97wcT0xi0",
  authDomain: "assma-expresse.firebaseapp.com",
  projectId: "assma-expresse",
  storageBucket: "assma-expresse.firebasestorage.app",
  messagingSenderId: "251188713496",
  appId: "1:251188713496:web:65a63cba1a7be091dc0b6d",
  measurementId: "G-B4NKCCJHZE",
};

// ==============================
// INIT APP
// ==============================
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  console.log('✅ Firebase App initialisé');
} else {
  app = getApp();
  console.log('✅ Firebase App récupéré');
}

// ==============================
// 🔥 CORRECTION : AUTH AVEC PERSISTANCE
// ==============================
let auth;

try {
  // ESSAYER d'abord avec persistance React Native
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  console.log('✅ Auth initialisé avec persistance React Native');
  
} catch (error) {
  console.warn('⚠️ Erreur initialisation auth avec persistance:', error);
  
  // FALLBACK : Auth standard
  auth = getAuth(app);
  
  // 🔥 CORRECTION : NE PAS utiliser await au niveau global
  // Utiliser une fonction immédiatement invoquée
  (async () => {
    try {
      await setPersistence(auth, getReactNativePersistence(AsyncStorage));
      console.log('✅ Persistance configurée manuellement');
    } catch (persistenceError) {
      console.error('❌ Impossible de configurer la persistance:', persistenceError);
      
      try {
        await setPersistence(auth, inMemoryPersistence);
        console.warn('⚠️ Utilisation persistance en mémoire');
      } catch (memoryError) {
        console.error('❌ Même la persistance mémoire a échoué:', memoryError);
      }
    }
  })();
}

// ==============================
// SERVICES
// ==============================
const db = getFirestore(app);
const storage = getStorage(app);

/**
 * 🔥 CRITIQUE : Firebase Functions
 * La région DOIT correspondre au deploy
 */
const functions = getFunctions(app, "europe-west1");

// ==============================
// FONCTION DE DIAGNOSTIC (synchrone)
// ==============================
export const checkAuthState = () => {
  console.log('🔍 Diagnostic Auth:');
  
  // 1. Vérifier l'utilisateur actuel
  const user = auth.currentUser;
  console.log('👤 Current User:', user ? user.email : 'null');
  console.log('🆔 User ID:', user ? user.uid : 'null');
  console.log('✅ Email vérifié:', user ? user.emailVerified : 'N/A');
  
  return user;
};

// ==============================
// FONCTION POUR RÉPARER LA SESSION (asynchrone)
// ==============================
export const restoreAuthSession = async () => {
  console.log('🔄 Tentative de restauration de session...');
  
  try {
    // 1. Vérifier si l'utilisateur est déjà connecté
    if (auth.currentUser) {
      console.log('✅ Utilisateur déjà connecté:', auth.currentUser.email);
      return auth.currentUser;
    }
    
    // 2. Attendre un peu pour laisser Firebase se restaurer
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. Vérifier à nouveau
    if (auth.currentUser) {
      console.log('✅ Session restaurée par Firebase:', auth.currentUser.email);
      return auth.currentUser;
    }
    
    console.log('ℹ️ Aucune session à restaurer');
    return null;
    
  } catch (error) {
    console.error('❌ Erreur restauration session:', error);
    return null;
  }
};

// ==============================
// FONCTION POUR RÉPARER LA PERSISTANCE
// ==============================
export const fixAuthPersistence = async () => {
  console.log('🔧 Réparation persistance Auth...');
  
  try {
    // Sauvegarder l'utilisateur actuel
    const currentUser = auth.currentUser;
    const userEmail = currentUser?.email;
    
    if (currentUser) {
      console.log(`👤 Sauvegarde utilisateur: ${userEmail}`);
      const token = await currentUser.getIdToken();
      
      // Sauvegarder dans AsyncStorage
      await AsyncStorage.setItem('auth_backup_token', token);
      await AsyncStorage.setItem('auth_backup_email', userEmail || '');
      console.log('✅ Token sauvegardé');
    }
    
    // Reconfigurer la persistance
    await setPersistence(auth, getReactNativePersistence(AsyncStorage));
    console.log('✅ Persistance reconfigurée');
    
    // Restaurer si on avait un utilisateur
    if (currentUser) {
      console.log('✅ Session maintenue');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Erreur réparation persistance:', error);
    return false;
  }
};

// ==============================
// EXPORTS
// ==============================
export { app, auth, db, storage, functions };
export default app;