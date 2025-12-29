import React from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

// 🔥 Données fictives pour Machines industrielles
const machines = [
  {
    id: "1",
    name: "Machine de découpe laser",
    price: "250 000 F CFA",
    image: "https://picsum.photos/200/200?random=310",
  },
  {
    id: "2",
    name: "Imprimante 3D industrielle",
    price: "450 000 F CFA",
    image: "https://picsum.photos/200/200?random=311",
  },
  {
    id: "3",
    name: "Presse hydraulique",
    price: "380 000 F CFA",
    image: "https://picsum.photos/200/200?random=312",
  },
  {
    id: "4",
    name: "Robot industriel",
    price: "1 200 000 F CFA",
    image: "https://picsum.photos/200/200?random=313",
  },
];

export default function IndustrialMachines() {
  return (
    <View style={styles.section}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Machines industrielles</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>Voir tout ➜</Text>
        </TouchableOpacity>
      </View>

      {/* Produits scroll horizontal */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {machines.map((item) => (
          <View key={item.id} style={styles.card}>
            <Image source={{ uri: item.image }} style={styles.image} />
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.price}>{item.price}</Text>
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
    marginBottom: 8,
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
    width: width * 0.45,
    backgroundColor: "#fafafa",
    borderRadius: 8,
    marginRight: 12,
    padding: 10,
    alignItems: "center",
    position: "relative",
  },
  image: {
    width: "100%",
    height: 120,
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
    fontSize: 15,
    fontWeight: "700",
    color: "#ff6a00",
  },
  badge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#ff0000",
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
