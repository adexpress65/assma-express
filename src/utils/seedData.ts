// apps/mobile/src/utils/seedData.ts
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

// 🎯 DONNÉES DE TEST POUR ASMA EXPRESS
const sampleProducts = [
  {
    name: "iPhone 15 Pro Max 256GB",
    price: 1299.99,
    originalPrice: 1499.99,
    image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400",
    category: "electronics",
    seller: "TechWorld Premium",
    rating: 4.8,
    sales: 1250,
    wholesalePrice: 1169.99,
    minOrder: 3,
    isPremium: true,
    tags: ["trending", "premium", "new"],
    description: "Dernier iPhone avec puce A17 Pro, appareil photo 48MP et design titane.",
    stock: 150,
    brand: "Apple"
  },
  {
    name: "Samsung Galaxy S24 Ultra",
    price: 899.99,
    originalPrice: 999.99,
    image: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400",
    category: "electronics",
    seller: "MobileExpert Pro",
    rating: 4.6,
    sales: 890,
    wholesalePrice: 809.99,
    minOrder: 5,
    isPremium: true,
    tags: ["bestseller", "android", "premium"],
    description: "Écran 6.8 pouces, S-Pen inclus, processeur Snapdragon 8 Gen 3.",
    stock: 200,
    brand: "Samsung"
  },
  {
    name: "MacBook Air M3 13\"",
    price: 1499.99,
    originalPrice: 1599.99,
    image: "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400",
    category: "computers",
    seller: "Apple Premium Reseller",
    rating: 4.9,
    sales: 450,
    wholesalePrice: 1349.99,
    minOrder: 2,
    isPremium: true,
    tags: ["new", "premium", "laptop"],
    description: "Ultra-fin et léger, puce M3, autonomie 18h.",
    stock: 75,
    brand: "Apple"
  },
  {
    name: "Casque Sony WH-1000XM5",
    price: 349.99,
    originalPrice: 399.99,
    image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400",
    category: "audio",
    seller: "AudioPro Shop",
    rating: 4.7,
    sales: 1200,
    wholesalePrice: 314.99,
    minOrder: 10,
    isPremium: true,
    tags: ["noise-cancelling", "bestseller", "wireless"],
    description: "Réduction de bruit exceptionnelle, son haute qualité.",
    stock: 300,
    brand: "Sony"
  }
];

// 🚀 FONCTION PRINCIPALE POUR AJOUTER LES DONNÉES
export const seedProducts = async () => {
  try {
    console.log('🔄 Début de l\'ajout des produits de test...');
    
    // Vérifier si des produits existent déjà
    const existingProducts = await getDocs(collection(db, 'products'));
    if (!existingProducts.empty) {
      console.log('📦 Produits déjà existants, ajout annulé');
      return { success: true, count: existingProducts.size };
    }
    
    let addedCount = 0;
    
    for (const product of sampleProducts) {
      await addDoc(collection(db, 'products'), {
        ...product,
        createdAt: new Date(),
        isActive: true,
        currency: 'EUR'
      });
      addedCount++;
      console.log(`✅ Ajouté: ${product.name}`);
    }
    
    console.log(`🎉 ${addedCount} produits ajoutés avec succès!`);
    return { success: true, count: addedCount };
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout des produits:', error);
    return { success: false, error };
  }
};

export default seedProducts;