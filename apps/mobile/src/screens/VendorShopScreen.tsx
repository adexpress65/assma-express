// apps/mobile/src/screens/VendorShopScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, ScrollView, Image, TouchableOpacity, 
  StyleSheet, FlatList 
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import ProductCard from '../components/common/ProductCard';

export default function VendorShopScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { vendorId } = route.params;
  
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchVendorData();
  }, [vendorId]);

  const fetchVendorData = async () => {
    try {
      // Récupérer les infos du vendeur
      const vendorDoc = await getDoc(doc(db, 'suppliers', vendorId));
      if (vendorDoc.exists()) {
        setVendor({ id: vendorDoc.id, ...vendorDoc.data() });
      }

      // Récupérer les produits du vendeur
      const productsQuery = query(
        collection(db, 'products'), 
        where('supplierId', '==', vendorId)
      );
      const productsSnapshot = await getDocs(productsQuery);
      const vendorProducts = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setProducts(vendorProducts);
    } catch (error) {
      console.error('Error fetching vendor data:', error);
    }
  };

  if (!vendor) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement de la boutique...</Text>
      </View>
    );
  }

  const filteredProducts = products.filter(product => {
    switch (activeTab) {
      case 'bestsellers':
        return product.salesCount > 100;
      case 'new':
        return product.isNew;
      case 'promotions':
        return product.discountPercent > 0;
      default:
        return true;
    }
  });

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* En-tête du vendeur */}
        <View style={styles.vendorHeader}>
          <Image 
            source={{ uri: vendor.logo }} 
            style={styles.vendorLogo}
          />
          <View style={styles.vendorInfo}>
            <Text style={styles.vendorName}>{vendor.name}</Text>
            {vendor.isTopSupplier && (
              <View style={styles.topSupplierBadge}>
                <Ionicons name="trophy" size={14} color="#FFD700" />
                <Text style={styles.topSupplierText}>Top Supplier</Text>
              </View>
            )}
            <View style={styles.vendorStats}>
              <Text style={styles.vendorStat}>
                ⭐ {vendor.rating || 4.8}/5 • {vendor.satisfactionRate || 95}% satisfaction
              </Text>
              <Text style={styles.vendorStat}>
                {vendor.productCount || products.length} produits • Depuis {vendor.establishedYear || 2015}
              </Text>
            </View>
          </View>
        </View>

        {/* Statistiques du vendeur */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{vendor.responseRate || 98}%</Text>
            <Text style={styles.statLabel}>Taux de réponse</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{vendor.deliveryRate || 96}%</Text>
            <Text style={styles.statLabel}>Livraison à temps</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{vendor.transactionAmount || 1500}+</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
        </View>

        {/* Navigation par onglets */}
        <View style={styles.tabsContainer}>
          {[
            { id: 'all', label: 'Tous les produits' },
            { id: 'bestsellers', label: 'Best-sellers' },
            { id: 'new', label: 'Nouveautés' },
            { id: 'promotions', label: 'Promotions' }
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.activeTab]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Liste des produits */}
        <View style={styles.productsSection}>
          <View style={styles.productsHeader}>
            <Text style={styles.productsTitle}>
              {filteredProducts.length} produits
            </Text>
            <TouchableOpacity style={styles.filterButton}>
              <Ionicons name="filter" size={18} color="#6B6B6B" />
              <Text style={styles.filterText}>Filtrer</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredProducts}
            renderItem={({ item }) => (
              <View style={styles.productItem}>
                <ProductCard 
                  product={item}
                  variant="grid"
                  onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
                />
              </View>
            )}
            keyExtractor={(item) => item.id}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.productsRow}
          />
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F7F7F7',
  },
  vendorLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222222',
    marginBottom: 8,
  },
  topSupplierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  topSupplierText: {
    fontSize: 12,
    color: '#FF6A00',
    fontWeight: '600',
    marginLeft: 4,
  },
  vendorStats: {
    marginTop: 4,
  },
  vendorStat: {
    fontSize: 12,
    color: '#6B6B6B',
    marginBottom: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222222',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 16,
  },
  activeTab: {
    backgroundColor: '#FF6A00',
  },
  tabText: {
    fontSize: 12,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  productsSection: {
    padding: 16,
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  productsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222222',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#F7F7F7',
    borderRadius: 8,
  },
  filterText: {
    fontSize: 12,
    color: '#6B6B6B',
    marginLeft: 4,
  },
  productsRow: {
    justifyContent: 'space-between',
  },
  productItem: {
    width: '48%',
    marginBottom: 16,
  },
});
