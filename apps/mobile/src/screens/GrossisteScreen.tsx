// apps/mobile/app/grossiste.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalizedProductText } from '@/utils/productLocale';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Image,
  TextInput,
  StatusBar,
  FlatList,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import WholesaleQuoteForm from '@/components/WholesaleQuoteForm';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#FF6A00',
  secondary: '#FF8C00',
  background: '#F8F8F8',
  white: '#FFFFFF',
  text: '#2D3748',
  lightGray: '#E2E8F0',
  success: '#00B517',
  darkBlue: '#1E40AF',
  industrial: '#1E293B',
};

// Constantes pour le cache
const CACHE_KEYS = {
  COMPANIES: 'grossiste_companies',
  CATEGORIES: 'grossiste_categories',
  PRODUCTS: 'grossiste_products',
  STATS: 'grossiste_stats',
  TIMESTAMP: 'grossiste_timestamp',
};

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const MOCK_MODE_KEY = 'grossiste_mock_mode';

// ============ DONNÉES MOCKÉES ============
const MOCK_COMPANIES = [
  {
    id: 'mock-1',
    name: 'Textile Industriel SARL',
    logo: 'https://cdn-icons-png.flaticon.com/512/2095/2095358.png',
    city: 'Casablanca',
    country: 'Maroc',
    isActive: true,
    productCount: 156,
    description: 'Fabricant de tissus et vêtements professionnels'
  },
  {
    id: 'mock-2',
    name: 'Acier & Métaux SA',
    logo: 'https://cdn-icons-png.flaticon.com/512/2095/2095390.png',
    city: 'Dakar',
    country: 'Sénégal',
    isActive: true,
    productCount: 89,
    description: 'Fournisseur de matériaux de construction'
  },
  {
    id: 'mock-3',
    name: 'Agro-Industrie du Sahel',
    logo: 'https://cdn-icons-png.flaticon.com/512/2095/2095362.png',
    city: 'Bamako',
    country: 'Mali',
    isActive: true,
    productCount: 234,
    description: 'Produits agricoles transformés pour l\'industrie'
  },
  {
    id: 'mock-4',
    name: 'Électronique Pro Africa',
    logo: 'https://cdn-icons-png.flaticon.com/512/2095/2095378.png',
    city: 'Abidjan',
    country: 'Côte d\'Ivoire',
    isActive: true,
    productCount: 67,
    description: 'Équipements électroniques professionnels'
  },
  {
    id: 'mock-5',
    name: 'Chimie Industrielle Ouest',
    logo: 'https://cdn-icons-png.flaticon.com/512/2095/2095412.png',
    city: 'Lomé',
    country: 'Togo',
    isActive: true,
    productCount: 112,
    description: 'Produits chimiques pour l\'industrie'
  },
  {
    id: 'mock-6',
    name: 'Emballages Modernes',
    logo: 'https://cdn-icons-png.flaticon.com/512/2095/2095434.png',
    city: 'Ouagadougou',
    country: 'Burkina Faso',
    isActive: true,
    productCount: 78,
    description: 'Solutions d\'emballage industriel'
  }
];

const MOCK_CATEGORIES = [
  {
    id: 'cat-1',
    name: 'Textile',
    productCount: 1250,
    image: 'https://cdn-icons-png.flaticon.com/512/2095/2095358.png'
  },
  {
    id: 'cat-2',
    name: 'Métallurgie',
    productCount: 890,
    image: 'https://cdn-icons-png.flaticon.com/512/2095/2095390.png'
  },
  {
    id: 'cat-3',
    name: 'Agroalimentaire',
    productCount: 2340,
    image: 'https://cdn-icons-png.flaticon.com/512/2095/2095362.png'
  },
  {
    id: 'cat-4',
    name: 'Électronique',
    productCount: 560,
    image: 'https://cdn-icons-png.flaticon.com/512/2095/2095378.png'
  },
  {
    id: 'cat-5',
    name: 'Chimie',
    productCount: 430,
    image: 'https://cdn-icons-png.flaticon.com/512/2095/2095412.png'
  },
  {
    id: 'cat-6',
    name: 'Emballage',
    productCount: 780,
    image: 'https://cdn-icons-png.flaticon.com/512/2095/2095434.png'
  }
];

