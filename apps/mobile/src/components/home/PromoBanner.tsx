import React, { useRef, useState, useEffect } from "react";
import { View, Text, Image, StyleSheet, Dimensions, FlatList } from "react-native";

const { width } = Dimensions.get("window");

// ✅ Bannières mock (tu peux mettre les tiennes)
const banners = [
  {
    id: "1",
    title: "🔥 Jusqu’à -50% aujourd’hui !",
    subtitle: "Livraison rapide et produits certifiés",
    image: "https://picsum.photos/800/200?random=11",
  },
  {
    id: "2",
    title: "✨ Nouveautés du mois",
    subtitle: "Découvrez les tendances 2025",
    image: "https://picsum.photos/800/200?random=12",
  },
  {
    id: "3",
    title: "⚡ Offres Flash",
    subtitle: "Stock limité, dépêchez-vous !",
    image: "https://picsum.photos/800/200?random=13",
  },
];

export default function PromoBanner() {
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-scroll toutes les 3 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (activeIndex + 1) % banners.length;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeIndex]);

  return (
    <View style={styles.bannerContainer}>
      <FlatList
        ref={flatListRef}
        data={banners}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setActiveIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={styles.banner}>
            <Image source={{ uri: item.image }} style={styles.bannerImage} resizeMode="cover" />
            <View style={styles.overlay}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            </View>
          </View>
        )}
      />

      {/* Indicateurs (petits points) */}
      <View style={styles.indicators}>
        {banners.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, activeIndex === index && styles.activeDot]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    marginVertical: 16,
  },
  banner: {
    width,
    height: 180,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 10,
    borderRadius: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#f1f1f1",
  },
  indicators: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
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
