import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc,
  doc 
} from 'firebase/firestore';
import { db } from '@/config/firebase';

interface Seller {
  id: string;
  displayName: string;
  email: string;
  status: 'active' | 'pending' | 'suspended';
  productCount: number;
  totalSales: number;
  totalRevenue: number;
  createdAt: any;
  phone?: string;
  storeName?: string;
}

export default function ManageSellers() {
  const router = useRouter();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [filteredSellers, setFilteredSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'suspended'>('all');

  // Charger tous les vendeurs
  const loadSellers = async () => {
    try {
      setLoading(true);
      
      const sellersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'seller'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(sellersQuery);
      const sellersData = snapshot.docs.map(doc => ({
        id: doc.id,
        displayName: doc.data().displayName || 'Vendeur',
        email: doc.data().email,
        status: doc.data().status || 'pending',
        productCount: doc.data().productCount || 0,
        totalSales: doc.data().totalSales || 0,
        totalRevenue: doc.data().totalRevenue || 0,
        createdAt: doc.data().createdAt,
        phone: doc.data().phone,
        storeName: doc.data().storeName
      }));
      
      setSellers(sellersData);
      setFilteredSellers(sellersData);
      
    } catch (error) {
      console.error('Erreur chargement vendeurs:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des vendeurs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filtrer les vendeurs
  useEffect(() => {
    let filtered = sellers;
    
    // Filtre par statut
    if (statusFilter !== 'all') {
      filtered = filtered.filter(seller => seller.status === statusFilter);
    }
    
    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(seller => 
        seller.displayName.toLowerCase().includes(query) ||
        seller.email.toLowerCase().includes(query) ||
        seller.storeName?.toLowerCase().includes(query)
      );
    }
    
    setFilteredSellers(filtered);
  }, [searchQuery, statusFilter, sellers]);

  useEffect(() => {
    loadSellers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadSellers();
  };

  // Changer le statut d'un vendeur
  const toggleSellerStatus = async (sellerId: string, currentStatus: string) => {
    try {
      let newStatus: 'active' | 'suspended';
      
      if (currentStatus === 'active') {
        newStatus = 'suspended';
      } else {
        newStatus = 'active';
      }
      
      await updateDoc(doc(db, 'users', sellerId), {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Mettre ÃƒÂ  jour l'ÃƒÂ©tat local
      setSellers(prev => prev.map(seller => 
        seller.id === sellerId ? { ...seller, status: newStatus } : seller
      ));
      
      Alert.alert('SuccÃƒÂ¨s', `Statut du vendeur mis ÃƒÂ  jour: ${newStatus === 'active' ? 'Actif' : 'Suspendu'}`);
      
    } catch (error) {
      console.error('Erreur mise ÃƒÂ  jour statut:', error);
      Alert.alert('Erreur', 'Impossible de mettre ÃƒÂ  jour le statut');
    }
  };

  // Approuver un vendeur en attente
  const approveSeller = async (sellerId: string) => {
    try {
      await updateDoc(doc(db, 'users', sellerId), {
        status: 'active',
        updatedAt: new Date()
      });
      
      setSellers(prev => prev.map(seller => 
        seller.id === sellerId ? { ...seller, status: 'active' } : seller
      ));
      
      Alert.alert('SuccÃƒÂ¨s', 'Vendeur approuvÃƒÂ© avec succÃƒÂ¨s');
      
    } catch (error) {
      console.error('Erreur approbation vendeur:', error);
      Alert.alert('Erreur', 'Impossible d\'approuver le vendeur');
    }
  };

  // Naviguer vers le profil dÃƒÂ©taillÃƒÂ©
  const navigateToSellerProfile = (sellerId: string) => {
    router.push(`/super-admin/sellers/${sellerId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'suspended': return '#F44336';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Actif';
      case 'pending': return 'En attente';
      case 'suspended': return 'Suspendu';
      default: return status;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Chargement des vendeurs...</Text>
        </View>
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
        {/* En-tÃƒÂªte */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Gestion des Vendeurs</Text>
            <Text style={styles.subtitle}>{sellers.length} vendeurs inscrits</Text>
          </View>
        </View>

        {/* Filtres et recherche */}
        <View style={styles.filtersSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#6c757d" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un vendeur..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#6c757d"
            />
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
          >
            <TouchableOpacity 
              style={[styles.filterButton, statusFilter === 'all' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('all')}
            >
              <Text style={[styles.filterText, statusFilter === 'all' && styles.filterTextActive]}>
                Tous ({sellers.length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.filterButton, statusFilter === 'active' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('active')}
            >
              <Text style={[styles.filterText, statusFilter === 'active' && styles.filterTextActive]}>
                Actifs ({sellers.filter(s => s.status === 'active').length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.filterButton, statusFilter === 'pending' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('pending')}
            >
              <Text style={[styles.filterText, statusFilter === 'pending' && styles.filterTextActive]}>
                En attente ({sellers.filter(s => s.status === 'pending').length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.filterButton, statusFilter === 'suspended' && styles.filterButtonActive]}
              onPress={() => setStatusFilter('suspended')}
            >
              <Text style={[styles.filterText, statusFilter === 'suspended' && styles.filterTextActive]}>
                Suspendus ({sellers.filter(s => s.status === 'suspended').length})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Liste des vendeurs */}
        <View style={styles.sellersList}>
          {filteredSellers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people" size={64} color="#e0e0e0" />
              <Text style={styles.emptyText}>
                {searchQuery || statusFilter !== 'all' 
                  ? 'Aucun vendeur ne correspond aux critÃƒÂ¨res' 
                  : 'Aucun vendeur inscrit'
                }
              </Text>
            </View>
          ) : (
            filteredSellers.map((seller) => (
              <View key={seller.id} style={styles.sellerCard}>
                <TouchableOpacity 
                  style={styles.sellerInfo}
                  onPress={() => navigateToSellerProfile(seller.id)}
                >
                  <View style={styles.sellerAvatar}>
                    <Ionicons name="person" size={24} color="#FFF" />
                  </View>
                  
                  <View style={styles.sellerDetails}>
                    <Text style={styles.sellerName}>{seller.displayName}</Text>
                    <Text style={styles.sellerEmail}>{seller.email}</Text>
                    {seller.storeName && (
                      <Text style={styles.sellerStore}>Ã°Å¸ÂÂª {seller.storeName}</Text>
                    )}
                    
                    <View style={styles.sellerStats}>
                      <Text style={styles.sellerStat}>{seller.productCount} produits</Text>
                      <Text style={styles.sellerStat}>{seller.totalSales} ventes</Text>
                      <Text style={styles.sellerStat}>{seller.totalRevenue}Ã¢â€šÂ¬ CA</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                
                <View style={styles.sellerActions}>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(seller.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(seller.status) }]}>
                      {getStatusText(seller.status)}
                    </Text>
                  </View>
                  
                  <View style={styles.actionButtons}>
                    {seller.status === 'pending' && (
                      <TouchableOpacity 
                        style={[styles.actionButton, styles.approveButton]}
                        onPress={() => approveSeller(seller.id)}
                      >
                        <Ionicons name="checkmark" size={16} color="#FFF" />
                      </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity 
                      style={[styles.actionButton, 
                        seller.status === 'active' ? styles.suspendButton : styles.activateButton
                      ]}
                      onPress={() => toggleSellerStatus(seller.id, seller.status)}
                    >
                      <Ionicons 
                        name={seller.status === 'active' ? 'pause' : 'play'} 
                        size={16} 
                        color="#FFF" 
                      />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.viewButton]}
                      onPress={() => navigateToSellerProfile(seller.id)}
                    >
                      <Ionicons name="eye" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6c757d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 2,
  },
  filtersSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#212529',
  },
  filtersScroll: {
    marginHorizontal: -4,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    marginHorizontal: 4,
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6c757d',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  sellersList: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 16,
  },
  sellerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  sellerInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  sellerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sellerDetails: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 2,
  },
  sellerEmail: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  sellerStore: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 6,
  },
  sellerStats: {
    flexDirection: 'row',
    gap: 8,
  },
  sellerStat: {
    fontSize: 11,
    color: '#6c757d',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sellerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  suspendButton: {
    backgroundColor: '#F44336',
  },
  activateButton: {
    backgroundColor: '#4CAF50',
  },
  viewButton: {
    backgroundColor: '#007AFF',
  },
});
