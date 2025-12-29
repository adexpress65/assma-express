// components/premium/PremiumHeader.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import SearchResults, { SearchResultItem } from '@/components/search/SearchResults';
import { SearchService } from '@/services/firebase/searchService';

const { width } = Dimensions.get('window');

export default function PremiumHeader() {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();
  const searchInputRef = useRef<TextInput>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Recherche avec debounce
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      setLoading(true);
      
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      
      debounceTimer.current = setTimeout(async () => {
        try {
          const results = await SearchService.getInstantSuggestions(searchQuery);
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch (error) {
          console.error('Erreur recherche:', error);
        } finally {
          setLoading(false);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
    }
    
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

  // NOUVELLE FONCTION : Navigation vers écran camera interne
  const openCamera = () => {
    // 1. Fermer le clavier avant navigation
    Keyboard.dismiss();
    
    // 2. Navigation vers l'écran camera (navigation interne)
    router.push('/camera');
    
    // 3. Optionnel : Fermer les suggestions si ouvertes
    setShowSuggestions(false);
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      cleanSearch();
      
      // Naviguer vers la page de recherche avec résultats complets
      router.push({
        pathname: '/search-results',
        params: { 
          query: searchQuery,
          timestamp: Date.now() // Éviter le cache
        }
      });
    }
  };

  const handleSelectSuggestion = (item: SearchResultItem) => {
    cleanSearch();
    
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
      default:
        router.push({
          pathname: '/search/results',
          params: { query: item.name }
        });
    }
  };

  const cleanSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  const handleOutsidePress = () => {
    Keyboard.dismiss();
    setShowSuggestions(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoidingView}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <TouchableWithoutFeedback onPress={handleOutsidePress}>
        <View>
         <LinearGradient
  colors={['#ff6a00', '#ff8c00']}
  style={[
    styles.container,
    { paddingTop: insets.top } // 🔥 PROTECTION STATUS BAR
  ]}
>

            {/* Top Bar */}
            <View style={styles.topBar}>
              <TouchableOpacity 
                style={styles.logoContainer}
                onPress={() => router.push('/')}
              >
                <Text style={styles.logoText}>ASSMA</Text>
                <View style={styles.betaBadge}>
                  <Text style={styles.betaText}>EXPRESS</Text>
                </View>
              </TouchableOpacity>
              
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.actionsScrollContainer}
                contentContainerStyle={styles.actionsContentContainer}
              >
                <TouchableOpacity 
                  style={styles.supplierButton}
                  onPress={() => router.push('/suppliers')}
                >
                  <Ionicons name="business-outline" size={18} color="#fff" />
                  <Text style={styles.supplierButtonText}>Fournisseurs</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.iconButton}
                  onPress={() => router.push('/messages')}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationText}>3</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.iconButton}
                  onPress={() => router.push('/notifications')}
                >
                  <Ionicons name="notifications-outline" size={20} color="#fff" />
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationText}>5</Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.iconButton}
                  onPress={() => router.push('/cart')}
                >
                  <Ionicons name="cart-outline" size={20} color="#fff" />
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationText}>2</Text>
                  </View>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Search Section */}
            <View style={styles.searchSection}>
              <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                  <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                  <TextInput
                    ref={searchInputRef}
                    style={styles.searchInput}
                    placeholder="Rechercher produits, fournisseurs, catégories..."
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearchSubmit}
                    returnKeyType="search"
                    onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                  />
                  {loading && (
                    <ActivityIndicator size="small" color="#ff6a00" style={styles.searchLoading} />
                  )}
                  {searchQuery.length > 0 && !loading && (
                    <TouchableOpacity 
                      style={styles.clearButton}
                      onPress={cleanSearch}
                    >
                      <Ionicons name="close-circle" size={18} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* BOUTON CAMÉRA MODIFIÉ : Navigation interne au lieu de système */}
                <TouchableOpacity 
                  style={styles.imageSearchButton}
                  onPress={openCamera}
                >
                  <Ionicons name="camera-outline" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Search Results */}
              {showSuggestions && (
                <View style={styles.searchResultsContainer}>
                  <SearchResults
                    results={suggestions}
                    onSelect={handleSelectSuggestion}
                    query={searchQuery}
                  />
                  
                  {suggestions.length > 0 && (
                    <TouchableOpacity
                      style={styles.seeAllButton}
                      onPress={handleSearchSubmit}
                    >
                      <Text style={styles.seeAllText}>
                        Voir tous les résultats pour "{searchQuery}"
                      </Text>
                      <Ionicons name="arrow-forward" size={16} color="#ff6a00" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Quick Stats */}
            <View style={styles.statsContainer}>
              <TouchableOpacity 
                style={styles.statItem}
                onPress={() => router.push('/products')}
              >
                <Text style={styles.statNumber}>50K+</Text>
                <Text style={styles.statLabel}>Produits</Text>
              </TouchableOpacity>
              
              <View style={styles.statDivider} />
              
              <TouchableOpacity 
                style={styles.statItem}
                onPress={() => router.push('/suppliers')}
              >
                <Text style={styles.statNumber}>10K+</Text>
                <Text style={styles.statLabel}>Fournisseurs</Text>
              </TouchableOpacity>
              
              <View style={styles.statDivider} />
              
              <TouchableOpacity 
                style={styles.statItem}
                onPress={() => router.push('/countries')}
              >
                <Text style={styles.statNumber}>150+</Text>
                <Text style={styles.statLabel}>Pays</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    position: 'relative',
    zIndex: 1001,
  },
  container: {
    paddingTop: Platform.OS === 'ios' ? 35 : 25,
    paddingHorizontal: 12,
    paddingBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 30,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: 6,
  },
  logoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  betaBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 3,
  },
  betaText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  actionsScrollContainer: {
    flex: 1,
    maxHeight: 35,
  },
  actionsContentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  supplierButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 4,
    flexShrink: 0,
  },
  supplierButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 3,
  },
  iconButton: {
    marginLeft: 4,
    position: 'relative',
    padding: 3,
    flexShrink: 0,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ff4444',
    borderRadius: 6,
    minWidth: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  notificationText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
  },
  searchSection: {
    position: 'relative',
    zIndex: 1002,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginRight: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 13,
    color: '#333',
  },
  searchLoading: {
    marginLeft: 8,
  },
  clearButton: {
    padding: 2,
    marginLeft: 4,
  },
  imageSearchButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1003,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff6a00',
    marginRight: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 4,
  },
  statItem: {
    alignItems: 'center',
    padding: 2,
  },
  statNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 1,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});