// app/suppliers/index.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  StatusBar,
  RefreshControl,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  where, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { getAuth } from 'firebase/auth';

const { width } = Dimensions.get("window");

// Types MIS À JOUR pour inclure les catégories et services
interface Category {
  id: string;
  name: string;
  icon: string;
  productCount: number;
  supplierCount: number;
}

interface B2BService {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  isActive: boolean;
  availableFor: string[]; // ['all', 'buyer', 'seller']
  requiresAuth: boolean;
}

interface Supplier {
  id: string;
  name: string;
  logo: string;
  verified: boolean;
  description: string;
  location: string;
  businessType: string;
  responseTime: string;
  responseRate: number;
  rating: number;
  totalOrders: number;
  yearsOnPlatform: number;
  goldSupplier?: boolean;
  // Champs catégories
  categories?: string[];
  mainCategory?: string;
  // Champs Firestore
  email?: string;
  phone?: string;
  certifications?: string[];
  annualRevenue?: string;
  employees?: string;
  mainProducts?: string;
  coverImage?: string;
  // Stats
  stats?: {
    orderCount: number;
    productCount: number;
    rating: number;
    reviewCount: number;
  };
  // Vérification
  verification?: {
    status: string;
    verified: boolean;
    badges: string[];
  };
}

// Données dynamiques des catégories - Récupérées depuis Firestore
const STATIC_CATEGORIES: Category[] = [
  { id: 'machines_industrielles', name: 'Machines Industrielles', icon: 'build', productCount: 1245, supplierCount: 89 },
  { id: 'electronique', name: 'Électronique', icon: 'hardware-chip', productCount: 876, supplierCount: 67 },
  { id: 'vetements', name: 'Vêtements', icon: 'shirt', productCount: 654, supplierCount: 45 },
  { id: 'alimentation', name: 'Alimentation', icon: 'restaurant', productCount: 543, supplierCount: 32 },
  { id: 'construction', name: 'Construction', icon: 'home', productCount: 432, supplierCount: 28 },
];

// Services B2B DYNAMIQUES avec intégration Firestore
const B2B_SERVICES: B2BService[] = [
  { 
    id: 'request_quote', 
    name: 'Demander un devis', 
    description: 'Obtenez des devis personnalisés des fournisseurs', 
    icon: 'document-text-outline', 
    route: '/request-quote',
    color: '#4CAF50',
    isActive: true,
    availableFor: ['all', 'buyer'],
    requiresAuth: true
  },
  { 
    id: 'online_showroom', 
    name: 'Salon en ligne', 
    description: 'Explorez les salons virtuels des fournisseurs', 
    icon: 'business-outline', 
    route: '/showrooms',
    color: '#2196F3',
    isActive: true,
    availableFor: ['all'],
    requiresAuth: false
  },
  { 
    id: 'exhibition_hall', 
    name: 'Salle d\'exposition', 
    description: 'Découvrez les produits phares des exposants', 
    icon: 'storefront-outline', 
    route: '/exhibitions',
    color: '#FF9800',
    isActive: true,
    availableFor: ['all'],
    requiresAuth: false
  },
  { 
    id: 'image_search', 
    name: 'Recherche image', 
    description: 'Trouvez des produits avec une photo', 
    icon: 'camera-outline', 
    route: '/image-search',
    color: '#9C27B0',
    isActive: true,
    availableFor: ['all', 'buyer'],
    requiresAuth: false
  },
  { 
    id: 'logistics', 
    name: 'Logistique', 
    description: 'Solutions de transport et douane', 
    icon: 'airplane-outline', 
    route: '/logistics',
    color: '#795548',
    isActive: true,
    availableFor: ['all', 'buyer', 'seller'],
    requiresAuth: true
  },
  { 
    id: 'inspection', 
    name: 'Inspection', 
    description: 'Services de contrôle qualité', 
    icon: 'search-outline', 
    route: '/inspection',
    color: '#F44336',
    isActive: true,
    availableFor: ['all', 'buyer'],
    requiresAuth: true
  },
];

