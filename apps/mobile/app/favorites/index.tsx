// apps/mobile/app/favorites/index.tsx - VERSION FINALE
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getLocalizedProductText } from '../../src/utils/productLocale';
import { useAuth } from '../../src/contexts/AuthContext';
import { db } from '../../src/config/firebase';
import { 
  collection, 
  query, 
  onSnapshot,
  doc,
  deleteDoc,
  getDoc
} from 'firebase/firestore';

interface FavoriteItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  rating?: number;
  sales?: number;
  inStock: boolean;
  addedAt: Date;
  loading?: boolean;
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fonction pour charger les infos détaillées d'un produit
  const loadProductDetails = async (productId: string) => {
    try {
      const productDoc = await getDoc(doc(db, 'products', productId));
      if (productDoc.exists()) {
        const productData = productDoc.data();
        return {
          name: productData.name || productData.productName || 'Produit',
          price: productData.price || productData.prix || 0,
          originalPrice: productData.originalPrice || productData.oldPrice,
          imageUrl: productData.imageUrl || productData.image || productData.images?.[0],
          rating: productData.rating || productData.stars,
          sales: productData.sales || productData.orders,
          inStock: productData.inStock !== false && productData.stock > 0,
        };
      }
    } catch (error) {
      console.error(`Erreur chargement produit ${productId}:`, error);
    }
    return null;
  };

  useEffect(() => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    const favoritesQuery = query(
      collection(db, 'users', user.uid, 'favorites')
    );

    const unsubscribe = onSnapshot(
      favoritesQuery,
      async (snapshot) => {
        try {
          console.log(`📦 ${snapshot.size} favoris trouvés dans Firestore`);
          
          // Initialiser avec les données basiques
          const basicFavorites = snapshot.docs.map((docSnapshot) => {
            const data = docSnapshot.data();
            const docId = docSnapshot.id;
            
            return {
              id: docId,
              productId: data.productId || data.id || docId,
              name: data.productName || data.name || 'Produit',
              price: data.price || 0,
              originalPrice: data.originalPrice,
              imageUrl: data.imageUrl || data.image,
              rating: data.rating,
              sales: data.sales,
              inStock: data.inStock !== false,
              addedAt: data.addedAt?.toDate() || new Date(),
              loading: true, // Marquer comme en chargement
            };
          });
          
          setFavorites(basicFavorites);
          
          // Charger les détails pour chaque produit
          const detailedFavorites = await Promise.all(
            basicFavorites.map(async (favorite) => {
              const productDetails = await loadProductDetails(favorite.productId);
              
              if (productDetails) {
                return {
                  ...favorite,
                  ...productDetails,
                  loading: false,
                };
              }
              
              // Si pas de détails, garder les données de base
              return {
                ...favorite,
                loading: false,
              };
            })
          );
          
          setFavorites(detailedFavorites);
          console.log(`✅ ${detailedFavorites.length} favoris chargés avec détails`);
          
        } catch (error) {
          console.error('Erreur chargement favoris:', error);
          Alert.alert('Erreur', 'Impossible de charger les favoris');
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      (error) => {
        console.error('Erreur écoute Firestore:', error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    // Le useEffect se re-déclenchera automatiquement
  };

  const removeFromFavorites = async (favoriteId: string, productName: string) => {
    if (!user) return;

    Alert.alert(
      'Retirer des favoris',
      `Voulez-vous retirer "${productName}" de vos favoris ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'users', user.uid, 'favorites', favoriteId));
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de retirer ce produit');
            }
          }
        }
      ]
    );
  };

  const formatPrice = (price: number) => {
    if (!price && price !== 0) return '-- DH';
    return `${price.toLocaleString('fr-FR')} DH`;
  };

  const calculateDiscount = (price: number, originalPrice?: number) => {
    if (!price || !originalPrice || originalPrice <= price) return null;
    return Math.round((1 - price / originalPrice) * 100);
  };

  // Écran de chargement initial
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes Favoris</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.loadingText}>Chargement des favoris...</Text>
        </View>
      </View>
    );
  }

  // Écran non connecté
  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes Favoris</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centerContainer}>
          <Ionicons name="heart-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>Connectez-vous</Text>
          <Text style={styles.emptyText}>
            Connectez-vous pour voir vos produits favoris
          </Text>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => router.push('/(tabs)/account')}
          >
            <Text style={styles.primaryButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Favoris</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/')}>
          <Ionicons name="search" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B00']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>
          {favorites.length} {favorites.length === 1 ? 'produit' : 'produits'} favori{favorites.length > 1 ? 's' : ''}
        </Text>

        {favorites.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="heart-outline" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>Aucun favori</Text>
            <Text style={styles.emptyText}>
              Ajoutez des produits à vos favoris pour les retrouver facilement
            </Text>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => router.push('/products')}
            >
              <Text style={styles.primaryButtonText}>Parcourir les produits</Text>
            </TouchableOpacity>
          </View>
        ) : (
          favorites.map((item) => {
            const discount = calculateDiscount(item.price, item.originalPrice);
            const isLoading = item.loading;
            const displayName = getLocalizedProductText(
              item.name,
              'name',
              item as unknown as Record<string, unknown>,
              i18n.language,
            );

            return (
              <TouchableOpacity 
                key={item.id}
                style={styles.productCard}
                onPress={() => router.push(`/product/${item.productId}`)}
                activeOpacity={0.7}
                disabled={isLoading}
              >
                {isLoading ? (
                  <View style={styles.loadingCard}>
                    <ActivityIndicator size="small" color="#FF6B00" />
                    <Text style={styles.loadingCardText}>Chargement...</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.productImage}>
                      {item.imageUrl ? (
                        <Image 
                          source={{ uri: item.imageUrl }} 
                          style={styles.productImageContent}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.imagePlaceholder}>
                          <Ionicons name="image-outline" size={32} color="#CCC" />
                        </View>
                      )}
                      
                      {discount && discount > 0 && (
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountText}>-{discount}%</Text>
                        </View>
                      )}

                      <TouchableOpacity 
                        style={styles.favoriteButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          removeFromFavorites(item.id, displayName);
                        }}
                      >
                        <Ionicons name="heart" size={20} color="#FF4444" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {item.name}
                      </Text>

                      {item.rating && item.rating > 0 && (
                        <View style={styles.ratingContainer}>
                          <View style={styles.ratingStars}>
                            <Ionicons name="star" size={14} color="#FFD700" />
                            <Text style={styles.rating}>{item.rating.toFixed(1)}</Text>
                          </View>
                          {item.sales && item.sales > 0 && (
                            <Text style={styles.orders}>
                              {item.sales.toLocaleString()} ventes
                            </Text>
                          )}
                        </View>
                      )}

                      <View style={styles.priceContainer}>
                        <Text style={styles.currentPrice}>
                          {formatPrice(item.price)}
                        </Text>
                        {item.originalPrice && item.originalPrice > item.price && (
                          <Text style={styles.originalPrice}>
                            {formatPrice(item.originalPrice)}
                          </Text>
                        )}
                      </View>

                      {!item.inStock && (
                        <Text style={styles.outOfStock}>Rupture de stock</Text>
                      )}
                    </View>

                    <TouchableOpacity 
                      style={[
                        styles.cartButton,
                        !item.inStock && styles.cartButtonDisabled
                      ]}
                      disabled={!item.inStock}
                      onPress={(e) => {
                        e.stopPropagation();
                        Alert.alert('Ajouter au panier', `${displayName} a été ajouté`);
                      }}
                    >
                      <Ionicons name="cart-outline" size={18} color="#FFF" />
                    </TouchableOpacity>
                  </>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 104,
  },
  loadingCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingCardText: {
    marginLeft: 12,
    color: '#666',
  },
  productImage: {
    width: 80,
    height: 80,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginRight: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  productImageContent: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  discountBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#FF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  favoriteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 4,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  orders: {
    fontSize: 11,
    color: '#999',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B00',
    marginRight: 6,
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  outOfStock: {
    fontSize: 11,
    color: '#FF4444',
    fontWeight: '500',
  },
  cartButton: {
    backgroundColor: '#FF6B00',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  cartButtonDisabled: {
    backgroundColor: '#CCC',
  },
});
