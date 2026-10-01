import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRequireAuth } from '../contexts/AuthGuardContext';
import { useRouter } from 'expo-router';

interface ActionFooterProps {
  product: any;
  onChat?: () => void;
  chatDisabled?: boolean;
  onAddToCart?: () => void;
  onBuyNow?: () => void;
  addingToCart?: boolean;
  /** Désactive Panier + Commander (qty 0, MOQ, stock, etc.) */
  disabled?: boolean;
  /** Message toast/alerte si l'utilisateur tape alors que disabled */
  disabledReason?: string;
}

export default function ActionFooter({
  product,
  onChat,
  chatDisabled = false,
  onAddToCart,
  onBuyNow,
  addingToCart = false,
  disabled = false,
  disabledReason,
}: ActionFooterProps) {
  const { requireAuth } = useRequireAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const actionsLocked = disabled || addingToCart;

  const showDisabledReason = () => {
    if (disabledReason) {
      Alert.alert('Sélection requise', disabledReason);
    }
  };

  const runAddToCart = async () => {
    if (disabled) {
      showDisabledReason();
      return;
    }
    const added = await onAddToCart?.();
    if (added) {
      router.push("/cart");
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 12 }]}>
      <View style={styles.content}>
        
        <TouchableOpacity
          style={[styles.cartIconButton, disabled && styles.cartIconDisabled]}
          onPress={async () => {
            if (addingToCart) return;
            if (disabled) {
              showDisabledReason();
              return;
            }
            if (!requireAuth({ reason: 'add_to_cart', onAuthorized: () => { void runAddToCart(); } })) return;
            await runAddToCart();
          }}
          disabled={addingToCart}
          accessibilityState={{ disabled: actionsLocked }}
        >
          <Ionicons name="cart-outline" size={24} color={disabled ? '#AAA' : '#333'} />
          <Text style={[styles.cartIconText, disabled && styles.cartIconTextDisabled]}>Panier</Text>
        </TouchableOpacity>

        {/* BOUTON DISCUTER */}
        <TouchableOpacity
          style={[styles.chatButton, chatDisabled && styles.chatButtonDisabled]}
          onPress={() => {
            if (!requireAuth({ reason: 'contact_seller', onAuthorized: () => onChat?.() })) return;
            onChat?.();
          }}
          disabled={chatDisabled}
        >
          <Text style={styles.chatButtonText}>Discuter</Text>
        </TouchableOpacity>

        {/* BOUTON COMMANDER (Direct Checkout) */}
        <TouchableOpacity 
          style={[styles.orderButton, actionsLocked && styles.disabledButton]} 
          onPress={() => {
            if (addingToCart) return;
            if (disabled) {
              showDisabledReason();
              return;
            }
            if (!onBuyNow) return;
            if (!requireAuth({ reason: 'buy_now', onAuthorized: () => onBuyNow() })) return;
            onBuyNow();
          }}
          disabled={actionsLocked}
          accessibilityState={{ disabled: actionsLocked }}
        >
          {addingToCart ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={styles.orderButtonText}>Commander</Text>
          )}
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingHorizontal: 12,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
  },
  cartIconDisabled: {
    opacity: 0.45,
  },
  cartIconText: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  cartIconTextDisabled: {
    color: '#AAA',
  },
  chatButton: {
    flex: 1,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatButtonDisabled: {
    opacity: 0.45,
  },
  chatButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  orderButton: {
    flex: 2,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FF6A00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  }
});
