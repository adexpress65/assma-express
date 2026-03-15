// CategoryPage.tsx - VERSION CORRIGÉE AVEC VOS CHAMPS EXACTS
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Image,
  SafeAreaView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrency } from '../../src/contexts/CurrencyContext';

const getCategoryNameFromId = (categoryId: string): string => {
  const categoryMap: { [key: string]: string } = {
    'fKNpSZ7NgqyMw7uZW15w': 'Électroniques', // L'ID de votre exemple
    'autre_id': 'Autre Catégorie',
  };
  return categoryMap[categoryId] || 'Catégorie';
};

export default function CategoryPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // --- CORRECTION ICI ---
  // On vérifie tous les noms possibles pour être sûr de ne pas rater l'ID
  const categoryId = params.categoryId as string || params.id as string || 'all';
  const categoryName = params.categoryName as string || getCategoryNameFromId(categoryId);
  
  // On accepte 'targetProductId' (venant du Home) OU 'selectedProductId'
  const preselectedProductId = (params.targetProductId || params.selectedProductId) as string; 
  // -----------------------
  
  const { formatPrice } = useCurrency(); 

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(preselectedProductId || null);

  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 83 : 60;
  const BOTTOM_PADDING = insets.bottom + TAB_BAR_HEIGHT + 20;
  const BUTTON_HEIGHT = 56;
  
  
  // Chargement initial
// 1. Ajoute ces états en haut de ton composant s'ils n'y sont pas déjà
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const loadCategoryProducts = async () => {
      try {
        setLoading(true);
        setProducts([]); 
        setLastDoc(null); // Reset du curseur au changement de catégorie
        setHasMore(true);

        let directProduct = null;

        // 1. Charger le produit sélectionné si présent (Inchangé)
        if (preselectedProductId) {
          const ref = doc(db, 'products', preselectedProductId);
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data();
            const currentPrice = Number(data.price) || 0;
            directProduct = {
              id: snap.id,
              name: data.name || 'Produit',
              price: currentPrice,
              originalPrice: Number(data.originalPrice || currentPrice),
              image: data.mainImage || data.imageUrl || (data.images && data.images[0]) || 'https://via.placeholder.com/300',
              rating: Number(data.rating) || 0,
              supplier: data.supplier || data.companyName || 'Fournisseur',
              minOrder: data.minOrder || 1,
              inStock: data.inStock ?? true,
              categoryId: data.categoryId,
              categoryName: data.categoryName,
            };
            setSelectedProduct(directProduct);
            setSelectedProductId(directProduct.id);
          }
        }

        // 2. Charger les produits avec limite pour pagination
        console.log('📦 Chargement initial des produits...');
        const productsRef = collection(db, 'products');
        let q;
        
        if (categoryId === 'all' || categoryId === 'tous') {
          q = query(productsRef, orderBy('createdAt', 'desc'), limit(50));
        } else {
          q = query(
            productsRef, 
            where('categoryId', '==', categoryId),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc'), 
            limit(50)
          );
        }

        const snapshot = await getDocs(q);
        console.log(`✅ ${snapshot.size} produits trouvés`);

        // MISE À JOUR DU CURSEUR (LastDoc)
        if (snapshot.docs.length > 0) {
          setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
          setHasMore(snapshot.docs.length === 50); // Si on en a 50, il y en a peut-être d'autres
        } else {
          setHasMore(false);
        }

const productsData = [];
snapshot.forEach((docSnap) => {
  const data = docSnap.data();
  
  // Debug pour voir si les données arrivent
  console.log("Données reçues pour :", data.name);

  productsData.push({
    id: docSnap.id,
    // On utilise 'name' car il existe dans ton document
    name: data.name || "Produit sans nom",
    
    // Ton document a 'price' et 'originalPrice'
    price: data.price || 0,
    originalPrice: data.originalPrice || data.price || 0,
    
    // Ton document utilise 'mainImage' (prioritaire) ou 'imageUrl'
    image: data.mainImage || data.imageUrl || (data.images && data.images[0]) || 'https://via.placeholder.com/300',
    
    // Ton document a 'rating' (ici 0) et 'supplier' (USINE A2EXPRESS)
    rating: data.rating !== undefined ? Number(data.rating) : 0,
    supplier: data.supplier || data.companyName || "Fournisseur",
    
    // Ton document a 'minOrder' (ici 1)
    minOrder: data.minOrder || 1,
    
    // Autres champs utiles
    categoryId: data.categoryId,
    categoryName: data.categoryName,
    hasFreeShipping: data.hasFreeShipping || false,
  });
});

setProducts(productsData);

        setProducts(productsData);

        // 3. Sélection automatique (Inchangé)
        if (!directProduct && productsData.length > 0) {
          const found = preselectedProductId ? productsData.find(p => p.id === preselectedProductId) : null;
          const finalSelection = found || productsData[0];
          setSelectedProduct(finalSelection);
          setSelectedProductId(finalSelection.id);
        }
      } catch (e) {
        console.error('🔥 Erreur:', e);
      } finally {
        setLoading(false);
      }
    };

    loadCategoryProducts();
  }, [categoryId, preselectedProductId]);

  const handleViewProductDetail = () => {
    if (selectedProduct) {
      console.log('➡️ Navigation vers détail:', selectedProduct.id);
      router.push(`/product/${selectedProduct.id}`);
    }
  };

