import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  browserLocalPersistence, // Importé pour le Web
  indexedDBLocalPersistence // Importé pour le Web
} from 'firebase/auth';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDRl3TmG0xLlkSXCEEaFsgQ8m97wcT0xi0',
  authDomain: 'assma-expresse.firebaseapp.com',
  projectId: 'assma-expresse',
  storageBucket: 'assma-expresse.firebasestorage.app',
  messagingSenderId: '251188713496',
  appId: '1:251188713496:web:65a63cba1a7be091dc0b6d',
};

// ---------- APP ----------
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ---------- FIRESTORE ----------
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// ---------- STORAGE ----------
export const storage = getStorage(app);

// ---------- FUNCTIONS ----------
export const functions = getFunctions(app, 'europe-west1');

// ---------- AUTH (Fix Web & Mobile) ----------
const getAuthPersistence = () => {
  if (Platform.OS === 'web') {
    // Sur Web, on utilise IndexedDB ou LocalStorage (standard Firebase Web)
    return [indexedDBLocalPersistence, browserLocalPersistence];
  }
  // Sur Mobile, on garde AsyncStorage pour tes mises à jour OTA
  return getReactNativePersistence(AsyncStorage);
};

let authInstance;

try {
  authInstance = initializeAuth(app, {
    persistence: getAuthPersistence(),
  });
} catch (e) {
  authInstance = getAuth(app);
}

export const auth = authInstance;