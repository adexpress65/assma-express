// app/checkout/confirmation.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ConfirmationScreen() {
  const router = useRouter();
  
  // DonnÃƒÂ©es simulÃƒÂ©es (en rÃƒÂ©alitÃƒÂ©, on rÃƒÂ©cupÃƒÂ©rerait de l'API)
  const orderData = {
    orderId: 'CMD-' + Date.now(),
    estimatedDelivery: '15-16 dÃƒÂ©cembre',
    deliveryAddress: '123 Rue du Commerce, Paris 75001',
    items: [
      { name: 'Smartphone Android', price: 299.99, quantity: 1 },
      { name: 'Coque protectrice', price: 19.99, quantity: 2 },
    ],
    total: 339.97,
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header de confirmation */}
      <View style={styles.header}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={40} color="white" />
        </View>
        <Text style={styles.title}>Commande confirmÃƒÂ©e !</Text>
        <Text style={styles.subtitle}>
          Merci pour votre achat. Votre commande a ÃƒÂ©tÃƒÂ© traitÃƒÂ©e avec succÃƒÂ¨s.
        </Text>
      </View>

      {/* DÃƒÂ©tails de la commande */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RÃƒÂ©sumÃƒÂ© de la commande</Text>
        
        <View style={styles.orderInfo}>
          <Text style={styles.infoLabel}>NÃ‚Â° de commande</Text>
          <Text style={styles.infoValue}>{orderData.orderId}</Text>
        </View>
        
        <View style={styles.orderInfo}>
          <Text style={styles.infoLabel}>Livraison estimÃƒÂ©e</Text>
          <Text style={styles.infoValue}>{orderData.estimatedDelivery}</Text>
        </View>
        
        <View style={styles.orderInfo}>
          <Text style={styles.infoLabel}>Adresse de livraison</Text>
          <Text style={styles.infoValue}>{orderData.deliveryAddress}</Text>
        </View>
      </View>

      {/* Articles commandÃƒÂ©s */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Articles commandÃƒÂ©s</Text>
        {orderData.items.map((item, index) => (
          <View key={index} style={styles.item}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemDetails}>
              {item.quantity} Ãƒâ€” {item.price}Ã¢â€šÂ¬
            </Text>
          </View>
        ))}
        <View style={styles.total}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{orderData.total}Ã¢â€šÂ¬</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.primaryButton}
          onPress={() => router.push('/')}
        >
          <Text style={styles.primaryButtonText}>Continuer mes achats</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton}
          onPress={() => router.push('/orders')}
        >
          <Text style={styles.secondaryButtonText}>Voir mes commandes</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: 'white',
    marginBottom: 10,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoLabel: {
    color: '#666',
    fontSize: 14,
  },
  infoValue: {
    fontWeight: '600',
    fontSize: 14,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemName: {
    flex: 1,
    fontSize: 14,
  },
  itemDetails: {
    fontSize: 14,
    color: '#666',
  },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
  },
  totalLabel: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  totalAmount: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#007AFF',
  },
  actions: {
    padding: 20,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
