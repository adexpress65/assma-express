// app/(tabs)/cart.tsx
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart, CartItem as CartItemType } from '@/contexts/CartContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrency } from '@/contexts/CurrencyContext';
import { saneQty } from '@/utils/quantity';

const { width } = Dimensions.get('window');

/* -------------------------------------------------- */
/* Helpers                                            */
/* -------------------------------------------------- */

const getImageUrl = (item: any): string => {
  if (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.startsWith('http')) return item.imageUrl;
  if (item.image && typeof item.image === 'string' && item.image.startsWith('http')) return item.image;
  return 'https://asma.sn/placeholder.jpg';
};

/* -------------------------------------------------- */
/* Cart Item Component - Mémoïsé pour performance    */
/* -------------------------------------------------- */

interface CartItemProps {
  item: CartItemType;
  isSelected: boolean;
  quantity: number;
  isUpdating: boolean;
  onToggle: (id: string) => void;
  onIncrease: (item: CartItemType) => void;
  onDecrease: (item: CartItemType) => void;
  onRemove: (id: string) => void;
  formatPrice: (priceXOF: number | string) => string;  // Reçu du contexte
}

const CartItem = memo(({ 
  item, 
  isSelected, 
  quantity, 
  isUpdating,
  onToggle,
  onIncrease,
  onDecrease,
  onRemove,
  formatPrice
}: CartItemProps) => {
  
  // ? Sécurisation des types avec Number()
  const itemPrice = Number(item.price) || 0;
  const itemQuantity = Number(quantity) || 1;
  
  // Calcul du prix total pour cet item (toujours en XOF - pas de formatage ici)
  const totalItemPrice = itemPrice * itemQuantity;
  
  return (
    <View style={styles.card}>
      {/* Checkbox de sélection */}
      <TouchableOpacity 
        onPress={() => onToggle(item.cartId)}
        style={styles.checkbox}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isSelected ? 'checkbox' : 'square-outline'}
          size={24}
          color="#ff6a00"
        />
      </TouchableOpacity>

      {/* Image produit */}
      <Image source={{ uri: getImageUrl(item) }} style={styles.thumb} />

      {/* Détails produit */}
      <View style={styles.itemDetails}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        
        {/* Variantes (taille/couleur) */}
        {(item.selectedSize || item.selectedColor) && (
          <View style={styles.variants}>
            {item.selectedSize && (
              <View style={styles.variantBadge}>
                <Text style={styles.variantText}>Taille: {item.selectedSize}</Text>
              </View>
            )}
            {item.selectedColor && (
              <View style={styles.variantBadge}>
                <Text style={styles.variantText}>Couleur: {item.selectedColor}</Text>
              </View>
            )}
          </View>
        )}

        {/* ? Prix unitaire formaté avec la fonction du contexte */}
        <Text style={styles.price}>
          {formatPrice(itemPrice)}
        </Text>
        
        {/* ? Indication du prix unitaire */}
        <Text style={styles.unitPrice}>
          {formatPrice(itemPrice)} / unité
        </Text>

        {/* Stepper quantité */}
        <View style={styles.quantityContainer}>
          <TouchableOpacity 
            onPress={() => onDecrease(item)}
            disabled={isUpdating}
            style={styles.quantityButton}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="remove" 
              size={20} 
              color={itemQuantity <= 1 ? '#ccc' : '#ff6a00'} 
            />
          </TouchableOpacity>

          <View style={styles.quantityValue}>
            {isUpdating ? (
              <ActivityIndicator size="small" color="#ff6a00" />
            ) : (
              <Text style={styles.quantityText}>{itemQuantity}</Text>
            )}
          </View>

          <TouchableOpacity 
            onPress={() => onIncrease(item)}
            disabled={isUpdating}
            style={styles.quantityButton}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={20} color="#ff6a00" />
          </TouchableOpacity>

          {/* Indicateur de quantité minimum */}
          {item.minOrder && item.minOrder > 1 && itemQuantity < item.minOrder && (
            <Text style={styles.minOrderWarning}>Min: {item.minOrder}</Text>
          )}
        </View>

        {/* ? Total par article formaté */}
        <Text style={styles.itemTotal}>
          Total: {formatPrice(totalItemPrice)}
        </Text>
      </View>

      {/* Bouton supprimer */}
      <TouchableOpacity 
        onPress={() => onRemove(item.cartId)}
        style={styles.removeButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={22} color="#ff4444" />
      </TouchableOpacity>
    </View>
  );
});

