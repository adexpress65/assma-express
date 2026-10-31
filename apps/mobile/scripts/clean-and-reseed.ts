// apps/mobile/scripts/clean-and-reseed.ts
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// ✅ Configuration Firebase (identique à votre autre script)
const firebaseConfig = {
  apiKey: "AIzaSyDRl3TmG0xLlkSXCEEaFsgQ8m97wcT0xi0",
  authDomain: "assma-expresse.firebaseapp.com",
  projectId: "assma-expresse",
  storageBucket: "assma-expresse.firebasestorage.app",
  messagingSenderId: "251188713496",
  appId: "1:251188713496:web:65a63cba1a7be091dc0b6d"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanDatabase() {
  console.log("🧹 Nettoyage de la base de données Firebase...");

  try {
    // 1. SUPPRIMER TOUS LES PRODUITS
    console.log("🗑️ Suppression des produits...");
    const productsSnapshot = await getDocs(collection(db, 'products'));
    let productsDeleted = 0;
    
    for (const doc of productsSnapshot.docs) {
      await deleteDoc(doc.ref);
      productsDeleted++;
    }
    console.log(`✅ ${productsDeleted} produits supprimés`);

    // 2. SUPPRIMER TOUTES LES CATÉGORIES
    console.log("🗑️ Suppression des catégories...");
    const categoriesSnapshot = await getDocs(collection(db, 'categories'));
    let categoriesDeleted = 0;
    
    for (const doc of categoriesSnapshot.docs) {
      await deleteDoc(doc.ref);
      categoriesDeleted++;
    }
    console.log(`✅ ${categoriesDeleted} catégories supprimées`);

    console.log("🎯 Base de données complètement nettoyée !");
    
  } catch (error) {
    console.error("❌ Erreur lors du nettoyage:", error);
  }
}

// Exécuter le nettoyage
cleanDatabase();