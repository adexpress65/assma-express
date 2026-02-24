import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/config/firebase";

/**
 * Uploade une image (locale ou distante) vers Firebase Storage
 * pour garantir que le lien ne meurt jamais.
 */
const uploadToFirebase = async (uri: string): Promise<string> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const filename = `products/ali_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const storageRef = ref(storage, filename);
    
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Erreur Storage:", error);
    throw new Error("Impossible d'uploader l'image vers le serveur.");
  }
};

/**
 * Génère des mots-clés optimisés pour ton moteur de recherche
 */
const generateKeywords = (title: string): string[] => {
  const words = title.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/gi, '')
    .split(/\s+/)
    .filter(word => word.length > 2);
  return Array.from(new Set([...words, "alibaba", "import", "qualité"]));
};

/**
 * FONCTION PRINCIPALE : Importation Alibaba vers A2Express
 */
export const importAlibabaToA2Express = async (aliData: any) => {
  try {
    // 1. Gestion de l'image (Upload obligatoire pour la perfection)
    console.log("📸 Préparation de l'image...");
    const finalImageUrl = await uploadToFirebase(aliData.images[0]);

    // 2. Configuration financière
    const USD_TO_XOF = 615;
    const MARGIN_RATE = 1.25; // +25%
    const LOGISTICS_FEES = 5000;

    // 3. Calculs de prix
    const rawPriceXOF = aliData.price * USD_TO_XOF;
    const finalPrice = Math.round((rawPriceXOF * MARGIN_RATE) + LOGISTICS_FEES);
    const oldPrice = Math.round(finalPrice * 1.20); // Prix barré (+20%)

    // 4. Construction de l'objet complet (Structure 100% compatible avec ton App)
    const productDocument = {
      // --- IDENTITÉ ---
      name: aliData.title,
      nameLower: aliData.title.toLowerCase(),
      slug: aliData.title.toLowerCase().replace(/\s+/g, "-"),
      description: aliData.description || "Produit sélectionné par A2Express Global Supply. Qualité industrielle certifiée.",
      
      // --- FINANCES ---
      price: finalPrice,
      basePrice: finalPrice - 1000,
      priceAdjustment: 1000,
      originalPrice: oldPrice,
      currency: "XOF",
      purchasePriceUSD: aliData.price,
      
      // --- VISUELS ---
      imageUrl: finalImageUrl,
      mainImage: finalImageUrl,
      images: [finalImageUrl],
      
      // --- CATÉGORISATION ---
      categoryId: aliData.categoryId || "fKNpSZ7NgqyMw7uZW15w",
      categoryName: aliData.categoryName || "Import Global",
      
      // --- VENDEUR (A2Express est le garant) ---
      companyId: "A2EXPRESS_GLOBAL_SUPPLY",
      companyName: "A2EXPRESS GLOBAL",
      supplier: "A2EXPRESS GLOBAL",
      sellerId: "A2EXPRESS_GLOBAL_SUPPLY",
      companyData: {
        id: "A2EXPRESS_GLOBAL_SUPPLY",
        name: "A2EXPRESS GLOBAL",
        logo: "https://firebasestorage.googleapis.com/.../logo_a2.png", // Mets ton vrai logo
        isPremium: true
      },

      // --- LOGISTIQUE ---
      deliveryTime: "7-12 jours",
      shippingCost: 0,
      inStock: true,
      stockQuantity: 999,
      minOrder: aliData.minOrder || 1,
      
      // --- META DONNÉES & RECHERCHE ---
      source: "alibaba",
      externalUrl: aliData.originalLink,
      searchKeywords: generateKeywords(aliData.title),
      lastSync: serverTimestamp(),
      
      // --- STATUTS ---
      status: "published",
      isActive: true,
      isVerified: true,
      featured: false,
      trending: true,
      newArrival: true,
      rating: 5,
      reviewCount: 0,
      soldCount: 0,

      // --- SPÉCIFICATIONS ---
      specifications: {
        modelNumber: aliData.model || "A2-GLOBAL",
        weight: aliData.weight || "N/A",
        dimensions: aliData.dimensions || "N/A",
        origin: "CN"
      },

      // --- STRUCTURES COMPLEXES (Vides mais nécessaires pour éviter les crashs) ---
      variants: [],
      hasVariants: false,
      personalization: {
        enabled: false,
        fields: []
      },

      // --- TIMESTAMPS ---
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // 5. Envoi vers Firestore
    console.log("💾 Sauvegarde dans Firestore...");
    const docRef = await addDoc(collection(db, "products"), productDocument);
    
    return { success: true, id: docRef.id };

  } catch (error: any) {
    console.error("Erreur Import Service:", error);
    throw error;
  }
};