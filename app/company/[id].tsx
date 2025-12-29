// mobile/app/company/[id].tsx - VERSION CORRIGÉE
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  ActivityIndicator, 
  TouchableOpacity, 
  Image, 
  StyleSheet, 
  Dimensions,
  Alert,
  Linking
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../../src/config/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

const { width } = Dimensions.get('window');

interface Company {
  id: string;
  name: string;
  description: string;
  logo: string;
  coverImage: string;
  type: string;
  location: string;
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
}

interface Product {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  rating: number;
  orders: number;
  moq: number;
  companyId?: string;
  sellerId?: string;
}

// ✅ FONCTION DE NORMALISATION DES DONNÉES
const normalizeCompanyData = (data: any): Company => ({
  id: data.id || 'unknown',
  name: data.name || data.companyName || data.supplierName || 'Entreprise non spécifiée',
  description: data.description || data.about || 'Aucune description disponible.',
  logo: data.logo || data.imageUrl || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&h=100&fit=crop',
  coverImage: data.coverImage || data.bannerImage || 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&h=200&fit=crop',
  type: data.type || data.businessType || 'Non spécifié',
  location: data.location || data.address || data.country || 'Localisation inconnue',
  yearsOnPlatform: typeof data.yearsOnPlatform === 'number' ? data.yearsOnPlatform : 0,
  responseRate: typeof data.responseRate === 'number' ? data.responseRate : 0,
  responseTime: data.responseTime || 'Non spécifié',
  deliveryRate: typeof data.deliveryRate === 'number' ? data.deliveryRate : 0,
  totalProducts: typeof data.totalProducts === 'number' ? data.totalProducts : 0,
  totalOrders: typeof data.totalOrders === 'number' ? data.totalOrders : 0,
  rating: typeof data.rating === 'number' ? data.rating : 0,
  mainProducts: Array.isArray(data.mainProducts) ? data.mainProducts : ['Produits divers'],
  certifications: Array.isArray(data.certifications) ? data.certifications : ['En attente de certification'],
  businessType: data.businessType || data.type || 'Non spécifié',
  employees: data.employees || data.employeeCount || 'Non spécifié',
  annualRevenue: data.annualRevenue || data.revenue || 'Non spécifié',
  verified: Boolean(data.verified),
  goldSupplier: Boolean(data.goldSupplier),
  tradeAssurance: Boolean(data.tradeAssurance)
});

