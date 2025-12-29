// apps/mobile/app/(tabs)/cart.tsx
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
  FlatList,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5, AntDesign } from '@expo/vector-icons';
import { useCart, CartItem } from '../../src/contexts/CartContext';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

// ?? DONNÃ‰ES DE RECOMMANDATIONS FIXES POUR DÃ‰MONSTRATION
const DEMO_RECOMMENDED_PRODUCTS = [
  {
    id: 'rec1',
    name: 'CÃ¢ble USB-C Rapide 2m',
    price: 12.99,
    imageUrl: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=150',
    category: 'electronics',
    rating: 4.8,
    orders: 1250,
  },
  {
    id: 'rec2',
    name: 'Protection Ã‰cran TrempÃ©',
    price: 8.5,
    imageUrl: 'https://images.unsplash.com/photo-1556656793-08538906a9f8?w=150',
    category: 'electronics',
    rating: 4.6,
    orders: 890,
  },
  {
    id: 'rec3',
    name: 'Support Voiture AimantÃ©',
    price: 15.99,
    imageUrl: 'https://images.unsplash.com/photo-1609588349482-86f75397423d?w=150',
    category: 'electronics',
    rating: 4.7,
    orders: 567,
  },
  {
    id: 'rec4',
    name: 'Power Bank 10000mAh',
    price: 24.99,
    imageUrl: 'https://images.unsplash.com/photo-1609592810794-1c0d98ed51c1?w=150',
    category: 'electronics',
    rating: 4.9,
    orders: 2341,
  },
];

