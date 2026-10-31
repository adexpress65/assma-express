import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { productsIndex } from '../config/algolia';
import type { AlgoliaHit } from '../types/product';

interface Props {
  onSelectProduct?: (hit: AlgoliaHit) => void;
  placeholder?: string;
  hitsPerPage?: number;
}

export default function AlgoliaSearch({
  onSelectProduct,
  placeholder = 'Rechercher un produit…',
  hitsPerPage = 10,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AlgoliaHit[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { hits } = await productsIndex.search<AlgoliaHit>(text, { hitsPerPage });
      setResults(hits as AlgoliaHit[]);
    } catch (err) {
      console.error('[AlgoliaSearch] search error', err);
    } finally {
      setLoading(false);
    }
  }, [hitsPerPage]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={handleSearch}
        placeholder={placeholder}
        placeholderTextColor="#A0AEC0"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {loading && <ActivityIndicator style={styles.spinner} color="#FF6A00" />}
      <FlatList
        data={results}
        keyExtractor={(item) => item.objectID}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => onSelectProduct?.(item)}
          >
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name ?? item.objectID}
            </Text>
            {item.price != null && (
              <Text style={styles.itemPrice}>{item.price.toLocaleString()} XOF</Text>
            )}
          </TouchableOpacity>
        )}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
    color: '#2D3748',
  },
  spinner: { marginVertical: 8 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  itemName: { flex: 1, fontSize: 14, color: '#2D3748' },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#FF6A00', marginLeft: 8 },
});
