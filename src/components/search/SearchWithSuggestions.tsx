// src/components/search/SearchWithSuggestions.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchService } from '@/services/searchService';
import { useRouter } from 'expo-router';

export default function SearchWithSuggestions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        fetchSuggestions();
      }, 300); // Debounce 300ms
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => clearTimeout(debounceTimer.current);
  }, [searchTerm]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const data = await SearchService.getSuggestions(searchTerm);
      
      // Combiner et formater les suggestions
      const combined = [
        ...data.products.map(p => ({ ...p, type: 'product' })),
        ...data.categories.map(c => ({ ...c, type: 'category' })),
        ...data.suppliers.map(s => ({ ...s, type: 'supplier' }))
      ];
      
      setSuggestions(combined);
      setShowSuggestions(combined.length > 0);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSuggestion = (item) => {
    setShowSuggestions(false);
    setSearchTerm(item.name);
    
    // Navigation selon le type
    switch(item.type) {
      case 'product':
        router.push(`/product/${item.id}`);
        break;
      case 'category':
        router.push(`/category/${item.id}`);
        break;
      case 'supplier':
        router.push(`/supplier/${item.id}`);
        break;
    }
  };

  const handleFullSearch = () => {
    if (searchTerm.trim()) {
      setShowSuggestions(false);
      router.push({
        pathname: '/search/results',
        params: { 
          query: searchTerm,
          searchType: 'full'
        }
      });
    }
  };

  const renderSuggestionItem = ({ item }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSelectSuggestion(item)}
    >
      <Ionicons 
        name={
          item.type === 'product' ? 'cube-outline' :
          item.type === 'category' ? 'list-outline' :
          'business-outline'
        } 
        size={18} 
        color="#666" 
      />
      <Text style={styles.suggestionText}>{item.name}</Text>
      <Text style={styles.suggestionType}>
        {item.type === 'product' ? 'Produit' :
         item.type === 'category' ? 'Catégorie' : 'Fournisseur'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" />
        <TextInput
          style={styles.input}
          placeholder="Rechercher produits, fournisseurs..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          onSubmitEditing={handleFullSearch}
          returnKeyType="search"
          onFocus={() => searchTerm.length >= 2 && setShowSuggestions(true)}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
        {loading && <ActivityIndicator size="small" color="#ff6a00" />}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            renderItem={renderSuggestionItem}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}
    </View>
  );
}