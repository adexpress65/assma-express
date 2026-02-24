import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, Dimensions, RefreshControl, Animated, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../src/config/firebase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const COLORS = {
  primary: '#FF4444',
  secondary: '#FF6A00',
  text: '#333',
  textLight: '#777',
  white: '#FFFFFF',
  bg: '#F5F5F5'
};

interface FlashDeal {
  id: string;
  name: string;
  imageUrl: string;
  originalPrice: number;
  price: number;
  discount: number;
  soldCount: number;
  stock: number;
  progress: number;
  companyName: string;
}

export default function FlashDealsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deals, setDeals] = useState<FlashDeal[]>([]);
  const scrollY = useRef(new Animated.Value(0)).current;

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const productsRef = collection(db, 'products');
      
      // ✅ AJUSTEMENT DES FILTRES SELON TA DB
      // On récupère les produits dont le status est "published"
      const q = query(
        productsRef,
        where('status', '==', 'published'),
        orderBy('createdAt', 'desc'),
        limit(200)
      );

      const snapshot = await getDocs(q);
      const fetchedDeals: FlashDeal[] = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Calcul du prix et de la réduction
        const currentPrice = data.price || data.basePrice || 0;
        const oldPrice = data.originalPrice || currentPrice;
        
        // On calcule le pourcentage de réduction
        let discount = 0;
        if (oldPrice > currentPrice) {
          discount = Math.round(((oldPrice - currentPrice) / oldPrice) * 100);
        }

        // ✅ LOGIQUE DE RÉCUPÉRATION AUTOMATIQUE :
        // On affiche si : specialOffer est vrai OU newArrival est vrai OU s'il y a une réduction > 0
        const isFlash = data.specialOffer === true || data.newArrival === true || discount > 0;

        if (!isFlash) return null;

        return {
          id: doc.id,
          name: data.name || "Produit",
          imageUrl: data.mainImage || data.imageUrl || (data.images && data.images[0]),
          originalPrice: oldPrice,
          price: currentPrice,
          discount: discount > 0 ? discount : 5, // Affiche 5% par défaut si New Arrival
          soldCount: data.soldCount || 0,
          stock: data.stockQuantity || 100,
          companyName: data.companyName || "Usine",
          progress: Math.min(Math.round(((data.soldCount || 5) / (data.stockQuantity || 100)) * 100), 98),
        };
      }).filter(item => item !== null) as FlashDeal[];

      setDeals(fetchedDeals);
    } catch (error) {
      console.error("Erreur Firestore Flash Deals:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDeals(); }, []);

  const renderItem = (item: FlashDeal) => (
    <TouchableOpacity 
      key={item.id}
      style={styles.card} 
      onPress={() => router.push(`/product/${item.id}`)}
    >
      <View style={styles.discountBadge}>
        <Text style={styles.discountText}>-{item.discount}%</Text>
      </View>
      
      <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
      
      <View style={styles.cardBody}>
        <Text style={styles.companyName} numberOfLines={1}>{item.companyName}</Text>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        
        <View style={styles.priceRow}>
          <Text style={styles.price}>{item.price.toLocaleString()} F</Text>
          {item.originalPrice > item.price && (
            <Text style={styles.oldPrice}>{item.originalPrice.toLocaleString()} F</Text>
          )}
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${item.progress}%` }]} />
          </View>
          <Text style={styles.soldText}>{item.soldCount} vendus</Text>
        </View>

        <LinearGradient colors={['#FF4444', '#FF6A00']} style={styles.buyButton}>
          <Text style={styles.buyButtonText}>Acheter</Text>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FF4444', '#CC0000']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>VENTES FLASH</Text>
        <View style={styles.headerRight} />
      </LinearGradient>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 100 }} />
      ) : (
        <Animated.FlatList
          data={deals}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDeals} />}
          renderItem={({ item }) => renderItem(item)}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="flash-off" size={80} color="#CCC" />
              <Text style={styles.emptyText}>Aucune offre flash disponible</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { 
    paddingTop: 50, paddingBottom: 20, paddingHorizontal: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  backButton: { width: 40 },
  headerRight: { width: 40 },
  
  list: { padding: 10 },
  columnWrapper: { justifyContent: 'space-between' },
  
  card: {
    width: (SCREEN_WIDTH / 2) - 15,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5
  },
  discountBadge: {
    position: 'absolute', top: 8, right: 8, zIndex: 10,
    backgroundColor: '#FF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4
  },
  discountText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
  image: { width: '100%', height: 150 },
  cardBody: { padding: 10 },
  companyName: { fontSize: 10, color: COLORS.textLight, textTransform: 'uppercase' },
  productName: { fontSize: 13, fontWeight: '600', color: COLORS.text, height: 36, marginVertical: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  price: { color: COLORS.primary, fontWeight: '900', fontSize: 15, marginRight: 5 },
  oldPrice: { color: '#AAA', textDecorationLine: 'line-through', fontSize: 10 },
  
  progressContainer: { marginBottom: 10 },
  progressBarBg: { height: 5, backgroundColor: '#EEE', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#FFD700' },
  soldText: { fontSize: 9, color: '#888', marginTop: 3, fontWeight: '700' },
  
  buyButton: { borderRadius: 6, paddingVertical: 7, alignItems: 'center' },
  buyButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  
  emptyState: { alignItems: 'center', marginTop: 150 },
  emptyText: { color: '#999', marginTop: 10, fontSize: 16 }
});