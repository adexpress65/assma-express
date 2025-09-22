import React from "react";
import { View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, radius } from "../theme";

export default function Header() {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.brand}>ASSMA Market</Text>
        <Pressable style={styles.iconBtn} onPress={() => {}}>
          <Ionicons name="notifications-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.muted} />
        <TextInput
          placeholder="Rechercher un produit"
          placeholderTextColor={Colors.muted}
          style={styles.input}
          returnKeyType="search"
        />
        <Ionicons name="camera-outline" size={18} color={Colors.muted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.primary, paddingTop: 14, paddingHorizontal: 16, paddingBottom: 12 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  brand: { color: "#fff", fontSize: 18, fontWeight: "700" },
  iconBtn: { padding: 6, borderRadius: 9999 },
  search: {
    height: 40,
    backgroundColor: "#fff",
    borderRadius: radius.l,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8
  },
  input: { flex: 1, color: Colors.text, paddingVertical: 0 }
});
