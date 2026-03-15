import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Linking,
} from "react-native";

import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PaymentWebView() {
  const router = useRouter();

  const { paymentUrl, orderId } = useLocalSearchParams<{
    paymentUrl?: string;
    orderId?: string;
  }>();

  const [loading, setLoading] = useState(true);

  const closedRef = useRef(false);
  const handledRef = useRef(false);

  // sécurité si url manquante
  useEffect(() => {
    if (!paymentUrl || typeof paymentUrl !== "string") {
      router.replace("/");
    }
  }, [paymentUrl]);

  // timeout sécurité
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!closedRef.current) {
        router.replace({
          pathname: "/checkout/pending" as any,
          params: { orderId },
        });
      }
    }, 180000); // 3 minutes

    return () => clearTimeout(timer);
  }, []);

  const handleNavigation = (url: string) => {
    if (!url || handledRef.current) return;

    console.log("🌐 Navigation:", url);

    // retour succès
    if (url.startsWith("https://a2-expres.com/payment/success")) {
      handledRef.current = true;
      closedRef.current = true;

      router.replace({
        pathname: "/checkout/success" as any,
        params: { orderId },
      });

      return;
    }

    // retour annulation
    if (url.startsWith("https://a2-expres.com/payment/cancel")) {
      handledRef.current = true;
      closedRef.current = true;

      router.replace({
        pathname: "/checkout/failed" as any,
        params: { orderId },
      });

      return;
    }
  };

  const handleShouldStart = (request: any) => {
    const url = request.url;

    // ouverture app externe
    if (
      url.startsWith("tel:") ||
      url.startsWith("mailto:") ||
      url.startsWith("intent:")
    ) {
      Linking.openURL(url);
      return false;
    }

    handleNavigation(url);

    return true;
  };

  if (!paymentUrl || typeof paymentUrl !== "string") return null;

  return (
    <SafeAreaView style={styles.safe}>
      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#FF6A00" />
          <Text style={styles.text}>
            Connexion sécurisée à la passerelle de paiement…
          </Text>
        </View>
      )}

      <WebView
        source={{ uri: paymentUrl }}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        mixedContentMode="always"
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        onLoadEnd={() => setLoading(false)}
        onShouldStartLoadWithRequest={handleShouldStart}
        style={styles.webview}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            if (closedRef.current) return;

            closedRef.current = true;

            router.replace({
              pathname: "/checkout/pending" as any,
              params: { orderId },
            });
          }}
        >
          <Text style={styles.closeText}>Annuler et fermer</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },

  webview: {
    flex: 1,
  },

  loader: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.98)",
  },

  text: {
    marginTop: 15,
    fontSize: 15,
    color: "#2D3748",
    fontWeight: "500",
  },

  footer: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: "#F0F0F0",
    backgroundColor: "#fff",
    alignItems: "center",
  },

  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },

  closeText: {
    color: "#718096",
    fontWeight: "600",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
