// components/search/SearchResults.tsx
import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export interface SearchResultItem {
  id: string;
  type: 'product' | 'category' | 'company' | 'supplier';
  name: string;
  price?: number;
  currency?: string;
  supplier?: string;
  companyName?: string;
  featured?: boolean;
  imageUrl?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
}

interface SearchResultsProps {
  results: SearchResultItem[];
  onSelect: (item: SearchResultItem) => void;
  query?: string;
}

export default function SearchResults({ 
  results, 
  onSelect, 
  query = '' 
}: SearchResultsProps) {
  
  if (!results || results.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={32} color="#ccc" />
        <Text style={styles.emptyText}>
          {query ? `Aucun résultat pour "${query}"` : 'Commencez à taper pour rechercher...'}
        </Text>
      </View>
    );
  }

  const getIconForType = (type: string) => {
    switch(type) {
      case 'product': return 'cube-outline';
      case 'category': return 'list-outline';
      case 'company':
      case 'supplier': return 'business-outline';
      default: return 'search-outline';
    }
  };

  const getTypeLabel = (type: string) => {
    switch(type) {
      case 'product': return 'Produit';
      case 'category': return 'Catégorie';
      case 'company': return 'Entreprise';
      case 'supplier': return 'Fournisseur';
      default: return 'Résultat';
    }
  };

  const getFallbackImage = (type: string) => {
    switch(type) {
      case 'product':
        return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100&h=100&fit=crop';
      case 'category':
        return 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=100&h=100&fit=crop';
      case 'company':
      case 'supplier':
        return 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=100&h=100&fit=crop';
      default:
        return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100&h=100&fit=crop';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {results.length} résultat{results.length > 1 ? 's' : ''}
          {query && ` pour "${query}"`}
        </Text>
      </View>
      
      <ScrollView 
        style={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {results.map((item) => (
          <TouchableOpacity
            key={`${item.type}-${item.id}`}
            style={styles.resultItem}
            onPress={() => onSelect(item)}
            activeOpacity={0.7}
          >
            {/* Image */}
            <View style={styles.imageContainer}>
              <Image
                source={{ 
                  uri: item.imageUrl || getFallbackImage(item.type) 
                }}
                style={styles.resultImage}
                defaultSource={{ uri: getFallbackImage(item.type) }}
              />
              
              <View style={[
                styles.typeBadge,
                item.type === 'product' && styles.typeBadgeProduct,
                item.type === 'category' && styles.typeBadgeCategory,
                (item.type === 'company' || item.type === 'supplier') && styles.typeBadgeCompany,
              ]}>
                <Text style={styles.typeText}>
                  {getTypeLabel(item.type)}
                </Text>
              </View>
            </View>

            {/* Détails */}
            <View style={styles.detailsContainer}>
              <View style={styles.nameRow}>
                <Text style={styles.resultName} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.featured && (
                  <View style={styles.featuredBadge}>
                    <Ionicons name="star" size={12} color="#ffb800" />
                  </View>
                )}
              </View>

              {/* Prix */}
              {item.type === 'product' && item.price !== undefined && (
                <Text style={styles.resultPrice}>
                  {item.price.toLocaleString()} {item.currency || 'FCFA'}
                </Text>
              )}

              {/* Fournisseur/Entreprise */}
              {(item.supplier || item.companyName) && (
                <View style={styles.supplierRow}>
                  <Ionicons name="business-outline" size={12} color="#666" />
                  <Text style={styles.supplierText} numberOfLines={1}>
                    {item.supplier || item.companyName}
                  </Text>
                </View>
              )}

              {/* Catégorie */}
              {item.category && (
                <View style={styles.categoryRow}>
                  <Ionicons name="folder-outline" size={12} color="#888" />
                  <Text style={styles.categoryText} numberOfLines={1}>
                    {item.category}
                  </Text>
                </View>
              )}

              {/* Rating */}
              {item.rating !== undefined && item.rating > 0 && (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={12} color="#ffb800" />
                  <Text style={styles.ratingText}>
                    {item.rating.toFixed(1)}
                  </Text>
                  {item.reviewCount !== undefined && item.reviewCount > 0 && (
                    <Text style={styles.reviewCount}>
                      ({item.reviewCount} avis)
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Flèche */}
            <Ionicons 
              name="chevron-forward" 
              size={16} 
              color="#ccc" 
              style={styles.chevron}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 400,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  scrollContainer: {
    maxHeight: 350,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  resultImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeProduct: {
    backgroundColor: '#ff6a00',
  },
  typeBadgeCategory: {
    backgroundColor: '#4caf50',
  },
  typeBadgeCompany: {
    backgroundColor: '#2196f3',
  },
  typeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 6,
  },
  featuredBadge: {
    backgroundColor: '#fff8e6',
    padding: 2,
    borderRadius: 4,
  },
  resultPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff6a00',
    marginBottom: 4,
  },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  supplierText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  categoryText: {
    fontSize: 11,
    color: '#888',
    marginLeft: 4,
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
    marginRight: 6,
  },
  reviewCount: {
    fontSize: 11,
    color: '#888',
  },
  chevron: {
    marginLeft: 8,
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
