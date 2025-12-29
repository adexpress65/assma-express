import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PaymentWebView() {
  const { paymentUrl } = useLocalSearchParams<{ paymentUrl?: string }>();
  const [loading, setLoading] = useState(true);
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!paymentUrl || typeof paymentUrl !== 'string') {
      Alert.alert(
        'Erreur',
        'Lien de paiement invalide',
        [{ text: 'Retour', onPress: () => router.replace('/') }]
      );
    }
  }, [paymentUrl]);

  if (!paymentUrl || typeof paymentUrl !== 'string') {
    return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
        </View>
      )}

      <WebView
        source={{ uri: paymentUrl }}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={(navState) => {
          const url = navState.url;
          console.log('🔁 WebView URL:', url);

          if (hasNavigated.current) return;

          if (url.includes('example.com/success')) {
            hasNavigated.current = true;
            router.replace('/checkout/confirmation?status=success');
          }

          if (url.includes('example.com/cancel')) {
            hasNavigated.current = true;
            router.replace('/checkout/confirmation?status=cancel');
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    zIndex: 10,
  },
});
