import { initializeApp } from "firebase/app";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  updateDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDRl3TmG0xLlkSXCEEaFsgQ8m97wcT0xi0",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "assma-expresse.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "assma-expresse",
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET || "assma-expresse.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "251188713496",
  appId:
    process.env.FIREBASE_APP_ID ||
    "1:251188713496:web:65a63cba1a7be091dc0b6d",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snapshot = await getDocs(collection(db, "products"));
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const updates = {};

    if (!data.companyId) {
      updates.companyId = data.ownerId || data.sellerUid || "UNKNOWN";
    }

    if (!data.sellerUid) {
      updates.sellerUid = data.ownerId || "UNKNOWN";
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(doc(db, "products", docSnap.id), updates);
      updated += 1;
      console.log(`Updated ${docSnap.id}`, updates);
    } else {
      skipped += 1;
    }
  }

  console.log("Migration done", {
    total: snapshot.size,
    updated,
    skipped,
  });
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
