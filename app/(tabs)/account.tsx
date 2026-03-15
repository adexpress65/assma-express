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

const { width: screenWidth } = Dimensions.get('window');

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
  const { user, userRole, logout } = useAuth();
  const { orders } = useOrders() as any;
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [proModalVisible, setProModalVisible] = useState(false);
  const [emailForReset, setEmailForReset] = useState('');
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (user?.email) setEmailForReset(user.email);
  }, [user]);

  // --- RÉCUPÉRATION DES PRODUITS TENDANCES (TON CODE ORIGINAL) ---
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

  // --- LOGIQUE DE NAVIGATION VENDEUR (CORRIGÉE) ---
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

  // Navigation standard
  const navigateToOrders = () => { if (!user) { setLoginModalVisible(true); return; } router.push('/orders'); };
  const navigateToMessages = () => { if (!user) { setLoginModalVisible(true); return; } router.push('/(tabs)/messages'); };
  const navigateToPayment = () => { if (!user) { setLoginModalVisible(true); return; } router.push('/payment'); };
  const navigateToProductDetail = (id: string) => router.push(`/product/${id}`);

  // --- COMPOSANT PRODUITS (TON STYLE ORIGINAL) ---
  const ProductsSection = () => {
    if (loading) return <Text style={{textAlign: 'center', padding: 20}}>Chargement...</Text>;
    return (
      <View style={productsStyles.container}>
        <Text style={productsStyles.sectionTitle}>Produits Tendances</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={productsStyles.scrollView}>
          {trendingProducts.map((product) => (
            <TouchableOpacity key={product.id} style={productsStyles.productCard} onPress={() => navigateToProductDetail(product.id)}>
              <View style={productsStyles.productImage}>
                <Image source={{ uri: product.mainImage }} style={productsStyles.productImageContent} resizeMode="cover" />
              </View>
              <Text style={productsStyles.productName} numberOfLines={2}>{product.name}</Text>
              <Text style={productsStyles.currentPrice}>{product.price.toLocaleString()} XOF</Text>
              <TouchableOpacity style={productsStyles.addToCartButton}>
                <Ionicons name="cart-outline" size={14} color="#FFF" />
                <Text style={productsStyles.addToCartText}>Ajouter</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={profileStyles.header}>
          <View style={profileStyles.avatar}><FontAwesome5 name="user" size={24} color="white" /></View>
          <View style={profileStyles.userInfo}>
            <Text style={profileStyles.userName}>{user ? user.email : 'Connectez-vous'}</Text>
            <Text style={profileStyles.userLevel}>{userRole === 'super-admin' ? 'Super Admin' : userRole}</Text>
          </View>
        </View>

        {/* BOUTON VENDEUR - REDIRIGE VERS LE MODAL DE CHOIX */}
        <View style={styles.proWrapper}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => setProModalVisible(true)}>
            <LinearGradient colors={['#FF6B00', '#FF9800']} style={styles.proGradient}>
              <MaterialIcons name="storefront" size={28} color="white" />
              <View style={{marginLeft: 15, flex: 1}}>
                <Text style={styles.proTextMain}>Vous êtes vendeur ?</Text>
                <Text style={styles.proTextSub}>Accédez à vos outils de gestion</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Services */}
        <View style={servicesStyles.container}>
          <Text style={servicesStyles.sectionTitle}>Mes Services</Text>
          <View style={servicesStyles.grid}>
             <TouchableOpacity style={servicesStyles.serviceItem} onPress={navigateToOrders}>
               <View style={[servicesStyles.iconContainer, {backgroundColor: '#4CAF5020'}]}><Ionicons name="cube-outline" size={22} color="#4CAF50"/></View>
               <Text style={servicesStyles.serviceTitle}>Commandes</Text>
             </TouchableOpacity>
             <TouchableOpacity style={servicesStyles.serviceItem} onPress={navigateToMessages}>
               <View style={[servicesStyles.iconContainer, {backgroundColor: '#2196F320'}]}><Ionicons name="chatbubble-outline" size={22} color="#2196F3"/></View>
               <Text style={servicesStyles.serviceTitle}>Messages</Text>
             </TouchableOpacity>
             <TouchableOpacity style={servicesStyles.serviceItem} onPress={navigateToPayment}>
               <View style={[servicesStyles.iconContainer, {backgroundColor: '#FF980020'}]}><Ionicons name="card-outline" size={22} color="#FF9800"/></View>
               <Text style={servicesStyles.serviceTitle}>Paiement</Text>
             </TouchableOpacity>
          </View>
        </View>

        {/* SECTION SUPER ADMIN - SEUL LE SUPER-ADMIN LE VOIT */}
        {userRole === 'super-admin' && (
             <View style={sellerStyles.container}>
                <Text style={sellerStyles.title}>Gestion Boutique</Text>
                <TouchableOpacity style={sellerStyles.manageButton} onPress={() => router.push('/super-admin/dashboard')}>
                    <Text style={sellerStyles.manageButtonText}>Tableau de bord SuperAdmin</Text>
                    <Ionicons name="shield-checkmark" size={16} color="#FF6B00" style={{marginLeft: 5}}/>
                </TouchableOpacity>
             </View>
        )}

        <ProductsSection />
      </ScrollView>

      {/* MODAL DE CHOIX DASHBOARD */}
      <Modal visible={proModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Espace Vendeur</Text>
            
            <TouchableOpacity style={styles.choiceButton} onPress={() => handleProAction('dash_std')}>
               <Ionicons name="business" size={24} color="#FF6B00" />
               <Text style={styles.choiceText}>Dashboard Fournisseur (Standard)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.choiceButton} onPress={() => handleProAction('dash_prem')}>
               <Ionicons name="star" size={24} color="#FF6B00" />
               <Text style={styles.choiceText}>Dashboard Vendeur (Premium)</Text>
            </TouchableOpacity>

            <View style={{height: 1, backgroundColor: '#EEE', my: 15}} />
            
            <TextInput style={styles.modalInput} value={emailForReset} onChangeText={setEmailForReset} placeholder="Email pour récupération" />
            <TouchableOpacity onPress={handleForgotPassword}><Text style={styles.forgotPassText}>Mot de passe oublié ?</Text></TouchableOpacity>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setProModalVisible(false)}>
              <Text style={{color: 'white'}}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <LoginModal visible={loginModalVisible} onClose={() => setLoginModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  scrollContent: { paddingBottom: 40 },
  proWrapper: { marginHorizontal: 16, marginTop: 15, borderRadius: 15, overflow: 'hidden', elevation: 3 },
  proGradient: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  proTextMain: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  proTextSub: { color: 'white', fontSize: 12, opacity: 0.8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: 'white', borderRadius: 20, padding: 25 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  choiceButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#EEE' },
  choiceText: { marginLeft: 15, fontWeight: '600', color: '#333' },
  modalInput: { backgroundColor: '#F0F0F0', borderRadius: 10, padding: 12, marginTop: 10 },
  forgotPassText: { color: '#2196F3', textAlign: 'center', marginTop: 10, fontSize: 13 },
  closeBtn: { backgroundColor: '#333', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 20 }
});

// Styles pour les produits (Repris de ton code original)
const productsStyles = StyleSheet.create({
  container: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  scrollView: { paddingBottom: 10 },
  productCard: { width: 160, backgroundColor: 'white', borderRadius: 12, padding: 10, marginRight: 15, elevation: 2 },
  productImage: { width: '140', height: 120, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F0F0F0' },
  productImageContent: { width: '100%', height: '100%' },
  productName: { fontSize: 14, marginVertical: 5, height: 35 },
  currentPrice: { fontSize: 14, fontWeight: 'bold', color: '#FF6B00' },
  addToCartButton: { backgroundColor: '#FF6B00', flexDirection: 'row', padding: 8, borderRadius: 6, marginTop: 8, justifyContent: 'center' },
  addToCartText: { color: 'white', fontSize: 12, marginLeft: 5 }
});

const profileStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: 'white', margin: 16, borderRadius: 15, elevation: 2 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FF6B00', justifyContent: 'center', alignItems: 'center' },
  userInfo: { marginLeft: 15 },
  userName: { fontSize: 18, fontWeight: 'bold' },
  userLevel: { color: '#666' }
});

const servicesStyles = StyleSheet.create({
  container: { backgroundColor: 'white', marginHorizontal: 16, padding: 20, borderRadius: 15, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  serviceItem: { alignItems: 'center' },
  iconContainer: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  serviceTitle: { fontSize: 12 }
});

const sellerStyles = StyleSheet.create({
  container: { backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 15, padding: 20, borderRadius: 15, borderLeftWidth: 4, borderLeftColor: '#FF6B00' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  manageButton: { backgroundColor: '#FFF8F0', padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  manageButtonText: { color: '#FF6B00', fontWeight: 'bold' }
});