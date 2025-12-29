import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { toImage } from "../config/api";

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id, name, price, image, description } = useLocalSearchParams<{
    id: string;
    name: string;
    price: string;
    image?: string;
    description?: string;
  }>();

  return (
    <View style={styles.container}>
      {/* 🔙 Bouton retour */}
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Retour</Text>
      </TouchableOpacity>

      {/* 🖼️ Image du produit */}
      <Image source={{ uri: toImage(image || "") }} style={styles.img} />

      {/* 🧾 Détails du produit */}
      <View style={styles.details}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.price}>{price} F CFA</Text>

        {description ? (
          <Text style={styles.desc}>{description}</Text>
        ) : (
          <Text style={styles.descMuted}>Aucune description disponible.</Text>
        )}

        {/* 🛒 Bouton d’action */}
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>🛍️ Ajouter au panier</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  backButton: {
    padding: 16,
    backgroundColor: "#f9f9f9",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backText: {
    fontSize: 16,
    color: "#ff6a00",
    fontWeight: "600",
  },
  img: {
    width: "100%",
    height: 280,
    resizeMode: "cover",
    backgroundColor: "#f2f2f2",
  },
  details: {
    flex: 1,
    padding: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    color: "#222",
  },
  price: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ff6a00",
    marginBottom: 12,
  },
  desc: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 24,
  },
  descMuted: {
    fontSize: 14,
    color: "#999",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#ff6a00",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