export default function CartScreen() {
  const router = useRouter();
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
    getTotalPrice,
    getTotalItems,
    clearCart,
    addToCart, // ? on suppose qu'il existe dans le contexte
  } = useCart();

  const [promoCode, setPromoCode] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [fadeAnim] = useState(new Animated.Value(0));
  const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // ?? CHARGER LES RECOMMANDATIONS AU CHARGEMENT
  useEffect(() => {
    loadRecommendedProducts();
  }, [cartItems]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadRecommendedProducts = async () => {
    if (cartItems.length === 0) {
      setRecommendedProducts([]);
      return;
    }

    setLoadingRecommendations(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      setRecommendedProducts(DEMO_RECOMMENDED_PRODUCTS);
    } catch (error) {
      console.error('Erreur chargement recommandations:', error);
      setRecommendedProducts(DEMO_RECOMMENDED_PRODUCTS.slice(0, 2));
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // ?? CALCULS POUR LES ARTICLES SÃ‰LECTIONNÃ‰S
  const selectedCartItems = cartItems.filter((item) => selectedItems.has(item.id));
  const subtotal = selectedCartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const shipping = selectedCartItems.length > 0 ? (subtotal > 50 ? 0 : 2.99) : 0;
  const discount =
    promoCode && selectedCartItems.length > 0
      ? Math.min(15, subtotal * 0.1)
      : 0;
  const total = Math.max(0, subtotal + shipping - discount);

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === cartItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(cartItems.map((item) => item.id)));
    }
  };

  const handleUpdateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity < 1) {
      handleRemoveItem(id);
      return;
    }
    updateQuantity(id, newQuantity);
  };

  const handleRemoveItem = (id: string) => {
    Alert.alert(
      "Supprimer l'article",
      'ÃŠtes-vous sÃ»r de vouloir supprimer cet article du panier ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            removeFromCart(id);
            setSelectedItems((prev) => {
              const newSet = new Set(prev);
              newSet.delete(id);
              return newSet;
            });
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    if (cartItems.length === 0) return;
    Alert.alert(
      'Vider le panier',
      'Voulez-vous vraiment supprimer tous les articles ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Tout supprimer',
          style: 'destructive',
          onPress: () => {
            clearCart();
            setSelectedItems(new Set());
          },
        },
      ]
    );
  };

  const moveToWishlist = (item: CartItem) => {
    Alert.alert(
      'AjoutÃ© aux favoris',
      `${item.name} a Ã©tÃ© ajoutÃ© Ã  vos favoris.`
    );
  };

  // ?? AJOUTER UN PRODUIT RECOMMANDÃ‰ AU PANIER
  const addRecommendedToCart = (product: any) => {
    if (addToCart) {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.imageUrl,
        quantity: 1,
        inStock: true,
        seller: 'RecommandÃ©',
        shipping: 'LIVRAISON GRATUITE',
      });
    } else {
      // fallback si pas de addToCart dans le contexte: on essaie d'incrÃ©menter
      updateQuantity(product.id, 1);
    }

    Alert.alert('? AjoutÃ© !', `${product.name} a Ã©tÃ© ajoutÃ© Ã  votre panier`);
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
        Alert.alert('?? SuccÃ¨s!', 'Code promo appliquÃ© -10%');
      } else if (promoCode.toUpperCase() === 'LIVRAISON') {
        Alert.alert('?? SuccÃ¨s!', 'Livraison gratuite activÃ©e!');
      } else {
        Alert.alert('? Code invalide', "Ce code promo n'est pas valide");
        setPromoCode('');
      }
    }, 1000);
  };

  const handleCheckout = () => {
    if (selectedCartItems.length === 0) {
      Alert.alert(
        'Aucun article',
        'Veuillez sÃ©lectionner au moins un article'
      );
      return;
    }

    router.push('/checkout');
  };

  // ?? COMPOSANT ARTICLE DU PANIER
  const CartItemCard = ({ item }: { item: CartItem }) => (
    <Animated.View
      style={[
        styles.cartItem,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
          ],
        },
      ]}
    >
      {/* En-tÃªte du vendeur */}
      <View style={styles.sellerHeader}>
        <View style={styles.sellerInfo}>
          <MaterialIcons name="store" size={16} color="#ff6a00" />
          <Text style={styles.sellerName}>{item.seller || 'Vendeur'}</Text>
        </View>
        <TouchableOpacity>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={16}
            color="#666"
          />
        </TouchableOpacity>
      </View>

      {/* Contenu de l'article */}
      <View style={styles.itemContent}>
        {/* Checkbox de sÃ©lection */}
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => toggleSelectItem(item.id)}
        >
          <View
            style={[
              styles.checkbox,
              selectedItems.has(item.id) && styles.checkboxSelected,
            ]}
          >
            {selectedItems.has(item.id) && (
              <Ionicons name="checkmark" size={12} color="#fff" />
            )}
          </View>
        </TouchableOpacity>

        {/* Image du produit */}
        <TouchableOpacity
          style={styles.imageContainer}
          onPress={() => {
            // ? Aller sur la fiche produit
            // si ton dÃ©tail produit est /products/[id]
            // sinon adapte
            // On passe l'id exact de l'item
            router.push(`/products/${item.id}`);
          }}
        >
          <Image
            source={{
              uri:
                item.image ||
                item.imageUrl ||
                'https://via.placeholder.com/150',
            }}
            style={styles.productImage}
          />
          {item.inStock === false && (
            <View style={styles.outOfStockOverlay}>
              <Text style={styles.outOfStockText}>Rupture</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* DÃ©tails du produit */}
        <View style={styles.itemDetails}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>

          {/* SpÃ©cifications */}
          <View style={styles.specs}>
            <Text style={styles.specText}>Couleur: Noir</Text>
            <Text style={styles.specText}>Taille: Standard</Text>
          </View>

          {/* Garanties */}
          <View style={styles.badgesContainer}>
            <View style={styles.guaranteeBadge}>
              <Ionicons
                name="shield-checkmark"
                size={10}
                color="#4caf50"
              />
              <Text style={styles.guaranteeText}>
                Garantie remboursement
              </Text>
            </View>
            {item.shipping?.includes('GRATUITE') && (
              <View style={styles.freeShippingBadge}>
                <MaterialIcons
                  name="local-shipping"
                  size={10}
                  color="#4caf50"
                />
                <Text style={styles.freeShippingText}>
                  Livraison gratuite
                </Text>
              </View>
            )}
          </View>

          {/* Prix et quantitÃ© */}
          <View style={styles.priceQuantityRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.currentPrice}>
                {item.price.toFixed(2)}â‚¬
              </Text>
              {item.originalPrice && (
                <Text style={styles.originalPrice}>
                  {item.originalPrice.toFixed(2)}â‚¬
                </Text>
              )}
              <Text style={styles.priceUnit}>/piÃ¨ce</Text>
            </View>

            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={[
                  styles.quantityBtn,
                  item.quantity <= 1 && styles.quantityBtnDisabled,
                ]}
                onPress={() =>
                  handleUpdateQuantity(item.id, item.quantity - 1)
                }
                disabled={item.quantity <= 1}
              >
                <Text style={styles.quantityBtnText}>-</Text>
              </TouchableOpacity>

              <Text style={styles.quantityText}>{item.quantity}</Text>

              <TouchableOpacity
                style={styles.quantityBtn}
                onPress={() =>
                  handleUpdateQuantity(item.id, item.quantity + 1)
                }
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
              <AntDesign name="heart" size={14} color="#666" />
              <Text style={styles.actionText}>Favoris</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleRemoveItem(item.id)}
            >
              <Ionicons name="trash-outline" size={14} color="#666" />
              <Text style={styles.actionText}>Supprimer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );

  // ?? COMPOSANT PRODUIT RECOMMANDÃ‰
  const RecommendedProductCard = ({ product }: { product: any }) => (
    <View style={styles.recommendedProductCard}>
      <Image
        source={{ uri: product.imageUrl }}
        style={styles.recommendedProductImage}
      />

      {/* Badge de vente */}
      <View style={styles.salesBadge}>
        <Text style={styles.salesBadgeText}>
          {product.orders}+ vendus
        </Text>
      </View>

      <View style={styles.recommendedProductInfo}>
        <Text
          style={styles.recommendedProductName}
          numberOfLines={2}
        >
          {product.name}
        </Text>

        {/* Rating */}
        <View style={styles.ratingRow}>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={
                  star <= Math.floor(product.rating)
                    ? 'star'
                    : 'star-outline'
                }
                size={12}
                color="#ffa726"
              />
            ))}
          </View>
          <Text style={styles.ratingText}>{product.rating}</Text>
        </View>

        <Text style={styles.recommendedProductPrice}>
          {product.price.toFixed(2)}â‚¬
        </Text>

        <TouchableOpacity
          style={styles.addRecommendedBtn}
          onPress={() => addRecommendedToCart(product)}
        >
          <Text style={styles.addRecommendedBtnText}>
            Ajouter au panier
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const RecommendationsSection = () => {
    if (cartItems.length === 0 || recommendedProducts.length === 0) {
      return null;
    }

    return (
      <View style={styles.recommendationsSection}>
        <View style={styles.recommendationsHeader}>
          <MaterialIcons name="bolt" size={20} color="#ff6a00" />
          <Text style={styles.recommendationsTitle}>
            Articles frÃ©quemment achetÃ©s ensemble
          </Text>
        </View>

        <Text style={styles.recommendationsSubtitle}>
          Les clients ayant achetÃ© ces articles les ont aussi regardÃ©s
        </Text>

        {loadingRecommendations ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff6a00" />
            <Text style={styles.loadingText}>
              Chargement des recommandations...
            </Text>
          </View>
        ) : (
          <FlatList
            data={recommendedProducts}
            renderItem={({ item }) => (
              <RecommendedProductCard product={item} />
            )}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recommendationsList}
            snapToInterval={160}
            decelerationRate="fast"
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header AliExpress Style */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          Panier ({getTotalItems()})
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="search" size={22} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons
              name="ellipsis-horizontal"
              size={22}
              color="#333"
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* En-tÃªte avec sÃ©lection multiple */}
        {cartItems.length > 0 && (
          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={styles.selectAllButton}
              onPress={toggleSelectAll}
            >
              <View
                style={[
                  styles.checkbox,
                  selectedItems.size === cartItems.length &&
                    styles.checkboxSelected,
                ]}
              >
                {selectedItems.size === cartItems.length && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color="#fff"
                  />
                )}
              </View>
              <Text style={styles.selectAllText}>
                Tout sÃ©lectionner ({selectedItems.size}/
                {cartItems.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={handleClearAll} // ? maintenant Ã§a vide le panier
            >
              <Text style={styles.clearAllText}>
                Tout supprimer
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Liste des articles ou Ã©tat vide */}
        {cartItems.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <FontAwesome5
                name="shopping-basket"
                size={80}
                color="#e0e0e0"
              />
            </View>
            <Text style={styles.emptyStateTitle}>
              Votre panier est vide
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              Parcourez nos catÃ©gories et dÃ©couvrez nos meilleures
              offres
            </Text>
            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => router.push('/')}
            >
              <Text style={styles.shopButtonText}>
                ??? Commencer mes achats
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          cartItems.map((item) => (
            <CartItemCard key={item.id} item={item} />
          ))
        )}

        {/* ?? SECTION RECOMMANDATIONS INTELLIGENTES */}
        <RecommendationsSection />

        {/* Section promotion */}
        {selectedCartItems.length > 0 && (
          <View style={styles.promoSection}>
            <View style={styles.promoHeader}>
              <MaterialIcons
                name="local-offer"
                size={20}
                color="#ff6a00"
              />
              <Text style={styles.promoTitle}>Code promo</Text>
            </View>
            <View style={styles.promoInputRow}>
              <TextInput
                style={styles.promoInput}
                placeholder="Entrez votre code promo"
                value={promoCode}
                onChangeText={setPromoCode}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={[
                  styles.applyButton,
                  applyingPromo && styles.applyButtonDisabled,
                ]}
                onPress={applyPromoCode}
                disabled={applyingPromo}
              >
                {applyingPromo ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.applyButtonText}>
                    Appliquer
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Codes promo suggÃ©rÃ©s */}
            <View style={styles.suggestedPromos}>
              <Text style={styles.suggestedTitle}>
                Codes disponibles:
              </Text>
              <View style={styles.promoPills}>
                <TouchableOpacity
                  style={styles.promoPill}
                  onPress={() => setPromoCode('ASMA10')}
                >
                  <Text style={styles.promoPillText}>
                    ASMA10
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.promoPill}
                  onPress={() => setPromoCode('LIVRAISON')}
                >
                  <Text style={styles.promoPillText}>
                    LIVRAISON
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer de commande fixe */}
      {cartItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalAmount}>
                {total.toFixed(2)}â‚¬
              </Text>
            </View>
            <Text style={styles.shippingInfo}>
              {shipping === 0
                ? '?? Livraison gratuite'
                : `Frais de port: ${shipping.toFixed(2)}â‚¬`}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.checkoutButton,
              selectedCartItems.length === 0 &&
                styles.checkoutButtonDisabled,
            ]}
            onPress={handleCheckout}
            disabled={selectedCartItems.length === 0}
          >
            <Text style={styles.checkoutButtonText}>
              Commander ({selectedCartItems.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerButton: { padding: 4 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 130 },
  bulkActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectAllButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkboxContainer: { padding: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: '#ff6a00', borderColor: '#ff6a00' },
  selectAllText: { fontSize: 14, color: '#333', fontWeight: '500' },
  clearAllButton: { padding: 8 },
  clearAllText: { fontSize: 14, color: '#ff4444', fontWeight: '500' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  emptyIcon: { marginBottom: 20 },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
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
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#ff6a00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  shopButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cartItem: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    overflow: 'hidden',
  },
  sellerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sellerInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sellerName: { fontSize: 14, fontWeight: '600', color: '#333' },
  itemContent: { flexDirection: 'row', padding: 16 },
  imageContainer: { position: 'relative', marginRight: 12 },
  productImage: {
    width: 90,
    height: 90,
    borderRadius: 6,
    backgroundColor: '#f8f8f8',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outOfStockText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  itemDetails: { flex: 1 },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
    lineHeight: 18,
    marginBottom: 8,
  },
  specs: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  specText: { fontSize: 12, color: '#666' },
  badgesContainer: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  guaranteeBadge: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  guaranteeText: { fontSize: 10, color: '#1976d2', fontWeight: '500' },
  freeShippingBadge: {
    backgroundColor: '#f0fff4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  freeShippingText: { fontSize: 10, color: '#4caf50', fontWeight: '500' },
  priceQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceContainer: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  currentPrice: { fontSize: 18, fontWeight: '700', color: '#ff6a00' },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  priceUnit: { fontSize: 11, color: '#666' },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
  },
  quantityBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f8f8f8',
  },
  quantityBtnDisabled: { opacity: 0.5 },
  quantityBtnText: { fontSize: 14, color: '#666', fontWeight: '600' },
  quantityText: {
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 30,
    textAlign: 'center',
  },
  actionButtons: { flexDirection: 'row', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 12, color: '#666' },

  // ?? RECOMMANDATIONS
  recommendationsSection: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  recommendationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  recommendationsSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  loadingContainer: { alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 8, fontSize: 12, color: '#666' },
  recommendationsList: { paddingRight: 16 },
  recommendedProductCard: {
    width: 140,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
  },
  recommendedProductImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f8f8f8',
  },
  salesBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 106, 0, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  salesBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  recommendedProductInfo: { padding: 8 },
  recommendedProductName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
    lineHeight: 14,
    height: 28,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  stars: { flexDirection: 'row' },
  ratingText: { fontSize: 11, color: '#666', fontWeight: '500' },
  recommendedProductPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff6a00',
    marginBottom: 8,
  },
  addRecommendedBtn: {
    backgroundColor: '#ff6a00',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  addRecommendedBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },

  promoSection: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  promoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  promoTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  promoInputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  applyButton: {
    backgroundColor: '#ff6a00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonDisabled: { opacity: 0.6 },
  applyButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  suggestedPromos: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  suggestedTitle: { fontSize: 14, color: '#666', marginBottom: 8 },
  promoPills: { flexDirection: 'row', gap: 8 },
  promoPill: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  promoPillText: {
    fontSize: 12,
    color: '#ff6a00',
    fontWeight: '500',
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  footerLeft: { flex: 1 },
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 4,
  },
  totalLabel: { fontSize: 14, color: '#666' },
  totalAmount: { fontSize: 20, fontWeight: '700', color: '#ff6a00' },
  shippingInfo: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '500',
  },
  checkoutButton: {
    backgroundColor: '#ff6a00',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#ff6a00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
