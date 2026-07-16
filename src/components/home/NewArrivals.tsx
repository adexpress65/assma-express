import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import GridList from "../shared/GridList";

const arrivals = [
  { id: "1", name: "Nouveau Produit 1", price: 150, imageUrl: "https://via.placeholder.com/150" },
  { id: "2", name: "Nouveau Produit 2", price: 180, imageUrl: "https://via.placeholder.com/150" },
  { id: "3", name: "Nouveau Produit 3", price: 220, imageUrl: "https://via.placeholder.com/150" },
];

export default function NewArrivals() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nouveautés</Text>
      <GridList
        data={arrivals}
        numColumns={2}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.imageUrl }} style={styles.img} />
            <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>{item.price} F CFA</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 10 },
  card: {
    width: "48%",
    marginBottom: 15,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
  },
  img: { width: "100%", height: 120, borderRadius: 6, marginBottom: 5 },
  name: { fontSize: 13, fontWeight: "500" },
  price: { fontSize: 13, fontWeight: "700", color: "#ff6a00" },
});
