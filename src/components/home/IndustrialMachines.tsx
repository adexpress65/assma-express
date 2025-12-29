import React, { useEffect, useState } from "react";
import { 
  View, Text, StyleSheet, ScrollView, 
  Image, TouchableOpacity, Dimensions, ActivityIndicator 
} from "react-native";
import { useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../config/firebase";

const { width } = Dimensions.get("window");

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
}

export default function IndustrialMachines() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "products"),
      where("category", "==", "machines_industrielles")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Product[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name || "Produit sans nom",
        price: doc.data().price || 0,
        image: doc.data().image || "https://via.placeholder.com/200"
      }));
      setProducts(fetched);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Machines industrielles</Text>
        <TouchableOpacity onPress={() => router.push("/category/machines")}>
          <Text style={styles.seeAll}>Voir tout ?</Text>
        </TouchableOpacity>
      </View>

      {/* PRODUITS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {products.map((item) => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.card}
            onPress={() => router.push(`/product/${item.id}`)}
          >
            <Image source={{ uri: item.image }} style={styles.image} />
            
            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>

            <Text style={styles.price}>
              {item.price.toLocaleString()} F CFA
            </Text>

            <View style={styles.badge}>
              <Text style={styles.badgeText}>TOP</Text>
            </View>
          </TouchableOpacity>
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
  loaderContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
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
