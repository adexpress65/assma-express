import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Dimensions 
} from 'react-native';
import { Image } from 'expo-image'; // Meilleure performance pour les images
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getLocalizedProductText } from '@/utils/productLocale';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '@/config/firebase';

const { width } = Dimensions.get('window');

export default function TrendingProductsScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [products, setProducts] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  // 1. CHARGEMENT DES DONNÉES DEPUIS FIRESTORE
// 1. CHARGEMENT DES DONNÉES DEPUIS FIRESTORE
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        setLoading(true);
        const productsRef = collection(db, "products");
        let q;

        // Si on est sur l'onglet "all" dans l'écran Trending, 
        // on cherche les produits qui ont trending: true
        if (activeCategory === 'all') {
          q = query(
            productsRef,
            where("isActive", "==", true),
            where("trending", "==", true), // C'est cette ligne qui manquait !
            limit(30)
          );
        } else {
          // Si l'utilisateur choisit une catégorie spécifique (ex: Bébé)
          q = query(
            productsRef,
            where("isActive", "==", true),
            where("categoryId", "==", activeCategory),
            limit(30)
          );
        }

        const querySnapshot = await getDocs(q);
        const fetchedProducts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setProducts(fetchedProducts);
      } catch (error) {
        console.error("🔥 Erreur lors de la récupération des produits:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, [activeCategory]); // Re-charge si on change de catégorie

  // 2. FILTRAGE LOCAL (Pour la barre de recherche)
  const filteredProducts = products.filter(product => {
    return product.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // 3. RENDU D'UN PRODUIT
  const renderProduct = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => router.push(`/product/${item.id}`)}
    >
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: item.mainImage || item.imageUrl || 'https://via.placeholder.com/150' }} 
          style={styles.productImage}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        {item.specialOffer && (
          <View style={styles.promoBadge}>
            <Text style={styles.promoText}>PROMO</Text>
          </View>
        )}
      </View>
      
      <View style={styles.productDetails}>
        <Text style={styles.productName} numberOfLines={2}>
          {getLocalizedProductText(
            item.name,
            'name',
            item as Record<string, unknown>,
            i18n.language,
          )}
        </Text>
        <Text style={styles.productPrice}>
          {item.price?.toLocaleString()} <Text style={styles.currency}>FCFA</Text>
        </Text>
        <View style={styles.statsRow}>
          <Ionicons name="star" size={12} color="#FFD700" />
          <Text style={styles.statsText}>{item.rating || '5.0'} • {item.soldCount || 0} vendus</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput 
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>
      </View>

      {/* LISTE DES PRODUITS */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6A00" />
          <Text style={styles.loadingText}>Mise à jour du stock...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="shirt-outline" size={60} color="#CCC" />
              <Text style={styles.emptyText}>Aucun produit actif pour le moment</Text>
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
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  backButton: { marginRight: 12 },
  searchBar: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F0F0F0', 
    borderRadius: 25, 
    paddingHorizontal: 15,
    height: 45
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 14, color: '#333' },
  listContainer: { padding: 8 },
  productCard: { 
    width: (width / 2) - 16, 
    backgroundColor: '#FFF', 
    margin: 8, 
    borderRadius: 15, 
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
  },
  imageContainer: { width: '100%', height: 170, backgroundColor: '#F0F0F0' },
  productImage: { width: '100%', height: '100%' },
  promoBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#FF6A00',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  promoText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  productDetails: { padding: 12 },
  productName: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 4, height: 40 },
  productPrice: { fontSize: 16, fontWeight: 'bold', color: '#FF6A00' },
  currency: { fontSize: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  statsText: { fontSize: 11, color: '#888' },
  loadingText: { marginTop: 15, color: '#666' },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 10, color: '#999', fontSize: 16, textAlign: 'center', paddingHorizontal: 40 }
});
