import { initializeApp, getApps, getApp } from 'firebase/app';

import {
  initializeFirestore,
  persistentLocalCache,
  getFirestore
} from 'firebase/firestore';

import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence
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
export const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ---------- FIRESTORE ----------
let firestoreInstance;

try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,

    localCache: persistentLocalCache({
      cacheSizeBytes: 100 * 1024 * 1024 // 100MB
    })
  });
} catch (e) {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;

// ---------- STORAGE ----------
export const storage = getStorage(app);

// ---------- FUNCTIONS ----------
export const functions = getFunctions(app, 'europe-west1');

// ---------- AUTH ----------
const getAuthPersistence = () => {
  if (Platform.OS === 'web') {
    return [indexedDBLocalPersistence, browserLocalPersistence];
  }

  return getReactNativePersistence(AsyncStorage);
};

let authInstance;

try {
  authInstance = initializeAuth(app, {
    persistence: getAuthPersistence()
  });
} catch (e) {
  authInstance = getAuth(app);
}

export const auth = authInstance;