const MOCK_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Tissu Coton Biologique - Lot Industriel',
    price: 4500,
    images: ['https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400'],
    companyName: 'Textile Industriel SARL',
    companyId: 'mock-1',
    moq: 100,
    unit: 'rouleau'
  },
  {
    id: 'prod-2',
    name: 'Poutrelles Acier Galvanisé',
    price: 25000,
    images: ['https://images.unsplash.com/photo-1541971870-5f8d5b3b1d4f?w=400'],
    companyName: 'Acier & Métaux SA',
    companyId: 'mock-2',
    moq: 10,
    unit: 'tonne'
  },
  {
    id: 'prod-3',
    name: 'Huile de Palme Raffinée',
    price: 3800,
    images: ['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400'],
    companyName: 'Agro-Industrie du Sahel',
    companyId: 'mock-3',
    moq: 500,
    unit: 'litre'
  },
  {
    id: 'prod-4',
    name: 'Cartes Mères Industrielles',
    price: 75000,
    images: ['https://images.unsplash.com/photo-1518770660439-4636190af475?w=400'],
    companyName: 'Électronique Pro Africa',
    companyId: 'mock-4',
    moq: 50,
    unit: 'pièce'
  }
];

const MOCK_STATS = {
  activeCompanies: 156,
  totalProducts: 8450,
  totalCategories: 24,
};

// ============ TYPES ============
interface Company {
  id: string;
  name: string;
  nameLower?: string;
  email?: string;
  logo?: string;
  coverImage?: string;
  city?: string;
  country?: string;
  status?: string;
  isActive?: boolean;
  productCount?: number;
  createdAt?: any;
  updatedAt?: any;
  street?: string;
  fullAddress?: string;
  description?: string;
  phone?: string;
  website?: string;
  categories?: string[];
}

interface Category {
  id: string;
  name: string;
  nameLower?: string;
  description?: string;
  image?: string;
  productCount?: number;
  parentId?: string;
  isActive?: boolean;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  images?: string[];
  companyId: string;
  companyName?: string;
  categoryId?: string;
  categoryName?: string;
  stock?: number;
  moq?: number;
  unit?: string;
  isActive?: boolean;
  createdAt?: any;
  specifications?: Record<string, any>;
}

