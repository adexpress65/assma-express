import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, Dimensions, RefreshControl, Animated, ActivityIndicator, Modal, FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getLocalizedProductText } from '../../src/utils/productLocale';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { isZeroDollarsShop } from '../../src/utils/zeroDollarsShop';
import ZeroDollarsFreeBadge from '../../src/components/ZeroDollarsFreeBadge';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  primary: '#FF4444',
  secondary: '#FF6A00',
  gold: '#FFD700',
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
  supplier?: string;
  isSuperPrice: boolean;
}

export default function FlashDealsScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deals, setDeals] = useState<FlashDeal[]>([]);
  const [showOverlay, setShowOverlay] = useState(true); 
  
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const fadeOutAnim = useRef(new Animated.Value(1)).current;

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const productsRef = collection(db, 'products');
      
      // On augmente la recherche initiale pour être sûr de trouver 50 produits valides après filtrage
      const q = query(
        productsRef, 
        where('status', '==', 'published'), 
        orderBy('createdAt', 'desc'), 
        limit(500) 
      );
      
      const snapshot = await getDocs(q);
      
      const fetchedDeals: FlashDeal[] = snapshot.docs.map(doc => {
        const data = doc.data();
        const currentPrice = data.price || data.basePrice || 0;
        
        // Filtre de prix strict (0 - 1000F)
        if (currentPrice > 1000 || currentPrice <= 0) return null;

        const oldPrice = data.originalPrice || currentPrice;
        let discount = 0;
        if (oldPrice > currentPrice) {
          discount = Math.round(((oldPrice - currentPrice) / oldPrice) * 100);
        }

        const isFlash = data.specialOffer === true || data.newArrival === true || discount > 0;
        if (!isFlash) return null;

        return {
          id: doc.id,
          name: data.name || "Produit",
          imageUrl: data.mainImage || data.imageUrl || (data.images && data.images[0]),
          originalPrice: oldPrice,
          price: currentPrice,
          discount: discount > 0 ? discount : 5, 
          soldCount: data.soldCount || 0,
          stock: data.stockQuantity || 100,
          companyName: data.companyName || data.supplier || "Boutique",
          supplier: data.supplier || data.companyName || "",
          progress: Math.min(Math.round(((data.soldCount || 5) / (data.stockQuantity || 100)) * 100), 98),
          isSuperPrice: currentPrice < 500
        };
      })
      .filter(item => item !== null)
      .slice(0, 50) as FlashDeal[]; // 🔥 LIMITE À 50 PRODUITS ICI

      setDeals(fetchedDeals);
    } catch (error) {
      console.error("Erreur Firestore:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeals();

    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeOutAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => setShowOverlay(false));
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const renderItem = (item: FlashDeal) => (
    <TouchableOpacity key={item.id} style={styles.card} onPress={() => router.push(`/product/${item.id}`)}>
      <View style={styles.discountBadge}>
        <Text style={styles.discountText}>-{item.discount}%</Text>
      </View>

      {item.isSuperPrice && (
        <Animated.View style={[styles.superPriceBadge, { opacity: blinkAnim }]}>
          <Ionicons name="flash" size={10} color="#000" />
          <Text style={styles.superPriceText}>SUPER PRIX</Text>
        </Animated.View>
      )}
      
      <View style={styles.imageWrap}>
        <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
        {isZeroDollarsShop({
          companyName: item.companyName,
          supplier: item.supplier,
        }) && (
          <View style={styles.flashZeroDollarsBadge}>
            <ZeroDollarsFreeBadge compact />
          </View>
        )}
      </View>
      
      <View style={styles.cardBody}>
        <Text style={styles.companyName} numberOfLines={1}>{item.companyName}</Text>
        <Text style={styles.productName} numberOfLines={2}>
          {getLocalizedProductText(
            item.name,
            'name',
            item as unknown as Record<string, unknown>,
            i18n.language,
          )}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{item.price.toLocaleString()} F</Text>
          {item.originalPrice > item.price && <Text style={styles.oldPrice}>{item.originalPrice.toLocaleString()} F</Text>}
        </View>
        <LinearGradient colors={['#FF4444', '#FF6A00']} style={styles.buyButton}>
          <Text style={styles.buyButtonText}>Acheter</Text>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Modal transparent visible={showOverlay} animationType="none">
        <Animated.View style={[styles.overlayContainer, { opacity: fadeOutAnim }]}>
          <LinearGradient colors={['rgba(255,68,68,0.95)', 'rgba(204,0,0,0.98)']} style={styles.overlayGradient}>
            <Animated.View style={{ opacity: blinkAnim, alignItems: 'center' }}>
              <Ionicons name="flash" size={100} color={COLORS.gold} />
              <Text style={styles.overlayTitle}>OFFRES EXPLOSIVES !</Text>
              <Text style={styles.overlaySubtitle}>Limite : 50 meilleures offres</Text>
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </Modal>

      <LinearGradient colors={['#FF4444', '#CC0000']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>VENTE FLASH (50)</Text>
            <Text style={styles.headerSubtitle}>MOINS DE 1000F</Text>
        </View>
        <View style={styles.headerRight} />
      </LinearGradient>

      {loading && !refreshing ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={{ marginTop: 10, color: COLORS.textLight }}>Recherche des pépites...</Text>
        </View>
      ) : (
        <FlatList
          data={deals}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDeals} />}
          renderItem={({ item }) => renderItem(item)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  overlayContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlayGradient: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  overlayTitle: { color: '#FFF', fontSize: 32, fontWeight: '900', textAlign: 'center' },
  overlaySubtitle: { color: COLORS.gold, fontSize: 18, fontWeight: '700', marginTop: 10 },
  header: { paddingTop: 50, paddingBottom: 20, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '900' },
  headerSubtitle: { color: '#FFD700', fontSize: 12, fontWeight: '700' },
  backButton: { width: 40 },
  headerRight: { width: 40 },
  list: { padding: 10 },
  columnWrapper: { justifyContent: 'space-between' },
  card: { width: (SCREEN_WIDTH / 2) - 15, backgroundColor: '#FFF', borderRadius: 12, marginBottom: 15, overflow: 'hidden', elevation: 4 },
  discountBadge: { position: 'absolute', top: 8, left: 8, zIndex: 10, backgroundColor: '#FF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  discountText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
  superPriceBadge: { position: 'absolute', top: 8, right: 8, zIndex: 10, backgroundColor: COLORS.gold, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#FFF' },
  superPriceText: { color: '#000', fontWeight: '900', fontSize: 8, marginLeft: 3 },
  imageWrap: { position: 'relative', width: '100%' },
  image: { width: '100%', height: 150 },
  flashZeroDollarsBadge: { position: 'absolute', bottom: 6, left: 6, zIndex: 12 },
  cardBody: { padding: 10 },
  companyName: { fontSize: 10, color: COLORS.textLight, textTransform: 'uppercase' },
  productName: { fontSize: 13, fontWeight: '600', color: COLORS.text, height: 36, marginVertical: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  price: { color: COLORS.primary, fontWeight: '900', fontSize: 15, marginRight: 5 },
  oldPrice: { color: '#AAA', textDecorationLine: 'line-through', fontSize: 10 },
  buyButton: { borderRadius: 6, paddingVertical: 7, alignItems: 'center' },
  buyButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
});
