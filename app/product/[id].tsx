// app/product/[id].tsx - VERSION COMPLÈTE CORRIGÉE
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  ActivityIndicator, 
  TouchableOpacity, 
  Image, 
  Dimensions, 
  Alert,
  StyleSheet,
  Linking 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';

// ✅ CORRECTION : UTILISER LES ALIAS CONFIGURÉS
import { db } from '@config/firebase';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';

// ✅ CORRECTION : UTILISER LES ALIAS POUR LES COMPOSANTS
import ProductGallery from '@components/ProductGallery';
import SellerCard from '@components/SellerCard';
import ProductSpecifications from '@components/ProductSpecifications';
import ReviewSummary from '@components/ReviewSummary';
import ShippingCalculator from '@components/ShippingCalculator';
import ProtectionBadges from '@components/ProtectionBadges';
import ActionFooter from '@components/ActionFooter';

// ✅ AJOUT : IMPORT DU COMPOSANT DEVIS
import WholesaleQuoteForm from '@components/WholesaleQuoteForm';

const { width } = Dimensions.get('window');

// 🎨 COULEURS THÈME PREMIUM
const COLORS = {
  primary: '#FF6A00',
  primaryLight: '#FFF0E6',
  primaryDark: '#E55A00',
  accent: '#FF4500',
  background: '#FFFAF5',
  success: '#28A745',
  text: '#2D3748',
  textLight: '#718096',
  border: '#E2E8F0',
  white: '#FFFFFF'
};

