import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
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

// ---------- CONFIG ----------
export const firebaseWebConfig = {
  apiKey: "AIzaSyDRl3TmG0xLlkSXCEEaFsgQ8m97wcT0xi0",
  authDomain: "assma-expresse.firebaseapp.com",
  projectId: "assma-expresse",
  storageBucket: "assma-expresse.firebasestorage.app",
  messagingSenderId: "251188713496",
  appId: "1:251188713496:web:65a63cba1a7be091dc0b6d"
};

const firebaseConfig = firebaseWebConfig;

// ---------- APP INITIALIZATION ----------
// On vérifie si l'application est déjà initialisée pour éviter les crashs au rechargement (Hot Reload)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ---------- FIRESTORE (OPTIMISÉ POUR LE MALI) ----------
let firestoreDb;

try {
  // On tente d'initialiser avec les options d'optimisation réseau
  firestoreDb = initializeFirestore(app, {
    // Force long polling (souvent plus fiable que WebChannel sur RN / réseaux instables).
    // Un log "WebChannelConnection ... transport errored" peut encore apparaître une fois :
    // le SDK retente automatiquement ; ce n’est en général pas une panne définitive.
    experimentalForceLongPolling: true,

    // Délai max d’une requête long-polling (SDK : 5–30 s). Sur 4G / réseaux lents, la valeur
    // par défaut peut couper trop tôt ; 30 s limite les faux « offline » côté transport.
    // NB : le message « Backend didn't respond within 10 seconds » vient d’un autre minuteur
    // interne (état « en ligne ») : il n’est pas exposé dans l’API ; si le réseau est vraiment
    // coupé ou filtré (firewall, DNS), le client passe en mode hors ligne puis se resynchronise.
    experimentalLongPollingOptions: {
      timeoutSeconds: 30,
    },

    // Désactive les flux de lecture qui peuvent causer des erreurs sur certains Android
    useFetchStreams: false,
    
    // Configuration du cache local pour un accès instantané aux données
    localCache: persistentLocalCache({
      cacheSizeBytes: 200 * 1024 * 1024, // 200MB de cache
      // persistentSingleTabManager est recommandé pour React Native (vs MultipleTab sur Web)
      tabManager: Platform.OS === 'web' ? undefined : persistentSingleTabManager()
    })
  });
} catch (error) {
  // Si déjà initialisé (pendant le développement), on récupère l'instance existante
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;

// ---------- STORAGE ----------
export const storage = getStorage(app);

// ---------- FUNCTIONS ----------
export const functions = getFunctions(app, "europe-west1");

// ---------- AUTH (AVEC PERSISTANCE MOBILE) ----------
const getAuthPersistence = () => {
  if (Platform.OS === "web") {
    return [indexedDBLocalPersistence, browserLocalPersistence];
  }
  // Utilise AsyncStorage pour que l'utilisateur reste connecté même après fermeture de l'app
  return getReactNativePersistence(AsyncStorage);
};

let authInstance;

try {
  authInstance = initializeAuth(app, {
    persistence: getAuthPersistence()
  });
} catch (error) {
  // En cas de crash au rechargement, on récupère l'instance Auth standard
  authInstance = getAuth(app);
}

export const auth = authInstance;