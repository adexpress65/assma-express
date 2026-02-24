// apps/mobile/app/super-admin/products.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Alert, Image, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface Product {
  id: string; // Champ problématique (vide dans Firestore)
  documentId: string; // ✅ On ajoute ce champ pour stocker le vrai ID Firestore
  name: string;
  price: number;
  supplier: string;
  images: string[];
  isActive: boolean;
  // Ajoutez d'autres champs si nécessaire
}

export default function ProductsScreen() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      const list: Product[] = snapshot.docs.map(doc => ({ 
        ...doc.data(), 
        documentId: doc.id, // ✅ Stocker le vrai ID du document Firestore
        id: doc.id // ✅ Écraser l'id vide avec le vrai ID (solution simple)
      } as Product));
      setProducts(list);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les produits');
      console.error('Erreur chargement produits:', error);
    } finally {
      setLoading(false);
    }
  };

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
              loadProducts(); // Recharger la liste
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer le produit');
              console.error('Erreur suppression:', error);
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (user && userRole === 'super-admin') {
      loadProducts();
    }
  }, [user]);

  const renderItem = ({ item }: { item: Product }) => (
    <View style={styles.card}>
      <Image source={{ uri: item.images?.[0] || 'https://via.placeholder.com/100' }} style={styles.image} />
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.supplier}>{item.supplier}</Text>
        <Text style={styles.price}>{item.price?.toLocaleString() || 0} XOF</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => router.push(`/super-admin/add-product?productId=${item.documentId || item.id}`)}>
          <Ionicons name="create-outline" size={22} color="#2196F3" style={styles.icon} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => deleteProduct(item.documentId || item.id, item.name)}>
          <Ionicons name="trash" size={22} color="#FF4444" style={styles.icon} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Chargement des produits...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestion des Produits</Text>
        <TouchableOpacity onPress={() => router.push('/super-admin/add-product')}>
          <Ionicons name="add-circle" size={28} color="#FF6B00" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        // ✅ Solution 1: Utiliser documentId (recommandé)
        keyExtractor={(item) => item.documentId || item.id}
        // ✅ Solution 2: Garantir l'unicité avec l'index (solution de secours)
        // keyExtractor={(item, index) => `${item.documentId || item.id || index}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="cube-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>Aucun produit trouvé</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FA' 
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#1A1A1A' 
  },
  list: { 
    padding: 16 
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  image: { 
    width: 60, 
    height: 60, 
    borderRadius: 8, 
    marginRight: 12 
  },
  info: { 
    flex: 1 
  },
  name: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#1A1A1A' 
  },
  supplier: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 2 
  },
  price: { 
    fontSize: 14, 
    color: '#FF6B00', 
    fontWeight: '600', 
    marginTop: 4 
  },
  actions: { 
    flexDirection: 'row', 
    gap: 12 
  },
  icon: { 
    marginLeft: 8 
  },
  empty: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingTop: 100 
  },
  emptyText: { 
    marginTop: 12, 
    fontSize: 16, 
    color: '#999' 
  },
});