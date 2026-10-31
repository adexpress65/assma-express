// apps/mobile/src/scripts/seedData.js
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const seedProducts = async () => {
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
      wholesalePrice: 135000,
      minQuantity: 10,
      supplierId: "supp_tech001",
      vendorName: "Tech Manufacturer Co.",
      description: "Smartphone haute performance avec écran 6.5 pouces OLED, 8GB RAM, 128GB stockage. Parfait pour le gaming et la productivité.",
      createdAt: new Date(),
      updatedAt: new Date()
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
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Montre Connectée Sport",
      price: 75000,
      originalPrice: 90000,
      discountPercent: 17,
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300",
      category: "electronics",
      salesCount: 1890,
      rating: 4.2,
      origin: "China",
      deliveryDays: "12-18", 
      shippingCost: 1000,
      isVerified: true,
      isNew: true,
      supplierId: "supp_tech002",
      vendorName: "Smart Gadgets Ltd",
      description: "Montre connectée avec suivi d'activité, moniteur cardiaque et notification des appaux.",
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Power Bank 20000mAh",
      price: 25000,
      originalPrice: 35000,
      discountPercent: 29,
      image: "https://images.unsplash.com/photo-1609592810794-3cbcb1e35ece?w=300",
      category: "electronics",
      salesCount: 5678,
      rating: 4.4,
      origin: "China",
      deliveryDays: "8-12",
      shippingCost: 600,
      isVerified: true,
      wholesalePrice: 22000,
      minQuantity: 20,
      supplierId: "supp_tech002", 
      vendorName: "Smart Gadgets Ltd",
      description: "Batterie externe haute capacité 20000mAh avec charge rapide pour tous vos appareils.",
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Tablette Android 10 Pouces",
      price: 120000,
      originalPrice: 150000,
      discountPercent: 20,
      image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=300",
      category: "electronics",
      salesCount: 1234,
      rating: 4.1,
      origin: "China",
      deliveryDays: "15-25",
      shippingCost: 1500,
      isVerified: true,
      isNew: true,
      supplierId: "supp_tech001",
      vendorName: "Tech Manufacturer Co.",
      description: "Tablette Android avec écran Full HD 10 pouces, 4GB RAM, 64GB stockage.",
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      name: "Écouteurs True Wireless",
      price: 35000,
      originalPrice: 50000,
      discountPercent: 30,
      image: "https://images.unsplash.com/photo-1590658165737-15a047b8b5e0?w=300",
      category: "electronics",
      salesCount: 4321,
      rating: 4.0,
      origin: "China",
      deliveryDays: "7-10",
      shippingCost: 500,
      isVerified: true,
      supplierId: "supp_tech002",
      vendorName: "Smart Gadgets Ltd",
      description: "Écouteurs true wireless avec boîtier de charge et autonomie 24h.",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  try {
    console.log('🔄 Ajout des produits...');
    for (const product of products) {
      await addDoc(collection(db, 'products'), product);
      console.log('✅ Produit ajouté:', product.name);
    }
    console.log('🎉 Tous les produits ont été ajoutés avec succès!');
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout des produits:', error);
  }
};

const seedSuppliers = async () => {
  const suppliers = [
    {
      name: "Tech Manufacturer Co. Ltd",
      businessType: "Manufacturer",
      logo: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150",
      location: "Shanghai, China",
      establishedYear: 2010,
      employees: "201-500",
      rating: 4.8,
      satisfactionRate: 95,
      responseRate: 98,
      isTopSupplier: true,
      isVerified: true,
      productCount: 150,
      certificationsList: ["ISO 9001", "CE Certification", "RoHS Compliant"],
      mainMarkets: ["Africa", "Europe", "North America"],
      productRanges: ["Electronics", "Mobile Phones", "Accessories"],
      description: "Fabricant leader en électronique avec plus de 10 ans d'expérience.",
      createdAt: new Date()
    },
    {
      name: "Smart Gadgets Ltd",
      businessType: "Trading Company", 
      logo: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=150",
      location: "Shenzhen, China",
      establishedYear: 2015,
      employees: "51-100",
      rating: 4.6,
      satisfactionRate: 92,
      responseRate: 96,
      isTopSupplier: false,
      isVerified: true,
      productCount: 85,
      certificationsList: ["ISO 9001", "FCC Certified"],
      mainMarkets: ["Africa", "Middle East"],
      productRanges: ["Electronics", "Smart Devices", "Wearables"],
      description: "Spécialiste des gadgets connectés et appareils intelligents.",
      createdAt: new Date()
    }
  ];

  try {
    console.log('🔄 Ajout des fournisseurs...');
    for (const supplier of suppliers) {
      await addDoc(collection(db, 'suppliers'), supplier);
      console.log('✅ Fournisseur ajouté:', supplier.name);
    }
    console.log('🎉 Tous les fournisseurs ont été ajoutés avec succès!');
  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout des fournisseurs:', error);
  }
};

// Fonction principale
export const runSeed = async () => {
  console.log('🚀 Démarrage de la création des données de test...');
  
  try {
    await seedSuppliers();
    await seedProducts();
    console.log('🌈 Toutes les données ont été créées avec succès!');
    console.log('📱 Vous pouvez maintenant utiliser votre application!');
  } catch (error) {
    console.error('💥 Erreur lors de la création des données:', error);
  }
};