// src/screens/PaymentWebViewScreen.tsx

import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

export default function PaymentWebViewScreen({ route }: any) {
  const { paymentUrl } = route.params;

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: paymentUrl }}
        startInLoadingState
        renderLoading={() => (
          <ActivityIndicator size="large" style={styles.loader} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loader: {
    marginTop: 20,
  },
});
