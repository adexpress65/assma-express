// apps/mobile/src/components/home/TrendingProducts.tsx - VERSION 2 PRODUITS PAR LIGNE
import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  StyleSheet, 
  FlatList,
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  rating?: number;
  sales?: number;
}

interface Props {
  products: Product[];
}

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <View style={sectionStyles.container}>
    <Text style={sectionStyles.title}>{title}</Text>
    {subtitle && <Text style={sectionStyles.subtitle}>{subtitle}</Text>}
  </View>
);

export default function TrendingProducts({ products }: Props) {
  const router = useRouter();

  // ✅ MODIFIÉ : Grouper les produits par 2 pour affichage sur 2 colonnes
  const groupedProducts = products.reduce((acc: Product[][], _, i, arr) => {
    if (i % 2 === 0) acc.push(arr.slice(i, i + 2));
    return acc;
  }, []);

  const navigateToProductDetails = (product: Product) => {
    router.push({
      pathname: "/product/[id]",
      params: { 
        id: product.id,
        name: encodeURIComponent(product.name || ''),
        price: product.price?.toString() || '0',
        image: encodeURIComponent(product.image || ''),
      },
    });
  };

  const navigateToAllTrending = () => {
    router.push({
      pathname: "/category/[id]",
      params: { 
        id: "trending",
        name: encodeURIComponent("Produits Tendances") 
      },
    });
  };

  // ✅ MODIFIÉ : Rendu des groupes de produits
  const renderProductGroup = ({ item }: { item: Product[] }) => (
    <View style={styles.productGroup}>
      {item.map((product, productIndex) => (
        <TouchableOpacity 
          key={product.id} 
          style={styles.productCard}
          onPress={() => navigateToProductDetails(product)}
        >
          <Image source={{ uri: product.image }} style={styles.productImage} />
          
          {/* Badge de vente */}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🔥 {product.sales || 0}+</Text>
          </View>

          {/* Badge de rang pour les premiers produits */}
          {productIndex < 2 && (
            <View style={[
              styles.rankBadge,
              productIndex === 0 && styles.rankOne,
              productIndex === 1 && styles.rankTwo
            ]}>
              <Text style={styles.rankText}>#{productIndex + 1}</Text>
            </View>
          )}

          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>
            
            <View style={styles.ratingContainer}>
              <View style={styles.rating}>
                <Ionicons name="star" size={12} color="#ffa726" />
                <Text style={styles.ratingText}>{product.rating || 4.5}</Text>
              </View>
              
              <View style={styles.salesIndicator}>
                <View 
                  style={[
                    styles.salesBar,
                    { width: `${Math.min((product.sales || 0) * 2, 100)}%` }
                  ]} 
                />
              </View>
            </View>
            
            <Text style={styles.price}>{product.price.toLocaleString()} FCFA</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SectionTitle 
          title="Produits Tendances" 
          subtitle="Les plus populaires cette semaine"
        />
        <TouchableOpacity 
          style={styles.seeAllButton}
          onPress={navigateToAllTrending}
        >
          <Text style={styles.seeAllText}>Tout voir</Text>
          <Ionicons name="arrow-forward" size={16} color="#ff6a00" />
        </TouchableOpacity>
      </View>
      
      {/* ✅ MODIFIÉ : FlatList verticale avec 2 colonnes */}
      {products.length > 0 ? (
        <FlatList
          data={groupedProducts}
          renderItem={renderProductGroup}
          keyExtractor={(_, index) => `trending-group-${index}`}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.productsContainer}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="trending-up" size={48} color="#ccc" />
          <Text style={styles.emptyText}>Aucun produit tendance pour le moment</Text>
          <Text style={styles.emptySubtext}>Revenez plus tard pour découvrir les nouveautés</Text>
        </View>
      )}

      {/* Indicateur de tendance */}
      <View style={styles.trendIndicator}>
        <View style={styles.trendItem}>
          <Ionicons name="eye" size={16} color="#ff6a00" />
          <Text style={styles.trendText}>1.2K vues aujourd'hui</Text>
        </View>
        <View style={styles.trendDivider} />
        <View style={styles.trendItem}>
          <Ionicons name="flash" size={16} color="#ff6a00" />
          <Text style={styles.trendText}>En hausse de 24%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 4,
  },
  seeAllText: {
    color: '#ff6a00',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  productsContainer: {
    paddingBottom: 8,
  },
  productGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productCard: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    position: 'relative',
    minHeight: 200,
  },
  productImage: {
    width: '100%',
    height: 100,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255, 106, 0, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  rankBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  rankOne: {
    backgroundColor: '#FFD700',
  },
  rankTwo: {
    backgroundColor: '#C0C0C0',
  },
  rankText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    lineHeight: 14,
    minHeight: 28,
  },
  ratingContainer: {
    marginBottom: 8,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
    marginLeft: 4,
  },
  salesIndicator: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  salesBar: {
    height: '100%',
    backgroundColor: '#ff6a00',
    borderRadius: 2,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff6a00',
    marginTop: 'auto',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginVertical: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  trendIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 0, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.1)',
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginLeft: 6,
  },
  trendDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 106, 0, 0.2)',
  },
});

const sectionStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
});