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
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useCart, CartItem as CartItemType } from '@/contexts/CartContext';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrency } from '@/contexts/CurrencyContext';
import { saneQty } from '@/utils/quantity';
import { isZeroDollarsProduct } from '@/utils/zeroDollarsShop';
import { displaySellerName } from '@/utils/companyDisplayName';

const { width } = Dimensions.get('window');

/* -------------------------------------------------- */
/* Helpers & Nettoyage d'URL                          */
/* -------------------------------------------------- */

const getSafeFirebaseUri = (uri: any) => {
  if (!uri || typeof uri !== 'string') return null;
  try {
    // Supprime les espaces invisibles et décode pour normaliser
    let clean = decodeURIComponent(uri.trim().replace(/[\s\u0000-\u001F\u007F-\u009F\uFEFF]+/g, ''));
    
    if (clean.includes('firebasestorage.googleapis.com')) {
      const parts = clean.split('/o/');
      if (parts.length > 1) {
        const baseUrl = parts[0] + '/o/';
        const fullPath = parts[1].split('?')[0]; 
        const params = parts[1].split('?')[1];   
        
        const pathSegments = fullPath.split('/');
        const folder = pathSegments[0];
        const fileName = pathSegments[pathSegments.length - 1];
        
        // Reconstruction propre pour Android
        return `${baseUrl}${folder}%2F${fileName}?${params}`;
      }
    }
    return clean;
  } catch (e) {
    return uri;
  }
};

const getImageUrl = (item: any): string => {
  const rawUri = item.imageUrl || item.image || (item.images && item.images[0]);
  const cleanedUri = getSafeFirebaseUri(rawUri);
  
  if (cleanedUri && cleanedUri.startsWith('http')) return cleanedUri;
  return 'https://asma.sn/placeholder.jpg'; // Ton placeholder
};

