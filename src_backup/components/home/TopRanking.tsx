import React from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

// 🔥 Données fictives pour "Produits au top du classement"
const topProducts = [
  {
    id: "1",
    name: "Artisanat du papier",
    price: "2 500 F CFA",
    image: "https://picsum.photos/150/150?random=200",
  },
  {
    id: "2",
    name: "Produits d'entretien",
    price: "1 800 F CFA",
    image: "https://picsum.photos/150/150?random=201",
  },
  {
    id: "3",
    name: "Batterie industrielle",
    price: "15 000 F CFA",
    image: "https://picsum.photos/150/150?random=202",
  },
  {
    id: "4",
    name: "Équipement médical",
    price: "45 000 F CFA",
    image: "https://picsum.photos/150/150?random=203",
  },
];

export default function TopRanking() {
  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Produits au top du classement</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>Voir tout ➜</Text>
        </TouchableOpacity>
      </View>

      {/* Produits en scroll horizontal */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {topProducts.map((product) => (
          <View key={product.id} style={styles.card}>
            <Image source={{ uri: product.image }} style={styles.image} />
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.price}>{product.price}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>TOP</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: "#fff",
    paddingVertical: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  seeAll: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ff6a00",
  },
  scrollContainer: {
    paddingLeft: 16,
  },
  card: {
    width: width * 0.35,
    backgroundColor: "#fafafa",
    borderRadius: 8,
    marginRight: 12,
    padding: 8,
    alignItems: "center",
    position: "relative",
  },
  image: {
    width: "100%",
    height: 100,
    borderRadius: 6,
    marginBottom: 8,
  },
  productName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ff6a00",
  },
  badge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#000",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
  },
});
