import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { db } from "../src/config/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useCart } from "@/contexts/CartContext";
import { isZeroDollarsProduct } from "@/utils/zeroDollarsShop";

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q: string }>();
  const router = useRouter();
  const { addToCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (!q) return;
    const fetchResults = async () => {
      try {
        const productsRef = collection(db, "products");
        const snap = await getDocs(productsRef);
        const qLower = q.toLowerCase();

        const filtered: any[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          if (
            data.name?.toLowerCase().includes(qLower) ||
            data.category?.toLowerCase().includes(qLower) ||
            data.description?.toLowerCase().includes(qLower)
          ) {
            filtered.push({ id: doc.id, ...data });
          }
        });

        setResults(filtered);
      } catch (error) {
        console.error("Erreur recherche Firestore:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [q]);

  const getProductImage = (item: any) => {
    return item.image ||
      item.imageUrl ||
      item.photoUrl ||
      item.media?.main ||
      item.images?.[0] ||
      "https://via.placeholder.com/200x200.png?text=Assma+Express";
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff6a00" />
        <Text style={styles.loadingText}>Recherche de "{q}"...</Text>
      </View>
    );
  }

  if (results.length === 0) {
    return (
      <View style={styles.center}>
        <Text>Aucun produit trouvÃ© pour "{q}".</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={results}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: 20 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.8}
          onPress={() =>
            router.push({
              pathname: "/products/[id]",
              params: { id: item.id },
            })
          }
        >
          <Image source={{ uri: getProductImage(item) }} style={styles.image} />

          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            {item.description && (
              <Text style={styles.desc} numberOfLines={2}>
                {item.description}
              </Text>
            )}
            {typeof item.price !== "undefined" && (
              <Text style={styles.price}>
                {isZeroDollarsProduct({
                  price: item.price,
                  companyName: item.companyName,
                  supplier: item.supplier,
                  seller: item.seller,
                  name: item.name,
                })
                  ? "0 F CFA"
                  : `${item.price} F CFA`}
              </Text>
            )}

            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => addToCart(item)}
            >
              <Text style={styles.cartButtonText}>Ajouter au panier</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#555",
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 10,
    overflow: "hidden",
    elevation: 2,
  },
  image: {
    width: 100,
    height: 100,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    backgroundColor: "#f5f5f5",
  },
  info: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  desc: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  price: {
    marginTop: 6,
    color: "#ff6a00",
    fontWeight: "700",
  },
  cartButton: {
    marginTop: 10,
    backgroundColor: "#ff6a00",
    borderRadius: 6,
    paddingVertical: 6,
    alignItems: "center",
  },
  cartButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
