// utils/productHelpers.ts - FONCTION UNIVERSELLE
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

interface CreateProductData {
  // Données de base
  name: string;
  description: string;
  price: number;
  images: string[];
  categoryId: string;
  
  // Informations fournisseur (peuvent être modifiées par l'admin)
  companyId: string;
  companyName: string;
  companyLogo: string;
  
  // Spécifications
  specifications: {
    material: string;
    usage: string;
    style: string;
    origin: string;
    modelNumber: string;
  };
  
  // Métadonnées de création
  createdBy: 'company' | 'admin';
  creatorId: string;
  
  // Champs optionnels
  originalPrice?: number;
  stockQuantity?: number;
  minOrder?: number;
  shippingCost?: number;
  deliveryTime?: string;
}

export const createProduct = async (productData: CreateProductData) => {
  try {
    const productId = doc(collection(db, 'products')).id;
    
    const product = {
      // Identifiants et métadonnées
      id: productId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'published',
      
      // Informations de base (obligatoires)
      name: productData.name,
      description: productData.description,
      price: productData.price,
      currency: 'XOF',
      images: productData.images,
      mainImage: productData.images[0] || '',
      
      // Catégorisation
      categoryId: productData.categoryId,
      categoryName: '', // À remplir depuis la catégorie
      tags: [],
      
      // Relation fournisseur (TOUJOURS REQUISE)
      companyId: productData.companyId,
      companyName: productData.companyName,
      companyLogo: productData.companyLogo,
      
      // Spécifications
      specifications: {
        material: productData.specifications.material,
        usage: productData.specifications.usage,
        style: productData.specifications.style,
        origin: productData.specifications.origin,
        modelNumber: productData.specifications.modelNumber,
        weight: '',
        dimensions: '',
        color: '',
        warranty: ''
      },
      
      // Stock et commande
      stockQuantity: productData.stockQuantity || 100,
      minOrder: productData.minOrder || 1,
      inStock: true,
      
      // Livraison
      shippingCost: productData.shippingCost || 0,
      deliveryTime: productData.deliveryTime || '7-14 jours',
      
      // Avis et notation (valeurs par défaut)
      rating: 0,
      reviewCount: 0,
      soldCount: 0,
      
      // Gestion des promotions
      onSale: false,
      
      // Métadonnées de création
      createdBy: productData.createdBy,
      creatorId: productData.creatorId,
      isVerified: productData.createdBy === 'admin', // Les produits admin sont auto-vérifiés
      
      // SEO et visibilité
      slug: generateSlug(productData.name),
      featured: false,
      
      // Statistiques
      viewCount: 0,
      favoriteCount: 0
    };

    await setDoc(doc(db, 'products', productId), product);
    
    console.log('✅ Produit créé avec structure unifiée:', productId);
    return productId;
    
  } catch (error) {
    console.error('❌ Erreur création produit:', error);
    throw error;
  }
};

// Générer un slug unique
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
};