import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter } from 'expo-router';

interface ActionFooterProps {
  product: any;
  onChat?: () => void;
  chatDisabled?: boolean;
  onAddToCart?: () => void;
  onBuyNow?: () => void; // ✅ Prop pour l'achat direct
  addingToCart?: boolean;
}

export default function ActionFooter({ product, onChat, chatDisabled = false, onAddToCart, onBuyNow, addingToCart = false }: ActionFooterProps) {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 12 }]}>
      <View style={styles.content}>
        
<TouchableOpacity
  style={styles.cartIconButton}
  onPress={async () => {
    if (addingToCart) return;

    const added = await onAddToCart?.();

    if (added) {
      router.push("/cart"); // navigation seulement si ajout OK
    }
  }}
>
  <Ionicons name="cart-outline" size={24} color="#333" />
  <Text style={styles.cartIconText}>Panier</Text>
</TouchableOpacity>

        {/* BOUTON DISCUTER */}
        <TouchableOpacity
          style={[styles.chatButton, chatDisabled && styles.chatButtonDisabled]}
          onPress={onChat}
          disabled={chatDisabled}
        >
          <Text style={styles.chatButtonText}>Discuter</Text>
        </TouchableOpacity>

        {/* BOUTON COMMANDER (Direct Checkout) */}
        <TouchableOpacity 
          style={[styles.orderButton, addingToCart && styles.disabledButton]} 
          onPress={onBuyNow} 
          disabled={addingToCart}
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
  cartIconText: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
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
    flex: 2, // Plus large pour mettre en avant l'action principale
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