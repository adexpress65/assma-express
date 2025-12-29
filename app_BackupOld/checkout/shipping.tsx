import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useCart } from '../../src/contexts/CartContext';

export default function CheckoutShipping() {
  const router = useRouter();
  const { cartItems, getTotalPrice } = useCart();
  
  // Calculer le total
  const total = getTotalPrice();
  
  const [selectedShipping, setSelectedShipping] = useState('standard');

  const shippingOptions = [
    {
      id: 'standard',
      name: 'Livraison Standard',
      price: 4.99,
      deliveryTime: '3-5 jours',
      freeThreshold: 50
    },
    {
      id: 'express', 
      name: 'Livraison Express',
      price: 9.99,
      deliveryTime: '1-2 jours',
      freeThreshold: 100
    },
    {
      id: 'priority',
      name: 'Livraison Prioritaire',
      price: 14.99,
      deliveryTime: '24h',
      freeThreshold: 150
    }
  ];

  const getShippingPrice = (option: any) => {
    return total >= option.freeThreshold ? 0 : option.price;
  };

  const handleContinue = () => {
    router.push('/checkout/payment');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Mode de livraison</Text>
      
      <View style={styles.shippingOptions}>
        {shippingOptions.map(option => {
          const shippingPrice = getShippingPrice(option);
          const isSelected = selectedShipping === option.id;
          
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.shippingCard,
                isSelected && styles.shippingCardSelected
              ]}
              onPress={() => setSelectedShipping(option.id)}
            >
              <View style={styles.shippingInfo}>
                <Text style={styles.shippingName}>{option.name}</Text>
                <Text style={styles.shippingTime}>{option.deliveryTime}</Text>
                {total >= option.freeThreshold && (
                  <Text style={styles.freeShipping}>Ã°Å¸Å½â€° Livraison gratuite</Text>
                )}
              </View>
              
              <Text style={styles.shippingPrice}>
                {shippingPrice === 0 ? 'GRATUIT' : `${shippingPrice.toFixed(2)}Ã¢â€šÂ¬`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
        <Text style={styles.continueButtonText}>Continuer vers le paiement</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  shippingOptions: {
    gap: 10,
    marginBottom: 20,
  },
  shippingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e1e5e9',
  },
  shippingCardSelected: {
    borderColor: '#ff6a00',
    backgroundColor: '#fff8f0',
  },
  shippingInfo: {
    flex: 1,
  },
  shippingName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  shippingTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  freeShipping: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '500',
  },
  shippingPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6a00',
  },
  continueButton: {
    backgroundColor: '#ff6a00',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
