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
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import LoginModal from '@/components/account/LoginModal';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
import { getLocalizedProductText } from '@/utils/productLocale';

const { width: screenWidth } = Dimensions.get('window');

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

type NormalizedRole = 'super-admin' | 'admin' | 'seller' | 'customer' | 'visitor';

const normalizeRole = (role: unknown): NormalizedRole => {
  const raw = String(role ?? '').trim().toLowerCase();
  if (['super-admin', 'super_admin', 'superadmin', 'super admin'].includes(raw)) return 'super-admin';
  if (raw === 'admin') return 'admin';
  if (raw === 'seller') return 'seller';
  if (raw === 'customer') return 'customer';
  return 'visitor';
};

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  
  // loading: état global du contexte (si disponible) pour savoir si le profil est en cours de chargement
  const { 
    user, 
    userRole, 
    userProfile, 
    logout, 
    login,
    isSuperAdmin,
    isAdmin,
    isSeller,
    loading: authLoading 
  } = useAuth() as any;
  
  const { orders } = useOrders() as any;
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [proModalVisible, setProModalVisible] = useState(false);
  const [emailForReset, setEmailForReset] = useState('');
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);

  const router = useRouter();

  // Détermination robuste des rôles
  const rawRole = userProfile?.role || userRole;
  const normalizedRole = normalizeRole(rawRole);
  
  const isSuperAdminRole = isSuperAdmin === true || normalizedRole === 'super-admin';
  const isAdminRole = isAdmin === true || isSuperAdminRole || normalizedRole === 'admin';
  const isSellerRole = isSeller === true || normalizedRole === 'seller';

  useEffect(() => {
    if (user?.email) setEmailForReset(user.email);
  }, [user]);

  useEffect(() => {
    const fetchTrendingProducts = async () => {
      try {
        setLoadingProducts(true);
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

        setTrendingProducts(products);
      } catch (error) {
        console.error('Error fetching trending products:', error);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchTrendingProducts();
  }, []);

  // 🔄 Si l'authentification ou le profil Firestore est encore en cours de chargement, on affiche un loader
  // Cela évite de calculer prématurément un rôle 'customer' par défaut
  if (authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  const handleProAction = (type: 'dash_std' | 'dash_prem') => {
    setProModalVisible(false);
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    if (type === 'dash_std' || type === 'dash_prem') {
      router.push('/suppliers/dashboard');
    }
  };

  const handleForgotPassword = async () => {
    if (!emailForReset) {
      Alert.alert(t('app.account.errorTitle'), t('app.account.forgotEmailError'));
      return;
    }
    try {
      await sendPasswordResetEmail(auth, emailForReset);
      Alert.alert(t('app.account.successTitle'), t('app.account.forgotSuccess'));
    } catch (error) {
      Alert.alert(t('app.account.errorTitle'), t('app.account.forgotError'));
    }
  };

  const handleLoginFromProModal = async () => {
    if (!loginEmail || !loginPassword) {
      Alert.alert(t('app.account.errorTitle'), t('app.account.loginFieldsError'));
      return;
    }
    setLoadingLogin(true);
    try {
      await login(loginEmail, loginPassword);
      setProModalVisible(false);
    } catch (error: any) {
      Alert.alert(t('app.account.loginErrorTitle'), error?.message || t('app.account.invalidCredentials'));
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setProModalVisible(false);
    } catch (error) {
      Alert.alert(t('app.account.errorTitle'), t('app.account.logoutError'));
    }
  };

  const navigateToOrders = () => { if (!user) { setLoginModalVisible(true); return; } router.push('/orders'); };
  const navigateToMessages = () => { if (!user) { setLoginModalVisible(true); return; } router.push('/(tabs)/messages'); };
  const navigateToPayment = () => { if (!user) { setLoginModalVisible(true); return; } router.push('/payment'); };
  const navigateToFavorites = () => { if (!user) { setLoginModalVisible(true); return; } router.push('/favorites'); };
  const navigateToProductDetail = (id: string) => router.push(`/product/${id}`);
  const openProfileSettings = () => { if (!user) { setLoginModalVisible(true); return; } router.push('/profile/edit'); };

  const ProfileHeader = () => {
    const getRoleLabel = () => {
      return t(`app.account.roles.${normalizedRole}`, { defaultValue: normalizedRole });
    };

    return (
      <View style={profileStyles.container}>
        <LinearGradient colors={['#FFFFFF', '#F8F9FA']} style={profileStyles.gradient}>
          <View style={profileStyles.content}>
            <View style={profileStyles.avatarSection}>
              <TouchableOpacity style={profileStyles.avatarTouchable} onPress={openProfileSettings} activeOpacity={0.75}>
                <View style={profileStyles.avatarContainer}>
                  {user?.photoURL ? (
                    <Image source={{ uri: user.photoURL }} style={profileStyles.avatarImage} resizeMode="cover" />
                  ) : (
                    <LinearGradient colors={['#FF6B00', '#FF9800']} style={profileStyles.avatar}>
                      <FontAwesome5 name="user" size={28} color="white" />
                    </LinearGradient>
                  )}
                  {user && <View style={profileStyles.onlineIndicator} />}
                </View>
              </TouchableOpacity>
              
              <View style={profileStyles.userInfo}>
                <Text style={profileStyles.userName}>
                  {user ? userProfile?.displayName || user.email?.split('@')[0] : t('app.account.guest')}
                </Text>
                <View style={profileStyles.roleContainer}>
                  <Text style={profileStyles.userRole}>
                    {user ? getRoleLabel() : t('app.account.notConnected')}
                  </Text>
                </View>
              </View>

              {!user && (
                <TouchableOpacity style={profileStyles.loginButton} onPress={() => setLoginModalVisible(true)}>
                  <Text style={profileStyles.loginText}>{t('app.messages.signIn')}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FF6B00" />
                </TouchableOpacity>
              )}
            </View>

            {user && (
              <TouchableOpacity style={profileStyles.profileLinkRow} onPress={openProfileSettings} activeOpacity={0.7}>
                <Ionicons name="person-circle-outline" size={22} color="#FF6B00" />
                <Text style={profileStyles.profileLinkText}>{t('app.account.profileSettings')}</Text>
                <Ionicons name="chevron-forward" size={20} color="#CCC" />
              </TouchableOpacity>
            )}

            {user && (
              <View style={profileStyles.statsContainer}>
                <TouchableOpacity style={profileStyles.statItem} onPress={navigateToFavorites}>
                  <Text style={profileStyles.statValue}>0</Text>
                  <Text style={profileStyles.statLabel}>{t('app.account.favorites')}</Text>
                </TouchableOpacity>
                <View style={profileStyles.statDivider} />
                <TouchableOpacity style={profileStyles.statItem} onPress={navigateToOrders}>
                  <Text style={profileStyles.statValue}>{orders?.length || 0}</Text>
                  <Text style={profileStyles.statLabel}>Commandes</Text>
                </TouchableOpacity>
                <View style={profileStyles.statDivider} />
                <TouchableOpacity style={profileStyles.statItem} onPress={navigateToMessages}>
                  <Text style={profileStyles.statValue}>0</Text>
                  <Text style={profileStyles.statLabel}>{t('app.account.messages')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  };

  const SellerSection = () => {
    const showSeller = isSellerRole || isAdminRole || isSuperAdminRole;
    return (
      <View style={sellerStyles.container}>
        <LinearGradient colors={showSeller ? ['#FFF9F0', '#FFFFFF'] : ['#F8F9FA', '#FFFFFF']} style={sellerStyles.gradient}>
          <View style={sellerStyles.header}>
            <View style={sellerStyles.titleContainer}>
              <View style={sellerStyles.iconContainer}>
                <MaterialIcons name={showSeller ? "store" : "storefront"} size={22} color="#FF6B00" />
              </View>
              <Text style={sellerStyles.title}>{t('app.account.sellerSpaceTitle')}</Text>
            </View>
          </View>

          {showSeller ? (
            <View style={sellerStyles.sellerContent}>
              <Text style={sellerStyles.welcomeText}>{t('app.account.sellerWelcome')}</Text>
              <View style={sellerStyles.actionsGrid}>
                <TouchableOpacity style={sellerStyles.actionCard} onPress={() => setProModalVisible(true)} activeOpacity={0.7}>
                  <View style={[sellerStyles.actionIcon, { backgroundColor: '#FFF0E6' }]}>
                    <Ionicons name="grid-outline" size={24} color="#FF6B00" />
                  </View>
                  <Text style={sellerStyles.actionTitle}>{t('app.account.sellerDashboards')}</Text>
                  <Text style={sellerStyles.actionSubtitle}>{t('app.account.sellerManageSales')}</Text>
                </TouchableOpacity>

                {(isAdminRole || isSuperAdminRole) && (
                  <TouchableOpacity
                    style={sellerStyles.actionCard}
                    onPress={() => router.push(isSuperAdminRole ? '/super-admin/dashboard' : '/admin/dashboard')}
                    activeOpacity={0.7}
                  >
                    <View style={[sellerStyles.actionIcon, { backgroundColor: '#FFEDEE' }]}>
                      <Ionicons name="shield-checkmark-outline" size={24} color="#FF4444" />
                    </View>
                    <Text style={sellerStyles.actionTitle}>{t('app.account.superAdminTitle')}</Text>
                    <Text style={sellerStyles.actionSubtitle}>{t('app.account.superAdminCardTitle')}</Text>
                  </TouchableOpacity>
                )}

                {(isSellerRole || isSuperAdminRole) && (
                  <TouchableOpacity style={sellerStyles.actionCard} onPress={() => router.push('/seller/add-product')} activeOpacity={0.7}>
                    <View style={[sellerStyles.actionIcon, { backgroundColor: '#E8F0FE' }]}>
                      <Ionicons name="add-circle-outline" size={24} color="#2196F3" />
                    </View>
                    <Text style={sellerStyles.actionTitle}>{t('app.account.addProduct')}</Text>
                    <Text style={sellerStyles.actionSubtitle}>{t('app.account.newListing')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={sellerStyles.nonSellerContent}>
              <Text style={sellerStyles.description}>{t('app.account.sellerPitch')}</Text>
              <View style={sellerStyles.benefitsList}>
                <View style={sellerStyles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={sellerStyles.benefitText}>{t('app.account.benefitCommission')}</Text>
                </View>
                <View style={sellerStyles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={sellerStyles.benefitText}>{t('app.account.benefitSupport')}</Text>
                </View>
                <View style={sellerStyles.benefitItem}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={sellerStyles.benefitText}>{t('app.account.sellerBenefitTools')}</Text>
                </View>
              </View>
              <TouchableOpacity style={sellerStyles.ctaButton} onPress={() => !user ? setLoginModalVisible(true) : router.push('/suppliers')} activeOpacity={0.8}>
                <LinearGradient colors={['#FF6B00', '#FF9800']} style={sellerStyles.ctaGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={sellerStyles.ctaText}>{t('app.account.sellerBecome')}</Text>
                  <Ionicons name="arrow-forward" size={18} color="white" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </LinearGradient>
      </View>
    );
  };

  const SuperAdminSection = () => {
    if (!isSuperAdminRole) return null;
    return (
      <View style={superAdminStyles.container}>
        <LinearGradient colors={['#FFF0F0', '#FFFFFF']} style={superAdminStyles.gradient}>
          <View style={superAdminStyles.header}>
            <View style={superAdminStyles.titleContainer}>
              <View style={superAdminStyles.iconContainer}>
                <Ionicons name="shield" size={22} color="#FF4444" />
              </View>
              <Text style={superAdminStyles.title}>{t('app.account.superAdminTitle')}</Text>
            </View>
          </View>
          <TouchableOpacity style={superAdminStyles.dashboardCard} onPress={() => router.push('/super-admin/dashboard')} activeOpacity={0.7}>
            <View style={superAdminStyles.cardContent}>
              <View style={superAdminStyles.cardIcon}>
                <Ionicons name="stats-chart" size={28} color="#FF4444" />
              </View>
              <View style={superAdminStyles.cardText}>
                <Text style={superAdminStyles.cardTitle}>{t('app.account.superAdminCardTitle')}</Text>
                <Text style={superAdminStyles.cardSubtitle}>{t('app.account.superAdminCardSubtitle')}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FF4444" />
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  };

  const ServicesSection = () => {
    const services: { icon: IoniconsName; title: string; color: string; count: number | null; onPress: () => void }[] = [
      { icon: 'cube-outline', title: 'Commandes', color: '#4CAF50', count: user ? (orders?.length || 0) : 0, onPress: navigateToOrders },
      { icon: 'chatbubble-outline', title: 'Messages', color: '#2196F3', count: 0, onPress: navigateToMessages },
      { icon: 'card-outline', title: 'Paiement', color: '#FF9800', count: null, onPress: navigateToPayment },
    ];
    if (isAdminRole || isSuperAdminRole) {
      services.unshift({
        icon: 'shield-checkmark-outline',
        title: isSuperAdminRole ? t('app.account.superAdminTitle') : 'Admin',
        color: '#FF4444',
        count: null,
        onPress: () => router.push(isSuperAdminRole ? '/super-admin/dashboard' : '/admin/dashboard'),
      });
    }
    return (
      <View style={servicesStyles.container}>
        <Text style={servicesStyles.sectionTitle}>{t('app.account.servicesTitle')}</Text>
        <View style={servicesStyles.servicesGrid}>
          {services.map((service, index) => (
            <TouchableOpacity key={index} style={servicesStyles.serviceCard} onPress={service.onPress} activeOpacity={0.7}>
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

  const ProductsSection = () => {
    if (loadingProducts) {
      return (
        <View style={productsStyles.container}>
          <Text style={productsStyles.title}>{t('app.account.trendingTitle')}</Text>
          <View style={productsStyles.loadingContainer}><ActivityIndicator size="large" color="#FF6B00" /></View>
        </View>
      );
    }
    if (trendingProducts.length === 0) {
      return (
        <View style={productsStyles.container}>
          <Text style={productsStyles.title}>{t('app.account.trendingTitle')}</Text>
          <View style={productsStyles.emptyContainer}>
            <Ionicons name="image-outline" size={48} color="#CCC" />
            <Text style={productsStyles.emptyText}>{t('app.account.noProducts')}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={productsStyles.container}>
        <View style={productsStyles.header}>
          <Text style={productsStyles.title}>{t('app.account.trendingTitle')}</Text>
          <TouchableOpacity><Text style={productsStyles.seeAllText}>{t('app.account.seeAll')}</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={productsStyles.scrollContent}>
          {trendingProducts.map((product) => (
            <TouchableOpacity key={product.id} style={productsStyles.productCard} onPress={() => navigateToProductDetail(product.id)} activeOpacity={0.8}>
              <View style={productsStyles.imageContainer}>
                {product.mainImage ? (
                  <Image source={{ uri: product.mainImage }} style={productsStyles.productImage} resizeMode="cover" />
                ) : (
                  <View style={productsStyles.imagePlaceholder}><Ionicons name="image-outline" size={30} color="#DDD" /></View>
                )}
              </View>
              <View style={productsStyles.productInfo}>
                <Text style={productsStyles.productName} numberOfLines={2}>
                  {getLocalizedProductText(product.name, 'name', product as unknown as Record<string, unknown>, i18n.language)}
                </Text>
                <Text style={productsStyles.supplierName} numberOfLines={1}>{product.companyName}</Text>
                <Text style={productsStyles.productPrice}>{product.price.toLocaleString()} FCFA</Text>
                <TouchableOpacity style={productsStyles.addButton}>
                  <Ionicons name="cart-outline" size={16} color="#FF6B00" />
                  <Text style={productsStyles.addButtonText}>{t('app.account.addToCart')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const hasAuthorizedRole = user && (isSellerRole || isAdminRole || isSuperAdminRole);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FA" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <ProfileHeader />
        <SellerSection />
        <SuperAdminSection />
        <ServicesSection />
        <ProductsSection />
      </ScrollView>

      <LoginModal visible={loginModalVisible} onClose={() => setLoginModalVisible(false)} />

      <Modal visible={proModalVisible} transparent animationType="fade" onRequestClose={() => setProModalVisible(false)}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('app.account.sellerSpaceTitle')}</Text>
              <TouchableOpacity onPress={() => setProModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>
            
            {!user && (
              <View style={styles.modalBody}>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    style={styles.modalInput}
                    placeholder={t('app.account.emailPlaceholder')}
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
                    placeholder={t('app.account.passwordPlaceholder')}
                    placeholderTextColor="#999"
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    secureTextEntry
                  />
                </View>
                <TouchableOpacity style={[styles.loginButton, loadingLogin && styles.disabledButton]} onPress={handleLoginFromProModal} disabled={loadingLogin}>
                  {loadingLogin ? <ActivityIndicator color="white" /> : <Text style={styles.loginButtonText}>{t('app.messages.signIn')}</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotButton}>
                  <Text style={styles.forgotPassText}>{t('app.account.forgotPasswordQuestion')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {user && !hasAuthorizedRole && (
              <View style={styles.unauthorizedContainer}>
                <View style={styles.errorIconContainer}><MaterialIcons name="error-outline" size={60} color="#FF6B00" /></View>
                <Text style={styles.unauthorizedTitle}>{t('app.account.unauthorizedModalTitle')}</Text>
                <Text style={styles.unauthorizedText}>{t('app.account.unauthorizedModalMessage', { role: rawRole ?? '' })}</Text>
                <TouchableOpacity style={styles.modalCloseButton} onPress={() => setProModalVisible(false)}>
                  <Text style={styles.modalCloseButtonText}>{t('app.account.close')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {user && hasAuthorizedRole && (
              <View style={styles.modalBody}>
                {(isAdminRole || isSuperAdminRole) && (
                  <TouchableOpacity
                    style={styles.dashboardChoice}
                    onPress={() => { setProModalVisible(false); router.push(isSuperAdminRole ? '/super-admin/dashboard' : '/admin/dashboard'); }}
                  >
                    <View style={[styles.choiceIcon, { backgroundColor: '#FFEDEE' }]}><Ionicons name="shield-checkmark-outline" size={28} color="#FF4444" /></View>
                    <View style={styles.choiceContent}>
                      <Text style={styles.choiceTitle}>{t('app.account.superAdminTitle')}</Text>
                      <Text style={styles.choiceSubtitle}>{t('app.account.superAdminCardSubtitle')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#FF4444" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.dashboardChoice} onPress={() => handleProAction('dash_std')}>
                  <View style={[styles.choiceIcon, { backgroundColor: '#FFF0E6' }]}><Ionicons name="business" size={28} color="#FF6B00" /></View>
                  <View style={styles.choiceContent}>
                    <Text style={styles.choiceTitle}>{t('app.account.dashboardStandardTitle')}</Text>
                    <Text style={styles.choiceSubtitle}>{t('app.account.dashboardStandardSubtitle')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#FF6B00" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { paddingBottom: 30 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 16, width: '100%', maxWidth: 400, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  modalClose: { padding: 4 },
  modalBody: { width: '100%' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#DDD', borderRadius: 8, marginBottom: 12, paddingHorizontal: 10, backgroundColor: '#FAFAFA' },
  inputIcon: { marginRight: 8 },
  modalInput: { flex: 1, height: 45, fontSize: 15, color: '#333' },
  loginButton: { backgroundColor: '#FF6B00', height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8, flexDirection: 'row' },
  loginButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  disabledButton: { opacity: 0.7 },
  forgotButton: { alignItems: 'center', marginTop: 14 },
  forgotPassText: { color: '#666', fontSize: 14 },
  unauthorizedContainer: { alignItems: 'center', paddingVertical: 10 },
  errorIconContainer: { marginBottom: 14 },
  unauthorizedTitle: { fontSize: 18, fontWeight: 'bold', color: '#222', marginBottom: 8 },
  unauthorizedText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20, paddingHorizontal: 10 },
  modalCloseButton: { backgroundColor: '#FF6B00', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
  modalCloseButtonText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  dashboardChoice: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFA', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#EEE' },
  choiceIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  choiceContent: { flex: 1 },
  choiceTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  choiceSubtitle: { fontSize: 12, color: '#777', marginTop: 2 }
});

const profileStyles = StyleSheet.create({
  container: { margin: 16, borderRadius: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  gradient: { padding: 16 },
  content: { width: '100%' },
  avatarSection: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  avatarTouchable: { activeOpacity: 0.75 },
  avatarContainer: { position: 'relative' },
  avatarImage: { width: 64, height: 64, borderRadius: 32 },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  onlineIndicator: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#4CAF50', borderWidth: 2, borderColor: 'white' },
  userInfo: { marginLeft: 16, flex: 1 },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  roleContainer: { marginTop: 4 },
  userRole: { fontSize: 13, color: '#666' },
  loginButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF0E6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  loginText: { color: '#FF6B00', fontWeight: '600', marginRight: 4, fontSize: 13 },
  profileLinkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderColor: '#EEE' },
  profileLinkText: { flex: 1, marginLeft: 10, fontSize: 14, color: '#444', fontWeight: '500' },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 16, backgroundColor: '#FAFAFA', paddingVertical: 12, borderRadius: 12 },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  statLabel: { fontSize: 12, color: '#777', marginTop: 2 },
  statDivider: { width: 1, height: 24, backgroundColor: '#EAEAEA' }
});

const sellerStyles = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6 },
  gradient: { padding: 16 },
  header: { marginBottom: 12 },
  titleContainer: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { marginRight: 8 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#222' },
  sellerContent: { width: '100%' },
  welcomeText: { fontSize: 13, color: '#666', marginBottom: 12 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  actionCard: { backgroundColor: 'white', width: '48%', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F0F0F0', alignItems: 'center' },
  actionIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionTitle: { fontSize: 14, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  actionSubtitle: { fontSize: 11, color: '#777', marginTop: 2, textAlign: 'center' },
  nonSellerContent: { width: '100%', paddingVertical: 8 },
  description: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 16 },
  benefitsList: { marginBottom: 20 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  benefitText: { marginLeft: 8, fontSize: 13, color: '#444' },
  ctaButton: { borderRadius: 10, overflow: 'hidden' },
  ctaGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20 },
  ctaText: { color: 'white', fontSize: 15, fontWeight: 'bold', marginRight: 8 }
});

const superAdminStyles = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6 },
  gradient: { padding: 16 },
  header: { marginBottom: 12 },
  titleContainer: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { marginRight: 8 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#FF4444' },
  dashboardCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#FFEBEB', justifyContent: 'space-between' },
  cardContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cardIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFEDEE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#222' },
  cardSubtitle: { fontSize: 12, color: '#666', marginTop: 2 }
});

const servicesStyles = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#222', marginBottom: 12 },
  servicesGrid: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'white', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0' },
  serviceCard: { alignItems: 'center', flex: 1 },
  iconWrapper: { position: 'relative', width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  countBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  countText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  serviceTitle: { fontSize: 13, color: '#444', fontWeight: '500' }
});

const productsStyles = StyleSheet.create({
  container: { marginBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  title: { fontSize: 17, fontWeight: 'bold', color: '#222' },
  seeAllText: { fontSize: 13, color: '#FF6B00', fontWeight: '600' },
  scrollContent: { paddingHorizontal: 16 },
  productCard: { backgroundColor: 'white', width: screenWidth * 0.42, marginRight: 12, borderRadius: 14, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden' },
  imageContainer: { width: '100%', height: screenWidth * 0.38, backgroundColor: '#FAFAFA' },
  productImage: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  productInfo: { padding: 10 },
  productName: { fontSize: 13, fontWeight: '600', color: '#333', height: 36, lineHeight: 18 },
  supplierName: { fontSize: 11, color: '#888', marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: 'bold', color: '#FF6B00', marginTop: 4 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFE6D5', borderRadius: 8, paddingVertical: 6, marginTop: 10, backgroundColor: '#FFFBF8' },
  addButtonText: { color: '#FF6B00', fontSize: 11, fontWeight: '600', marginLeft: 4 },
  loadingContainer: { paddingVertical: 40, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { paddingVertical: 40, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#999', fontSize: 14, marginTop: 8 }
});