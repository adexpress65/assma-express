// CategoryPage.tsx - VERSION CORRIGÉE AVEC BOUTON ADAPTABLE
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Image,
  SafeAreaView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Fonction utilitaire pour les noms de catégories
const getCategoryNameFromId = (categoryId: string): string => {
  const categoryMap: { [key: string]: string } = {
    'machines_industrielles': 'Machines Industrielles',
    'electronique': 'Électronique',
    'vetements': 'Vêtements',
    'alimentation': 'Alimentation',
    'construction': 'Construction',
    'sante': 'Santé & Médical',
    'beaute': 'Beauté & Cosmétiques',
    'sports': 'Sports & Fitness',
    'maison': 'Maison & Décoration',
    'automobile': 'Automobile',
    'trending': 'Produits Tendances',
    'new-arrivals': 'Nouveautés',
    'special-offers': 'Offres Spéciales',
  };
  
  return categoryMap[categoryId] || categoryMap[categoryId?.toLowerCase()] || 'Catégorie Générale';
};

export default function CategoryPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const categoryId = params.id as string || 'all';
  const categoryName = params.name as string || getCategoryNameFromId(categoryId);
  const preselectedProductId = params.preselectedProductId as string;
  
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(preselectedProductId || null);

  // Calcul des dimensions adaptatives
  const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 83 : 60; // Hauteur approximative du tab bar
  const BOTTOM_PADDING = insets.bottom + TAB_BAR_HEIGHT + 20; // Espacement total en bas
  const BUTTON_HEIGHT = 56; // Hauteur du bouton
  const HEADER_HEIGHT = 110 + insets.top; // Hauteur du header avec safe area

  // Charger les produits de la catégorie
  useEffect(() => {
    const loadCategoryProducts = async () => {
      try {
        setLoading(true);
        console.log('📂 Chargement catégorie:', categoryId);
        console.log('🎯 Produit présélectionné:', preselectedProductId);

        const productsRef = collection(db, 'products');
        let q;
        
        if (categoryId === 'all' || categoryId === 'tous') {
          q = query(productsRef, orderBy('createdAt', 'desc'), limit(30));
        } else {
          q = query(productsRef, where('categoryId', '==', categoryId), limit(30));
        }

        const snapshot = await getDocs(q);
        const productsData: any[] = [];
        
        snapshot.forEach((doc) => {
          if (doc.exists()) {
            const data = doc.data();
            productsData.push({
              id: doc.id,
              name: data.name || 'Produit ASMA Express',
              price: data.price || 0,
              originalPrice: data.originalPrice || data.price,
              image: data.images?.[0] || data.imageUrl || 'https://via.placeholder.com/300x200/ff6a00/ffffff?text=ASMA',
              rating: data.rating || 4.5,
              supplier: data.supplier || data.companyName || 'ASMA Express',
              minOrder: data.minOrder || 1,
              categoryId: data.categoryId,
              categoryName: getCategoryNameFromId(data.categoryId),
              inStock: data.inStock !== undefined ? data.inStock : true,
              description: data.description || 'Description non disponible',
            });
          }
        });

        setProducts(productsData);
        
        // Priorité au produit présélectionné
        if (preselectedProductId && productsData.length > 0) {
          const preselected = productsData.find(p => p.id === preselectedProductId);
          if (preselected) {
            console.log('✅ Produit présélectionné trouvé:', preselected.name);
            setSelectedProduct(preselected);
            setSelectedProductId(preselectedProductId);
          } else if (productsData.length > 0) {
            // Sinon, sélectionner le premier produit
            console.log('⚠️ Produit présélectionné non trouvé, sélection du premier produit');
            setSelectedProduct(productsData[0]);
            setSelectedProductId(productsData[0].id);
          }
        } else if (productsData.length > 0) {
          // Sélectionner le premier produit par défaut
          console.log('🔍 Sélection premier produit par défaut');
          setSelectedProduct(productsData[0]);
          setSelectedProductId(productsData[0].id);
        }

      } catch (error) {
        console.error('❌ Erreur chargement catégorie:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCategoryProducts();
  }, [categoryId, preselectedProductId]);

  // Navigation vers les détails complets du produit
  const handleViewProductDetail = () => {
    if (!selectedProduct) {
      console.log('❌ Aucun produit sélectionné');
      return;
    }
    
    console.log('🔄 Navigation vers fiche produit:', selectedProduct.id, selectedProduct.name);
    
    // Navigation correcte vers la route qui existe
    router.push(`/product/${selectedProduct.id}`);
  };

  // Sélectionner un produit dans la liste ET naviguer
  const handleSelectProductAndView = (product: any) => {
    console.log('🎯 Sélection produit:', product.id, product.name);
    setSelectedProduct(product);
    setSelectedProductId(product.id);
    
    // Naviguer directement vers la page de détail
    router.push(`/product/${product.id}`);
  };

  // Sélectionner un produit dans la liste (sans naviguer immédiatement)
  const handleSelectProduct = (product: any) => {
    console.log('📌 Sélection produit (sans navigation):', product.id);
    setSelectedProduct(product);
    setSelectedProductId(product.id);
  };

  // Aperçu du produit sélectionné
  const renderProductPreview = () => {
    if (!selectedProduct) return null;

    return (
      <View style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>Produit Sélectionné</Text>
          <TouchableOpacity 
            style={styles.viewDetailButton}
            onPress={handleViewProductDetail}
          >
            <Text style={styles.viewDetailText}>Voir la fiche complète</Text>
            <Ionicons name="arrow-forward" size={16} color="#FF6A00" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.productPreview}
          onPress={handleViewProductDetail}
          activeOpacity={0.9}
        >
          <View style={styles.previewImageContainer}>
            <Image 
              source={{ uri: selectedProduct.image }} 
              style={styles.previewImage}
              resizeMode="cover"
            />
          </View>

          <View style={styles.previewInfo}>
            <Text style={styles.previewName} numberOfLines={2}>
              {selectedProduct.name}
            </Text>
            
            <View style={styles.previewPriceRow}>
              {selectedProduct.originalPrice > selectedProduct.price && (
                <Text style={styles.originalPrice}>
                  {selectedProduct.originalPrice.toLocaleString()} F CFA
                </Text>
              )}
              <Text style={styles.currentPrice}>
                {selectedProduct.price.toLocaleString()} F CFA
              </Text>
            </View>

            <View style={styles.previewDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="cube" size={14} color="#666" />
                <Text style={styles.detailText}>
                  Min: {selectedProduct.minOrder} unités
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="star" size={14} color="#FFB800" />
                <Text style={styles.detailText}>
                  {selectedProduct.rating.toFixed(1)} ⭐
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="business" size={14} color="#666" />
                <Text style={styles.detailText}>
                  {selectedProduct.supplier}
                </Text>
              </View>
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
        <Text style={styles.loadingText}>Chargement de la catégorie...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* En-tête */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{decodeURIComponent(categoryName)}</Text>
          <Text style={styles.productCount}>{products.length} produits</Text>
        </View>
      </View>

      <View style={styles.contentWrapper}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: BUTTON_HEIGHT + 40 } // Espace pour le bouton fixe
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Aperçu du produit sélectionné */}
          {selectedProduct && renderProductPreview()}

          {/* Liste des produits */}
          <View style={styles.productsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {selectedProduct ? 'Autres produits' : 'Produits dans cette catégorie'}
              </Text>
              <Text style={styles.sectionSubtitle}>
                Sélectionnez un produit pour voir son aperçu
              </Text>
            </View>

            {products.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="folder-open" size={64} color="#ccc" />
                <Text style={styles.emptyText}>Aucun produit dans cette catégorie</Text>
              </View>
            ) : (
              <View style={styles.productsGrid}>
                {products.map((product) => (
                  <TouchableOpacity 
                    key={product.id}
                    style={[
                      styles.productCard,
                      selectedProductId === product.id && styles.productCardSelected
                    ]}
                    onPress={() => handleSelectProductAndView(product)}
                    onLongPress={() => handleSelectProduct(product)}
                  >
                    <Image 
                      source={{ uri: product.image }} 
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                    
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {product.name}
                      </Text>
                      
                      <View style={styles.productPriceRow}>
                        <Text style={styles.productPrice}>
                          {product.price.toLocaleString()} F CFA
                        </Text>
                        {product.originalPrice > product.price && (
                          <Text style={styles.productOriginalPrice}>
                            {product.originalPrice.toLocaleString()} F CFA
                          </Text>
                        )}
                      </View>
                      
                      <View style={styles.productMeta}>
                        <View style={styles.productMetaItem}>
                          <Ionicons name="cube" size={12} color="#666" />
                          <Text style={styles.productMetaText}>Min: {product.minOrder}</Text>
                        </View>
                        <View style={styles.productMetaItem}>
                          <Ionicons name="star" size={12} color="#FFB800" />
                          <Text style={styles.productMetaText}>{product.rating.toFixed(1)}</Text>
                        </View>
                      </View>
                    </View>
                    
                    {selectedProductId === product.id && (
                      <View style={styles.selectedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#28A745" />
                        <Text style={styles.selectedText}>Sélectionné</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bouton d'action flottant FIXE et ADAPTATIF */}
        {selectedProduct && (
          <View style={[
            styles.floatingAction,
            { 
              bottom: BOTTOM_PADDING,
              left: 16,
              right: 16,
            }
          ]}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleViewProductDetail}
              activeOpacity={0.9}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons name="document-text" size={20} color="#fff" />
                <Text style={styles.actionButtonText} numberOfLines={1}>
                  Voir la fiche de {selectedProduct.name.substring(0, 20)}...
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
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eaeaea',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backButton: {
    marginRight: 12,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  productCount: {
    fontSize: 14,
    color: '#666',
  },
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Espace pour le bouton
  },
  previewContainer: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  viewDetailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 12,
  },
  viewDetailText: {
    color: '#FF6A00',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
  },
  productPreview: {
    flexDirection: 'row',
  },
  previewImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    marginRight: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  previewName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  previewPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  currentPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FF6A00',
  },
  previewDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
  },
  productsSection: {
    backgroundColor: '#fff',
    marginTop: 8,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  productCard: {
    width: '47%', // Utilisation de pourcentage pour plus d'adaptabilité
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: '1.5%', // Marge en pourcentage
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    position: 'relative',
  },
  productCardSelected: {
    borderWidth: 2,
    borderColor: '#FF6A00',
  },
  productImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 14,
    height: 28,
  },
  productPriceRow: {
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF6A00',
  },
  productOriginalPrice: {
    fontSize: 10,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  productMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  productMetaText: {
    fontSize: 10,
    color: '#666',
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 167, 69, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    zIndex: 10,
  },
  selectedText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 2,
  },
  floatingAction: {
    position: 'absolute',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  actionButton: {
    backgroundColor: '#FF6A00',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginHorizontal: 8,
    flex: 1,
    textAlign: 'center',
  },
});