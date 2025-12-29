import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAllProducts, Product } from '@/services/firebase/productsService';

const { width } = Dimensions.get('window');

export default function CartScreen() {
  const { 
    cartItems, 
    updateQuantity, 
    removeFromCart,
    getTotalPrice,
    getTotalItems,
    clearCart,
    addToCart
  } = useCart();

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [promoCode, setPromoCode] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [fadeAnim] = useState(new Animated.Value(0));
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [loadingPopularProducts, setLoadingPopularProducts] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const insets = useSafeAreaInsets();

  // Calcul des totaux
  const selectedCartItems = cartItems.filter(item => selectedItems.has(item.id));
  const subtotal = selectedCartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = selectedCartItems.length > 0 ? (subtotal > 50000 ? 0 : 4000) : 0;
  const discount = promoCode && selectedCartItems.length > 0 ? Math.min(20000, subtotal * 0.1) : 0;
  const total = Math.max(0, subtotal + shipping - discount);

  // Fonction pour extraire le nom du vendeur
  const getSellerName = (item: any) => {
    if (item.companyName) return item.companyName;
    
    if (item.seller) {
      if (typeof item.seller === 'object' && item.seller !== null) {
        return item.seller.name || item.seller.companyName || 'ASMA Express';
      }
      return item.seller;
    }
    
    return 'ASMA Express';
  };

  const getSellerRating = (item: any) => {
    if (item.seller && typeof item.seller === 'object' && item.seller !== null) {
      return item.seller.rating || 4.8;
    }
    return 4.8;
  };

  useEffect(() => {
    console.log('CartScreen - CartItems:', cartItems.length);
    console.log('Selected items:', selectedItems.size);
  }, [cartItems, selectedItems]);

  useEffect(() => {
    loadAllProducts();
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Charger TOUS les produits
  const loadAllProducts = async () => {
    setLoadingPopularProducts(true);
    try {
      console.log('📥 Chargement de TOUS les produits depuis Firebase...');
      
      const allProducts = await getAllProducts();
      console.log(`📊 ${allProducts.length} produits récupérés de la base de données`);
      
      // Filtrer les produits déjà dans le panier
      const cartProductIds = cartItems.map(item => item.productId || item.id);
      const filteredProducts = allProducts.filter(
        product => !cartProductIds.includes(product.id)
      );
      
      // Mélanger aléatoirement les produits
      const shuffledProducts = [...filteredProducts].sort(() => Math.random() - 0.5);
      
      // Prendre les 10 premiers pour l'affichage
      const displayProducts = shuffledProducts.slice(0, 10);
      
      setPopularProducts(displayProducts);
      console.log(`✅ ${displayProducts.length} produits affichés`);
      
    } catch (error) {
      console.error('❌ Erreur chargement des produits:', error);
      setPopularProducts(generateFallbackProducts());
    } finally {
      setLoadingPopularProducts(false);
    }
  };

  const generateFallbackProducts = (): Product[] => {
    const categories = ['mode', 'électronique', 'maison', 'sport', 'beauté'];
    const fallbackImages = [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
      'https://images.unsplash.com/photo-1523170335258-f5ed11844a49',
    ];
    
    return Array.from({ length: 8 }, (_, i) => ({
      id: `fallback-${i + 1}`,
      name: `Produit Tendances ${i + 1}`,
      description: 'Description du produit tendances',
      price: Math.floor(Math.random() * 50000) + 10000,
      image: '',
      imageUrl: `${fallbackImages[i % fallbackImages.length]}?w=300&h=300&fit=crop`,
      categoryId: categories[i % categories.length],
      stock: Math.floor(Math.random() * 100),
      companyId: `comp${Math.floor(i / 2) + 1}`,
      companyName: `Fournisseur ${Math.floor(i / 2) + 1}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  };

  const addPopularToCart = async (product: Product) => {
    try {
      console.log('➕ Ajout produit populaire:', product.name);
      
      const cartProduct = {
        id: product.id,
        name: product.name,
        price: product.price || 0,
        quantity: 1,
        image: product.imageUrl || product.image || '',
        seller: product.companyName || 'Fournisseur ASMA',
        minOrder: 1,
        shipping: "Livraison standard",
        inStock: (product.stock || product.stockQuantity || 0) > 0,
        companyId: product.companyId,
        companyName: product.companyName,
      };

      await addToCart(cartProduct);
      
      Alert.alert(
        '✅ Ajouté au panier', 
        `${product.name} a été ajouté à votre panier`,
        [
          { 
            text: "Continuer", 
            style: "cancel" 
          },
          { 
            text: "Voir mon panier", 
            onPress: () => {
              loadAllProducts();
            }
          }
        ]
      );
      
    } catch (error) {
      console.error('❌ Erreur ajout produit populaire:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter ce produit au panier');
    }
  };

  // Supprimer tous les articles sélectionnés
  const handleDeleteSelected = () => {
    if (selectedItems.size === 0) {
      Alert.alert('Aucune sélection', 'Veuillez sélectionner des articles à supprimer');
      return;
    }
    
    Alert.alert(
      'Supprimer les articles sélectionnés',
      `Êtes-vous sûr de vouloir supprimer ${selectedItems.size} article(s) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive',
          onPress: () => {
            const itemIds = Array.from(selectedItems);
            itemIds.forEach(id => {
              removeFromCart(id);
            });
            setSelectedItems(new Set());
            setIsSelectionMode(false);
            Alert.alert('Supprimé', `${itemIds.length} article(s) supprimé(s)`);
          }
        },
      ]
    );
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      
      // Activer/désactiver le mode sélection
      if (newSet.size > 0 && !isSelectionMode) {
        setIsSelectionMode(true);
      } else if (newSet.size === 0 && isSelectionMode) {
        setIsSelectionMode(false);
      }
      
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === cartItems.length) {
      setSelectedItems(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedItems(new Set(cartItems.map(item => item.id)));
      setIsSelectionMode(true);
    }
  };

  // Gérer le mode sélection automatiquement
  useEffect(() => {
    if (selectedItems.size > 0 && !isSelectionMode) {
      setIsSelectionMode(true);
    } else if (selectedItems.size === 0 && isSelectionMode) {
      setIsSelectionMode(false);
    }
  }, [selectedItems.size]);

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      handleRemoveItem(productId);
      return;
    }
    updateQuantity(productId, newQuantity);
  };

  const handleRemoveItem = (productId: string) => {
    Alert.alert(
      'Supprimer l\'article',
      'Êtes-vous sûr de vouloir supprimer cet article du panier ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive',
          onPress: () => {
            removeFromCart(productId);
            setSelectedItems(prev => {
              const newSet = new Set(prev);
              newSet.delete(productId);
              return newSet;
            });
          }
        },
      ]
    );
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) {
      Alert.alert('Panier vide', 'Votre panier est déjà vide');
      return;
    }
    
    Alert.alert(
      'Vider le panier',
      `Êtes-vous sûr de vouloir supprimer tous les articles (${cartItems.length}) ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Tout supprimer', 
          style: 'destructive',
          onPress: async () => {
            try {
              await clearCart();
              setSelectedItems(new Set());
              setIsSelectionMode(false);
              Alert.alert('Panier vidé', 'Tous les articles ont été supprimés');
            } catch (error) {
              console.error('Erreur vidage panier:', error);
              Alert.alert('Erreur', 'Impossible de vider le panier');
            }
          }
        },
      ]
    );
  };

  // Annuler la sélection
  const cancelSelection = () => {
    setSelectedItems(new Set());
    setIsSelectionMode(false);
  };

  const moveToWishlist = (item: any) => {
    Alert.alert('Ajouté aux favoris', `${item.name} a été ajouté à vos favoris.`);
  };

  const applyPromoCode = () => {
    if (!promoCode.trim()) {
      Alert.alert('Champ vide', 'Veuillez entrer un code promo');
      return;
    }
    
    setApplyingPromo(true);
    setTimeout(() => {
      setApplyingPromo(false);
      if (promoCode.toUpperCase() === 'ASMA10') {
        Alert.alert('Succès!', 'Code promo appliqué -10%');
      } else if (promoCode.toUpperCase() === 'LIVRAISON') {
        Alert.alert('Succès!', 'Livraison gratuite activée!');
      } else {
        Alert.alert('Code invalide', 'Ce code promo n\'est pas valide');
        setPromoCode('');
      }
    }, 1000);
  };

  const handleCheckout = () => {
    if (selectedCartItems.length === 0) {
      Alert.alert('Aucun article', 'Veuillez sélectionner au moins un article');
      return;
    }
    
    Alert.alert(
      'Confirmer la commande',
      `Total: ${total.toFixed(2)} FCFA\n\nArticles: ${selectedCartItems.length}`,
      [
        { text: 'Modifier', style: 'cancel' },
        { 
          text: 'Payer maintenant', 
          onPress: () => {
            router.push('/checkout');
          }
        },
      ]
    );
  };

  const handleDiscoverNow = () => {
    router.push('/categories');
  };

  const CartItemCard = ({ item, index }: { item: any; index: number }) => {
    const sellerName = getSellerName(item);
    const sellerRating = getSellerRating(item);
    
    return (
      <Animated.View 
        style={[
          styles.cartItem,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            }],
          },
        ]}
      >
        {/* Checkbox de sélection */}
        <TouchableOpacity 
          style={styles.checkboxContainer}
          onPress={() => toggleSelectItem(item.id)}
        >
          <View style={[
            styles.checkbox,
            selectedItems.has(item.id) && styles.checkboxSelected
          ]}>
            {selectedItems.has(item.id) && (
              <Ionicons name="checkmark" size={14} color="#fff" />
            )}
          </View>
        </TouchableOpacity>

        {/* Image du produit */}
        <TouchableOpacity 
          style={styles.imageContainer}
          onPress={() => router.push(`/product/${item.productId || item.id}`)}
        >
          <Image 
            source={{ uri: item.image || item.imageUrl }} 
            style={styles.productImage} 
          />
          {(!item.inStock || item.stock === 0) && (
            <View style={styles.outOfStockOverlay}>
              <Text style={styles.outOfStockText}>Rupture</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Détails du produit */}
        <View style={styles.itemDetails}>
          <TouchableOpacity onPress={() => router.push(`/product/${item.productId || item.id}`)}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerName}>
              {sellerName}
            </Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={12} color="#ffa726" />
              <Text style={styles.ratingText}>{sellerRating.toFixed(1)}</Text>
            </View>
          </View>

          {/* Badges */}
          <View style={styles.badgesContainer}>
            <View style={styles.freeShippingBadge}>
              <MaterialIcons name="local-shipping" size={10} color="#4caf50" />
              <Text style={styles.badgeText}>Livraison</Text>
            </View>
            {item.minOrder > 1 && (
              <View style={styles.minOrderBadge}>
                <Text style={styles.minOrderText}>MOQ: {item.minOrder}</Text>
              </View>
            )}
          </View>

          {/* Prix et quantité */}
          <View style={styles.priceQuantityRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.currentPrice}>{item.price.toLocaleString()} FCFA</Text>
            </View>

            <View style={styles.quantityControls}>
              <TouchableOpacity 
                style={[
                  styles.quantityBtn,
                  item.quantity <= 1 && styles.quantityBtnDisabled
                ]}
                onPress={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                disabled={item.quantity <= 1}
              >
                <Text style={styles.quantityBtnText}>-</Text>
              </TouchableOpacity>
              
              <Text style={styles.quantityText}>{item.quantity}</Text>
              
              <TouchableOpacity 
                style={styles.quantityBtn}
                onPress={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
              >
                <Text style={styles.quantityBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => moveToWishlist(item)}
            >
              <Ionicons name="heart-outline" size={16} color="#666" />
              <Text style={styles.actionText}>Favoris</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => handleRemoveItem(item.productId)}
            >
              <Ionicons name="trash-outline" size={16} color="#666" />
              <Text style={styles.actionText}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  const PopularProductCard = ({ product }: { product: Product }) => (
    <View style={styles.popularProductCard}>
      <TouchableOpacity onPress={() => router.push(`/product/${product.id}`)}>
        <Image 
          source={{ uri: product.imageUrl || product.image }} 
          style={styles.popularProductImage} 
        />
      </TouchableOpacity>
      <View style={styles.popularProductInfo}>
        <TouchableOpacity onPress={() => router.push(`/product/${product.id}`)}>
          <Text style={styles.popularProductName} numberOfLines={2}>
            {product.name}
          </Text>
        </TouchableOpacity>
        <Text style={styles.popularProductPrice}>
          {product.price?.toLocaleString() || '0'} FCFA
        </Text>
        {product.companyName && (
          <Text style={styles.popularProductSeller} numberOfLines={1}>
            {product.companyName}
          </Text>
        )}
        <TouchableOpacity 
          style={styles.addPopularBtn}
          onPress={() => addPopularToCart(product)}
        >
          <Ionicons name="cart-outline" size={14} color="#fff" />
          <Text style={styles.addPopularBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const PopularProductsSection = () => {
    if (popularProducts.length === 0 && !loadingPopularProducts) {
      return null;
    }

    return (
      <View style={styles.popularProductsSection}>
        <View style={styles.popularProductsHeader}>
          <MaterialIcons name="trending-up" size={20} color="#ff6a00" />
          <Text style={styles.popularProductsTitle}>Produits Tendances</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={loadAllProducts}
            disabled={loadingPopularProducts}
          >
            <Ionicons 
              name="refresh" 
              size={16} 
              color={loadingPopularProducts ? '#ccc' : '#ff6a00'} 
            />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.popularProductsSubtitle}>
          {loadingPopularProducts ? 
            "Chargement des produits depuis la base de données..." : 
            `Découvrez ${popularProducts.length} produits tendances`
          }
        </Text>
        
        {loadingPopularProducts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff6a00" />
            <Text style={styles.loadingText}>Chargement en cours...</Text>
          </View>
        ) : (
          <FlatList
            data={popularProducts}
            renderItem={({ item }) => <PopularProductCard product={item} />}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.popularProductsList}
            snapToInterval={160}
            decelerationRate="fast"
          />
        )}
      </View>
    );
  };

  const footerHeight = 100 + insets.bottom;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header dynamique */}
      <View style={styles.header}>
        {isSelectionMode ? (
          <View style={styles.selectionHeader}>
            <TouchableOpacity 
              style={styles.cancelSelectionButton}
              onPress={cancelSelection}
            >
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
            <Text style={styles.selectionHeaderTitle}>
              {selectedItems.size} article(s) sélectionné(s)
            </Text>
            <TouchableOpacity 
              style={styles.deleteSelectedButton}
              onPress={handleDeleteSelected}
              disabled={selectedItems.size === 0}
            >
              <Ionicons name="trash-outline" size={20} color={selectedItems.size > 0 ? "#dc3545" : "#ccc"} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.headerTitle}>Panier ({getTotalItems()})</Text>
            <View style={styles.headerActions}>
              {cartItems.length > 0 && (
                <TouchableOpacity 
                  style={styles.clearCartButton}
                  onPress={handleClearCart}
                >
                  <Ionicons name="trash-outline" size={18} color="#dc3545" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="ellipsis-horizontal" size={22} color="#333" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {cartItems.length > 0 && !isSelectionMode && (
          <View style={styles.bulkActions}>
            <TouchableOpacity 
              style={styles.selectAllButton}
              onPress={toggleSelectAll}
            >
              <View style={[
                styles.checkbox,
                selectedItems.size === cartItems.length && styles.checkboxSelected
              ]}>
                {selectedItems.size === cartItems.length && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
              <Text style={styles.selectAllText}>
                Tout sélectionner ({selectedItems.size}/{cartItems.length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.startSelectionButton}
              onPress={() => {
                if (selectedItems.size === 0 && cartItems.length > 0) {
                  setSelectedItems(new Set([cartItems[0].id]));
                  setIsSelectionMode(true);
                }
              }}
            >
              <Text style={styles.startSelectionText}>Sélectionner</Text>
            </TouchableOpacity>
          </View>
        )}

        {cartItems.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="shopping-basket" size={80} color="#e0e0e0" />
            <Text style={styles.emptyStateTitle}>Panier vide</Text>
            <Text style={styles.emptyStateSubtitle}>
              Découvrez nos produits tendance et profitez de nos meilleures offres
            </Text>
            <TouchableOpacity 
              style={styles.shopButton}
              onPress={handleDiscoverNow}
            >
              <Text style={styles.shopButtonText}>Découvrir maintenant</Text>
            </TouchableOpacity>
          </View>
        ) : (
          cartItems.map((item, index) => (
            <CartItemCard
              key={item.id}
              item={item}
              index={index}
            />
          ))
        )}

        <PopularProductsSection />

        {(selectedCartItems.length > 0 && !isSelectionMode) && (
          <View style={styles.promoSection}>
            <View style={styles.promoHeader}>
              <MaterialIcons name="local-offer" size={20} color="#ff6a00" />
              <Text style={styles.promoTitle}>Codes promo disponibles</Text>
            </View>
            <View style={styles.promoInputRow}>
              <TextInput
                style={styles.promoInput}
                placeholder="Entrez le code promo"
                value={promoCode}
                onChangeText={setPromoCode}
                placeholderTextColor="#999"
              />
              <TouchableOpacity 
                style={[
                  styles.applyButton,
                  applyingPromo && styles.applyButtonDisabled
                ]}
                onPress={applyPromoCode}
                disabled={applyingPromo}
              >
                {applyingPromo ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.applyButtonText}>Appliquer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ✅ CORRECTION IMPORTANTE : Footer toujours visible quand il y a des articles sélectionnés */}
      {(cartItems.length > 0 && selectedItems.size > 0) && (
        <View style={[styles.footer, { height: footerHeight, paddingBottom: insets.bottom }]}>
          <View style={styles.footerContent}>
            <View style={styles.footerSummary}>
              {isSelectionMode ? (
                <>
                  <Text style={styles.selectionTotalLabel}>
                    Sélection: <Text style={styles.selectionCount}>{selectedItems.size} article(s)</Text>
                  </Text>
                  <Text style={styles.totalLabel}>
                    Total: <Text style={styles.totalAmount}>{total.toLocaleString()} FCFA</Text>
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.totalLabel}>
                    Total: <Text style={styles.totalAmount}>{total.toLocaleString()} FCFA</Text>
                  </Text>
                  <Text style={styles.shippingInfo}>
                    {shipping === 0 ? 'Livraison gratuite' : `+${shipping.toLocaleString()} FCFA livraison`}
                    {discount > 0 && ` - Économie: ${discount.toLocaleString()} FCFA`}
                  </Text>
                </>
              )}
            </View>
            
            <TouchableOpacity 
              style={[
                styles.checkoutButton,
                (selectedCartItems.length === 0) && styles.checkoutButtonDisabled
              ]}
              onPress={handleCheckout}
              disabled={selectedCartItems.length === 0}
            >
              <Text style={styles.checkoutButtonText}>
                {isSelectionMode ? 'Payer la sélection' : 'Payer'} ({selectedCartItems.length})
              </Text>
              <MaterialIcons name="arrow-forward-ios" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancelSelectionButton: {
    padding: 4,
  },
  selectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  deleteSelectedButton: {
    padding: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearCartButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#fff0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  bulkActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  startSelectionButton: {
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  startSelectionText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
  },
  checkboxContainer: {
    padding: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#ff6a00',
    borderColor: '#ff6a00',
  },
  selectAllText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  shopButton: {
    backgroundColor: '#ff6a00',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#ff6a00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  itemDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    lineHeight: 18,
    marginBottom: 6,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  sellerName: {
    fontSize: 12,
    color: '#666',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 11,
    color: '#666',
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  freeShippingBadge: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  minOrderBadge: {
    backgroundColor: '#fff3e0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4caf50',
  },
  minOrderText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ff9800',
  },
  priceQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff6a00',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
  },
  quantityBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f8f9fa',
  },
  quantityBtnDisabled: {
    opacity: 0.5,
  },
  quantityBtnText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  quantityText: {
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 24,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    color: '#666',
  },
  popularProductsSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  popularProductsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  popularProductsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  refreshButton: {
    padding: 4,
  },
  popularProductsSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
  popularProductsList: {
    paddingRight: 16,
  },
  popularProductCard: {
    width: 140,
    marginRight: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  popularProductImage: {
    width: '100%',
    height: 100,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  popularProductInfo: {
    flex: 1,
  },
  popularProductName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    lineHeight: 14,
  },
  popularProductPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff6a00',
    marginBottom: 4,
  },
  popularProductSeller: {
    fontSize: 10,
    color: '#666',
    marginBottom: 8,
  },
  addPopularBtn: {
    backgroundColor: '#ff6a00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addPopularBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  promoSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  promoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  promoInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  applyButton: {
    backgroundColor: '#ff6a00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonDisabled: {
    opacity: 0.6,
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  footerSummary: {
    flex: 1,
  },
  // ✅ NOUVEAU : Style pour le label de sélection
  selectionTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  selectionCount: {
    color: '#ff6a00',
    fontWeight: '700',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  totalAmount: {
    color: '#ff6a00',
    fontWeight: '700',
  },
  shippingInfo: {
    fontSize: 12,
    color: '#666',
  },
  checkoutButton: {
    backgroundColor: '#ff6a00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 140,
    justifyContent: 'center',
    shadowColor: '#ff6a00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  checkoutButtonDisabled: {
    backgroundColor: '#ccc',
    shadowColor: '#ccc',
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});