const handleSelectProduct = (product: any) => {
  console.log('🔄 Navigation vers le produit:', product.name);
  
  // On met à jour l'état local pour le retour en arrière
  setSelectedProduct(product);
  setSelectedProductId(product.id);

  // Navigation directe vers la fiche détaillée
  router.push(`/product/${product.id}`);
};

  // RENDU DE L'APERÇU
  const renderProductPreview = () => {
    if (!selectedProduct) return null;

    return (
      <View style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>Produit Sélectionné</Text>
          <TouchableOpacity style={styles.viewDetailButton} onPress={handleViewProductDetail}>
            <Text style={styles.viewDetailText}>Voir la fiche</Text>
            <Ionicons name="arrow-forward" size={16} color="#FF6A00" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.productPreview} onPress={handleViewProductDetail}>
          <View style={styles.previewImageContainer}>
            <Image 
              source={{ uri: selectedProduct.image }} 
              style={styles.previewImage} 
              resizeMode="cover"
              defaultSource={require('../../assets/icon.png')}
            />
          </View>

          <View style={styles.previewInfo}>
            <Text style={styles.previewName} numberOfLines={2}>{selectedProduct.name}</Text>
            
            <View style={styles.previewPriceRow}>
              {selectedProduct.originalPrice > selectedProduct.price && (
                <Text style={styles.originalPrice}>
                  {formatPrice(selectedProduct.originalPrice)}
                </Text>
              )}
              <Text style={styles.currentPrice}>
                {formatPrice(selectedProduct.price)}
              </Text>
            </View>

            <View style={styles.previewDetails}>
              <Text style={styles.detailText}>Min: {selectedProduct.minOrder} unités</Text>
              <Text style={styles.detailText}>⭐ {selectedProduct.rating.toFixed(1)} | {selectedProduct.supplier}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6A00" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
<View style={styles.titleContainer}>
  <Text style={styles.title}>{categoryName}</Text>
  <Text style={styles.productCount}>Découvrez nos sélections</Text>
</View>
      </View>

      <View style={styles.contentWrapper}>
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BUTTON_HEIGHT + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {renderProductPreview()}

          {products.length > 0 && (
            <View style={styles.productsSection}>
<View style={styles.sectionHeader}>
  <Text style={styles.sectionTitle}>Articles similaires</Text>
</View>

              <View style={styles.productsGrid}>
                {products
  .filter(p => p.id !== selectedProductId)
  .map((product) => (
    <TouchableOpacity 
      key={product.id}
      style={[
        styles.productCard, 
        selectedProductId === product.id && styles.productCardSelected
      ]}
      onPress={() => handleSelectProduct(product)}
      activeOpacity={0.8}
    >
      {/* Image du produit avec Badge Promo si prix réduit */}
      <View style={styles.imageWrapper}>
        <Image 
          source={{ uri: product.image }} 
          style={styles.productImage} 
          contentFit="cover"
        />
        {product.originalPrice > product.price && (
          <View style={styles.promoBadge}>
            <Text style={styles.promoText}>PROMO</Text>
          </View>
        )}
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        
        <View style={styles.productPriceRow}>
          <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>
          {product.originalPrice > product.price && (
            <Text style={styles.oldPriceSmall}>{formatPrice(product.originalPrice)}</Text>
          )}
        </View>

        {/* Badges Dynamiques (Livraison / B2B) */}
        <View style={styles.productMeta}>
          {product.hasFreeShipping && (
            <View style={styles.miniBadge}>
              <Ionicons name="airplane" size={8} color="#00B050" />
              <Text style={[styles.miniBadgeText, { color: '#00B050' }]}>Gratuit</Text>
            </View>
          )}
          <Text style={styles.productMetaText}>Min: {product.minOrder}</Text>
          <Text style={styles.productMetaText}>⭐ {product.rating || '5.0'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  ))}
              </View>
            </View>
          )}
        </ScrollView>

        {selectedProduct && (
          <View style={[styles.floatingAction, { bottom: BOTTOM_PADDING, left: 16, right: 16 }]}>
            <TouchableOpacity style={styles.actionButton} onPress={handleViewProductDetail}>
              <View style={styles.actionButtonContent}>
                <Ionicons name="document-text" size={20} color="#fff" />
                <Text style={styles.actionButtonText} numberOfLines={1}>
                  Voir la fiche de {selectedProduct.name}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    backgroundColor: '#fff', 
    paddingBottom: 16, 
    paddingHorizontal: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eaeaea', 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  backButton: { marginRight: 12 },
  titleContainer: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  productCount: { fontSize: 13, color: '#666' },
  contentWrapper: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  previewContainer: { 
    backgroundColor: '#fff', 
    margin: 16, 
    borderRadius: 12, 
    padding: 16, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 8 
  },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  previewTitle: { fontSize: 16, fontWeight: '700' },
  viewDetailButton: { flexDirection: 'row', alignItems: 'center' },
  viewDetailText: { color: '#FF6A00', fontSize: 12, marginRight: 4, fontWeight: '600' },
  productPreview: { flexDirection: 'row' },
  previewImageContainer: { width: 80, height: 80, borderRadius: 8, marginRight: 12, backgroundColor: '#f0f0f0' },
  previewImage: { width: '100%', height: '100%', borderRadius: 8 },
  previewInfo: { flex: 1, justifyContent: 'center' },
  previewName: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  previewPriceRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  originalPrice: { fontSize: 12, color: '#999', textDecorationLine: 'line-through', marginRight: 8 },
  currentPrice: { fontSize: 18, fontWeight: '800', color: '#FF6A00' },
  previewDetails: { marginTop: 4 },
  detailText: { fontSize: 11, color: '#666' },
  productsSection: { backgroundColor: '#fff', paddingTop: 20, marginTop: 8 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  productCard: { 
    width: '47%', 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    margin: '1.5%', 
    padding: 8, 
    elevation: 2, 
    borderWidth: 1, 
    borderColor: '#f0f0f0' 
  },
  productCardSelected: { borderColor: '#FF6A00', backgroundColor: '#FFF9F5' },
  productImage: { width: '100%', height: 120, borderRadius: 8, marginBottom: 8, backgroundColor: '#f5f5f5' },
  productInfo: { flex: 1 },
  productName: { fontSize: 12, fontWeight: '600', marginBottom: 4, height: 32 },
  productPriceRow: { marginBottom: 4 },
  productPrice: { fontSize: 14, fontWeight: '800', color: '#FF6A00' },
  productMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  productMetaText: { fontSize: 10, color: '#666' },
  selectedBadge: { position: 'absolute', top: 5, right: 5, backgroundColor: '#FF6A00', borderRadius: 12, padding: 2 },
  floatingAction: { position: 'absolute', zIndex: 100 },
  actionButton: { backgroundColor: '#FF6A00', borderRadius: 12, height: 56, justifyContent: 'center', elevation: 4 },
  actionButtonContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  actionButtonText: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center' },
});
