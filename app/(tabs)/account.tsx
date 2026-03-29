import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import LoginModal from '@/components/account/LoginModal';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width: screenWidth } = Dimensions.get('window');

// Types pour les icônes
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  mainImage: string;
  imageUrl?: string;
  rating: number;
  soldCount: number;
  trending?: boolean;
  featured?: boolean;
  specialOffer?: boolean;
  companyName: string;
}

export default function AccountScreen() {
  const { user, userRole, logout, login } = useAuth();
  const { orders } = useOrders() as any;
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [proModalVisible, setProModalVisible] = useState(false);
  const [emailForReset, setEmailForReset] = useState('');
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Nouveaux états pour le portail sécurisé
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    if (user?.email) setEmailForReset(user.email);
  }, [user]);

  // Charger les produits tendances
  useEffect(() => {
    const fetchTrendingProducts = async () => {
      try {
        setLoading(true);
        
        const productsRef = collection(db, 'products');
        const q = query(
          productsRef,
          where('trending', '==', true),
          where('status', '==', 'published'),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
          limit(20)
        );

        const querySnapshot = await getDocs(q);
        const products: Product[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          products.push({
            id: doc.id,
            name: data.name || '',
            price: data.price || 0,
            originalPrice: data.originalPrice || data.price || 0,
            mainImage: data.mainImage || data.imageUrl || '',
            imageUrl: data.imageUrl || data.mainImage || '',
            rating: data.rating || 0,
            soldCount: data.soldCount || 0,
            trending: data.trending || false,
            featured: data.featured || false,
            specialOffer: data.specialOffer || false,
            companyName: data.companyName || data.supplier || '',
          });
        });

        setTrendingProducts(products.slice(0, 20));
      } catch (error) {
        console.error('Error fetching trending products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingProducts();
  }, []);

  // --- LOGIQUE DE NAVIGATION VENDEUR ---
  const handleProAction = (type: 'dash_std' | 'dash_prem') => {
    setProModalVisible(false);
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    if (type === 'dash_std') {
      router.push('/suppliers/dashboard');
    } else {
      router.push('/seller/dashboard');
    }
  };

  const handleForgotPassword = async () => {
    if (!emailForReset) {
      Alert.alert("Erreur", "Veuillez entrer votre adresse email.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, emailForReset);
      Alert.alert("Succès", "Lien de réinitialisation envoyé.");
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'envoyer l'email.");
    }
  };

  // Fonction de connexion depuis le modal
  const handleLoginFromProModal = async () => {
    if (!loginEmail || !loginPassword) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs");
      return;
    }
    
    setLoadingLogin(true);
    try {
      await login(loginEmail, loginPassword);
      setProModalVisible(false);
    } catch (error: any) {
      Alert.alert("Erreur de connexion", error.message || "Identifiants incorrects");
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setProModalVisible(false);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de se déconnecter");
    }
  };

  // Navigation standard
  const navigateToOrders = () => { if (!user) { setLoginModalVisible(true); return; } router.push('/orders'); };
  const navigateToMessages = () => { if (!user) { setLoginModalVisible(true); return; } router.push('/(tabs)/messages'); };
  const navigateToPayment = () => { if (!user) { setLoginModalVisible(true); return; } router.push('/payment'); };
  const navigateToFavorites = () => { if (!user) { setLoginModalVisible(true); return; } router.push('/favorites'); };
  const navigateToProductDetail = (id: string) => router.push(`/product/${id}`);
  const navigateToBecomeSeller = () => { if (!user) { setLoginModalVisible(true); return; } router.push('/suppliers'); };
  const navigateToSellerDashboard = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    if (userRole === 'super-admin') {
      router.push('/super-admin/dashboard');
    } else if (userRole === 'admin') {
      router.push('/admin/dashboard');
    } else if (userRole === 'seller') {
      router.push('/seller/dashboard');
    } else {
      Alert.alert('Accès limité', 'Cette fonctionnalité est réservée aux vendeurs et administrateurs');
    }
  };

  // Composant Profile Header amélioré - DESIGN ÉPURÉ
  const ProfileHeader = () => {
    const handleLogout = () => {
      Alert.alert(
        'Déconnexion',
        'Êtes-vous sûr de vouloir vous déconnecter ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Déconnexion', 
            style: 'destructive',
            onPress: () => logout()
          },
        ]
      );
    };

    const getRoleLabel = () => {
      switch (userRole) {
        case 'super-admin': return 'Super Admin';
        case 'admin': return 'Administrateur';
        case 'seller': return 'Vendeur';
        case 'customer': return 'Client';
        default: return 'Visiteur';
      }
    };

    return (
      <View style={profileStyles.container}>
        <LinearGradient
          colors={['#FFFFFF', '#F8F9FA']}
          style={profileStyles.gradient}
        >
          <View style={profileStyles.content}>
            <View style={profileStyles.avatarSection}>
              <View style={profileStyles.avatarContainer}>
                <LinearGradient
                  colors={['#FF6B00', '#FF9800']}
                  style={profileStyles.avatar}
                >
                  <FontAwesome5 name="user" size={28} color="white" />
                </LinearGradient>
                <View style={profileStyles.onlineIndicator} />
              </View>
              
              <View style={profileStyles.userInfo}>
                <Text style={profileStyles.userName}>
                  {user ? user.email?.split('@')[0] : 'Invité'}
                </Text>
                <View style={profileStyles.roleContainer}>
                  <Text style={profileStyles.userRole}>
                    {user ? getRoleLabel() : 'Non connecté'}
                  </Text>
                </View>
              </View>

              {user ? (
                <TouchableOpacity style={profileStyles.logoutButton} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={22} color="#FF6B00" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={profileStyles.loginButton}
                  onPress={() => setLoginModalVisible(true)}
                >
                  <Text style={profileStyles.loginText}>Connexion</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FF6B00" />
                </TouchableOpacity>
              )}
            </View>

            {user && (
              <View style={profileStyles.statsContainer}>
                <TouchableOpacity style={profileStyles.statItem} onPress={navigateToFavorites}>
                  <Text style={profileStyles.statValue}>0</Text>
                  <Text style={profileStyles.statLabel}>Favoris</Text>
                </TouchableOpacity>
                <View style={profileStyles.statDivider} />
                <TouchableOpacity style={profileStyles.statItem} onPress={navigateToOrders}>
                  <Text style={profileStyles.statValue}>{orders?.length || 0}</Text>
                  <Text style={profileStyles.statLabel}>Commandes</Text>
                </TouchableOpacity>
                <View style={profileStyles.statDivider} />
                <TouchableOpacity style={profileStyles.statItem} onPress={navigateToMessages}>
                  <Text style={profileStyles.statValue}>0</Text>
                  <Text style={profileStyles.statLabel}>Messages</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  };

  // Seller Section - DESIGN ÉLÉGANT
  const SellerSection = () => {
    const isSeller = userRole === 'seller' || userRole === 'admin' || userRole === 'super-admin';

    return (
      <View style={sellerStyles.container}>
        <LinearGradient
          colors={isSeller ? ['#FFF9F0', '#FFFFFF'] : ['#F8F9FA', '#FFFFFF']}
          style={sellerStyles.gradient}
        >
          <View style={sellerStyles.header}>
            <View style={sellerStyles.titleContainer}>
              <View style={sellerStyles.iconContainer}>
                <MaterialIcons 
                  name={isSeller ? "store" : "storefront"} 
                  size={22} 
                  color="#FF6B00" 
                />
              </View>
              <Text style={sellerStyles.title}>Espace Vendeur</Text>
            </View>
          </View>

          {isSeller ? (
            <View style={sellerStyles.sellerContent}>
              <Text style={sellerStyles.welcomeText}>
                Bienvenue dans votre espace professionnel
              </Text>
              
              <View style={sellerStyles.actionsGrid}>
                <TouchableOpacity 
                  style={sellerStyles.actionCard}
                  onPress={() => setProModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <View style={[sellerStyles.actionIcon, { backgroundColor: '#FFF0E6' }]}>
                    <Ionicons name="grid-outline" size={24} color="#FF6B00" />
                  </View>
                  <Text style={sellerStyles.actionTitle}>Tableaux de bord</Text>
                  <Text style={sellerStyles.actionSubtitle}>Gérer vos ventes</Text>
                </TouchableOpacity>

                {(userRole === 'seller' || userRole === 'super-admin') && (
                  <TouchableOpacity 
                    style={sellerStyles.actionCard}
                    onPress={() => router.push('/seller/add-product')}
                    activeOpacity={0.7}
                  >
                    <View style={[sellerStyles.actionIcon, { backgroundColor: '#E8F0FE' }]}>
                      <Ionicons name="add-circle-outline" size={24} color="#2196F3" />
                    </View>
                    <Text style={sellerStyles.actionTitle}>Ajouter produit</Text>
                    <Text style={sellerStyles.actionSubtitle}>Nouvelle annonce</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={sellerStyles.nonSellerContent}>
              <Text style={sellerStyles.description}>
                Développez votre activité et atteignez des milliers de clients
              </Text>
              
              <View style={sellerStyles.benefitsList}>
                <View style={sellerStyles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={sellerStyles.benefitText}>Commission compétitive</Text>
                </View>
                <View style={sellerStyles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={sellerStyles.benefitText}>Support prioritaire 24/7</Text>
                </View>
                <View style={sellerStyles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={sellerStyles.benefitText}>Outils de gestion avancés</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={sellerStyles.ctaButton}
                onPress={() => {
                  if (!user) {
                    setLoginModalVisible(true);
                  } else {
                    router.push('/suppliers');
                  }
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FF6B00', '#FF9800']}
                  style={sellerStyles.ctaGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={sellerStyles.ctaText}>Devenir vendeur</Text>
                  <Ionicons name="arrow-forward" size={18} color="white" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  // Super Admin Section - DESIGN PREMIUM
  const SuperAdminSection = () => {
    if (userRole !== 'super-admin') return null;

    return (
      <View style={superAdminStyles.container}>
        <LinearGradient
          colors={['#FFF0F0', '#FFFFFF']}
          style={superAdminStyles.gradient}
        >
          <View style={superAdminStyles.header}>
            <View style={superAdminStyles.titleContainer}>
              <View style={superAdminStyles.iconContainer}>
                <Ionicons name="shield" size={22} color="#FF4444" />
              </View>
              <Text style={superAdminStyles.title}>Administration</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={superAdminStyles.dashboardCard}
            onPress={() => router.push('/super-admin/dashboard')}
            activeOpacity={0.7}
          >
            <View style={superAdminStyles.cardContent}>
              <View style={superAdminStyles.cardIcon}>
                <Ionicons name="stats-chart" size={28} color="#FF4444" />
              </View>
              <View style={superAdminStyles.cardText}>
                <Text style={superAdminStyles.cardTitle}>Tableau de bord Super Admin</Text>
                <Text style={superAdminStyles.cardSubtitle}>
                  Gestion des utilisateurs, produits et paramètres
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FF4444" />
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  };

  // Services Section - DESIGN MODERNE
  const ServicesSection = () => {
    const services: { icon: IoniconsName; title: string; color: string; count: number | null; onPress: () => void }[] = [
      { icon: 'cube-outline', title: 'Commandes', color: '#4CAF50', count: user ? (orders?.length || 0) : 0, onPress: navigateToOrders },
      { icon: 'chatbubble-outline', title: 'Messages', color: '#2196F3', count: 0, onPress: navigateToMessages },
      { icon: 'card-outline', title: 'Paiement', color: '#FF9800', count: null, onPress: navigateToPayment },
    ];

    return (
      <View style={servicesStyles.container}>
        <Text style={servicesStyles.sectionTitle}>Services rapides</Text>
        <View style={servicesStyles.servicesGrid}>
          {services.map((service, index) => (
            <TouchableOpacity 
              key={index}
              style={servicesStyles.serviceCard}
              onPress={service.onPress}
              activeOpacity={0.7}
            >
              <View style={[servicesStyles.iconWrapper, { backgroundColor: service.color + '15' }]}>
                <Ionicons name={service.icon} size={26} color={service.color} />
                {service.count !== null && service.count > 0 && (
                  <View style={[servicesStyles.countBadge, { backgroundColor: service.color }]}>
                    <Text style={servicesStyles.countText}>{service.count}</Text>
                  </View>
                )}
              </View>
              <Text style={servicesStyles.serviceTitle}>{service.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Products Section - DESIGN ÉLÉGANT
  const ProductsSection = () => {
    if (loading) {
      return (
        <View style={productsStyles.container}>
          <View style={productsStyles.header}>
            <Text style={productsStyles.title}>Produits tendances</Text>
          </View>
          <View style={productsStyles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B00" />
          </View>
        </View>
      );
    }

    if (trendingProducts.length === 0) {
      return (
        <View style={productsStyles.container}>
          <View style={productsStyles.header}>
            <Text style={productsStyles.title}>Produits tendances</Text>
          </View>
          <View style={productsStyles.emptyContainer}>
            <Ionicons name="image-outline" size={48} color="#CCC" />
            <Text style={productsStyles.emptyText}>Aucun produit disponible</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={productsStyles.container}>
        <View style={productsStyles.header}>
          <Text style={productsStyles.title}>Produits tendances</Text>
          <TouchableOpacity>
            <Text style={productsStyles.seeAllText}>Voir tout</Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={productsStyles.scrollContent}
        >
          {trendingProducts.map((product) => (
            <TouchableOpacity 
              key={product.id} 
              style={productsStyles.productCard}
              onPress={() => navigateToProductDetail(product.id)}
              activeOpacity={0.8}
            >
              <View style={productsStyles.imageContainer}>
                {product.mainImage ? (
                  <Image 
                    source={{ uri: product.mainImage }} 
                    style={productsStyles.productImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={productsStyles.imagePlaceholder}>
                    <Ionicons name="image-outline" size={30} color="#DDD" />
                  </View>
                )}
              </View>
              
              <View style={productsStyles.productInfo}>
                <Text style={productsStyles.productName} numberOfLines={2}>
                  {product.name}
                </Text>
                
                <Text style={productsStyles.supplierName} numberOfLines={1}>
                  {product.companyName}
                </Text>

                <Text style={productsStyles.productPrice}>
                  {product.price.toLocaleString()} FCFA
                </Text>

                <TouchableOpacity style={productsStyles.addButton}>
                  <Ionicons name="cart-outline" size={16} color="#FF6B00" />
                  <Text style={productsStyles.addButtonText}>Ajouter</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Déterminer si l'utilisateur a un rôle autorisé pour le portail vendeur
  const hasAuthorizedRole = user && (userRole === 'seller' || userRole === 'admin' || userRole === 'super-admin');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <ProfileHeader />
        
        {/* SECTION VENDEUR */}
        <SellerSection />
        
        {/* SECTION SUPER ADMIN */}
        <SuperAdminSection />
        
        {/* SERVICES */}
        <ServicesSection />
        
        {/* PRODUITS TENDANCES */}
        <ProductsSection />
      </ScrollView>

      {/* MODAL DE CHOIX DASHBOARD - DESIGN MODERNE */}
      <Modal visible={proModalVisible} transparent animationType="fade" onRequestClose={() => setProModalVisible(false)}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Espace Vendeur</Text>
              <TouchableOpacity onPress={() => setProModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>
            
            {/* CAS 1 : Utilisateur non connecté */}
            {!user && (
              <View style={styles.modalBody}>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Email"
                    placeholderTextColor="#999"
                    value={loginEmail}
                    onChangeText={setLoginEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Mot de passe"
                    placeholderTextColor="#999"
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    secureTextEntry
                  />
                </View>
                
                <TouchableOpacity 
                  style={[styles.loginButton, loadingLogin && styles.disabledButton]} 
                  onPress={handleLoginFromProModal}
                  disabled={loadingLogin}
                  activeOpacity={0.8}
                >
                  {loadingLogin ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.loginButtonText}>Se connecter</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotButton}>
                  <Text style={styles.forgotPassText}>Mot de passe oublié ?</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* CAS 2 : Utilisateur connecté MAIS rôle non autorisé */}
            {user && !hasAuthorizedRole && (
              <View style={styles.unauthorizedContainer}>
                <View style={styles.errorIconContainer}>
                  <MaterialIcons name="error-outline" size={60} color="#FF6B00" />
                </View>
                <Text style={styles.unauthorizedTitle}>Accès réservé</Text>
                <Text style={styles.unauthorizedText}>
                  Votre compte ({userRole}) n'a pas les autorisations nécessaires pour accéder à l'espace vendeur.
                </Text>
                
                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setProModalVisible(false)}>
                  <Text style={styles.modalCloseButtonText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* CAS 3 : Utilisateur connecté ET autorisé */}
            {user && hasAuthorizedRole && (
              <View style={styles.modalBody}>
                <TouchableOpacity 
                  style={styles.dashboardChoice}
                  onPress={() => handleProAction('dash_std')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.choiceIcon, { backgroundColor: '#FFF0E6' }]}>
                    <Ionicons name="business" size={28} color="#FF6B00" />
                  </View>
                  <View style={styles.choiceContent}>
                    <Text style={styles.choiceTitle}>Fournisseur Standard</Text>
                    <Text style={styles.choiceSubtitle}>Gestion des stocks et commandes</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#FF6B00" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.dashboardChoice}
                  onPress={() => handleProAction('dash_prem')}
                  activeOpacity={0.7}
                >
                  <View style={[styles.choiceIcon, { backgroundColor: '#FFF0E6' }]}>
                    <Ionicons name="star" size={28} color="#FF6B00" />
                  </View>
                  <View style={styles.choiceContent}>
                    <Text style={styles.choiceTitle}>Vendeur Premium</Text>
                    <Text style={styles.choiceSubtitle}>Analyses avancées et promotions</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#FF6B00" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <LoginModal visible={loginModalVisible} onClose={() => setLoginModalVisible(false)} />
    </SafeAreaView>
  );
}

// ==================== STYLES COMPLETS - DESIGN ÉPURÉ ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  modalClose: {
    padding: 4,
  },
  modalBody: {
    padding: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    marginBottom: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  inputIcon: {
    marginRight: 12,
  },
  modalInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  loginButton: {
    backgroundColor: '#FF6B00',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  forgotButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  forgotPassText: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '500',
  },
  unauthorizedContainer: {
    padding: 32,
    alignItems: 'center',
  },
  errorIconContainer: {
    marginBottom: 20,
  },
  unauthorizedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  unauthorizedText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  modalCloseButton: {
    backgroundColor: '#F0F0F0',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  modalCloseButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  dashboardChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  choiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  choiceContent: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  choiceSubtitle: {
    fontSize: 13,
    color: '#999',
  },
});

const profileStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  gradient: {
    borderRadius: 24,
  },
  content: {
    padding: 20,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userRole: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logoutButton: {
    padding: 10,
    backgroundColor: '#FFF0E6',
    borderRadius: 12,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0E6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  loginText: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B00',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: '70%',
    backgroundColor: '#F0F0F0',
    alignSelf: 'center',
  },
});

const sellerStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  gradient: {
    borderRadius: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF0E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  sellerContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 11,
    color: '#999',
  },
  nonSellerContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  benefitsList: {
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 10,
  },
  ctaButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  ctaText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

const superAdminStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  gradient: {
    borderRadius: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFE6E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  dashboardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFE0E0',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFE6E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF4444',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#666',
  },
});

const servicesStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  servicesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  serviceCard: {
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  countBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  serviceTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
});

const productsStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  seeAllText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '500',
  },
  scrollContent: {
    paddingRight: 20,
    gap: 12,
  },
  productCard: {
    width: 160,
    backgroundColor: '#F9F9F9',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  imageContainer: {
    width: '100%',
    height: 130,
    backgroundColor: '#F0F0F0',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    height: 38,
    lineHeight: 18,
  },
  supplierName: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF6B00',
    marginBottom: 10,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0E6',
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF6B00',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});