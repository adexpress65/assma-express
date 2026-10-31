import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalizedProductText } from '../../src/utils/productLocale';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, Platform 
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { 
  collection, query, where, getDocs, limit, startAfter 
} from 'firebase/firestore';
import { db } from '../../src/config/firebase'; 

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  mainImage?: string | null;
  imageUrl?: string | null;
  supplier: string;
  isVerified: boolean;
}

const PAGE_SIZE = 20;

// 1. CARTE PRODUIT (Optimisée avec React.memo)
const OptimizedProductCard = React.memo(function OptimizedProductCard({
  product,
}: {
  product: Product;
}) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const displayName = useMemo(
    () =>
      getLocalizedProductText(
        product.name,
        'name',
        product as unknown as Record<string, unknown>,
        i18n.language,
      ),
    [product, i18n.language],
  );
  const imageUrl = product.mainImage || product.imageUrl;

  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => router.push(`/product/${product.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <Image 
            source={{ uri: imageUrl }} 
            style={styles.image} 
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk" 
          />
        ) : (
          <View style={styles.imageFallback}><Ionicons name="gift" size={30} color="#ccc" /></View>
        )}
        <View style={styles.freeBadge}><Text style={styles.freeBadgeText}>GRATUIT</Text></View>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{displayName}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>0 CFA</Text>
          {product.originalPrice && <Text style={styles.oldPrice}>{product.originalPrice} CFA</Text>}
        </View>
        <View style={styles.meta}>
          <Ionicons 
            name={product.supplier?.includes("Zéro") ? "gift" : "business-outline"} 
            size={12} 
            color={product.supplier?.includes("Zéro") ? "#00B050" : "#666"} 
          />
          <Text style={[styles.supplier, product.supplier?.includes("Zéro") && { color: '#00B050', fontWeight: '800' }]} numberOfLines={1}>
            {product.supplier}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// 2. PAGE PRINCIPALE
export default function ZeroDollarsShop() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  // ✅ FONCTION DE CHARGEMENT SÉCURISÉE (Pas de boucle infinie)
  const loadProducts = async (isInitial = false) => {
    if (loadingMore || (!isInitial && !hasMore)) return;

    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    try {
      // Requête sur le prix 0 ou 1 (Zéro Dollars)
      let q = query(
        collection(db, "products"),
        where("price", "in", [0, 1]),
        limit(PAGE_SIZE)
      );

      if (!isInitial && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snapshot = await getDocs(q);
      
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];

      setProducts(prev => isInitial ? fetched : [...prev, ...fetched]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(fetched.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // ✅ UN SEUL APPEL AU DÉMARRAGE
  useEffect(() => {
    loadProducts(true);
  }, []);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Collection Zéro Dollars", headerShadowVisible: false }} />

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#00B050" /></View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={({ item }) => <View style={styles.cardWrapper}><OptimizedProductCard product={item} /></View>}
          onEndReached={() => loadProducts(false)}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 20 }} color="#00B050" /> : null}
          ListEmptyComponent={
            <View style={styles.centerEmpty}>
              <Ionicons name="gift-outline" size={80} color="#ddd" />
              <Text style={styles.emptyTextTitle}>Aucun cadeau pour le moment.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 10 },
  columnWrapper: { justifyContent: 'space-between' },
  cardWrapper: { width: '48.5%', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F0', elevation: 2 },
  imageContainer: { height: 160, backgroundColor: '#FAFAFA' },
  image: { width: '100%', height: '100%' },
  imageFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  freeBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: '#00B050', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  freeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  info: { padding: 10 },
  name: { fontSize: 13, fontWeight: '600', color: '#1a1a1a', height: 36 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  price: { fontSize: 16, fontWeight: '800', color: '#00B050', marginRight: 8 },
  oldPrice: { color: '#ff4444', fontSize: 10, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', alignItems: 'center' },
  supplier: { fontSize: 11, color: '#666', marginLeft: 4, flex: 1 },
  centerEmpty: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyTextTitle: { marginTop: 16, fontSize: 16, color: '#666', textAlign: 'center' },
});