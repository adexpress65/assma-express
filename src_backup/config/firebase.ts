// src/config/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDRl3TmG0xLlkSXCEEaFsgQ8m97wcT0xi0",
  authDomain: "assma-expresse.firebaseapp.com",
  projectId: "assma-expresse",
  storageBucket: "assma-expresse.appspot.com", // ✅ corrigé ici
  messagingSenderId: "251188713496",
  appId: "1:251188713496:web:65a63cba1a7be091dc0b6d",
  measurementId: "G-BN4KCCJHZE",
};

// ✅ Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// ✅ Services Firebase
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ✅ Export global
export { auth, db, storage, app };
export default app;
