// src/components/premium/PremiumSuppliersSection.tsx - VERSION CONNECTÉE FIRESTORE
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, 
  TouchableOpacity, Image, Dimensions,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

interface Supplier {
  id: string;
  name: string;
  logo: string;
  rating: number;
  totalProducts: number;
  responseRate: number;
  responseTime: string;
  memberSince: string;
  isGold: boolean;
  isVerified: boolean;
  transactionLevel: string;
  mainProducts: string[];
  country: string;
  
  // Champs Firestore réels
  description?: string;
  coverImage?: string;
  type?: string;
  location?: string;
  yearsOnPlatform?: number;
  businessType?: string;
  employees?: string;
  annualRevenue?: string;
  goldSupplier?: boolean;
  tradeAssurance?: boolean;
  address?: {
    city: string;
    country: string;
    street: string;
  };
  stats?: {
    orderCount: number;
    productCount: number;
    rating: number;
    reviewCount: number;
    totalOrders: number;
    totalProducts: number;
  };
  verification?: {
    status: string;
    verified: boolean;
    badges: string[];
  };
  yearsEstablished?: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  rating: number;
  supplier?: string;
}

interface PremiumSuppliersSectionProps {
  products?: Product[];
  suppliers?: Supplier[];
}

// ✅ FONCTION DE NORMALISATION SPÉCIFIQUE À VOTRE STRUCTURE
const normalizeSupplier = (data: any): Supplier => {
  const mainProducts = data.mainProducts ? 
    (typeof data.mainProducts === 'string' ? 
      data.mainProducts.split(',').map((p: string) => p.trim()) : 
      data.mainProducts
    ) : 
    ['Produits divers'];

  return {
    id: data.id || data.uid || 'unknown',
    name: data.name || 'Entreprise non spécifiée',
    logo: data.logo || 'https://via.placeholder.com/80x80/ff6a00/ffffff?text=F',
    rating: data.rating || data.stats?.rating || 0,
    totalProducts: data.totalProducts || data.stats?.totalProducts || data.stats?.productCount || 0,
    responseRate: data.responseRate || 0,
    responseTime: data.responseTime || '24-48 heures',
    memberSince: data.yearsEstablished ? data.yearsEstablished.toString() : '2020',
    isGold: Boolean(data.goldSupplier),
    isVerified: Boolean(data.verified || data.verification?.verified),
    transactionLevel: data.verification?.badges?.includes('new_supplier') ? 'Nouveau' : 'Niveau 1',
    mainProducts: mainProducts,
    country: data.location || data.address?.country || 'International',
    
    // Champs additionnels spécifiques
    description: data.description,
    coverImage: data.coverImage,
    type: data.type,
    location: data.location,
    yearsOnPlatform: data.yearsOnPlatform,
    businessType: data.businessType,
    employees: data.employees,
    annualRevenue: data.annualRevenue,
    goldSupplier: data.goldSupplier,
    tradeAssurance: data.tradeAssurance,
    address: data.address,
    stats: data.stats,
    verification: data.verification,
    yearsEstablished: data.yearsEstablished,
  };
};

// ✅ FALLBACK INTELLIGENT basé sur votre structure
const getMockSuppliers = (): Supplier[] => [
  {
    id: 'supplier-1',
    name: 'A2Express Pro',
    logo: 'https://via.placeholder.com/80x80/ff6a00/ffffff?text=AE',
    rating: 4.8,
    totalProducts: 156,
    responseRate: 95,
    responseTime: '< 2h',
    memberSince: '2020',
    isGold: true,
    isVerified: true,
    transactionLevel: 'Niveau 4',
    mainProducts: ['Machines Industrielles', 'Équipements Lourds', 'Transport'],
    country: '🇲🇱 Mali',
    description: 'Fabricant et fournisseur de machines industrielles',
    businessType: 'Fabricant, Logistique, Transport',
    employees: '50+',
    annualRevenue: '500,000,000 FCFA'
  },
  {
    id: 'supplier-2',
    name: 'Global Machinery Corp',
    logo: 'https://via.placeholder.com/80x80/4A6572/ffffff?text=GM',
    rating: 4.9,
    totalProducts: 1247,
    responseRate: 98,
    responseTime: '< 1h',
    memberSince: '2018',
    isGold: true,
    isVerified: true,
    transactionLevel: 'Niveau 5',
    mainProducts: ['Machines Industrielles', 'Équipements Lourds', 'Automation'],
    country: '🇩🇪 Allemagne',
    description: 'Leader en machines industrielles et équipements lourds',
    businessType: 'Fabricant Industriel',
    employees: '200+',
    annualRevenue: '2,000,000,000 FCFA'
  }
];