// ============ SERVICES DE CACHE ============
const cacheService = {
  async saveData(key: string, data: any) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
      console.log(`💾 Données mises en cache: ${key}`);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du cache:', error);
    }
  },

  async getData(key: string) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > CACHE_DURATION;

      if (isExpired) {
        console.log(`⌛ Cache expiré pour: ${key}`);
        return null;
      }

      console.log(`✅ Données récupérées du cache: ${key}`);
      return data;
    } catch (error) {
      console.error('Erreur lors de la lecture du cache:', error);
      return null;
    }
  },

  async clearExpiredCache() {
    try {
      const keys = Object.values(CACHE_KEYS);
      for (const key of keys) {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          const { timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp > CACHE_DURATION) {
            await AsyncStorage.removeItem(key);
            console.log(`🗑️ Cache expiré supprimé: ${key}`);
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors du nettoyage du cache:', error);
    }
  },

  async setMockMode(active: boolean) {
    await AsyncStorage.setItem(MOCK_MODE_KEY, JSON.stringify(active));
  },

  async isMockModeActive() {
    const mockMode = await AsyncStorage.getItem(MOCK_MODE_KEY);
    return mockMode ? JSON.parse(mockMode) : false;
  },
};

export default function GrossisteScreen() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [stats, setStats] = useState(MOCK_STATS);
  const [isOffline, setIsOffline] = useState(false);
  
  // État pour le modal de devis
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const localizedProductName = useCallback(
    (p: Product) =>
      getLocalizedProductText(
        p.name,
        'name',
        p as unknown as Record<string, unknown>,
        i18n.language,
      ),
    [i18n.language],
  );

  // Vérifier la connexion réseau
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
      if (!state.isConnected) {
        console.log('📡 Mode hors-ligne détecté');
        loadFromCache();
      }
    });

    return () => unsubscribe();
  }, []);

  // Chargement initial
  useEffect(() => {
    initializeData();
  }, []);

  // Rechargement quand l'écran est focus
  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        checkAndRefreshData();
      }
    }, [loading])
  );

  const initializeData = async () => {
    try {
      setLoading(true);
      
      // Vérifier le mode mock
      const isMockActive = await cacheService.isMockModeActive();
      setMockMode(isMockActive);

      if (isMockActive) {
        console.log('🎭 Mode démo actif - Chargement des données mockées');
        loadMockData();
        setLoading(false);
        return;
      }

      // Essayer de charger depuis le cache d'abord
      const cachedData = await loadFromCache();
      
      // Si on est hors ligne, utiliser le cache ou les mock data
      if (isOffline) {
        if (cachedData) {
          console.log('📱 Mode hors-ligne - Données du cache chargées');
        } else {
          console.log('📱 Mode hors-ligne - Pas de cache, chargement des mock data');
          loadMockData();
        }
        setLoading(false);
        return;
      }

      // Sinon, essayer de charger depuis Firebase
      await fetchFromFirebase();
    } catch (error) {
      console.error('Erreur lors de l\'initialisation:', error);
      await handleFetchError(error);
    } finally {
      setLoading(false);
    }
  };

  const loadFromCache = async () => {
    try {
      const [
        cachedCompanies,
        cachedCategories,
        cachedProducts,
        cachedStats
      ] = await Promise.all([
        cacheService.getData(CACHE_KEYS.COMPANIES),
        cacheService.getData(CACHE_KEYS.CATEGORIES),
        cacheService.getData(CACHE_KEYS.PRODUCTS),
        cacheService.getData(CACHE_KEYS.STATS),
      ]);

      if (cachedCompanies) setCompanies(cachedCompanies);
      if (cachedCategories) setCategories(cachedCategories);
      if (cachedProducts) setFeaturedProducts(cachedProducts);
      if (cachedStats) setStats(cachedStats);

      const hasData = cachedCompanies || cachedCategories || cachedProducts;
      return hasData;
    } catch (error) {
      console.error('Erreur lors du chargement du cache:', error);
      return false;
    }
  };

  const fetchFromFirebase = async () => {
    try {
      console.log('🔍 Tentative de chargement depuis Firestore...');
      
      // 1. Charger les entreprises actives
      const companiesQuery = query(
        collection(db, 'companies'),
        where('status', '==', 'active'),
        orderBy('name', 'asc'),
        limit(6)
      );
      const companiesSnapshot = await getDocs(companiesQuery);
      const companiesList = companiesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Company[];
      
      // 2. Charger les catégories
      const categoriesQuery = query(
        collection(db, 'categories'),
        where('isActive', '==', true),
        orderBy('name', 'asc'),
        limit(6)
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesList = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];

      // 3. Charger les produits
      const productsQuery = query(
        collection(db, 'products'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc'),
        limit(4)
      );
      const productsSnapshot = await getDocs(productsQuery);
      const productsList = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];

      // 4. Statistiques — agrégats (évite de télécharger tout le catalogue)
      const totalProductsQuery = query(
        collection(db, 'products'),
        where('isActive', '==', true),
      );
      const allCompaniesQuery = query(
        collection(db, 'companies'),
        where('status', '==', 'active'),
      );
      const [totalProductsAgg, allCompaniesAgg] = await Promise.all([
        getCountFromServer(totalProductsQuery),
        getCountFromServer(allCompaniesQuery),
      ]);

      const newStats = {
        activeCompanies: allCompaniesAgg.data().count,
        totalProducts: totalProductsAgg.data().count,
        totalCategories: categoriesList.length,
      };

      // Mettre à jour les states
      setCompanies(companiesList);
      setCategories(categoriesList);
      setFeaturedProducts(productsList);
      setStats(newStats);

      // Sauvegarder dans le cache
      await Promise.all([
        cacheService.saveData(CACHE_KEYS.COMPANIES, companiesList),
        cacheService.saveData(CACHE_KEYS.CATEGORIES, categoriesList),
        cacheService.saveData(CACHE_KEYS.PRODUCTS, productsList),
        cacheService.saveData(CACHE_KEYS.STATS, newStats),
        cacheService.saveData(CACHE_KEYS.TIMESTAMP, Date.now()),
      ]);

      console.log('✅ Données chargées et mises en cache avec succès');

    } catch (error: any) {
      console.error('❌ Erreur Firebase:', error);
      
      // Vérifier si c'est une erreur de quota
      if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
        console.log('⚠️ Quota Firebase dépassé, activation du mode démo');
        await cacheService.setMockMode(true);
        setMockMode(true);
        
        // Charger les données mockées
        loadMockData();
        
        Alert.alert(
          'Mode Démo Activé',
          'Le quota Firebase est temporairement dépassé. Vous utilisez actuellement des données de démonstration.',
          [{ text: 'OK' }]
        );
      } else {
        // Pour les autres erreurs, essayer le cache ou les mock data
        console.log('⚠️ Autre erreur Firebase, tentative de fallback');
        const hasCache = await loadFromCache();
        
        if (!hasCache) {
          console.log('🎭 Pas de cache, chargement des données mockées');
          loadMockData();
        }
        
        // Ne pas afficher d'alerte pour les erreurs réseau temporaires
        if (error.code !== 'unavailable' && error.code !== 'deadline-exceeded') {
          Alert.alert(
            'Mode Hors-ligne',
            'Connexion impossible. Utilisation des données en cache.',
            [{ text: 'OK' }]
          );
        }
      }
    }
  };

  const loadMockData = () => {
    setCompanies(MOCK_COMPANIES);
    setCategories(MOCK_CATEGORIES);
    setFeaturedProducts(MOCK_PRODUCTS);
    setStats(MOCK_STATS);
    
    // Sauvegarder en cache pour le mode hors-ligne
    cacheService.saveData(CACHE_KEYS.COMPANIES, MOCK_COMPANIES);
    cacheService.saveData(CACHE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    cacheService.saveData(CACHE_KEYS.PRODUCTS, MOCK_PRODUCTS);
    cacheService.saveData(CACHE_KEYS.STATS, MOCK_STATS);
  };

  const handleFetchError = async (error: any) => {
    // Vérifier le cache
    const hasCache = await loadFromCache();
    
    if (hasCache) {
      console.log('📦 Utilisation des données en cache suite à une erreur');
      Alert.alert(
        'Données en cache',
        'Connexion impossible. Affichage des données en cache.',
        [{ text: 'OK' }]
      );
    } else {
      console.log('🎭 Aucun cache disponible, utilisation des données mockées');
      loadMockData();
      Alert.alert(
        'Mode Démo',
        'Connexion impossible. Utilisation des données de démonstration.',
        [{ text: 'OK' }]
      );
    }
    setLoading(false);
  };

  const checkAndRefreshData = async () => {
    if (isOffline || mockMode) return;

    try {
      const timestamp = await AsyncStorage.getItem(CACHE_KEYS.TIMESTAMP);
      if (timestamp) {
        const age = Date.now() - parseInt(timestamp);
        if (age > CACHE_DURATION) {
          console.log('🔄 Cache expiré, rafraîchissement...');
          setRefreshing(true);
          await fetchFromFirebase();
          setRefreshing(false);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du cache:', error);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    
    if (mockMode) {
      await cacheService.setMockMode(false);
      setMockMode(false);
    }

    await cacheService.clearExpiredCache();
    await initializeData();
    setRefreshing(false);
  };

  const handleContact = () => router.push('/contact-grossiste');
  const handleBecomeClient = () => router.push('/devenir-client-industriel');
  const handleBrowseCatalog = () => router.push('/catalogue?type=industrial');
  
  const handleRequestQuote = (product?: Product) => {
    if (product) {
      setSelectedProduct(product);
      setShowQuoteForm(true);
    } else {
      router.push('/demande-devis');
    }
  };

  const handleViewSupplier = (supplierId: string) => {
    router.push(`/supplier/${supplierId}`);
  };

  // VERSION CORRIGÉE : handleViewProduct avec paramètres
  const handleViewProduct = (product: Product) => {
    router.push({
      pathname: `/product/wholesale/${product.id}`,
      params: {
        companyName: product.companyName || '',
        productName: localizedProductName(product),
        companyId: product.companyId || '',
        fromMock: mockMode ? 'true' : 'false',
      }
    });
  };

  const handleViewCategory = (categoryId: string) => {
    router.push(`/category/${categoryId}`);
  };

  const handleLoginSupplier = () => router.push('/suppliers');

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push({
        pathname: '/search-results',
        params: { query: searchQuery.trim() },
      });
    }
  };

  const BENEFITS = [
    {
      id: '1',
      icon: 'trending-up',
      title: 'Prix Direct Usine',
      description: `Prix fabricant pour ${stats.activeCompanies} fournisseurs`,
      color: '#FF6A00',
    },
    {
      id: '2',
      icon: 'cube',
      title: 'Grandes Quantités',
      description: `${stats.totalProducts} produits disponibles`,
      color: '#00B517',
    },
    {
      id: '3',
      icon: 'shield-checkmark',
      title: 'Fournisseurs Vérifiés',
      description: 'Tous nos fournisseurs sont certifiés',
      color: '#4C6EF5',
    },
    {
      id: '4',
      icon: 'rocket',
      title: 'Livraison Rapide',
      description: 'Expédition internationale sous 48h',
      color: '#1E40AF',
    },
  ];

  const renderBenefitItem = ({ item }: { item: any }) => (
    <View style={styles.benefitCard}>
      <LinearGradient
        colors={[`${item.color}20`, `${item.color}10`]}
        style={styles.benefitIconContainer}
      >
        <Ionicons name={item.icon as any} size={28} color={item.color} />
      </LinearGradient>
      <Text style={styles.benefitTitle}>{item.title}</Text>
      <Text style={styles.benefitDescription}>{item.description}</Text>
    </View>
  );

  const renderCompanyItem = ({ item }: { item: Company }) => (
    <TouchableOpacity 
      style={styles.companyCard}
      onPress={() => handleViewSupplier(item.id)}
    >
      <View style={styles.companyHeader}>
        {item.logo ? (
          <Image source={{ uri: item.logo }} style={styles.companyLogo} />
        ) : (
          <View style={styles.companyLogoPlaceholder}>
            <Text style={styles.companyLogoText}>{item.name?.charAt(0) || 'F'}</Text>
          </View>
        )}
        <View style={styles.companyInfo}>
          <Text style={styles.companyName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.companyLocation}>
            <Ionicons name="location" size={12} color="#666" />
            <Text style={styles.companyLocationText}>
              {item.city || ''} {item.country ? `, ${item.country}` : ''}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.companyStats}>
        <View style={styles.productStat}>
          <Ionicons name="cube-outline" size={14} color={COLORS.primary} />
          <Text style={styles.productStatText}>
            {item.productCount || 0} produits
          </Text>
        </View>
        
        <View style={[
          styles.statusBadge,
          item.isActive ? styles.statusActive : styles.statusInactive
        ]}>
          <Ionicons 
            name={item.isActive ? "checkmark-circle" : "close-circle"} 
            size={12} 
            color="#fff" 
          />
          <Text style={styles.statusText}>
            {item.isActive ? 'Actif' : 'Inactif'}
          </Text>
        </View>
      </View>
      
      {item.description && (
        <Text style={styles.companyDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <TouchableOpacity 
      style={styles.categoryCard}
      onPress={() => handleViewCategory(item.id)}
    >
      <View style={styles.categoryIconContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.categoryImage} />
        ) : (
          <Ionicons name="grid" size={24} color={COLORS.primary} />
        )}
      </View>
      <Text style={styles.categoryName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.categoryCount}>
        {item.productCount || 0} produits
      </Text>
    </TouchableOpacity>
  );

  // VERSION CORRIGÉE : renderProductItem avec handleViewProduct(product)
  const renderProductItem = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      <TouchableOpacity 
        style={styles.productImageContainer}
        onPress={() => handleViewProduct(item)}
      >
        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.productImage} />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="cube" size={32} color={COLORS.lightGray} />
          </View>
        )}
        {item.moq && (
          <View style={styles.moqBadge}>
            <Text style={styles.moqText}>MOQ: {item.moq}</Text>
          </View>
        )}
      </TouchableOpacity>
      
      <View style={styles.productInfo}>
        <TouchableOpacity onPress={() => handleViewProduct(item)}>
          <Text style={styles.productName} numberOfLines={2}>
            {localizedProductName(item)}
          </Text>
          
          <Text style={styles.productCompany} numberOfLines={1}>
            {item.companyName || 'Fournisseur industriel'}
          </Text>
        </TouchableOpacity>
        
        <View style={styles.productPriceContainer}>
          <Text style={styles.productPrice}>
            {item.price?.toLocaleString()} FCFA
          </Text>
          {item.unit && (
            <Text style={styles.productUnit}>/{item.unit}</Text>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.quoteButton}
          onPress={() => handleRequestQuote(item)}
        >
          <Ionicons name="document-text" size={16} color="#FFF" />
          <Text style={styles.quoteButtonText}>Demander devis</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && companies.length === 0 && categories.length === 0 && featuredProducts.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement de l'espace grossiste...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      {/* Header avec indicateur de mode */}
      <LinearGradient
        colors={[COLORS.industrial, '#334155']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>A2EXPRESS INDUSTRIAL</Text>
            <View style={styles.headerStatus}>
              <Text style={styles.headerSubtitle}>
                {stats.activeCompanies} fournisseurs • {stats.totalProducts} produits B2B
              </Text>
              {(mockMode || isOffline) && (
                <View style={styles.statusBadgeHeader}>
                  <Ionicons 
                    name={mockMode ? "construct-outline" : "cloud-offline-outline"} 
                    size={12} 
                    color="#FFF" 
                  />
                  <Text style={styles.statusBadgeHeaderText}>
                    {mockMode ? 'Mode Démo' : 'Hors-ligne'}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.supplierLoginButton}
            onPress={handleLoginSupplier}
          >
            <Ionicons name="log-in-outline" size={20} color="#FFF" />
            <Text style={styles.supplierLoginText}>Espace Pro</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleManualRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Indicateur de mode démo/hors-ligne */}
        {(mockMode || isOffline) && (
          <View style={styles.modeIndicator}>
            <Ionicons 
              name={mockMode ? "construct" : "cloud-offline"} 
              size={18} 
              color={COLORS.primary} 
            />
            <Text style={styles.modeIndicatorText}>
              {mockMode 
                ? 'Mode démonstration - Données non contractuelles' 
                : 'Mode hors-ligne - Données en cache'}
            </Text>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher fournisseurs, produits, catégories..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={handleSearch}
              disabled={!searchQuery.trim()}
            >
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Section */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={['#1E293B', '#334155']}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroTitle}>Plateforme B2B Industrielle</Text>
                <Text style={styles.heroDescription}>
                  Connectez-vous avec {stats.activeCompanies} fournisseurs vérifiés 
                  et accédez à {stats.totalProducts} produits industriels en gros. 
                  Prix direct usine, qualité garantie.
                </Text>
              </View>
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2095/2095358.png' }}
                style={styles.heroImage}
              />
            </View>
            
            <View style={styles.heroButtons}>
              <TouchableOpacity 
                style={styles.heroButtonPrimary}
                onPress={handleBecomeClient}
              >
                <Ionicons name="business" size={20} color="#FFF" />
                <Text style={styles.heroButtonPrimaryText}>Client Industriel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.heroButtonSecondary}
                onPress={handleBrowseCatalog}
              >
                <Ionicons name="cube" size={18} color={COLORS.primary} />
                <Text style={styles.heroButtonSecondaryText}>Voir Catalogue</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Stats Section */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.activeCompanies}</Text>
            <Text style={styles.statLabel}>Fournisseurs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.totalProducts}</Text>
            <Text style={styles.statLabel}>Produits</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.totalCategories}</Text>
            <Text style={styles.statLabel}>Catégories</Text>
          </View>
        </View>

        {/* Benefits Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pourquoi A2EXPRESS ?</Text>
            <Text style={styles.sectionSubtitle}>Avantages certifiés</Text>
          </View>
          
          <FlatList
            data={BENEFITS}
            renderItem={renderBenefitItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.benefitsGrid}
          />
        </View>

        {/* Featured Companies */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Fournisseurs Vérifiés</Text>
            <TouchableOpacity onPress={() => router.push('/suppliers')}>
              <Text style={styles.seeAllText}>Voir tous</Text>
            </TouchableOpacity>
          </View>
          
          {companies.length > 0 ? (
            <FlatList
              data={companies}
              renderItem={renderCompanyItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.companiesList}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={48} color={COLORS.lightGray} />
              <Text style={styles.emptyStateText}>Aucun fournisseur disponible</Text>
            </View>
          )}
        </View>

        {/* Featured Products */}
        {featuredProducts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Produits en Vedette</Text>
              <TouchableOpacity onPress={handleBrowseCatalog}>
                <Text style={styles.seeAllText}>Tous les produits</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={featuredProducts}
              renderItem={renderProductItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productsList}
            />
          </View>
        )}

        {/* Categories Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Catégories</Text>
            <TouchableOpacity onPress={() => router.push('/categories')}>
              <Text style={styles.seeAllText}>Toutes catégories</Text>
            </TouchableOpacity>
          </View>
          
          {categories.length > 0 ? (
            <FlatList
              data={categories}
              renderItem={renderCategoryItem}
              keyExtractor={(item) => item.id}
              numColumns={3}
              scrollEnabled={false}
              columnWrapperStyle={styles.categoriesGrid}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="grid-outline" size={48} color={COLORS.lightGray} />
              <Text style={styles.emptyStateText}>Aucune catégorie disponible</Text>
            </View>
          )}
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <View style={styles.ctaIconContainer}>
            <Ionicons name="chatbubble-ellipses" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.ctaTitle}>Un projet industriel ?</Text>
          <Text style={styles.ctaDescription}>
            Notre équipe commerciale vous accompagne dans la recherche 
            de fournisseurs et la négociation des meilleures conditions.
          </Text>
          
          <View style={styles.ctaButtons}>
            <TouchableOpacity 
              style={[styles.ctaButton, styles.primaryButton]}
              onPress={handleContact}
            >
              <Ionicons name="call" size={20} color="#FFF" />
              <Text style={styles.primaryButtonText}>Nous contacter</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.ctaButton, styles.secondaryButton]}
              onPress={() => handleRequestQuote()}
            >
              <Ionicons name="document-text" size={20} color={COLORS.primary} />
              <Text style={styles.secondaryButtonText}>Demander un devis</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Supplier Registration CTA */}
        <TouchableOpacity 
          style={styles.supplierRegistrationCard}
          onPress={() => router.push('/suppliers/register')}
        >
          <LinearGradient
            colors={['#FF6A00', '#FF8C00']}
            style={styles.supplierRegistrationGradient}
          >
            <Ionicons name="business" size={32} color="#FFF" />
            <View style={styles.supplierRegistrationContent}>
              <Text style={styles.supplierRegistrationTitle}>Vous êtes Fournisseur ?</Text>
              <Text style={styles.supplierRegistrationText}>
                Rejoignez notre plateforme B2B et augmentez vos ventes
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={24} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de demande de devis */}
      <WholesaleQuoteForm
        visible={showQuoteForm}
        onClose={() => {
          setShowQuoteForm(false);
          setSelectedProduct(null);
        }}
        productName={selectedProduct ? localizedProductName(selectedProduct) : undefined}
        productId={selectedProduct?.id}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  statusBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 0, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeHeaderText: {
    fontSize: 9,
    color: '#FFF',
    fontWeight: '600',
  },
  supplierLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  supplierLoginText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  modeIndicatorText: {
    fontSize: 12,
    color: COLORS.industrial,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.industrial,
    fontWeight: '500',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  heroCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  heroGradient: {
    padding: 20,
  },
  heroContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  heroImage: {
    width: 80,
    height: 80,
    marginLeft: 16,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  heroButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  heroButtonPrimaryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  heroButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  heroButtonSecondaryText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.industrial,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.industrial,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  seeAllText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  benefitsGrid: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  benefitCard: {
    width: (width - 48) / 2,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  benefitIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.industrial,
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 11,
    color: '#666',
    lineHeight: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  companiesList: {
    paddingRight: 16,
  },
  companyCard: {
    width: width * 0.7,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  companyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 12,
  },
  companyLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  companyLogoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.industrial,
    marginBottom: 4,
  },
  companyLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  companyLocationText: {
    fontSize: 12,
    color: '#666',
  },
  companyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productStat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  productStatText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statusActive: {
    backgroundColor: '#10B981',
  },
  statusInactive: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  companyDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  productsList: {
    paddingRight: 16,
  },
  productCard: {
    width: width * 0.6,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  productImageContainer: {
    position: 'relative',
    height: 120,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moqBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(30, 64, 175, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  moqText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.industrial,
    marginBottom: 4,
  },
  productCompany: {
    fontSize: 11,
    color: '#666',
    marginBottom: 8,
  },
  productPriceContainer: {
    marginBottom: 12,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  productUnit: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  quoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  quoteButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  categoriesGrid: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoryCard: {
    width: (width - 48) / 3,
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF5E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryImage: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.industrial,
    textAlign: 'center',
    marginBottom: 4,
    height: 28,
  },
  categoryCount: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  ctaSection: {
    backgroundColor: '#F8FAFC',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  ctaIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.industrial,
    marginBottom: 8,
    textAlign: 'center',
  },
  ctaDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  ctaButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    minWidth: 140,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  supplierRegistrationCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  supplierRegistrationGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  supplierRegistrationContent: {
    flex: 1,
  },
  supplierRegistrationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  supplierRegistrationText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 16,
  },
});
