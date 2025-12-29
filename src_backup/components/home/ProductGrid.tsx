import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

// ✅ Produits populaires mock (remplace par ton API)
const mockProducts = [
  {
    id: "1",
    name: "Montre connectée",
    price: "15 000 F CFA",
    rating: 4.5,
    image: "https://picsum.photos/200/200?random=41",
  },
  {
    id: "2",
    name: "Casque Bluetooth",
    price: "25 000 F CFA",
    rating: 4.2,
    image: "https://picsum.photos/200/200?random=42",
  },
  {
    id: "3",
    name: "Sac à dos voyage",
    price: "18 500 F CFA",
    rating: 4.7,
    image: "https://picsum.photos/200/200?random=43",
  },
  {
    id: "4",
    name: "Chaussures sport",
    price: "20 000 F CFA",
    rating: 4.3,
    image: "https://picsum.photos/200/200?random=44",
  },
];

// ⭐ Composant pour afficher les étoiles
const Stars = ({ rating }: { rating: number }) => {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Ionicons
        key={i}
        name={i <= Math.floor(rating) ? "star" : "star-outline"}
        size={14}
        color="#ffb300"
      />
    );
  }
  return <View style={{ flexDirection: "row" }}>{stars}</View>;
};

export default function ProductGrid() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<typeof mockProducts>([]);

  useEffect(() => {
    // Simule un chargement (API call)
    setTimeout(() => {
      setProducts(mockProducts);
      setLoading(false);
    }, 1500);
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6a00" />
        <Text style={{ marginTop: 8, color: "#666" }}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔥 Produits populaires</Text>

      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <Image source={{ uri: item.image }} style={styles.image} />
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.price}>{item.price}</Text>
            <Stars rating={item.rating} />
          </TouchableOpacity>
        )}
        scrollEnabled={false}
      />

      {/* Bouton Voir + */}
      <TouchableOpacity style={styles.moreButton}>
        <Text style={styles.moreButtonText}>Voir plus →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#1a1a1a",
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    width: (width - 48) / 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  price: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ff6a00",
    marginBottom: 4,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  moreButton: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#ff6a00",
    alignSelf: "center",
    paddingHorizontal: 20,
  },
  moreButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
