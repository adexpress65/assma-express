import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Alert,
  FlatList,
  TextInput,
  Linking,
  Modal,
  RefreshControl,
  ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../src/config/firebase';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  setDoc,
  arrayUnion,
  arrayRemove,
  Timestamp,
  where,
  onSnapshot,
  startAfter,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { useAuth } from '../../src/contexts/AuthContext';

const { width } = Dimensions.get('window');

// Types
interface Company {
  id: string;
  name: string;
  description: string;
  logo: string;
  coverImage: string;
  type: string;
  location?: { city?: string; country?: string } | string;
  yearsOnPlatform: number;
  responseRate: number;
  responseTime: string;
  deliveryRate: number;
  totalProducts: number;
  totalOrders: number;
  rating: number;
  mainProducts: string[];
  certifications: string[];
  businessType: string;
  employees: string;
  annualRevenue: string;
  verified: boolean;
  goldSupplier: boolean;
  tradeAssurance: boolean;
  phone?: string;
  email?: string;
  whatsapp?: string;
  website?: string;
  stats?: {
    productCount?: number;
  };
}

interface Product {
  id: string;
  name: string;
  imageUrl?: string;
  mainImage?: string;
  images?: string[];
  price: number;
  rating: number;
  orders: number;
  moq?: number;
  companyId?: string;
  sellerId?: string;
  supplier?: string;
}

interface Review {
  id: string;
  userName?: string;
  rating: number;
  comment: string;
  createdAt: Date | Timestamp;
}

interface QuoteFormData {
  product: string;
  quantity: string;
  deliveryDate: string;
}

type TabType = 'products' | 'about' | 'reviews';

// Constants
const PAGE_SIZE = 10000;
const FALLBACK_LOGO = 'https://via.placeholder.com/100x100?text=Logo';
const FALLBACK_COVER = 'https://via.placeholder.com/800x200?text=Cover';
const FALLBACK_PRODUCT_IMAGE = 'https://via.placeholder.com/300x300?text=Produit';

// Utility functions
const normalizeCompanyData = (id: string, data: DocumentData): Company => ({
  id,
  name: data.name || data.companyName || data.supplierName || 'Entreprise non spécifiée',
  description: data.description || data.about || 'Aucune description disponible.',
  logo: data.logo || data.imageUrl || FALLBACK_LOGO,
  coverImage: data.coverImage || data.bannerImage || FALLBACK_COVER,
  type: data.type || data.businessType || 'Non spécifié',
  location: data.location || data.address || 'Localisation inconnue',
  yearsOnPlatform: typeof data.yearsOnPlatform === 'number' ? data.yearsOnPlatform : 0,
  responseRate: typeof data.responseRate === 'number' ? data.responseRate : 0,
  responseTime: data.responseTime || 'Non spécifié',
  deliveryRate: typeof data.deliveryRate === 'number' ? data.deliveryRate : 0,
  totalProducts: data.stats?.productCount || (typeof data.totalProducts === 'number' ? data.totalProducts : 0),
  totalOrders: typeof data.totalOrders === 'number' ? data.totalOrders : 0,
  rating: typeof data.rating === 'number' ? data.rating : 0,
  mainProducts: Array.isArray(data.mainProducts) 
    ? data.mainProducts 
    : (typeof data.mainProducts === 'string' ? data.mainProducts.split(',').map(s => s.trim()) : ['Produits divers']),
  certifications: Array.isArray(data.certifications) ? data.certifications : ['En attente'],
  businessType: data.businessType || data.type || 'Non spécifié',
  employees: data.employees || 'Non spécifié',
  annualRevenue: data.annualRevenue || 'Non spécifié',
  verified: Boolean(data.verified || data.isActive),
  goldSupplier: Boolean(data.goldSupplier ?? true),
  tradeAssurance: Boolean(data.tradeAssurance ?? true),
  phone: data.phone || '',
  email: data.email || '',
  whatsapp: data.whatsapp || '',
  website: data.website || '',
  stats: data.stats || { productCount: 0 }
});