export default function PremiumSuppliersSection({ products, suppliers }: PremiumSuppliersSectionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedSupplier, setSelectedSupplier] = useState(0);
  const [realSuppliers, setRealSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ FONCTION POUR RÉCUPÉRER LES VRAIS FOURNISSEURS
  const fetchRealSuppliers = async () => {
    try {
      console.log('🔄 Chargement des vrais fournisseurs depuis Firestore...');
      setLoading(true);
      
      // Récupérer depuis la collection "companies"
      const companiesQuery = query(
        collection(db, 'companies'),
        where('isActive', '==', true),
        limit(10)
      );
      
      const querySnapshot = await getDocs(companiesQuery);
      const suppliersData = querySnapshot.docs.map(doc => 
        normalizeSupplier({ id: doc.id, ...doc.data() })
      );
      
      console.log(`🏪 ${suppliersData.length} fournisseurs réels trouvés`);
      setRealSuppliers(suppliersData);
      
    } catch (error) {
      console.error('❌ Erreur chargement fournisseurs:', error);
      // Fallback vers les données mock
      setRealSuppliers(getMockSuppliers());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Utiliser les fournisseurs passés en props ou fetch depuis Firestore
    if (suppliers && suppliers.length > 0) {
      setRealSuppliers(suppliers);
      setLoading(false);
    } else {
      fetchRealSuppliers();
    }
  }, [suppliers]);

  // ✅ CORRECTION : Navigation vers la page compagnie
  const navigateToCompanyProfile = (supplier: Supplier) => {
    console.log('🔄 Navigation vers compagnie:', supplier.id);
    
    router.push({
      pathname: "/company/[id]",
      params: { 
        id: supplier.id,
        name: encodeURIComponent(supplier.name || '')
      },
    });
  };

  // ✅ CORRECTION : Navigation vers la messagerie
  const navigateToChat = (supplier: Supplier) => {
    console.log('🔄 Navigation vers chat avec:', supplier.id);
    
    router.push({
      pathname: "/chat",
      params: { 
        sellerId: supplier.id,
        sellerName: encodeURIComponent(supplier.name || '')
      },
    });
  };

  // ✅ CORRECTION : Navigation vers la page fournisseurs
  const navigateToSuppliers = () => {
    router.push({
      pathname: "/suppliers",
      params: { 
        category: "all"
      },
    });
  };

  // Utiliser les fournisseurs réels ou les données mock
  const displaySuppliers = realSuppliers.length > 0 ? realSuppliers : getMockSuppliers();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6a00" />
        <Text style={styles.loadingText}>Chargement des fournisseurs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* EN-TÊTE PREMIUM */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <LinearGradient
            colors={['#FFD700', '#FFA000']}
            style={styles.premiumBadge}
          >
            <Ionicons name="diamond" size={20} color="#fff" />
            <Text style={styles.premiumText}>{t('app.premium.badgePremium')}</Text>
          </LinearGradient>
          <View>
            <Text style={styles.title}>{t('app.premium.suppliersVerifiedTitle')}</Text>
            <Text style={styles.subtitle}>{t('app.premium.suppliersVerifiedSubtitle')}</Text>
          </View>
        </View>
        
        {/* ✅ CORRECTION : Bouton Explorer connecté */}
        <TouchableOpacity 
          style={styles.exploreButton}
          onPress={navigateToSuppliers}
        >
          <Text style={styles.exploreText}>{t('app.premium.explore')}</Text>
          <Ionicons name="arrow-forward" size={16} color="#ff6a00" />
        </TouchableOpacity>
      </View>

      {/* STATISTIQUES GLOBALES */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{displaySuppliers.length}+</Text>
          <Text style={styles.statLabel}>{t('app.premium.statSuppliers')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>98%</Text>
          <Text style={styles.statLabel}>{t('app.premium.statResponseRate')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>24h</Text>
          <Text style={styles.statLabel}>{t('app.premium.expressDeliveryTitle')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>100%</Text>
          <Text style={styles.statLabel}>{t('app.premium.statQualityGuarantee')}</Text>
        </View>
      </View>

      {/* BARRE DE NAVIGATION FOURNISSEURS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.suppliersNav}
      >
        {displaySuppliers.map((supplier, index) => (
          <TouchableOpacity
            key={supplier.id}
            style={[
              styles.supplierNavItem,
              selectedSupplier === index && styles.supplierNavItemActive
            ]}
            onPress={() => setSelectedSupplier(index)}
          >
            <Image 
              source={{ uri: supplier.logo }} 
              style={styles.supplierNavLogo}
            />
            <Text 
              style={[
                styles.supplierNavName,
                selectedSupplier === index && styles.supplierNavNameActive
              ]}
              numberOfLines={1}
            >
              {supplier.name}
            </Text>
            {selectedSupplier === index && (
              <View style={styles.activeIndicator} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* CARTE FOURNISSEUR DÉTAILLÉE */}
      {displaySuppliers[selectedSupplier] && (
        <View style={styles.supplierCard}>
          <LinearGradient
            colors={['#f8f9fa', '#ffffff']}
            style={styles.supplierCardGradient}
          >
            {/* EN-TÊTE FOURNISSEUR */}
            <View style={styles.supplierHeader}>
              <View style={styles.supplierInfo}>
                <Image 
                  source={{ uri: displaySuppliers[selectedSupplier].logo }} 
                  style={styles.supplierLogo}
                />
                <View style={styles.supplierDetails}>
                  <View style={styles.supplierNameRow}>
                    <Text style={styles.supplierName}>
                      {displaySuppliers[selectedSupplier].name}
                    </Text>
                    {displaySuppliers[selectedSupplier].isGold && (
                      <View style={styles.goldBadge}>
                        <Ionicons name="diamond" size={12} color="#FFD700" />
                        <Text style={styles.goldText}>Gold</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.supplierCountry}>
                    {displaySuppliers[selectedSupplier].country}
                  </Text>
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={styles.ratingText}>
                      {displaySuppliers[selectedSupplier].rating || 'Nouveau'}
                    </Text>
                    <Text style={styles.memberSince}>
                      {t('app.premium.memberSince', { date: displaySuppliers[selectedSupplier].memberSince })}
                    </Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.supplierStats}>
                <View style={styles.statMini}>
                  <Text style={styles.statMiniNumber}>
                    {displaySuppliers[selectedSupplier].totalProducts}
                  </Text>
                  <Text style={styles.statMiniLabel}>{t('app.premium.statProducts')}</Text>
                </View>
                <View style={styles.statMini}>
                  <Text style={styles.statMiniNumber}>
                    {displaySuppliers[selectedSupplier].responseRate}%
                  </Text>
                  <Text style={styles.statMiniLabel}>{t('app.premium.miniResponse')}</Text>
                </View>
              </View>
            </View>

            {/* INFORMATIONS SUPPLÉMENTAIRES */}
            {displaySuppliers[selectedSupplier].businessType && (
              <View style={styles.businessInfo}>
                <Text style={styles.businessType}>
                  {displaySuppliers[selectedSupplier].businessType}
                </Text>
                {displaySuppliers[selectedSupplier].employees && (
                  <Text style={styles.employees}>
                    👥 {t('app.premium.employees', { count: displaySuppliers[selectedSupplier].employees })}
                  </Text>
                )}
              </View>
            )}

            {/* BADGES ET CERTIFICATIONS */}
            <View style={styles.badgesContainer}>
              {displaySuppliers[selectedSupplier].isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#4CAF50" />
                  <Text style={styles.verifiedText}>{t('app.premium.verifiedAssma')}</Text>
                </View>
              )}
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>
                  {displaySuppliers[selectedSupplier].transactionLevel}
                </Text>
              </View>
              <View style={styles.responseBadge}>
                <Ionicons name="time" size={12} color="#2196F3" />
                <Text style={styles.responseText}>
                  {displaySuppliers[selectedSupplier].responseTime}
                </Text>
              </View>
            </View>

            {/* PRODUITS PRINCIPAUX */}
            <View style={styles.productsSection}>
              <Text style={styles.productsTitle}>{t('app.premium.mainProductsTitle')}</Text>
              <View style={styles.productsGrid}>
                {displaySuppliers[selectedSupplier].mainProducts.map((product, index) => (
                  <View key={index} style={styles.productTag}>
                    <Text style={styles.productTagText}>{product}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ✅ CORRECTION : Actions connectées */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity 
                style={styles.contactButton}
                onPress={() => navigateToChat(displaySuppliers[selectedSupplier])}
              >
                <LinearGradient
                  colors={['#ff6a00', '#ff8c00']}
                  style={styles.contactGradient}
                >
                  <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
                  <Text style={styles.contactText}>{t('app.premium.contact')}</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.visitStoreButton}
                onPress={() => navigateToCompanyProfile(displaySuppliers[selectedSupplier])}
              >
                <Ionicons name="storefront" size={16} color="#ff6a00" />
                <Text style={styles.visitStoreText}>{t('app.premium.visitStore')}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* GARANTIES ASSMA */}
      <View style={styles.guaranteesContainer}>
        <Text style={styles.guaranteesTitle}>{t('app.premium.guaranteesTitle')}</Text>
        <View style={styles.guaranteesGrid}>
          <View style={styles.guaranteeItem}>
            <LinearGradient
              colors={['#4CAF50', '#66BB6A']}
              style={styles.guaranteeIcon}
            >
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
            </LinearGradient>
            <Text style={styles.guaranteeTitle}>{t('app.premium.guaranteeQualityTitle')}</Text>
            <Text style={styles.guaranteeDesc}>{t('app.premium.guaranteeQualityDesc')}</Text>
          </View>
          
          <View style={styles.guaranteeItem}>
            <LinearGradient
              colors={['#2196F3', '#42A5F5']}
              style={styles.guaranteeIcon}
            >
              <Ionicons name="rocket" size={20} color="#fff" />
            </LinearGradient>
            <Text style={styles.guaranteeTitle}>{t('app.premium.expressDeliveryTitle')}</Text>
            <Text style={styles.guaranteeDesc}>{t('app.premium.guaranteeDeliveryDesc')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingVertical: 24,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 12,
  },
  premiumText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.2)',
  },
  exploreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6a00',
    marginRight: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 0, 0.05)',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.1)',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ff6a00',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 106, 0, 0.2)',
  },
  suppliersNav: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  supplierNavItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    minWidth: 100,
    position: 'relative',
  },
  supplierNavItemActive: {
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.3)',
  },
  supplierNavLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginBottom: 6,
  },
  supplierNavName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  supplierNavNameActive: {
    color: '#ff6a00',
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    width: 20,
    height: 3,
    backgroundColor: '#ff6a00',
    borderRadius: 2,
  },
  supplierCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  supplierCardGradient: {
    padding: 20,
  },
  supplierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  supplierInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  supplierLogo: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 12,
  },
  supplierDetails: {
    flex: 1,
  },
  supplierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  supplierName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
    marginRight: 8,
  },
  goldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  goldText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B8860B',
    marginLeft: 2,
  },
  supplierCountry: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginLeft: 4,
    marginRight: 8,
  },
  memberSince: {
    fontSize: 12,
    color: '#666',
  },
  supplierStats: {
    alignItems: 'flex-end',
  },
  statMini: {
    alignItems: 'center',
    marginBottom: 8,
  },
  statMiniNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ff6a00',
  },
  statMiniLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  businessInfo: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: 'rgba(74, 101, 114, 0.05)',
    borderRadius: 8,
  },
  businessType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A6572',
    marginBottom: 4,
  },
  employees: {
    fontSize: 12,
    color: '#666',
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 4,
  },
  levelBadge: {
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  levelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ff6a00',
  },
  responseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  responseText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2196F3',
    marginLeft: 4,
  },
  productsSection: {
    marginBottom: 20,
  },
  productsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  productTag: {
    backgroundColor: 'rgba(74, 101, 114, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  productTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A6572',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactButton: {
    flex: 1,
    marginRight: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  contactGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  contactText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  visitStoreButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.2)',
  },
  visitStoreText: {
    color: '#ff6a00',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  guaranteesContainer: {
    paddingHorizontal: 20,
  },
  guaranteesTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  guaranteesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  guaranteeItem: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  guaranteeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  guaranteeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  guaranteeDesc: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
});
