// apps/mobile/scripts/firebase-seed.ts
import { collection, doc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ✅ Configuration Firebase
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

// ✅ SÉQUENCES CORRECTES DES IMAGES
const IMAGE_SEQUENCES = {
  'Machines': [
    'IMG-20250928-WA0010.jpg',
    'IMG-20250928-WA0011.jpg',
    'IMG-20250928-WA0012.jpg',
    'IMG-20250928-WA0013.jpg',
    'IMG-20250928-WA0014.jpg',
    'IMG-20250928-WA0015.jpg',
    'IMG-20250928-WA0016.jpg',
    'IMG-20250928-WA0017.jpg',
    'IMG-20250928-WA0018.jpg'
  ],
  'Électroniques': [
    'IMG-20250928-WA0074.jpg',
    'IMG-20250928-WA0075.jpg',
    'IMG-20250928-WA0076.jpg',
    'IMG-20250928-WA0077.jpg'
  ],
  'Modes': [
    'IMG-20250928-WA0005.jpg',
    'IMG-20250928-WA0004.jpg',
    'IMG-20250928-WA0006.jpg',
    'IMG-20250928-WA0007.jpg',
    'IMG-20250928-WA0008.jpg',
    'IMG-20250928-WA0009.jpg',
    'IMG-20250928-WA0024.jpg',
    'IMG-20250928-WA0025.jpg',
    'IMG-20250928-WA0026.jpg',
    'IMG-20250928-WA0027.jpg',
    'IMG-20250928-WA0028.jpg',
    'IMG-20250928-WA0029.jpg',
    'IMG-20250928-WA0052.jpg',
    'IMG-20250928-WA0053.jpg',
    'IMG-20250928-WA0054.jpg',
    'IMG-20250928-WA0055.jpg'
  ],
  'Maisons et jardin': [
    'IMG-20250928-WA0040.jpg',
    'IMG-20250928-WA0041.jpg',
    'IMG-20250928-WA0042.jpg'
  ],
  'Automobile et Moto': [
    'IMG-20250928-WA0050.jpg',
    'IMG-20250928-WA0051.jpg'
  ]
};

// ✅ Données de seeding avec les bonnes URLs d'images
const SEED_DATA = {
  categories: [
    {
      name: "Machines",
      image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=300",
      productCount: 9
    },
    {
      name: "Électroniques", 
      image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=300",
      productCount: 4
    },
    {
      name: "Modes",
      image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=300",
      productCount: 16
    },
    {
      name: "Maisons et jardin",
      image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=300", 
      productCount: 3
    },
    {
      name: "Automobile et Moto",
      image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300",
      productCount: 2
    }
  ]
};

// Fonction pour créer les produits avec les bonnes images
function createProductsWithCorrectImages() {
  const BASE_URL = "https://images.produitsasmaexpress.honronyadigital.com";
  
  return [
    // Machines (9 produits)
    ...IMAGE_SEQUENCES['Machines'].map((imageFile, index) => ({
      name: `Machine ${index + 1}`,
      description: `Machine performante de haute qualité ${index + 1}`,
      price: Math.floor(Math.random() * 50000) + 10000,
      imageUrl: `${BASE_URL}/Machines/${imageFile}`,
      categoryId: "", // À remplir après création des catégories
      stock: Math.floor(Math.random() * 100) + 10,
      createdAt: new Date(),
      updatedAt: new Date()
    })),
    
    // Électroniques (4 produits)
    ...IMAGE_SEQUENCES['Électroniques'].map((imageFile, index) => ({
      name: `Électronique ${index + 1}`,
      description: `Appareil électronique dernier cri ${index + 1}`,
      price: Math.floor(Math.random() * 20000) + 5000,
      imageUrl: `${BASE_URL}/Électroniques/${imageFile}`,
      categoryId: "", // À remplir après création des catégories
      stock: Math.floor(Math.random() * 50) + 5,
      createdAt: new Date(),
      updatedAt: new Date()
    })),
    
    // Modes (16 produits)
    ...IMAGE_SEQUENCES['Modes'].map((imageFile, index) => ({
      name: `Article Mode ${index + 1}`,
      description: `Vêtement tendance et confortable ${index + 1}`,
      price: Math.floor(Math.random() * 15000) + 2000,
      imageUrl: `${BASE_URL}/Modes/${imageFile}`,
      categoryId: "", // À remplir après création des catégories
      stock: Math.floor(Math.random() * 80) + 10,
      createdAt: new Date(),
      updatedAt: new Date()
    })),
    
    // Maisons et jardin (3 produits)
    ...IMAGE_SEQUENCES['Maisons et jardin'].map((imageFile, index) => ({
      name: `Article Maison ${index + 1}`,
      description: `Produit pour la maison et le jardin ${index + 1}`,
      price: Math.floor(Math.random() * 25000) + 3000,
      imageUrl: `${BASE_URL}/Maisons et jardin/${imageFile}`,
      categoryId: "", // À remplir après création des catégories
      stock: Math.floor(Math.random() * 40) + 5,
      createdAt: new Date(),
      updatedAt: new Date()
    })),
    
    // Automobile et Moto (2 produits)
    ...IMAGE_SEQUENCES['Automobile et Moto'].map((imageFile, index) => ({
      name: `Accessoire Auto ${index + 1}`,
      description: `Accessoire automobile et moto ${index + 1}`,
      price: Math.floor(Math.random() * 30000) + 8000,
      imageUrl: `${BASE_URL}/Automobile et Moto/${imageFile}`,
      categoryId: "", // À remplir après création des catégories
      stock: Math.floor(Math.random() * 30) + 3,
      createdAt: new Date(),
      updatedAt: new Date()
    }))
  ];
}

async function seedFirebase() {
  console.log("🌱 Début du seeding Firebase...");

  try {
    // 1. CRÉER LES CATÉGORIES
    console.log("📂 Création des catégories...");
    const categoryIds: { [key: string]: string } = {};
    
    for (const catData of SEED_DATA.categories) {
      const categoryRef = doc(collection(db, 'categories'));
      await setDoc(categoryRef, {
        name: catData.name,
        image: catData.image,
        productCount: catData.productCount,
        createdAt: new Date()
      });
      
      categoryIds[catData.name] = categoryRef.id;
      console.log(`✅ Catégorie créée: ${catData.name} (ID: ${categoryRef.id})`);
    }

    // 2. CRÉER LES PRODUITS AVEC LES BONNES IMAGES
    console.log("📦 Création des produits avec les bonnes URLs d'images...");
    const products = createProductsWithCorrectImages();
    let productIndex = 0;
    
    for (const category of SEED_DATA.categories) {
      const categoryId = categoryIds[category.name];
      const productsCount = category.productCount;
      
      for (let i = 0; i < productsCount; i++) {
        const productData = products[productIndex];
        const productRef = doc(collection(db, 'products'));
        
        await setDoc(productRef, {
          ...productData,
          categoryId: categoryId,
          id: productRef.id
        });
        
        console.log(`✅ Produit créé: ${productData.name}`);
        console.log(`   🖼 Image: ${productData.imageUrl}`);
        productIndex++;
      }
    }

    // 3. CRÉER UN UTILISATEUR TEST
    console.log("👤 Création utilisateur test...");
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        "test@assma.com", 
        "123456"
      );
      console.log(`✅ Utilisateur créé: ${userCredential.user.email}`);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        console.log("ℹ️ Utilisateur test existe déjà");
      } else {
        console.error("❌ Erreur création utilisateur:", error);
      }
    }

    console.log("🎉 Seeding Firebase terminé avec succès !");
    console.log(`📊 Résumé: ${SEED_DATA.categories.length} catégories, ${products.length} produits créés`);
    
  } catch (error) {
    console.error("❌ Erreur pendant le seeding Firebase:", error);
  }
}

// Exécuter le script
seedFirebase();