const normalizeProductData = (id: string, data: DocumentData): Product => ({
  id,
  name: data.name || 'Produit sans nom',
  imageUrl: data.imageUrl || data.mainImage || (data.images?.[0]) || FALLBACK_PRODUCT_IMAGE,
  mainImage: data.mainImage || data.imageUrl || (data.images?.[0]),
  images: Array.isArray(data.images) ? data.images : [],
  price: typeof data.price === 'number' ? data.price : 0,
  rating: typeof data.rating === 'number' ? data.rating : 0,
  orders: typeof data.orders === 'number' ? data.orders : 0,
  moq: typeof data.moq === 'number' ? data.moq : undefined,
  companyId: data.companyId || data.sellerId || '',
  sellerId: data.sellerId || data.companyId || '',
  supplier: data.supplier || ''
});

const normalizeReviewData = (id: string, data: DocumentData): Review => ({
  id,
  userName: data.userName || 'Anonyme',
  rating: typeof data.rating === 'number' ? data.rating : 0,
  comment: data.comment || '',
  createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date()
});

const getLocationText = (location: Company['location']): string => {
  if (!location) return 'Localisation inconnue';
  if (typeof location === 'string') return location;
  return [location.city, location.country].filter(Boolean).join(', ') || 'Localisation inconnue';
};

// Sub-components
interface BadgeProps {
  icon: string;
  text: string;
  color: string;
}

const Badge: React.FC<BadgeProps> = ({ icon, text, color }) => (
  <View style={[styles.badge, { borderColor: color }]}>
    <Text style={{ color, fontSize: 12, fontWeight: '600' }}>
      {icon} {text}
    </Text>
  </View>
);

interface ContactButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  onPress: () => void;
  color: string;
  backgroundColor?: string;
}

