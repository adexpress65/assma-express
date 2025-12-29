// apps/mobile/app/seller/dashboard.tsx - VERSION AVEC DONNÉES RÉELLES
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView,
  Image
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { 
  collection, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/config/firebase';

interface SellerStats {
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  pendingOrders: number;
  averageRating: number;
  totalViews: number;
  totalFavorites: number;
}

interface RecentOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: any;
  items: any[];
}

interface CompanyData {
  name: string;
  logo: string;
  verified: boolean;
  goldSupplier: boolean;
  responseRate: number;
  totalOrders: number;
  rating: number;
}

interface QuickStat {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  bgColor: string;
}

export default function SellerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<SellerStats>({
    totalProducts: 0,
    totalSales: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    averageRating: 0,
    totalViews: 0,
    totalFavorites: 0
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quickStats, setQuickStats] = useState<QuickStat[]>([]);

  const menuItems = [
    { 
      label: "Ajouter produit", 
      icon: "add-circle", 
      href: "/seller/add-product",
      color: "#FF6B00",
      description: "Créer une nouvelle fiche produit"
    },
    { 
      label: "Mes produits", 
      icon: "cube", 
      href: "/seller/products",
      color: "#4CAF50",
      description: "Gérer mon catalogue"
    },
    { 
      label: "Analytiques", 
      icon: "stats-chart", 
      href: "/seller/analytics",
      color: "#2196F3",
      description: "Voir mes performances"
    },
    { 
      label: "Promotions", 
      icon: "pricetag", 
      href: "/seller/promotions",
      color: "#9C27B0",
      description: "Gérer les réductions"
    },
    { 
      label: "Commandes", 
      icon: "cart", 
      href: "/seller/orders",
      color: "#FF9800",
      description: "Suivre les commandes"
    },
    { 
      label: "Messages", 
      icon: "chatbubbles", 
      href: "/seller/messages",
      color: "#795548",
      description: "Répondre aux clients"
    },
    { 
      label: "Profil Entreprise", 
      icon: "business", 
      href: "/seller/profile",
      color: "#607D8B",
      description: "Modifier mes infos"
    },
    { 
      label: "Paramètres", 
      icon: "settings", 
      href: "/seller/settings",
      color: "#757575",
      description: "Préférences boutique"
    },
  ];

  // Charger toutes les données du vendeur
  const loadSellerData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Charger les données en parallèle pour plus de rapidité
      await Promise.all([
        loadCompanyData(),
        loadProductsStats(),
        loadOrdersStats(),
        loadRecentOrders(),
      ]);
      
      // Mettre à jour les statistiques rapides
      updateQuickStats();
      
    } catch (error) {
      console.error('❌ Erreur chargement dashboard vendeur:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Charger les données de l'entreprise
  const loadCompanyData = async () => {
    if (!user) return;

    try {
      const companyDoc = await getDoc(doc(db, 'companies', user.uid));
      
      if (companyDoc.exists()) {
        const data = companyDoc.data();
        setCompanyData({
          name: data.name || 'Mon Entreprise',
          logo: data.logo || 'https://via.placeholder.com/100x100/007AFF/ffffff?text=LOGO',
          verified: data.verified || data.verification?.verified || false,
          goldSupplier: data.goldSupplier || false,
          responseRate: data.responseRate || 0,
          totalOrders: data.totalOrders || data.stats?.orderCount || 0,
          rating: data.rating || data.stats?.rating || 0
        });
      } else {
        // Créer un profil d'entreprise par défaut
        setCompanyData({
          name: 'Mon Entreprise',
          logo: 'https://via.placeholder.com/100x100/007AFF/ffffff?text=LOGO',
          verified: false,
          goldSupplier: false,
          responseRate: 0,
          totalOrders: 0,
          rating: 0
        });
      }
    } catch (error) {
      console.error('Erreur chargement entreprise:', error);
    }
  };

  // Charger les statistiques des produits
  const loadProductsStats = async () => {
    if (!user) return;

    try {
      // Produits du vendeur
      const productsQuery = query(
        collection(db, 'products'),
        where('sellerId', '==', user.uid),
        where('isActive', '==', true)
      );
      const productsSnapshot = await getDocs(productsQuery);
      
      let totalViews = 0;
      let totalFavorites = 0;
      let totalSold = 0;
      let totalRevenue = 0;
      
      productsSnapshot.forEach(doc => {
        const product = doc.data();
        totalViews += product.viewCount || 0;
        totalFavorites += product.favoriteCount || 0;
        totalSold += product.soldCount || 0;
        
        // Calcul du revenu total
        if (product.soldCount && product.price) {
          totalRevenue += (product.soldCount * product.price);
        }
      });

      // Mettre à jour les stats
      setStats(prev => ({
        ...prev,
        totalProducts: productsSnapshot.size,
        totalSales: totalSold,
        totalRevenue: totalRevenue,
        totalViews: totalViews,
        totalFavorites: totalFavorites
      }));

    } catch (error) {
      console.error('Erreur chargement stats produits:', error);
    }
  };

  // Charger les statistiques des commandes
  const loadOrdersStats = async () => {
    if (!user) return;

    try {
      // Commandes du vendeur
      const ordersQuery = query(
        collection(db, 'orders'),
        where('sellerId', '==', user.uid)
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      
      let pendingOrders = 0;
      let totalRevenue = 0;
      let totalSales = 0;
      
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        
        // Commandes en attente
        if (order.status === 'pending' || order.status === 'processing') {
          pendingOrders++;
        }
        
        // Total des ventes
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            if (item.sellerId === user.uid) {
              totalSales += item.quantity || 0;
              totalRevenue += item.total || 0;
            }
          });
        }
      });

      // Mettre à jour les stats
      setStats(prev => ({
        ...prev,
        pendingOrders: pendingOrders,
        totalSales: prev.totalSales + totalSales,
        totalRevenue: prev.totalRevenue + totalRevenue
      }));

    } catch (error) {
      console.error('Erreur chargement stats commandes:', error);
    }
  };

  // Charger les commandes récentes
  const loadRecentOrders = async () => {
    if (!user) return;

    try {
      // Chercher d'abord dans la collection orders
      const ordersQuery = query(
        collection(db, 'orders'),
        where('sellerId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(5)
      );

      const snapshot = await getDocs(ordersQuery);
      
      if (!snapshot.empty) {
        const orders = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            customerName: data.customerName || data.billing?.name || 'Client',
            customerEmail: data.customerEmail || data.billing?.email || '',
            total: data.totalAmount || data.total || 0,
            status: data.status || 'pending',
            createdAt: data.createdAt,
            items: data.items || []
          };
        });
        setRecentOrders(orders);
      } else {
        // Si pas de commandes dans orders, chercher dans quoteRequests
        const quotesQuery = query(
          collection(db, 'quoteRequests'),
          where('supplierId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        
        const quotesSnapshot = await getDocs(quotesQuery);
        const quotes = quotesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            customerName: data.buyerName || 'Client',
            customerEmail: data.buyerEmail || '',
            total: 0, // Les devis n'ont pas encore de prix
            status: data.status || 'pending',
            createdAt: data.createdAt,
            items: []
          };
        });
        setRecentOrders(quotes);
      }
      
    } catch (error) {
      console.error('Erreur chargement commandes récentes:', error);
    }
  };

  // Mettre à jour les statistiques rapides
  const updateQuickStats = () => {
    const newQuickStats: QuickStat[] = [
      {
        label: "Produits actifs",
        value: stats.totalProducts,
        icon: "cube",
        color: "#FF6B00",
        bgColor: "#FFF3E8"
      },
      {
        label: "Ventes totales",
        value: stats.totalSales,
        icon: "trending-up",
        color: "#4CAF50",
        bgColor: "#E8F5E8"
      },
      {
        label: "Revenu total",
        value: `${Math.round(stats.totalRevenue).toLocaleString()} XOF`,
        icon: "cash",
        color: "#2196F3",
        bgColor: "#E3F2FD"
      },
      {
        label: "Commandes en attente",
        value: stats.pendingOrders,
        icon: "time",
        color: "#FF9800",
        bgColor: "#FFF3E0"
      },
      {
        label: "Vues produits",
        value: stats.totalViews,
        icon: "eye",
        color: "#9C27B0",
        bgColor: "#F3E5F5"
      },
      {
        label: "Favoris",
        value: stats.totalFavorites,
        icon: "heart",
        color: "#F44336",
        bgColor: "#FFEBEE"
      }
    ];
    
    setQuickStats(newQuickStats);
  };

  useEffect(() => {
    loadSellerData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadSellerData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'confirmed': return '#2196F3';
      case 'processing': return '#9C27B0';
      case 'shipped': return '#673AB7';
      case 'delivered': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'confirmed': return 'Confirmée';
      case 'processing': return 'En traitement';
      case 'shipped': return 'Expédiée';
      case 'delivered': return 'Livrée';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return '';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Chargement du dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* En-tête avec infos entreprise */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.companyInfo}>
              <Image 
                source={{ uri: companyData?.logo || 'https://via.placeholder.com/100x100/007AFF/ffffff?text=LOGO' }} 
                style={styles.companyLogo} 
              />
              <View style={styles.companyText}>
                <Text style={styles.companyName}>{companyData?.name || 'Mon Entreprise'}</Text>
                <View style={styles.badgesRow}>
                  {companyData?.verified && (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={12} color="#4CAF50" />
                      <Text style={styles.badgeText}>Vérifié</Text>
                    </View>
                  )}
                  {companyData?.goldSupplier && (
                    <View style={styles.goldBadge}>
                      <Ionicons name="diamond" size={12} color="#FFD700" />
                      <Text style={styles.badgeText}>Gold</Text>
                    </View>
                  )}
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#FF9800" />
                    <Text style={styles.badgeText}>{companyData?.rating?.toFixed(1) || '0.0'}</Text>
                  </View>
                </View>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => router.push('/seller/notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.welcomeText}>Bon retour, {user?.displayName?.split(' ')[0] || 'Vendeur'}!</Text>
          <Text style={styles.welcomeSubtext}>Voici l'aperçu de votre boutique</Text>
        </View>

        {/* Statistiques rapides */}
        <View style={styles.statsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aperçu rapide</Text>
            <TouchableOpacity onPress={() => router.push('/seller/analytics')}>
              <Text style={styles.seeAllText}>Détails →</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.statsScroll}
            contentContainerStyle={styles.statsScrollContent}
          >
            {quickStats.map((stat, index) => (
              <View key={index} style={styles.quickStatCard}>
                <View style={[styles.quickStatIcon, { backgroundColor: stat.bgColor }]}>
                  <Ionicons name={stat.icon as any} size={20} color={stat.color} />
                </View>
                <Text style={styles.quickStatValue}>{stat.value}</Text>
                <Text style={styles.quickStatLabel}>{stat.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Menu principal */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Gestion de boutique</Text>
          <View style={styles.menuGrid}>
            {menuItems.map((item, index) => (
              <TouchableOpacity 
                key={item.label} 
                style={styles.menuItem}
                onPress={() => router.push(item.href)}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuDescription}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Commandes récentes */}
        <View style={styles.ordersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Activité récente</Text>
            <TouchableOpacity onPress={() => router.push('/seller/orders')}>
              <Text style={styles.seeAllText}>Voir tout →</Text>
            </TouchableOpacity>
          </View>
          
          {recentOrders.length === 0 ? (
            <View style={styles.emptyOrders}>
              <Ionicons name="receipt" size={48} color="#E0E0E0" />
              <Text style={styles.emptyText}>Aucune activité récente</Text>
              <Text style={styles.emptySubtext}>
                Les nouvelles commandes et demandes de devis apparaîtront ici
              </Text>
              <TouchableOpacity 
                style={styles.createProductButton}
                onPress={() => router.push('/seller/add-product')}
              >
                <Text style={styles.createProductText}>Créer mon premier produit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentOrders.map((order) => (
              <TouchableOpacity 
                key={order.id} 
                style={styles.orderItem}
                onPress={() => {
                  if (order.total > 0) {
                    router.push(`/seller/orders/${order.id}`);
                  } else {
                    router.push(`/seller/quote-requests/${order.id}`);
                  }
                }}
              >
                <View style={styles.orderLeft}>
                  <View style={styles.orderCustomerInfo}>
                    <Ionicons name="person" size={16} color="#666" />
                    <Text style={styles.orderCustomer}>{order.customerName}</Text>
                  </View>
                  {order.customerEmail && (
                    <Text style={styles.orderEmail} numberOfLines={1}>
                      {order.customerEmail}
                    </Text>
                  )}
                  <Text style={styles.orderDate}>
                    {formatDate(order.createdAt)}
                  </Text>
                </View>
                
                <View style={styles.orderRight}>
                  {order.total > 0 ? (
                    <Text style={styles.orderAmount}>{order.total.toLocaleString()} XOF</Text>
                  ) : (
                    <Text style={styles.orderAmount}>Devis</Text>
                  )}
                  <View style={[styles.orderStatus, { backgroundColor: getStatusColor(order.status) + '20' }]}>
                    <Text style={[styles.orderStatusText, { color: getStatusColor(order.status) }]}>
                      {getStatusText(order.status)}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Section Insights */}
        <View style={styles.insightsSection}>
          <Text style={styles.sectionTitle}>Conseils pour booster vos ventes</Text>
          <View style={styles.insightsGrid}>
            <View style={styles.insightCard}>
              <Ionicons name="image" size={24} color="#FF6B00" />
              <Text style={styles.insightTitle}>Photos de qualité</Text>
              <Text style={styles.insightText}>
                Ajoutez au moins 3 photos HD de vos produits
              </Text>
            </View>
            <View style={styles.insightCard}>
              <Ionicons name="time" size={24} color="#4CAF50" />
              <Text style={styles.insightTitle}>Réponse rapide</Text>
              <Text style={styles.insightText}>
                Répondez aux messages dans les 24h
              </Text>
            </View>
            <View style={styles.insightCard}>
              <Ionicons name="pricetag" size={24} color="#2196F3" />
              <Text style={styles.insightTitle}>Promotions</Text>
              <Text style={styles.insightText}>
                Les produits en promo se vendent 3x plus
              </Text>
            </View>
            <View style={styles.insightCard}>
              <Ionicons name="star" size={24} color="#FFD700" />
              <Text style={styles.insightTitle}>Avis clients</Text>
              <Text style={styles.insightText}>
                Demandez des avis après chaque vente
              </Text>
            </View>
          </View>
        </View>

        {/* Espace pour le bas */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8F9FA" 
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6c757d',
  },
  header: {
    backgroundColor: '#FFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  companyLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
  },
  companyText: {
    flex: 1,
  },
  companyName: { 
    fontSize: 20, 
    fontWeight: "700", 
    color: "#1A1A1A",
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  goldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  notificationButton: {
    padding: 8,
  },
  welcomeText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#666',
  },
  statsSection: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  seeAllText: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '600',
  },
  statsScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  statsScrollContent: {
    gap: 12,
    paddingRight: 16,
  },
  quickStatCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    width: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  quickStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#6c757d',
  },
  menuSection: {
    padding: 16,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  menuItem: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 11,
    color: '#6c757d',
    lineHeight: 14,
  },
  ordersSection: {
    padding: 16,
    backgroundColor: '#FFF',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderLeft: {
    flex: 1,
    marginRight: 12,
  },
  orderCustomerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  orderCustomer: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  orderEmail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 11,
    color: '#999',
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 6,
  },
  orderStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyOrders: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9e9e9e',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 16,
  },
  createProductButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createProductText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  insightsSection: {
    padding: 16,
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  insightCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    alignItems: 'center',
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  insightText: {
    fontSize: 11,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 14,
  },
  bottomSpacer: {
    height: 80,
  },
});