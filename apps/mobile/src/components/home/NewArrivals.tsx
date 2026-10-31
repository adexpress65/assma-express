// apps/mobile/src/components/home/NewArrivals.tsx
import React, { useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from "react-native";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

interface Product {
  id: string;
  name: string;
  price: string | number;
  image?: string;
}

const newArrivals: Product[] = [
  { id: "1", name: "Smartwatch dernière génération", price: "12 500", image: "https://picsum.photos/150/150?random=210" },
  { id: "2", name: "Sac en cuir tendance", price: "18 000", image: "https://picsum.photos/150/150?random=211" },
  { id: "3", name: "Chaussures sport", price: "9 800", image: "https://picsum.photos/150/150?random=212" },
  { id: "4", name: "Casque Bluetooth", price: "7 500", image: "https://picsum.photos/150/150?random=213" },
];

export default function NewArrivals() {
  const router = useRouter();

  const handlePress = useCallback((id: string) => {
    if (!id) return;
    router.push(`/product/${id}`);
  }, [router]);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>?? Nouveautés</Text>
        <TouchableOpacity onPress={() => router.push(/product/)}>
          <Text style={styles.seeAll}>Voir tout ?</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
        {newArrivals.map((item) => (
          <TouchableOpacity key={item.id} style={styles.card} onPress={() => handlePress(item.id)}>
            <Image source={{ uri: item.image ?? "https://via.placeholder.com/400" }} style={styles.image} />
            <Text style={styles.productName}>{item.name}</Text>
            <Text style={styles.price}>{typeof item.price === "number" ? item.price.toLocaleString() : item.price} FCFA</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Nouveau</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: "#fff", paddingVertical: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  seeAll: { fontSize: 14, fontWeight: "600", color: "#ff6a00" },
  scrollContainer: { paddingLeft: 16 },
  card: { width: width * 0.35, backgroundColor: "#fafafa", borderRadius: 8, marginRight: 12, padding: 8, alignItems: "center", position: "relative" },
  image: { width: "100%", height: 100, borderRadius: 6, marginBottom: 8 },
  productName: { fontSize: 13, fontWeight: "600", color: "#333", textAlign: "center", marginBottom: 4 },
  price: { fontSize: 14, fontWeight: "700", color: "#ff6a00" },
  badge: { position: "absolute", top: 6, left: 6, backgroundColor: "#00a650", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 10, fontWeight: "bold", color: "#fff" },
});
