import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  ScrollView, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  Text,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
  Image,
  FlatList
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../src/config/firebase';

// Imports des composants
import ShippingCalculator from '../../src/components/ShippingCalculator';
import ActionFooter from '../../src/components/ActionFooter';
import WholesaleQuoteForm from '../../src/components/WholesaleQuoteForm';
import ProductGallery from '../../src/components/ProductGallery';
import ProductVariants from '../../src/components/ProductVariants'; 
import QuantityIncrementalSelector from '../../src/components/QuantityIncrementalSelector';
import TrustBadges from '../../src/components/TrustBadges';
import { useCart } from '../../src/contexts/CartContext';
import { useCurrency } from '../../src/contexts/CurrencyContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 12) / 2; // 2 colonnes avec espacement

const COLORS = {
  primary: '#FF6A00',
  background: '#F8F8F8',
  white: '#FFFFFF',
  text: '#2D3748',
  lightGray: '#E2E8F0',
  error: '#E53E3E',
  success: '#00B517',
  warning: '#D69E2E'
};

// Interface exacte de ta structure Firestore
interface FirebaseProduct {
  id: string;
  name: string;
  description: string;
  images: string[];
  mainImage: string;
  price: number;
  originalPrice?: number;
  minOrder: number;
  currency: string;
  inStock: boolean;
  stockQuantity: number;
  hasVariants: boolean;
  variantAttributes?: Array<{
    name: string;
    values: string[];
  }>;
  variants?: Array<{
    id: string;
    color: string;
    size: string;
    price: number;
    stock: number;
    sku: string;
    image?: string;
    wholesalePrice?: number;
  }>;
  specifications?: {
    dimensions?: string;
    modelNumber?: string;
    weight?: string;
  };
  deliveryTime: string;
  shippingCost: number;
  companyName: string;
  supplier: string;
  rating: number;
  reviewCount: number;
  soldCount: number;
  categoryName: string;
  status: string;
  featured: boolean;
  trending: boolean;
  newArrival: boolean;
  specialOffer: boolean;
  // Champs supplémentaires de ta structure
  categoryId?: string;
  companyId?: string;
  createdAt?: any;
  createdBy?: string;
  creatorId?: string;
  isActive?: boolean;
  isVerified?: boolean;
  industrial?: boolean;
  premiumSupplier?: boolean;
  slug?: string;
  nameLower?: string;
  wholesalePrice?: number;
}

