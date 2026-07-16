import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PaymentWebView() {
  const router = useRouter();
  const { paymentUrl, orderId } = useLocalSearchParams<{
    paymentUrl?: string;
    orderId?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const handledRef = useRef(false);
  const closedRef = useRef(false);

  // 1. Sécurité : URL manquante
  useEffect(() => {
    if (!paymentUrl || typeof paymentUrl !== "string") {
      router.replace("/");
    }
  }, [paymentUrl]);

  // 2. Logique de redirection (Inspirée d'Alibaba)
  const processNavigation = (url: string): boolean => {
    if (handledRef.current) return false;

    console.log("🌐 Analyse URL:", url);

    const lower = url.toLowerCase();

    // CAS : Succès
    if (lower.includes("payment/success")) {
      handledRef.current = true;
      closedRef.current = true;
      router.replace({
        pathname: "/checkout/pending" as any,
        params: { orderId },
      });
      return false;
    }

    // CAS : Annulation ou Erreur
    if (lower.includes("payment/cancel") || lower.includes("payment/error")) {
      handledRef.current = true;
      closedRef.current = true;
      router.replace({
        pathname: "/checkout/confirmation" as any,
        params: { status: "cancel", orderId },
      });
      return false;
    }

    // CAS : Retour Boutique / Panier (Éviter l'écran blanc sur a2-expres.com)
    if (
      lower === "https://a2-expres.com/" ||
      lower === "https://a2-expres.com" ||
      lower.includes("back_to_cart") ||
      lower.includes("return_url")
    ) {
      handledRef.current = true;
      closedRef.current = true;
      router.replace("/cart");
      return false;
    }

    return true;
  };

  const handleShouldStart = (request: any) => {
    const { url } = request;

    // Interception des redirections de paiement
    const navigationHandled = processNavigation(url);
    if (!navigationHandled) return false;

    // Ouverture des apps externes (WhatsApp, Téléphone, etc.)
    if (!url.startsWith("http")) {
      Linking.openURL(url).catch(() => {});
      return false;
    }

    return true;
  };

  if (!paymentUrl || typeof paymentUrl !== "string") return null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header minimaliste style Browser */}
      <View style={styles.miniHeader}>
        <Text style={styles.secureText}>🔒 Paiement Sécurisé</Text>
      </View>

      <View style={styles.container}>
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#FF6A00" />
            <Text style={styles.loadingText}>Initialisation de la transaction...</Text>
          </View>
        )}

        <WebView
          source={{ uri: paymentUrl }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          mixedContentMode="always"
          onLoadEnd={() => setLoading(false)}
          onShouldStartLoadWithRequest={handleShouldStart}
          onNavigationStateChange={(navState) => processNavigation(navState.url)}
          style={styles.webview}
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.closeButton}
          onPress={() => {
            if (closedRef.current) return;
            closedRef.current = true;
            // Ne pas aller sur /checkout/pending : la commande reste souvent en
            // pending_payment et l’écran attend indéfiniment une transition paid/failed.
            router.replace({
              pathname: "/checkout/confirmation" as any,
              params: { status: "cancel", orderId: orderId ?? "" },
            });
          }}
        >
          <Text style={styles.closeText}>Annuler et retourner</Text>
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
  container: {
    flex: 1,
    position: "relative",
  },
  miniHeader: {
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  secureText: {
    fontSize: 12,
    color: "#4A5568",
    fontWeight: "600",
  },
  webview: {
    flex: 1,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 14,
    color: "#718096",
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
    paddingVertical: 10,
    paddingHorizontal: 25,
  },
  closeText: {
    color: "#E53E3E",
    fontWeight: "700",
    fontSize: 14,
  },
});