/* -------------------------------------------------- */
/* Cart Item Component - Mémoïsé pour performance     */
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
  formatPrice: (priceXOF: number | string) => string;
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
  const { t } = useTranslation();
  const itemPrice = Number(item.price) || 0;
  const itemQuantity = Number(quantity) || 1;
  const totalItemPrice = itemPrice * itemQuantity;
  
  return (
    <View style={styles.card}>
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

      {/* IMAGE CORRIGÉE ICI */}
      <Image 
        source={{ uri: getImageUrl(item) }} 
        style={styles.thumb} 
        resizeMode="cover"
      />

      <View style={styles.itemDetails}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        
        {(item.selectedSize || item.selectedColor) && (
          <View style={styles.variants}>
            {item.selectedSize && (
              <View style={styles.variantBadge}>
                <Text style={styles.variantText}>
                  {t('app.cart.size', { value: item.selectedSize })}
                </Text>
              </View>
            )}
            {item.selectedColor && (
              <View style={styles.variantBadge}>
                <Text style={styles.variantText}>
                  {t('app.cart.color', { value: item.selectedColor })}
                </Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.price}>
          {formatPrice(itemPrice)}{' '}
          <Text style={styles.unitSuffix}>{t('app.cart.perUnit')}</Text>
        </Text>

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

          {item.minOrder && item.minOrder > 1 && itemQuantity < item.minOrder && (
            <Text style={styles.minOrderWarning}>
              {t('app.cart.minShort', { value: item.minOrder })}
            </Text>
          )}
        </View>

        <Text style={styles.itemTotal}>
          {t('app.cart.total', { amount: formatPrice(totalItemPrice) })}
        </Text>
      </View>

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

const EmptyCart = memo(({ onContinueShopping }: { onContinueShopping: () => void }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="cart-outline" size={80} color="#ff6a00" />
      </View>
      <Text style={styles.emptyTitle}>{t('app.cart.emptyTitle')}</Text>
      <Text style={styles.emptySubtitle}>{t('app.cart.emptySubtitle')}</Text>
      <TouchableOpacity
        style={styles.shopButton}
        onPress={onContinueShopping}
        activeOpacity={0.8}
      >
        <Text style={styles.shopButtonText}>{t('app.cart.continueShopping')}</Text>
      </TouchableOpacity>
    </View>
  );
});

EmptyCart.displayName = 'EmptyCart';

/* -------------------------------------------------- */
/* Main Component                                     */
/* -------------------------------------------------- */

export default function CartScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const { formatPrice } = useCurrency();
  const { cartItems, updateQuantity, removeFromCart } = useCart();
  const { initOrder } = useCheckout();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [selectAll, setSelectAll] = useState(true);

  const updateTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    const q: Record<string, number> = {};
    cartItems.forEach(item => {
      q[item.cartId] = saneQty(item.quantity);
    });
    setQuantities(q);
  }, [cartItems]);

  useEffect(() => {
    if (cartItems.length > 0) {
      setSelected(new Set(cartItems.map(i => i.cartId)));
      setSelectAll(true);
    }
  }, [cartItems]);

  const selectedItems = useMemo(() => 
    cartItems.filter(i => selected.has(i.cartId)),
    [cartItems, selected]
  );

  const subtotalXOF = useMemo(
    () =>
      selectedItems.reduce((sum, item) => {
        const qty = Number(quantities[item.cartId] ?? saneQty(item.quantity)) || 0;
        const rawPrice = Number(item.price) || 0;
        const isZero = isZeroDollarsProduct({
          price: rawPrice,
          companyName: item.seller || undefined,
          supplier: (item as any).supplier,
          seller: item.seller || undefined,
          name: item.name,
        });
        const price = isZero ? 0 : rawPrice;
        return sum + price * qty;
      }, 0),
    [selectedItems, quantities]
  );

  const selectedCount = selectedItems.length;
  
  const totalQuantity = useMemo(() => 
    selectedItems.reduce((sum, item) => {
      const qty = Number(quantities[item.cartId] ?? saneQty(item.quantity)) || 0;
      return sum + qty;
    }, 0),
    [selectedItems, quantities]
  );

  const toggleSelectAll = useCallback(() => {
    if (selected.size === cartItems.length) {
      setSelected(new Set());
      setSelectAll(false);
    } else {
      setSelected(new Set(cartItems.map(i => i.cartId)));
      setSelectAll(true);
    }
  }, [selected, cartItems]);

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

  const handleIncrease = useCallback((item: CartItemType) => {
    const currentQty = Number(quantities[item.cartId] ?? saneQty(item.quantity)) || 1;
    const newQty = currentQty + 1;
    if (newQty <= 999) updateQuantityWithDebounce(item.cartId, newQty);
  }, [quantities, updateQuantityWithDebounce]);

  const handleDecrease = useCallback((item: CartItemType) => {
    const currentQty = Number(quantities[item.cartId] ?? saneQty(item.quantity)) || 1;
    if (currentQty <= 1) {
      handleRemove(item.cartId);
    } else {
      updateQuantityWithDebounce(item.cartId, currentQty - 1);
    }
  }, [quantities, updateQuantityWithDebounce]);

  const handleRemove = useCallback((cartId: string) => {
    Alert.alert(t('app.cart.removeTitle'), t('app.cart.removeOneMessage'), [
      { text: t('app.cart.cancel'), style: 'cancel' },
      { text: t('app.cart.removeConfirm'), onPress: () => removeFromCart(cartId), style: 'destructive' },
    ]);
  }, [removeFromCart, t]);

  const handleRemoveSelected = useCallback(() => {
    if (selectedItems.length === 0) return;
    Alert.alert(
      t('app.cart.removeTitle'),
      t('app.cart.removeManyMessage', { count: selectedItems.length }),
      [
        { text: t('app.cart.cancel'), style: 'cancel' },
        {
          text: t('app.cart.removeConfirm'),
          onPress: () => {
            selectedItems.forEach((item) => removeFromCart(item.cartId));
            setSelected(new Set());
          },
          style: 'destructive',
        },
      ],
    );
  }, [selectedItems, removeFromCart, t]);

const handleCheckout = async () => {
    if (selectedItems.length === 0) return;
    setIsCheckingOut(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const orderData = {
        items: selectedItems.map(item => ({
          id: item.cartId,
          productId: item.id,
          name: item.name,
          price: Number(item.price),
          quantity: quantities[item.cartId] ?? item.quantity,
          imageUrl: item.image || item.imageUrl,
          companyName: displaySellerName({
            seller: item.seller,
            companyName: (item as { companyName?: string }).companyName,
            companyId: (item as { companyId?: string }).companyId,
          }),
          
          // --- AJOUTS CRUCIAUX POUR LE SHIPPING ---
          specifications: {
            // On récupère le poids depuis l'item du panier
            weight: item.specifications?.weight || (item as any).weight || 0,
            volume: item.specifications?.volume || (item as any).volume || 0,
          },
          hasFreeShipping: item.hasFreeShipping || false,
          // ----------------------------------------
        })),
        summary: {
          subtotal: Number(subtotalXOF),
          shipping: 0,
          total: Number(subtotalXOF)
        }
      };

      initOrder(orderData);
      router.push({
        pathname: '/checkout',
        params: {
          orderData: encodeURIComponent(JSON.stringify(orderData)),
        },
      });
    } catch (error) {
      console.error(error);
    } finally { 
      setIsCheckingOut(false); 
    }
  };

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
      formatPrice={formatPrice}
    />
  ), [selected, quantities, isUpdating, toggleItem, handleIncrease, handleDecrease, handleRemove, formatPrice]);

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <EmptyCart onContinueShopping={() => router.push('/')} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('app.cart.headerTitle')}{' '}
            <Text style={styles.headerCount}>({cartItems.length})</Text>
          </Text>
          <TouchableOpacity onPress={toggleSelectAll} style={styles.headerButton}>
            <Text style={styles.selectAllText}>
              {selectAll ? t('app.cart.deselectAll') : t('app.cart.selectAll')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={item => item.cartId}
        renderItem={renderCartItem}
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 + insets.bottom }]}
      />

      <View style={[styles.footerWrapper, { paddingBottom: insets.bottom || 10 }]}>
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View style={styles.footerLeft}>
              <Text style={styles.footerLabel}>
                {t('app.cart.itemsSelected', { count: selectedCount })}
              </Text>
              <Text style={styles.footerPrice}>{formatPrice(subtotalXOF)}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.checkoutBtn, (selectedCount === 0 || isCheckingOut) && styles.checkoutBtnDisabled]}
              onPress={handleCheckout}
              disabled={selectedCount === 0 || isCheckingOut}
            >
              {isCheckingOut ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.checkoutBtnTxt}>
                  {t('app.cart.checkout', { count: totalQuantity })}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          {selectedCount > 0 && (
            <TouchableOpacity style={styles.footerActions} onPress={handleRemoveSelected}>
              <Text style={styles.deleteSelectedText}>
                {t('app.cart.deleteSelection', { count: selectedCount })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  safeArea: { flex: 1, backgroundColor: '#fff' },
  headerWrapper: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  headerCount: { color: '#999', fontSize: 14 },
  selectAllText: { color: '#ff6a00', fontWeight: '600' },
  listContent: { flexGrow: 1, paddingTop: 8 },
  card: { flexDirection: 'row', backgroundColor: '#fff', marginVertical: 4, marginHorizontal: 16, padding: 12, borderRadius: 12, elevation: 2 },
  checkbox: { justifyContent: 'center', marginRight: 8 },
  thumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#f9f9f9' },
  itemDetails: { flex: 1, marginLeft: 12 },
  name: { fontWeight: '500', fontSize: 14, color: '#333', marginBottom: 4 },
  variants: { flexDirection: 'row', marginBottom: 4, flexWrap: 'wrap' },
  variantBadge: { backgroundColor: '#f5f5f5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 4 },
  variantText: { fontSize: 10, color: '#666' },
  price: { color: '#ff6a00', fontWeight: '700', fontSize: 15, marginBottom: 6 },
  unitSuffix: { fontSize: 12, color: '#999', fontWeight: '500' },
  quantityContainer: { flexDirection: 'row', alignItems: 'center' },
  quantityButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  quantityValue: { minWidth: 40, alignItems: 'center' },
  quantityText: { fontWeight: '600', fontSize: 16 },
  minOrderWarning: { fontSize: 10, color: '#ff6a00', marginLeft: 8 },
  itemTotal: { fontSize: 12, fontWeight: '600', color: '#333', marginTop: 4 },
  removeButton: { padding: 8, justifyContent: 'center' },
  footerWrapper: { backgroundColor: '#fff', position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  footer: { paddingHorizontal: 16, paddingTop: 12 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { flex: 1 },
  footerLabel: { fontSize: 12, color: '#999' },
  footerPrice: { fontSize: 20, fontWeight: '700', color: '#ff6a00' },
  checkoutBtn: { backgroundColor: '#ff6a00', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, minWidth: 140, alignItems: 'center' },
  checkoutBtnDisabled: { backgroundColor: '#ccc' },
  checkoutBtnTxt: { color: '#fff', fontWeight: '700' },
  footerActions: { marginTop: 10, alignItems: 'center', paddingBottom: 5 },
  deleteSelectedText: { color: '#ff4444', fontSize: 13, fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#fff3e0', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  emptySubtitle: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 8, marginBottom: 20 },
  shopButton: { backgroundColor: '#ff6a00', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 },
  shopButtonText: { color: '#fff', fontWeight: '600' }
});
