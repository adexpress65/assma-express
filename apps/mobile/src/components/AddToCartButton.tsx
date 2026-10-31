// src/components/AddToCartButton.tsx
import React, { useState } from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator, Alert } from 'react-native';

// Adapte ce hook pour ton state management (Redux / Context)
export default function AddToCartButton({ productId, productName, price, variant, available }: any) {
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!available) {
      Alert.alert('Produit en rupture');
      return;
    }
    setLoading(true);
    try {
      // TODO: Remplacer par ton logic Redux / firestore / panier
      // Exemple: dispatch(cartSlice.addItem({ productId, name: productName, price, variant, qty: 1 }))
      await new Promise(res => setTimeout(res, 400)); // fake
      Alert.alert('Ajouté au panier', `${productName} a été ajouté à votre panier.`);
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Impossible d\'ajouter au panier.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TouchableOpacity
        onPress={handleAdd}
        disabled={loading || !available}
        style={{
          backgroundColor: available ? '#ff6a00' : '#ccc',
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: 'center'
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '700' }}>{available ? 'Ajouter au panier' : 'Indisponible'}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
