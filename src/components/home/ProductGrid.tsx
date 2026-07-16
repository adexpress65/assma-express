import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import GridList from "../shared/GridList";
import { api, Product, toImage } from "../config/api";


export default function ProductGrid() {
  const mockProducts: Product[] = [
    {
      id: "1",
      name: "Produit A",
      price: 100,
      imageUrl: toImage("https://via.placeholder.com/150"),
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "2",
      name: "Produit B",
      price: 200,
      imageUrl: toImage("https://via.placeholder.com/150"),
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "3",
      name: "Produit C",
      price: 300,
      imageUrl: toImage("https://via.placeholder.com/150"),
      createdAt: "",
      updatedAt: "",
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Produits populaires</Text>
      <GridList
        data={mockProducts}
        numColumns={2}
        key={"grid2"} // ✅ important pour éviter le bug
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: item.imageUrl }} style={styles.img} />
            <Text numberOfLines={1} style={styles.name}>
              {item.name}
            </Text>
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
