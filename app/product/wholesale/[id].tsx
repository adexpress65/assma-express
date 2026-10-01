import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalizedProductText } from '../../../src/utils/productLocale';
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
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../src/config/firebase';

// Imports des composants
import ActionFooter from '../../../src/components/ActionFooter';
import WholesaleQuoteForm from '../../../src/components/WholesaleQuoteForm';
import ProductGallery from '../../../src/components/ProductGallery';
import TrustBadges from '../../../src/components/TrustBadges';
import { useCart } from '../../../src/contexts/CartContext';
import { useCurrency } from '../../../src/contexts/CurrencyContext';
import { useAuth } from '../../../src/contexts/AuthContext';
import { useRequireAuth } from '../../../src/contexts/AuthGuardContext';
import { isZeroDollarsShop, isZeroDollarsProduct } from '../../../src/utils/zeroDollarsShop';
import { displaySellerName } from '../../../src/utils/companyDisplayName';
import { buildCartLineId } from '../../../src/utils/orderItemVariants';
import ZeroDollarsFreeBadge from '../../../src/components/ZeroDollarsFreeBadge';
import { MAX_ORDER_QUANTITY } from '../../../src/constants/order';
import { shareProduct } from '../../../src/utils/shareProduct';
import {
  attributeValues,
  buildOrderMatrix,
  findColorAttribute,
  findSizeAttribute,
  normalizeColorKey,
  normalizeVariantAttributes,
} from '../../../src/utils/productStock';

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
  unlimitedStock?: boolean;
  hasVariants: boolean;
  variantColors?: string[];
  variantSizes?: string[];
  attributes?: Array<{
    id?: string;
    name: string;
    values: string[];
  }>;
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
  uid?: string;
  sellerId?: string;
  sellerUid?: string;
  vendorId?: string;
  ownerId?: string;
  creatorId?: string;
  isActive?: boolean;
  isVerified?: boolean;
  industrial?: boolean;
  premiumSupplier?: boolean;
  slug?: string;
  nameLower?: string;
  wholesalePrice?: number;
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
  extraLabel?: string;
}

