import React, { useEffect, useState, useMemo, memo, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Dimensions, TextInput,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getCategories, Category } from "../services/firebase/categoriesService";
import {
  getProductsByCategoryPaginated,
  getLatestProducts,
  Product,
} from "../services/firebase/productsService";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const SIDEBAR_WIDTH = 100;
const CATEGORY_PAGE_SIZE = 20;

// ============= 1. LOGIQUE DE R?PARATION ET FUSION =============

/**
 * R?pare les erreurs d'encodage (? -> ?) et supprime les bruits
 */
const fixEncoding = (str: string): string => {
  if (!str) return "";
  try {
    // Tente de r?parer l'encodage ISO-8859-1 vers UTF-8
    return decodeURIComponent(escape(str)).replace(/\?/g, "");
  } catch (e) {
    // Si d?j? en UTF-8, on nettoie juste les "?"
    return str.replace(/\?/g, "");
  }
};

/**
 * Cle de dedoublonnage (minuscules, sans accents).
 * Pas de regroupement par mots-cles (electronique / maison / jardin).
 */
const categoryDedupKey = (name: string): string => {
  const clean = fixEncoding(name).trim();
  if (!clean) return "";
  return clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

/** Evite les doublons Firestore avec le meme id. */
const dedupeById = (cats: Category[]): Category[] => {
  const byId = new Map<string, Category>();
  cats.forEach((cat) => {
    if (!cat?.id) return;
    if (!byId.has(cat.id)) byId.set(cat.id, cat);
  });
  return Array.from(byId.values());
};

const cleanCategories = (cats: Category[]): Category[] => {
  const map = new Map<string, Category>();
  cats.forEach((cat) => {
    const displayName = fixEncoding(cat.name || "").trim();
    const key = categoryDedupKey(cat.name || "");
    if (!key) return;
    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.productCount = (existing.productCount || 0) + (cat.productCount || 0);
    } else {
      map.set(key, { ...cat, name: displayName });
    }
  });
  return Array.from(map.values());
};

