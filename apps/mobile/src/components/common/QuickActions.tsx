import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, radius } from "../../theme"; // ✅ chemin corrigé

type Props = { 
  onExplore: () => void; 
  onQuote: () => void; 
};

export default function QuickActions({ onExplore, onQuote }: Props) {
  return (
    <View style={styles.row}>
      {/* Explorer */}
      <TouchableOpacity style={styles.tile} onPress={onExplore}>
        <View style={styles.icon}>
          <Ionicons name="grid-outline" size={20} color="#fff" />
        </View>
        <Text style={styles.title}>Explorer par catégories</Text>
      </TouchableOpacity>

      {/* Demander un devis */}
      <TouchableOpacity style={styles.tile} onPress={onQuote}>
        <View style={[styles.icon, { backgroundColor: Colors.accent }]}>
          <Ionicons name="document-text-outline" size={20} color="#fff" />
        </View>
        <Text style={styles.title}>Demander un devis</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  tile: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: "#EDF2F7",
    padding: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: {
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    fontSize: 13,
  },
});