const ContactButton: React.FC<ContactButtonProps> = ({
  icon,
  text,
  onPress,
  color,
  backgroundColor = '#f5f5f5'
}) => (
  <TouchableOpacity
    style={[styles.contactButton, { backgroundColor }]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons name={icon} size={18} color={color} />
    <Text style={[styles.contactButtonText, { color }]} numberOfLines={1}>
      {text}
    </Text>
  </TouchableOpacity>
);

interface QuoteModalProps {
  visible: boolean;
  companyName: string;
  onClose: () => void;
  onSubmit: (data: QuoteFormData) => Promise<void>;
}

const QuoteModal: React.FC<QuoteModalProps> = ({
  visible,
  companyName,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState<QuoteFormData>({
    product: '',
    quantity: '',
    deliveryDate: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const { product, quantity, deliveryDate } = formData;
    
    if (!product.trim() || !quantity.trim() || !deliveryDate.trim()) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
      setFormData({ product: '', quantity: '', deliveryDate: '' });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'envoyer la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>
            Demander un devis à {companyName}
          </Text>

          <TextInput
            style={styles.modalInput}
            placeholder="Produit ou service"
            value={formData.product}
            onChangeText={(text) => setFormData(prev => ({ ...prev, product: text }))}
            editable={!submitting}
          />

          <TextInput
            style={styles.modalInput}
            placeholder="Quantité"
            value={formData.quantity}
            onChangeText={(text) => setFormData(prev => ({ ...prev, quantity: text }))}
            keyboardType="numeric"
            editable={!submitting}
          />

          <TextInput
            style={styles.modalInput}
            placeholder="Date de livraison souhaitée"
            value={formData.deliveryDate}
            onChangeText={(text) => setFormData(prev => ({ ...prev, deliveryDate: text }))}
            editable={!submitting}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalSend, submitting && styles.modalSendDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSendText}>Envoyer la demande</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface ProductCardProps {
  product: Product;
  onPress: (id: string) => void;
}

const ProductCard: React.FC<ProductCardProps> = React.memo(({ product, onPress }) => {
  const moqDisplay = useMemo(() => {
    if (product.moq === undefined || product.moq === null) return 'MOQ: Contactez-nous';
    return `MOQ: ${product.moq} unités`;
  }, [product.moq]);

  return (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => onPress(product.id)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: product.imageUrl || FALLBACK_PRODUCT_IMAGE }}
        style={styles.productImage}
        resizeMode="cover"
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.productPrice}>
          {product.price.toLocaleString()} F CFA
        </Text>
        <Text style={styles.productMoq}>
          {moqDisplay}
        </Text>
        {product.rating > 0 && (
          <View style={styles.productRating}>
            <Text style={styles.ratingStars}>⭐ {product.rating.toFixed(1)}</Text>
            <Text style={styles.orders}>({product.orders} commandes)</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

ProductCard.displayName = 'ProductCard';

// Main Component
export default function CompanyProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  
  // Pagination state
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationError, setPaginationError] = useState<string | null>(null);

  // Sécurité isMounted
  const isMounted = useRef(true);

  // Cleanup isMounted
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Charge les infos de l'entreprise et les produits
   */
  const loadCompanyData = useCallback(async (refresh = false) => {
    if (!id || !isMounted.current) {
      console.log('❌ loadCompanyData: ID manquant ou composant démonté');
      return;
    }

    // Évite les appels concurrents
    if (!refresh && loadingMore) {
      console.log('⏳ loadCompanyData: Déjà en chargement');
      return;
    }
    
    if (refresh && refreshing) {
      console.log('⏳ loadCompanyData: Déjà en rafraîchissement');
      return;
    }

    // Pour le premier chargement, on ne veut pas loadingMore=true
    const isFirstLoad = products.length === 0 && !refresh && !lastDoc;
    
    console.log(`🚀 loadCompanyData: refresh=${refresh}, firstLoad=${isFirstLoad}, products.length=${products.length}`);

    try {
      if (refresh) {
        setRefreshing(true);
        setLastDoc(null);
        setHasMore(true);
        setProducts([]); // Vide la liste pour le refresh
      } else if (!isFirstLoad) {
        setLoadingMore(true);
      }

      // Charger l'entreprise seulement si nécessaire
      if (refresh || !company) {
        const companyRef = doc(db, 'companies', id);
        const companySnap = await getDoc(companyRef);

        if (!isMounted.current) return;

        if (!companySnap.exists()) {
          Alert.alert('Introuvable', 'Cette entreprise n\'existe pas.');
          setLoading(false);
          setRefreshing(false);
          return;
        }

        const normalizedCompany = normalizeCompanyData(companySnap.id, companySnap.data());
        setCompany(normalizedCompany);
      }

      // Définir le point de départ
      const currentLastDoc = refresh ? null : lastDoc;

      // Construire la requête
      const productsQuery = query(
        collection(db, 'products'),
        where('companyId', '==', id),
        orderBy('createdAt', 'desc'),
        ...(currentLastDoc ? [startAfter(currentLastDoc)] : []),
        limit(PAGE_SIZE)
      );
	  

      const productsSnap = await getDocs(productsQuery);

      if (!isMounted.current) return;

      if (!productsSnap.empty) {
        const newProducts = productsSnap.docs.map(doc => 
          normalizeProductData(doc.id, doc.data())
        );

        // Fusion des données
        setProducts(prev => refresh ? newProducts : [...prev, ...newProducts]);
        
        // Mise à jour du curseur
        const lastVisible = productsSnap.docs[productsSnap.docs.length - 1];
        setLastDoc(lastVisible);
        
        // Vérification s'il reste une suite
        setHasMore(productsSnap.size === PAGE_SIZE);
        
        console.log(`✅ Chargé ${productsSnap.size} produits, total: ${refresh ? newProducts.length : products.length + newProducts.length}, hasMore: ${productsSnap.size === PAGE_SIZE}`);
      } else {
        if (refresh) setProducts([]);
        setHasMore(false);
        setLastDoc(null);
        console.log('📭 Aucun produit trouvé');
      }

      setPaginationError(null);
    } catch (error) {
      console.error('❌ Erreur loadCompanyData:', error);
      if (isMounted.current) {
        setPaginationError('Erreur de chargement');
        Alert.alert('Erreur', 'Impossible de charger les données.');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    }
  }, [id, company, lastDoc, loadingMore, refreshing, products.length]);

  const loadReviews = useCallback(async () => {
    if (!id || !isMounted.current) return;
    
    try {
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('targetId', '==', id),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const reviewsSnap = await getDocs(reviewsQuery);
      
      if (isMounted.current) {
        setReviews(reviewsSnap.docs.map(doc => normalizeReviewData(doc.id, doc.data())));
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  }, [id]);

  // Présence en ligne
  useEffect(() => {
    if (!id) return;
    const presenceRef = doc(db, 'presence', id);
    const unsubscribe = onSnapshot(presenceRef, (snap) => {
      if (isMounted.current) {
        setIsOnline(snap.exists() && snap.data()?.status === 'online');
      }
    });
    return () => unsubscribe();
  }, [id]);

  const checkFavorite = useCallback(async () => {
    if (!user || !id || !isMounted.current) return;
    try {
      const favRef = doc(db, 'users', user.uid, 'favorites', 'companies');
      const favSnap = await getDoc(favRef);
      if (isMounted.current) {
        setIsFavorite(favSnap.exists() && (favSnap.data()?.ids || []).includes(id));
      }
    } catch (error) {
      console.error('Error checking favorite:', error);
    }
  }, [user, id]);

  const toggleFavorite = useCallback(async () => {
    if (!user || !id || !company) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour ajouter aux favoris.');
      return;
    }
    try {
      const favRef = doc(db, 'users', user.uid, 'favorites', 'companies');
      if (isFavorite) {
        await setDoc(favRef, { ids: arrayRemove(id) }, { merge: true });
        if (isMounted.current) setIsFavorite(false);
      } else {
        await setDoc(favRef, { ids: arrayUnion(id) }, { merge: true });
        if (isMounted.current) setIsFavorite(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }, [user, id, company, isFavorite]);

  const sendQuoteRequest = useCallback(async (data: QuoteFormData) => {
    if (!user || !company) return;
    const quoteRef = doc(collection(db, 'quotes'));
    await setDoc(quoteRef, {
      userId: user.uid,
      userEmail: user.email,
      companyId: company.id,
      companyName: company.name,
      product: data.product,
      quantity: parseInt(data.quantity, 10) || 0,
      deliveryDate: data.deliveryDate,
      createdAt: Timestamp.now(),
      status: 'pending'
    });
    if (isMounted.current) {
      setShowQuoteModal(false);
      Alert.alert('Devis envoyé', 'Le vendeur vous répondra sous 24h.');
    }
  }, [user, company]);

  const handleProductPress = useCallback((productId: string) => {
    if (!productId) return;
    router.push({ pathname: '/product/[id]', params: { id: productId } });
  }, [router]);

  /**
   * GESTIONNAIRE DE PAGINATION
   */
  const handleLoadMore = useCallback(() => {
    // Ne charger que si toutes les conditions sont remplies
    if (
      activeTab === 'products' &&
      hasMore &&
      !loadingMore &&
      !refreshing &&
      lastDoc && // Important : on a déjà un curseur
      products.length > 0
    ) {
      console.log('📦 Pagination avec lastDoc:', lastDoc.id);
      loadCompanyData(false);
    } else {
      console.log('⏸️ Pagination ignorée:', { 
        activeTab, 
        hasMore, 
        loadingMore, 
        refreshing, 
        hasLastDoc: !!lastDoc,
        productCount: products.length 
      });
    }
  }, [activeTab, hasMore, loadingMore, refreshing, lastDoc, products.length, loadCompanyData]);

  /**
   * Rafraîchissement complet
   */
  const handleRefresh = useCallback(() => {
    console.log('🔄 Rafraîchissement complet');
    Promise.all([
      loadCompanyData(true),
      loadReviews(),
      checkFavorite()
    ]).finally(() => {
      if (isMounted.current) {
        setRefreshing(false);
      }
    });
  }, [loadCompanyData, loadReviews, checkFavorite]);

  // Effet d'initialisation - UN SEUL APPEL
  useEffect(() => {
    if (id) {
      console.log('🔄 INITIALISATION - Premier chargement avec ID:', id);
      loadCompanyData(false); // false = pas de refresh, chargement initial
      loadReviews();
      checkFavorite();
    }
  }, [id]);

  const locationText = useMemo(() => company ? getLocationText(company.location) : '', [company]);

  /**
   * CALCUL DES STATS
   */
  const stats = useMemo(() => {
    const firebaseCount = company?.stats?.productCount || company?.totalProducts || 0;
    const realCount = products.length;
    
    const displayCount = Math.max(firebaseCount, realCount);

    return [
      { 
        label: 'Produits', 
        value: displayCount
      },
      { label: 'Commandes', value: company?.totalOrders || 0 },
      { label: 'Note', value: company?.rating ? `${company.rating}/5` : '0/5' }
    ];
  }, [company, products.length]);

  const renderHeader = useCallback(() => (
    <>
      <View style={styles.header}>
        <Image source={{ uri: company?.coverImage || FALLBACK_COVER }} style={styles.coverImage} resizeMode="cover" />
        <View style={styles.logoContainer}>
          <Image source={{ uri: company?.logo || FALLBACK_LOGO }} style={styles.logo} resizeMode="contain" />
        </View>
      </View>
      <View style={styles.mainInfo}>
        <View style={styles.titleRow}>
          <Text style={styles.companyName}>{company?.name}</Text>
          {company?.verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#FF6B00" />
            </View>
          )}
        </View>
        <Text style={styles.companyType}>{company?.type}</Text>
        <Text style={styles.companyLocation}>📍 {locationText}</Text>
        <View style={styles.statsRow}>
          {stats.map((stat, index) => (
            <React.Fragment key={stat.label}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
              {index < stats.length - 1 && <View style={styles.statDivider} />}
            </React.Fragment>
          ))}
        </View>
        <View style={styles.badgesRow}>
          {company?.goldSupplier && <Badge icon="🥇" text="Fournisseur Or" color="#FFD700" />}
          {company?.tradeAssurance && <Badge icon="✅" text="Assurance" color="#4CAF50" />}
          {isOnline && <Badge icon="🟢" text="En ligne" color="#4CAF50" />}
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionButton, isFavorite && styles.actionButtonActive]} onPress={toggleFavorite}>
            <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={20} color={isFavorite ? '#FF6B00' : '#666'} />
            <Text style={[styles.actionButtonText, isFavorite && styles.actionButtonTextActive]}>{isFavorite ? 'Favori' : 'Favoris'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowQuoteModal(true)}>
            <Ionicons name="document-text-outline" size={20} color="#666" />
            <Text style={styles.actionButtonText}>Devis</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => {}}>
            <Ionicons name="share-outline" size={20} color="#666" />
            <Text style={styles.actionButtonText}>Partager</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.contactRow}>
          {company?.phone && <ContactButton icon="call" text="Appeler" onPress={() => Linking.openURL(`tel:${company.phone}`)} color="#4CAF50" />}
          {company?.email && <ContactButton icon="mail" text="Email" onPress={() => Linking.openURL(`mailto:${company.email}`)} color="#2196F3" />}
          {company?.whatsapp && <ContactButton icon="logo-whatsapp" text="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${company.whatsapp}`)} color="#25D366" backgroundColor="#e8f5e9" />}
        </View>
      </View>
      <View style={styles.tabContainer}>
        {(['products', 'about', 'reviews'] as TabType[]).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'products' && `Produits (${products.length})`}
              {tab === 'about' && 'À propos'}
              {tab === 'reviews' && `Avis (${reviews.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  ), [company, locationText, stats, isOnline, isFavorite, activeTab, products.length, reviews.length, toggleFavorite]);
  
  const handleContactPress = useCallback(() => {
    if (!user) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour envoyer un message.');
      return;
    }

    router.push({
      pathname: '/conversation/[id]',
      params: { 
        id: id, 
        name: company?.name 
      }
    });
  }, [user, company, id, router]);

  const renderReview = useCallback(({ item }: { item: Review }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewAuthor}>{item.userName}</Text>
        <View style={styles.ratingBadge}>
          <Text style={styles.reviewRating}>⭐ {item.rating}/5</Text>
        </View>
      </View>
      
      <Text style={styles.reviewComment}>{item.comment}</Text>
      
      <Text style={styles.reviewDate}>
        {item.createdAt instanceof Date 
          ? item.createdAt.toLocaleDateString('fr-FR') 
          : 'Date non disponible'}
      </Text>
    </View>
  ), []);

const renderAbout = useCallback(() => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>À propos</Text>
    <Text style={styles.description}>{company?.description || 'Aucune description disponible.'}</Text>
    
    {/* 1. Informations professionnelles */}
    <View style={styles.businessDetailsContainer}>
      <Text style={styles.subsectionTitle}>Détails de l'entreprise</Text>
      
      <View style={styles.detailItem}>
        <Ionicons name="people-outline" size={20} color="#666" />
        <View style={styles.detailTextContainer}>
          <Text style={styles.detailLabel}>Nombre d'employés</Text>
          <Text style={styles.detailValue}>{company?.employees || 'Non spécifié'}</Text>
        </View>
      </View>

      <View style={styles.detailItem}>
        <Ionicons name="stats-chart-outline" size={20} color="#666" />
        <View style={styles.detailTextContainer}>
          <Text style={styles.detailLabel}>Chiffre d'affaires</Text>
          <Text style={styles.detailValue}>{company?.annualRevenue || 'Non spécifié'}</Text>
        </View>
      </View>

      <View style={styles.detailItem}>
        <Ionicons name="business-outline" size={20} color="#666" />
        <View style={styles.detailTextContainer}>
          <Text style={styles.detailLabel}>Secteur d'activité</Text>
          <Text style={styles.detailValue}>{company?.businessType || 'Non spécifié'}</Text>
        </View>
      </View>
    </View>

    {/* 2. Certifications (NOUVEAU) */}
    {Array.isArray(company?.certifications) && company.certifications.length > 0 && (
      <View style={styles.certSection}>
        <Text style={styles.subsectionTitle}>Certifications & Qualité</Text>
        <View style={styles.certList}>
          {company.certifications.map((cert, i) => (
            <View key={`cert-${i}`} style={styles.certItem}>
              <Ionicons name="ribbon-outline" size={18} color="#FF6B00" />
              <Text style={styles.certText}>{cert}</Text>
            </View>
          ))}
        </View>
      </View>
    )}

    {/* 3. Produits principaux */}
    {Array.isArray(company?.mainProducts) && company.mainProducts.length > 0 && (
      <View style={{ marginTop: 20 }}>
        <Text style={styles.subsectionTitle}>Produits principaux</Text>
        <View style={styles.tagContainer}>
          {company.mainProducts.map((p, i) => (
            <View key={`main-${i}`} style={styles.tag}>
              <Text style={styles.tagText}>{p}</Text>
            </View>
          ))}
        </View>
      </View>
    )}
  </View>
), [company]);

  const renderFooter = useCallback(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#FF6B00" />
          <Text style={styles.footerText}>Chargement de plus de produits...</Text>
        </View>
      );
    }
    
    if (paginationError) {
      return (
        <View style={styles.footerError}>
          <Text style={styles.errorText}>{paginationError}</Text>
          <TouchableOpacity onPress={() => loadCompanyData(false)}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    if (!hasMore && products.length > 0) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.endText}>Fin de la liste - {products.length} produits au total</Text>
        </View>
      );
    }
    
    return null;
  }, [loadingMore, paginationError, hasMore, products.length, loadCompanyData]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="cube-outline" size={48} color="#ccc" />
      <Text style={styles.emptyText}>
        {activeTab === 'products' ? 'Aucun produit disponible' : 'Aucun avis disponible'}
      </Text>
    </View>
  ), [activeTab]);

  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <ProductCard product={item} onPress={handleProductPress} />
  ), [handleProductPress]);

  const getItemKey = useCallback((item: Product | Review, index: number) => {
    if (activeTab === 'products' && 'price' in item) {
      return `product-${item.id}-${index}`;
    }
    return `review-${item.id}-${index}`;
  }, [activeTab]);

  if (loading && !company) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Chargement du profil...</Text>
      </View>
    );
  }

  if (!company) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ff6b6b" />
        <Text style={styles.errorText}>Entreprise introuvable</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadCompanyData(true)}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      {activeTab !== 'about' ? (
        <FlatList
          key={activeTab === 'products' ? 'PRODUCTS_2_COLUMNS' : 'REVIEWS_1_COLUMN'}
          data={activeTab === 'products' ? products : reviews}
          keyExtractor={getItemKey}
          renderItem={activeTab === 'products' ? renderProduct : renderReview}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          numColumns={activeTab === 'products' ? 2 : 1}
          columnWrapperStyle={activeTab === 'products' ? styles.productRow : undefined}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh} 
              colors={['#FF6B00']} 
              tintColor="#FF6B00"
            />
          }
          removeClippedSubviews={true}
          initialNumToRender={6}
          maxToRenderPerBatch={10}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          disableVirtualization={false}
          bounces={true}
        />
      ) : (
<ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]} // Le paddingBottom évite que le bouton chat cache le texte
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh} 
              colors={['#FF6B00']} 
              tintColor="#FF6B00"
            />
          }
        >
          {renderHeader()}
          <View style={styles.aboutContainer}>
            {renderAbout()}
          </View>
        </ScrollView>
      )}
	  
      <TouchableOpacity 
        style={styles.floatingChatButton} 
        onPress={handleContactPress}
        activeOpacity={0.8}
      >
        <Ionicons name="chatbubble-ellipses" size={30} color="#fff" />
      </TouchableOpacity>

      <QuoteModal 
        visible={showQuoteModal} 
        companyName={company.name} 
        onClose={() => setShowQuoteModal(false)} 
        onSubmit={sendQuoteRequest} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { height: 200, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  logoContainer: {
    position: 'absolute',
    bottom: -40,
    left: 20,
    width: 80,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  logo: { width: '100%', height: '100%', borderRadius: 5 },
  mainInfo: { marginTop: 50, paddingHorizontal: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  companyName: { fontSize: 24, fontWeight: 'bold', color: '#333', marginRight: 8 },
  verifiedBadge: { marginTop: 2 },
  companyType: { fontSize: 16, color: '#666', marginBottom: 5 },
  companyLocation: { fontSize: 14, color: '#888', marginBottom: 15 },
  statsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#eee' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#eee' },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 15 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, marginRight: 8, marginBottom: 8 },
  actionRow: { flexDirection: 'row', marginTop: 15, gap: 10 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: '#f5f5f5', borderRadius: 8, gap: 5 },
  actionButtonActive: { backgroundColor: '#fff0e6' },
  actionButtonText: { fontSize: 13, color: '#666', fontWeight: '500' },
  actionButtonTextActive: { color: '#FF6B00' },
  contactRow: { flexDirection: 'row', marginTop: 15, gap: 10 },
  contactButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8, gap: 8 },
  contactButtonText: { fontSize: 14, fontWeight: 'bold' },
  tabContainer: { flexDirection: 'row', marginTop: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: '#FF6B00' },
  tabText: { fontSize: 14, color: '#666' },
  activeTabText: { color: '#FF6B00', fontWeight: 'bold' },
  listContent: { paddingBottom: 20 },
  productRow: { justifyContent: 'space-between', paddingHorizontal: 10 },
  productCard: { width: (width - 30) / 2, backgroundColor: '#fff', borderRadius: 12, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  productImage: { width: '100%', height: 150, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  productInfo: { padding: 10 },
  productName: { fontSize: 14, color: '#333', marginBottom: 5 },
  productPrice: { fontSize: 16, fontWeight: 'bold', color: '#FF6B00', marginBottom: 5 },
  productMoq: { fontSize: 11, color: '#999' },
  productRating: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 5 },
  ratingStars: { fontSize: 12, color: '#333' },
  orders: { fontSize: 11, color: '#999' },
  
  floatingChatButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#4FC3F7',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 999,
    borderWidth: 2,
    borderColor: '#fff',
  },
  
  reviewCard: { padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewAuthor: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  ratingBadge: { 
    backgroundColor: '#FFF9E6', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: '#FFB800' 
  },
  businessDetailsContainer: {
    marginTop: 20,
    backgroundColor: '#F8FAFC',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  detailTextContainer: {
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 2,
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    marginTop: 5,
  },
  certSection: {
    marginTop: 25,
  },
  certList: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#0EA5E9',
  },
  certItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  certText: {
    fontSize: 14,
    color: '#0369A1',
    fontWeight: '500',
    marginLeft: 8,
  },
  reviewRating: { color: '#FFB800', fontWeight: 'bold', fontSize: 12 },
  reviewComment: { fontSize: 14, color: '#666', lineHeight: 20 },
  reviewDate: { fontSize: 12, color: '#999', marginTop: 8, textAlign: 'right' },

  section: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  subsectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginTop: 20, marginBottom: 10 },
  description: { fontSize: 14, color: '#666', lineHeight: 22 },
  tagContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f0f0f0', borderRadius: 20 },
  tagText: { fontSize: 12, color: '#666' },
  emptyContainer: { padding: 50, alignItems: 'center' },
  emptyText: { marginTop: 10, color: '#999' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 10, color: '#666' },
  errorText: { fontSize: 16, color: '#666', marginTop: 10, marginBottom: 20 },
  retryButton: { paddingHorizontal: 25, paddingVertical: 12, backgroundColor: '#FF6B00', borderRadius: 25 },
  retryButtonText: { color: '#fff', fontWeight: 'bold' },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
  footerText: { marginTop: 8, color: '#666', fontSize: 12 },
  footerError: { padding: 20, alignItems: 'center' },
  retryText: { marginTop: 8, color: '#FF6B00', fontWeight: 'bold' },
  footerEnd: { padding: 20, alignItems: 'center' },
  endText: { color: '#999', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 14 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalCancel: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  modalCancelText: { color: '#666', fontWeight: 'bold' },
  modalSend: { flex: 2, backgroundColor: '#FF6B00', paddingVertical: 15, borderRadius: 8, alignItems: 'center' },
  modalSendDisabled: { backgroundColor: '#ccc' },
  modalSendText: { color: '#fff', fontWeight: 'bold' },
  aboutContainer: { backgroundColor: '#fff' }
});
