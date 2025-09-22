// apps/mobile/src/components/CategoryPill.tsx
import React from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";

type Props = {
  label: string;
  onPress?: () => void;
};

export default function CategoryPill({ label, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.pill} onPress={onPress}>
      <Text style={styles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: "#eee",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 5,
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
  },
});
