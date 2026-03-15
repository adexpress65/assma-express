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
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5, Feather } from '@expo/vector-icons';
import { useOrders } from '@/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import LoginModal from '@/components/account/LoginModal';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/config/firebase';

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
  const { user, userRole, logout } = useAuth();
  const { orders } = useOrders() as any; // Récupère les vraies commandes ici
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Charger les produits tendances - MODIFIÉ: limit à 20
  useEffect(() => {
    const fetchTrendingProducts = async () => {
      try {
        setLoading(true);
        
        // Récupérer les produits avec trending = true
        const productsRef = collection(db, 'products');
        const q = query(
          productsRef,
          where('trending', '==', true),
          where('status', '==', 'published'),
          where('isActive', '==', true),
          orderBy('createdAt', 'desc'),
          limit(20) // MODIFIÉ: de 10 à 20
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

        // Si pas assez de produits trending, récupérer des produits featured
        if (products.length < 3) {
          const featuredQuery = query(
            productsRef,
            where('featured', '==', true),
            where('status', '==', 'published'),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
            limit(20 - products.length)
          );
          
          const featuredSnapshot = await getDocs(featuredQuery);
          featuredSnapshot.forEach((doc) => {
            const data = doc.data();
            // Vérifier si le produit n'est pas déjà dans la liste
            if (!products.find(p => p.id === doc.id)) {
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
            }
          });
        }

        // Si toujours pas assez, récupérer les nouveaux produits
        if (products.length < 3) {
          const newArrivalsQuery = query(
            productsRef,
            where('status', '==', 'published'),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'),
            limit(20)
          );
          
          const newArrivalsSnapshot = await getDocs(newArrivalsQuery);
          const allProducts: Product[] = [];
          
          newArrivalsSnapshot.forEach((doc) => {
            const data = doc.data();
            allProducts.push({
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

          // Mélanger et prendre 20 produits
          const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
          const selected = shuffled.slice(0, 20);
          setTrendingProducts(selected);
        } else {
          setTrendingProducts(products.slice(0, 20)); // MODIFIÉ: de 3 à 20
        }
      } catch (error) {
        console.error('Error fetching trending products:', error);
        // Utiliser des produits par défaut en cas d'erreur
        setTrendingProducts(getDefaultProducts());
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingProducts();
  }, []);

  // Fonction pour les produits par défaut
  const getDefaultProducts = (): Product[] => {
    return [
      {
        id: '1IoUVqzhXLJ9DWNRUW0g',
        name: 'Baskets pour hommes',
        price: 7500,
        originalPrice: 20000,
        mainImage: 'https://firebasestorage.googleapis.com/v0/b/assma-expresse.firebasestorage.app/o/products%2FyxlcK76I8KWWl3aZjIiZPxGDbdH2%2F1768122624197_1.jpg?alt=media&token=a96d769d-ad5a-40e7-bcd3-4a290be344eb',
        rating: 0,
        soldCount: 0,
        trending: true,
        featured: true,
        specialOffer: true,
        companyName: 'USINE A2EXPRESS',
      },
    ];
  };

  // Navigation avec vérification rôle
  const navigateToMessages = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    router.push('/(tabs)/messages');
  };

  const navigateToFavorites = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    router.push('/favorites');
  };

  const navigateToOrders = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    router.push('/orders');
  };

  const navigateToPayment = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    router.push('/payment');
  };

  const navigateToCoupons = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    router.push('/coupons');
  };

  const navigateToAddresses = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    router.push('/addresses');
  };

  const navigateToWarranty = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    router.push('/warranty');
  };

  const navigateToSupport = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    router.push('/support');
  };

  const navigateToAddProduct = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    if (userRole !== 'seller' && userRole !== 'admin' && userRole !== 'super-admin') {
      Alert.alert('Acces limite', 'Cette fonctionnalite est reservee aux vendeurs');
      return;
    }
    router.push('/seller/add-product');
  };

  const navigateToAnalytics = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    if (userRole !== 'seller' && userRole !== 'admin' && userRole !== 'super-admin') {
      Alert.alert('Acces limite', 'Cette fonctionnalite est reservee aux vendeurs');
      return;
    }
    router.push('/seller/analytics');
  };

  const navigateToPromotions = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    if (userRole !== 'seller' && userRole !== 'admin' && userRole !== 'super-admin') {
      Alert.alert('Acces limite', 'Cette fonctionnalite est reservee aux vendeurs');
      return;
    }
    router.push('/seller/promotions');
  };

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
      Alert.alert('Acces limite', 'Cette fonctionnalite est reservee aux vendeurs et administrateurs');
    }
  };

  // MODIFIÉ: Route vers /suppliers au lieu de /become-seller
  const navigateToBecomeSeller = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    router.push('/suppliers');
  };

  const navigateToAdminDashboard = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    if (userRole === 'super-admin' || userRole === 'admin') {
      router.push(userRole === 'super-admin' ? '/super-admin/dashboard' : '/admin/dashboard');
    } else {
      Alert.alert('Acces limite', 'Cette fonctionnalite est reservee aux administrateurs');
    }
  };

  const navigateToProductDetail = (productId: string) => {
    router.push(`/product/${productId}`);
  };

  // MODIFIÉ: Commenté - plus utilisé car le bouton Voir tout est caché
  // const navigateToAllProducts = () => {
  //   router.push('/products/trending');
  // };

  const navigateToLive = () => {
    if (!user) {
      setLoginModalVisible(true);
      return;
    }
    router.push('/live/broadcast');
  };

  // Composant Profile Header ameliore
  const ProfileHeader = () => {
    const handleLogout = () => {
      Alert.alert(
        'Deconnexion',
        'Etes-vous sur de vouloir vous deconnecter ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Deconnexion', 
            style: 'destructive',
            onPress: () => logout()
          },
        ]
      );
    };

    // Label du role
    const getRoleLabel = () => {
      switch (userRole) {
        case 'super-admin': return 'Super Admin';
        case 'admin': return 'Administrateur';
        case 'seller': return 'Vendeur';
        case 'customer': return 'Client';
        default: return 'Visiteur';
      }
    };

    // Badge de statut
    const getStatusBadge = () => {
      if (!user) return null;
      
      let badgeColor = '#FF6B00';
      let badgeText = 'Membre Gold';
      
      switch (userRole) {
        case 'super-admin':
          badgeColor = '#FF4444';
          badgeText = 'Super Admin';
          break;
        case 'admin':
          badgeColor = '#2196F3';
          badgeText = 'Administrateur';
          break;
        case 'seller':
          badgeColor = '#4CAF50';
          badgeText = 'Vendeur Verifie';
          break;
        case 'customer':
          badgeColor = '#FF6B00';
          badgeText = 'Client Premium';
          break;
      }

      return (
        <View style={[profileStyles.statusBadge, { backgroundColor: badgeColor }]}>
          <Text style={profileStyles.statusBadgeText}>{badgeText}</Text>
        </View>
      );
    };

    return (
      <View style={profileStyles.header}>
        <View style={profileStyles.avatarContainer}>
          <View style={profileStyles.avatar}>
            <FontAwesome5 name="user" size={24} color="white" />
          </View>
          <View style={profileStyles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          </View>
        </View>
        
        <View style={profileStyles.userInfo}>
          <Text style={profileStyles.userName}>
            {user ? user.email : 'Connectez-vous'}
          </Text>
          <Text style={profileStyles.userLevel}>
            {user ? getRoleLabel() : 'Rejoignez notre communaute'}
          </Text>
          
          {getStatusBadge()}
          
          <View style={profileStyles.stats}>
            <TouchableOpacity style={profileStyles.stat} onPress={navigateToFavorites}>
              <Text style={profileStyles.statNumber}>0</Text>
              <Text style={profileStyles.statLabel}>Favoris</Text>
            </TouchableOpacity>
            <TouchableOpacity style={profileStyles.stat} onPress={navigateToOrders}>
              <Text style={profileStyles.statNumber}>{user ? (orders?.length || 0) : 0}</Text>
              <Text style={profileStyles.statLabel}>Commandes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={profileStyles.stat} onPress={navigateToMessages}>
              <Text style={profileStyles.statNumber}>0</Text>
              <Text style={profileStyles.statLabel}>Messages</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {user ? (
          <TouchableOpacity style={profileStyles.settingsButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#666" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={profileStyles.settingsButton}
            onPress={() => setLoginModalVisible(true)}
          >
            <Ionicons name="log-in-outline" size={24} color="#666" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Services Section - MODIFIÉ: Commenté tous les boutons sauf Commandes, Messages, Paiement
  const ServicesSection = () => {
    const services: { icon: IoniconsName; title: string; color: string; count: number | null; onPress: () => void }[] = [
      // { icon: 'heart-outline', title: 'Favoris', color: '#FF4444', count: 0, onPress: navigateToFavorites }, // COMMENTÉ
      { icon: 'cube-outline', title: 'Commandes', color: '#4CAF50', count: user ? (orders?.length || 0) : 0, onPress: navigateToOrders },
      { icon: 'chatbubble-outline', title: 'Messages', color: '#2196F3', count: 0, onPress: navigateToMessages },
      // { icon: 'videocam-outline', title: 'Live', color: '#FF0000', count: null, onPress: navigateToLive }, // COMMENTÉ
      { icon: 'card-outline', title: 'Paiement', color: '#FF9800', count: null, onPress: navigateToPayment },
      // { icon: 'ticket-outline', title: 'Coupons', color: '#9C27B0', count: 0, onPress: navigateToCoupons }, // COMMENTÉ
      // { icon: 'location-outline', title: 'Adresses', color: '#795548', count: null, onPress: navigateToAddresses }, // COMMENTÉ
      // { icon: 'shield-checkmark-outline', title: 'Garantie', color: '#607D8B', count: null, onPress: navigateToWarranty }, // COMMENTÉ
    ];

    return (
      <View style={servicesStyles.container}>
        <Text style={servicesStyles.sectionTitle}>Mes Services</Text>
        <View style={servicesStyles.grid}>
          {services.map((service, index) => (
            <TouchableOpacity 
              key={index}
              style={servicesStyles.serviceItem}
              onPress={service.onPress}
            >
              <View style={[servicesStyles.iconContainer, { backgroundColor: service.color + '20' }]}>
                <Ionicons name={service.icon} size={22} color={service.color} />
                {service.count !== null && (
                  <View style={servicesStyles.badge}>
                    <Text style={servicesStyles.badgeText}>{service.count}</Text>
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

  // Seller Section amelioree
  const SellerSection = () => {
    if (userRole !== 'seller' && userRole !== 'admin' && userRole !== 'super-admin') {
      return null;
    }

    const sellerStats = [
      { value: '24', label: 'Produits' },
      { value: '156', label: 'Ventes' },
      { value: '4.8', label: 'Avis' },
      { value: '98%', label: 'Taux Reponse' },
    ];

    const getSectionTitle = () => {
      switch (userRole) {
        case 'super-admin': return 'Super Administration';
        case 'admin': return 'Administration';
        case 'seller': return 'Vendre sur A2Express';
        default: return 'Vendre sur A2Express';
      }
    };

    const getManageButtonText = () => {
      switch (userRole) {
        case 'super-admin': return 'Super Dashboard';
        case 'admin': return 'Admin Dashboard';
        case 'seller': return 'Gerer';
        default: return 'Gerer';
      }
    };

    return (
      <View style={sellerStyles.container}>
        <View style={sellerStyles.header}>
          <View style={sellerStyles.titleContainer}>
            <MaterialIcons 
              name={userRole === 'super-admin' ? 'admin-panel-settings' : userRole === 'admin' ? 'security' : 'store'} 
              size={20} 
              color="#FF6B00" 
            />
            <Text style={sellerStyles.title}>{getSectionTitle()}</Text>
          </View>
          <TouchableOpacity style={sellerStyles.manageButton} onPress={navigateToSellerDashboard}>
            <Text style={sellerStyles.manageButtonText}>{getManageButtonText()}</Text>
            <Ionicons name="chevron-forward" size={16} color="#FF6B00" />
          </TouchableOpacity>
        </View>

        <View style={sellerStyles.statsContainer}>
          {sellerStats.map((stat, index) => (
            <View key={index} style={sellerStyles.statItem}>
              <Text style={sellerStyles.statValue}>{stat.value}</Text>
              <Text style={sellerStyles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={sellerStyles.actionsContainer}>
          {(userRole === 'seller' || userRole === 'super-admin') && (
            <TouchableOpacity style={sellerStyles.actionButton} onPress={navigateToAddProduct}>
              <Ionicons name="add-circle-outline" size={18} color="#FF6B00" />
              <Text style={sellerStyles.actionText}>Ajouter Produit</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={sellerStyles.actionButton} onPress={navigateToAnalytics}>
            <Ionicons name="stats-chart-outline" size={18} color="#FF6B00" />
            <Text style={sellerStyles.actionText}>Analytiques</Text>
          </TouchableOpacity>
          
          {(userRole === 'seller' || userRole === 'super-admin') && (
            <TouchableOpacity style={sellerStyles.actionButton} onPress={navigateToPromotions}>
              <Feather name="trending-up" size={18} color="#FF6B00" />
              <Text style={sellerStyles.actionText}>Promotions</Text>
            </TouchableOpacity>
          )}
        </View>

        {(userRole === 'super-admin' || userRole === 'admin') && (
          <TouchableOpacity 
            style={sellerStyles.adminButton}
            onPress={navigateToAdminDashboard}
          >
            <Ionicons name="shield-checkmark" size={18} color="#2196F3" />
            <Text style={sellerStyles.adminButtonText}>
              {userRole === 'super-admin' ? 'Panel Super Admin' : 'Panel Administration'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#2196F3" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Products Section avec produits reels - MODIFIÉ: bouton Voir tout caché
  const ProductsSection = () => {
    const formatPrice = (price: number) => {
      return price.toLocaleString('fr-FR') + ' XOF';
    };

    const calculateDiscount = (original: number, current: number) => {
      if (original <= current || original === 0) return 0;
      return Math.round(((original - current) / original) * 100);
    };

    if (loading) {
      return (
        <View style={productsStyles.container}>
          <Text style={productsStyles.sectionTitle}>Produits Tendances</Text>
          <Text style={{ textAlign: 'center', padding: 20, color: '#666' }}>
            Chargement des produits...
          </Text>
        </View>
      );
    }

    if (trendingProducts.length === 0) {
      return (
        <View style={productsStyles.container}>
          <Text style={productsStyles.sectionTitle}>Produits Tendances</Text>
          <Text style={{ textAlign: 'center', padding: 20, color: '#666' }}>
            Aucun produit tendance pour le moment
          </Text>
        </View>
      );
    }

    return (
      <View style={productsStyles.container}>
        <View style={productsStyles.header}>
          <Text style={productsStyles.sectionTitle}>Produits Tendances</Text>
          {/* MODIFIÉ: Bouton Voir tout caché */}
          {/* <TouchableOpacity style={productsStyles.seeAllButton} onPress={navigateToAllProducts}>
            <Text style={productsStyles.seeAllText}>Voir tout</Text>
            <Ionicons name="arrow-forward" size={16} color="#FF6B00" />
          </TouchableOpacity> */}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={productsStyles.scrollView}>
          {trendingProducts.map((product) => {
            const discount = calculateDiscount(product.originalPrice, product.price);
            
            return (
              <TouchableOpacity 
                key={product.id} 
                style={productsStyles.productCard}
                onPress={() => navigateToProductDetail(product.id)}
              >
                <View style={productsStyles.productImage}>
                  {product.mainImage ? (
                    <Image 
                      source={{ uri: product.mainImage }} 
                      style={productsStyles.productImageContent}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={productsStyles.imagePlaceholder}>
                      <Ionicons name="image-outline" size={32} color="#999" />
                    </View>
                  )}
                  {discount > 0 && (
                    <View style={productsStyles.discountBadge}>
                      <Text style={productsStyles.discountText}>-{discount}%</Text>
                    </View>
                  )}
                  {product.specialOffer && (
                    <View style={productsStyles.specialOfferBadge}>
                      <Text style={productsStyles.specialOfferText}>Promo</Text>
                    </View>
                  )}
                </View>
                
                <Text style={productsStyles.productName} numberOfLines={2}>
                  {product.name}
                </Text>
                
                <Text style={productsStyles.supplierName} numberOfLines={1}>
                  {product.companyName}
                </Text>
                
                <View style={productsStyles.ratingContainer}>
                  <View style={productsStyles.ratingStars}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={productsStyles.rating}>{product.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={productsStyles.orders}>{product.soldCount} vendus</Text>
                </View>

                <View style={productsStyles.priceContainer}>
                  <Text style={productsStyles.currentPrice}>{formatPrice(product.price)}</Text>
                  {discount > 0 && (
                    <Text style={productsStyles.originalPrice}>{formatPrice(product.originalPrice)}</Text>
                  )}
                </View>

                <TouchableOpacity style={productsStyles.addToCartButton}>
                  <Ionicons name="cart-outline" size={14} color="#FFF" />
                  <Text style={productsStyles.addToCartText}>Ajouter</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // CTA Devenir Vendeur - MODIFIÉ: avec nouvelle route vers /suppliers
  const BecomeSellerCta = () => {
    if (userRole === 'seller' || userRole === 'admin' || userRole === 'super-admin') {
      return null;
    }

    return (
      <View style={ctaStyles.container}>
        <View style={ctaStyles.content}>
          <View style={ctaStyles.textContent}>
            <Text style={ctaStyles.title}>Devenez Vendeur sur A2Express</Text>
            <Text style={ctaStyles.subtitle}>
              Developpez votre business en ligne et atteignez des millions de clients
            </Text>
            
            <View style={ctaStyles.features}>
              <View style={ctaStyles.feature}>
                <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                <Text style={ctaStyles.featureText}>Commission competitive</Text>
              </View>
              <View style={ctaStyles.feature}>
                <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                <Text style={ctaStyles.featureText}>Support technique 24/7</Text>
              </View>
              <View style={ctaStyles.feature}>
                <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                <Text style={ctaStyles.featureText}>Formation gratuite</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={ctaStyles.ctaButton}
            onPress={navigateToBecomeSeller}
          >
            <MaterialIcons name="rocket-launch" size={18} color="#FFF" />
            <Text style={ctaStyles.ctaButtonText}>Commencer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <ProfileHeader />
        
        {user ? (
          <>
            <ServicesSection />
            <SellerSection />
            <ProductsSection />
            <BecomeSellerCta />
          </>
        ) : (
          <>
            <ServicesSection />
            <ProductsSection />
            <BecomeSellerCta />
          </>
        )}
      </ScrollView>

      <LoginModal
        visible={loginModalVisible}
        onClose={() => setLoginModalVisible(false)}
      />
    </SafeAreaView>
  );
}

// ==================== STYLES COMPLETS ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
});

const profileStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'white',
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 2,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  userLevel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: 'white',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 12,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  settingsButton: {
    padding: 8,
    marginTop: 4,
  },
});

const servicesStyles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  serviceItem: {
    alignItems: 'center',
    width: '25%',
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  serviceTitle: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
});

const sellerStyles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  manageButtonText: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingVertical: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 0.32,
    justifyContent: 'center',
  },
  actionText: {
    color: '#FF6B00',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  adminButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
  },
});

const productsStyles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  scrollView: {
    marginHorizontal: -4,
  },
  productCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    width: 160,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  productImageContent: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  specialOfferBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  specialOfferText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 16,
    height: 32,
  },
  supplierName: {
    fontSize: 11,
    color: '#666',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  orders: {
    fontSize: 10,
    color: '#999',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B00',
    marginRight: 6,
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B00',
    paddingVertical: 6,
    borderRadius: 6,
  },
  addToCartText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

const ctaStyles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  textContent: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  features: {
    gap: 6,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
});