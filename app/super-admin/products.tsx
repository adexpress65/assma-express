// apps/mobile/app/super-admin/products.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, 
  Alert, Image, ActivityIndicator, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { 
  collection, getDocs, deleteDoc, doc, query, 
  where, orderBy, startAt, endAt, limit 
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface Product {
  id: string;
  documentId: string;
  name: string;
  nameLower?: string; // Champ utilisé pour la recherche
  price: number;
  supplier: string;
  images: string[];
  isActive: boolean;
}

export default function ProductsScreen() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Fonction de chargement des produits (Serveur)
  const loadProducts = async (searchText: string = '') => {
    if (!user) return;
    
    // Si c'est une recherche, on utilise un loader plus discret ou le principal
    if (searchText) setIsSearching(true);
    else setLoading(true);

    try {
      const productsRef = collection(db, 'products');
      let q;

      if (searchText.trim() !== '') {
        const term = searchText.toLowerCase();
        // Recherche sur nameLower (nécessite que le champ existe en base)
        q = query(
          productsRef,
          orderBy('nameLower'),
          startAt(term),
          endAt(term + '\uf8ff'),
          limit(50)
        );
      } else {
        // Liste par défaut (les 50 derniers produits par exemple)
        q = query(productsRef, orderBy('name'), limit(50));
      }

      const snapshot = await getDocs(q);
      const list: Product[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        documentId: doc.id,
        id: doc.id 
      } as Product));

      setProducts(list);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      Alert.alert('Erreur', 'Impossible de charger les produits. Vérifiez vos index Firestore.');
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  // Logique de "Debounce" pour la recherche
  useEffect(() => {
    if (user && userRole === 'super-admin') {
      const delayDebounceFn = setTimeout(() => {
        loadProducts(searchQuery);
      }, 500); // Délai de 500ms

      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery, user]);

  const deleteProduct = async (documentId: string, name: string) => {
    Alert.alert(
      'Supprimer le produit',
      `Êtes-vous sûr de vouloir supprimer "${name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'products', documentId));
              Alert.alert('Succès', 'Produit supprimé');
              loadProducts(searchQuery);
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer le produit');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: Product }) => (
    <View style={styles.card}>
      <Image 
        source={{ uri: item.images?.[0] || 'https://via.placeholder.com/100' }} 
        style={styles.image} 
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.supplier}>{item.supplier}</Text>
        <Text style={styles.price}>{item.price?.toLocaleString() || 0} XOF</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => router.push(`/super-admin/add-product?productId=${item.documentId}`)}>
          <Ionicons name="create-outline" size={22} color="#2196F3" style={styles.icon} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteProduct(item.documentId, item.name)}>
          <Ionicons name="trash" size={22} color="#FF4444" style={styles.icon} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Produits ({products.length})</Text>
        <TouchableOpacity onPress={() => router.push('/super-admin/add-product')}>
          <Ionicons name="add-circle" size={32} color="#FF6B00" />
        </TouchableOpacity>
      </View>

      {/* Barre de Recherche */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Rechercher un nom..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {isSearching && <ActivityIndicator size="small" color="#FF6B00" />}
          {searchQuery.length > 0 && !isSearching && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#CCC" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Liste des produits */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Initialisation...</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.documentId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>Aucun produit trouvé</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  searchSection: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 45,
  },
  searchIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, color: '#000' },
  list: { padding: 16 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  image: { width: 70, height: 70, borderRadius: 8, marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  supplier: { fontSize: 14, color: '#666' },
  price: { fontSize: 15, color: '#FF6B00', fontWeight: '700', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 15 },
  icon: { padding: 4 },
  loadingText: { marginTop: 10, color: '#666' },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 10, fontSize: 16, color: '#999' },
});
