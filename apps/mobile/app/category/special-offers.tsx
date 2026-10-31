// apps/mobile/app/category/special-offers.tsx
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  StatusBar 
} from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { getLocalizedProductText } from "../../src/utils/productLocale";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../../src/config/firebase"; // Ã°Å¸â€Â¥ Correction: "../../src" au lieu de "../../../src"

export default function SpecialOffersCategory() {
  const { i18n } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecialOffers();
  }, []);

  const fetchSpecialOffers = async () => {
    try {
      // RÃƒÂ©cupÃƒÂ©rer les produits en promotion ou avec discount
      const productsQuery = query(
        collection(db, "products"), 
        where("discount", ">", 0), // Produits avec discount
        limit(20)
      );
      const productsSnap = await getDocs(productsQuery);
      const specialOffersProducts = productsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Si pas de produits avec discount, prendre les premiers produits
      if (specialOffersProducts.length === 0) {
        const allProductsQuery = query(collection(db, "products"), limit(20));
        const allProductsSnap = await getDocs(allProductsQuery);
        const allProducts = allProductsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(allProducts);
      } else {
        setProducts(specialOffersProducts);
      }
    } catch (error) {
      console.error("Error fetching special offers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductPress = (productId: string) => {
    router.push(`/product/${productId}`);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#ff6a00" barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>Ã¢â€ Â Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Meilleures Offres</Text>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.productsContainer}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.productCard}
            onPress={() => handleProductPress(item.id)}
          >
            {item.discount > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{item.discount}%</Text>
              </View>
            )}
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.productImage}
            />
            <Text numberOfLines={2} style={styles.productName}>
              {getLocalizedProductText(
                item.name,
                "name",
                item as unknown as Record<string, unknown>,
                i18n.language,
              )}
            </Text>
            <Text style={styles.productPrice}>{item.price} Fcfa</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucune offre spÃƒÂ©ciale disponible</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#f8f8f8",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: { color: "#ff6a00", fontSize: 16 },
  title: { fontSize: 18, fontWeight: "bold", textAlign: "center" },
  productsContainer: { padding: 10 },
  productCard: {
    width: "31%",
    backgroundColor: "#fff",
    margin: "1%",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#eee",
    position: "relative",
  },
  discountBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#ff4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  discountText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  productImage: { width: "100%", height: 100, borderRadius: 6 },
  productName: { fontSize: 12, color: "#333", marginTop: 6, textAlign: "center" },
  productPrice: { fontSize: 13, fontWeight: "bold", color: "#ff6a00", marginTop: 4, textAlign: "center" },
  emptyContainer: { padding: 40, alignItems: "center" },
  emptyText: { color: "#666", fontSize: 16 },
});
