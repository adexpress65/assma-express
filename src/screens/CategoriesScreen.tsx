import React, { useEffect, useState, useMemo, memo, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, Dimensions, TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { getCategories, Category } from "../services/firebase/categoriesService";
import { getProductsByCategory, Product, getAllProducts } from "../services/firebase/productsService";
import { getAllCompanies, Company } from "../services/firebase/companyService";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const SIDEBAR_WIDTH = 100;

// ============= 1. LOGIQUE DE RÉPARATION ET FUSION =============

/**
 * Répare les erreurs d'encodage (Ã© -> é) et supprime les bruits
 */
const fixEncoding = (str: string): string => {
  if (!str) return "";
  try {
    // Tente de réparer l'encodage ISO-8859-1 vers UTF-8
    return decodeURIComponent(escape(str)).replace(/\?/g, "");
  } catch (e) {
    // Si déjà en UTF-8, on nettoie juste les "?"
    return str.replace(/\?/g, "");
  }
};

const normalizeCategoryName = (name: string): string => {
  // On répare d'abord l'encodage
  const cleanName = fixEncoding(name).trim();
  
  // Normalisation pour comparaison (sans accents)
  const n = cleanName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  
  // Fusion Électronique
  if (n.includes("electronique")) return "Électronique";
  // Fusion Maison et Jardin
  if (n.includes("maison") || n.includes("jardin")) return "Maison & Jardin";
  
  return cleanName;
};

const cleanCategories = (cats: Category[]): Category[] => {
  const map = new Map<string, Category>();
  cats.forEach(cat => {
    const normalized = normalizeCategoryName(cat.name);
    if (map.has(normalized)) {
      const existing = map.get(normalized)!;
      existing.productCount = (existing.productCount || 0) + (cat.productCount || 0);
    } else {
      map.set(normalized, { ...cat, name: normalized });
    }
  });
  return Array.from(map.values());
};

// ============= 2. COMPOSANTS UI MÉMOÏSÉS =============

const ProductCard = memo(({ product, onPress }: { product: Product, onPress: () => void }) => (
  <TouchableOpacity style={styles.inspiCard} onPress={onPress}>
    <View style={styles.inspiImageWrapper}>
      <Image 
        source={{ uri: product.mainImage || product.imageUrl || "https://via.placeholder.com/150" }} 
        style={styles.inspiImage} 
      />
      <View style={styles.scanBadge}><Ionicons name="scan-outline" size={12} color="#666" /></View>
    </View>
    <View style={styles.inspiContent}>
      <Text style={styles.inspiPriceText}>{Math.round(Number(product.price)).toLocaleString()} FCFA</Text>
      <Text style={styles.inspiMinQty} numberOfLines={1}>{product.name}</Text>
    </View>
  </TouchableOpacity>
));

// ============= 3. ÉCRAN PRINCIPAL =============
export default function CategoriesScreen() {
  const router = useRouter();
  
  // États
  const [categories, setCategories] = useState<Category[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]); 
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]); 
  const [menuIndex, setMenuIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Chargement Initial
  const initData = async () => {
    try {
      const [allCats, allProds] = await Promise.all([getCategories(), getAllProducts()]);
      
      // Nettoyage et fusion
      const cleaned = cleanCategories(allCats);
      setCategories(cleaned);

      // Produits récents (les 9 derniers ajoutés à la base)
      const sorted = allProds.slice().sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA;
      }).slice(0, 9);
      
      setRecentProducts(sorted);

      // Initialiser la liste de droite avec la première catégorie
      if (cleaned.length > 0) loadCategoryData(cleaned[0].id);
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

  const loadCategoryData = async (catId: string) => {
    setLoading(true);
    try {
      const data = await getProductsByCategory(catId);
      setDisplayedProducts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
      <Text style={styles.rightSectionTitle}>Nouveautés à la une</Text>
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
      {/* HEADER DE RECHERCHE */}
      <View style={styles.topHeader}>
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
                  loadCategoryData(item.id); 
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
            ListFooterComponent={loading ? <ActivityIndicator color="#ff6a00" style={{ margin: 20 }} /> : <View style={{ height: 50 }} />}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
            removeClippedSubviews={true} // Améliore la performance au scroll
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  topHeader: { height: 60, paddingHorizontal: 15, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: "#f4f4f4" },
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