CartItem.displayName = 'CartItem';

/* -------------------------------------------------- */
/* Composant Empty State                              */
/* -------------------------------------------------- */

const EmptyCart = memo(({ onContinueShopping }: { onContinueShopping: () => void }) => (
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIconContainer}>
      <Ionicons name="cart-outline" size={80} color="#ff6a00" />
    </View>
    <Text style={styles.emptyTitle}>Votre panier est vide</Text>
    <Text style={styles.emptySubtitle}>
      Découvrez nos produits et trouvez votre bonheur
    </Text>
    <TouchableOpacity 
      style={styles.shopButton}
      onPress={onContinueShopping}
      activeOpacity={0.8}
    >
      <Text style={styles.shopButtonText}>Continuer mes achats</Text>
    </TouchableOpacity>
  </View>
));

EmptyCart.displayName = 'EmptyCart';

/* -------------------------------------------------- */
/* Main Component                                     */
/* -------------------------------------------------- */

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // ? Récupération des fonctions du contexte
  const { currency, formatPrice } = useCurrency();
  
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
  } = useCart();

  // State
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [selectAll, setSelectAll] = useState(true);

  // Refs pour debounce
  const updateTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  /* ---------- Initialisation des quantités ---------- */
  useEffect(() => {
    const q: Record<string, number> = {};
    cartItems.forEach(item => {
      q[item.cartId] = saneQty(item.quantity);
    });
    setQuantities(q);
  }, [cartItems]);

  /* ---------- Auto-sélection de tous les items ---------- */
  useEffect(() => {
    if (cartItems.length > 0) {
      setSelected(new Set(cartItems.map(i => i.cartId)));
      setSelectAll(true);
    }
  }, [cartItems]);

  /* ---------- Calculs mémorisés avec useMemo ---------- */
  
  // Items sélectionnés
  const selectedItems = useMemo(() => 
    cartItems.filter(i => selected.has(i.cartId)),
    [cartItems, selected]
  );

  // ? Sous-total en XOF (calcul PUR - pas de formatage)
  const subtotalXOF = useMemo(() => 
    selectedItems.reduce((sum, item) => {
      const qty = Number(quantities[item.cartId] ?? saneQty(item.quantity)) || 0;
      const price = Number(item.price) || 0;
      return sum + (price * qty);
    }, 0),
    [selectedItems, quantities]
  );

  // Nombre d'articles sélectionnés
  const selectedCount = selectedItems.length;
  
  // Quantité totale d'articles sélectionnés
  const totalQuantity = useMemo(() => 
    selectedItems.reduce((sum, item) => {
      const qty = Number(quantities[item.cartId] ?? saneQty(item.quantity)) || 0;
      return sum + qty;
    }, 0),
    [selectedItems, quantities]
  );

  /* ---------- Handlers avec useCallback ---------- */

  // Sélection/déselection de tous les items
  const toggleSelectAll = useCallback(() => {
    if (selected.size === cartItems.length) {
      setSelected(new Set());
      setSelectAll(false);
    } else {
      setSelected(new Set(cartItems.map(i => i.cartId)));
      setSelectAll(true);
    }
  }, [selected, cartItems]);

  // Sélection/déselection d'un item
  const toggleItem = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Mise à jour de quantité avec debounce
  const updateQuantityWithDebounce = useCallback((cartId: string, newQty: number) => {
    if (updateTimeoutRef.current[cartId]) {
      clearTimeout(updateTimeoutRef.current[cartId]);
    }

    setIsUpdating(prev => ({ ...prev, [cartId]: true }));
    setQuantities(prev => ({ ...prev, [cartId]: newQty }));

    updateTimeoutRef.current[cartId] = setTimeout(() => {
      updateQuantity(cartId, newQty);
      setIsUpdating(prev => ({ ...prev, [cartId]: false }));
    }, 500);
  }, [updateQuantity]);

  // Augmenter quantité
  const handleIncrease = useCallback((item: CartItemType) => {
    const currentQty = Number(quantities[item.cartId] ?? saneQty(item.quantity)) || 1;
    const newQty = currentQty + 1;
    if (newQty <= 999) {
      updateQuantityWithDebounce(item.cartId, newQty);
    }
  }, [quantities, updateQuantityWithDebounce]);

  // Diminuer quantité
  const handleDecrease = useCallback((item: CartItemType) => {
    const currentQty = Number(quantities[item.cartId] ?? saneQty(item.quantity)) || 1;
    
    if (currentQty <= 1) {
      Alert.alert(
        'Supprimer l\'article',
        'Voulez-vous supprimer cet article du panier ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Supprimer', 
            onPress: () => removeFromCart(item.cartId),
            style: 'destructive'
          }
        ]
      );
    } else {
      updateQuantityWithDebounce(item.cartId, currentQty - 1);
    }
  }, [quantities, updateQuantityWithDebounce, removeFromCart]);

  // Supprimer un article
  const handleRemove = useCallback((cartId: string) => {
    Alert.alert(
      'Supprimer l\'article',
      'Voulez-vous supprimer cet article du panier ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          onPress: () => removeFromCart(cartId),
          style: 'destructive'
        }
      ]
    );
  }, [removeFromCart]);

  // Supprimer les articles sélectionnés
  const handleRemoveSelected = useCallback(() => {
    if (selectedItems.length === 0) return;
    
    Alert.alert(
      'Supprimer les articles',
      `Voulez-vous supprimer ${selectedItems.length} article(s) du panier ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          onPress: () => {
            selectedItems.forEach(item => removeFromCart(item.cartId));
            setSelected(new Set());
          },
          style: 'destructive'
        }
      ]
    );
  }, [selectedItems, removeFromCart]);

  // Checkout
const handleCheckout = async () => {
    if (selectedItems.length === 0) return;
    
    setIsCheckingOut(true);
    
    try {
      // Simulation d'un petit délai pour l'UX
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // ? ON RECONSTRUIT L'OBJET ATTENDU PAR SHIPPING.TSX
// ? ON RECONSTRUIT L'OBJET ATTENDU PAR L'INDEX DU CHECKOUT (L'ADRESSE)
const orderData = {
  items: selectedItems.map(item => ({
    id: item.cartId,
    productId: item.id,
    name: item.name,
    price: Number(item.price),
    quantity: quantities[item.cartId] ?? item.quantity,
    imageUrl: item.image || item.imageUrl,
    companyName: item.seller || "Kissgroup88"
  })),
  summary: {
    subtotal: Number(subtotalXOF),
    shipping: 0,
    discount: 0,
    total: Number(subtotalXOF)
  }
};

// ?? LA RÉPARATION EST ICI :
// On change '/checkout/shipping' par '/checkout' 
// pour passer par CheckoutAddress (index.tsx)
router.push({
  pathname: '/checkout', 
  params: {
    orderData: JSON.stringify(orderData)
  }
});
    } catch (error) {
      console.error("Erreur transfert commande:", error);
      Alert.alert("Erreur", "Une erreur est survenue lors de la préparation de la commande.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // ? Rendu d'un item de la FlatList - on passe formatPrice du contexte
  const renderCartItem = useCallback(({ item }: { item: CartItemType }) => (
    <CartItem
      item={item}
      isSelected={selected.has(item.cartId)}
      quantity={quantities[item.cartId] ?? saneQty(item.quantity)}
      isUpdating={isUpdating[item.cartId] || false}
      onToggle={toggleItem}
      onIncrease={handleIncrease}
      onDecrease={handleDecrease}
      onRemove={handleRemove}
      formatPrice={formatPrice}  // ? Passage de la fonction du contexte
    />
  ), [selected, quantities, isUpdating, toggleItem, handleIncrease, handleDecrease, handleRemove, formatPrice]);

  /* ---------- Rendu conditionnel (panier vide) ---------- */
  if (cartItems.length === 0) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <SafeAreaView style={styles.safeArea}>
          <EmptyCart onContinueShopping={() => router.push('/')} />
        </SafeAreaView>
      </>
    );
  }

  /* ---------- Rendu principal ---------- */
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header avec sélection */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.headerButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>
            Mon Panier <Text style={styles.headerCount}>({cartItems.length})</Text>
          </Text>
          
          <TouchableOpacity 
            onPress={toggleSelectAll}
            style={styles.headerButton}
          >
            <Text style={styles.selectAllText}>
              {selectAll ? 'Tout désél.' : 'Tout sél.'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Liste des articles */}
      <FlatList
        data={cartItems}
        keyExtractor={item => item.cartId}
        renderItem={renderCartItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { 
            paddingBottom: 100 + (insets.bottom || 0),
            paddingTop: 8,
          }
        ]}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={5}
        initialNumToRender={5}
      />

      {/* Footer sticky */}
      <View style={[styles.footerWrapper, { paddingBottom: insets.bottom || 0 }]}>
        <View style={styles.footer}>
          {/* Ligne supérieure du footer */}
          <View style={styles.footerRow}>
            <View style={styles.footerLeft}>
              <Text style={styles.footerLabel}>
                {selectedCount} article{selectedCount > 1 ? 's' : ''}
              </Text>
              {/* ? Affichage formaté du sous-total avec la fonction du contexte */}
              <Text style={styles.footerPrice}>
                {formatPrice(subtotalXOF)}
              </Text>
            </View>

            <TouchableOpacity 
              style={[
                styles.checkoutBtn,
                (selectedCount === 0 || isCheckingOut) && styles.checkoutBtnDisabled
              ]}
              onPress={handleCheckout}
              disabled={selectedCount === 0 || isCheckingOut}
              activeOpacity={0.8}
            >
              {isCheckingOut ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.checkoutBtnTxt}>Commander</Text>
                  <Text style={styles.checkoutBtnSubTxt}>
                    ({totalQuantity})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Actions supplémentaires */}
          {selectedCount > 0 && (
            <View style={styles.footerActions}>
              <TouchableOpacity 
                style={styles.deleteSelected}
                onPress={handleRemoveSelected}
              >
                <Ionicons name="trash-outline" size={18} color="#ff4444" />
                <Text style={styles.deleteSelectedText}>
                  Supprimer ({selectedCount})
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/* -------------------------------------------------- */
/* Styles - inchangés                                 */
/* -------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerCount: {
    color: '#999',
    fontSize: 14,
    fontWeight: '400',
  },
  selectAllText: {
    color: '#ff6a00',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginVertical: 4,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  checkbox: {
    justifyContent: 'center',
    marginRight: 8,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontWeight: '500',
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  variants: {
    flexDirection: 'row',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  variantBadge: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 2,
  },
  variantText: {
    fontSize: 10,
    color: '#666',
  },
  price: {
    color: '#ff6a00',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 2,
  },
  unitPrice: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    minWidth: 40,
    alignItems: 'center',
  },
  quantityText: {
    fontWeight: '600',
    fontSize: 16,
    color: '#333',
  },
  minOrderWarning: {
    fontSize: 10,
    color: '#ff6a00',
    marginLeft: 8,
  },
  itemTotal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  removeButton: {
    padding: 8,
    justifyContent: 'center',
  },
  footerWrapper: {
    backgroundColor: '#fff',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  footerPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ff6a00',
  },
  checkoutBtn: {
    backgroundColor: '#ff6a00',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  checkoutBtnDisabled: {
    backgroundColor: '#ccc',
  },
  checkoutBtnTxt: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  checkoutBtnSubTxt: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  deleteSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  deleteSelectedText: {
    color: '#ff4444',
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#fff',
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff3e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  shopButton: {
    backgroundColor: '#ff6a00',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  shopButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});