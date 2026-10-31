// apps/mobile/app/seller/catalogue.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from "@/config/firebase";

const { width } = Dimensions.get('window');

export default function SellerCatalogue() {
  const router = useRouter();
  const { user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProducts();
  }, [user]);

  const loadProducts = async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      // On utilise sellerId qui correspond à l'UID de l'entreprise
      const q = query(
        collection(db, 'products'),
        where('sellerId', '==', user.uid),
        orderBy('updatedAt', 'desc'),
        limit(120),
      );
      
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setProducts(items);
      setFilteredProducts(items);
    } catch (error) {
      console.error("Erreur catalogue A2Express:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    const filtered = products.filter(item => 
      item.name?.toLowerCase().includes(text.toLowerCase()) ||
      item.categoryName?.toLowerCase().includes(text.toLowerCase())
    );
    setFilteredProducts(filtered);
  };

  const renderProductItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push({ pathname: '/seller/edit-product', params: { id: item.id } } as any)}
    >
      {/* Image principale du produit */}
      <Image 
        source={{ uri: item.mainImage || item.imageUrl }} 
        style={styles.image} 
        resizeMode="cover"
      />
      
      {/* Badge pour les offres spéciales ou nouveautés */}
      {item.specialOffer && (
        <View style={styles.promoBadge}>
          <Text style={styles.promoText}>OFFRE</Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.category}>{item.categoryName || 'Général'}</Text>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        
        <View style={styles.priceRow}>
          <Text style={styles.price}>{item.price?.toLocaleString()} {item.currency || 'XOF'}</Text>
          {item.originalPrice > item.price && (
            <Text style={styles.oldPrice}>{item.originalPrice?.toLocaleString()}</Text>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.stockInfo}>
            <Ionicons name="cube-outline" size={12} color="#666" />
            <Text style={styles.stockText}>
              {item.stockQuantity > 1000 ? '+999' : item.stockQuantity} dispos
            </Text>
          </View>
          <Text style={styles.variantText}>{item.variantCount || 0} var.</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Catalogue Usine</Text>
        <TouchableOpacity onPress={loadProducts} style={styles.iconBtn}>
          <Ionicons name="refresh" size={22} color="#FF6B00" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#999" />
        <TextInput
          style={styles.input}
          placeholder="Rechercher dans mes produits..."
          value={search}
          onChangeText={handleSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#FF6B00" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="file-tray-stacked-outline" size={50} color="#CCC" />
              <Text style={styles.emptyText}>Aucun produit trouvé</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15 },
  title: { fontSize: 20, fontWeight: '800', color: '#1A1A1A' },
  iconBtn: { padding: 5 },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F5F5F5', 
    marginHorizontal: 15, 
    paddingHorizontal: 15, 
    borderRadius: 12,
    marginBottom: 10
  },
  input: { flex: 1, height: 45, marginLeft: 10, fontSize: 14 },
  list: { padding: 10 },
  card: { 
    width: (width / 2) - 15, 
    backgroundColor: '#FFF', 
    margin: 5, 
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    overflow: 'hidden'
  },
  image: { width: '100%', height: 140, backgroundColor: '#F9F9F9' },
  promoBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: '#FF6B00', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  promoText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  content: { padding: 10 },
  category: { fontSize: 10, color: '#FF6B00', fontWeight: 'bold', textTransform: 'uppercase' },
  name: { fontSize: 13, fontWeight: '600', color: '#333', marginTop: 2, height: 35 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 5 },
  price: { fontSize: 14, fontWeight: '800', color: '#1A1A1A' },
  oldPrice: { fontSize: 11, color: '#AAA', textDecorationLine: 'line-through' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  stockInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stockText: { fontSize: 10, color: '#666' },
  variantText: { fontSize: 10, color: '#999', fontStyle: 'italic' },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#999', marginTop: 10 }
});