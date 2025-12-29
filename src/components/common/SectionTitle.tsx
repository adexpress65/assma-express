import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { Colors } from "../../theme"; // ✅ chemin corrigé

type Props = {
  title: string;
};

export default function SectionTitle({ title }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
});
