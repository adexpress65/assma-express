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
  FlatList,
  TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, limit, startAfter, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../src/config/firebase';

// Imports des composants
import ShippingCalculator from '../../src/components/ShippingCalculator';
import ActionFooter from '../../src/components/ActionFooter';
import WholesaleQuoteForm from '../../src/components/WholesaleQuoteForm';
import ProductGallery from '../../src/components/ProductGallery';
import TrustBadges from '../../src/components/TrustBadges';
import { useCart } from '../../src/contexts/CartContext';
import { useCurrency } from '../../src/contexts/CurrencyContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 32 - 12) / 2;

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
  uid?: string;
  logo?: string;
  companyLogo?: string;
  imageUrl?: string;
}

interface OrderMatrixItem {
  variantId: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  stock: number;
  image?: string;
  sku: string;
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
  
  const [isQuoteVisible, setIsQuoteVisible] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  
  // --- ÉTAT POUR LA COULEUR SÉLECTIONNÉE DANS LE CARROUSEL ---
  const [selectedCarouselColor, setSelectedCarouselColor] = useState<string>('');
  
  // --- ÉTAT : Matrice de commande (objet pour stocker les quantités par combinaison) ---
  const [orderMatrix, setOrderMatrix] = useState<Record<string, OrderMatrixItem>>({});
  
