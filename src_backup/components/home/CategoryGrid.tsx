import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

// 🔥 Catégories AVEC ICÔNES VALIDES
const categories = [
  { id: "1", name: "Vêtements", icon: "shirt-outline" },
  { id: "2", name: "Électronique", icon: "phone-portrait-outline" },
  { id: "3", name: "Beauté", icon: "sparkles-outline" },
  { id: "4", name: "Maison", icon: "home-outline" },
  { id: "5", name: "Jouets", icon: "game-controller-outline" },
  { id: "6", name: "Sports", icon: "bicycle-outline" },
  { id: "7", name: "Accessoires", icon: "watch-outline" },
  { id: "8", name: "Automobile", icon: "car-outline" },
  { id: "9", name: "Santé", icon: "fitness-outline" },
  { id: "10", name: "Informatique", icon: "laptop-outline" },
  { id: "11", name: "Bébés", icon: "heart-outline" }, // ✅ CORRIGÉ ICI
  { id: "12", name: "Alimentation", icon: "fast-food-outline" },
];

// ✅ Découpage en pages (4 colonnes × 2 lignes = 8 catégories par page)
const chunkArray = (arr: any[], size: number) => {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

export default function CategoryGrid() {
  const pages = chunkArray(categories, 8); // 8 par page
  const [activePage, setActivePage] = useState(0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🛍️ Catégories principales</Text>

      {/* FlatList horizontale avec pagination */}
      <FlatList
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, index) => "page-" + index}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setActivePage(index);
        }}
        renderItem={({ item }) => (
          <View style={styles.page}>
            {item.map((cat) => (
              <TouchableOpacity key={cat.id} style={styles.card}>
                <View style={styles.iconCircle}>
                  <Ionicons name={cat.icon as any} size={26} color="#ff6a00" />
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

      {/* Indicateurs de page (petits points) */}
      <View style={styles.indicators}>
        {pages.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, activePage === index && styles.activeDot]}
          />
        ))}
      </View>
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
  page: {
    width,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  card: {
    width: width / 4 - 20,
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff0e6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  name: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  indicators: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ccc",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#ff6a00",
  },
});
