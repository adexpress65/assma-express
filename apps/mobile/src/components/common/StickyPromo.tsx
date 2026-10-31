import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function StickyPromo() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>🚀 Bénéficiez jusqu’à -20% aujourd’hui !</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ff6a00",
    paddingVertical: 9,
    alignItems: "center",
    position: "absolute", // ✅ toujours fixé
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 5,
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
