// app/flash-deals/index.tsx - PAGE FLASH DEAL COMPLÈTE
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Dimensions,
  Alert,
  RefreshControl,
  Animated,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../src/config/firebase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 🎨 COULEURS THÈME FLASH DEAL
const COLORS = {
  primary: '#FF4444',
  primaryLight: '#FFE6E6',
  primaryDark: '#CC0000',
  secondary: '#FF6A00',
  accent: '#FF9500',
  background: '#FFF5F5',
  text: '#333333',
  textLight: '#666666',
  border: '#FFD6D6',
  white: '#FFFFFF',
  success: '#4CAF50',
  warning: '#FF9800',
  danger: '#FF4444'
};

// ✓ STRUCTURE D'UN FLASH DEAL (comme Alibaba)
interface FlashDeal {
  id: string;
  product: {
    id: string;
    name: string;
    imageUrl: string;
    originalPrice: number;
    flashPrice: number;
    discountPercentage: number;
    minOrder: number;
    supplier: string;
    rating: number;
    soldCount: number;
  };
  timeLeft: {
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  };
  stock: {
    total: number;
    sold: number;
    available: number;
    percentage: number; // Pourcentage vendu
  };
  tags: string[];
  isHot: boolean;
  isEndingSoon: boolean;
}

export default function FlashDealsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'ended'>('active');
  const [flashDeals, setFlashDeals] = useState<FlashDeal[]>([]);
  const [globalTimer, setGlobalTimer] = useState({ hours: 12, minutes: 45, seconds: 30 });

  // ✓ ANIMATIONS
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [180, 100],
    extrapolate: 'clamp',
  });

  // ✓ CHARGER LES FLASH DEALS
  const fetchFlashDeals = async () => {
    try {
      setLoading(true);
      
      // 1. Récupérer les produits avec des offres spéciales depuis Firestore
      const productsRef = collection(db, 'products');
      
      // Filtre pour produits en promotion (ajustez selon vos champs)
      let flashQuery;
      if (activeTab === 'active') {
        // Produits actifs en promotion
        flashQuery = query(
          productsRef,
          where('specialOffer', '==', true),
          where('flashDeal', '==', true),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
      } else if (activeTab === 'upcoming') {
        // Produits à venir (ex: upcomingDeal flag)
        flashQuery = query(
          productsRef,
          where('upcomingDeal', '==', true),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
      } else {
        // Produits terminés ou tous
        flashQuery = query(
          productsRef,
          where('wasFlashDeal', '==', true),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
      }

      const snapshot = await getDocs(flashQuery);
      
      // 2. Transformer les données en FlashDeals
      const deals: FlashDeal[] = snapshot.docs.map((doc, index) => {
        const data = doc.data();
        
        // Générer des données de test si pas de champs spécifiques
        const discountPercentage = data.discountPercentage || Math.floor(Math.random() * 50) + 20;
        const originalPrice = data.price || Math.floor(Math.random() * 2000) + 500;
        const flashPrice = Math.round(originalPrice * (1 - discountPercentage / 100));
        const totalStock = data.stock || Math.floor(Math.random() * 200) + 50;
        const soldStock = data.soldCount || Math.floor(Math.random() * totalStock * 0.7);
        
        // Temps restant aléatoire pour la démo
        const hours = Math.floor(Math.random() * 12);
        const minutes = Math.floor(Math.random() * 60);
        const seconds = Math.floor(Math.random() * 60);
        
        return {
          id: doc.id || `flash-${index}`,
          product: {
            id: doc.id,
            name: data.name || `Produit Flash ${index + 1}`,
            imageUrl: data.imageUrl || data.images?.[0] || 
                     `https://via.placeholder.com/300x300/FF4444/ffffff?text=Flash+${index + 1}`,
            originalPrice,
            flashPrice,
            discountPercentage,
            minOrder: data.minOrder || 1,
            supplier: data.supplier || `Fournisseur ${index + 1}`,
            rating: data.rating || 4.0 + Math.random(),
            soldCount: soldStock,
          },
          timeLeft: {
            hours,
            minutes,
            seconds,
            totalSeconds: hours * 3600 + minutes * 60 + seconds,
          },
          stock: {
            total: totalStock,
            sold: soldStock,
            available: totalStock - soldStock,
            percentage: Math.round((soldStock / totalStock) * 100),
          },
          tags: data.tags || (discountPercentage > 40 ? ['Super Promo'] : ['Promo']),
          isHot: soldStock > totalStock * 0.5,
          isEndingSoon: hours < 2,
        };
      });
      
      setFlashDeals(deals);
      
      // Si pas de données, créer des données de démo
      if (deals.length === 0) {
        console.log('Aucun flash deal trouvé, création de données de démo');
        const demoDeals = generateDemoFlashDeals();
        setFlashDeals(demoDeals);
      }
      
    } catch (error) {
      console.error('❌ Erreur chargement flash deals:', error);
      
      // Données de démo en cas d'erreur
      const demoDeals = generateDemoFlashDeals();
      setFlashDeals(demoDeals);
      
      Alert.alert('Info', 'Chargement des offres spéciales...');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ✓ GÉNÉRER DES DONNÉES DE DÉMO
  const generateDemoFlashDeals = (): FlashDeal[] => {
    const deals: FlashDeal[] = [];
    
    for (let i = 0; i < 12; i++) {
      const discountPercentage = Math.floor(Math.random() * 50) + 20;
      const originalPrice = Math.floor(Math.random() * 2000) + 500;
      const flashPrice = Math.round(originalPrice * (1 - discountPercentage / 100));
      const totalStock = Math.floor(Math.random() * 200) + 50;
      const soldStock = Math.floor(Math.random() * totalStock * 0.7);
      const hours = Math.floor(Math.random() * 12);
      const minutes = Math.floor(Math.random() * 60);
      const seconds = Math.floor(Math.random() * 60);
      
      deals.push({
        id: `demo-flash-${i}`,
        product: {
          id: `product-${i}`,
          name: `Produit Flash Deal ${i + 1}`,
          imageUrl: `https://via.placeholder.com/300x300/FF4444/ffffff?text=Flash+${i + 1}`,
          originalPrice,
          flashPrice,
          discountPercentage,
          minOrder: Math.floor(Math.random() * 10) + 1,
          supplier: `Fournisseur Premium ${i + 1}`,
          rating: 4.0 + Math.random(),
          soldCount: soldStock,
        },
        timeLeft: {
          hours,
          minutes,
          seconds,
          totalSeconds: hours * 3600 + minutes * 60 + seconds,
        },
        stock: {
          total: totalStock,
          sold: soldStock,
          available: totalStock - soldStock,
          percentage: Math.round((soldStock / totalStock) * 100),
        },
        tags: discountPercentage > 40 ? ['Super Promo', '🔥 Chaud'] : ['Promotion'],
        isHot: soldStock > totalStock * 0.5,
        isEndingSoon: hours < 2,
      });
    }
    
    return deals;
  };

  // ✓ TIMER GLOBAL
  useEffect(() => {
    const timer = setInterval(() => {
      setGlobalTimer(prev => {
        let { hours, minutes, seconds } = prev;
        
        seconds--;
        if (seconds < 0) {
          seconds = 59;
          minutes--;
          if (minutes < 0) {
            minutes = 59;
            hours--;
            if (hours < 0) {
              // Reset timer quand il atteint 0
              hours = 12;
              minutes = 45;
              seconds = 30;
            }
          }
        }
        
        return { hours, minutes, seconds };
      });
      
      // Mettre à jour les timers des deals
      setFlashDeals(prev => prev.map(deal => {
        let { hours, minutes, seconds } = deal.timeLeft;
        
        seconds--;
        if (seconds < 0) {
          seconds = 59;
          minutes--;
          if (minutes < 0) {
            minutes = 59;
            hours--;
            if (hours < 0) {
              hours = 0;
              minutes = 0;
              seconds = 0;
            }
          }
        }
        
        return {
          ...deal,
          timeLeft: {
            hours,
            minutes,
            seconds,
            totalSeconds: hours * 3600 + minutes * 60 + seconds,
          },
          isEndingSoon: hours < 2,
        };
      }));
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // ✓ CHARGEMENT INITIAL
  useEffect(() => {
    fetchFlashDeals();
  }, [activeTab]);

  // ✓ RAFRAÎCHIR
  const handleRefresh = () => {
    setRefreshing(true);
    fetchFlashDeals();
  };

  // ✓ NAVIGATION
  const navigateToDeal = (dealId: string, productId: string) => {
    // Option 1: Vers la page produit normale
    // router.push(`/product/${productId}`);
    
    // Option 2: Vers une page flash deal spécifique
    router.push({
      pathname: `/product/${productId}`,
      params: { isFlashDeal: 'true' }
    });
  };

  // ✓ NAVIGATION VERS CATÉGORIE
  const navigateToCategory = (productId: string) => {
    // Cette fonction simule le comportement de l'accueil
    // Pour rester cohérent avec votre flux existant
    router.push(`/category/flash-deals`);
  };

  // ✓ HEADER AVEC COMPTEUR
  const renderHeader = () => (
    <Animated.View style={[styles.headerContainer, { height: headerHeight }]}>
      <LinearGradient
        colors={['#FF4444', '#FF6A00']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="flash" size={28} color="#FFF" />
            <Text style={styles.headerTitle}>FLASH DEALS</Text>
          </View>
          <Text style={styles.headerSubtitle}>Offres limitées dans le temps</Text>
        </View>
        
        {/* COMPTEUR GLOBAL */}
        <View style={styles.globalTimerContainer}>
          <Text style={styles.globalTimerLabel}>FIN DES OFFRES DANS</Text>
          <View style={styles.globalTimerDisplay}>
            <View style={styles.timerUnit}>
              <Text style={styles.timerNumber}>
                {globalTimer.hours.toString().padStart(2, '0')}
              </Text>
              <Text style={styles.timerLabel}>HEURES</Text>
            </View>
            <Text style={styles.timerColon}>:</Text>
            <View style={styles.timerUnit}>
              <Text style={styles.timerNumber}>
                {globalTimer.minutes.toString().padStart(2, '0')}
              </Text>
              <Text style={styles.timerLabel}>MIN</Text>
            </View>
            <Text style={styles.timerColon}>:</Text>
            <View style={styles.timerUnit}>
              <Text style={styles.timerNumber}>
                {globalTimer.seconds.toString().padStart(2, '0')}
              </Text>
              <Text style={styles.timerLabel}>SEC</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );

  // ✓ TABS COMME ALIBABA
  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {[
          { id: 'active', label: '🔥 En Cours', count: flashDeals.length },
          { id: 'upcoming', label: '⌛ À Venir', count: 0 },
          { id: 'ended', label: '✓ Terminés', count: 0 },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tabButton,
              activeTab === tab.id && styles.tabButtonActive
            ]}
            onPress={() => setActiveTab(tab.id as any)}
          >
            <Text style={[
              styles.tabButtonText,
              activeTab === tab.id && styles.tabButtonTextActive
            ]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // ✓ CARTE FLASH DEAL (STYLE ALIBABA)
  const FlashDealCard = ({ deal, index }: { deal: FlashDeal; index: number }) => {
    const progressWidth = `${deal.stock.percentage}%`;
    
    return (
      <TouchableOpacity
        style={styles.dealCard}
        activeOpacity={0.9}
        onPress={() => navigateToCategory(deal.product.id)}
      >
        {/* BADGE ROUGE "FLASH DEAL" */}
        <View style={styles.dealBadge}>
          <Text style={styles.dealBadgeText}>FLASH DEAL</Text>
        </View>
        
        {/* IMAGE DU PRODUIT */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: deal.product.imageUrl }}
            style={styles.productImage}
            resizeMode="cover"
          />
          
          {/* TAGS */}
          {deal.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {deal.tags.map((tag, idx) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          
          {/* COMPTEUR INDIVIDUEL */}
          <View style={styles.cardTimer}>
            <Text style={styles.cardTimerLabel}>Finit dans:</Text>
            <View style={styles.cardTimerDisplay}>
              <Text style={styles.cardTimerText}>
                {deal.timeLeft.hours.toString().padStart(2, '0')}:
                {deal.timeLeft.minutes.toString().padStart(2, '0')}:
                {deal.timeLeft.seconds.toString().padStart(2, '0')}
              </Text>
            </View>
          </View>
        </View>
        
        {/* INFOS PRODUIT */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {deal.product.name}
          </Text>
          
          {/* BARRE DE PROGRESSION DES VENTES */}
          <View style={styles.progressContainer}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressSold}>
                {deal.stock.sold} vendu(s)
              </Text>
              <Text style={styles.progressAvailable}>
                {deal.stock.available} restant(s)
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: progressWidth }]} />
            </View>
            <Text style={styles.progressPercentage}>
              {deal.stock.percentage}% vendu
            </Text>
          </View>
          
          {/* PRIX */}
          <View style={styles.priceContainer}>
            <View style={styles.priceRow}>
              <Text style={styles.originalPrice}>
                {deal.product.originalPrice.toLocaleString()} F CFA
              </Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{deal.product.discountPercentage}%</Text>
              </View>
            </View>
            <Text style={styles.flashPrice}>
              {deal.product.flashPrice.toLocaleString()} F CFA
            </Text>
            <Text style={styles.minOrder}>
              Commande min: {deal.product.minOrder} pcs
            </Text>
          </View>
          
          {/* SUPPLIER ET RATING */}
          <View style={styles.metaContainer}>
            <Text style={styles.supplier}>{deal.product.supplier}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.rating}>{deal.product.rating.toFixed(1)}</Text>
              <Text style={styles.soldCount}>({deal.product.soldCount})</Text>
            </View>
          </View>
          
          {/* BOUTON COMMANDER */}
          <TouchableOpacity 
            style={styles.orderButton}
            onPress={(e) => {
              e.stopPropagation();
              navigateToDeal(deal.id, deal.product.id);
            }}
          >
            <Text style={styles.orderButtonText}>Commander maintenant</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // ✓ LOADING STATE
  if (loading && flashDeals.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        {renderHeader()}
        <View style={styles.fullLoading}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement des offres flash...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      <Animated.FlatList
        data={flashDeals}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item, index }) => (
          <FlashDealCard deal={item} index={index} />
        )}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        ListHeaderComponent={
          <>
            {renderTabs()}
            <Text style={styles.sectionTitle}>
              {activeTab === 'active' ? '🔥 Offres en cours' : 
               activeTab === 'upcoming' ? '⌛ Offres à venir' : '✓ Offres terminées'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {flashDeals.length} offre{flashDeals.length > 1 ? 's' : ''} disponible{flashDeals.length > 1 ? 's' : ''}
            </Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="flash-outline" size={80} color="#FFD6D6" />
            <Text style={styles.emptyTitle}>Aucune offre flash disponible</Text>
            <Text style={styles.emptyText}>
              Revenez plus tard pour découvrir nos nouvelles offres éclair !
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

// ✓ STYLES COMPLETS
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
  },
  fullLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  // HEADER
  headerContainer: {
    overflow: 'hidden',
  },
  headerGradient: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginLeft: 8,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  // GLOBAL TIMER
  globalTimerContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  globalTimerLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 1,
  },
  globalTimerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerUnit: {
    alignItems: 'center',
    minWidth: 50,
  },
  timerNumber: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  timerLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  timerColon: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginHorizontal: 4,
  },
  // TABS
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  tabBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  // SECTION TITLES
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 20,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  // FLASH DEAL CARD
  columnWrapper: {
    paddingHorizontal: 8,
    justifyContent: 'space-between',
  },
  dealCard: {
    width: (SCREEN_WIDTH - 24) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#FFE6E6',
    overflow: 'hidden',
  },
  dealBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
  },
  dealBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  imageContainer: {
    position: 'relative',
    height: 140,
  },
  productImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F8F9FA',
  },
  tagsContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
  },
  tag: {
    backgroundColor: 'rgba(255, 68, 68, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardTimer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 6,
    padding: 6,
    alignItems: 'center',
  },
  cardTimerLabel: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  cardTimerDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTimerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // PRODUCT INFO
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 16,
    marginBottom: 10,
    minHeight: 32,
  },
  // PROGRESS BAR
  progressContainer: {
    marginBottom: 10,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressSold: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: '600',
  },
  progressAvailable: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressPercentage: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  // PRICE
  priceContainer: {
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 12,
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  discountBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  flashPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
    marginBottom: 2,
  },
  minOrder: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  // META INFO
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  supplier: {
    fontSize: 11,
    color: COLORS.textLight,
    flex: 1,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 2,
    marginRight: 4,
  },
  soldCount: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  // ORDER BUTTON
  orderButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  orderButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // LIST
  listContent: {
    paddingBottom: 100,
  },
  // EMPTY STATE
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
});