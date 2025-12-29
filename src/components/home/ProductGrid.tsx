import React from "react";
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from "react-native";
import { router } from "expo-router";

const ProductGrid = ({ title, products }) => {
  const handleProductPress = (product) => {
    // 🔥 CORRECTION : Aller DIRECTEMENT au produit, pas à la catégorie
    router.push(`/product/${product.id}`);
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => handleProductPress(item)}
          >
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.image}
            />
            <Text numberOfLines={2} style={styles.name}>
              {item.name}
            </Text>
            <Text style={styles.price}>{item.price} Fcfa</Text>
          </TouchableOpacity>
        )}
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 10, paddingHorizontal: 10 },
  title: { fontSize: 18, fontWeight: "600", marginBottom: 8, color: "#000" },
  card: {
    width: "31%",
    backgroundColor: "#fff",
    margin: "1%",
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#eee",
  },
  image: { width: "100%", height: 100, borderRadius: 4 },
  name: { fontSize: 12, color: "#333", marginTop: 6 },
  price: { fontSize: 13, fontWeight: "bold", color: "#ff6a00", marginTop: 4 },
});

export default ProductGrid;