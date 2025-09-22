// apps/mobile/app/(tabs)/shop.tsx
import { View, Text, StyleSheet } from "react-native";

export default function ShopScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Boutique</Text>
      <Text>Liste des produits à afficher ici</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "bold" },
});