export default function ProductDetailScreen() {
  const params = useLocalSearchParams();
const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const router = useRouter();
  const { addToCart } = useCart();
  const { currency } = useCurrency();

  // --- ÉTATS ---
  const [product, setProduct] = useState<FirebaseProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  
  const [quantity, setQuantity] = useState(1);
  const [isQuoteVisible, setIsQuoteVisible] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [addingToCart, setAddingToCart] = useState(false);

  // --- ÉTATS POUR PRODUITS SIMILAIRES ---
  const [similarProducts, setSimilarProducts] = useState<FirebaseProduct[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);

  // --- FONCTION DE RÉCUPÉRATION DE L'ENTREPRISE ---
  const fetchCompany = async (companyId: string) => {
    try {
      const companyRef = doc(db, 'companies', companyId);
      const companySnap = await getDoc(companyRef);
      if (companySnap.exists()) {
        return {
          id: companySnap.id,
          ...companySnap.data()
        };
      }
    } catch (error) {
      console.error("Erreur récupération entreprise:", error);
    }
    return null;
  };

  // --- FONCTION AMÉLIORÉE POUR RÉCUPÉRER LES PRODUITS SIMILAIRES ---
  // PRIORITÉ AU MÊME FOURNISSEUR, PUIS COMPLÉTER AVEC D'AUTRES
  const fetchSimilarProducts = async (categoryId: string, companyId: string, currentProductId: string) => {
    if (!categoryId) return;
    
    setLoadingSimilar(true);
    try {
      const productsRef = collection(db, 'products');
      let products: FirebaseProduct[] = [];
      
      // 1. D'abord récupérer les produits du même fournisseur
      if (companyId) {
        const sameSupplierQuery = query(
          productsRef,
          where('categoryId', '==', categoryId),
          where('companyId', '==', companyId),
          where('isActive', '==', true),
          where('status', '==', 'published'),
          limit(4)
        );
        
        const sameSupplierSnapshot = await getDocs(sameSupplierQuery);
        
        sameSupplierSnapshot.forEach((doc) => {
          const productData = doc.data();
          if (doc.id !== currentProductId) {
            products.push({
              ...productData,
              id: doc.id,
              price: Number(productData.price) || 0,
              minOrder: Number(productData.minOrder) || 1,
            } as FirebaseProduct);
          }
        });
      }
      
      // 2. Si pas assez de produits (moins de 4), compléter avec d'autres fournisseurs
      if (products.length < 4) {
        const otherSuppliersQuery = query(
          productsRef,
          where('categoryId', '==', categoryId),
          where('isActive', '==', true),
          where('status', '==', 'published'),
          limit(6 - products.length)
        );
        
        const otherSuppliersSnapshot = await getDocs(otherSuppliersQuery);
        
        otherSuppliersSnapshot.forEach((doc) => {
          const productData = doc.data();
          // Éviter les doublons (même fournisseur ou produit actuel)
          if (doc.id !== currentProductId && 
              !products.some(p => p.id === doc.id) &&
              (!companyId || productData.companyId !== companyId)) {
            products.push({
              ...productData,
              id: doc.id,
              price: Number(productData.price) || 0,
              minOrder: Number(productData.minOrder) || 1,
            } as FirebaseProduct);
          }
        });
      }
      
      setSimilarProducts(products.slice(0, 6)); // Limiter à 6 produits max
    } catch (error) {
      console.error("Erreur lors de la récupération des produits similaires:", error);
    } finally {
      setLoadingSimilar(false);
    }
  };

  // --- RÉCUPÉRATION DU PRODUIT DEPUIS FIRESTORE ---
  useEffect(() => {
    const fetchProduct = async () => {
      // 1. Normalisation de l'ID (gestion des cas array/object d'Expo)
      const normalizedId = Array.isArray(id) ? id[0] : id;

      if (!normalizedId) {
        setError("ID produit manquant");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const productRef = doc(db, 'products', normalizedId);
        const productSnap = await getDoc(productRef);
        
        if (!productSnap.exists()) {
          console.warn(`⚠️ Document ${normalizedId} introuvable dans la collection 'products'`);
          setError("Produit non trouvé");
          setProduct(null);
        } else {
          const productData = productSnap.data();
          
          // 2. Validation plus souple (vérifie l'existence, pas la valeur falsy)
          if (productData.name === undefined) {
            setError("Ce produit n'a pas de nom valide");
            setProduct(null);
            return;
          }
          
          // 3. Mapping sécurisé (conversion des types au cas où)
          const productWithId: FirebaseProduct = {
            ...productData,
            id: productSnap.id,
            price: Number(productData.price) || 0,
            minOrder: Number(productData.minOrder) || 1,
            stockQuantity: Number(productData.stockQuantity) || 0,
            inStock: productData.inStock ?? (Number(productData.stockQuantity) > 0)
          } as FirebaseProduct;
          
          setProduct(productWithId);
          
          // 4. Récupérer les produits similaires si categoryId existe
          if (productWithId.categoryId) {
            fetchSimilarProducts(
              productWithId.categoryId, 
              productWithId.companyId || '', 
              productWithId.id
            );
          }
          
          // 5. Initialisation des variantes
          if (productWithId.hasVariants && productWithId.variants?.length) {
            const firstAvailable = productWithId.variants.find(v => v.stock > 0) || productWithId.variants[0];
            setSelectedSize(firstAvailable.size || '');
            setSelectedColor(firstAvailable.color || '');
            setSelectedVariant(firstAvailable);
          }
          
          setQuantity(productWithId.minOrder || 1);
        }
      } catch (err: any) {
        console.error("🔥 Erreur critique Firestore:", err);
        setError(`Erreur réseau: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  // --- RÉCUPÉRATION DES DONNÉES DE L'ENTREPRISE ---
  useEffect(() => {
    const fetchCompanyData = async () => {
      if (product?.companyId) {
        setLoadingCompany(true);
        const companyData = await fetchCompany(product.companyId);
        setCompany(companyData);
        setLoadingCompany(false);
      }
    };

    fetchCompanyData();
  }, [product?.companyId]);

  // --- EXTRACTION DES ATTRIBUTS DE VARIANTES ---
  const variantAttributes = useMemo(() => {
    if (!product || !product.hasVariants) {
      return {
        sizes: [] as string[],
        colors: [] as string[]
      };
    }

    const sizes: string[] = [];
    const colors: string[] = [];

    // Extraire depuis variantAttributes si disponible
    if (product.variantAttributes && product.variantAttributes.length > 0) {
      product.variantAttributes.forEach(attr => {
        if (attr.name === 'Size' || attr.name === 'Taille' || attr.name === 'size') {
          sizes.push(...attr.values);
        } else if (attr.name === 'Color' || attr.name === 'Couleur' || attr.name === 'color') {
          colors.push(...attr.values);
        }
      });
    }

    // Extraire depuis variants si variantAttributes vide
    if ((sizes.length === 0 || colors.length === 0) && product.variants && product.variants.length > 0) {
      const sizeSet = new Set<string>();
      const colorSet = new Set<string>();
      
      product.variants.forEach(variant => {
        if (variant.size) sizeSet.add(variant.size);
        if (variant.color) colorSet.add(variant.color);
      });
      
      if (sizes.length === 0) sizes.push(...Array.from(sizeSet).sort());
      if (colors.length === 0) colors.push(...Array.from(colorSet).sort());
    }

    return { sizes, colors };
  }, [product]);

  // --- TROUVER LA VARIANTE SÉLECTIONNÉE ---
  useEffect(() => {
    if (!product || !product.hasVariants || !product.variants || product.variants.length === 0) return;

    const foundVariant = product.variants.find(v => 
      v.size === selectedSize && v.color === selectedColor
    );
    
    setSelectedVariant(foundVariant || null);
    
  }, [selectedSize, selectedColor, product]);

  // --- PRIX ACTUEL ---
  const currentUnitPrice = useMemo(() => {
    if (!product) return 0;
    
    if (selectedVariant?.price) {
      return selectedVariant.price;
    }
    
    return product.price;
  }, [product, selectedVariant]);

  // --- STOCK ACTUEL ---
  const currentStock = useMemo(() => {
    if (!product) return 0;
    
    if (selectedVariant?.stock !== undefined) {
      return selectedVariant.stock;
    }
    
    return product.stockQuantity || 0;
  }, [product, selectedVariant]);
  
  const isWholesale = useMemo(() => {
    return quantity >= minimumOrder;
  }, [quantity, minimumOrder]);

const retailPrice = useMemo(() => {
  // On s'assure de prendre le prix de la variante si elle existe
  return Number(selectedVariant?.price || product?.price || 0);
}, [product, selectedVariant]);

const wholesalePrice = useMemo(() => {
  return Number(
    selectedVariant?.wholesalePrice || 
    product?.wholesalePrice || 
    retailPrice // Si pas de prix de gros spécifique, on garde le prix de détail
  );
}, [selectedVariant, product, retailPrice]);

const effectiveUnitPrice = useMemo(() => {
  return isWholesale ? wholesalePrice : retailPrice;
}, [isWholesale, wholesalePrice, retailPrice]);

  // --- IMAGES POUR LA GALERIE ---
  const galleryImages = useMemo(() => {
    if (!product) return [];
    
    const images: string[] = [];
    
    // Ajouter l'image de la variante si elle existe et est différente
    if (selectedVariant?.image && !product.images?.includes(selectedVariant.image)) {
      images.push(selectedVariant.image);
    }
    
    // Ajouter les images principales
    if (product.images && product.images.length > 0) {
      images.push(...product.images);
    }
    
    // Fallback sur mainImage
    if (images.length === 0 && product.mainImage) {
      images.push(product.mainImage);
    }
    
    return images;
  }, [product, selectedVariant]);

  // --- MINIMUM DE COMMANDE ---
  const minimumOrder = useMemo(() => {
    if (!product) return 1;
    return product.minOrder || 1;
  }, [product]);

  // --- FONCTION AJOUT AU PANIER CORRIGÉE ---
// Dans ProductDetailScreen.tsx - Fonction handleAddToCart CORRIGÉE (lignes 412-443)
const handleAddToCart = () => {
  if (!product) {
    Alert.alert("Erreur", "Produit non chargé");
    return;
  }

  // Validation stock
  if (!product.inStock || currentStock <= 0) {
    Alert.alert("Rupture de stock", "Ce produit n'est plus disponible.");
    return;
  }

  // Validation variantes si nécessaire
  if (product.hasVariants) {
    if (!selectedSize || !selectedColor) {
      Alert.alert("Sélection requise", "Veuillez sélectionner une taille et une couleur.");
      return;
    }
    
    if (!selectedVariant) {
      Alert.alert("Combinaison invalide", "Cette combinaison taille/couleur n'est pas disponible.");
      return;
    }
    
    if (selectedVariant.stock <= 0) {
      Alert.alert("Stock épuisé", "Cette variante est en rupture de stock.");
      return;
    }
  }

  // Validation quantité vs stock
  if (quantity > currentStock) {
    Alert.alert("Stock insuffisant", `Stock disponible: ${currentStock} pièce(s)`);
    return;
  }

  setAddingToCart(true);

  // ✅ PRIX CORRECT (selon variante ou produit)
  const finalPrice = selectedVariant?.price || product.price || 0;
  
  // ✅ CONSTRUCTION DE L'OBJET PRODUIT POUR LE PANIER
// Dans product/[id].tsx - handleAddToCart
// --- DÉBUT DU BLOC CORRIGÉ ---
// ✅ REMPLACE TON BLOC D'ASSEMBLAGE PAR CELUI-CI
// ✅ BLOC FINAL CORRIGÉ POUR GARANTIR LE PRIX AFFICHÉ
const productForCart = (() => {
  // 1. On récupère le prix "effectif" calculé dans tes useMemo (Retail vs Wholesale)
  // C'est ce montant en XOF qui correspond aux 18,56 $ de ton écran
  const finalPriceToStore = Number(effectiveUnitPrice) || 
                            Number(selectedVariant?.price) || 
                            Number(product.price) || 0;

  // 2. On s'assure que l'image correspond bien à la variante choisie ou à l'image principale
  const finalImage = selectedVariant?.image || product.mainImage || product.imageUrl;

  return {
    id: product.id,
    // ID unique : crucial pour différencier les variantes dans le panier
    cartId: `${product.id}-${selectedSize || 'NS'}-${selectedColor || 'NS'}`, 
    name: product.name,
    price: finalPriceToStore, // ✅ Toujours stocké en XOF (ex: 12064 pour donner 18,56 $)
    quantity: quantity || 1,
    selectedSize: selectedSize || null,
    selectedColor: selectedColor || null,
    image: finalImage,
    seller: product.companyName || product.supplier || "Kissgroup88",
    minOrder: Number(product.minOrder) || 1,
    inStock: product.inStock ?? true,
    originalCurrency: 'XOF' // On garde la monnaie pivot pour les calculs de taxes/totaux
  };
})();

// Log de contrôle (à vérifier dans ton terminal au moment du clic)
console.log("💰 PRIX ENVOYÉ AU PANIER :", productForCart.price, "XOF");

// Envoi au contexte du panier
addToCart(productForCart);

// Log de contrôle pour être sûr du montant en XOF avant conversion
console.log("💰 PRIX ENVOYÉ AU PANIER (XOF):", productForCart.price);

addToCart(productForCart);

// Log de sécurité pour voir exactement ce qui part dans le panier
console.log("🚀 ENVOI FINAL AU PANIER:", {
  nom: productForCart.name,
  prixEnvoyé: productForCart.price,
  quantité: productForCart.quantity
});

// Appel de la fonction
addToCart(productForCart);
// --- FIN DU BLOC CORRIGÉ ---
  // Appeler la fonction addToCart du contexte
  try {
    addToCart(productForCart);
    
    // Afficher l'alerte de confirmation
    setTimeout(() => {
      setAddingToCart(false);
      Alert.alert(
        "✅ Produit ajouté",
        `${quantity} × ${product.name}${
          selectedSize ? ` (Taille ${selectedSize})` : ''
        }${
          selectedColor ? ` - ${selectedColor}` : ''
        } a été ajouté à votre panier.`,
        [
          { 
            text: "Continuer vos achats", 
            style: "cancel" 
          },
          { 
            text: "Voir le panier", 
            onPress: () => router.push('/cart') 
          }
        ]
      );
    }, 500);
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout au panier:", error);
    setAddingToCart(false);
    Alert.alert("Erreur", "Impossible d'ajouter le produit au panier");
  }
};

// Dans ProductDetailScreen.tsx - Fonction handleChat CORRIGÉE
console.log("🔥 PRODUCT COMPLET DETAIL:", product);

const handleChat = () => {
  if (!product || !product.companyId) return;
  
  // Récupérer l'image principale (avec fallback)
  const mainImage = product.images?.[0] || product.mainImage || product.imageUrl || '';
  
  // Formater le prix correctement
  const formattedPrice = `${product.price.toLocaleString()} ${product.currency || 'FCFA'}`;
  
  // Log pour debug
  console.log("📤 Envoi vers chat:", {
    companyId: product.companyId,
    productId: product.id,
    productName: product.name,
    productImage: mainImage ? mainImage.substring(0, 50) + '...' : null,
    productPrice: formattedPrice,
    sellerName: product.companyName || product.supplier
  });
  
  // Navigation avec tous les paramètres
  router.push({
    pathname: '/conversation/[id]',
    params: { 
      id: product.companyId,  // L'ID du vendeur est obligatoire
      productId: product.id,
      productName: product.name,
      productImage: mainImage,
      productPrice: formattedPrice,
      sellerId: product.companyId,
      sellerName: product.companyName || product.supplier || 'Vendeur'
    }
  });
};

  const handleCompanyPress = () => {
    if (company?.id) {
      router.push({
        pathname: '/company/[id]',
        params: { id: company.id }
      });
    }
  };

  // --- COMPOSANT POUR LA CARTE PRODUIT SIMILAIRE ---
  const SimilarProductCard = ({ product }: { product: FirebaseProduct }) => {
    const handlePress = () => {
      router.push({
        pathname: '/product/[id]',
        params: { id: product.id }
      });
    };

    return (
      <TouchableOpacity 
        style={styles.similarProductCard}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.similarProductImageContainer}>
          <Image 
            source={{ uri: product.mainImage || (product.images?.[0]) || 'https://via.placeholder.com/300' }}
            style={styles.similarProductImage}
            resizeMode="cover"
          />
          {product.premiumSupplier && (
            <View style={styles.premiumBadgeSmall}>
              <Ionicons name="star" size={10} color="#FFF" />
            </View>
          )}
        </View>
        
        <View style={styles.similarProductInfo}>
          <Text style={styles.similarProductName} numberOfLines={2}>
            {product.name}
          </Text>
          
<View style={styles.similarProductPriceContainer}>
  <Text style={styles.similarProductCurrency}>{product.currency || 'FCFA'}</Text>
  <Text style={styles.similarProductPrice}>
    {product.price.toLocaleString()}
  </Text>
</View>
          
          <View style={styles.similarProductMOQ}>
            <Ionicons name="cube-outline" size={12} color="#666" />
            <Text style={styles.similarProductMOQText}>
              {product.minOrder || 1} pièce (MOQ)
            </Text>
          </View>
          
          {product.soldCount > 0 && (
            <Text style={styles.similarProductSold}>
              {product.soldCount}+ vendus
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };
  
  // ✅ Ajoute cette fonction de formatage
const formatDisplayPrice = (priceInXOF: number) => {
  const converted = priceInXOF * currency.rate;
  
  if (currency.code === 'XOF') {
    return Math.round(converted).toLocaleString('fr-FR') + ' CFA';
  }
  
  return `${currency.symbol}${converted.toLocaleString(undefined, { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};

  // --- ÉCRAN DE CHARGEMENT ---
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement du produit...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- ÉCRAN D'ERREUR ---
  if (error || !product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={60} color={COLORS.error} />
          <Text style={styles.errorTitle}>Produit non disponible</Text>
          <Text style={styles.errorText}>{error || "Ce produit n'existe pas ou a été supprimé."}</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Retour aux produits</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* GALERIE D'IMAGES */}
        <ProductGallery 
          images={galleryImages}
          productName={product.name}
        />

        {/* SECTION PRINCIPALE */}
        <View style={styles.mainInfo}>
          {/* Prix original barré si promotion */}
          {product.originalPrice && product.originalPrice > product.price ? (
            <View style={styles.originalPriceContainer}>
<Text style={styles.originalPriceText}>
  {formatDisplayPrice(product.originalPrice)}
</Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>
                  -{Math.round((1 - product.price / product.originalPrice) * 100)}%
                </Text>
              </View>
            </View>
          ) : null}
          
          {/* Prix actuel */}
          <View style={styles.priceContainer}>
<Text style={styles.priceText}>{formatDisplayPrice(currentUnitPrice)}</Text>
            {product.specialOffer ? (
              <Text style={styles.specialOfferBadge}>Offre spéciale</Text>
            ) : null}
          </View>
          
          {/* Nom du produit */}
          <Text style={styles.productName}>{product.name}</Text>
          
          {/* Badges statut */}
          <View style={styles.badgesContainer}>
            {product.newArrival ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Nouveau</Text>
              </View>
            ) : null}
            {product.featured ? (
              <View style={[styles.badge, styles.featuredBadge]}>
                <Text style={styles.badgeText}>En vedette</Text>
              </View>
            ) : null}
            {product.trending ? (
              <View style={[styles.badge, styles.trendingBadge]}>
                <Text style={styles.badgeText}>Tendance</Text>
              </View>
            ) : null}
            {product.premiumSupplier ? (
              <View style={[styles.badge, styles.premiumBadge]}>
                <Text style={styles.badgeText}>Premium</Text>
              </View>
            ) : null}
          </View>
          
          {/* Description */}
          {product.description ? (
            <Text style={styles.description}>
              {product.description}
            </Text>
          ) : null}

          {/* SECTION BOUTIQUE/ENTREPRISE */}
          {company && (
            <View style={styles.companySection}>
              <TouchableOpacity 
                style={styles.companyCard}
                onPress={handleCompanyPress}
                activeOpacity={0.7}
              >
                <View style={styles.companyHeader}>
                  <View style={styles.companyLogoContainer}>
                    {company.logo && typeof company.logo === 'string' && company.logo.startsWith('http') ? (
                      <Image 
                        source={{ uri: company.logo }}
                        style={styles.companyLogo}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.companyLogoPlaceholder}>
                        <Ionicons name="business" size={24} color={COLORS.primary} />
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.companyInfo}>
                    <Text style={styles.companyName}>{company.name || 'Boutique'}</Text>
                    
                    {company.isActive && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                        <Text style={styles.verifiedText}>Vérifié</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.chevronContainer}>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                  </View>
                </View>

                {/* Informations entreprise */}
                <View style={styles.companyDetails}>
                  {(company.city || company.country || company.fullAddress) && (
                    <View style={styles.companyDetailRow}>
                      <Ionicons name="location-outline" size={16} color="#666" />
                      <Text style={styles.companyDetailText}>
                        {company.fullAddress || [company.city, company.country, company.street].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  )}
                  
                  {company.phone && (
                    <View style={styles.companyDetailRow}>
                      <Ionicons name="call-outline" size={16} color="#666" />
                      <Text style={styles.companyDetailText}>{company.phone}</Text>
                    </View>
                  )}
                  
                  {company.email && (
                    <View style={styles.companyDetailRow}>
                      <Ionicons name="mail-outline" size={16} color="#666" />
                      <Text style={styles.companyDetailText}>{company.email}</Text>
                    </View>
                  )}
                </View>

                {/* Statistiques */}
                {company.stats && (
                  <View style={styles.companyStats}>
                    {company.stats.productCount > 0 && (
                      <>
                        <View style={styles.companyStatItem}>
                          <Text style={styles.companyStatValue}>{company.stats.productCount}</Text>
                          <Text style={styles.companyStatLabel}>Produits</Text>
                        </View>
                        <View style={styles.companyStatDivider} />
                      </>
                    )}
                    
                    <View style={styles.companyStatItem}>
                      <Text style={styles.companyStatValue}>
                        {company.yearEstablished || 'N/A'}
                      </Text>
                      <Text style={styles.companyStatLabel}>Depuis</Text>
                    </View>
                    
                    {company.businessType && (
                      <>
                        <View style={styles.companyStatDivider} />
                        <View style={styles.companyStatItem}>
                          <Text style={styles.companyStatValue} numberOfLines={1}>
                            {company.businessType}
                          </Text>
                          <Text style={styles.companyStatLabel}>Type</Text>
                        </View>
                      </>
                    )}
                  </View>
                )}

                {/* Lien vers la boutique */}
                <View style={styles.companyFooter}>
                  <Text style={styles.companyFooterText}>
                    Voir la boutique →
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {loadingCompany && (
            <View style={styles.companyLoadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.companyLoadingText}>Chargement de la boutique...</Text>
            </View>
          )}

          {!company && product?.companyId && !loadingCompany && (
            <View style={styles.companyErrorContainer}>
              <Ionicons name="business-outline" size={20} color="#999" />
              <Text style={styles.companyErrorText}>
                Boutique non disponible
              </Text>
            </View>
          )}

          <TrustBadges />
        </View>

        {/* VARIANTES TAILLES */}
        {product.hasVariants && variantAttributes.sizes.length > 0 ? (
          <View style={styles.section}>
            <ProductVariants 
              label="Taille"
              options={variantAttributes.sizes}
              selectedOption={selectedSize}
              onSelect={setSelectedSize}
              disabledOptions={product.variants
                ?.filter(v => v.color === selectedColor && (v.stock <= 0 || !product.inStock))
                .map(v => v.size) || []}
            />
          </View>
        ) : null}

        {/* VARIANTES COULEURS */}
        {product.hasVariants && variantAttributes.colors.length > 0 ? (
          <View style={styles.section}>
            <ProductVariants 
              label="Couleur"
              options={variantAttributes.colors}
              selectedOption={selectedColor}
              onSelect={setSelectedColor}
              disabledOptions={product.variants
                ?.filter(v => v.size === selectedSize && (v.stock <= 0 || !product.inStock))
                .map(v => v.color) || []}
            />
          </View>
        ) : null}

        {/* SELECTEUR DE QUANTITÉ */}
        <View style={styles.section}>
          <QuantityIncrementalSelector 
            quantity={quantity}
            onChange={setQuantity}
            priceSteps={[{ min: 1, price: currentUnitPrice }]}
            minQuantity={1}
            stock={currentStock}
          />
        </View>

        {/* INFORMATIONS PRODUIT */}
        <View style={styles.infoCard}>
          {/* Disponibilité */}
          <View style={styles.infoRow}>
            <Ionicons name="cube-outline" size={18} color="#666" />
            <Text style={styles.infoLabel}>Disponibilité:</Text>
            <Text style={[
              styles.infoValue,
              product.inStock && currentStock > 50 ? styles.inStock : 
              product.inStock && currentStock > 0 ? styles.lowStock : 
              styles.outOfStock
            ]}>
              {product.inStock ? 
                (currentStock > 50 ? 'En stock' : 
                 currentStock > 0 ? 'Stock limité' : 
                 'Rupture de stock') : 
                'Non disponible'}
              {product.inStock && currentStock > 0 ? ` (${currentStock} disponibles)` : ''}
            </Text>
          </View>
          
          {/* Livraison */}
          {product.deliveryTime ? (
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color="#666" />
              <Text style={styles.infoLabel}>Livraison:</Text>
              <Text style={styles.infoValue}>{product.deliveryTime}</Text>
            </View>
          ) : null}
          
          {/* Vendeur */}
          {(product.companyName || product.supplier) ? (
            <View style={styles.infoRow}>
              <Ionicons name="business-outline" size={18} color="#666" />
              <Text style={styles.infoLabel}>Vendeur:</Text>
              <Text style={styles.infoValue}>{product.companyName || product.supplier}</Text>
            </View>
          ) : null}
          
          {/* Catégorie */}
          {product.categoryName ? (
            <View style={styles.infoRow}>
              <Ionicons name="grid-outline" size={18} color="#666" />
              <Text style={styles.infoLabel}>Catégorie:</Text>
              <Text style={styles.infoValue}>{product.categoryName}</Text>
            </View>
          ) : null}
          
          {/* Référence */}
          {product.specifications?.modelNumber ? (
            <View style={styles.infoRow}>
              <Ionicons name="barcode-outline" size={18} color="#666" />
              <Text style={styles.infoLabel}>Référence:</Text>
              <Text style={styles.infoValue}>{product.specifications.modelNumber}</Text>
            </View>
          ) : null}
        </View>

        {/* STATISTIQUES */}
        {(product.rating > 0 || product.reviewCount > 0 || product.soldCount > 0) ? (
          <View style={styles.statsCard}>
            {product.rating > 0 ? (
              <>
                <View style={styles.statItem}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={styles.statValue}>{product.rating.toFixed(1)}</Text>
                  <Text style={styles.statLabel}>Note</Text>
                </View>
                <View style={styles.statDivider} />
              </>
            ) : null}
            
            {product.reviewCount > 0 ? (
              <>
                <View style={styles.statItem}>
                  <Ionicons name="chatbubble-outline" size={20} color="#666" />
                  <Text style={styles.statValue}>{product.reviewCount}</Text>
                  <Text style={styles.statLabel}>Avis</Text>
                </View>
                <View style={styles.statDivider} />
              </>
            ) : null}
            
            {product.soldCount > 0 ? (
              <>
                <View style={styles.statItem}>
                  <Ionicons name="cart-outline" size={20} color="#666" />
                  <Text style={styles.statValue}>{product.soldCount}</Text>
                  <Text style={styles.statLabel}>Vendus</Text>
                </View>
                <View style={styles.statDivider} />
              </>
            ) : null}
            
            <View style={styles.statItem}>
              <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.success} />
              <Text style={styles.statValue}>✓</Text>
              <Text style={styles.statLabel}>Garantie</Text>
            </View>
          </View>
        ) : null}

        {/* CALCULATEUR DE LIVRAISON */}
        <ShippingCalculator 
          productId={product.id}
          quantity={quantity}
          weight={product.specifications?.weight}
          shippingCost={product.shippingCost}
          onOptionsPress={() => {
            console.log("Options de livraison détaillées demandées");
          }}
        />

        {/* BOUTON DEVIS GROSSISTE */}
        <TouchableOpacity 
          style={styles.quoteCard}
          onPress={() => setIsQuoteVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.quoteIconCircle}>
            <Ionicons name="document-text" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.quoteTextContainer}>
            <Text style={styles.quoteTitle}>Commande en gros ?</Text>
            <Text style={styles.quoteSub}>Demandez un devis personnalisé</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#CCC" />
        </TouchableOpacity>

        {/* SECTION PRODUITS SIMILAIRES AVEC TITRE DYNAMIQUE */}
        {(similarProducts.length > 0 || loadingSimilar) && (
          <View style={styles.similarProductsSection}>
            <View style={styles.similarProductsHeader}>
              <Text style={styles.similarProductsTitle}>
                Produits similaires
              </Text>
              <Text style={styles.similarProductsSubtitle}>
                {company?.name ? `de ${company.name}` : 'du même fournisseur'}
              </Text>
            </View>

            {loadingSimilar ? (
              <View style={styles.similarLoadingContainer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.similarLoadingText}>
                  Chargement des produits similaires...
                </Text>
              </View>
            ) : (
              <FlatList
                data={similarProducts}
                renderItem={({ item }) => <SimilarProductCard product={item} />}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.similarProductsRow}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* FOOTER COLLANT */}
      <ActionFooter 
        product={{
          id: product.id,
          name: product.name,
          imageUrl: galleryImages[0] || product.mainImage || '',
          price: effectiveUnitPrice,
          stock: currentStock,
          minOrder: minimumOrder,
          hasVariants: product.hasVariants,
          selectedSize,
          selectedColor,
          currency: product.currency
        }}
        onChat={handleChat}
        onAddToCart={handleAddToCart}
        addingToCart={addingToCart}
        disabled={!product.inStock || currentStock <= 0 || product.status !== 'published'}
        variantInfo={selectedVariant ? `Taille ${selectedSize} - ${selectedColor}` : ''}
      />

      {/* MODAL DE DEVIS GROSSISTE */}
      <WholesaleQuoteForm 
        visible={isQuoteVisible}
        onClose={() => setIsQuoteVisible(false)}
        productName={product.name}
        productId={product.id}
        productImages={galleryImages}
        currentPrice={currentUnitPrice}
        supplierName={product.companyName || product.supplier}
        supplierId={product.companyId}
        minOrder={minimumOrder}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: COLORS.white 
  },
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  scrollContent: { 
    paddingBottom: 120 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 20
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.error,
    marginTop: 16,
    marginBottom: 8
  },
  errorText: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 24
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600'
  },
  mainInfo: { 
    padding: 16, 
    backgroundColor: COLORS.white, 
    marginBottom: 8 
  },
  originalPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  originalPriceText: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8
  },
  discountBadge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  discountText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold'
  },
  priceContainer: { 
    flexDirection: 'row', 
    alignItems: 'baseline', 
    marginBottom: 8 
  },
  currency: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: COLORS.text, 
    marginRight: 4 
  },
  priceText: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: COLORS.text 
  },
  specialOfferBadge: { 
    marginLeft: 10, 
    color: COLORS.error, 
    fontSize: 12, 
    fontWeight: 'bold', 
    backgroundColor: '#FFE6E6', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4 
  },
  productName: { 
    fontSize: 18, 
    color: COLORS.text, 
    lineHeight: 24, 
    marginBottom: 12, 
    fontWeight: '700' 
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12
  },
  badge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '600'
  },
  featuredBadge: {
    backgroundColor: '#4C6EF5'
  },
  trendingBadge: {
    backgroundColor: '#FA5252'
  },
  premiumBadge: {
    backgroundColor: '#FFD700'
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16
  },
  // Styles pour la section boutique/entreprise
  companySection: {
    marginTop: 12,
    marginBottom: 8,
  },
  companyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  companyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  companyLogoContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    overflow: 'hidden',
    marginRight: 12,
  },
  companyLogo: {
    width: '100%',
    height: '100%',
  },
  companyLogoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF0E6',
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: COLORS.success,
    fontWeight: '500',
  },
  chevronContainer: {
    marginLeft: 8,
  },
  companyDetails: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
    gap: 8,
  },
  companyDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  companyDetailText: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  companyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  companyStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  companyStatValue: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  companyStatLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
  },
  companyStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.lightGray,
  },
  companyFooter: {
    alignItems: 'flex-end',
  },
  companyFooterText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  companyLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    marginTop: 12,
    borderRadius: 12,
    gap: 8,
  },
  companyLoadingText: {
    fontSize: 13,
    color: '#666',
  },
  companyErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    marginTop: 12,
    borderRadius: 12,
    gap: 8,
  },
  companyErrorText: {
    fontSize: 13,
    color: '#999',
  },
  section: { 
    backgroundColor: COLORS.white, 
    marginBottom: 2 
  },
  infoCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    marginBottom: 2,
    gap: 12
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    minWidth: 100
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1
  },
  inStock: {
    color: COLORS.success
  },
  lowStock: {
    color: COLORS.warning
  },
  outOfStock: {
    color: COLORS.error
  },
  statsCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    marginBottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  statItem: {
    alignItems: 'center',
    gap: 4
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text
  },
  statLabel: {
    fontSize: 12,
    color: '#666'
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.lightGray
  },
  quoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray
  },
  quoteIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF0E6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  quoteTextContainer: {
    flex: 1
  },
  quoteTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: COLORS.text
  },
  quoteSub: {
    fontSize: 12,
    color: '#718096'
  },
  // Styles pour la section produits similaires
  similarProductsSection: {
    backgroundColor: COLORS.white,
    marginTop: 8,
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  similarProductsHeader: {
    marginBottom: 16,
  },
  similarProductsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  similarProductsSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  similarLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  similarLoadingText: {
    fontSize: 14,
    color: '#666',
  },
  similarProductsRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  similarProductCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    overflow: 'hidden',
  },
  similarProductImageContainer: {
    width: '100%',
    height: CARD_WIDTH,
    backgroundColor: '#F5F5F5',
    position: 'relative',
  },
  similarProductImage: {
    width: '100%',
    height: '100%',
  },
  premiumBadgeSmall: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFD700',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  similarProductInfo: {
    padding: 10,
  },
  similarProductName: {
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 6,
    lineHeight: 18,
    height: 36,
  },
  similarProductPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  similarProductCurrency: {
    fontSize: 11,
    color: COLORS.text,
    marginRight: 2,
    fontWeight: '500',
  },
  similarProductPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  similarProductMOQ: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  similarProductMOQText: {
    fontSize: 11,
    color: '#666',
  },
  similarProductSold: {
    fontSize: 11,
    color: COLORS.success,
    fontWeight: '500',
  },
});