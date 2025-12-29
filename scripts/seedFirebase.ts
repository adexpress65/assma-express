// apps/mobile/script/seedFirebase.ts - VERSION SIMPLIFIÉE
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  Timestamp 
} from 'firebase/firestore';

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDRl3TmG0xLlkSXCEEaFsgQ8m97wcT0xi0",
  authDomain: "assma-expresse.firebaseapp.com",
  projectId: "assma-expresse",
  storageBucket: "assma-expresse.firebasestorage.app",
  messagingSenderId: "251188713496",
  appId: "1:251188713496:web:65a63cba1a7be091dc0b6d",
  measurementId: "G-BN4KCCJHZE"
};

// Initialisation
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Interfaces
interface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'super-admin' | 'admin' | 'seller' | 'customer';
  company?: string;
  phone?: string;
  createdAt: any;
  isActive: boolean;
}

interface Product {
  id?: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  seller: string;
  sellerId: string;
  rating: number;
  sales: number;
  description: string;
  stock: number;
  status: 'approved' | 'pending' | 'rejected';
  isPremium: boolean;
  wholesalePrice?: number;
  minOrder?: number;
  tags: string[];
  features?: string[];
  createdAt: any;
  updatedAt: any;
}

interface Category {
  name: string;
  description: string;
  image: string;
  productCount: number;
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

// Données de test
const usersData: Omit<User, 'uid'>[] = [
  {
    email: 'superadmin@asmaexpress.com',
    displayName: 'Directeur ASMA Express',
    role: 'super-admin',
    company: 'ASMA Express',
    phone: '+212 600 000 001',
    createdAt: Timestamp.now(),
    isActive: true
  },
  {
    email: 'admin@asmaexpress.com',
    displayName: 'Modérateur ASMA',
    role: 'admin',
    company: 'ASMA Express',
    phone: '+212 600 000 002',
    createdAt: Timestamp.now(),
    isActive: true
  },
  {
    email: 'techworld@example.com',
    displayName: 'TechWorld Premium',
    role: 'seller',
    company: 'TechWorld SARL',
    phone: '+212 600 000 003',
    createdAt: Timestamp.now(),
    isActive: true
  },
  {
    email: 'mobileexpert@example.com',
    displayName: 'MobileExpert Pro',
    role: 'seller',
    company: 'MobileExpert SA',
    phone: '+212 600 000 004',
    createdAt: Timestamp.now(),
    isActive: true
  },
  {
    email: 'client1@example.com',
    displayName: 'Jean Dupont',
    role: 'customer',
    phone: '+212 600 000 005',
    createdAt: Timestamp.now(),
    isActive: true
  },
  {
    email: 'client2@example.com',
    displayName: 'Marie Martin',
    role: 'customer',
    phone: '+212 600 000 006',
    createdAt: Timestamp.now(),
    isActive: true
  }
];

const categoriesData: Category[] = [
  {
    name: "Électronique",
    description: "Smartphones, ordinateurs, accessoires tech",
    image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400",
    productCount: 0,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    name: "Mode & Vêtements",
    description: "Vêtements, chaussures, accessoires mode",
    image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=400",
    productCount: 0,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    name: "Maison & Jardin",
    description: "Meubles, décoration, électroménager",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400",
    productCount: 0,
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  }
];

const productsData: Omit<Product, 'id'>[] = [
  {
    name: "iPhone 15 Pro Max 256GB",
    price: 1299,
    originalPrice: 1499,
    image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400",
    category: "Électronique",
    seller: "TechWorld Premium",
    sellerId: "",
    rating: 4.8,
    sales: 150,
    description: "Dernier iPhone avec écran Dynamic Island et camera 48MP.",
    stock: 25,
    status: "approved",
    isPremium: true,
    wholesalePrice: 1150,
    minOrder: 5,
    tags: ["apple", "iphone", "smartphone", "premium"],
    features: ["5G", "Face ID", "iOS 17", "Camera 48MP"],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  },
  {
    name: "Samsung Galaxy S24 Ultra",
    price: 1199,
    originalPrice: 1399,
    image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400",
    category: "Électronique",
    seller: "MobileExpert Pro",
    sellerId: "",
    rating: 4.7,
    sales: 89,
    description: "Smartphone Android avec S-Pen et camera 200MP.",
    stock: 18,
    status: "approved",
    isPremium: true,
    wholesalePrice: 1050,
    minOrder: 3,
    tags: ["samsung", "android", "smartphone", "s-pen"],
    features: ["S-Pen", "200MP Camera", "Snapdragon 8 Gen 3"],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  }
];

// Fonction pour créer un utilisateur
async function createUser(userData: Omit<User, 'uid'>): Promise<string | null> {
  try {
    console.log(`🔄 Création de l'utilisateur: ${userData.email}`);
    
    const userCredential = await createUserWithEmailAndPassword(
      auth, 
      userData.email, 
      'password123'
    );
    
    const uid = userCredential.user.uid;
    console.log(`✅ Utilisateur Auth créé: ${userData.email}`);

    await setDoc(doc(db, 'users', uid), {
      ...userData,
      uid
    });
    
    console.log(`✅ Utilisateur Firestore créé: ${userData.displayName}`);
    return uid;

  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      console.log(`⚠️ Utilisateur déjà existant: ${userData.email}`);
      try {
        const userCredential = await signInWithEmailAndPassword(auth, userData.email, 'password123');
        const uid = userCredential.user.uid;
        
        await setDoc(doc(db, 'users', uid), {
          ...userData,
          uid
        }, { merge: true });
        
        console.log(`✅ Utilisateur Firestore mis à jour: ${userData.displayName}`);
        return uid;
      } catch (signInError) {
        console.error(`❌ Erreur connexion:`, signInError);
        return null;
      }
    } else {
      console.error(`❌ Erreur création utilisateur:`, error);
      return null;
    }
  }
}

