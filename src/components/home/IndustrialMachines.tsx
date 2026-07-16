import React, { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, ActivityIndicator } from "react-native";
import GridList from "../shared/GridList";
import { api, Product, toImage } from "../config/api";
import { Category } from "../../config/api"; // ✅ correction du chemin



export default function IndustrialMachines() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // 1. Récupérer toutes les catégories
        const cats: Category[] = await api.categories();

        // 2. Trouver l’ID de la catégorie "Machines"
        const machineCat = cats.find(
          (c) => c.name.toLowerCase().includes("machine")
        );

        if (!machineCat) {
          console.warn("⚠️ Catégorie Machines non trouvée");
          setLoading(false);
          return;
        }

        // 3. Charger les produits de cette catégorie
        const rows = await api.products({ categoryId: machineCat.id, limit: 6 });
        setProducts(rows);
      } catch (e) {
        console.error("❌ Erreur chargement Machines :", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" color="#ff6a00" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Machines Industrielles</Text>
      <GridList
        data={products}
        numColumns={2}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Image source={{ uri: toImage(item.imageUrl) }} style={styles.img} />
            <Text numberOfLines={1} style={styles.name}>
              {item.name}
            </Text>
            <Text style={styles.price}>{item.price} F CFA</Text>
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
    width: "48%",
    marginBottom: 15,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
  },
  img: { width: "100%", height: 120, borderRadius: 6, marginBottom: 5 },
  name: { fontSize: 13, fontWeight: "500" },
  price: { fontSize: 13, fontWeight: "700", color: "#ff6a00" },
});
