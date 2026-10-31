// apps/mobile/src/screens/HomeScreen.tsx — accueil léger (navigation classique) : liste virtualisée + images cachées.
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
  ListRenderItem,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const PAGE_SIZE = 10;
const PLACEHOLDER_BASE =
  "https://via.placeholder.com/400x300/e8e8e8/888888?text=";

type MockProduct = {
  id: string;
  title: string;
  priceXof: number;
  originalXof: number;
  sold: number;
  uri: string;
};

/** Données factices pour démonstration pagination / perf (hors Firestore). */
const MOCK_POOL: MockProduct[] = Array.from({ length: 55 }).map((_, i) => ({
  id: `demo-${i}`,
  title: `Article ${i + 1}`,
  priceXof: 150_000 + (i % 7) * 12_500,
  originalXof: 200_000 + (i % 5) * 15_000,
  sold: 100 + ((i * 17) % 900),
  uri: `${PLACEHOLDER_BASE}${encodeURIComponent(`P${i + 1}`)}`,
}));

const CATEGORIES = [
  { key: "mode", label: "Mode", icon: "shirt-outline" as const },
  { key: "tel", label: "Téléphone", icon: "phone-portrait-outline" as const },
  { key: "elec", label: "Électronique", icon: "laptop-outline" as const },
  { key: "maison", label: "Maison", icon: "home-outline" as const },
  { key: "auto", label: "Auto", icon: "car-sport-outline" as const },
  { key: "jeux", label: "Jeux", icon: "game-controller-outline" as const },
];

function formatXof(n: number) {
  return `XOF ${n.toLocaleString("fr-FR")}`;
}

const HomeScreen = () => {
  const [items, setItems] = useState<MockProduct[]>(() =>
    MOCK_POOL.slice(0, PAGE_SIZE)
  );
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasMore = items.length < MOCK_POOL.length;

  const loadPage = useCallback((nextPage: number, reset: boolean) => {
    const start = reset ? 0 : (nextPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const slice = MOCK_POOL.slice(start, end);
    if (reset) {
      setItems(slice);
      setPage(1);
    } else {
      setItems((prev) => [...prev, ...slice]);
      setPage(nextPage);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      loadPage(1, true);
      setRefreshing(false);
    }, 600);
  }, [loadPage]);

  const onEndReached = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setTimeout(() => {
      loadPage(page + 1, false);
      setLoadingMore(false);
    }, 450);
  }, [hasMore, loadPage, loadingMore, page]);

  const renderProduct: ListRenderItem<MockProduct> = useCallback(({ item }) => {
    const discount =
      item.originalXof > item.priceXof
        ? Math.round(
            ((item.originalXof - item.priceXof) / item.originalXof) * 100
          )
        : 0;
    return (
      <TouchableOpacity style={styles.productCard} activeOpacity={0.92}>
        <Image
          source={{ uri: item.uri }}
          style={styles.productImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={100}
        />
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.priceContainer}>
            <Text style={styles.productPrice}>{formatXof(item.priceXof)}</Text>
            {discount > 0 ? (
              <Text style={styles.originalPrice}>
                {formatXof(item.originalXof)}
              </Text>
            ) : null}
            {discount > 0 ? (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{discount}%</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.soldCount}>+{item.sold} vendus</Text>
        </View>
      </TouchableOpacity>
    );
  }, []);

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MaBoutique</Text>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#777" />
            <Text style={styles.searchPlaceholder}>Rechercher un produit…</Text>
          </View>
        </View>

        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={(c) => c.key}
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesStrip}
          contentContainerStyle={styles.categoriesContent}
          nestedScrollEnabled
          renderItem={({ item }) => (
            <View style={styles.category}>
              <View style={styles.categoryIcon}>
                <Ionicons name={item.icon} size={24} color="#555" />
              </View>
              <Text style={styles.categoryText}>{item.label}</Text>
            </View>
          )}
        />

        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Jusqu’à -60%</Text>
          <Text style={styles.bannerText}>
            Valable sur les articles sélectionnés
          </Text>
        </View>
      </>
    ),
    []
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={listHeader}
        columnWrapperStyle={styles.productRow}
        contentContainerStyle={styles.listContent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={7}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={styles.footerLoader} color="#ff3f34" />
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  listContent: {
    paddingBottom: 24,
  },
  header: {
    backgroundColor: "#ff3f34",
    padding: 15,
  },
  headerTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 4,
    padding: 10,
  },
  searchPlaceholder: {
    marginLeft: 10,
    color: "#777",
    fontSize: 16,
  },
  categoriesStrip: {
    maxHeight: 110,
    backgroundColor: "white",
  },
  categoriesContent: {
    paddingVertical: 15,
    paddingHorizontal: 10,
  },
  category: {
    alignItems: "center",
    marginHorizontal: 10,
    width: 60,
  },
  categoryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  categoryText: {
    fontSize: 12,
    color: "#555",
    textAlign: "center",
  },
  banner: {
    backgroundColor: "#ff3f34",
    padding: 20,
    marginVertical: 10,
    marginHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  bannerTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  bannerText: {
    color: "white",
    fontSize: 14,
    textAlign: "center",
  },
  productRow: {
    justifyContent: "space-between",
    paddingHorizontal: 10,
    gap: 10,
    marginBottom: 12,
  },
  productCard: {
    width: width / 2 - 15,
    backgroundColor: "white",
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  productImage: {
    width: "100%",
    height: 150,
    backgroundColor: "#eee",
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#222",
    marginBottom: 6,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 5,
    gap: 6,
  },
  productPrice: {
    color: "#ff3f34",
    fontWeight: "bold",
    fontSize: 14,
  },
  originalPrice: {
    textDecorationLine: "line-through",
    color: "#999",
    fontSize: 12,
  },
  discountBadge: {
    backgroundColor: "#ff3f34",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  discountText: {
    color: "white",
    fontSize: 12,
  },
  soldCount: {
    fontSize: 12,
    color: "#777",
    marginTop: 3,
  },
  footerLoader: {
    paddingVertical: 16,
  },
});

export default HomeScreen;
