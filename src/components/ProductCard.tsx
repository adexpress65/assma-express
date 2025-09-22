import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Colors, radius } from "../theme";

type Props = { title: string; price: string; image: string; onPress?: () => void; };
export default function ProductCard({ title, price, image, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Image source={{ uri: image }} style={styles.img} />
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.price}>{price}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: radius.l, padding: 10, width: "48%", marginBottom: 12, borderWidth: 1, borderColor: "#EEF2F7" },
  img: { width: "100%", height: 110, borderRadius: radius.m, marginBottom: 8 },
  title: { fontWeight: "700", color: "#111827", marginBottom: 2 },
  price: { color: Colors.primary, fontWeight: "700" }
});