// Composant Header
const SearchHeader = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}&type=suppliers`);
    }
  };

  const handleBarcodeScan = () => {
    router.push('/barcode-scanner');
  };

  return (
    <View style={styles.header}>
      <Text style={styles.mainTitle}>Fournisseurs Vérifiés</Text>
      
      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher des fournisseurs..."
            placeholderTextColor="#999"
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.cameraButton} onPress={handleBarcodeScan}>
            <Ionicons name="camera-outline" size={22} color="#666" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Rechercher</Text>
        </TouchableOpacity>
      </View>

      {/* Bouton Devenir Fournisseur */}
      <TouchableOpacity 
        style={styles.becomeSupplierButton}
        onPress={() => router.push('/become-supplier')}
      >
        <Ionicons name="business-outline" size={18} color="#fff" />
        <Text style={styles.becomeSupplierText}>Devenir Fournisseur</Text>
      </TouchableOpacity>
    </View>
  );
};

// Composant Filtres de Catégories
const CategoryFilters = ({ 
  selectedCategory, 
  onSelectCategory,
  categories 
}: { 
  selectedCategory: string; 
  onSelectCategory: (categoryId: string) => void;
  categories: Category[];
}) => {
  return (
    <View style={styles.categoryContainer}>
      <Text style={styles.categoryTitle}>Catégories</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScrollView}
      >
        <TouchableOpacity 
          style={[
            styles.categoryItem, 
            selectedCategory === 'all' && styles.activeCategoryItem
          ]}
          onPress={() => onSelectCategory('all')}
        >
          <Ionicons name="grid" size={18} color={selectedCategory === 'all' ? '#fff' : '#666'} />
          <Text style={[
            styles.categoryText,
            selectedCategory === 'all' && styles.activeCategoryText
          ]}>
            Toutes
          </Text>
        </TouchableOpacity>
        
        {categories.map((category) => (
          <TouchableOpacity 
            key={category.id}
            style={[
              styles.categoryItem, 
              selectedCategory === category.id && styles.activeCategoryItem
            ]}
            onPress={() => onSelectCategory(category.id)}
          >
            <Ionicons 
              name={category.icon as any} 
              size={18} 
              color={selectedCategory === category.id ? '#fff' : '#666'} 
            />
            <Text style={[
              styles.categoryText,
              selectedCategory === category.id && styles.activeCategoryText
            ]}>
              {category.name}
            </Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {category.supplierCount}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

// Composant pour les Services B2B DYNAMIQUES
const ServicesSection = ({ 
  services,
  onServicePress,
  userType 
}: { 
  services: B2BService[];
  onServicePress: (service: B2BService) => void;
  userType: 'buyer' | 'seller' | 'guest';
}) => {
  const filteredServices = services.filter(service => 
    service.isActive && 
    (service.availableFor.includes('all') || service.availableFor.includes(userType))
  );

  return (
    <View style={styles.servicesSection}>
      <View style={styles.servicesHeader}>
        <Text style={styles.sectionTitle}>Services B2B</Text>
        <TouchableOpacity onPress={() => {/* Naviguer vers tous les services */}}>
          <Text style={styles.seeAllText}>Tout voir</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.servicesGrid}>
        {filteredServices.map((service, index) => (
          <TouchableOpacity 
            key={service.id} 
            style={styles.serviceItem}
            onPress={() => onServicePress(service)}
          >
            <View style={[styles.serviceIcon, { backgroundColor: `${service.color}15` }]}>
              <Ionicons name={service.icon as any} size={24} color={service.color} />
            </View>
            <Text style={styles.serviceLabel}>{service.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// Modal pour les services nécessitant une authentification
const AuthRequiredModal = ({ 
  visible, 
  onClose, 
  serviceName,
  onLogin,
  onRegister 
}: { 
  visible: boolean; 
  onClose: () => void;
  serviceName: string;
  onLogin: () => void;
  onRegister: () => void;
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Ionicons name="lock-closed" size={50} color="#ff6a00" style={styles.modalIcon} />
        <Text style={styles.modalTitle}>Connexion Requise</Text>
        <Text style={styles.modalText}>
          Pour accéder au service "{serviceName}", vous devez être connecté à votre compte.
        </Text>
        <View style={styles.modalButtons}>
          <TouchableOpacity style={styles.modalButtonSecondary} onPress={onClose}>
            <Text style={styles.modalButtonSecondaryText}>Plus tard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalButtonPrimary} onPress={onLogin}>
            <Text style={styles.modalButtonPrimaryText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onRegister}>
          <Text style={styles.modalRegisterText}>Créer un compte gratuit</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// Composant Modal de Demande de Devis
const QuoteRequestModal = ({ 
  visible, 
  onClose,
  supplierId,
  supplierName 
}: { 
  visible: boolean; 
  onClose: () => void;
  supplierId?: string;
  supplierName?: string;
}) => {
  const [productDescription, setProductDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [loading, setLoading] = useState(false);
  const auth = getAuth();
  const router = useRouter();

  const handleSubmitQuote = async () => {
    if (!auth.currentUser) {
      Alert.alert("Connexion requise", "Veuillez vous connecter pour demander un devis");
      onClose();
      router.push('/auth/login');
      return;
    }

    if (!productDescription.trim()) {
      Alert.alert("Erreur", "Veuillez décrire le produit ou service");
      return;
    }

    setLoading(true);
    try {
      const quoteData = {
        buyerId: auth.currentUser.uid,
        buyerName: auth.currentUser.displayName || auth.currentUser.email,
        supplierId: supplierId || null,
        supplierName: supplierName || "Multiple suppliers",
        productDescription,
        quantity: quantity || "Non spécifié",
        deliveryDate: deliveryDate || "Flexible",
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        messages: []
      };

      const quoteRef = doc(collection(db, 'quoteRequests'));
      await setDoc(quoteRef, quoteData);

      Alert.alert(
        "Succès", 
        "Votre demande de devis a été envoyée. Vous recevrez des réponses dans votre messagerie.",
        [{ text: "OK", onPress: onClose }]
      );

      // Reset form
      setProductDescription("");
      setQuantity("");
      setDeliveryDate("");

    } catch (error) {
      console.error('Erreur création devis:', error);
      Alert.alert("Erreur", "Impossible d'envoyer la demande de devis");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.quoteModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Demander un devis</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {supplierName && (
            <View style={styles.supplierInfo}>
              <Ionicons name="business" size={16} color="#666" />
              <Text style={styles.supplierInfoText}>Pour: {supplierName}</Text>
            </View>
          )}

          <TextInput
            style={styles.textArea}
            placeholder="Décrivez le produit ou service dont vous avez besoin..."
            value={productDescription}
            onChangeText={setProductDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <View style={styles.formRow}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Quantité</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 1000 unités"
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Date de livraison</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Janvier 2024"
                value={deliveryDate}
                onChangeText={setDeliveryDate}
              />
            </View>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity 
              style={[styles.modalButtonSecondary, loading && styles.disabledButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.modalButtonSecondaryText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButtonPrimary, loading && styles.disabledButton]}
              onPress={handleSubmitQuote}
              disabled={loading || !productDescription.trim()}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalButtonPrimaryText}>Envoyer la demande</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Carte Fournisseur
const SupplierCard = ({ supplier, onRequestQuote }: { supplier: Supplier; onRequestQuote: (supplier: Supplier) => void }) => {
  const router = useRouter();
  
  const mainCategory = supplier.mainCategory 
    ? STATIC_CATEGORIES.find(cat => cat.id === supplier.mainCategory)?.name
    : null;

  const handleContact = () => {
    if (!getAuth().currentUser) {
      Alert.alert(
        "Connexion requise",
        "Vous devez être connecté pour contacter ce fournisseur",
        [
          { text: "Annuler", style: "cancel" },
          { 
            text: "Se connecter", 
            onPress: () => router.push('/auth/login') 
          }
        ]
      );
      return;
    }
    router.push(`/chat?sellerId=${supplier.id}&sellerName=${encodeURIComponent(supplier.name)}`);
  };

  return (
    <TouchableOpacity 
      style={styles.supplierCard}
      onPress={() => router.push(`/suppliers/${supplier.id}`)}
    >
      {/* En-tête du fournisseur */}
      <View style={styles.supplierHeader}>
        <View style={styles.supplierInfo}>
          <Image 
            source={{ 
              uri: supplier.logo || 'https://via.placeholder.com/100x100/007AFF/ffffff?text=LOGO' 
            }} 
            style={styles.supplierLogo} 
          />
          <View style={styles.supplierTextInfo}>
            <View style={styles.supplierNameRow}>
              {supplier.verified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✅ Vérifié</Text>
                </View>
              )}
              {supplier.goldSupplier && (
                <View style={styles.goldBadge}>
                  <Text style={styles.goldText}>🏆 Gold</Text>
                </View>
              )}
              <Text style={styles.supplierName} numberOfLines={1}>
                {supplier.name}
              </Text>
            </View>
            
            {mainCategory && (
              <TouchableOpacity 
                style={styles.categoryButton}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push(`/category/${supplier.mainCategory}`);
                }}
              >
                <Ionicons name="pricetag" size={10} color="#ff6a00" />
                <Text style={styles.categoryButtonText}>{mainCategory}</Text>
              </TouchableOpacity>
            )}
            
            <Text style={styles.supplierDetails}>
              📍 {supplier.location || 'Localisation non spécifiée'} • 🏢 {supplier.businessType || 'Type inconnu'}
            </Text>
            
            <Text style={styles.supplierStats}>
              ⏰ {supplier.responseTime || '24-48h'} • 📞 {supplier.responseRate || 0}% de réponse
            </Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.supplierDescription} numberOfLines={2}>
        {supplier.description || 'Aucune description disponible'}
      </Text>

      {/* Produits principaux */}
      {supplier.mainProducts && (
        <Text style={styles.mainProducts}>
          📦 {supplier.mainProducts}
        </Text>
      )}

      {/* Statistiques */}
      <View style={styles.supplierStatsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{(supplier.rating || 0).toFixed(1)}</Text>
          <Text style={styles.statLabel}>⭐ Note</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{supplier.totalOrders || 0}</Text>
          <Text style={styles.statLabel}>📦 Commandes</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{supplier.stats?.productCount || 0}</Text>
          <Text style={styles.statLabel}>📊 Produits</Text>
        </View>
        {supplier.annualRevenue && (
          <View style={styles.statItem}>
            <Text style={styles.statValue} numberOfLines={1}>
              {supplier.annualRevenue}
            </Text>
            <Text style={styles.statLabel}>💰 CA</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.supplierActions}>
        <TouchableOpacity 
          style={styles.contactButton}
          onPress={(e) => {
            e.stopPropagation();
            handleContact();
          }}
        >
          <Ionicons name="chatbubble-outline" size={16} color="#ff6a00" />
          <Text style={styles.contactButtonText}>Contacter</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quoteButton}
          onPress={(e) => {
            e.stopPropagation();
            onRequestQuote(supplier);
          }}
        >
          <Ionicons name="document-text-outline" size={16} color="#fff" />
          <Text style={styles.quoteButtonText}>Devis</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.viewProductsButton}
          onPress={(e) => {
            e.stopPropagation();
            router.push(`/suppliers/${supplier.id}`);
          }}
        >
          <Text style={styles.viewProductsText}>Détails</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// Écran principal
export default function SuppliersScreen() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>(STATIC_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [quoteModalVisible, setQuoteModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState<B2BService | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [userType, setUserType] = useState<'buyer' | 'seller' | 'guest'>('guest');
  const router = useRouter();
  const auth = getAuth();

  // Vérifier le type d'utilisateur
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // Vérifier si l'utilisateur est un vendeur
        const userDocRef = doc(db, 'users', user.uid);
        getDoc(userDocRef).then(docSnap => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setUserType(userData.userType === 'seller' ? 'seller' : 'buyer');
          } else {
            setUserType('buyer');
          }
        });
      } else {
        setUserType('guest');
      }
    });

    return unsubscribe;
  }, []);

  // Fonction pour récupérer les fournisseurs
  const fetchSuppliers = async (categoryId = selectedCategory) => {
    try {
      console.log('🔍 Chargement des fournisseurs...', categoryId ? `Catégorie: ${categoryId}` : 'Toutes catégories');
      
      let suppliersQuery;
      
      if (categoryId && categoryId !== 'all') {
        suppliersQuery = query(
          collection(db, 'companies'),
          where('categories', 'array-contains', categoryId),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      } else {
        suppliersQuery = query(
          collection(db, 'companies'),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      }
      
      const querySnapshot = await getDocs(suppliersQuery);
      const suppliersData: Supplier[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        suppliersData.push({
          id: doc.id,
          name: data.name || 'Entreprise sans nom',
          logo: data.logo || '',
          description: data.description || '',
          location: data.address?.city || data.location || '',
          businessType: data.businessType || '',
          verified: data.verification?.verified || data.verified || false,
          responseTime: data.responseTime || '24-48h',
          responseRate: data.responseRate || 0,
          rating: data.stats?.rating || data.rating || 0,
          totalOrders: data.stats?.orderCount || data.totalOrders || 0,
          yearsOnPlatform: data.yearsOnPlatform || 0,
          goldSupplier: data.goldSupplier || false,
          categories: data.categories || [],
          mainCategory: data.mainCategory || data.categories?.[0] || null,
          email: data.email,
          phone: data.phone,
          certifications: data.certifications,
          annualRevenue: data.annualRevenue,
          employees: data.employees,
          mainProducts: data.mainProducts,
          coverImage: data.coverImage,
          stats: data.stats,
          verification: data.verification,
        });
      });
      
      console.log(`📊 ${suppliersData.length} fournisseurs chargés`);
      setSuppliers(suppliersData);
      
    } catch (error) {
      console.error('❌ Erreur chargement fournisseurs:', error);
      Alert.alert('Erreur', 'Impossible de charger les fournisseurs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fonction pour récupérer les catégories depuis Firestore
  const fetchCategories = async () => {
    try {
      const categoriesQuery = query(collection(db, 'categories'), limit(20));
      const querySnapshot = await getDocs(categoriesQuery);
      const categoriesData: Category[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        categoriesData.push({
          id: doc.id,
          name: data.name,
          icon: data.icon || 'grid',
          productCount: data.productCount || 0,
          supplierCount: data.supplierCount || 0,
        });
      });
      
      if (categoriesData.length > 0) {
        setCategories(categoriesData);
      }
    } catch (error) {
      console.error('Erreur chargement catégories:', error);
      // On garde les catégories statiques en cas d'erreur
    }
  };

  useEffect(() => {
    fetchSuppliers();
    fetchCategories();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSuppliers();
  }, [selectedCategory]);

  // Fonction pour changer de catégorie
  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setLoading(true);
    fetchSuppliers(categoryId);
  };

  // Fonction pour gérer les clics sur les services
  const handleServicePress = (service: B2BService) => {
    if (service.requiresAuth && !auth.currentUser) {
      setSelectedService(service);
      setAuthModalVisible(true);
      return;
    }

    // Navigation dynamique selon le service
    switch (service.id) {
      case 'request_quote':
        setQuoteModalVisible(true);
        break;
      case 'online_showroom':
        router.push('/showrooms');
        break;
      case 'exhibition_hall':
        router.push('/exhibitions');
        break;
      case 'image_search':
        router.push('/image-search');
        break;
      case 'logistics':
        router.push('/logistics');
        break;
      case 'inspection':
        router.push('/inspection');
        break;
      default:
        Alert.alert('Service', `Accès au service: ${service.name}`);
        break;
    }
  };

  // Fonction pour demander un devis
  const handleRequestQuote = (supplier: Supplier) => {
    if (!auth.currentUser) {
      setSelectedSupplier(supplier);
      setAuthModalVisible(true);
      return;
    }
    setSelectedSupplier(supplier);
    setQuoteModalVisible(true);
  };

  // Gestion de l'authentification
  const handleLogin = () => {
    setAuthModalVisible(false);
    router.push('/auth/login');
  };

  const handleRegister = () => {
    setAuthModalVisible(false);
    router.push('/auth/register');
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar backgroundColor="#ff6a00" barStyle="light-content" />
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement des fournisseurs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#ff6a00" barStyle="light-content" />
      
      <FlatList
        data={suppliers}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#ff6a00" 
          />
        }
        ListHeaderComponent={
          <>
            <SearchHeader />
            
            {/* Bannière promo */}
            <View style={styles.promoBanner}>
              <Text style={styles.promoText}>
                ✅ Fournisseurs vérifiés • 🚚 Livraison garantie • 💰 Meilleurs prix
              </Text>
            </View>

            <ServicesSection 
              services={B2B_SERVICES}
              onServicePress={handleServicePress}
              userType={userType}
            />

            {/* Filtres de catégories */}
            <CategoryFilters 
              selectedCategory={selectedCategory} 
              onSelectCategory={handleCategorySelect}
              categories={categories}
            />

            {/* En-tête fournisseurs */}
            <View style={styles.suppliersHeader}>
              <Text style={styles.sectionTitle}>
                {suppliers.length} Fournisseur{suppliers.length > 1 ? 's' : ''}
                {selectedCategory !== 'all' && ` - ${categories.find(c => c.id === selectedCategory)?.name}`}
              </Text>
              <TouchableOpacity onPress={() => router.push('/suppliers/filters')}>
                <Text style={styles.filterText}>Filtres</Text>
              </TouchableOpacity>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <SupplierCard 
            supplier={item} 
            onRequestQuote={handleRequestQuote}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={60} color="#ccc" />
            <Text style={styles.emptyTitle}>Aucun fournisseur trouvé</Text>
            <Text style={styles.emptyText}>
              {selectedCategory !== 'all' 
                ? `Aucun fournisseur dans la catégorie "${categories.find(c => c.id === selectedCategory)?.name}"`
                : 'Soyez le premier à rejoindre notre plateforme !'}
            </Text>
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => router.push('/become-supplier')}
            >
              <Text style={styles.createButtonText}>Devenir fournisseur</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={<View style={styles.spacer} />}
        contentContainerStyle={styles.listContent}
      />

      {/* Modals */}
      <AuthRequiredModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        serviceName={selectedService?.name || selectedSupplier?.name || "ce service"}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />

      <QuoteRequestModal
        visible={quoteModalVisible}
        onClose={() => setQuoteModalVisible(false)}
        supplierId={selectedSupplier?.id}
        supplierName={selectedSupplier?.name}
      />
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#333',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 30,
  },
  spacer: {
    height: 100,
  },

  // Header
  header: {
    backgroundColor: "#fff",
    paddingTop: Constants.statusBarHeight + 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1a1a1a",
    marginBottom: 12,
    textAlign: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    marginRight: 8,
    height: 44,
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 8,
    fontSize: 16,
    color: "#1a1a1a",
  },
  cameraButton: {
    padding: 4,
  },
  searchButton: {
    backgroundColor: "#ff6a00",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
  },
  searchButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  becomeSupplierButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  becomeSupplierText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },

  // Bannière promo
  promoBanner: {
    backgroundColor: "#ff6a00",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  promoText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  // Services
  servicesSection: {
    padding: 16,
    backgroundColor: "#fff",
  },
  servicesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  seeAllText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: '600',
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  serviceItem: {
    width: (width - 48) / 3,
    alignItems: "center",
    marginBottom: 16,
  },
  serviceIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  serviceLabel: {
    fontSize: 12,
    color: "#333",
    textAlign: "center",
    fontWeight: '500',
  },

  // Filtres Catégories
  categoryContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginLeft: 16,
    marginBottom: 8,
  },
  categoryScrollView: {
    paddingLeft: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  activeCategoryItem: {
    backgroundColor: '#ff6a00',
    borderColor: '#ff6a00',
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginLeft: 4,
  },
  activeCategoryText: {
    color: '#fff',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
  },

  // En-tête fournisseurs
  suppliersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  filterText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },

  // Carte Fournisseur
  supplierCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
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
  supplierHeader: {
    marginBottom: 12,
  },
  supplierInfo: {
    flexDirection: "row",
  },
  supplierLogo: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#f0f0f0',
  },
  supplierTextInfo: {
    flex: 1,
  },
  supplierNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
  },
  verifiedBadge: {
    backgroundColor: "#e7f7ef",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  verifiedText: {
    fontSize: 10,
    color: "#00a650",
    fontWeight: "600",
  },
  goldBadge: {
    backgroundColor: "#fff8e6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  goldText: {
    fontSize: 10,
    color: "#ffa500",
    fontWeight: "600",
  },
  supplierName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    flex: 1,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  categoryButtonText: {
    fontSize: 10,
    color: '#ff6a00',
    fontWeight: '600',
    marginLeft: 4,
  },
  supplierDetails: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  supplierStats: {
    fontSize: 12,
    color: "#00a650",
    fontWeight: "600",
  },
  supplierDescription: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 8,
  },
  mainProducts: {
    fontSize: 12,
    color: "#666",
    fontStyle: 'italic',
    marginBottom: 12,
  },
  supplierStatsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#f0f0f0",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: "#666",
    marginTop: 2,
    textAlign: 'center',
  },
  supplierActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ff6a00',
    borderRadius: 6,
  },
  contactButtonText: {
    color: '#ff6a00',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  quoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
  },
  quoteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  viewProductsButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ff6a00',
    borderRadius: 6,
  },
  viewProductsText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#ff6a00',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalRegisterText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal Devis
  quoteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  supplierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  supplierInfoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  formGroup: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.5,
  },
});