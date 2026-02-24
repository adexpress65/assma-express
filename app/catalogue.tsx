// apps/mobile/app/catalogue.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Image,
  TextInput,
  FlatList,
  StatusBar,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../src/config/firebase';


const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#FF6A00',
  secondary: '#FF8C00',
  background: '#F8F8F8',
  white: '#FFFFFF',
  text: '#2D3748',
  lightGray: '#E2E8F0',
  darkBlue: '#1E40AF',
  industrial: '#1E293B',
};

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  images?: string[];
  companyId: string;
  companyName?: string;
  categoryId?: string;
  categoryName?: string;
  stock?: number;
  moq?: number;
  unit?: string;
  isActive?: boolean;
  createdAt?: any;
  specifications?: Record<string, any>;
}

interface Category {
  id: string;
  name: string;
  image?: string;
  productCount?: number;
}

interface FilterState {
  minPrice: string;
  maxPrice: string;
  category: string | null;
  moq: string;
  sortBy: 'newest' | 'price_asc' | 'price_desc' | 'popular';
}

export default function CatalogueScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    minPrice: '',
    maxPrice: '',
    category: params.categoryId as string || null,
    moq: '',
    sortBy: 'newest',
  });

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch categories
      const categoriesQuery = query(
        collection(db, 'categories'),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      const categoriesList = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(categoriesList);

      // Build products query
      let productsQuery = query(
        collection(db, 'products'),
        where('isActive', '==', true)
      );

      // Apply filters
      // Note: Firestore doesn't support multiple inequality filters on different fields
      // For production, consider using a more advanced filtering strategy
      
      const productsSnapshot = await getDocs(productsQuery);
      let productsList = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];

      // Apply client-side filters
      if (filters.category) {
        productsList = productsList.filter(p => p.categoryId === filters.category);
      }
      
      if (filters.minPrice) {
        const min = parseFloat(filters.minPrice);
        productsList = productsList.filter(p => p.price >= min);
      }
      
      if (filters.maxPrice) {
        const max = parseFloat(filters.maxPrice);
        productsList = productsList.filter(p => p.price <= max);
      }
      
      if (filters.moq) {
        const moq = parseInt(filters.moq);
        productsList = productsList.filter(p => (p.moq || 0) >= moq);
      }

      // Apply sorting
      switch (filters.sortBy) {
        case 'price_asc':
          productsList.sort((a, b) => a.price - b.price);
          break;
        case 'price_desc':
          productsList.sort((a, b) => b.price - a.price);
          break;
        case 'newest':
          productsList.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || new Date(0);
            const dateB = b.createdAt?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          });
          break;
      }

      setProducts(productsList);
    } catch (error) {
      console.error('Erreur chargement catalogue:', error);
      Alert.alert('Erreur', 'Impossible de charger le catalogue');
    } finally {
      setLoading(false);
    }
  };

  const handleProductPress = (productId: string) => {
    router.push(`/product/${productId}`);
  };

  const handleRequestQuote = (productId: string) => {
    router.push(`/demande-devis?productId=${productId}`);
  };

  const handleCategoryPress = (categoryId: string) => {
    setFilters(prev => ({ ...prev, category: categoryId }));
  };

  const renderProductItem = ({ item }: { item: Product }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => handleProductPress(item.id)}
    >
      <View style={styles.productImageContainer}>
        {item.images && item.images.length > 0 ? (
          <Image source={{ uri: item.images[0] }} style={styles.productImage} />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Ionicons name="cube" size={32} color={COLORS.lightGray} />
          </View>
        )}
        {item.moq && (
          <View style={styles.moqBadge}>
            <Text style={styles.moqText}>MOQ: {item.moq}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        
        <Text style={styles.productCompany} numberOfLines={1}>
          {item.companyName || 'Fournisseur industriel'}
        </Text>
        
        <Text style={styles.productPrice}>
          {item.price?.toLocaleString()} FCFA
        </Text>
        
        {item.unit && (
          <Text style={styles.productUnit}>/{item.unit}</Text>
        )}
        
        <TouchableOpacity 
          style={styles.quoteButton}
          onPress={() => handleRequestQuote(item.id)}
        >
          <Ionicons name="document-text" size={16} color="#FFF" />
          <Text style={styles.quoteButtonText}>Demander devis</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <TouchableOpacity 
      style={[
        styles.categoryFilterItem,
        filters.category === item.id && styles.categoryFilterItemActive
      ]}
      onPress={() => handleCategoryPress(item.id)}
    >
      <Text style={[
        styles.categoryFilterText,
        filters.category === item.id && styles.categoryFilterTextActive
      ]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      
      {/* Header */}
      <LinearGradient
        colors={[COLORS.industrial, '#334155']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>CATALOGUE INDUSTRIEL</Text>
            <Text style={styles.headerSubtitle}>
              {products.length} produits disponibles
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="filter" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un produit..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      </LinearGradient>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Catégorie</Text>
            <FlatList
              data={categories}
              renderItem={renderCategoryItem}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesFilterList}
            />
          </View>
          
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Prix (FCFA)</Text>
            <View style={styles.priceInputs}>
              <View style={styles.priceInputContainer}>
                <Text style={styles.priceLabel}>Min</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0"
                  keyboardType="numeric"
                  value={filters.minPrice}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, minPrice: text }))}
                />
              </View>
              <View style={styles.priceInputContainer}>
                <Text style={styles.priceLabel}>Max</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="1000000"
                  keyboardType="numeric"
                  value={filters.maxPrice}
                  onChangeText={(text) => setFilters(prev => ({ ...prev, maxPrice: text }))}
                />
              </View>
            </View>
          </View>
          
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Quantité minimale (MOQ)</Text>
            <TextInput
              style={styles.moqInput}
              placeholder="Ex: 100"
              keyboardType="numeric"
              value={filters.moq}
              onChangeText={(text) => setFilters(prev => ({ ...prev, moq: text }))}
            />
          </View>
          
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Trier par</Text>
            <View style={styles.sortOptions}>
              {[
                { id: 'newest', label: 'Plus récents' },
                { id: 'price_asc', label: 'Prix croissant' },
                { id: 'price_desc', label: 'Prix décroissant' },
              ].map(option => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.sortOption,
                    filters.sortBy === option.id && styles.sortOptionActive
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, sortBy: option.id as any }))}
                >
                  <Text style={[
                    styles.sortOptionText,
                    filters.sortBy === option.id && styles.sortOptionTextActive
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.applyFiltersButton}
            onPress={() => setShowFilters(false)}
          >
            <Text style={styles.applyFiltersText}>Appliquer les filtres</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Products Grid */}
      <FlatList
        data={products}
        renderItem={renderProductItem}
        keyExtractor={item => item.id}
        numColumns={2}
        contentContainerStyle={styles.productsGrid}
        columnWrapperStyle={styles.productsRow}
        ListHeaderComponent={
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsText}>
              {products.length} produits trouvés
            </Text>
            {filters.category && (
              <TouchableOpacity 
                style={styles.clearFiltersButton}
                onPress={() => setFilters(prev => ({ ...prev, category: null }))}
              >
                <Ionicons name="close-circle" size={16} color={COLORS.primary} />
                <Text style={styles.clearFiltersText}>Effacer filtre</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search" size={64} color={COLORS.lightGray} />
            <Text style={styles.emptyStateTitle}>Aucun produit trouvé</Text>
            <Text style={styles.emptyStateText}>
              Aucun produit ne correspond à vos critères de recherche
            </Text>
            <TouchableOpacity 
              style={styles.resetFiltersButton}
              onPress={() => setFilters({
                minPrice: '',
                maxPrice: '',
                category: null,
                moq: '',
                sortBy: 'newest',
              })}
            >
              <Text style={styles.resetFiltersText}>Réinitialiser les filtres</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  filterButton: {
    padding: 8,
  },
  searchContainer: {
    marginTop: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
  },
  filtersPanel: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  filterSection: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.industrial,
    marginBottom: 10,
  },
  categoriesFilterList: {
    gap: 8,
  },
  categoryFilterItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  categoryFilterItemActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryFilterText: {
    fontSize: 12,
    color: COLORS.industrial,
    fontWeight: '500',
  },
  categoryFilterTextActive: {
    color: '#FFF',
  },
  priceInputs: {
    flexDirection: 'row',
    gap: 12,
  },
  priceInputContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.industrial,
  },
  moqInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.industrial,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  sortOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  sortOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sortOptionText: {
    fontSize: 12,
    color: COLORS.industrial,
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#FFF',
  },
  applyFiltersButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  applyFiltersText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  productsGrid: {
    padding: 16,
  },
  productsRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultsText: {
    fontSize: 14,
    color: COLORS.industrial,
    fontWeight: '600',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearFiltersText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  productCard: {
    width: (width - 48) / 2,
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  productImageContainer: {
    position: 'relative',
    height: 120,
    backgroundColor: '#F8F9FA',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moqBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(30, 64, 175, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  moqText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.industrial,
    marginBottom: 4,
    height: 32,
  },
  productCompany: {
    fontSize: 11,
    color: '#666',
    marginBottom: 6,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 2,
  },
  productUnit: {
    fontSize: 11,
    color: '#666',
    marginBottom: 10,
  },
  quoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  quoteButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.industrial,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  resetFiltersButton: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resetFiltersText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
});