// Fonction principale
async function seedFirebase() {
  try {
    console.log('🌱 Début du peuplement de la base de données...');
    
    const userIds: string[] = [];
    const sellerIds: string[] = [];

    // 1. Déconnexion
    console.log('🔐 Déconnexion...');
    try {
      await signOut(auth);
      console.log('✅ Déconnecté');
    } catch (error) {
      console.log('ℹ️ Aucun compte à déconnecter');
    }

    // 2. Création des utilisateurs
    console.log('\n👥 Création des utilisateurs...');
    for (const userData of usersData) {
      const uid = await createUser(userData);
      if (uid) {
        userIds.push(uid);
        if (userData.role === 'seller') {
          sellerIds.push(uid);
        }
      }
    }

    // 3. Création des catégories
    console.log('\n📂 Création des catégories...');
    for (const categoryData of categoriesData) {
      try {
        await addDoc(collection(db, 'categories'), categoryData);
        console.log(`✅ Catégorie: ${categoryData.name}`);
      } catch (error) {
        console.error(`❌ Erreur catégorie ${categoryData.name}:`, error);
      }
    }

    // 4. Création des produits
    console.log('\n📦 Création des produits...');
    let createdProducts = 0;
    for (const productData of productsData) {
      try {
        let sellerId = '';
        if (productData.seller === "TechWorld Premium" && sellerIds[0]) {
          sellerId = sellerIds[0];
        } else if (productData.seller === "MobileExpert Pro" && sellerIds[1]) {
          sellerId = sellerIds[1];
        }

        if (!sellerId) {
          console.log(`⚠️ Seller non trouvé pour: ${productData.name}`);
          continue;
        }

        const productWithSeller = {
          ...productData,
          sellerId
        };

        await addDoc(collection(db, 'products'), productWithSeller);
        console.log(`✅ Produit: ${productData.name}`);
        createdProducts++;
        
      } catch (error) {
        console.error(`❌ Erreur produit ${productData.name}:`, error);
      }
    }

    // Rapport final
    console.log('\n' + '='.repeat(50));
    console.log('🎉 PEUPLEMENT TERMINÉ AVEC SUCCÈS!');
    console.log('='.repeat(50));
    console.log(`👥 Utilisateurs: ${userIds.length}`);
    console.log(`🏪 Vendeurs: ${sellerIds.length}`);
    console.log(`📦 Produits: ${createdProducts}`);
    console.log(`📂 Catégories: ${categoriesData.length}`);
    
    console.log('\n🔑 IDENTIFIANTS (mot de passe: password123):');
    console.log('- Super Admin: superadmin@asmaexpress.com');
    console.log('- Admin: admin@asmaexpress.com');  
    console.log('- Vendeurs: techworld@example.com, mobileexpert@example.com');

  } catch (error) {
    console.error('❌ ERREUR CRITIQUE:', error);
  } finally {
    try {
      await signOut(auth);
      console.log('\n🔒 Déconnecté');
    } catch (error) {}
  }
}

// Exécution
if (require.main === module) {
  seedFirebase()
    .then(() => {
      console.log('\n✅ Script terminé!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erreur script:', error);
      process.exit(1);
    });
}

export default seedFirebase;