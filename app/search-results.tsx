// apps/mobile/app/search-results.tsx - NOUVELLE PAGE
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SearchService } from '@/services/firebase/searchService';
import { SearchResultItem } from '@/components/search/SearchResults';

const { width } = Dimensions.get('window');

export default function SearchResultsPage() {
  const { query } = useLocalSearchParams<{ query: string }>();
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (query) {
      loadSearchResults();
    }
  }, [query]);

  const loadSearchResults = async () => {
    setLoading(true);
    try {
      // Utiliser la recherche complète
      const searchResults = await SearchService.searchAllProducts(query, { limit: 50 });
      setResults(searchResults);
    } catch (error) {
      console.error('Erreur chargement résultats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = (item: SearchResultItem) => {
    switch(item.type) {
      case 'product':
        router.push(`/product/${item.id}`);
        break;
      case 'category':
        router.push(`/category/${item.id}?name=${encodeURIComponent(item.name)}`);
        break;
      case 'company':
      case 'supplier':
        router.push(`/company/${item.id}?name=${encodeURIComponent(item.name)}`);
        break;
    }
  };

  const renderProductItem = (item: SearchResultItem) => (
    <TouchableOpacity
      key={`${item.type}-${item.id}`}
      style={styles.productCard}
      onPress={() => handleSelectProduct(item)}
    >
      <Image
        source={{ uri: item.imageUrl || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=400&fit=crop' }}
        style={styles.productImage}
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        
        {item.type === 'product' && item.price && (
          <Text style={styles.productPrice}>
            {item.price.toLocaleString()} {item.currency || 'FCFA'}
          </Text>
        )}
        
        {item.supplier && (
          <Text style={styles.supplier} numberOfLines={1}>
            {item.supplier}
          </Text>
        )}
        
        {item.category && (
          <Text style={styles.category} numberOfLines={1}>
            📁 {item.category}
          </Text>
        )}
        
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>
            {item.type === 'product' ? 'Produit' : 
             item.type === 'category' ? 'Catégorie' : 'Fournisseur'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6a00" />
        <Text style={styles.loadingText}>Recherche en cours...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            Résultats de recherche
          </Text>
          <Text style={styles.headerQuery}>
            "{query}"
          </Text>
        </View>
      </View>

      {/* Résultats */}
      <ScrollView 
        style={styles.resultsContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {results.length} résultat{results.length > 1 ? 's' : ''} trouvé{results.length > 1 ? 's' : ''}
          </Text>
        </View>

        {results.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>
              Aucun résultat
            </Text>
            <Text style={styles.emptySubtitle}>
              Essayez avec d'autres termes
            </Text>
          </View>
        ) : (
          <View style={styles.productsGrid}>
            {results.map((item) => renderProductItem(item))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

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
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  headerQuery: {
    fontSize: 14,
    color: '#666',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
  },
  resultsCount: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  productCard: {
    width: (width - 32) / 2 - 8,
    margin: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#f5f5f5',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    height: 36,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff6a00',
    marginBottom: 4,
  },
  supplier: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  category: {
    fontSize: 11,
    color: '#888',
    marginBottom: 8,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ff6a00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
});