export default function CompanyProfile() {
  const { id } = useLocalSearchParams() as { id?: string };
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'about' | 'products' | 'reviews'>('about');

  useEffect(() => {
    if (!id) return;
    loadCompanyData();
  }, [id]);

  const loadCompanyData = async () => {
    try {
      setLoading(true);
      
      console.log('🔄 Chargement entreprise ID:', id);
      
      let companyData: any = null;
      let companyProducts: Product[] = [];

      // ✅ ÉTAPE 1: CHERCHER DANS LA COLLECTION "companies"
      try {
        const companyRef = doc(db, 'companies', id as string);
        const companySnap = await getDoc(companyRef);
        
        if (companySnap.exists()) {
          companyData = { id: companySnap.id, ...companySnap.data() };
          console.log('🏢 Compagnie trouvée dans collection companies:', companyData.name);
        }
      } catch (error) {
        console.log('⚠️ Compagnie non trouvée dans collection companies');
      }

      // ✅ ÉTAPE 2: CHERCHER DANS "sellers" SI PAS TROUVÉ
      if (!companyData) {
        try {
          const sellersQuery = query(
            collection(db, 'sellers'),
            where('id', '==', id)
          );
          const sellersSnap = await getDocs(sellersQuery);
          
          if (!sellersSnap.empty) {
            companyData = { 
              id: sellersSnap.docs[0].id, 
              ...sellersSnap.docs[0].data() 
            };
            console.log('🏢 Compagnie trouvée dans sellers:', companyData.name);
          }
        } catch (error) {
          console.log('⚠️ Compagnie non trouvée dans sellers');
        }
      }

      // ✅ ÉTAPE 3: CHERCHER DANS "suppliers" SI PAS TROUVÉ
      if (!companyData) {
        try {
          const suppliersQuery = query(
            collection(db, 'suppliers'),
            where('id', '==', id)
          );
          const suppliersSnap = await getDocs(suppliersQuery);
          
          if (!suppliersSnap.empty) {
            companyData = { 
              id: suppliersSnap.docs[0].id, 
              ...suppliersSnap.docs[0].data() 
            };
            console.log('🏢 Compagnie trouvée dans suppliers:', companyData.name);
          }
        } catch (error) {
          console.log('⚠️ Compagnie non trouvée dans suppliers');
        }
      }

      // ✅ ÉTAPE 4: CHERCHER LES PRODUITS DE CETTE COMPAGNIE
      try {
        const productsQuery = query(
          collection(db, 'products'),
          where('companyId', '==', id),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        
        const productsSnap = await getDocs(productsQuery);
        companyProducts = productsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Product));
        
        console.log(`📦 ${companyProducts.length} produits trouvés pour cette compagnie`);

        // ✅ FALLBACK: Chercher par sellerId si pas de produits trouvés
        if (companyProducts.length === 0) {
          const sellerProductsQuery = query(
            collection(db, 'products'),
            where('sellerId', '==', id),
            orderBy('createdAt', 'desc'),
            limit(20)
          );
          
          const sellerProductsSnap = await getDocs(sellerProductsQuery);
          companyProducts = sellerProductsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Product));
          
          console.log(`🔄 ${companyProducts.length} produits trouvés par sellerId`);
        }

      } catch (error) {
        console.log('⚠️ Erreur chargement produits compagnie');
      }

      // ✅ ÉTAPE 5: UTILISER LES DONNÉES RÉELLES OU FALLBACK
      if (companyData) {
        const normalizedData = normalizeCompanyData(companyData);
        setCompany(normalizedData);
        setProducts(companyProducts);
      } else {
        // ✅ FALLBACK INTELLIGENT: Utiliser les données du premier produit
        if (companyProducts.length > 0) {
          const firstProduct = companyProducts[0];
          const fallbackCompany = {
            id: id,
            name: firstProduct.supplier || 'Compagnie ASMA Express',
            description: `Fournisseur de ${firstProduct.name} et autres produits de qualité.`,
            type: 'Fournisseur Certifié',
            location: 'International',
            totalProducts: companyProducts.length
          };
          const normalizedData = normalizeCompanyData(fallbackCompany);
          setCompany(normalizedData);
          setProducts(companyProducts);
          console.log('🔄 Utilisation données compagnie déduites des produits');
        } else {
          // ✅ DERNIER FALLBACK: Données génériques
          const fallbackData = getFallbackCompany();
          const normalizedData = normalizeCompanyData({ ...fallbackData, id });
          setCompany(normalizedData);
          setProducts(getFallbackProducts());
          console.log('🔄 Utilisation données compagnie génériques');
        }
      }

    } catch (error) {
      console.error('❌ Erreur chargement entreprise:', error);
      
      // ✅ FALLBACK GARANTI
      const fallbackData = getFallbackCompany();
      const normalizedData = normalizeCompanyData({ ...fallbackData, id });
      setCompany(normalizedData);
      setProducts(getFallbackProducts());
      
      Alert.alert('Information', 'Chargement des données de démonstration');
    } finally {
      setLoading(false);
    }
  };

  const getFallbackCompany = () => ({
    name: 'Compagnie ASMA Express',
    description: 'Fournisseur professionnel de produits de qualité sur ASMA Express.',
    logo: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&h=100&fit=crop',
    coverImage: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&h=200&fit=crop',
    type: 'Fournisseur Certifié',
    location: 'Plateforme ASMA Express',
    yearsOnPlatform: 1,
    responseRate: 95,
    responseTime: '24-48 heures',
    deliveryRate: 90,
    totalProducts: 0,
    totalOrders: 0,
    rating: 4.5,
    mainProducts: ['Produits divers'],
    certifications: ['Certifié ASMA Express'],
    businessType: 'Fournisseur',
    employees: 'Information non disponible',
    annualRevenue: 'Information non disponible',
    verified: true,
    goldSupplier: false,
    tradeAssurance: true
  });

  const getFallbackProducts = (): Product[] => [
    {
      id: 'prod-1',
      name: 'Produit de démonstration',
      imageUrl: 'https://via.placeholder.com/200x200/ff6a00/ffffff?text=ASMA+Express',
      price: 1000,
      rating: 4.5,
      orders: 0,
      moq: 1
    }
  ];

  const handleProductPress = (productId: string) => {
    router.push(`/product/${productId}`);
  };

  const handleContactSupplier = () => {
    Alert.alert(
      'Contacter le fournisseur',
      'Ouvrir la messagerie ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Ouvrir', onPress: () => router.push(`/chat?sellerId=${id}`) }
      ]
    );
  };

  const handleVisitStore = () => {
    // ✅ REDIRECTION VERS LA BOUTIQUE RÉELLE
    if (company) {
      router.push({
        pathname: '/store/[id]',
        params: { id: company.id, name: encodeURIComponent(company.name) }
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6a00" />
        <Text style={styles.loadingText}>Chargement de la compagnie...</Text>
      </View>
    );
  }

  if (!company) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Entreprise introuvable</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Bannière et logo */}
        <View style={styles.header}>
          <Image 
            source={{ uri: company.coverImage }} 
            style={styles.coverImage}
          />
          <View style={styles.logoContainer}>
            <Image 
              source={{ uri: company.logo }} 
              style={styles.logo}
            />
          </View>
        </View>

        {/* Informations principales */}
        <View style={styles.mainInfo}>
          <View style={styles.companyHeader}>
            <Text style={styles.companyName}>{company.name}</Text>
            <View style={styles.badges}>
              {company.verified && <Text style={styles.verifiedBadge}>✅ Vérifié</Text>}
              {company.goldSupplier && <Text style={styles.goldBadge}>🏆 Gold Supplier</Text>}
              {company.tradeAssurance && <Text style={styles.taBadge}>🛡️ Trade Assurance</Text>}
            </View>
          </View>

          <Text style={styles.companyType}>{company.type}</Text>
          <Text style={styles.companyLocation}>📍 {company.location}</Text>

          {/* Statistiques */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{company.yearsOnPlatform}+</Text>
              <Text style={styles.statLabel}>Ans sur ASMA</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{company.responseRate}%</Text>
              <Text style={styles.statLabel}>Taux de réponse</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{company.deliveryRate}%</Text>
              <Text style={styles.statLabel}>Livraison à temps</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{products.length}+</Text>
              <Text style={styles.statLabel}>Produits</Text>
            </View>
          </View>

          {/* Boutons d'action */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.contactButton} onPress={handleContactSupplier}>
              <Text style={styles.contactButtonText}>Contacter le fournisseur</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.storeButton} onPress={handleVisitStore}>
              <Text style={styles.storeButtonText}>Visiter la boutique</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Navigation par onglets */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'about' && styles.activeTab]}
            onPress={() => setActiveTab('about')}
          >
            <Text style={[styles.tabText, activeTab === 'about' && styles.activeTabText]}>
              À propos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'products' && styles.activeTab]}
            onPress={() => setActiveTab('products')}
          >
            <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
              Produits ({products.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'reviews' && styles.activeTab]}
            onPress={() => setActiveTab('reviews')}
          >
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.activeTabText]}>
              Avis
            </Text>
          </TouchableOpacity>
        </View>

        {/* Contenu des onglets */}
        <View style={styles.tabContent}>
          {activeTab === 'about' && (
            <View style={styles.aboutSection}>
              <Text style={styles.sectionTitle}>À propos de l'entreprise</Text>
              <Text style={styles.description}>{company.description}</Text>
              
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Type d'entreprise</Text>
                  <Text style={styles.detailValue}>{company.businessType}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Effectif</Text>
                  <Text style={styles.detailValue}>{company.employees}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Chiffre d'affaires</Text>
                  <Text style={styles.detailValue}>{company.annualRevenue}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Temps de réponse</Text>
                  <Text style={styles.detailValue}>{company.responseTime}</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Produits principaux</Text>
              <View style={styles.productTags}>
                {company.mainProducts.map((product, index) => (
                  <Text key={index} style={styles.productTag}>{product}</Text>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Certifications</Text>
              <View style={styles.certifications}>
                {company.certifications.map((cert, index) => (
                  <Text key={index} style={styles.certification}>{cert}</Text>
                ))}
              </View>
            </View>
          )}

          {activeTab === 'products' && (
            <View style={styles.productsSection}>
              <Text style={styles.sectionTitle}>Produits de {company.name}</Text>
              {products.length > 0 ? (
                <View style={styles.productsGrid}>
                  {products.map((product) => (
                    <TouchableOpacity 
                      key={product.id}
                      style={styles.productCard}
                      onPress={() => handleProductPress(product.id)}
                    >
                      <Image 
                        source={{ uri: product.imageUrl }} 
                        style={styles.productImage}
                      />
                      <Text style={styles.productName} numberOfLines={2}>
                        {product.name}
                      </Text>
                      <Text style={styles.productPrice}>{product.price.toLocaleString()} F CFA</Text>
                      <Text style={styles.productMoq}>MOQ: {product.moq} pièces</Text>
                      <View style={styles.productRating}>
                        <Text style={styles.ratingStars}>⭐ {product.rating}</Text>
                        <Text style={styles.orders}>({product.orders})</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyProducts}>
                  <Text style={styles.emptyText}>Aucun produit disponible pour le moment</Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'reviews' && (
            <View style={styles.reviewsSection}>
              <Text style={styles.sectionTitle}>Avis sur la boutique</Text>
              <View style={styles.ratingOverview}>
                <Text style={styles.overallRating}>{company.rating}</Text>
                <View>
                  <Text style={styles.ratingStars}>⭐⭐⭐⭐⭐</Text>
                  <Text style={styles.reviewCount}>Basé sur {company.totalOrders} commandes</Text>
                </View>
              </View>
              <Text style={styles.comingSoon}>Section avis en cours de développement...</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// Les styles restent identiques...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#ff6a00',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // ... (tous les autres styles restent identiques)
  header: {
    position: 'relative',
  },
  coverImage: {
    width: width,
    height: 150,
  },
  logoContainer: {
    position: 'absolute',
    bottom: -30,
    left: 16,
    backgroundColor: '#fff',
    padding: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  mainInfo: {
    padding: 16,
    paddingTop: 40,
    backgroundColor: '#fff',
  },
  companyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  verifiedBadge: {
    fontSize: 10,
    color: '#28a745',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  goldBadge: {
    fontSize: 10,
    color: '#ffa000',
    backgroundColor: '#fff8e1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  taBadge: {
    fontSize: 10,
    color: '#1976d2',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  companyType: {
    fontSize: 16,
    color: '#666',
    marginBottom: 4,
  },
  companyLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff6a00',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 2,
    backgroundColor: '#ff6a00',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  storeButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ff6a00',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  storeButtonText: {
    color: '#ff6a00',
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    backgroundColor: '#fafafa',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#ff6a00',
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#ff6a00',
    fontWeight: '600',
  },
  tabContent: {
    padding: 16,
  },
  aboutSection: {
    gap: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  detailsGrid: {
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  productTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  productTag: {
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 12,
    fontWeight: '500',
  },
  certifications: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  certification: {
    backgroundColor: '#f8f9fa',
    color: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '500',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  productsSection: {
    gap: 16,
  },
  productsGrid: {
    gap: 12,
  },
  productCard: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  productImage: {
    width: '100%',
    height: 120,
    borderRadius: 6,
    marginBottom: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    height: 40,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6a00',
    marginBottom: 2,
  },
  productMoq: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  productRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStars: {
    fontSize: 12,
    color: '#ff9500',
    marginRight: 4,
  },
  orders: {
    fontSize: 12,
    color: '#666',
  },
  emptyProducts: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  reviewsSection: {
    gap: 16,
  },
  ratingOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    gap: 16,
  },
  overallRating: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ff6a00',
  },
  reviewCount: {
    fontSize: 14,
    color: '#666',
  },
  comingSoon: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 20,
  },
});