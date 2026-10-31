import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function FlashDealDetailsPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Flash Deal indisponible</Text>
      <Text style={styles.subtitle}>Cette page sera activée prochainement.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
