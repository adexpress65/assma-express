import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useAuth } from '../../src/contexts/AuthContext';

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  stock: number;
  status: 'approved' | 'pending' | 'rejected';
  sales: number;
  createdAt: any;
}

interface Stats {
  totalSales: number;
  activeProducts: number;
  pendingProducts: number;
  totalRevenue: number;
}

export default function SellerDashboard() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalSales: 0,
    activeProducts: 0,
    pendingProducts: 0,
    totalRevenue: 0
  });
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);

  const loadDashboardData = async () => {
    try {
      if (!user) return;

      const productsQuery = query(
        collection(db, 'products'),
        where('sellerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const productsSnapshot = await getDocs(productsQuery);
      const products = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];

      const totalSales = products.reduce((sum, product) => sum + (product.sales || 0), 0);
      const activeProducts = products.filter(p => p.status === 'approved').length;
      const pendingProducts = products.filter(p => p.status === 'pending').length;
      const totalRevenue = products.reduce((sum, product) => sum + (product.price * (product.sales || 0)), 0);

      setStats({
        totalSales,
        activeProducts,
        pendingProducts,
        totalRevenue
      });

      setRecentProducts(products.slice(0, 5));

    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      Alert.alert('Erreur', 'Impossible de charger les donnÃ©es');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const navigateToSellerProducts = () => {
    router.push({ pathname: '/seller/products' } as any);
  };

  const navigateToSellerOrders = () => {
    router.push({ pathname: '/seller/orders' } as any);
  };

  const navigateToSellerAddProduct = () => {
    router.push({ pathname: '/seller/add-product' } as any);
  };

  const navigateToSellerAnalytics = () => {
    router.push({ pathname: '/seller/analytics' } as any);
  };

  if (userRole !== 'seller' && userRole !== 'super-admin' && userRole !== 'admin') {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#ff6a00" />
        <Text style={styles.errorTitle}>AccÃ¨s RefusÃ©</Text>
        <Text style={styles.errorText}>
          Vous n'avez pas les permissions nÃ©cessaires pour accÃ©der Ã  cette page.
        </Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6a00" />
        <Text style={styles.loadingText}>Chargement du tableau de bord...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Tableau de Bord Vendeur</Text>
        <Text style={styles.subtitle}>Bienvenue sur ASMA Express</Text>
        
        <View style={styles.accountStatus}>
          <Ionicons name="shield-checkmark" size={16} color="#4CAF50" />
          <Text style={styles.accountStatusText}>
            Compte {userRole === 'super-admin' ? 'Super Admin' : userRole === 'admin' ? 'Admin' : 'Vendeur'} - VÃ©rifiÃ©
          </Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#e3f2fd' }]}>
            <Ionicons name="trending-up" size={24} color="#1976d2" />
          </View>
          <Text style={styles.statValue}>{stats.totalSales}</Text>
          <Text style={styles.statLabel}>Ventes Total</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#e8f5e8' }]}>
            <Ionicons name="cube" size={24} color="#4caf50" />
          </View>
          <Text style={styles.statValue}>{stats.activeProducts}</Text>
          <Text style={styles.statLabel}>Produits Actifs</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#fff3e0' }]}>
            <Ionicons name="time" size={24} color="#ff6a00" />
          </View>
          <Text style={styles.statValue}>{stats.pendingProducts}</Text>
          <Text style={styles.statLabel}>En Attente</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: '#fce4ec' }]}>
            <Ionicons name="cash" size={24} color="#e91e63" />
          </View>
          <Text style={styles.statValue}>{stats.totalRevenue.toFixed(0)}â‚¬</Text>
          <Text style={styles.statLabel}>Chiffre d'Affaires</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions Rapides</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={navigateToSellerAddProduct}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#e8f5e8' }]}>
              <Ionicons name="add-circle" size={28} color="#4caf50" />
            </View>
            <Text style={styles.actionText}>Ajouter Produit</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={navigateToSellerProducts}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#e3f2fd' }]}>
              <Ionicons name="list" size={28} color="#1976d2" />
            </View>
            <Text style={styles.actionText}>Mes Produits</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={navigateToSellerOrders}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#fff3e0' }]}>
              <Ionicons name="cart" size={28} color="#ff6a00" />
            </View>
            <Text style={styles.actionText}>Commandes</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={navigateToSellerAnalytics}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#f3e5f5' }]}>
              <Ionicons name="analytics" size={28} color="#7b1fa2" />
            </View>
            <Text style={styles.actionText}>Statistiques</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Produits RÃ©cents</Text>
          <TouchableOpacity onPress={navigateToSellerProducts}>
            <Text style={styles.seeAllText}>Voir tout</Text>
          </TouchableOpacity>
        </View>

        {recentProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>Aucun produit ajoutÃ©</Text>
            <TouchableOpacity 
              style={styles.addFirstProductBtn}
              onPress={navigateToSellerAddProduct}
            >
              <Text style={styles.addFirstProductText}>âž• Ajouter mon premier produit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          recentProducts.map(product => (
            <TouchableOpacity key={product.id} style={styles.productItem}>
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>
                  {product.name}
                </Text>
                <Text style={styles.productPrice}>{product.price}â‚¬ â€¢ Stock: {product.stock}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                product.status === 'approved' ? styles.statusActive : 
                product.status === 'pending' ? styles.statusPending : styles.statusInactive
              ]}>
                <Text style={styles.statusText}>
                  {product.status === 'approved' ? 'âœ… Actif' : 
                   product.status === 'pending' ? 'â³ En attente' : 'âŒ RejetÃ©'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.reminderCard}>
        <Ionicons name="information-circle" size={24} color="#1976d2" />
        <View style={styles.reminderText}>
          <Text style={styles.reminderTitle}>Votre boutique ASMA Express</Text>
          <Text style={styles.reminderDescription}>
            GÃ©rez vos produits, suivez vos ventes et dÃ©veloppez votre business
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
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
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff6a00',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#ff6a00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  accountStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  accountStatusText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
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
    color: '#1a1a1a',
  },
  seeAllText: {
    fontSize: 14,
    color: '#ff6a00',
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 16,
  },
  addFirstProductBtn: {
    backgroundColor: '#ff6a00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstProductText: {
    color: '#fff',
    fontWeight: '600',
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    color: '#ff6a00',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#e8f5e8',
  },
  statusPending: {
    backgroundColor: '#fff3e0',
  },
  statusInactive: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reminderCard: {
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 12,
  },
  reminderText: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 4,
  },
  reminderDescription: {
    fontSize: 14,
    color: '#1976d2',
    opacity: 0.8,
  },
});

