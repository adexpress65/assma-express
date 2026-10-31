import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function AddAddressScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Formulaire dÃ¢â‚¬â„¢ajout dÃ¢â‚¬â„¢adresse</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 20, fontWeight: "600" },
});