/** Filtre noms vides / bruit uniquement (pas productCount). */
const filterUsableCategories = (cats: Category[]): Category[] => {
  return cats
    .filter((c) => {
      const n = (c.name || "").trim();
      if (n.length < 2) return false;
      if (n === "?" || /^[\s?.]+$/.test(n)) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
};

// ============= 2. COMPOSANTS UI M?MO?S?S =============

const ProductCard = memo(({ product, onPress }: { product: Product, onPress: () => void }) => (
  <TouchableOpacity style={styles.inspiCard} onPress={onPress}>
    <View style={styles.inspiImageWrapper}>
      <Image 
        source={{ uri: product.mainImage || product.imageUrl || "https://via.placeholder.com/150" }} 
        style={styles.inspiImage}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
      />
      <View style={styles.scanBadge}><Ionicons name="scan-outline" size={12} color="#666" /></View>
    </View>
    <View style={styles.inspiContent}>
      <Text style={styles.inspiPriceText}>{Math.round(Number(product.price)).toLocaleString()} FCFA</Text>
      <Text style={styles.inspiMinQty} numberOfLines={1}>{product.name}</Text>
    </View>
  </TouchableOpacity>
));

// ============= 3. ?CRAN PRINCIPAL =============
export default function CategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // ?tats
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]); 
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]); 
  const [menuIndex, setMenuIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [categoryLastDoc, setCategoryLastDoc] = useState<any>(null);
  const [categoryHasMore, setCategoryHasMore] = useState(true);

  // Chargement Initial
  const initData = async () => {
    try {
      const [allCats, latest] = await Promise.all([
        getCategories(),
        getLatestProducts(9),
      ]);
      
      // Dedup par id, fusion si meme nom normalise, filtre noms vides / bruit
      const cleaned = filterUsableCategories(
        cleanCategories(dedupeById(allCats))
      );
      setCategories(cleaned);

      setRecentProducts(latest);

      // Initialiser la liste de droite avec la cat?gorie la plus demand?e
      if (cleaned.length > 0) {
        const prefExactKey = categoryDedupKey("Automobile et Moto");
        const autoKey = categoryDedupKey("Automobile");
        const motoKey = categoryDedupKey("Moto");

        // Priorité utilisateur: Automobile et Moto (ou contient automobile/moto)
        const preferredCategory =
          cleaned.find((c) => categoryDedupKey(c.name) === prefExactKey) ||
          cleaned.find((c) => {
            const k = categoryDedupKey(c.name);
            return k.includes(autoKey) && k.includes(motoKey);
          }) ||
          cleaned
            .filter((c) => {
              const k = categoryDedupKey(c.name);
              return k.includes(autoKey) || k.includes(motoKey);
            })
            .reduce((best, cat) => {
              const bestScore = best.productCount || 0;
              const catScore = cat.productCount || 0;
              return catScore > bestScore ? cat : best;
            }, cleaned[0]);

        const bestByDemand = cleaned.reduce((best, cat) => {
          const bestScore = best.productCount || 0;
          const catScore = cat.productCount || 0;
          return catScore > bestScore ? cat : best;
        }, cleaned[0]);

        const chosen = preferredCategory || bestByDemand;
        const chosenIndex = cleaned.findIndex((c) => c.id === chosen.id);
        setActiveCategoryId(chosen.id);
        setMenuIndex(chosenIndex >= 0 ? chosenIndex : 0);
        void loadCategoryData(chosen.id, true);
      }
    } catch (e) { 
        console.error("Erreur lors du chargement :", e); 
    } finally { 
        setLoading(false); 
        setRefreshing(false);
    }
  };

  useEffect(() => {
    initData();
  }, []);

  useEffect(() => {
    const imageUris = [
      ...recentProducts.map((item) => item.mainImage || item.imageUrl),
      ...displayedProducts.slice(0, 24).map((item) => item.mainImage || item.imageUrl),
    ]
      .filter(Boolean)
      .map((item) => String(item));

    if (!imageUris.length) {
      return;
    }

    Image.prefetch(imageUris, "memory-disk").catch(() => {});
  }, [displayedProducts, recentProducts]);

  const loadCategoryData = async (catId: string, reset: boolean) => {
    if (reset) {
      setCategoryLastDoc(null);
      setCategoryHasMore(true);
      setDisplayedProducts([]);
    }

    if (!reset && !categoryHasMore) return;
    if (!reset && loadingMoreProducts) return;
    if (reset) setProductsLoading(true);
    else setLoadingMoreProducts(true);

    try {
      const resp = await getProductsByCategoryPaginated(
        catId,
        CATEGORY_PAGE_SIZE,
        reset ? undefined : categoryLastDoc
      );

      setDisplayedProducts((prev) =>
        reset ? resp.products : [...prev, ...resp.products]
      );
      setCategoryLastDoc(resp.lastDoc);
      setCategoryHasMore(resp.hasMore);
    } catch (e) {
      console.error(e);
    } finally {
      setProductsLoading(false);
      setLoadingMoreProducts(false);
    }
  };

  const loadMoreForActiveCategory = () => {
    if (!activeCategoryId) return;
    if (productsLoading || loadingMoreProducts) return;
    void loadCategoryData(activeCategoryId, false);
  };

  // Filtrage local pour la recherche
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return displayedProducts;
    return displayedProducts.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [displayedProducts, searchQuery]);

  const renderHeader = () => (
    <View>
      <Text style={styles.rightSectionTitle}>Nouveautes a la une</Text>
      <View style={styles.circularGrid}>
        {recentProducts.map((p) => (
          <TouchableOpacity 
            key={p.id} 
            style={styles.circularContainer} 
            onPress={() => router.push(`/product/${p.id}`)}
          >
            <View style={styles.circleImageWrapper}>
              <Image 
                source={{ uri: p.mainImage || p.imageUrl }} 
                style={styles.circleImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={120}
              />
            </View>
            <Text style={styles.circleText} numberOfLines={1}>Nouveau</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.rightSectionTitle}>Laissez-vous inspirer</Text>
    </View>
  );

  if (loading && categories.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#ff6a00" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.mainWrapper}>
      {/* HEADER DE RECHERCHE � sous la barre d��tat (heure, r�seau, batterie) */}
      <View
        style={[
          styles.topHeader,
          { paddingTop: insets.top + 8, paddingBottom: 10 },
        ]}
      >
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#999" />
          <TextInput 
            style={styles.searchInput} 
            placeholder="Rechercher des articles..." 
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
        </View>
      </View>

      <View style={styles.splitLayout}>
        {/* SIDEBAR GAUCHE (CATEGORIES) */}
        <View style={styles.leftColumn}>
          <FlatList
            data={categories}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <TouchableOpacity 
                style={[styles.sidebarItem, menuIndex === index && styles.sidebarItemActive]}
                onPress={() => { 
                  setMenuIndex(index); 
                  setActiveCategoryId(item.id);
                  void loadCategoryData(item.id, true); 
                }}
              >
                {menuIndex === index && <View style={styles.activeIndicator} />}
                <Text style={[styles.sidebarText, menuIndex === index && styles.sidebarTextActive]}>
                    {item.name}
                </Text>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* CONTENU DROIT (GRILLE PRODUITS) */}
        <View style={styles.rightColumn}>
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            numColumns={2}
            ListHeaderComponent={renderHeader}
            renderItem={({ item }) => (
              <ProductCard product={item} onPress={() => router.push(`/product/${item.id}`)} />
            )}
            onRefresh={initData}
            refreshing={refreshing}
            ListEmptyComponent={
              (productsLoading || loadingMoreProducts) ? (
                <View style={{ padding: 20, alignItems: "center" }}>
                  <ActivityIndicator color="#ff6a00" />
                </View>
              ) : null
            }
            ListFooterComponent={
              loadingMoreProducts ? (
                <ActivityIndicator color="#ff6a00" style={{ margin: 20 }} />
              ) : (
                <View style={{ height: 40 }} />
              )
            }
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            removeClippedSubviews={true}
            onEndReachedThreshold={0.4}
            onEndReached={loadMoreForActiveCategory}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={8}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  topHeader: {
    paddingHorizontal: 15,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f4",
    backgroundColor: "#fff",
  },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#f2f2f2", borderRadius: 20, paddingHorizontal: 15, height: 38 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#333" },
  splitLayout: { flex: 1, flexDirection: "row" },
  
  // Sidebar Styles
  leftColumn: { width: SIDEBAR_WIDTH, backgroundColor: "#f8f8f8" },
  sidebarItem: { height: 65, justifyContent: "center", alignItems: "center", padding: 5, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  sidebarItemActive: { backgroundColor: "#fff" },
  activeIndicator: { position: "absolute", left: 0, height: 25, width: 4, backgroundColor: "#ff6a00", borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  sidebarText: { fontSize: 11, color: "#666", textAlign: "center" },
  sidebarTextActive: { color: "#000", fontWeight: "bold" },
  
  // Right Column Styles
  rightColumn: { flex: 1, paddingHorizontal: 10 },
  rightSectionTitle: { fontSize: 14, fontWeight: "bold", marginVertical: 15, color: "#222" },
  circularGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  circularContainer: { width: "33.33%", alignItems: "center", marginBottom: 15 },
  circleImageWrapper: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#f0f0f0", overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  circleImage: { width: "100%", height: "100%" },
  circleText: { fontSize: 10, color: "#999", marginTop: 6, fontWeight: "500" },
  
  // Product Card Styles
  inspiCard: { width: "48%", marginBottom: 15 },
  inspiImageWrapper: { width: "100%", aspectRatio: 1, borderRadius: 10, backgroundColor: "#f9f9f9", overflow: "hidden" },
  inspiImage: { width: "100%", height: "100%" },
  scanBadge: { position: "absolute", bottom: 6, left: 6, backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 12, padding: 4 },
  inspiContent: { paddingVertical: 8 },
  inspiPriceText: { fontSize: 14, fontWeight: "bold", color: "#ff6a00" },
  inspiMinQty: { fontSize: 11, color: "#666", marginTop: 2 }
});
