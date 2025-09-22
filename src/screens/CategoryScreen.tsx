 import React from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useRoute } from "@react-navigation/native";

const MOCK = [
  { title: "Produit A", price: "99.90 €" },
  { title: "Produit B", price: "149.50 €" },
  { title: "Produit C", price: "249.00 €" },
  { title: "Produit D", price: "79.00 €" },
];

export default function CategoryScreen() {
  const route = useRoute();
  const { name } = route.params || {};

  const data = MOCK.map((p) => ({ ...p, title: `${name} - ${p.title}` }));

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{name}</Text>
      <FlatList
        data={data}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.price}>{item.price}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: "#fff" },
  header: { fontSize: 20, fontWeight: "bold", marginBottom: 15, color: "#007bff" },
  card: { padding: 12, marginBottom: 10, backgroundColor: "#f9f9f9", borderRadius: 8 },
  title: { fontSize: 16, fontWeight: "600" },
  price: { fontSize: 14, color: "#007bff", marginTop: 4 },
}); 