export default function ProductDetailScreen() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { requireAuth } = useRequireAuth();
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

  const localizedTitle = useMemo(
    () =>
      product
        ? getLocalizedProductText(
            product.name,
            'name',
            product as unknown as Record<string, unknown>,
            i18n.language,
          )
        : '',
    [product, i18n.language],
  );

  const localizedDescription = useMemo(
    () =>
      product
        ? getLocalizedProductText(
            product.description,
            'description',
            product as unknown as Record<string, unknown>,
            i18n.language,
          )
        : '',
    [product, i18n.language],
  );

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
  const fetchSimilarProducts = async (categoryId: string, companyId: string, currentProductId: string) => {
    if (!categoryId) return;
    
    setLoadingSimilar(true);
    try {
      const productsRef = collection(db, 'products');
      let products: FirebaseProduct[] = [];
      
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
      
      setSimilarProducts(products.slice(0, 6));
    } catch (error) {
      console.error("Erreur lors de la récupération des produits similaires:", error);
    } finally {
      setLoadingSimilar(false);
    }
  };

  // --- RÉCUPÉRATION DES COULEURS DISPONIBLES POUR LE CARROUSEL ---
  const availableColors = useMemo(() => {
    if (!product) return [];
    const normalized = normalizeVariantAttributes(product);
    return attributeValues(findColorAttribute(normalized.attributes));
  }, [product]);

  // --- INITIALISATION DE LA MATRICE DE COMMANDE ---
  useEffect(() => {
    if (!product) return;

    const normalizedProduct = normalizeVariantAttributes(product);
    const attrs = normalizedProduct.attributes || [];
    const colorAttributeMeta = findColorAttribute(attrs);
    const sizeAttributeMeta = findSizeAttribute(attrs);

    setOrderMatrix(buildOrderMatrix(normalizedProduct, colorAttributeMeta, sizeAttributeMeta));

    const colors = attributeValues(colorAttributeMeta);
    if (colors.length && !selectedCarouselColor) {
      setSelectedCarouselColor(colors[0]);
    }
  }, [product]);

  // --- FILTRER LA MATRICE PAR COULEUR SÉLECTIONNÉE ---
  const filteredMatrixEntries = useMemo(() => {
    const entries = Object.entries(orderMatrix);
    if (entries.length === 0) return entries;

    if (availableColors.length > 0 && selectedCarouselColor) {
      const selected = normalizeColorKey(selectedCarouselColor);
      const matching = entries.filter(
        ([, item]) => normalizeColorKey(item.color) === selected,
      );
      if (matching.length > 0) return matching;
      const uncolored = entries.filter(([, item]) => !normalizeColorKey(item.color));
      if (uncolored.length > 0) return uncolored;
    }

    return entries;
  }, [orderMatrix, selectedCarouselColor, availableColors.length]);

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
            unlimitedStock: productData.unlimitedStock === true,
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

  // --- VÉRIFICATION SI LE MOQ EST ATTEINT ---
  const isMOQReached = useMemo(() => {
    return totalQuantity >= (product?.minOrder || 1);
  }, [totalQuantity, product?.minOrder]);

  // --- DÉTERMINATION DU PALIER DE PRIX (GROSSISTE OU DÉTAIL) ---
  const isWholesale = isMOQReached;

  // --- PRIX UNITAIRE EFFECTIF POUR CHAQUE LIGNE ---
  const getEffectiveUnitPrice = useCallback(
    (item: OrderMatrixItem) => {
      if (!product) return item.price;
      const catalog = Number(product.price) || 0;
      const isZero = isZeroDollarsProduct({
        price: catalog,
        basePrice: product.basePrice as any,
        companyName: product.companyName,
        supplier: product.supplier,
        seller: (product as any).seller,
        name: product.name,
      });
      if (isZero) return 0;

      if (isWholesale) {
        const existingVariant = product.variants?.find(
          (v) => v.color === item.color && v.size === item.size,
        );

        if (existingVariant?.wholesalePrice) {
          return existingVariant.wholesalePrice;
        }

        return product.wholesalePrice || catalog;
      }

      return catalog;
    },
    [product, isWholesale],
  );

  // --- CALCUL DU PRIX TOTAL ---
  const totalPrice = useMemo(() => {
    return Object.values(orderMatrix).reduce((sum, item) => {
      return sum + getEffectiveUnitPrice(item) * item.quantity;
    }, 0);
  }, [orderMatrix, getEffectiveUnitPrice]);

  // --- GESTIONNAIRE DE QUANTITÉ ---
  const handleQuantityChange = (matrixKey: string, newQuantity: number) => {
    setOrderMatrix(prev => {
      const item = prev[matrixKey];
      if (!item) return prev;

      const validQuantity = Math.max(0, Math.min(newQuantity, MAX_ORDER_QUANTITY));
      
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
    if (item && item.quantity < MAX_ORDER_QUANTITY) {
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
    if (!requireAuth({ reason: 'add_to_cart', onAuthorized: handleAddToCart })) return;

    if (!product) {
      Alert.alert("Erreur", "Produit non chargé");
      return;
    }

    const selected = Object.values(orderMatrix).filter(item => item.quantity > 0);
    const itemsToAdd = selected;

    if (itemsToAdd.length === 0) {
      Alert.alert("Sélection requise", "Veuillez sélectionner au moins une variante à commander.");
      return;
    }

    if (!isMOQReached) {
      Alert.alert(
        "Quantité minimale",
        `La quantité minimale de commande est de ${product.minOrder || 1} article(s).`
      );
      return;
    }

    setAddingToCart(true);

    // Ajouter chaque ligne au panier
    itemsToAdd.forEach(item => {
      const unitPrice = getEffectiveUnitPrice(item);
      
      const productForCart = {
        id: product.id,
        cartId: buildCartLineId(product.id, item.size, item.color),
        name: product.name,
        price: unitPrice,
        quantity: item.quantity,
        selectedSize: item.size || null,
        selectedColor: item.color || null,
        image: item.image || product.mainImage || product.images?.[0],
        seller: displaySellerName({
          seller: product.supplier,
          companyName: product.companyName,
          companyId: product.companyId,
        }),
        minOrder: Number(product.minOrder) || 1,
        inStock: product.inStock ?? true,
        originalCurrency: 'XOF'
      };

      addToCart(productForCart);
    });

    setTimeout(() => {
      setAddingToCart(false);
      Alert.alert(
        "✅ Produits ajoutés",
        `${itemsToAdd.length} variante(s) ajoutée(s) au panier (total: ${totalQuantity} pièces)`,
        [
          { text: "Continuer vos achats", style: "cancel" },
          { text: "Voir le panier", onPress: () => router.push('/cart') }
        ]
      );
    }, 500);
  };

const handleChat = async () => {
  if (!product) return;

  if (!user?.uid) {
    requireAuth({
      reason: 'contact_seller',
      onAuthorized: () => { void handleChat(); },
    });
    return;
  }

  const sellerUid = product.sellerUid;
  const companyDocId = product.companyId;

  if (!companyDocId || !sellerUid) {
    console.error("Produit invalide :", product);
    Alert.alert(
      "Contact indisponible",
      "Produit invalide : companyId/sellerUid manquant. Impossible d'ouvrir la discussion.",
    );
    return;
  }

  // Un fil par boutique ET par client : sans le suffixe utilisateur, tous les
  // clients d'une même boutique partageraient le même document de conversation.
  const conversationId = `${companyDocId}_${user.uid}`;

  const mainImage =
    product.images?.[0] || product.mainImage || "";

  router.push({
    pathname: "/conversation/[id]",
    params: {
      id: conversationId,
      sellerId: sellerUid ? String(sellerUid) : companyDocId,
      companyId: companyDocId || undefined,
      productId: product.id,
      productContext: "1",
      productName: product.name,
      productImage: mainImage,
      productPrice: `${product.price.toLocaleString()} ${
        product.currency || "FCFA"
      }`,
      sellerName:
        product.companyName ||
        product.supplier ||
        "Vendeur",
    },
  });
};

const isValidProductForConversation = Boolean(product?.companyId && product?.sellerUid);

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
                    {t('productCard.inStock')}
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
    const maxQty = MAX_ORDER_QUANTITY;
    const unitPrice = getEffectiveUnitPrice(item);
    
    return (
      <View style={styles.sizeRow}>
        <View style={styles.sizeInfo}>
          <Text style={styles.sizeName}>{item.size || 'Standard'}</Text>
          <View style={styles.sizePriceStock}>
            <Text style={styles.sizePrice}>{formatDisplayPrice(unitPrice)}</Text>
            <Text style={[styles.sizeStock, styles.inStock]}>
              {t('productCard.inStock')}
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
            style={[styles.stepperButton, item.quantity >= maxQty && styles.stepperButtonDisabled]}
            onPress={() => incrementQuantity(matrixKey)}
            disabled={item.quantity >= maxQty}
          >
            <Ionicons name="add" size={16} color={item.quantity >= maxQty ? '#CCC' : COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // --- COMPOSANT POUR LA CARTE PRODUIT SIMILAIRE ---
  const SimilarProductCard = ({ product }: { product: FirebaseProduct }) => {
    const similarName = getLocalizedProductText(
      product.name,
      'name',
      product as unknown as Record<string, unknown>,
      i18n.language,
    );
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
          {isZeroDollarsShop({
            companyName: product.companyName,
            supplier: product.supplier,
          }) && (
            <View style={styles.similarZeroDollarsBadge}>
              <ZeroDollarsFreeBadge compact />
            </View>
          )}
          {product.premiumSupplier && (
            <View style={styles.premiumBadgeSmall}>
              <Ionicons name="star" size={10} color="#FFF" />
            </View>
          )}
        </View>
        
        <View style={styles.similarProductInfo}>
          <Text style={styles.similarProductName} numberOfLines={2}>
            {similarName}
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

  const handleShareProduct = () => {
    const productId = String(product?.id || id || '');
    if (!productId || !product) return;
    const unitPrice = isWholesale
      ? (product.wholesalePrice || product.price)
      : product.price;
    void shareProduct({
      productId,
      title: localizedTitle || product.name || 'Produit A2Express',
      priceLabel: formatDisplayPrice(unitPrice),
      path: `/product/wholesale/${productId}`,
    });
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
      >
        {/* GALERIE D'IMAGES */}
        <ProductGallery 
          images={product.images?.length ? product.images : [product.mainImage]}
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
          
          {/* Indicateur de prix gros/détail */}
          <View style={styles.priceModeContainer}>
            <View style={[styles.priceModeBadge, !isWholesale && styles.priceModeActive]}>
              <Text style={[styles.priceModeText, !isWholesale && styles.priceModeTextActive]}>
                Détail
              </Text>
            </View>
            <View style={[styles.priceModeBadge, isWholesale && styles.priceModeActive]}>
              <Text style={[styles.priceModeText, isWholesale && styles.priceModeTextActive]}>
                Gros
              </Text>
            </View>
          </View>
          
          {/* Nom du produit (libellés selon langue + champs Firestore `localizedNames` / `name_en` …) */}
          <View style={styles.titleRow}>
            <Text style={styles.productName}>{localizedTitle}</Text>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareProduct}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Partager ce produit"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="share-social-outline" size={20} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
          
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
            {isZeroDollarsShop({
              companyName: product.companyName,
              supplier: product.supplier,
            }) ? (
              <ZeroDollarsFreeBadge />
            ) : null}
          </View>
          
          {/* Description */}
          {localizedDescription ? (
            <Text style={styles.description}>
              {localizedDescription}
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

        {/* CARROUSEL DE COULEURS */}
        {availableColors.length > 0 && <ColorCarousel />}

        {/* MATRICE DE COMMANDE - LISTE DES TAILLES */}
        {filteredMatrixEntries.length > 0 && (
          <View style={styles.matrixSection}>
            <View style={styles.matrixHeader}>
              <Text style={styles.matrixTitle}>
                {selectedCarouselColor ? `Tailles - ${selectedCarouselColor}` : 'Tailles disponibles'}
              </Text>
              <Text style={styles.matrixSubtitle}>
                {totalQuantity > 0 ? `${totalQuantity} sélectionné(s)` : ''}
              </Text>
            </View>

            {/* Lignes de tailles */}
            <View style={styles.sizesList}>
              {filteredMatrixEntries.map(([matrixKey, item]) => (
                <SizeRow key={matrixKey} item={item} matrixKey={matrixKey} />
              ))}
            </View>

            {/* Message si aucune taille disponible */}
            {filteredMatrixEntries.length === 0 && (
              <View style={styles.noSizesContainer}>
                <Text style={styles.noSizesText}>
                  Aucune taille disponible
                </Text>
              </View>
            )}
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
          imageUrl: product.images?.[0] || product.mainImage || '',
          price: isWholesale ? (product.wholesalePrice || product.price) : product.price,
          stock: product.stockQuantity,
          minOrder: product.minOrder,
          hasVariants: product.hasVariants,
          currency: product.currency
        }}
        onChat={handleChat}
        chatDisabled={!isValidProductForConversation}
        onAddToCart={handleAddToCart}
        addingToCart={addingToCart}
        disabled={
          !product.inStock ||
          product.status !== 'published' ||
          totalQuantity === 0 ||
          !isMOQReached
        }
        disabledReason={
          !product.inStock || product.status !== 'published'
            ? 'Ce produit n’est pas disponible pour la commande.'
            : totalQuantity === 0
              ? 'Veuillez sélectionner au moins 1 article (quantité > 0).'
              : `La quantité minimale de commande est de ${product.minOrder || 1} article(s).`
        }
      />

      {/* MODAL DE DEVIS GROSSISTE */}
      <WholesaleQuoteForm 
        visible={isQuoteVisible}
        onClose={() => setIsQuoteVisible(false)}
        productName={localizedTitle}
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
    flex: 1,
    fontSize: 18, 
    color: COLORS.text, 
    lineHeight: 24, 
    fontWeight: '700' 
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
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
  similarZeroDollarsBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    zIndex: 2,
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
