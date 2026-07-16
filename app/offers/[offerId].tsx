import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function OfferDetailsPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Offre indisponible</Text>
      <Text style={styles.subtitle}>Le detail de cette offre sera ajoute bientot.</Text>
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