  // --- ÉTATS POUR PRODUITS SIMILAIRES ---
  const [similarProducts, setSimilarProducts] = useState<FirebaseProduct[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  
  // --- ÉTATS POUR PRODUITS SIMILAIRES ---
// AJOUTE CEUX-CI :
const [lastSimilarDoc, setLastSimilarDoc] = useState<any>(null);
const [hasMoreSimilar, setHasMoreSimilar] = useState(true);
const [loadingMoreSimilar, setLoadingMoreSimilar] = useState(false);

  // --- VARIABLES CALCULÉES ---
  const selectedVariant = useMemo(() => {
    if (!product?.variants || !selectedCarouselColor) return null;
    return product.variants.find(v => v.color === selectedCarouselColor);
  }, [product, selectedCarouselColor]);

  const effectiveUnitPrice = 
    selectedVariant?.price ?? 
    product?.price ?? 
    0;

  const currentStock = useMemo(() => {
    if (!product) return 0;
    if (selectedVariant) return selectedVariant.stock;
    return product.stockQuantity || 0;
  }, [product, selectedVariant]);

  const minimumOrder = useMemo(() => {
    return product?.minOrder || 1;
  }, [product]);

  const selectedSize = useMemo(() => {
    if (!product?.variants || !selectedCarouselColor) return null;
    const variant = product.variants.find(v => v.color === selectedCarouselColor);
    return variant?.size || null;
  }, [product, selectedCarouselColor]);

  const selectedColor = useMemo(() => {
    return selectedCarouselColor || null;
  }, [selectedCarouselColor]);

  const galleryImages = useMemo(() => {
    if (!product) return [];
    return product.images?.length ? product.images : [product.mainImage].filter(Boolean);
  }, [product]);

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

  // --- FONCTION POUR RÉCUPÉRER LES PRODUITS SIMILAIRES ---
const fetchSimilarProducts = async (categoryId, companyId, currentProductId) => {
  if (!categoryId) return;
  
  setLoadingSimilar(true);
  setHasMoreSimilar(true);
  setLastSimilarDoc(null);

  try {
    const productsRef = collection(db, 'products');
    
    // UNE SEULE REQUÊTE avec TOUS les critères
    const baseQuery = query(
      productsRef,
      where('categoryId', '==', categoryId),
      where('isActive', '==', true),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const snapshot = await getDocs(baseQuery);
    
    // Utiliser un Set pour éviter les doublons
    const uniqueProducts = new Map();
    
    snapshot.docs.forEach(doc => {
      const productData = doc.data();
      if (doc.id !== currentProductId && !uniqueProducts.has(doc.id)) {
        uniqueProducts.set(doc.id, {
          ...productData,
          id: doc.id,
          price: Number(productData.price) || 0,
          minOrder: Number(productData.minOrder) || 1,
        } as FirebaseProduct);
      }
    });
    
    // Convertir la Map en tableau
    const products = Array.from(uniqueProducts.values());
    
    // Optionnel : trier pour mettre les produits du même fournisseur en premier
    products.sort((a, b) => {
      if (a.companyId === companyId && b.companyId !== companyId) return -1;
      if (a.companyId !== companyId && b.companyId === companyId) return 1;
      return 0;
    });
    
    setSimilarProducts(products);
    
    if (!snapshot.empty) {
      setLastSimilarDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMoreSimilar(snapshot.docs.length === 50);
    } else {
      setHasMoreSimilar(false);
    }
    
  } catch (error) {
    console.error("Erreur:", error);
  } finally {
    setLoadingSimilar(false);
  }
};

  // --- RÉCUPÉRATION DES COULEURS DISPONIBLES POUR LE CARROUSEL ---
  const availableColors = useMemo(() => {
    if (!product?.variantAttributes) return [];
    
    const colorAttr = product.variantAttributes.find(
      attr => attr.name.toLowerCase().includes('couleur') || 
              attr.name.toLowerCase().includes('color')
    );
    
    return colorAttr?.values || [];
  }, [product]);

  // --- RÉCUPÉRATION DES TAILLES DISPONIBLES ---
  const availableSizes = useMemo(() => {
    if (!product?.variantAttributes) return [];
    
    const sizeAttr = product.variantAttributes.find(
      attr => attr.name.toLowerCase().includes('taille') || 
              attr.name.toLowerCase().includes('size')
    );
    
    return sizeAttr?.values || [];
  }, [product]);

  // --- INITIALISATION DE LA MATRICE DE COMMANDE ---
  useEffect(() => {
    if (!product) return;

    if (product.hasVariants && product.variantAttributes) {
      const colorAttr = product.variantAttributes.find(
        attr => attr.name.toLowerCase().includes('couleur') || 
                attr.name.toLowerCase().includes('color')
      );
      
      const sizeAttr = product.variantAttributes.find(
        attr => attr.name.toLowerCase().includes('taille') || 
                attr.name.toLowerCase().includes('size')
      );

      const newMatrix: Record<string, OrderMatrixItem> = {};

      if (colorAttr?.values && sizeAttr?.values) {
        // Créer un Map pour un accès rapide aux variantes existantes
        const variantMap = new Map();
        product.variants?.forEach(variant => {
          const key = `${variant.color}-${variant.size}`;
          variantMap.set(key, variant);
        });

        // Générer toutes les combinaisons
        colorAttr.values.forEach(color => {
          sizeAttr.values.forEach(size => {
            const variantKey = `${color}-${size}`;
            const existingVariant = variantMap.get(variantKey);
            const matrixKey = `${color}_${size}`;
            
            newMatrix[matrixKey] = {
              variantId: existingVariant?.id || `generated-${color}-${size}`,
              color: color,
              size: size,
              quantity: 0,
              price: existingVariant?.price || product.price,
              stock: existingVariant?.stock || 0,
              image: existingVariant?.image || product.mainImage,
              sku: existingVariant?.sku || `${product.id}-${color}-${size}`
            };
          });
        });

        setOrderMatrix(newMatrix);
        
        // Initialiser la première couleur sélectionnée
        if (colorAttr.values.length > 0 && !selectedCarouselColor) {
          setSelectedCarouselColor(colorAttr.values[0]);
        }
      } 
      else if (colorAttr?.values) {
        colorAttr.values.forEach(color => {
          const existingVariant = product.variants?.find(v => v.color === color);
          newMatrix[color] = {
            variantId: existingVariant?.id || `generated-${color}`,
            color: color,
            size: '',
            quantity: 0,
            price: existingVariant?.price || product.price,
            stock: existingVariant?.stock || 0,
            image: existingVariant?.image || product.mainImage,
            sku: existingVariant?.sku || `${product.id}-${color}`
          };
        });
        setOrderMatrix(newMatrix);
        
        if (colorAttr.values.length > 0 && !selectedCarouselColor) {
          setSelectedCarouselColor(colorAttr.values[0]);
        }
      }
      else if (sizeAttr?.values) {
        sizeAttr.values.forEach(size => {
          const existingVariant = product.variants?.find(v => v.size === size);
          newMatrix[size] = {
            variantId: existingVariant?.id || `generated-${size}`,
            color: '',
            size: size,
            quantity: 0,
            price: existingVariant?.price || product.price,
            stock: existingVariant?.stock || 0,
            image: existingVariant?.image || product.mainImage,
            sku: existingVariant?.sku || `${product.id}-${size}`
          };
        });
        setOrderMatrix(newMatrix);
      }
      else {
        product.variants?.forEach(variant => {
          const matrixKey = variant.color && variant.size ? `${variant.color}_${variant.size}` : variant.id;
          newMatrix[matrixKey] = {
            variantId: variant.id || matrixKey,
            color: variant.color || '',
            size: variant.size || '',
            quantity: 0,
            price: variant.price,
            stock: variant.stock,
            image: variant.image,
            sku: variant.sku
          };
        });
        setOrderMatrix(newMatrix);
      }
    } else if (product && !product.hasVariants) {
      setOrderMatrix({
        default: {
          variantId: 'default',
          color: '',
          size: '',
          quantity: product.minOrder || 1,
          price: product.price,
          stock: product.stockQuantity || 0,
          image: product.mainImage,
          sku: product.id
        }
      });
    }
  }, [product]);
  
  // Dédoublonnage automatique des produits similaires
const uniqueSimilarProducts = useMemo(() => {
  const uniqueMap = new Map();
  similarProducts.forEach(product => {
    if (!uniqueMap.has(product.id)) {
      uniqueMap.set(product.id, product);
    }
  });
  return Array.from(uniqueMap.values());
}, [similarProducts]);
  
  
const loadMoreSimilar = async () => {
  if (loadingMoreSimilar || !hasMoreSimilar || !lastSimilarDoc || !product?.categoryId) return;

  try {
    setLoadingMoreSimilar(true);
    console.log("🚀 Chargement de plus de produits...");

    const productsRef = collection(db, 'products');
    
    const nextQ = query(
      productsRef,
      where('categoryId', '==', product.categoryId),
      where('isActive', '==', true),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
      startAfter(lastSimilarDoc),
      limit(20)
    );

    const snapshot = await getDocs(nextQ);
    console.log("📊 Nouveaux produits:", snapshot.docs.length);

    if (!snapshot.empty) {
      // Créer un Set des IDs existants pour éviter les doublons
      const existingIds = new Set(similarProducts.map(p => p.id));
      
      const nextProducts = snapshot.docs
        .map(doc => ({
          ...doc.data(),
          id: doc.id,
          price: Number(doc.data().price) || 0,
        } as FirebaseProduct))
        .filter(p => p.id !== product.id && !existingIds.has(p.id)); // ← Filtrage anti-doublon

      if (nextProducts.length > 0) {
        setSimilarProducts(prev => [...prev, ...nextProducts]);
        setLastSimilarDoc(snapshot.docs[snapshot.docs.length - 1]);
        setHasMoreSimilar(snapshot.docs.length === 20);
      } else {
        // Si tous les produits étaient des doublons, on continue quand même
        setHasMoreSimilar(snapshot.docs.length === 20);
      }
    } else {
      setHasMoreSimilar(false);
      console.log("🏁 Fin des produits.");
    }
  } catch (error) {
    console.error("🔥 ERREUR FIREBASE:", error);
  } finally {
    setLoadingMoreSimilar(false);
  }
};

  // --- FILTRER LA MATRICE PAR COULEUR SÉLECTIONNÉE ---
  const filteredMatrix = useMemo(() => {
    if (!selectedCarouselColor || !Object.keys(orderMatrix).length) {
      return Object.values(orderMatrix);
    }
    
    // Si le produit a des tailles, filtrer par couleur
    if (availableSizes.length > 0) {
      return Object.values(orderMatrix).filter(item => item.color === selectedCarouselColor);
    }
    // Sinon retourner toute la matrice
    return Object.values(orderMatrix);
  }, [orderMatrix, selectedCarouselColor, availableSizes.length]);

  // --- RÉCUPÉRATION DU PRODUIT DEPUIS FIRESTORE ---
  useEffect(() => {
    const fetchProduct = async () => {
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
          console.warn(`⚠️ Document ${normalizedId} introuvable`);
          setError("Produit non trouvé");
          setProduct(null);
        } else {
          const productData = productSnap.data();
          
          if (productData.name === undefined) {
            setError("Ce produit n'a pas de nom valide");
            setProduct(null);
            return;
          }
          
          const productWithId: FirebaseProduct = {
            ...productData,
            id: productSnap.id,
            price: Number(productData.price) || 0,
            minOrder: Number(productData.minOrder) || 1,
            stockQuantity: Number(productData.stockQuantity) || 0,
            inStock: productData.inStock ?? (Number(productData.stockQuantity) > 0)
          } as FirebaseProduct;
          
          setProduct(productWithId);
          
          if (productWithId.categoryId) {
            fetchSimilarProducts(
              productWithId.categoryId, 
              productWithId.companyId || '', 
              productWithId.id
            );
          }
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

  // --- CALCUL DU TOTAL DES QUANTITÉS ---
  const totalQuantity = useMemo(() => {
    return Object.values(orderMatrix).reduce((sum, item) => sum + item.quantity, 0);
  }, [orderMatrix]);

  // --- CALCUL DU PRIX TOTAL ---
  const totalPrice = useMemo(() => {
    return Object.values(orderMatrix).reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
  }, [orderMatrix]);

  // --- VÉRIFICATION SI LE MOQ EST ATTEINT ---
  const isMOQReached = useMemo(() => {
    return totalQuantity >= (product?.minOrder || 1);
  }, [totalQuantity, product?.minOrder]);

  // --- DÉTERMINATION DU PALIER DE PRIX (GROSSISTE OU DÉTAIL) ---
  const isWholesale = isMOQReached;

  // --- PRIX UNITAIRE EFFECTIF POUR CHAQUE LIGNE ---
  const getEffectiveUnitPrice = (item: OrderMatrixItem) => {
    if (!product) return item.price;
    
    if (isWholesale) {
      const existingVariant = product.variants?.find(
        v => v.color === item.color && v.size === item.size
      );
      
      if (existingVariant?.wholesalePrice) {
        return existingVariant.wholesalePrice;
      }
      
      return product.wholesalePrice || item.price;
    }
    
    return item.price;
  };

  // --- GESTIONNAIRE DE QUANTITÉ ---
  const handleQuantityChange = (matrixKey: string, newQuantity: number) => {
    setOrderMatrix(prev => {
      const item = prev[matrixKey];
      if (!item) return prev;
      
      // Validation du stock
      const validQuantity = Math.max(0, Math.min(newQuantity, item.stock));
      
      return {
        ...prev,
        [matrixKey]: {
          ...item,
          quantity: validQuantity
        }
      };
    });
  };

  const incrementQuantity = (matrixKey: string) => {
    const item = orderMatrix[matrixKey];
    if (item && item.quantity < item.stock) {
      handleQuantityChange(matrixKey, item.quantity + 1);
    }
  };

  const decrementQuantity = (matrixKey: string) => {
    const item = orderMatrix[matrixKey];
    if (item && item.quantity > 0) {
      handleQuantityChange(matrixKey, item.quantity - 1);
    }
  };

  // --- FONCTION AJOUT AU PANIER (GROUPÉ) ---
const handleAddToCart = () => {
  if (!product) {
    Alert.alert("Erreur", "Produit non chargé");
    return false;
  }

  const itemsToAdd = Object.values(orderMatrix).filter(
    (item) => item.quantity > 0
  );

  if (itemsToAdd.length === 0) {
    Alert.alert(
      "Sélection requise",
      "Veuillez sélectionner au moins une variante à commander."
    );
    return false; // ❗ empêche la navigation
  }

  setAddingToCart(true);

  try {
    itemsToAdd.forEach((item) => {
      const unitPrice = getEffectiveUnitPrice(item);

      const productForCart = {
        id: product.id,
        cartId: `${product.id}-${item.color || "NS"}-${item.size || "NS"}`,
        name: product.name,
        price: unitPrice,
        quantity: item.quantity,
        selectedSize: item.size || null,
        selectedColor: item.color || null,
        image: item.image || product.mainImage || product.images?.[0] || "",
        seller: product.companyName || product.supplier || "Vendeur",
        minOrder: product.minOrder || 1,
        inStock: product.inStock ?? true,
        originalCurrency: product.currency || "XOF",
        hasFreeShipping: product.hasFreeShipping || false,
      };

      addToCart(productForCart);
    });

    Alert.alert("Succès", "Produit ajouté au panier");

    return true; // ❗ succès

  } catch (error) {
    console.error("Erreur ajout panier:", error);
    Alert.alert("Erreur", "Impossible d'ajouter au panier");
    return false;

  } finally {
    setAddingToCart(false);
  }
};

const handleBuyNow = async () => {
  if (!product) {
    Alert.alert("Erreur", "Produit non chargé");
    return;
  }

  const itemsToOrder = Object.values(orderMatrix).filter(
    (item) => item.quantity > 0
  );

  if (itemsToOrder.length === 0) {
    Alert.alert(
      "Sélection requise",
      "Veuillez sélectionner au moins une variante avant de commander."
    );
    return;
  }

  setAddingToCart(true);

  try {
    // 1. On prépare les données des produits (exactement comme ton panier)
    const formattedItems = itemsToOrder.map((item) => {
      const unitPrice = getEffectiveUnitPrice(item);
      return {
        id: product.id,
        cartId: `${product.id}-${item.color || "NS"}-${item.size || "NS"}`,
        name: product.name,
        price: unitPrice,
        quantity: item.quantity,
        selectedSize: item.size || null,
        selectedColor: item.color || null,
        image: item.image || product.mainImage || product.images?.[0] || "",
        seller: product.companyName || product.supplier || "Vendeur",
        minOrder: product.minOrder || 1,
        hasFreeShipping: product.hasFreeShipping || false,
      };
    });

    // 2. Optionnel : On les ajoute quand même au panier pour que l'utilisateur les retrouve s'il quitte
    formattedItems.forEach(item => addToCart(item));

    // 3. On prépare l'objet global pour le checkout
    const orderData = {
      items: formattedItems,
      summary: {
        subtotal: totalPrice, // Assure-toi que totalPrice est calculé dans ton composant
        shipping: 0,
        total: totalPrice
      }
    };

    // 4. Redirection immédiate
router.push({
  pathname: "/checkout",
  params: {
    orderData: encodeURIComponent(JSON.stringify(orderData))
  }
});

  } catch (error) {
    console.error("Erreur Buy Now:", error);
    Alert.alert("Erreur", "Impossible de lancer la commande");
  } finally {
    setAddingToCart(false);
  }
};

const handleChat = () => {
  if (!product) {
    console.error("❌ Produit introuvable");
    return;
  }

  const sellerId =
  product.uid ||
  product.sellerId ||
  product.vendorId ||
  product.ownerId;

  if (!sellerId) {
    console.error("❌ UID vendeur manquant dans le produit", product);
    return;
  }

  const mainImage =
    product.images?.[0] ||
    product.mainImage ||
    product.imageUrl ||
    "";

  const formattedPrice = `${product.price?.toLocaleString()} ${
    product.currency || "FCFA"
  }`;

  console.log("🧭 Navigation vers conversation avec UID vendeur:", sellerId);

  router.push({
    pathname: "/conversation/[id]",
    params: {
      id: sellerId,
      sellerId: sellerId,
      productId: product.id,
      productName: product.name,
      productImage: mainImage,
      productPrice: formattedPrice,
      sellerName:
        product.companyName ||
        product.supplier ||
        "Vendeur A2Express",
      sellerLogo:
        product.logo ||
        product.companyLogo ||
        "",
    },
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

  // --- COMPOSANT POUR LE CARROUSEL DE COULEURS ---
  const ColorCarousel = () => {
    if (!availableColors.length) return null;

    return (
      <View style={styles.colorCarouselContainer}>
        <Text style={styles.colorCarouselTitle}>Couleurs disponibles:</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.colorCarouselScroll}
        >
          {availableColors.map((color, index) => {
            const variantWithColor = product?.variants?.find(v => v.color === color);
            const imageSource = variantWithColor?.image || product?.mainImage;
            const totalStock = Object.values(orderMatrix)
              .filter(item => item.color === color)
              .reduce((sum, item) => sum + item.stock, 0);
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.colorCarouselItem,
                  selectedCarouselColor === color && styles.colorCarouselItemSelected
                ]}
                onPress={() => setSelectedCarouselColor(color)}
              >
                <Image 
                  source={{ uri: imageSource || 'https://via.placeholder.com/60' }}
                  style={styles.colorCarouselImage}
                />
                <View style={styles.colorCarouselInfo}>
                  <Text style={styles.colorCarouselColorName}>{color}</Text>
                  <Text style={styles.colorCarouselStock}>
                    {totalStock} en stock
                  </Text>
                </View>
                {selectedCarouselColor === color && (
                  <View style={styles.colorCarouselCheck}>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // --- COMPOSANT POUR LA LIGNE DE TAILLE ---
  const SizeRow = ({ item, matrixKey }: { item: OrderMatrixItem; matrixKey: string }) => {
    const unitPrice = getEffectiveUnitPrice(item);
    
    return (
      <View style={styles.sizeRow}>
        <View style={styles.sizeInfo}>
          <Text style={styles.sizeName}>{item.size || 'Standard'}</Text>
          <View style={styles.sizePriceStock}>
            <Text style={styles.sizePrice}>{formatDisplayPrice(unitPrice)}</Text>
            <Text style={[
              styles.sizeStock,
              item.stock > 10 ? styles.inStock : 
              item.stock > 0 ? styles.lowStock : 
              styles.outOfStock
            ]}>
              Stock: {item.stock}
            </Text>
          </View>
        </View>

        {/* Stepper */}
        <View style={styles.stepperContainer}>
          <TouchableOpacity 
            style={[styles.stepperButton, item.quantity === 0 && styles.stepperButtonDisabled]}
            onPress={() => decrementQuantity(matrixKey)}
            disabled={item.quantity === 0}
          >
            <Ionicons name="remove" size={16} color={item.quantity === 0 ? '#CCC' : COLORS.primary} />
          </TouchableOpacity>
          
          <TextInput
            style={styles.stepperInput}
            value={item.quantity.toString()}
            keyboardType="numeric"
            onChangeText={(text) => {
              const num = parseInt(text) || 0;
              handleQuantityChange(matrixKey, num);
            }}
          />
          
          <TouchableOpacity 
            style={[styles.stepperButton, item.quantity >= item.stock && styles.stepperButtonDisabled]}
            onPress={() => incrementQuantity(matrixKey)}
            disabled={item.quantity >= item.stock}
          >
            <Ionicons name="add" size={16} color={item.quantity >= item.stock ? '#CCC' : COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
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

  // --- COMPOSANT POUR LE RÉCAPITULATIF DYNAMIQUE ---
  const OrderSummary = () => {
    if (totalQuantity === 0) return null;

    return (
      <View style={styles.summaryContainer}>
        <View style={styles.summaryContent}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryTitle}>Récapitulatif de commande</Text>
            <Text style={styles.summarySubtitle}>
              {totalQuantity} article(s) sélectionné(s)
            </Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryPrice}>{formatDisplayPrice(totalPrice)}</Text>
            {!isMOQReached && product && (
              <Text style={styles.summaryMOQWarning}>
                Minimum de commande: {product.minOrder} pièces
              </Text>
            )}
          </View>
        </View>
      </View>
    );
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
  scrollEventThrottle={16} // 16ms = 60fps, plus fluide
  onScroll={({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    
    // Seuil plus conservateur (300px au lieu de 200)
    const threshold = 300;
    const isCloseToBottom = 
      layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold;
    
    // IMPORTANT : Appeler loadMoreSimilar UNE SEULE fois
    if (isCloseToBottom && !loadingMoreSimilar && hasMoreSimilar && lastSimilarDoc) {
      loadMoreSimilar();
    }
  }}
>
        {/* GALERIE D'IMAGES */}
        <ProductGallery 
          images={product.images?.length ? product.images : [product.mainImage]}
        />

{/* SECTION PRINCIPALE - NOM ET PRIX */}
        <View style={styles.mainInfo}>
          
          {/* 1. Badges statut (Nouveau, Tendance, etc.) */}
          <View style={styles.badgesContainer}>
            {product.newArrival && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Nouveau</Text>
              </View>
            )}
            {product.featured && (
              <View style={[styles.badge, styles.featuredBadge]}>
                <Text style={styles.badgeText}>En vedette</Text>
              </View>
            )}
            {product.trending && (
              <View style={[styles.badge, styles.trendingBadge]}>
                <Text style={styles.badgeText}>Tendance</Text>
              </View>
            )}
          </View>

          {/* 2. Nom du produit (Affiché une seule fois) */}
          <Text style={styles.productName}>{product.name}</Text>

{/* 3. Zone de Prix Dynamique */}
          <View style={styles.priceContainer}>
            {/* Prix Actuel */}
            <Text style={styles.currentPriceText}>
              {formatDisplayPrice(effectiveUnitPrice)}
            </Text>

            {/* Prix barré et Badge - Affichés seulement si une réduction existe */}
            {product.originalPrice && Number(product.originalPrice) > effectiveUnitPrice ? (
              <View style={styles.originalPriceContainer}>
                <Text style={styles.originalPriceText}>
                  {formatDisplayPrice(Number(product.originalPrice))}
                </Text>
                
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>
                    -{Math.round((1 - effectiveUnitPrice / (Number(product.originalPrice) || 1)) * 100)}%
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* 4. Livraison Gratuite */}
          {product.hasFreeShipping && (
            <View style={styles.freeShippingBadgeContainer}>
              <Ionicons name="airplane" size={16} color={COLORS.success} />
              <Text style={styles.freeShippingBadgeText}>Livraison gratuite</Text>
            </View>
          )}

          {/* 5. Sélecteur Mode Gros/Détail */}
          <View style={styles.priceModeContainer}>
            <View style={[styles.priceModeBadge, !isWholesale && styles.priceModeActive]}>
              <Text style={[styles.priceModeText, !isWholesale && styles.priceModeTextActive]}>Détail</Text>
            </View>
            <View style={[styles.priceModeBadge, isWholesale && styles.priceModeActive]}>
              <Text style={[styles.priceModeText, isWholesale && styles.priceModeTextActive]}>Gros</Text>
            </View>
          </View>

          {/* 6. Description */}
          {product.description ? (
            <Text style={styles.description}>{product.description}</Text>
          ) : null}

          {/* 7. SECTION BOUTIQUE */}
          {company ? (
            <View style={styles.companySection}>
              <TouchableOpacity 
                style={styles.companyCard} 
                onPress={handleCompanyPress}
                activeOpacity={0.7}
              >
                <View style={styles.companyHeader}>
                  <View style={styles.companyLogoContainer}>
                    {company.logo && typeof company.logo === 'string' && company.logo.startsWith('http') ? (
                      <Image source={{ uri: company.logo }} style={styles.companyLogo} />
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
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </View>
              </TouchableOpacity>
            </View>
          ) : loadingCompany ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ margin: 20 }} />
          ) : null}

          <TrustBadges />
        </View>

        {/* CARROUSEL DE COULEURS ET MATRICE (HORS DU MAININFO) */}
        {availableColors.length > 0 && <ColorCarousel />}

        {filteredMatrix.length > 0 && (
          <View style={styles.matrixSection}>
            <View style={styles.matrixHeader}>
              <Text style={styles.matrixTitle}>
                {selectedCarouselColor ? `Tailles - ${selectedCarouselColor}` : 'Tailles disponibles'}
              </Text>
              {totalQuantity > 0 && (
                <Text style={styles.matrixSubtitle}>{totalQuantity} sélectionné(s)</Text>
              )}
            </View>
            <View style={styles.sizesList}>
              {filteredMatrix.map((item) => {
                const matrixKey = item.color && item.size ? `${item.color}_${item.size}` : item.variantId;
                return <SizeRow key={matrixKey} item={item} matrixKey={matrixKey} />;
              })}
            </View>
          </View>
        )}
        {/* RÉCAPITULATIF DYNAMIQUE */}
        <OrderSummary />

        {/* INFORMATIONS PRODUIT */}
        <View style={styles.infoCard}>
          {/* Disponibilité */}
          <View style={styles.infoRow}>
            <Ionicons name="cube-outline" size={18} color="#666" />
            <Text style={styles.infoLabel}>Disponibilité:</Text>
            <Text style={[
              styles.infoValue,
              product.inStock ? styles.inStock : styles.outOfStock
            ]}>
              {product.inStock ? 'En stock' : 'Non disponible'}
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
          quantity={totalQuantity || product.minOrder}
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

        {/* SECTION PRODUITS SIMILAIRES */}
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
  data={uniqueSimilarProducts}
  renderItem={({ item }) => <SimilarProductCard product={item} />}
  keyExtractor={(item) => `similar-${item.id}`}
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
    ...product,
    imageUrl: product.images?.[0] || product.mainImage || '',
    price: effectiveUnitPrice,
  }}
  onChat={handleChat}
  onAddToCart={handleAddToCart} // Bouton "Panier" (icône)
  onBuyNow={handleBuyNow}       // Bouton "Commander" (orange) ✅
  addingToCart={addingToCart}
/>

      {/* MODAL DE DEVIS GROSSISTE */}
      <WholesaleQuoteForm 
        visible={isQuoteVisible}
        onClose={() => setIsQuoteVisible(false)}
        productName={product.name}
        productId={product.id}
        productImages={product.images || [product.mainImage]}
        currentPrice={product.price}
        supplierName={product.companyName || product.supplier}
        supplierId={product.companyId}
        minOrder={product.minOrder}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: COLORS.white 
  },
  
  freeShippingBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F7E6', // Un vert pâle très propre
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 5,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#B2E2B2',
  },
  freeShippingBadgeText: {
    color: '#008517', // Le vert "Success" de ta config COLORS
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
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
  priceModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    padding: 2,
    alignSelf: 'flex-start',
    marginBottom: 12
  },
  priceModeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 18
  },
  priceModeActive: {
    backgroundColor: COLORS.primary
  },
  priceModeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500'
  },
  priceModeTextActive: {
    color: COLORS.white
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
  // Styles pour le carrousel de couleurs
  colorCarouselContainer: {
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  colorCarouselTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  colorCarouselScroll: {
    flexDirection: 'row',
  },
  colorCarouselItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 8,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    minWidth: 150,
  },
  colorCarouselItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF0E6',
  },
  colorCarouselImage: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 8,
  },
  colorCarouselInfo: {
    flex: 1,
  },
  colorCarouselColorName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  colorCarouselStock: {
    fontSize: 11,
    color: '#666',
  },
  colorCarouselCheck: {
    marginLeft: 4,
  },
  // Styles pour la matrice
  matrixSection: {
    backgroundColor: COLORS.white,
    marginBottom: 8,
    padding: 16,
  },
  matrixHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  matrixTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  matrixSubtitle: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  sizesList: {
    gap: 12,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  sizeInfo: {
    flex: 1,
    marginRight: 12,
  },
  sizeName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  sizePriceStock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sizePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  sizeStock: {
    fontSize: 12,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 6,
    overflow: 'hidden',
  },
  stepperButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  stepperButtonDisabled: {
    backgroundColor: '#F0F0F0',
  },
  stepperInput: {
    width: 40,
    height: 32,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.lightGray,
    padding: 0,
  },
  noSizesContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noSizesText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  // Styles pour le récapitulatif
  summaryContainer: {
    backgroundColor: COLORS.white,
    marginBottom: 8,
    padding: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.lightGray,
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLeft: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 12,
    color: '#666',
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  summaryMOQWarning: {
    fontSize: 11,
    color: COLORS.warning,
    fontWeight: '500',
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