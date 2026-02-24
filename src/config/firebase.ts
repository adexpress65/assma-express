// src/config/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence
} from 'firebase/auth';
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
export const db = getFirestore(app);

// ---------- STORAGE ----------
export const storage = getStorage(app);

// ---------- FUNCTIONS (NGenius / Backend) ----------
export const functions = getFunctions(app, 'europe-west1');

// ---------- AUTH SAFE (React Native / Expo / Reload Safe) ----------
let authInstance;

try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // Auth déjà initialisée (hot reload / reload Expo)
  authInstance = getAuth(app);
}

export const auth = authInstance;
