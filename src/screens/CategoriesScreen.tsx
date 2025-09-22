 import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";

const categories = [
  {
    title: "Électronique",
    items: ["Smartphones et accessoires", "Ordinateurs", "Équipements audio et vidéo", "Appareils électroménagers"],
  },
  {
    title: "Mode",
    items: ["Vêtements", "Chaussures", "Accessoires de mode"],
  },
  {
    title: "Maison et jardin",
    items: ["Meubles", "Décoration intérieure", "Outils de jardinage"],
  },
  {
    title: "Beauté et santé",
    items: ["Produits cosmétiques", "Compléments alimentaires", "Équipements de fitness"],
  },
  {
    title: "Jouets et loisirs",
    items: ["Jouets pour enfants", "Matériel de camping", "Articles de sport"],
  },
  {
    title: "Matériaux de construction",
    items: ["Matériaux de construction", "Équipements de sécurité", "Outils"],
  },
  {
    title: "Automobile et motos",
    items: ["Pièces de rechange", "Accessoires automobiles", "Vêtements de moto"],
  },
  {
    title: "Produits industriels",
    items: ["Machines et équipements", "Fournitures industrielles", "Produits chimiques"],
  },
  {
    title: "Équipements de bureau",
    items: ["Fournitures de bureau", "Mobilier de bureau", "Équipements informatiques"],
  },
  {
    title: "Articles de fête et saisonniers",
    items: ["Décorations pour événements", "Costumes", "Accessoires saisonniers"],
  },
  {
    title: "Produits pour animaux",
    items: ["Nourriture pour animaux", "Accessoires pour animaux de compagnie", "Jouets pour animaux"],
  },
  {
    title: "Sécurité et protection",
    items: ["Équipements de protection individuelle", "Systèmes de surveillance", "Alarmes et sécurité"],
  },
];

export default function CategoriesScreen() {
  return (
    <ScrollView style={styles.container}>
      {categories.map((cat, index) => (
        <View key={index} style={styles.block}>
          <Text style={styles.title}>{cat.title}</Text>
          {cat.items.map((item, idx) => (
            <Text key={idx} style={styles.item}> {item}</Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 15 },
  block: { marginBottom: 20, padding: 12, backgroundColor: "#f9f9f9", borderRadius: 8 },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 8, color: "#007bff" },
  item: { fontSize: 15, marginLeft: 10, marginBottom: 4, color: "#333" },
});

