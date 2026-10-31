// screens/CompanyProductsScreen.tsx - VERSION PROPRE ET CORRIGÉE
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getLocalizedProductText } from "../utils/productLocale";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import {
  getProductsByCompanyFirstPage,
  getProductsByCompanyPage,
  getProductById,
  type CompanyProductSource,
  type Product,
} from "../services/firebase/productsService";
import { getCompanyById, Company } from "../services/firebase/companyService";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from '../contexts/CartContext';
import { useRequireAuth } from '../contexts/AuthGuardContext';
import { isZeroDollarsProduct } from '../utils/zeroDollarsShop';
import {
  isZeroFcfaCatalogPrice,
  ZERO_FCFA_UNAVAILABLE_MESSAGE,
} from '../utils/warehouseFee';

const { width } = Dimensions.get("window");
const SHOP_PAGE_SIZE = 28;

// ✅ Type pour les paramètres de navigation
interface NavigationParams {
  id: string;
  name?: string;
  preselectedProductId?: string;
  productName?: string;
  productPrice?: string;
  productImage?: string;
  fromCategory?: string;
}

export default function CompanyProductsScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const productDisplayName = useCallback(
    (p: Product) =>
      getLocalizedProductText(
        p.name,
        "name",
        p as unknown as Record<string, unknown>,
        i18n.language,
      ),
    [i18n.language],
  );

  /**
   * ✅ PARAMÈTRES — SOURCE UNIQUE DE VÉRITÉ
   */
  const params = useLocalSearchParams<NavigationParams>();
  const companyId = params.id as string;
  const companyName = params.name ? decodeURIComponent(params.name) : "Boutique";
  const preselectedProductId = params.preselectedProductId;
  
  /**
   * 🧠 STATES PRINCIPAUX
   */
  const [company, setCompany] = useState<Company | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [productsLastDoc, setProductsLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [productsSource, setProductsSource] = useState<CompanyProductSource | null>(null);
  const loadMoreGuard = useRef(false);
  
  /**
   * 🧠 STATES FILTRES
   */
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  
  const categories = useMemo(
    () => [
      "all",
      ...new Set(
        products
          .map((p) => String(p.categoryName || "").trim())
          .filter(Boolean),
      ),
    ] as string[],
    [products],
  );

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (selectedCategory !== "all") {
      result = result.filter((p) => p.categoryName === selectedCategory);
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "price-asc":
          return (a.price || 0) - (b.price || 0);
        case "price-desc":
          return (b.price || 0) - (a.price || 0);
        case "name":
          return a.name.localeCompare(b.name);
        case "newest":
          return (
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
          );
        default:
          return 0;
      }
    });

    return result;
  }, [products, selectedCategory, sortBy, searchQuery]);
  
  /**
   * 🧠 STATES PANIER
   */
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [addToCartLoading, setAddToCartLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  
  /**
   * 🛒 CONTEXTE PANIER
   */
  const { addToCart: addToCartContext, cartItems } = useCart();
  const { requireAuth } = useRequireAuth();

  /**
   * 📦 FONCTION UNIQUE DE CHARGEMENT
   */
  const loadCompanyAndProducts = async () => {
    try {
      setLoadingProducts(true);
      loadMoreGuard.current = false;
      setProductsLastDoc(null);
      setProductsHasMore(false);
      setProductsSource(null);

      const [companyData, first] = await Promise.all([
        getCompanyById(companyId),
        getProductsByCompanyFirstPage(companyId, SHOP_PAGE_SIZE),
      ]);

      setCompany(companyData);

      let list = first.products;
      setProductsLastDoc(first.lastDoc);
      setProductsHasMore(first.hasMore);
      setProductsSource(first.source);

      if (preselectedProductId && !list.some((p) => p.id === preselectedProductId)) {
        const extra = await getProductById(preselectedProductId);
        if (
          extra &&
          (String(extra.companyId) === String(companyId) ||
            String(extra.sellerId) === String(companyId))
        ) {
          list = [extra, ...list.filter((p) => p.id !== extra.id)];
        }
      }

      setProducts(list);

      if (preselectedProductId && list.length > 0) {
        const productToSelect = list.find((p) => p.id === preselectedProductId);
        if (productToSelect) {
          setSelectedProduct(productToSelect);
          setModalVisible(true);
        }
      } else if (list.length > 0) {
        setSelectedProduct(list[0]);
      }
    } catch (error) {
      console.error("❌ Erreur chargement entreprise/produits:", error);
      Alert.alert("Erreur", "Impossible de charger les produits de la boutique");
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadMoreProducts = useCallback(async () => {
    if (!productsHasMore || !productsSource || loadingMoreProducts || loadMoreGuard.current) return;
    if (!productsLastDoc) {
      setProductsHasMore(false);
      return;
    }
    loadMoreGuard.current = true;
    setLoadingMoreProducts(true);
    try {
      const next = await getProductsByCompanyPage(
        companyId,
        SHOP_PAGE_SIZE,
        productsSource,
        productsLastDoc,
      );
      if (next.products.length === 0) {
        setProductsHasMore(false);
        return;
      }
      setProducts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...next.products.filter((p) => !ids.has(p.id))];
      });
      setProductsLastDoc(next.lastDoc);
      setProductsHasMore(next.hasMore);
    } catch (e) {
      console.warn("[CompanyProductsScreen] loadMore", e);
      setProductsHasMore(false);
    } finally {
      setLoadingMoreProducts(false);
      loadMoreGuard.current = false;
    }
  }, [
    companyId,
    productsHasMore,
    productsLastDoc,
    productsSource,
    loadingMoreProducts,
  ]);

  /**
   * 🚀 EFFECT PRINCIPAL
   */
  useEffect(() => {
    if (!companyId) {
      Alert.alert("Erreur", "Boutique non spécifiée");
      router.back();
      return;
    }
    loadCompanyAndProducts();
  }, [companyId]);

  /**
   * 🛒 FONCTION UNIQUE D'AJOUT AU PANIER
   */
  const handleAddToCart = async () => {
    if (!selectedProduct) return;
    if (!requireAuth({ reason: 'add_to_cart', onAuthorized: () => { void handleAddToCart(); } })) return;

    setAddToCartLoading(true);
    try {
      console.log('🛒 Ajout au panier:', selectedProduct.name);
      
      const rawPrice = selectedProduct.price || 0;
      const price = isZeroDollarsProduct({
        price: rawPrice,
        companyName: selectedProduct.companyName || companyName,
        supplier: selectedProduct.supplier,
        seller: companyName || undefined,
        name: selectedProduct.name,
      }) ? 0 : rawPrice;

      const originWarehouseId = selectedProduct.originWarehouseId ?? null;
      const originWarehouseLabel = selectedProduct.originWarehouseLabel ?? null;

      if (isZeroFcfaCatalogPrice(price) && !originWarehouseId) {
        Alert.alert("Indisponible", ZERO_FCFA_UNAVAILABLE_MESSAGE);
        return;
      }

      const cartProduct = {
        id: selectedProduct.id,
        name: selectedProduct.name,
        price,
        quantity: quantity,
        image: selectedProduct.imageUrl || '',
        seller: companyName || selectedProduct.companyName || 'Boutique',
        minOrder: 1,
        shipping: "Livraison standard",
        inStock: (selectedProduct.stockQuantity || 0) > 0,
        companyId: companyId,
        companyName: companyName,
        originWarehouseId,
        originWarehouseLabel,
      };

      await addToCartContext(cartProduct);
      
      Alert.alert(
        "✅ Ajouté au panier", 
        `${productDisplayName(selectedProduct)} (${quantity}x) a été ajouté`,
        [
          { text: "Continuer", style: "cancel" },
          { 
            text: "Voir panier", 
            onPress: () => {
              setModalVisible(false);
              router.push("/cart");
            }
          }
        ]
      );
      
    } catch (error) {
      console.error("❌ Erreur ajout panier:", error);
      const msg =
        error instanceof Error && error.message
          ? error.message
          : "Impossible d'ajouter au panier";
      Alert.alert("Erreur", msg);
    } finally {
      setAddToCartLoading(false);
    }
  };

  /**
   * ⚡ FONCTION ACHAT IMMÉDIAT
   */
  const handleBuyNow = async () => {
    if (!selectedProduct) return;
    if (!requireAuth({ reason: 'buy_now', onAuthorized: () => { void handleBuyNow(); } })) return;

    setAddToCartLoading(true);
    try {
      const rawPrice = selectedProduct.price || 0;
      const price = isZeroDollarsProduct({
        price: rawPrice,
        companyName: selectedProduct.companyName || companyName,
        supplier: selectedProduct.supplier,
        seller: companyName || undefined,
        name: selectedProduct.name,
      }) ? 0 : rawPrice;

      const originWarehouseId = selectedProduct.originWarehouseId ?? null;
      const originWarehouseLabel = selectedProduct.originWarehouseLabel ?? null;

      if (isZeroFcfaCatalogPrice(price) && !originWarehouseId) {
        Alert.alert("Indisponible", ZERO_FCFA_UNAVAILABLE_MESSAGE);
        return;
      }

      const cartProduct = {
        id: selectedProduct.id,
        name: selectedProduct.name,
        price,
        quantity: quantity,
        image: selectedProduct.imageUrl || '',
        seller: companyName || selectedProduct.companyName || 'Boutique',
        minOrder: 1,
        shipping: "Livraison standard",
        inStock: (selectedProduct.stockQuantity || 0) > 0,
        companyId: companyId,
        companyName: companyName,
        originWarehouseId,
        originWarehouseLabel,
      };

      await addToCartContext(cartProduct);
      
      setModalVisible(false);
      router.push("/cart");
      
    } catch (error) {
      console.error("Erreur achat immédiat:", error);
      const msg =
        error instanceof Error && error.message
          ? error.message
          : "Impossible de procéder à l'achat";
      Alert.alert("Erreur", msg);
    } finally {
      setAddToCartLoading(false);
    }
  };

  /**
   * 🧮 UTILITAIRES
   */
  const getCartItemCount = () => {
    return cartItems.reduce((total, item) => total + (item.quantity || 1), 0);
  };

  const openAddToCartModal = (product: Product) => {
    setSelectedProduct(product);
    setQuantity(1);
    setModalVisible(true);
  };

  const navigateToProductDetails = (product: Product) => {
    router.push(`/product/${product.id}`);
  };

  const selectProduct = (product: Product) => {
    setSelectedProduct(product);
  };

  /**
   * 🖥️ RENDU PRINCIPAL
   */
  const displayCompanyName = company?.name || companyName;

  return (
    <View style={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            🏪 {displayCompanyName}
          </Text>
          {company?.location && (
            <Text style={styles.companyLocation}>
              <Ionicons name="location-outline" size={12} color="#666" /> {company.location}
            </Text>
          )}
        </View>
        
        <TouchableOpacity onPress={() => router.push("/cart")} style={styles.cartButton}>
          <Ionicons name="cart-outline" size={24} color="#333" />
          {getCartItemCount() > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{getCartItemCount()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loadingProducts ? (
        <View style={styles.loadingProducts}>
          <ActivityIndicator size="large" color="#ff6a00" />
          <Text style={styles.loadingText}>Chargement des produits…</Text>
        </View>
      ) : (
        <>
      {/* Produit sélectionné */}
      {selectedProduct && (
        <TouchableOpacity 
          style={styles.selectedProductPreview}
          onPress={() => navigateToProductDetails(selectedProduct)}
          activeOpacity={0.9}
        >
          <View style={styles.previewContent}>
            <Image
              source={{ uri: selectedProduct.imageUrl || 'https://via.placeholder.com/80' }}
              style={styles.previewImage}
            />
            <View style={styles.previewInfo}>
              <Text style={styles.previewName} numberOfLines={2}>
                {productDisplayName(selectedProduct)}
              </Text>
              <Text style={styles.previewPrice}>
                {selectedProduct.price?.toLocaleString('fr-FR') || "0"} F CFA
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Filtres */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
      >
        {categories.map(category => (
          <TouchableOpacity
            key={category}
            style={[
              styles.filterButton,
              selectedCategory === category && styles.filterButtonActive
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text style={[
              styles.filterText,
              selectedCategory === category && styles.filterTextActive
            ]}>
              {category === "all" ? "Tous" : category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Liste des produits */}
      {filteredProducts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {searchQuery ? "Aucun résultat" : "Aucun produit disponible"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.productsRow}
          contentContainerStyle={styles.productsGrid}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          onEndReachedThreshold={0.35}
          onEndReached={() => {
            void loadMoreProducts();
          }}
          ListFooterComponent={
            loadingMoreProducts ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color="#ff6a00" />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.productCard}
              onPress={() => openAddToCartModal(item)}
              activeOpacity={0.9}
            >
              <Image
                source={{ uri: item.imageUrl || 'https://via.placeholder.com/150' }}
                style={styles.productImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={100}
              />
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {productDisplayName(item)}
                </Text>
                <Text style={styles.productPrice}>
                  {item.price?.toLocaleString('fr-FR') || "0"} F CFA
                </Text>
                <TouchableOpacity style={styles.addButton}>
                  <Ionicons name="cart-outline" size={16} color="#fff" />
                  <Text style={styles.addButtonText}>Ajouter</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

        </>
      )}

      {/* Modal panier */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedProduct && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Ajouter au panier</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#333" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalProductInfo}>
                  <Image
                    source={{ uri: selectedProduct.imageUrl || 'https://via.placeholder.com/80' }}
                    style={styles.modalProductImage}
                  />
                  <View style={styles.modalProductDetails}>
                    <Text style={styles.modalProductName}>{productDisplayName(selectedProduct)}</Text>
                    <Text style={styles.modalProductPrice}>
                      {selectedProduct.price?.toLocaleString('fr-FR')} F CFA
                    </Text>
                  </View>
                </View>

                <View style={styles.quantityContainer}>
                  <Text style={styles.quantityLabel}>Quantité :</Text>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      <Ionicons name="remove" size={20} color="#333" />
                    </TouchableOpacity>
                    
                    <TextInput
                      style={styles.quantityInput}
                      value={quantity.toString()}
                      keyboardType="numeric"
                      onChangeText={(text) => {
                        const num = parseInt(text) || 1;
                        setQuantity(Math.max(1, num));
                      }}
                    />
                    
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => setQuantity(quantity + 1)}
                    >
                      <Ionicons name="add" size={20} color="#333" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.buyNowButton]}
                    onPress={handleBuyNow}
                    disabled={addToCartLoading}
                  >
                    <Text style={styles.buyNowButtonText}>Acheter maintenant</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.addToCartModalButton]}
                    onPress={handleAddToCart}
                    disabled={addToCartLoading}
                  >
                    <Text style={styles.addToCartModalButtonText}>Ajouter au panier</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ✅ STYLES PROPREMENT ORGANISÉS
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingProducts: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
  },
  companyLocation: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  cartButton: {
    padding: 8,
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#ff6a00",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  selectedProductPreview: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 16,
    borderRadius: 12,
  },
  previewContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  previewPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ff6a00",
    marginTop: 4,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
  },
  filterButtonActive: {
    backgroundColor: "#ff6a00",
  },
  filterText: {
    fontSize: 14,
    color: "#666",
  },
  filterTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 16,
    color: "#666",
  },
  productsGrid: {
    padding: 12,
  },
  productsRow: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  productCard: {
    width: (width - 36) / 2,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
  },
  productImage: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ff6a00",
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: "#28a745",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  modalProductInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  modalProductImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  modalProductDetails: {
    flex: 1,
  },
  modalProductName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  modalProductPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ff6a00",
    marginTop: 4,
  },
  quantityContainer: {
    marginBottom: 20,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityInput: {
    width: 60,
    height: 40,
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  buyNowButton: {
    backgroundColor: "#ff6a00",
  },
  buyNowButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  addToCartModalButton: {
    backgroundColor: "#28a745",
  },
  addToCartModalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
