import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions } from "react-native";

const { width } = Dimensions.get("window");

// Exemple de produits en promo
const offers = [
  {
    id: "1",
    name: "Montre connectée",
    image: "https://picsum.photos/200/200?random=21",
    price: "12 500 F CFA",
    originalPrice: "18 000 F CFA",
    discount: "-30%",
    badge: "🔥 Hot",
  },
  {
    id: "2",
    name: "Casque Bluetooth",
    image: "https://picsum.photos/200/200?random=22",
    price: "20 000 F CFA",
    originalPrice: "28 000 F CFA",
    discount: "-25%",
    badge: "⚡ Flash",
  },
  {
    id: "3",
    name: "Sac de sport",
    image: "https://picsum.photos/200/200?random=23",
    price: "10 000 F CFA",
    originalPrice: "14 000 F CFA",
    discount: "-28%",
    badge: "🆕 New",
  },
];

// 🔥 Petit compte à rebours (simulateur)
function useCountdown(duration: number) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  return `${hours}h ${minutes}m ${seconds}s`;
}

export default function SpecialOffers() {
  const countdown = useCountdown(7200); // 2 heures

  return (
    <View style={styles.container}>
      {/* Header section */}
      <View style={styles.header}>
        <Text style={styles.title}>⚡ Offres Spéciales</Text>
        <Text style={styles.countdown}>⏳ {countdown}</Text>
      </View>

      {/* Liste horizontale */}
      <FlatList
        data={offers}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
            <Image source={{ uri: item.image }} style={styles.image} />
            <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{item.price}</Text>
              <Text style={styles.originalPrice}>{item.originalPrice}</Text>
            </View>
            <View style={styles.discountTag}>
              <Text style={styles.discountText}>{item.discount}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  countdown: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ff0000",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginRight: 12,
    width: width * 0.45,
    padding: 10,
    position: "relative",
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
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  price: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ff6a00",
    marginRight: 6,
  },
  originalPrice: {
    fontSize: 12,
    color: "#999",
    textDecorationLine: "line-through",
  },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#ff6a00",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 1,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  discountTag: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#ff0000",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
});
