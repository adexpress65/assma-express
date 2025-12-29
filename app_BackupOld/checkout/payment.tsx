// app/checkout/payment.tsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ScrollView,
  SafeAreaView,
  ActivityIndicator 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCart } from '../../src/contexts/CartContext';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export default function PaymentScreen() {
  const router = useRouter();
  const { cartItems, getTotalPrice, clearCart } = useCart();
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);

  const total = getTotalPrice();
  const subtotal = total - (total > 50 ? 0 : 2.99);

  const paymentMethods = [
    { id: 'card', name: 'Carte de crÃƒÂ©dit', icon: 'Ã°Å¸â€™Â³', description: 'Visa, Mastercard, CB' },
    { id: 'paypal', name: 'PayPal', icon: 'Ã°Å¸â€œÂ±', description: 'Paiement sÃƒÂ©curisÃƒÂ©' },
    { id: 'applepay', name: 'Apple Pay', icon: 'Ã°Å¸ÂÅ½', description: 'Paiement rapide' },
  ];

  const handlePayment = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Panier vide', 'Votre panier est vide');
      return;
    }

    setIsProcessing(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      router.push('/checkout/confirmation');
      clearCart();
    } catch (error) {
      Alert.alert('Erreur', 'Le paiement a ÃƒÂ©chouÃƒÂ©. Veuillez rÃƒÂ©essayer.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Paiement sÃƒÂ©curisÃƒÂ©</Text>
        
        {/* SÃƒÂ©lection mÃƒÂ©thode de paiement */}
        <View style={styles.methodsContainer}>
          <Text style={styles.sectionTitle}>Choisissez votre mode de paiement</Text>
          {paymentMethods.map(method => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.methodCard,
                selectedMethod === method.id && styles.methodSelected
              ]}
              onPress={() => setSelectedMethod(method.id)}
            >
              <Text style={styles.methodIcon}>{method.icon}</Text>
              <View style={styles.methodInfo}>
                <Text style={styles.methodName}>{method.name}</Text>
                <Text style={styles.methodDescription}>{method.description}</Text>
              </View>
              <View style={[
                styles.radio,
                selectedMethod === method.id && styles.radioSelected
              ]}>
                {selectedMethod === method.id && (
                  <View style={styles.radioInner} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* DÃƒÂ©tails de la commande */}
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>RÃƒÂ©capitulatif de commande</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total</Text>
            <Text style={styles.summaryValue}>{subtotal.toFixed(2)}Ã¢â€šÂ¬</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Livraison</Text>
            <Text style={styles.summaryValue}>
              {total > 50 ? 'GRATUIT' : '2.99Ã¢â€šÂ¬'}
            </Text>
          </View>
          
          {total > 50 && (
            <View style={styles.discountBadge}>
              <MaterialIcons name="local-offer" size={16} color="#4caf50" />
              <Text style={styles.discountText}>Livraison gratuite activÃƒÂ©e !</Text>
            </View>
          )}
          
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total TTC</Text>
            <Text style={styles.totalAmount}>{total.toFixed(2)}Ã¢â€šÂ¬</Text>
          </View>
        </View>

        {/* SÃƒÂ©curitÃƒÂ© */}
        <View style={styles.securitySection}>
          <View style={styles.securityHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#4caf50" />
            <Text style={styles.securityTitle}>Paiement 100% sÃƒÂ©curisÃƒÂ©</Text>
          </View>
          <Text style={styles.securityText}>
            Vos donnÃƒÂ©es bancaires sont cryptÃƒÂ©es et protÃƒÂ©gÃƒÂ©es. Nous ne stockons jamais vos informations de paiement.
          </Text>
        </View>
      </ScrollView>

      {/* Bouton de paiement FIXE en bas */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.payButtonText}>Traitement en cours...</Text>
            </View>
          ) : (
            <Text style={styles.payButtonText}>
              Payer {total.toFixed(2)}Ã¢â€šÂ¬
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100, // Espace pour le bouton fixe
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1a1a1a',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  methodsContainer: {
    marginBottom: 30,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#e1e5e9',
  },
  methodSelected: {
    borderColor: '#ff6a00',
    backgroundColor: '#fff8f0',
  },
  methodIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  methodDescription: {
    fontSize: 12,
    color: '#666',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#ff6a00',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff6a00',
  },
  summary: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fff4',
    padding: 10,
    borderRadius: 8,
    marginVertical: 5,
    gap: 6,
  },
  discountText: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
    paddingTop: 10,
    marginTop: 5,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff6a00',
  },
  securitySection: {
    backgroundColor: '#f0f9ff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
  },
  securityText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 20, // Ajuste selon ta tab bar
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  payButton: {
    backgroundColor: '#ff6a00',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#ff6a00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  payButtonDisabled: {
    backgroundColor: '#ccc',
    shadowColor: '#ccc',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
