import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Text,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PaymentWebView() {
  const { paymentUrl, orderId } = useLocalSearchParams<{
    paymentUrl?: string;
    orderId?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const hasClosed = useRef(false);

  /* ⛔ Sécurité : URL invalide */
  useEffect(() => {
    if (!paymentUrl || typeof paymentUrl !== 'string') {
      Alert.alert(
        'Erreur de paiement',
        'La session de paiement est invalide ou expirée.',
        [
          {
            text: 'Retour',
            onPress: () => router.replace('/'),
          },
        ]
      );
    }
  }, [paymentUrl]);

  /* ⏳ Timeout purement informatif */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasClosed.current) {
        console.warn('⏳ Paiement toujours en cours...');
      }
    }, 120000);

    return () => clearTimeout(timer);
  }, []);

  if (!paymentUrl || typeof paymentUrl !== 'string') {
    return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
  }

  /**
   * 🔒 RÈGLE UNIQUE
   * Dès qu'on quitte le paypage NGenius → on ferme
   * AUCUNE DÉCISION DE STATUT ICI
   */
  const handleNavigation = (navState: any) => {
    const url: string | undefined = navState?.url;
    if (!url || hasClosed.current) return;

    console.log('🌐 WebView:', url);

    const isNgeniusPayPage =
      url.includes('ngenius-payments.com') ||
      url.includes('orabankml.ngenius-payments.com');

    // Dès que NGenius redirige ailleurs → on sort
    if (!isNgeniusPayPage) {
      hasClosed.current = true;

      router.replace({
        pathname: '/checkout/pending',
        params: { orderId },
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#FF6A00" />
          <Text style={styles.loaderText}>
            Connexion sécurisée…
          </Text>
        </View>
      )}

      <WebView
        source={{ uri: paymentUrl }}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={handleNavigation}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        mixedContentMode="always"
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures={false}
        userAgent={
          Platform.OS === 'android'
            ? 'Chrome/18.0.1025.133 Mobile Safari/535.19'
            : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    zIndex: 10,
  },
  loaderText: {
    marginTop: 14,
    fontSize: 14,
    color: '#718096',
    fontWeight: '500',
  },
});