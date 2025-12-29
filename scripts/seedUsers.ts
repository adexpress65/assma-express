// src/scripts/seedUsers.ts
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";



// 🧱 Même config que ton fichier src/config/firebase.ts
const firebaseConfig = {
  apiKey: "AIzaSyDRl3TmG0xLlkSXCEEaFsgQ8m97wcT0xi0",
  authDomain: "assma-expresse.firebaseapp.com",
  projectId: "assma-expresse",
  storageBucket: "assma-expresse.firebasestorage.app",
  messagingSenderId: "251188713496",
  appId: "1:251188713496:web:65a63cba1a7be091dc0b6d",
  measurementId: "G-BN4KCCJHZE"
};

// 🚀 Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 👥 Données des utilisateurs à insérer
const fakeUsers = [
  {
    uid: "u001",
    displayName: "Aïcha Konaté",
    email: "aicha.konate@example.com",
    photoURL: "https://randomuser.me/api/portraits/women/65.jpg",
    bio: "Passionnée d’entrepreneuriat et d’agriculture 🌾",
    online: true,
    role: "user",
    location: "Bamako",
  },
  {
    uid: "u002",
    displayName: "Moussa Traoré",
    email: "moussa.traore@example.com",
    photoURL: "https://randomuser.me/api/portraits/men/52.jpg",
    bio: "Développeur mobile et créateur de contenu 💻",
    online: false,
    role: "user",
    location: "Ségou",
  },
  {
    uid: "u003",
    displayName: "Fatou Diarra",
    email: "fatou.diarra@example.com",
    photoURL: "https://randomuser.me/api/portraits/women/33.jpg",
    bio: "Amatrice de mode et d’innovation 💅🏾",
    online: true,
    role: "user",
    location: "Kayes",
  },
  {
    uid: "u004",
    displayName: "Abdoulaye Coulibaly",
    email: "abdoulaye.coulibaly@example.com",
    photoURL: "https://randomuser.me/api/portraits/men/41.jpg",
    bio: "Fan de tech, musique et sport ⚽",
    online: true,
    role: "user",
    location: "Koutiala",
  },
  {
    uid: "u005",
    displayName: "Nana Diallo",
    email: "nana.diallo@example.com",
    photoURL: "https://randomuser.me/api/portraits/women/75.jpg",
    bio: "Journaliste digitale et exploratrice 🌍",
    online: false,
    role: "user",
    location: "Bamako",
  },
];

// 🧠 Fonction principale
async function seedUsers() {
  console.log("🚀 Démarrage du seed des utilisateurs...");
  try {
    for (const user of fakeUsers) {
      const docRef = await addDoc(collection(db, "users"), {
        ...user,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        followers: 0,
        following: 0,
        livesHosted: 0,
        livesJoined: 0,
      });
      console.log(`✅ Utilisateur ajouté: ${user.displayName} (ID Firestore: ${docRef.id})`);
    }
    console.log("🎉 Seed terminé avec succès !");
  } catch (error) {
    console.error("❌ Erreur lors du seed:", error);
  }
}

// ▶️ Exécution
seedUsers();