export default function ProductDetail() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const { user } = useAuth();
  
  // ✅ CORRECTION : Récupérer l'ID depuis les params
  const id = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any>(null);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [selectedOptions, setSelectedOptions] = useState({
    quantity: 2
  });
  const [error, setError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [quoteModalVisible, setQuoteModalVisible] = useState(false); // ✅ ÉTAT POUR LE MODAL

  // ✅ FONCTION DE DEBUG AMÉLIORÉE
  useEffect(() => {
    console.log('🔍 DEBUG ProductDetail:');
    console.log('📱 ID reçu:', id);
    console.log('📱 Type ID:', typeof id);
    console.log('📱 Tous les params:', params);
    console.log('🔥 Firebase db:', db ? '✅ Initialisé' : '❌ NULL');
    
    if (!id || id === 'undefined' || id === 'null') {
      console.log('❌ ID invalide ou manquant');
      setError('ID de produit invalide');
      setLoading(false);
      return;
    }
    
    if (!db) {
      console.log('❌ Firebase non initialisé');
      setError('Erreur de connexion à la base de données');
      setLoading(false);
      return;
    }
  }, [id]);

  // Fonction pour récupérer les produits similaires
  const fetchSimilarProducts = async (currentProduct: any) => {
    try {
      console.log('🔄 Recherche de produits similaires...');
      
      let similarQuery;
      const productsRef = collection(db, 'products');
      
      // Essayer d'abord par catégorie
      if (currentProduct.categoryId) {
        similarQuery = query(
          productsRef,
          where('categoryId', '==', currentProduct.categoryId),
          where('__name__', '!=', currentProduct.id),
          limit(8)
        );
      } else {
        // Fallback : récupérer les derniers produits
        similarQuery = query(
          productsRef,
          where('__name__', '!=', currentProduct.id),
          limit(6)
        );
      }
      
      const similarSnap = await getDocs(similarQuery);
      const similarData: any[] = [];
      
      similarSnap.forEach(doc => {
        if (doc.exists()) {
          const data = doc.data();
          similarData.push({
            id: doc.id,
            name: data.name,
            price: data.price,
            originalPrice: data.originalPrice || data.price,
            image: data.images?.[0] || data.imageUrl || 'https://via.placeholder.com/150x150/FF6A00/ffffff?text=Produit',
            rating: data.rating || 0,
            reviewCount: data.reviewCount || 0,
            minOrder: data.minOrder || 1,
            inStock: data.inStock !== undefined ? data.inStock : true
          });
        }
      });
      
      console.log(`✅ ${similarData.length} produits similaires trouvés`);
      setSimilarProducts(similarData);
      
    } catch (error) {
      console.error('❌ Erreur chargement produits similaires:', error);
      setSimilarProducts([]);
    }
  };

  // ✅ MODIFICATION : Fonction pour ajouter au panier ET rediriger
  const handleAddToCartAndRedirect = async () => {
    if (!product) {
      Alert.alert('Erreur', 'Produit non disponible');
      return;
    }
    
    // Vérifier si l'utilisateur est connecté
    if (!user) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour ajouter au panier');
      router.push('/login');
      return;
    }
    
    setAddingToCart(true);
    try {
      // Créer l'objet produit pour le panier
      const productToAdd = {
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice || product.price,
        imageUrl: product.images?.[0] || product.imageUrl || 'https://via.placeholder.com/150x150/FF6A00/ffffff?text=Produit',
        seller: product.seller?.name || 'Fournisseur',
        minOrder: product.minOrder || 2,
        shipping: product.shipping?.estimatedDelivery || '7-14 jours',
        inStock: product.inStock !== undefined ? product.inStock : true,
        quantity: selectedOptions.quantity
      };
      
      // Ajouter au panier via le contexte
      await addToCart(productToAdd);
      
      // ✅ Redirection immédiate vers la page panier
      router.push('/cart');
      
    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout au panier:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter le produit au panier');
      setAddingToCart(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const fetchProductData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('🛍️ Début chargement produit ID:', id);
        
        // 1. Récupérer le produit depuis Firestore
        const productRef = doc(db, 'products', id);
        console.log('📄 Référence Firestore:', productRef.path);
        
        const productSnap = await getDoc(productRef);
        console.log('📊 Snapshot obtenu:', productSnap.exists() ? '✅ Existe' : '❌ N\'existe pas');
        
        if (!productSnap.exists()) {
          console.log('❌ Produit non trouvé dans Firestore');
          setError('Ce produit n\'existe pas ou a été supprimé');
          if (mounted) setLoading(false);
          return;
        }
        
        const productData = productSnap.data();
        console.log('✅ Produit chargé:', {
          id: productSnap.id,
          nom: productData.name,
          prix: productData.price,
          catégorie: productData.categoryId
        });
        
        // 2. Récupérer les informations du fournisseur depuis Firestore
        let companyData = null;
        if (productData.companyId) {
          console.log('🏢 Chargement du fournisseur:', productData.companyId);
          const companyRef = doc(db, 'companies', productData.companyId);
          const companySnap = await getDoc(companyRef);
          
          if (companySnap.exists()) {
            companyData = companySnap.data();
            console.log('✅ Fournisseur chargé:', companyData.name);
          } else {
            console.log('⚠️ Fournisseur non trouvé pour ID:', productData.companyId);
          }
        }
        
        // 3. Préparer les spécifications RÉELLES du produit
        const realSpecifications = {
          material: productData.material || productData.specifications?.material || 'Non spécifié',
          dimensions: productData.dimensions || productData.specifications?.dimensions || 'N/A',
          weight: productData.weight || productData.specifications?.weight || 'N/A',
          color: productData.color || productData.specifications?.color || 'N/A',
          modelNumber: productData.modelNumber || productData.specifications?.modelNumber || 'N/A',
          warranty: productData.warranty || productData.specifications?.warranty || 'Non spécifiée',
          origin: productData.origin || productData.specifications?.origin || 'Non spécifiée',
          certification: productData.certification || productData.specifications?.certification || 'N/A',
          packaging: productData.packaging || productData.specifications?.packaging || 'N/A',
          ...productData.specifications
        };

        // 4. Options de livraison RÉELLES pour grossistes
        const realShippingOptions = [
          {
            id: 'express_air',
            name: 'Livraison Express par Vol',
            description: 'Envoi par vol express - Idéal pour commandes urgentes',
            deliveryTime: '2 à 5 jours',
            cost: 12000,
            unit: 'FCFA/Kg',
            type: 'express'
          },
          {
            id: 'standard_air',
            name: 'Livraison Standard par Cargo',
            description: 'Envoi par vol cargo - Équilibre prix/délai',
            deliveryTime: '7 à 15 jours',
            cost: 10000,
            unit: 'FCFA/Kg',
            type: 'standard'
          },
          {
            id: 'maritime',
            name: 'Livraison Maritime',
            description: 'Envoi par voie maritime - Économique pour gros volumes',
            deliveryTime: '12 semaines',
            cost: 295000,
            unit: 'FCFA/CBM',
            type: 'economy'
          }
        ];

        // 5. Livraison Grossiste Professionnelle
        const wholesaleDelivery = [
          {
            id: 'wholesale_professional',
            name: 'Livraison Grossiste Professionnelle',
            description: 'Solution logistique complète pour grossistes et professionnels avec suivi dédié',
            features: [
              'Accompagnement personnalisé',
              'Documents douaniers inclus',
              'Assurance transport',
              'Suivi en temps réel',
              'Dédouanement inclus'
            ],
            deliveryTime: '7 à 21 jours selon volume',
            minVolume: 'À partir de 1 CBM',
            cost: 'Sur devis personnalisé',
            contactRequired: true
          }
        ];

        const completeProduct = { 
          id: productSnap.id, 
          ...productData,
          
          seller: companyData ? {
            id: productData.companyId,
            name: companyData.name || 'Fournisseur',
            type: companyData.businessType || 'Manufacturer',
            rating: companyData.rating || 0,
            yearsOnPlatform: companyData.yearsOnPlatform || 0,
            country: companyData.address?.country || 'CN',
            responseTime: companyData.responseTime || '24-48h',
            deliveryRate: companyData.responseRate || 0,
            logo: companyData.logo || 'https://via.placeholder.com/100x100/007AFF/ffffff?text=LOGO',
            verified: companyData.verified || false,
            location: companyData.location || companyData.address?.city || 'Localisation inconnue',
            description: companyData.description,
            totalOrders: companyData.totalOrders || 0,
            goldSupplier: companyData.goldSupplier || false,
            employees: companyData.employees,
            annualRevenue: companyData.annualRevenue,
            certifications: companyData.certifications
          } : {
            id: 'unknown',
            name: productData.companyName || 'Fournisseur non spécifié',
            type: 'Unknown',
            rating: 0,
            yearsOnPlatform: 0,
            country: 'Unknown',
            responseTime: '24-48h',
            deliveryRate: 0,
            logo: 'https://via.placeholder.com/100x100/CCCCCC/ffffff?text=ND',
            verified: false,
            location: 'Localisation inconnue'
          },
          
          images: productData.images || [productData.imageUrl] || [
            'https://via.placeholder.com/400x400/FF6A00/ffffff?text=Produit'
          ],
          
          specifications: realSpecifications,
          
          shippingOptions: realShippingOptions,
          
          wholesaleDelivery: wholesaleDelivery,
          
          reviews: productData.reviews || {
            product: { 
              count: productData.reviewCount || 0, 
              rating: productData.rating || 0 
            },
            shop: { 
              count: companyData?.totalOrders || 0, 
              rating: companyData?.rating || 0 
            }
          },
          
          shipping: productData.shipping || {
            cost: productData.shippingCost || 0,
            estimatedDelivery: productData.deliveryTime || '7-14 jours',
            options: realShippingOptions.length
          },
          
          price: productData.price || 0,
          originalPrice: productData.originalPrice || productData.price || 0,
          minOrder: productData.minOrder || 1,
          inStock: productData.inStock !== undefined ? productData.inStock : true,
          soldCount: productData.soldCount || Math.floor(Math.random() * 1000),
          categoryId: productData.categoryId,
          
          fullDescription: productData.fullDescription || productData.description || 'Description du produit non disponible.'
        };
        
        if (mounted) {
          setProduct(completeProduct);
          await fetchSimilarProducts(completeProduct);
          console.log('✅ Produit complètement chargé');
        }
        
      } catch (error: any) {
        console.error('❌ Erreur détaillée chargement produit:', {
          message: error.message,
          code: error.code,
          stack: error.stack
        });
        
        setError(`Erreur: ${error.message || 'Impossible de charger le produit'}`);
        
      } finally {
        if (mounted) {
          setLoading(false);
          console.log('🏁 Chargement terminé');
        }
      }
    };

    // Vérifier que l'ID est valide avant de charger
    if (id && id !== 'undefined' && id !== 'null' && db) {
      fetchProductData();
    } else {
      setLoading(false);
      setError('ID de produit invalide');
    }
    
    return () => { 
      mounted = false; 
    };
  }, [id]);

  // Handlers pour la navigation
  const handleViewCompany = () => {
    Alert.alert('Information', 'Page fournisseur à venir');
  };

  const handleViewSimilar = () => {
    Alert.alert('Information', 'Produits similaires à venir');
  };

  const handleViewProductReviews = () => {
    Alert.alert('Information', 'Avis du produit à venir');
  };

  const handleViewShopReviews = () => {
    Alert.alert('Information', 'Avis du fournisseur à venir');
  };

  const handleShippingOptions = () => {
    Alert.alert('Information', 'Options de livraison à venir');
  };

  // ✅ MODIFICATION : Ouvrir le modal au lieu de l'alerte
  const handleWholesaleDelivery = () => {
    setQuoteModalVisible(true);
  };

  const handleChat = () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour chatter');
      router.push('/login');
      return;
    }
    Alert.alert('Information', 'Messagerie à venir');
  };

  // Composant pour afficher les options de livraison
  const ShippingOptionsPreview = () => {
    if (!product?.shippingOptions) return null;

    return (
      <View style={styles.shippingPreviewSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Options de Livraison</Text>
          <TouchableOpacity onPress={handleShippingOptions}>
            <Text style={styles.seeAllText}>Voir détails</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.shippingOptionsContainer}>
          {product.shippingOptions.map((option: any, index: number) => (
            <View key={option.id} style={styles.shippingOptionCard}>
              <View style={styles.shippingOptionHeader}>
                <Text style={styles.shippingOptionName}>{option.name}</Text>
                <View style={[
                  styles.deliveryBadge,
                  option.type === 'express' && styles.expressBadge,
                  option.type === 'standard' && styles.standardBadge,
                  option.type === 'economy' && styles.economyBadge
                ]}>
                  <Text style={styles.deliveryBadgeText}>
                    {option.deliveryTime}
                  </Text>
                </View>
              </View>
              <Text style={styles.shippingOptionDescription}>
                {option.description}
              </Text>
              <View style={styles.shippingOptionPrice}>
                <Text style={styles.shippingCost}>
                  {option.cost.toLocaleString()} {option.unit}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Composant pour Livraison Grossiste Professionnelle
  const WholesaleDeliverySection = () => {
    if (!product?.wholesaleDelivery) return null;

    return (
      <View style={styles.wholesaleDeliverySection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Livraison Grossiste Professionnelle</Text>
        </View>
        
        <View style={styles.wholesaleDeliveryCard}>
          <View style={styles.wholesaleHeader}>
            <Text style={styles.wholesaleTitle}>
              {product.wholesaleDelivery[0].name}
            </Text>
            <View style={styles.professionalBadge}>
              <Text style={styles.professionalBadgeText}>PRO</Text>
            </View>
          </View>
          
          <Text style={styles.wholesaleDescription}>
            {product.wholesaleDelivery[0].description}
          </Text>
          
          <View style={styles.wholesaleFeatures}>
            {product.wholesaleDelivery[0].features.map((feature: string, index: number) => (
              <View key={index} style={styles.wholesaleFeatureItem}>
                <Text style={styles.wholesaleFeatureIcon}>✓</Text>
                <Text style={styles.wholesaleFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>
          
          <View style={styles.wholesaleDetails}>
            <View style={styles.wholesaleDetailItem}>
              <Text style={styles.wholesaleDetailLabel}>Délai de livraison:</Text>
              <Text style={styles.wholesaleDetailValue}>
                {product.wholesaleDelivery[0].deliveryTime}
              </Text>
            </View>
            
            <View style={styles.wholesaleDetailItem}>
              <Text style={styles.wholesaleDetailLabel}>Volume minimum:</Text>
              <Text style={styles.wholesaleDetailValue}>
                {product.wholesaleDelivery[0].minVolume}
              </Text>
            </View>
            
            <View style={styles.wholesaleDetailItem}>
              <Text style={styles.wholesaleDetailLabel}>Coût:</Text>
              <Text style={[styles.wholesaleDetailValue, styles.wholesaleCost]}>
                {product.wholesaleDelivery[0].cost}
              </Text>
            </View>
          </View>
          
          {/* ✅ MODIFICATION : BOUTON QUI OUVRE LE MODAL */}
          <TouchableOpacity 
            style={styles.wholesaleContactButton}
            onPress={handleWholesaleDelivery}
          >
            <Text style={styles.wholesaleContactButtonText}>
              Demander un devis personnalisé
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ✅ CORRECTION : ÉCRAN DE CHARGEMENT
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement du produit...</Text>
        <Text style={styles.loadingSubtext}>ID: {id}</Text>
      </View>
    );
  }

  // ✅ CORRECTION : ÉCRAN D'ERREUR
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>❌ Erreur</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>ID du produit: {id}</Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Retour aux produits</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ✅ CORRECTION : PRODUIT INTROUVABLE
  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Produit introuvable</Text>
        <Text style={styles.errorText}>Le produit demandé n'existe pas</Text>
        <Text style={styles.errorSubtext}>ID: {id}</Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Retour aux produits</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Galerie d'images */}
        <ProductGallery 
          images={product.images}
          productName={product.name}
        />

        {/* Badges Premium */}
        <View style={styles.badgesContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🚚 {product.shipping.estimatedDelivery}</Text>
          </View>
          {product.inStock && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>📦 En stock</Text>
            </View>
          )}
          <View style={[styles.badge, styles.badgeHighlight]}>
            <Text style={styles.badgeHighlightText}>⭐ Meilleure Vente</Text>
          </View>
        </View>

        {/* Section Prix Premium */}
        <View style={styles.priceSection}>
          <View style={styles.priceHeader}>
            <Text style={styles.priceLabel}>Prix spécial</Text>
            {product.originalPrice > product.price && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-14%</Text>
              </View>
            )}
          </View>
          
          <View style={styles.priceRow}>
            {product.originalPrice > product.price && (
              <Text style={styles.originalPrice}>{product.originalPrice} F CFA</Text>
            )}
            <Text style={styles.discountedPrice}>{product.price} F CFA</Text>
          </View>
          
          <View style={styles.priceDetails}>
            <Text style={styles.minOrder}>📦 Commande min : {product.minOrder} pièce(s)</Text>
            <Text style={styles.bulkPrice}>🎯 Prix dégressif selon quantité</Text>
          </View>

          <View style={styles.ratingContainer}>
            <View style={styles.ratingStars}>
              <Text style={styles.rating}>⭐⭐⭐⭐⭐</Text>
              <Text style={styles.ratingValue}>{product.reviews.product.rating.toFixed(1)}</Text>
            </View>
            <Text style={styles.ratingCount}>({product.reviews.product.count} avis)</Text>
            <Text style={styles.soldCount}>· {product.soldCount} vendus</Text>
          </View>
        </View>

        {/* Nom du produit */}
        <View style={styles.productNameSection}>
          <Text style={styles.productName}>
            {product.name}
          </Text>
          <Text style={styles.productDescription}>
            {product.fullDescription}
          </Text>
        </View>

        {/* Carte du vendeur */}
        <SellerCard 
          seller={product.seller}
          onPress={handleViewCompany}
        />

        {/* Produits similaires */}
        <View style={styles.similarProductsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Produits Similaires</Text>
            <TouchableOpacity onPress={handleViewSimilar}>
              <Text style={styles.seeAllText}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          
          {similarProducts.length > 0 ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.similarProductsContainer}
            >
              {similarProducts.map((item) => (
                <TouchableOpacity 
                  key={item.id}
                  style={styles.similarProductCard}
                  onPress={() => router.push(`/product/${item.id}`)}
                >
                  <Image 
                    source={{
                      uri: item.image || item.imageUrl || item.images?.[0]
                    }}
                    style={styles.similarProductImage}
                    resizeMode="cover"
                  />
                  <View style={styles.similarProductInfo}>
                    <Text style={styles.similarProductName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <View style={styles.similarProductPrice}>
                      {item.originalPrice > item.price && (
                        <Text style={styles.similarOriginalPrice}>
                          {item.originalPrice} F CFA
                        </Text>
                      )}
                      <Text style={styles.similarCurrentPrice}>
                        {item.price} F CFA
                      </Text>
                    </View>
                    <View style={styles.similarProductMeta}>
                      <Text style={styles.similarProductRating}>
                        ⭐ {item.rating.toFixed(1)}
                      </Text>
                      <Text style={styles.similarProductOrders}>
                        Min: {item.minOrder}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noSimilarProducts}>
              <Text style={styles.noSimilarText}>Aucun produit similaire trouvé</Text>
            </View>
          )}
        </View>

        {/* Spécifications du produit */}
        <ProductSpecifications 
          specifications={product.specifications}
          description={product.fullDescription}
        />

        {/* Options de livraison standard */}
        <ShippingOptionsPreview />

        {/* Livraison Grossiste Professionnelle */}
        <WholesaleDeliverySection />

        {/* Calculateur de livraison */}
        <ShippingCalculator 
          productId={product.id}
          quantity={selectedOptions.quantity}
          onOptionsPress={handleShippingOptions}
          shippingOptions={product.shippingOptions}
        />

        {/* Badges de protection */}
        <ProtectionBadges />

        {/* ✅ Avis et Évaluations en avant-dernière position */}
        <ReviewSummary 
          productReviews={product.reviews.product}
          shopReviews={product.reviews.shop}
          onProductReviewsPress={handleViewProductReviews}
          onShopReviewsPress={handleViewShopReviews}
        />

        {/* Espace pour le footer flottant */}
        <View style={styles.footerSpacer} />
      </ScrollView>

      {/* Footer d'actions flottant */}
      <ActionFooter 
        product={product}
        onAddToCart={handleAddToCartAndRedirect}
        onChat={handleChat}
        addingToCart={addingToCart}
      />

      {/* ✅ MODAL DE DEMANDE DE DEVIS GROSSISTE */}
      <WholesaleQuoteForm
        productName={product?.name}
        productId={product?.id}
        visible={quoteModalVisible}
        onClose={() => setQuoteModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.white 
  },
  scrollContent: {
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    gap: 16,
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  loadingSubtext: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 20,
    gap: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  badgesContainer: { 
    flexDirection: 'row', 
    padding: 16, 
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: { 
    backgroundColor: COLORS.primaryLight, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  badgeHighlight: {
    backgroundColor: COLORS.primary,
  },
  badgeText: { 
    color: COLORS.primary, 
    fontSize: 12, 
    fontWeight: '600',
  },
  badgeHighlightText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  priceSection: { 
    padding: 20, 
    backgroundColor: COLORS.background,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  discountBadge: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  priceRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    marginBottom: 12 
  },
  originalPrice: { 
    fontSize: 16, 
    color: COLORS.textLight, 
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  discountedPrice: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: COLORS.primary,
  },
  priceDetails: {
    gap: 6,
    marginBottom: 16,
  },
  minOrder: { 
    fontSize: 14, 
    color: COLORS.text,
    fontWeight: '500',
  },
  bulkPrice: { 
    fontSize: 14, 
    color: COLORS.text,
    fontWeight: '500',
  },
  ratingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: { 
    fontSize: 14, 
    color: '#FFB800' 
  },
  ratingValue: { 
    fontSize: 14, 
    color: COLORS.text,
    fontWeight: '600',
  },
  ratingCount: { 
    fontSize: 14, 
    color: COLORS.textLight,
    fontWeight: '500',
  },
  soldCount: { 
    fontSize: 14, 
    color: COLORS.textLight,
    fontWeight: '500',
  },
  productNameSection: {
    padding: 20,
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
  },
  productName: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: COLORS.text,
    lineHeight: 24,
    marginBottom: 8,
  },
  productDescription: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 20,
  },
  similarProductsSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  seeAllText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  similarProductsContainer: {
    paddingRight: 16,
    gap: 12,
  },
  similarProductCard: {
    width: 160,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 8,
  },
  similarProductImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  similarProductInfo: {
    flex: 1,
  },
  similarProductName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
    lineHeight: 14,
  },
  similarProductPrice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  similarOriginalPrice: {
    fontSize: 10,
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
  },
  similarCurrentPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  similarProductMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  similarProductRating: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  similarProductOrders: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  noSimilarProducts: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  noSimilarText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  shippingPreviewSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  shippingOptionsContainer: {
    gap: 12,
  },
  shippingOptionCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  shippingOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  shippingOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    marginRight: 12,
  },
  deliveryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  expressBadge: {
    backgroundColor: '#DC2626',
  },
  standardBadge: {
    backgroundColor: '#2563EB',
  },
  economyBadge: {
    backgroundColor: '#059669',
  },
  deliveryBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  shippingOptionDescription: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 8,
    lineHeight: 18,
  },
  shippingOptionPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shippingCost: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  wholesaleDeliverySection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  wholesaleDeliveryCard: {
    backgroundColor: '#F8FAFC',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  wholesaleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  wholesaleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    marginRight: 12,
  },
  professionalBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  professionalBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
  wholesaleDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16,
  },
  wholesaleFeatures: {
    marginBottom: 20,
    gap: 10,
  },
  wholesaleFeatureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  wholesaleFeatureIcon: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  wholesaleFeatureText: {
    fontSize: 14,
    color: '#334155',
    flex: 1,
    lineHeight: 20,
  },
  wholesaleDetails: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  wholesaleDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wholesaleDetailLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  wholesaleDetailValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  wholesaleCost: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 16,
  },
  wholesaleContactButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  wholesaleContactButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  footerSpacer: {
    height: 100,
  },
});