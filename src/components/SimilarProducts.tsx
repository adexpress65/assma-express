// mobile/src/components/SimilarProducts.tsx
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  StyleSheet, 
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router'; // AJOUT IMPORT
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2.5;

interface SimilarProductsProps {
  productId: string;
  onViewAll: () => void;
}

interface SimilarProduct {
  id: string;
  name: string;
  image: string;
  price: string;
  moq: string;
  productRef?: string;
  rating?: number;
  orders?: number;
  badges?: string[];
}

export default function SimilarProducts({ productId, onViewAll }: SimilarProductsProps) {
  const router = useRouter(); // INIT ROUTER
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSimilarProducts();
  }, [productId]);

  // FONCTION DE NAVIGATION VERS FICHE PRODUIT
  const handleProductPress = (productId: string) => {
    console.log('Navigation vers produit:', productId);
    router.push(`/product/${productId}`);
  };

  const loadSimilarProducts = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSimilarProducts(getEnrichedSimilarProducts());
    } catch (error) {
      console.error('Erreur chargement produits similaires:', error);
      setSimilarProducts(getEnrichedSimilarProducts());
    } finally {
      setLoading(false);
    }
  };

  const getEnrichedSimilarProducts = (): SimilarProduct[] => [
    {
      id: 'prod-sim-001', // ID UNIQUE POUR NAVIGATION
      name: 'Cadenas à Combinaison Sécurité Haute',
      image: 'https://images.unsplash.com/photo-1602488257133-6c43dffceacf?w=150&h=150&fit=crop',
      price: '1 178-1 414 F CFA',
      moq: '2 pièces (MOQ)',
      rating: 4.8,
      orders: 254,
      badges: ['Top Vente']
    },
    {
      id: 'prod-sim-002', 
      name: 'Cadenas Numérique Portable',
      image: 'https://images.unsplash.com/photo-1588854337230-24b3c1255c9a?w=150&h=150&fit=crop',
      price: '823 F CFA',
      moq: '4 pièces (MOQ)',
      rating: 4.5,
      orders: 189,
      badges: ['Nouveau']
    },
    {
      id: 'prod-sim-003',
      name: 'Mini Cadenas Sécurité Voyage',
      image: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=150&h=150&fit=crop',
      price: '89-119 F CFA', 
      moq: '20 pièces (MOQ)',
      rating: 4.3,
      orders: 567,
      badges: ['Économique']
    },
    {
      id: 'prod-sim-004',
      name: 'Cadenas Antivol Métal Lourd',
      image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=150&h=150&fit=crop',
      price: '2 150 F CFA',
      moq: '1 pièce (MOQ)',
      rating: 4.9,
      orders: 89,
      badges: ['Premium']
    }
  ];

  const handleImageError = (imageUrl: string) => {
    setImageErrors(prev => new Set(prev).add(imageUrl));
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push('★');
      } else if (i === fullStars && hasHalfStar) {
        stars.push('☆');
      } else {
        stars.push('☆');
      }
    }
    return stars.join('');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Voir les choix similaires</Text>
        <ActivityIndicator size="small" color="#ff6a00" style={styles.loading} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voir les choix similaires</Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
        {similarProducts.map((product) => (
          <TouchableOpacity 
            key={product.id}
            style={styles.productCard}
            onPress={() => handleProductPress(product.id)} // NAVIGATION ICI
          >
            {/* Badge */}
            {product.badges && product.badges.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{product.badges[0]}</Text>
              </View>
            )}

            {/* Image du produit */}
            <View style={styles.imageContainer}>
              {!imageErrors.has(product.image) ? (
                <Image 
                  source={{ uri: product.image }} 
                  style={styles.productImage}
                  resizeMode="cover"
                  onError={() => handleImageError(product.image)}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.placeholderText}>📷</Text>
                </View>
              )}
            </View>

            {/* Nom du produit */}
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>

            {/* Rating */}
            {product.rating && (
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingStars}>{renderStars(product.rating)}</Text>
                <Text style={styles.ratingValue}>{product.rating}</Text>
                {product.orders && (
                  <Text style={styles.orders}>({product.orders})</Text>
                )}
              </View>
            )}

            {/* Prix */}
            <Text style={styles.price}>{product.price}</Text>

            {/* MOQ */}
            <Text style={styles.moq}>{product.moq}</Text>

            {/* Bouton rapide */}
            <TouchableOpacity 
              style={styles.quickButton}
              onPress={() => handleProductPress(product.id)} // NAVIGATION AUSSI ICI
            >
              <Text style={styles.quickButtonText}>Voir</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      <TouchableOpacity style={styles.viewAllButton} onPress={onViewAll}>
        <Text style={styles.viewAllText}>Tout afficher ›</Text>
      </TouchableOpacity>
    </View>
  );
}

// Les styles restent identiques...
const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  loading: {
    marginVertical: 20,
  },
  scrollContainer: {
    marginBottom: 12,
  },
  scrollContent: {
    paddingRight: 16,
  },
  productCard: {
    marginRight: 12,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    width: CARD_WIDTH,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ff4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  productImage: {
    width: CARD_WIDTH - 24,
    height: CARD_WIDTH - 24,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  imagePlaceholder: {
    width: CARD_WIDTH - 24,
    height: CARD_WIDTH - 24,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 24,
  },
  productName: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
    marginBottom: 6,
    height: 32,
    lineHeight: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingStars: {
    fontSize: 10,
    color: '#ff9500',
    marginRight: 4,
  },
  ratingValue: {
    fontSize: 10,
    color: '#666',
    marginRight: 4,
  },
  orders: {
    fontSize: 10,
    color: '#999',
  },
  price: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ff6a00',
    marginBottom: 2,
  },
  moq: {
    fontSize: 11,
    color: '#666',
    marginBottom: 8,
  },
  quickButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  quickButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  viewAllButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  viewAllText: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '600',
  },
});