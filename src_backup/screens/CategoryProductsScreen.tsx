import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, Product, toImage } from "../config/api";

export default function CategoryProductsScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // ✅ Charger les produits dès l’ouverture de l’écran
  useEffect(() => {
    if (!id) return;

    const fetchProducts = async () => {
      try {
        console.log("📌 ID reçu depuis route:", id);
        const allProducts: Product[] = await api.products();

        // ✅ Filtrage propre côté client
        const filtered = allProducts.filter(
          (p) => String(p.categoryId) === String(id)
        );

        console.log("📦 Produits reçus:", allProducts.length);
        console.log("✅ Produits filtrés:", filtered.length);

        setProducts(filtered || []);
      } catch (err: unknown) {
        console.error("❌ Erreur chargement produits :", err);
        setError(err instanceof Error ? err.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [id]);

  // 🌀 Chargement
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ff6a00" />
        <Text style={styles.info}>Chargement des produits...</Text>
      </View>
    );
  }

  // ⚠️ Erreur API
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Erreur : {error}</Text>
      </View>
    );
  }

  // 📦 Aucun produit trouvé
  if (!products.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Aucun produit disponible dans {name}</Text>
      </View>
    );
  }

  // ✅ Affichage des produits
  return (
    <View style={styles.container}>
      <Text style={styles.header}>{name}</Text>

      <FlatList<Product>
        data={products}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        key={"grid-2"}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => <ProductCard item={item} router={router} />}
      />
    </View>
  );
}

// 🧩 Carte Produit
function ProductCard({ item, router }: { item: Product; router: any }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push(
          `/product-detail?id=${item.id}&name=${encodeURIComponent(item.name)}`
        )
      }
    >
      <Image
        source={{
          uri: item.image
            ? toImage(item.image)
            : item.imageUrl
            ? toImage(item.imageUrl)
            : `https://picsum.photos/seed/${encodeURIComponent(item.name)}/300/300`,
        }}
        style={styles.img}
        resizeMode="cover"
      />
      <Text numberOfLines={1} style={styles.name}>
        {item.name}
      </Text>
      <Text style={styles.price}>
        {item.price ? `${item.price.toLocaleString()} F CFA` : "Prix sur demande"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  info: { fontSize: 15, color: "#555", marginTop: 10 },
  error: {
    fontSize: 16,
    fontWeight: "600",
    color: "red",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  empty: {
    fontSize: 16,
    fontWeight: "500",
    color: "#777",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
    color: "#111",
  },
  card: {
    width: "48%",
    marginBottom: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
    elevation: 3,
  },
  img: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#f2f2f2",
  },
  name: { fontSize: 14, fontWeight: "500", marginBottom: 4, color: "#333" },
  price: { fontSize: 14, fontWeight: "700", color: "#ff6a00" },
});
