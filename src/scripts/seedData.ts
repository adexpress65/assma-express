import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';  // Chemin corrigé

export const runSeed = async () => {
  console.log(' Démarrage de la création des données Firebase...');

  const products = [
    {
      name: "Smartphone Android 8GB RAM 128GB",
      price: 150000,
      originalPrice: 200000,
      discountPercent: 25,
      image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300",
      category: "electronics",
      salesCount: 7757,
      rating: 4.5,
      origin: "China",
      deliveryDays: "14-20",
      shippingCost: 1200,
      isVerified: true,
      isNew: true,
      supplierId: "supp_tech001",
      vendorName: "Tech Manufacturer Co.",
      description: "Smartphone haute performance avec écran 6.5 pouces OLED, 8GB RAM, 128GB stockage.",
      createdAt: new Date()
    },
    {
      name: "Casque Bluetooth Sans Fil",
      price: 45000,
      originalPrice: 60000,
      discountPercent: 25,
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300",
      category: "electronics",
      salesCount: 3245,
      rating: 4.3,
      origin: "China", 
      deliveryDays: "10-15",
      shippingCost: 800,
      isVerified: true,
      supplierId: "supp_tech001",
      vendorName: "Tech Manufacturer Co.",
      description: "Casque audio sans fil avec réduction de bruit active. Autonomie de 30 heures.",
      createdAt: new Date()
    }
  ];

  try {
    console.log(' Ajout des produits...');
    for (const product of products) {
      const docRef = await addDoc(collection(db, 'products'), product);
      console.log(' Produit ajouté:', product.name);
    }
    console.log(' Données créées avec succès!');
  } catch (error) {
    console.error(' Erreur:', error);
  }
};
