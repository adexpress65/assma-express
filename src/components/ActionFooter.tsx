// mobile/src/components/ActionFooter.tsx - VERSION MODIFIÉE
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';

interface ActionFooterProps {
  product: any;
  onChat?: () => void;
  onAddToCart?: () => void; // ✅ NOUVEAU : Handler pour l'ajout au panier
  addingToCart?: boolean; // ✅ NOUVEAU : État de chargement
}

export default function ActionFooter({ product, onChat, onAddToCart, addingToCart = false }: ActionFooterProps) {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ✅ SUPPRESSION : Plus de gestion de quantité locale
  // const [quantity, setQuantity] = useState(2);
  // const [showQuantitySelector, setShowQuantitySelector] = useState(false);

const handleChat = () => {
  if (!user) {
    Alert.alert("Connexion requise", "Veuillez vous connecter pour chatter");
    return;
  }

  // Identification vendeur FIABLE
  const sellerId =
    product?.sellerId ||
    product?.creatorId ||
    product?.vendorId ||
    product?.userId ||
    null;

  if (!sellerId) {
    console.warn("⚠️ sellerId introuvable → produit incomplet :", product);
    Alert.alert(
      "Erreur",
      "Impossible d'ouvrir le chat. ID vendeur manquant."
    );
    return;
  }

  // ❌ Empêche chat avec soi-même
  if (sellerId === user.uid) {
    Alert.alert("Information", "Vous ne pouvez pas chatter avec vous-même.");
    return;
  }

  const chatParams = {
    productId: String(product.id),
    productName: String(product.name || ""),
    productImage: String(
      product?.imageUrl ||
      product?.images?.[0] ||
      product?.mainImage ||
      ""
    ),
    productPrice: String(product.price ?? ""),
    sellerId: String(sellerId),

    // IMPORTANT pour ton système multi-boutiques
    companyId: String(product.companyId || ""),
    companyName: String(product.companyName || "")
  };

  console.log("📨 Ouverture chat avec params :", chatParams);

  if (onChat) {
    onChat(chatParams);
    return;
  }

  router.push({
    pathname: `/conversation/${sellerId}`,
    params: chatParams
  });
};


  // ✅ MODIFICATION : Utilisation du handler parent pour l'ajout au panier
  const handleAddToCart = () => {
    if (!product) {
      Alert.alert('Erreur', 'Produit non disponible');
      return;
    }

    if (!user) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour ajouter au panier');
      return;
    }

    if (onAddToCart) {
      onAddToCart(); // ✅ Appel du handler parent
    }
  };

  const handleBuyNow = () => {
    if (!product) {
      Alert.alert('Erreur', 'Produit non disponible');
      return;
    }

    if (!user) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour acheter');
      return;
    }

    handleAddToCart();
  };

  const footerHeight = 60 + insets.bottom;

  return (
    <View style={[styles.container, { height: footerHeight }]}>
      {/* ✅ SUPPRESSION : Overlay de sélection de quantité */}

      <View style={[styles.mainActions, { marginBottom: insets.bottom }]}>
        <View style={styles.secondaryActions}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={handleChat}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FF6A00" />
            <Text style={styles.iconButtonText}>Chat</Text>
          </TouchableOpacity>
          
          {/* ✅ SUPPRESSION : Bouton de quantité */}
        </View>

        <View style={styles.primaryActions}>
          <TouchableOpacity 
            style={[styles.addToCartButton, addingToCart && styles.addToCartButtonDisabled]}
            onPress={handleAddToCart}
            disabled={addingToCart}
          >
            {addingToCart ? (
              <>
                <Ionicons name="time-outline" size={16} color="#fff" />
                <Text style={styles.addToCartText}>Ajout...</Text>
              </>
            ) : (
              <>
                <Ionicons name="cart" size={16} color="#fff" />
                <Text style={styles.addToCartText}>Panier</Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.orderButton, addingToCart && styles.orderButtonDisabled]}
            onPress={handleBuyNow}
            disabled={addingToCart}
          >
            {addingToCart ? (
              <Text style={styles.orderButtonText}>Chargement...</Text>
            ) : (
              <Text style={styles.orderButtonText}>Acheter maintenant</Text>
            )}
          </TouchableOpacity>
        </View>
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
    borderTopColor: '#e8e8e8',
    paddingHorizontal: 12,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  mainActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#FFF5EB',
    minWidth: 60,
  },
  iconButtonText: {
    fontSize: 10,
    color: '#FF6A00',
    fontWeight: '500',
    marginTop: 2,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF6A00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 80,
    justifyContent: 'center',
  },
  addToCartButtonDisabled: {
    backgroundColor: '#FF9E66',
    opacity: 0.8,
  },
  addToCartText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  orderButton: {
    backgroundColor: '#E55A00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#E55A00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  orderButtonDisabled: {
    backgroundColor: '#FF9E66',
    shadowColor: '#FF9E66',
    opacity: 0.8,
  },
  orderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});