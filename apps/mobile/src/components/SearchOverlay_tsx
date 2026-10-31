// apps/mobile/src/components/SearchOverlay.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Animated,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Image,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../config/firebase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

interface SearchResult {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  supplier?: string;
}

export default function SearchOverlay({
  visible,
  onClose,
  onSearch,
  searchQuery,
  onSearchChange,
}: SearchOverlayProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const inputRef = useRef<TextInput>(null);

  // Animation d'entrée/sortie
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      // Focus automatique sur l'input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setShowResults(false);
      setResults([]);
    }
  }, [visible]);

  // Recherche en temps réel
  useEffect(() => {
    if (searchQuery.length >= 2) {
      performSearch(searchQuery);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [searchQuery]);

  const performSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    
    setIsLoading(true);
    try {
      // Recherche dans Firestore
      const productsRef = collection(db, 'products');
      const q = query(
        productsRef,
        where('name', '>=', queryText),
        where('name', '<=', queryText + '\uf8ff'),
        limit(10)
      );
      
      const querySnapshot = await getDocs(q);
      const searchResults: SearchResult[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        searchResults.push({
          id: doc.id,
          name: data.name || 'Sans nom',
          price: data.price || 0,
          imageUrl: data.mainImage || data.imageUrl,
          supplier: data.supplier || data.companyName,
        });
      });
      
      setResults(searchResults);
      setShowResults(true);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (searchQuery.trim()) {
      Keyboard.dismiss();
      onSearch(searchQuery.trim());
    }
  };

  const handleResultPress = (item: SearchResult) => {
    Keyboard.dismiss();
    onClose();
    // Navigation vers le produit avec vérification de l'existence de l'ID
    if (item.id) {
      router.push({
        pathname: `/product/${item.id}`,
        params: { productId: item.id }
      });
    }
  };

  const clearSearch = () => {
    onSearchChange('');
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  };

  if (!visible) return null;

  return (
    <TouchableWithoutFeedback onPress={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
          <Animated.View style={[styles.content, { transform: [{ translateY: slideAnim }] }]}>
            {/* Barre de recherche */}
            <View style={styles.searchBar}>
              <TouchableOpacity onPress={onClose} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
              </TouchableOpacity>
              
              <View style={styles.inputContainer}>
                <Ionicons name="search-outline" size={20} color="#999" style={styles.searchIcon} />
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Rechercher des produits..."
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  onSubmitEditing={handleSubmit}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Résultats de recherche */}
            {showResults && (
              <View style={styles.resultsContainer}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#ff6a00" />
                  </View>
                ) : results.length > 0 ? (
                  <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.resultItem}
                        onPress={() => handleResultPress(item)}
                      >
                        {item.imageUrl ? (
                          <Image source={{ uri: item.imageUrl }} style={styles.resultImage} />
                        ) : (
                          <View style={styles.resultImagePlaceholder}>
                            <Ionicons name="image-outline" size={24} color="#ccc" />
                          </View>
                        )}
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultName} numberOfLines={2}>
                            {item.name}
                          </Text>
                          <Text style={styles.resultPrice}>
                            {item.price.toLocaleString()} CFA
                          </Text>
                          {item.supplier && (
                            <Text style={styles.resultSupplier} numberOfLines={1}>
                              {item.supplier}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      searchQuery.length >= 2 ? (
                        <View style={styles.emptyContainer}>
                          <Ionicons name="search-outline" size={48} color="#ccc" />
                          <Text style={styles.emptyText}>Aucun produit trouvé</Text>
                          <Text style={styles.emptySubText}>
                            Essayez avec d'autres mots-clés
                          </Text>
                        </View>
                      ) : null
                    }
                  />
                ) : searchQuery.length >= 2 && !isLoading ? (
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyText}>Aucun résultat</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Suggestions rapides */}
            {!showResults && searchQuery.length === 0 && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Recherches populaires</Text>
                <View style={styles.suggestionsList}>
                  {['Électronique', 'Mode', 'Maison', 'Sports', 'Beauté'].map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion}
                      style={styles.suggestionChip}
                      onPress={() => {
                        onSearchChange(suggestion);
                        setTimeout(() => handleSubmit(), 100);
                      }}
                    >
                      <Text style={styles.suggestionText}>{suggestion}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </Animated.View>
        </TouchableWithoutFeedback>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
  },
  content: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  resultsContainer: {
    maxHeight: SCREEN_HEIGHT - (Platform.OS === 'ios' ? 140 : 120),
    minHeight: 200,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  resultItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  resultImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  resultImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  resultPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ff6a00',
    marginBottom: 2,
  },
  resultSupplier: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  suggestionsContainer: {
    padding: 20,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  suggestionChip: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  suggestionText: {
    fontSize: 14,
    color: '#ff6a00',
    fontWeight: '500',
  },
});