// apps/mobile/src/components/home/SpecialOffers.tsx
import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { router } from "expo-router";

interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  discount?: number;
  categoryId?: string;
}

export default function SpecialOffers({ products = [] }: { products: Product[] }) {
  const handleProductPress = (product: Product) => {
    // 🔥 Naviguer vers la catégorie "special-offers" quand on clique sur un produit
    router.push("/category/special-offers");
  };

  const handleSeeAll = () => {
    router.push("/category/special-offers");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meilleures Offres</Text>
        <TouchableOpacity onPress={handleSeeAll}>
          <Text style={styles.seeAll}>Voir tout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.productsContainer}>
        {products.slice(0, 6).map((p) => (
          <TouchableOpacity key={p.id} style={styles.card} onPress={() => handleProductPress(p)}>
            {p.discount ? (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{p.discount}%</Text>
              </View>
            ) : null}

            <Image
              source={{ uri: p.imageUrl ?? "https://via.placeholder.com/400" }}
              style={styles.image}
            />
            <Text numberOfLines={1} style={styles.name}>
              {p.name}
            </Text>
            <Text style={styles.price}>
              {typeof p.price === "number" ? p.price.toLocaleString() : p.price} FCFA
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  header: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  title: { fontSize: 16, fontWeight: "bold" },
  seeAll: { color: "#ff6a00", fontWeight: "600" },
  productsContainer: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    paddingHorizontal: 8,
    justifyContent: "space-between",
  },
  card: {
    width: "31%",
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 8,
    borderColor: "#eee",
    borderWidth: 1,
  },
  discountBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#ff4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  discountText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  image: { 
    width: "100%", 
    height: 80,
    borderRadius: 6, 
    marginBottom: 6 
  },
  name: { 
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  price: { 
    marginTop: 4, 
    fontWeight: "700", 
    color: "#ff6a00",
    fontSize: 12,
    textAlign: "center",
  },
});