import {
  View,
  StyleSheet,
  ActivityIndicator,
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
  const closedRef = useRef(false);

  useEffect(() => {
    if (!paymentUrl || typeof paymentUrl !== 'string') {
      router.replace('/');
    }
  }, [paymentUrl]);

  if (!paymentUrl || typeof paymentUrl !== 'string') return null;

  return (
    <SafeAreaView style={styles.safe}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#FF6A00" />
          <Text style={styles.text}>Paiement sécurisé…</Text>
        </View>
      )}

      <WebView
        source={{ uri: paymentUrl }}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        startInLoadingState
        mixedContentMode="always"
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={(nav) => {
          if (nav?.url) {
            console.log('🌐 WebView:', nav.url);
          }
          // ❌ AUCUNE LOGIQUE ICI
        }}
      />

      {/* Sortie volontaire */}
      <View style={styles.footer}>
        <Text
          style={styles.close}
          onPress={() => {
            if (closedRef.current) return;
            closedRef.current = true;
            router.replace({
              pathname: '/checkout/pending',
              params: { orderId },
            });
          }}
        >
          Fermer
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  loader: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  text: { marginTop: 12, fontSize: 14, color: '#555' },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  close: {
    color: '#FF6A00',
    fontWeight: '600',
    fontSize: 15,
  },
});