import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  FlatList,
  TextInput,
  InteractionManager,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getLocalizedProductText, intlLocaleForAppLanguage } from '../../src/utils/productLocale';
import {
  getLocalizedAttributeName,
  getLocalizedVariantValue,
} from '../../src/utils/productAttributeLocale';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, limit, startAfter, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../src/config/firebase';

// Imports des composants
import ActionFooter from '../../src/components/ActionFooter';
import WholesaleQuoteForm from '../../src/components/WholesaleQuoteForm';
import ProductGallery from '../../src/components/ProductGallery';
import TrustBadges from '../../src/components/TrustBadges';
import { useCart } from '../../src/contexts/CartContext';
import { useCurrency } from '../../src/contexts/CurrencyContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRequireAuth } from '../../src/contexts/AuthGuardContext';
import { isZeroDollarsShop, isZeroDollarsProduct } from '../../src/utils/zeroDollarsShop';
import { getClientPriceXOF } from '../../src/utils/productPrice';
import {
  findWarehouse,
  isZeroFcfaCatalogPrice,
  warehouseFeeHintLabel,
  ZERO_FCFA_UNAVAILABLE_MESSAGE,
} from '../../src/utils/warehouseFee';
import { useWarehouseFees } from '../../src/hooks/useWarehouseFees';
import ZeroDollarsFreeBadge from '../../src/components/ZeroDollarsFreeBadge';
import { QuickChatModal } from '../../src/components/chat/QuickChatModal';
import { MAX_ORDER_QUANTITY } from '../../src/constants/order';
import { shareProduct } from '../../src/utils/shareProduct';
import {
  attributeValues,
  buildOrderMatrix,
  findColorAttribute,
  findSizeAttribute,
  normalizeColorKey,
  normalizeVariantAttributes,
} from '../../src/utils/productStock';
import {
  buildCartLineId,
  buildPersistedVariantLines,
} from '../../src/utils/orderItemVariants';

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
  /** Traductions optionnelles des noms/valeurs d’attributs (voir `productAttributeLocale.ts`). */
  attributesLocalized?: Array<{
    id?: string;
    names?: Record<string, string>;
    values?: Record<string, Record<string, string>>;
  }>;
  variants?: Array<{
    id: string;
    color?: string;
    size?: string;
    combination?: Record<string, string>;
    price: number;
    stock: number;
    sku: string;
    image?: string;
    wholesalePrice?: number;
    weight?: number;
    volume?: number;
  }>;
  specifications?: {
    dimensions?: string;
    modelNumber?: string;
    weight?: string | number;
    volume?: string | number;
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
  createdBy?: string;
  sellerId?: string;
  sellerUid?: string;
  vendorId?: string;
  ownerId?: string;
  logo?: string;
  companyLogo?: string;
  imageUrl?: string;
  hasFreeShipping?: boolean;
  originWarehouseId?: string | null;
  originWarehouseLabel?: string | null;
  basePrice?: number;
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
  /** Autres attributs (hors couleur/taille) affichés en sous-titre si présents. */
  extraLabel?: string;
}

type BootstrapProduct = FirebaseProduct & {
  sourceType?: 'firebase' | 'api';
};

