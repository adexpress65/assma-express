import React from "react";
import { View, Text, StyleSheet, Image, Button } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { Colors } from "../theme";

export default function ProductDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, "ProductDetail">>();
  const { title, price, image } = route.params;

  return (
    <View style={styles.wrap}>
      <Image source={{ uri: image }} style={styles.img} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.price}>{price}</Text>
      <Button title="Ajouter au panier" onPress={() => {}} color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#fff", padding: 16, gap: 12 },
  img: { width: "100%", height: 220, borderRadius: 12 },
  title: { fontSize: 18, fontWeight: "800" },
  price: { color: Colors.primary, fontWeight: "800", fontSize: 16 }
});
