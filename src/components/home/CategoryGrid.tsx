import React from "react";
import { View, Text, StyleSheet } from "react-native";
// import GridList from "../../../shared/GridList";
import GridList from "../shared/GridList";

const categories = [
  { id: "1", name: "Électroniques" },
  { id: "2", name: "Modes" },
  { id: "3", name: "Maisons" },
  { id: "4", name: "Machines" },
];

export default function CategoryGrid() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Catégories</Text>
      <GridList
        data={categories}
        numColumns={3}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
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
    width: "30%",
    marginBottom: 15,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  name: { fontSize: 13, fontWeight: "600" },
});
