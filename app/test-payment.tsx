import React from 'react';
import { View, Button, Alert } from 'react-native';
import { paymentService } from '@services/payment.service';

export default function TestPaymentScreen() {
  const testNGenius = async () => {
    try {
      const service = PaymentService.getInstance();
      const result = await service.processCardPayment(
        10.99, // 10.99 MAD pour test
        `TEST_${Date.now()}`,
        'test@assma.com'
      );
      
      if (result.success && result.paymentUrl) {
        Alert.alert(
          'Test N-Genius',
          `URL: ${result.paymentUrl}\n\nOuvre ce lien dans ton navigateur pour tester.`,
          [
            { text: 'Annuler' },
            { text: 'Ouvrir', onPress: () => 
              // Ouvre dans le navigateur
              console.log('URL à ouvrir:', result.paymentUrl)
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Erreur', error.message);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Button title="🔗 TESTER N-GENIUS" onPress={testNGenius} />
      <View style={{ marginTop: 10 }}>
        <Button title="📱 TEST DEEP LINK" onPress={() => 
          // Teste le callback
          console.log('Test callback')
        } />
      </View>
    </View>
  );
}