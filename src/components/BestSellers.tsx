// mobile/src/components/BestSellers.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  StyleSheet, 
  ActivityIndicator,
  Alert 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getLocalizedProductText } from '../utils/productLocale';
import { db } from '../config/firebase';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';

interface BestSellersProps {
  sellerId: string;
}

export default function BestSellers({ sellerId }: BestSellersProps) {
  const router = useRouter();
  const { i18n } = useTranslation();
  const [bestSellers, setBestSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBestSellers();
  }, [sellerId]);

  const loadBestSellers = async () => {
    try {
      console.log('🛍️ Chargement bestsellers pour vendeur:', sellerId);
      
      const cap = 40;
      const sameSellerSnap = await getDocs(
        query(
          collection(db, 'products'),
          where('sellerId', '==', sellerId),
          limit(cap),
        ),
      );
      const allProducts: any[] = sameSellerSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      if (allProducts.length < 2) {
        const popularSnap = await getDocs(
          query(collection(db, 'products'), limit(cap)),
        );
        popularSnap.forEach((doc) => {
          allProducts.push({
            id: doc.id,
            ...doc.data(),
          });
        });
      }
      
      const sameSellerProducts = allProducts
        .filter((product) => product.sellerId === sellerId)
        .sort((a, b) => (b.orders || b.rating || 0) - (a.orders || a.rating || 0))
        .slice(0, 5);
      
      console.log(`📊 Produits même vendeur trouvés: ${sameSellerProducts.length}`);
      
      // 2. Si au moins 2 produits du même vendeur, les afficher
      if (sameSellerProducts.length >= 2) {
        setBestSellers(sameSellerProducts);
      } else {
        const popularProducts = allProducts
          .sort((a, b) => (b.orders || b.rating || 0) - (a.orders || a.rating || 0))
          .slice(0, 5);
        
        console.log('🎯 Affichage produits populaires généraux');
        setBestSellers(popularProducts);
      }
    } catch (error) {
      console.error('❌ Erreur chargement bestsellers:', error);
      // Fallback avec des produits qui existent
      setBestSellers(getFallbackProducts());
    } finally {
      setLoading(false);
    }
  };

  const getFallbackProducts = () => [
    {
      id: 'prod-sim-001',
      name: 'Cadenas Sécurité Renforcé Premium',
      imageUrl: 'https://images.unsplash.com/photo-1602488257133-6c43dffceacf?w=200&h=200&fit=crop',
      price: 1450,
      originalPrice: 1700,
      orders: 1247,
      rating: 4.9,
      sellerId: 'seller-123'
    },
    {
      id: 'prod-sim-002',
      name: 'Serrure Digitale Bluetooth Smart',
      imageUrl: 'https://images.unsplash.com/photo-1558002038-1055897e61b3?w=200&h=200&fit=crop',
      price: 3890,
      originalPrice: 4500,
      orders: 892,
      rating: 4.7,
      sellerId: 'seller-123'
    },
    {
      id: 'prod-sim-003',
      name: 'Lot Cadenas Voyage Sécurité 10pcs',
      imageUrl: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=200&h=200&fit=crop',
      price: 2150,
      originalPrice: 2800,
      orders: 1567,
      rating: 4.5,
      sellerId: 'seller-123'
    }
  ];

  const handleProductPress = (productId: string) => {
    console.log('🎯 Navigation BestSeller vers:', productId);
    router.push(`/product/${productId}`);
  };

  const handleAddToCart = (product: any, event: any) => {
    event.stopPropagation(); // Éviter la navigation
    const displayName = getLocalizedProductText(
      product.name,
      'name',
      product as Record<string, unknown>,
      i18n.language,
    );
    console.log('🛒 Ajout au panier:', displayName);
    Alert.alert('Succès', `${displayName} ajouté au panier`);
    // Ici tu intégreras ta logique panier réelle
  };

  const renderStars = (rating: number) => {
    return '⭐'.repeat(5);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Les meilleures ventes de cette boutique</Text>
        <ActivityIndicator size="small" color="#ff6a00" style={styles.loading} />
      </View>
    );
  }

  if (bestSellers.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Les meilleures ventes de cette boutique</Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
        {bestSellers.map((product) => {
          const displayName = getLocalizedProductText(
            product.name,
            'name',
            product as Record<string, unknown>,
            i18n.language,
          );
          return (
          <TouchableOpacity 
            key={product.id}
            style={styles.productCard}
            onPress={() => handleProductPress(product.id)}
          >
            {/* Badge Best Seller */}
            <View style={styles.bestSellerBadge}>
              <Text style={styles.bestSellerText}>🔥 BEST</Text>
            </View>

            <Image 
              source={{ uri: product.imageUrl }} 
              style={styles.productImage}
              resizeMode="cover"
            />
            
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {displayName}
              </Text>
              
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingStars}>{renderStars(product.rating || 4.5)}</Text>
                <Text style={styles.ratingValue}>{product.rating || 4.5}</Text>
                <Text style={styles.orders}>({product.orders || 100}+)</Text>
              </View>
              
              <View style={styles.priceContainer}>
                {product.originalPrice && (
                  <Text style={styles.originalPrice}>{product.originalPrice} F CFA</Text>
                )}
                <Text style={styles.price}>{product.price || '1 450'} F CFA</Text>
              </View>
              
              <TouchableOpacity 
                style={styles.addButton}
                onPress={(event) => handleAddToCart(product, event)}
              >
                <Text style={styles.addButtonText}>Ajouter au panier</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  loading: {
    marginVertical: 20,
  },
  scrollContainer: {
    marginBottom: 8,
  },
  scrollContent: {
    paddingRight: 8,
  },
  productCard: {
    marginRight: 12,
    width: 180,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    overflow: 'hidden',
    position: 'relative',
  },
  bestSellerBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ff4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 2,
  },
  bestSellerText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  productImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    height: 40,
    lineHeight: 18,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  ratingStars: {
    fontSize: 12,
    color: '#ff9500',
    marginRight: 4,
  },
  ratingValue: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
    fontWeight: '600',
  },
  orders: {
    fontSize: 11,
    color: '#999',
  },
  priceContainer: {
    marginBottom: 8,
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
    marginBottom: 2,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6a00',
  },
  addButton: {
    backgroundColor: '#ff6a00',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