/** Poids en kg depuis Firestore (string "1000", nombre, ou avec suffixe kg). */
function parseWeightKg(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw >= 0 ? raw : 0;
  const s = String(raw).trim().replace(/\s*kg\s*$/i, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Poids unitaire : specifications puis première variante avec weight. */
function getUnitWeightKg(product: FirebaseProduct | null): number {
  if (!product) return 0;
  const specW = parseWeightKg(product.specifications?.weight);
  if (specW > 0) return specW;
  for (const v of product.variants ?? []) {
    const w = parseWeightKg((v as { weight?: unknown }).weight);
    if (w > 0) return w;
  }
  return 0;
}

function parseVolumeM3(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw >= 0 ? raw : 0;
  const s = String(raw).trim().replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Poids / volume pour une ligne panier (variante si présente, sinon fiche produit). */
function getLineSpecsForCart(product: FirebaseProduct, item: OrderMatrixItem): { weight: string; volume: string } {
  const variant = product.variants?.find((v) => v.id === item.variantId);
  const wVar = variant ? parseWeightKg(variant.weight) : 0;
  const wSpec = parseWeightKg(product.specifications?.weight);
  const wKg = wVar > 0 ? wVar : wSpec;
  const volVar = variant ? parseVolumeM3(variant.volume) : 0;
  const volSpec = parseVolumeM3(product.specifications?.volume);
  const vol = volVar > 0 ? volVar : volSpec;
  return {
    weight: wKg > 0 ? String(wKg) : '0',
    volume: vol > 0 ? String(vol) : '0',
  };
}

function normalizeBootstrapProduct(rawValue: unknown, fallbackId?: string): BootstrapProduct | null {
  if (!rawValue || typeof rawValue !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<BootstrapProduct>;
    const id = String(parsed?.id || fallbackId || '').trim();
    if (!id) {
      return null;
    }

    const images = Array.isArray(parsed?.images)
      ? parsed.images.filter(Boolean).map((item) => String(item))
      : [parsed?.mainImage].filter(Boolean).map((item) => String(item));

    return {
      id,
      name: String(parsed?.name || 'Produit'),
      description: String(parsed?.description || ''),
      images,
      mainImage: String(parsed?.mainImage || parsed?.imageUrl || images[0] || ''),
      price: getClientPriceXOF(parsed),
      originalPrice: parsed?.originalPrice ? Number(parsed.originalPrice) : undefined,
      minOrder: Number(parsed?.minOrder) || 1,
      currency: String(parsed?.currency || 'XOF'),
      inStock: parsed?.inStock ?? true,
      stockQuantity: Number(parsed?.stockQuantity) || 0,
      unlimitedStock: parsed?.unlimitedStock === true,
      hasVariants: Boolean(parsed?.hasVariants),
      attributes: parsed?.attributes || [],
      variantColors: Array.isArray(parsed?.variantColors) ? parsed.variantColors : undefined,
      variantSizes: Array.isArray(parsed?.variantSizes) ? parsed.variantSizes : undefined,
      attributesLocalized: Array.isArray(parsed?.attributesLocalized)
        ? parsed.attributesLocalized
        : undefined,
      variants: parsed?.variants || [],
      specifications: parsed?.specifications || {},
      deliveryTime: String(parsed?.deliveryTime || 'N/A'),
      shippingCost: Number(parsed?.shippingCost) || 0,
      companyName: String(parsed?.companyName || parsed?.supplier || ''),
      supplier: String(parsed?.supplier || parsed?.companyName || 'Fournisseur'),
      rating: Number(parsed?.rating) || 0,
      reviewCount: Number(parsed?.reviewCount) || 0,
      soldCount: Number(parsed?.soldCount) || 0,
      categoryName: String(parsed?.categoryName || ''),
      status: String(parsed?.status || 'published'),
      featured: Boolean(parsed?.featured),
      trending: Boolean(parsed?.trending),
      newArrival: Boolean(parsed?.newArrival),
      specialOffer: Boolean(parsed?.specialOffer),
      categoryId: parsed?.categoryId,
      companyId: parsed?.companyId,
      isActive: parsed?.isActive ?? true,
      isVerified: Boolean(parsed?.isVerified),
      industrial: Boolean(parsed?.industrial),
      premiumSupplier: Boolean(parsed?.premiumSupplier),
      wholesalePrice: parsed?.wholesalePrice ? Number(parsed.wholesalePrice) : undefined,
      uid: parsed?.uid,
      createdBy: parsed?.createdBy,
      sellerId: parsed?.sellerId,
      vendorId: parsed?.vendorId,
      ownerId: parsed?.ownerId,
      logo: parsed?.logo,
      companyLogo: parsed?.companyLogo,
      imageUrl: parsed?.imageUrl,
      hasFreeShipping: Boolean(parsed?.hasFreeShipping),
      sourceType: parsed?.sourceType,
    };
  } catch {
    return null;
  }
}

export default function ProductDetailScreen() {
  const params = useLocalSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const initialProductData = Array.isArray(params.initialProductData)
    ? params.initialProductData[0]
    : params.initialProductData;

  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { requireAuth } = useRequireAuth();
  const { addToCart } = useCart();
  const { config: warehouseFeesConfig } = useWarehouseFees();
  const { currency } = useCurrency();
  const bootstrapProduct = useMemo(() => {
    const parsed = normalizeBootstrapProduct(initialProductData, id);
    if (parsed && parsed.isActive === false) return null;
    return parsed;
  }, [id, initialProductData]);

  // --- ÉTATS ---
  const [product, setProduct] = useState<FirebaseProduct | null>(bootstrapProduct);
  const [loading, setLoading] = useState(!bootstrapProduct);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [productSource, setProductSource] = useState<'firebase' | 'api'>(bootstrapProduct?.sourceType === 'api' ? 'api' : 'firebase');
  
  const [isQuoteVisible, setIsQuoteVisible] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  
// --- ÉTATS & LOGIQUE POUR LE CHAT RAPIDE ---
  const [isChatOpen, setIsChatOpen] = useState(false);




  
  // --- ÉTAT POUR LA COULEUR SÉLECTIONNÉE DANS LE CARROUSEL ---
  const [selectedCarouselColor, setSelectedCarouselColor] = useState<string>('');

  useEffect(() => {
    setSelectedCarouselColor('');
  }, [product?.id]);
  
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

  const formatDisplayPrice = useCallback(
    (priceInXOF: number) => {
      const converted = priceInXOF * currency.rate;
      const locale = intlLocaleForAppLanguage(i18n.language);
      if (currency.code === 'XOF') {
        return `${Math.round(converted).toLocaleString(locale)} CFA`;
      }
      return `${currency.symbol}${converted.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    },
    [currency, i18n.language],
  );

  // --- VARIABLES CALCULÉES ---
  const unitWeightKg = useMemo(() => getUnitWeightKg(product), [product]);
  const selectedVariant = useMemo(() => {
    if (!product?.variants || !selectedCarouselColor) return null;
    return product.variants.find(v => v.color === selectedCarouselColor);
  }, [product, selectedCarouselColor]);

  const effectiveUnitPrice = useMemo(() => {
    if (!product) return 0;
    const catalog = Number(product.price) || 0;
    const isZero = isZeroDollarsProduct({
      price: catalog,
      basePrice: (product as any).basePrice,
      companyName: product.companyName,
      supplier: product.supplier,
      seller: (product as any).seller,
      name: product.name,
    });
    return isZero ? 0 : catalog;
  }, [product]);

  const warehouseFeeHint = useMemo(() => {
    if (!product) return null;
    if (!isZeroFcfaCatalogPrice(effectiveUnitPrice)) return null;
    return warehouseFeeHintLabel(product.originWarehouseId, warehouseFeesConfig);
  }, [product, effectiveUnitPrice, warehouseFeesConfig]);

  const assertZeroFcfaWarehouseOrAlert = useCallback((): boolean => {
    if (!product) return false;
    if (!isZeroFcfaCatalogPrice(effectiveUnitPrice)) return true;
    const hub = findWarehouse(warehouseFeesConfig, product.originWarehouseId);
    if (!hub || !hub.active) {
      Alert.alert("Indisponible", ZERO_FCFA_UNAVAILABLE_MESSAGE);
      return false;
    }
    return true;
  }, [product, effectiveUnitPrice, warehouseFeesConfig]);

  const resolveWarehouseFields = useCallback(() => {
    const hub = findWarehouse(warehouseFeesConfig, product?.originWarehouseId);
    return {
      originWarehouseId: hub?.id ?? product?.originWarehouseId ?? null,
      originWarehouseLabel:
        hub?.label ?? product?.originWarehouseLabel ?? null,
    };
  }, [product, warehouseFeesConfig]);

  const handleShareProduct = useCallback(() => {
    const productId = String(product?.id || id || '');
    if (!productId) return;
    void shareProduct({
      productId,
      title: localizedTitle || product?.name || 'Produit A2Express',
      priceLabel: formatDisplayPrice(effectiveUnitPrice),
    });
  }, [product, id, localizedTitle, formatDisplayPrice, effectiveUnitPrice]);

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

  useEffect(() => {
    if (!bootstrapProduct) {
      return;
    }

    // Affichage rapide : ne jamais écraser attributes/variants déjà chargés depuis Firestore.
    setProduct((prev) => {
      const normalizedBootstrap = normalizeVariantAttributes(bootstrapProduct);
      if (!prev?.id || prev.id !== normalizedBootstrap.id) {
        return normalizedBootstrap;
      }
      return {
        ...normalizedBootstrap,
        ...prev,
        attributes: prev.attributes?.length ? prev.attributes : normalizedBootstrap.attributes,
        variants: prev.variants?.length ? prev.variants : normalizedBootstrap.variants,
        hasVariants: prev.hasVariants || normalizedBootstrap.hasVariants,
      };
    });
    setLoading(false);
    setError(null);
    setProductSource(bootstrapProduct.sourceType === 'api' ? 'api' : 'firebase');
  }, [bootstrapProduct]);

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
          price: getClientPriceXOF(productData),
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

// --- Attribut « couleur » + valeurs (pour i18n + carrousel) ---
const colorAttributeMeta = useMemo(
  () => findColorAttribute(product?.attributes),
  [product],
);

const availableColors = useMemo(
  () => attributeValues(colorAttributeMeta),
  [colorAttributeMeta],
);

const sizeAttributeMeta = useMemo(
  () => findSizeAttribute(product?.attributes),
  [product],
);

// --- INITIALISATION DE LA MATRICE DE COMMANDE ---
useEffect(() => {
  if (!product) return;

  const normalizedProduct = normalizeVariantAttributes(product);
  const newMatrix = buildOrderMatrix(normalizedProduct, colorAttributeMeta, sizeAttributeMeta);
  setOrderMatrix(newMatrix);

  const colors = attributeValues(colorAttributeMeta);
  if (colors.length) {
    setSelectedCarouselColor((prev) =>
      colors.some((c) => normalizeColorKey(c) === normalizeColorKey(prev)) ? prev : colors[0],
    );
  } else {
    const firstColor =
      normalizedProduct.variantColors?.[0] ||
      normalizedProduct.variants?.find((v) => v.color)?.color;
    if (firstColor) {
      setSelectedCarouselColor(String(firstColor));
    }
  }
}, [product, colorAttributeMeta, sizeAttributeMeta]);
  
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
          price: getClientPriceXOF(doc.data()),
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
      const hasBootstrap = Boolean(bootstrapProduct);

      if (!normalizedId) {
        setError("ID produit manquant");
        setLoading(false);
        return;
      }

      try {
        if (!hasBootstrap) {
          setLoading(true);
        }
        setError(null);
        
        const productRef = doc(db, 'products', normalizedId);
        const productSnap = await getDoc(productRef);
        
        if (!productSnap.exists()) {
          setProduct(null);
          setError("Ce produit n'existe pas ou n'est plus disponible.");
        } else {
          const productData = productSnap.data();

          if (productData.isActive !== true) {
            setProduct(null);
            setError("Ce produit n'existe pas ou n'est plus disponible.");
            return;
          }
          
          if (productData.name === undefined) {
            setError("Ce produit n'a pas de nom valide");
            setProduct(null);
            return;
          }
          
          const productWithId: FirebaseProduct = normalizeVariantAttributes({
            ...productData,
            id: productSnap.id,
            price: getClientPriceXOF(productData),
            minOrder: Number(productData.minOrder) || 1,
            stockQuantity: Number(productData.stockQuantity) || 0,
            unlimitedStock: productData.unlimitedStock === true,
            inStock: productData.inStock ?? (Number(productData.stockQuantity) > 0),
            hasVariants: productData.hasVariants === true,
            variantColors: Array.isArray(productData.variantColors) ? productData.variantColors : undefined,
            variantSizes: Array.isArray(productData.variantSizes) ? productData.variantSizes : undefined,
            attributes: Array.isArray(productData.attributes) ? productData.attributes : undefined,
            variants: Array.isArray(productData.variants)
              ? productData.variants.map((v: Record<string, unknown>) => ({
                  ...v,
                  price: getClientPriceXOF(v),
                }))
              : undefined,
          } as FirebaseProduct);
          
          setProduct((prev) => ({
            ...(prev || {}),
            ...productWithId,
            attributes: productWithId.attributes?.length
              ? productWithId.attributes
              : prev?.attributes,
            variants: productWithId.variants?.length
              ? productWithId.variants
              : prev?.variants,
            hasVariants: productWithId.hasVariants,
          }));
          setProductSource('firebase');
          
          /* Produits similaires après le premier rendu pour ne pas bloquer l’affichage. */
          if (productWithId.categoryId) {
            InteractionManager.runAfterInteractions(() => {
              fetchSimilarProducts(
                productWithId.categoryId,
                productWithId.companyId || '',
                productWithId.id
              );
            });
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
  }, [bootstrapProduct, id]);

  /* Précharge d’abord les visuels galerie (perçu plus rapide). */
  useEffect(() => {
    const primary = galleryImages.slice(0, 3).filter(Boolean).map((u) => String(u));
    if (!primary.length) return;
    Image.prefetch(primary, 'memory-disk').catch(() => {});
  }, [galleryImages]);

  /* Puis le reste en différé pour ne pas saturer le réseau au montage. */
  useEffect(() => {
    const rest = [
      ...galleryImages.slice(3),
      ...similarProducts.slice(0, 8).map((item) => item.mainImage || item.images?.[0] || item.imageUrl),
      company?.logo,
    ]
      .filter(Boolean)
      .map((item) => String(item));
    if (!rest.length) return;
    const t = setTimeout(() => {
      Image.prefetch(rest, 'memory-disk').catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [company?.logo, galleryImages, similarProducts]);

  // --- RÉCUPÉRATION DES DONNÉES DE L'ENTREPRISE ---
  useEffect(() => {
    if (productSource === 'api') {
      setCompany(null);
      setLoadingCompany(false);
      return;
    }

    if (!product?.companyId) {
      setCompany(null);
      setLoadingCompany(false);
      return;
    }

    let cancelled = false;
    InteractionManager.runAfterInteractions(() => {
      (async () => {
        setLoadingCompany(true);
        try {
          const companyData = await fetchCompany(product.companyId!);
          if (!cancelled) setCompany(companyData);
        } finally {
          if (!cancelled) setLoadingCompany(false);
        }
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [product?.companyId, productSource]);

  // --- CALCUL DU TOTAL DES QUANTITÉS ---
  const totalQuantity = useMemo(() => {
    return Object.values(orderMatrix).reduce((sum, item) => sum + item.quantity, 0);
  }, [orderMatrix]);

  // --- CALCUL DU POIDS TOTAL (commande) ---
  const totalOrderWeightKg = useMemo(() => {
    return (unitWeightKg * totalQuantity).toFixed(2);
  }, [unitWeightKg, totalQuantity]);

  // --- VÉRIFICATION SI LE MOQ EST ATTEINT ---
  const isMOQReached = useMemo(() => {
    return totalQuantity >= (product?.minOrder || 1);
  }, [totalQuantity, product?.minOrder]);

  // --- DÉTERMINATION DU PALIER DE PRIX (GROSSISTE OU DÉTAIL) ---
  const isWholesale = isMOQReached;

  // --- PRIX UNITAIRE EFFECTIF POUR CHAQUE LIGNE ---
  const getEffectiveUnitPrice = (item: OrderMatrixItem) => {
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
        v => v.color === item.color && v.size === item.size
      );

      if (existingVariant?.wholesalePrice) {
        return existingVariant.wholesalePrice;
      }

      return product.wholesalePrice || catalog;
    }

    return catalog;
  };

  // --- CALCUL DU PRIX TOTAL ---
  const totalPrice = useMemo(() => {
    return Object.values(orderMatrix).reduce((sum, item) => {
      return sum + getEffectiveUnitPrice(item) * item.quantity;
    }, 0);
  }, [orderMatrix, product, isWholesale]);

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

  const resolveSelectedMatrixItems = () => {
    return Object.values(orderMatrix).filter((item) => item.quantity > 0);
  };

  // --- FONCTION AJOUT AU PANIER (GROUPÉ) ---
const handleAddToCart = () => {
  if (!requireAuth({ reason: 'add_to_cart', onAuthorized: handleAddToCart })) return false;

  if (!product) {
    Alert.alert("Erreur", "Produit non chargé");
    return false;
  }

  const itemsToAdd = resolveSelectedMatrixItems();

  if (itemsToAdd.length === 0) {
    Alert.alert("Sélection requise", "Veuillez sélectionner au moins une variante.");
    return false;
  }

  if (!isMOQReached) {
    Alert.alert(
      "Quantité minimale",
      `La quantité minimale de commande est de ${product.minOrder || 1} article(s).`
    );
    return false;
  }

  if (!assertZeroFcfaWarehouseOrAlert()) return false;

  setAddingToCart(true);

  try {
    const warehouseFields = resolveWarehouseFields();
    itemsToAdd.forEach((item) => {
      const unitPrice = getEffectiveUnitPrice(item);
      const lineSpecs = getLineSpecsForCart(product, item);

      const productForCart = {
        id: product.id,
        cartId: buildCartLineId(product.id, item.size, item.color),
        name: product.name,
        price: unitPrice,
        priceXOF: unitPrice,
        quantity: item.quantity,
        selectedSize: item.size || null,
        selectedColor: item.color || null,
        size: item.size || null,
        color: item.color || null,
        image: item.image || product.mainImage || product.images?.[0] || "",
        seller: product.companyName || product.supplier || "Vendeur",
        sellerId: product.companyId || product.sellerId || null,
        minOrder: product.minOrder || 1,
        inStock: product.inStock ?? true,
        originalCurrency: product.currency || "XOF",
        hasFreeShipping: product.hasFreeShipping || false,
        ...warehouseFields,
        specifications: {
          weight: lineSpecs.weight,
          volume: lineSpecs.volume,
        },
      };

      addToCart(productForCart);
    });

    Alert.alert("Succès", "Produit ajouté au panier");
    return true;
  } catch (error) {
    console.error("Erreur ajout panier:", error);
    const msg =
      error instanceof Error && error.message
        ? error.message
        : "Impossible d'ajouter au panier";
    Alert.alert("Erreur", msg);
    return false;
  } finally {
    setAddingToCart(false);
  }
};

const handleBuyNow = async () => {
  if (!requireAuth({ reason: 'buy_now', onAuthorized: () => { void handleBuyNow(); } })) return;

  if (!product) {
    Alert.alert("Erreur", "Produit non chargé");
    return;
  }

  const itemsToOrder = resolveSelectedMatrixItems();

  if (itemsToOrder.length === 0) {
    Alert.alert("Sélection requise", "Veuillez sélectionner au moins une variante.");
    return;
  }

  if (!isMOQReached) {
    Alert.alert(
      "Quantité minimale",
      `La quantité minimale de commande est de ${product.minOrder || 1} article(s).`
    );
    return;
  }

  if (!assertZeroFcfaWarehouseOrAlert()) return;

  setAddingToCart(true);

  try {
        const warehouseFields = resolveWarehouseFields();
        const formattedItems = itemsToOrder.map((item) => {
          const unitPrice = getEffectiveUnitPrice(item);
          const lineSpecs = getLineSpecsForCart(product, item);
          const isZero = isZeroDollarsProduct({
            price: unitPrice,
            basePrice: product.basePrice as any,
            companyName: product.companyName,
            supplier: product.supplier,
            seller: (product as any).seller,
            name: product.name,
          });
          const cartId = buildCartLineId(product.id, item.size, item.color);
          const selectedSize = item.size || null;
          const selectedColor = item.color || null;
          return {
            id: cartId,
            cartId,
            productId: product.id,
            name: product.name,
            price: unitPrice,
            priceXOF: unitPrice,
            quantity: item.quantity,
            selectedSize,
            selectedColor,
            size: selectedSize,
            color: selectedColor,
            variantLines: buildPersistedVariantLines(
              selectedColor,
              selectedSize,
              item.quantity,
            ),
            image: item.image || product.mainImage || product.images?.[0] || "",
            imageUrl: item.image || product.mainImage || product.images?.[0] || "",
            seller: product.companyName || product.supplier || "Vendeur",
            sellerId: product.companyId || product.sellerId || null,
            companyName: product.companyName || product.supplier || "Vendeur",
            minOrder: product.minOrder || 1,
            hasFreeShipping: isZero ? false : (product.hasFreeShipping || false),
            ...warehouseFields,
            specifications: {
              weight: lineSpecs.weight,
              volume: lineSpecs.volume,
            },
          };
        });

    // Optionnel : mise en panier
    formattedItems.forEach(item => addToCart(item));

    const orderData = {
      items: formattedItems,
      summary: {
        subtotal: totalPrice,
        shipping: 0,
        discount: 0,
        warehouseFees: [],
        warehouseFeeTotal: 0,
        total: totalPrice
      }
    };

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

// 1. Fonction pour vérifier et ouvrir le pop-up de discussion
 // 1. Bouton "Discuter" d'origine (en bas) : Redirection DIRECTE
// 1. Bouton "Discuter" d'origine (en bas) : Redirection DIRECTE
 // 1. Bouton "Discuter" d'origine (en bas) : Redirection DIRECTE
  const handleChat = async () => {
    if (!product) {
      console.error("❌ Produit introuvable");
      return;
    }

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
        "Produit invalide : companyId/sellerUid manquant. Impossible d'ouvrir la discussion."
      );
      return;
    }

    // 🟢 CORRECTION CLEF : Generation d'un ID unique combine (Boutique + Client)
    const conversationId = `${companyDocId}_${user.uid}`;

    const mainImage =
      product.images?.[0] ||
      product.mainImage ||
      product.imageUrl ||
      "";

    const chatPriceValue = isZeroDollarsProduct({
      price: product.price,
      basePrice: (product as any).basePrice,
      companyName: product.companyName,
      supplier: product.supplier,
      seller: (product as any).seller,
      name: product.name,
    })
      ? 0
      : product.price;

    const formattedPrice = `${chatPriceValue?.toLocaleString()} ${product.currency || "FCFA"}`;

    // 💡 CORRECTION DU NOM ET DU LOGO DE LA BOUTIQUE TRANSMIS AU CHAT
    const resolvedSellerName =
      product.companyName ||
      product.storeName ||
      product.shopName ||
      product.supplier ||
      product.name ||
      (product as any).seller?.name ||
      "Vendeur A2Express";

    const resolvedSellerLogo =
      product.companyLogo ||
      product.logo ||
      product.storeLogo ||
      (product as any).seller?.logo ||
      "";

    // Redirection directe vers la page de conversation avec les bonnes infos
    router.push({
      pathname: "/conversation/[id]",
      params: {
        id: conversationId, // 🟢 Transmet l'ID unique (ex: "usinea2express_client123")
        sellerId: String(sellerUid),
        companyId: companyDocId,
        productId: product.id,
        productContext: "1",
        productName: localizedTitle,
        productImage: mainImage,
        productPrice: formattedPrice,
        sellerName: resolvedSellerName,
        companyName: resolvedSellerName,
        sellerLogo: resolvedSellerLogo,
      },
    });
  };

  // 2. Ouverture du pop-up de discussion rapide (via la bulle flottante)
  const handleOpenQuickChat = () => {
    if (!user?.uid) {
      requireAuth({
        reason: 'contact_seller',
        onAuthorized: handleOpenQuickChat,
      });
      return;
    }
    setIsChatOpen(true);
  };

// 3. Envoi du message rédigé dans le pop-up
  const handleSendMessage = (messageText: string) => {
    if (!product) return;

    if (!user?.uid) {
      requireAuth({
        reason: 'contact_seller',
        onAuthorized: () => handleSendMessage(messageText),
      });
      return;
    }

    const sellerUid = product.sellerUid;
    const companyDocId = product.companyId;

    if (!companyDocId) {
      console.error("Produit invalide : companyId manquant.", product);
      return;
    }

    // 🟢 CORRECTION CLEF : Identifiant unique par client ET par boutique
    const conversationId = `${companyDocId}_${user.uid}`;

    const mainImage =
      product.images?.[0] ||
      product.mainImage ||
      product.imageUrl ||
      "";

    const chatPriceValue = isZeroDollarsProduct({
      price: product.price,
      basePrice: (product as any).basePrice,
      companyName: product.companyName,
      supplier: product.supplier,
      seller: (product as any).seller,
      name: product.name,
    })
      ? 0
      : product.price;

    const formattedPrice = `${chatPriceValue?.toLocaleString()} ${product.currency || "FCFA"}`;

    const resolvedSellerName =
      product.companyName ||
      product.storeName ||
      product.shopName ||
      product.supplier ||
      product.name ||
      (product as any).seller?.name ||
      "Vendeur A2Express";

    const resolvedSellerLogo =
      product.companyLogo ||
      product.logo ||
      product.storeLogo ||
      (product as any).seller?.logo ||
      "";

    router.push({
      pathname: "/conversation/[id]",
      params: {
        id: conversationId, // 🟢 Transmet désormais l'ID unique (ex: "usinea2express_client123")
        sellerId: sellerUid ? String(sellerUid) : companyDocId,
        companyId: companyDocId,
        productId: product.id,
        productContext: "1",
        productName: localizedTitle,
        productImage: mainImage,
        productPrice: formattedPrice,
        sellerName: resolvedSellerName,
        companyName: resolvedSellerName,
        sellerLogo: resolvedSellerLogo,
        message: messageText,
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

    const productRecord = product as unknown as Record<string, unknown>;
    const colorAttrForLocale = {
      id: colorAttributeMeta?.id,
      name: colorAttributeMeta?.name || 'Couleur',
    };

    return (
      <View style={styles.colorCarouselContainer}>
        <Text style={styles.colorCarouselTitle}>{t('productDetail.colorsAvailable')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.colorChipScrollContent}
        >
          {availableColors.map((color) => {
            const isSelected =
              normalizeColorKey(selectedCarouselColor) === normalizeColorKey(color);
            const localizedColor = getLocalizedVariantValue(
              color,
              colorAttrForLocale,
              productRecord,
              i18n.language,
            );

            return (
              <TouchableOpacity
                key={color}
                style={[styles.colorChip, isSelected && styles.colorChipSelected]}
                onPress={() => setSelectedCarouselColor(color)}
                activeOpacity={0.85}
              >
                <View style={[styles.colorChipDot, isSelected && styles.colorChipDotSelected]} />
                <View style={styles.colorChipTextWrap}>
                  <Text
                    style={[styles.colorChipLabel, isSelected && styles.colorChipLabelSelected]}
                    numberOfLines={1}
                  >
                    {localizedColor}
                  </Text>
                  <Text style={styles.colorChipStock}>
                    {t('productCard.inStock')}
                  </Text>
                </View>
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
    const productRecord = product as unknown as Record<string, unknown>;
    const sizeAttrForLocale = {
      id: sizeAttributeMeta?.id,
      name: sizeAttributeMeta?.name || 'Taille',
    };
    const sizeLabel = item.size?.trim()
      ? getLocalizedVariantValue(item.size, sizeAttrForLocale, productRecord, i18n.language)
      : t('productDetail.sizeStandard');
    
    return (
      <View style={styles.sizeRow}>
        <View style={styles.sizeInfo}>
          <Text style={styles.sizeName}>{sizeLabel}</Text>
          {item.extraLabel ? (
            <Text style={styles.sizeExtraLabel} numberOfLines={1}>
              {item.extraLabel}
            </Text>
          ) : null}
          <View style={styles.sizePriceStock}>
            <Text style={styles.sizePrice}>{formatDisplayPrice(unitPrice)}</Text>
            <View style={[styles.stockBadge, styles.stockBadgeOk]}>
              <Text style={[styles.stockBadgeText, styles.stockBadgeTextOk]}>
                {t('productCard.inStock')}
              </Text>
            </View>
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
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
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
            <Text style={styles.similarProductPrice}>
              {formatDisplayPrice(product.price)}
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
  if (loading && !product) {
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

{/* SECTION PRINCIPALE — titre unique, hiérarchie B2B */}
        <View style={styles.mainInfo}>
          
          {/* 1. Badges : contexte pro puis promos */}
          <View style={styles.badgesContainer}>
            <View style={styles.b2bBadge}>
              <Ionicons name="briefcase-outline" size={12} color="#C2410C" />
              <Text style={styles.b2bBadgeText}>Produit B2B</Text>
            </View>
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
            {isZeroDollarsShop({
              companyName: product.companyName,
              supplier: product.supplier,
            }) && <ZeroDollarsFreeBadge />}
          </View>

          <View style={styles.titleRow}>
            <Text style={styles.productName} numberOfLines={3}>
              {localizedTitle}
            </Text>
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
          {warehouseFeeHint ? (
            <Text style={styles.warehouseFeeHint}>{warehouseFeeHint}</Text>
          ) : null}

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
          {localizedDescription ? (
            <Text style={styles.description}>{localizedDescription}</Text>
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
                      <Image
                        source={{ uri: company.logo }}
                        style={styles.companyLogo}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={120}
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

        {filteredMatrixEntries.length > 0 && (
          <View style={styles.matrixSection}>
            <View style={styles.matrixHeader}>
              <Text style={styles.matrixTitle}>
                {selectedCarouselColor && availableColors.length > 0
                  ? `${t('productDetail.sizesForColor', {
                      color: getLocalizedVariantValue(
                        selectedCarouselColor,
                        {
                          id: colorAttributeMeta?.id,
                          name: colorAttributeMeta?.name || 'Couleur',
                        },
                        product as unknown as Record<string, unknown>,
                        i18n.language,
                      ),
                      defaultValue: `Tailles — ${selectedCarouselColor}`,
                    })}`
                  : t('productDetail.sizesAvailable', { defaultValue: 'Tailles disponibles' })}
              </Text>
              {totalQuantity > 0 && (
                <Text style={styles.matrixSubtitle}>{totalQuantity} sélectionné(s)</Text>
              )}
            </View>
            <View style={styles.sizesList}>
              {filteredMatrixEntries.map(([matrixKey, item]) => (
                <SizeRow key={matrixKey} item={item} matrixKey={matrixKey} />
              ))}
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
          
          {/* Poids (specifications ou variante) */}
          {unitWeightKg > 0 && (
            <View style={styles.infoRow}>
              <Ionicons name="scale-outline" size={18} color="#666" />
              <Text style={styles.infoLabel}>Poids unitaire :</Text>
              <Text style={styles.infoValue}>
                {unitWeightKg.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} kg
              </Text>
            </View>
          )}
          {unitWeightKg > 0 && totalQuantity > 0 && (
            <View style={styles.infoRow}>
              <Ionicons name="layers-outline" size={18} color="#666" />
              <Text style={styles.infoLabel}>Poids total (commande) :</Text>
              <Text style={styles.infoValue}>{totalOrderWeightKg} kg</Text>
            </View>
          )}
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
        chatDisabled={!isValidProductForConversation}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        addingToCart={addingToCart}
        disabled={totalQuantity === 0 || !isMOQReached}
        disabledReason={
          totalQuantity === 0
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

      {/* ➕ MODAL DE DISCUSSION RAPIDE */}
      <QuickChatModal
        visible={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        productTitle={localizedTitle || product?.name}
        vendorName={product?.companyName || product?.supplier || "Gérant de la boutique"}
        onSendMessage={handleSendMessage}
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
  warehouseFeeHint: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
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
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
    backgroundColor: COLORS.white, 
    marginHorizontal: 4,
    marginTop: 4,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
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
    fontSize: 21, 
    color: '#0F172A', 
    lineHeight: 28, 
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
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
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  b2bBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  b2bBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9A3412',
    letterSpacing: 0.2,
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
  // Styles pour le sélecteur de couleurs
  colorCarouselContainer: {
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  colorCarouselTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  colorChipScrollContent: {
    paddingRight: 8,
    gap: 8,
  },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F8',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: '#E8E8ED',
    maxWidth: 180,
  },
  colorChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#FFF4EC',
  },
  colorChipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#CBD5E0',
    marginRight: 8,
  },
  colorChipDotSelected: {
    backgroundColor: COLORS.primary,
  },
  colorChipTextWrap: {
    flexShrink: 1,
  },
  colorChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A5568',
  },
  colorChipLabelSelected: {
    color: COLORS.primary,
  },
  colorChipStock: {
    fontSize: 10,
    color: '#718096',
    marginTop: 1,
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
    marginBottom: 2,
  },
  sizeExtraLabel: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 4,
  },
  sizePriceStock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  sizePrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  stockBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stockBadgeOk: {
    backgroundColor: '#E6F7ED',
  },
  stockBadgeLow: {
    backgroundColor: '#FFF4E5',
  },
  stockBadgeOut: {
    backgroundColor: '#FEECEC',
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  stockBadgeTextOk: {
    color: COLORS.success,
  },
  stockBadgeTextLow: {
    color: COLORS.warning,
  },
  stockBadgeTextOut: {
    color: COLORS.error,
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
