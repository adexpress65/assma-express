import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PaymentService } from '../src/services/payment/PaymentService';

export default function PaymentCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      console.log('🔗 Callback params:', params);
      
      // Simuler un traitement (à remplacer par vrai N-Genius)
      setTimeout(() => {
        // Pour TEST : simuler un succès
        router.replace({
          pathname: '/checkout/confirmation',
          params: { 
            orderId: `ORDER_${Date.now()}`,
            status: 'success'
          }
        });
      }, 2000);
    };

    handleCallback();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#FF6A00" />
      <Text style={{ marginTop: 16 }}>Traitement du paiement...</Text>
    </View>
  );
}