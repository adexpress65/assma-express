import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useCart } from '../../src/contexts/CartContext';

export default function CheckoutAddress() {
  const router = useRouter();
  const { cartItems } = useCart();
  
  const [address, setAddress] = useState({
    fullName: '',
    street: '',
    city: '',
    postalCode: '',
    country: 'France',
    phone: ''
  });

  const handleContinue = () => {
    if (!address.fullName || !address.street || !address.city || !address.postalCode) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    router.push('/checkout/shipping');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Adresse de livraison</Text>
      
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Nom complet *"
          value={address.fullName}
          onChangeText={(text) => setAddress({...address, fullName: text})}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Adresse *"
          value={address.street}
          onChangeText={(text) => setAddress({...address, street: text})}
        />
        
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Ville *"
            value={address.city}
            onChangeText={(text) => setAddress({...address, city: text})}
          />
          
          <TextInput
            style={[styles.input, styles.halfInput]}
            placeholder="Code postal *"
            value={address.postalCode}
            onChangeText={(text) => setAddress({...address, postalCode: text})}
            keyboardType="numeric"
          />
        </View>
        
        <TextInput
          style={styles.input}
          placeholder="TÃƒÂ©lÃƒÂ©phone *"
          value={address.phone}
          onChangeText={(text) => setAddress({...address, phone: text})}
          keyboardType="phone-pad"
        />
      </View>

      <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
        <Text style={styles.continueButtonText}>Continuer vers la livraison</Text>
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
  form: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
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
