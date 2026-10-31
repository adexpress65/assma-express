import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import ProductCardPremium from './ProductCardPremium';

const { width } = Dimensions.get('window');

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  rating: number;
  supplier: string;
  minOrder: number;
  deliveryTime: string;
  isVerified: boolean;
  stock: number;
  soldCount?: number;
  categoryId?: string;
  categoryName?: string;
  category?: string;
  featured?: boolean;
  trending?: boolean;
  specialOffer?: boolean;
}

interface PremiumSpecialOffersProps {
  products: Product[];
  title?: string;
  subtitle?: string;
  showTimer?: boolean;
  showProgress?: boolean;
}

export default function PremiumSpecialOffers({ 
  products, 
  title,
  subtitle,
  showTimer = true,
  showProgress = true,
}: PremiumSpecialOffersProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const resolvedTitle = title ?? t('app.premium.specialOffersDefaultTitle');

  // Grouper les produits par 2 pour affichage sur 2 colonnes
  const groupedProducts = React.useMemo(() => {
    return products.reduce((acc: Product[][], _, i, arr) => {
      if (i % 2 === 0) acc.push(arr.slice(i, i + 2));
      return acc;
    }, []);
  }, [products]);

  // Navigation "Tout voir"
  const handleSeeAll = () => {
    if (products.length > 0 && products[0].categoryId) {
      router.push({
        pathname: '/category/[id]',
        params: { 
          id: products[0].categoryId,
          name: products[0].categoryName || products[0].category || resolvedTitle
        }
      });
    } else {
      router.push('/special-offers');
    }
  };

  // Calcul du pourcentage de progression
  const calculateProgress = () => {
    const totalProducts = products.length;
    const soldProducts = products.reduce((acc, product) => {
      return acc + (product.soldCount || Math.floor(Math.random() * 100));
    }, 0);
    return Math.min(100, Math.round((soldProducts / (totalProducts * 100)) * 100));
  };

  const progressPercentage = calculateProgress();

  // Timer simulé
  const [timeLeft, setTimeLeft] = React.useState({
    hours: 23,
    minutes: 59,
    seconds: 59
  });

  React.useEffect(() => {
    if (!showTimer) return;
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        let { hours, minutes, seconds } = prev;
        
        if (seconds > 0) {
          seconds--;
        } else {
          seconds = 59;
          if (minutes > 0) {
            minutes--;
          } else {
            minutes = 59;
            if (hours > 0) {
              hours--;
            } else {
              clearInterval(interval);
            }
          }
        }
        
        return { hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showTimer]);

  const formatTime = (num: number) => num.toString().padStart(2, '0');

  const renderProductGroup = ({ item, index }: { item: Product[], index: number }) => (
    <View key={`group-${index}`} style={styles.productGroup}>
      {item.map((product, productIndex) => (
        <View key={product.id} style={styles.productWrapper}>
          <ProductCardPremium 
            product={product}
            style={styles.productCard}
            isCategoryPage={false}
            showCategory={true}
          />
          
          {index === 0 && productIndex === 0 && (
            <LinearGradient
              colors={['#ff4444', '#ff6a00']}
              style={styles.hotBadge}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="flash" size={12} color="#fff" />
              <Text style={styles.hotText}>{t('app.premium.badgeHot')}</Text>
            </LinearGradient>
          )}
          
          {product.featured && (
            <LinearGradient
              colors={['#2196F3', '#21CBF3']}
              style={styles.featuredBadge}
            >
              <Ionicons name="star" size={10} color="#fff" />
              <Text style={styles.featuredText}>{t('app.premium.badgeFeatured')}</Text>
            </LinearGradient>
          )}
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* En-tête de section */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            {/* ICÔNE ET TITRE */}
            <Ionicons name="flash" size={24} color="#ff6a00" />
            <Text style={styles.title}>{resolvedTitle}</Text>
            
            {/* TIMER À DROITE */}
            {showTimer && (
              <LinearGradient
                colors={['#ff4444', '#ff6a00']}
                style={styles.timerBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="time-outline" size={14} color="#fff" />
                <Text style={styles.timerText}>
                  {formatTime(timeLeft.hours)}:{formatTime(timeLeft.minutes)}:{formatTime(timeLeft.seconds)}
                </Text>
              </LinearGradient>
            )}
          </View>
          
          {subtitle && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
          
          <Text style={styles.countText}>
            {products.length} offre{products.length > 1 ? 's' : ''} spéciale{products.length > 1 ? 's' : ''}
          </Text>
        </View>
        
        {/* BOUTON "TOUT VOIR" À DROITE */}
        <TouchableOpacity 
          style={styles.seeAllButton}
          onPress={handleSeeAll}
          activeOpacity={0.7}
        >
          <Text style={styles.seeAllText}>Tout voir</Text>
          <Ionicons name="arrow-forward" size={16} color="#ff6a00" />
        </TouchableOpacity>
      </View>

      {/* Liste des produits */}
      {products.length > 0 ? (
        <FlatList
          data={groupedProducts}
          renderItem={renderProductGroup}
          keyExtractor={(_, index) => `product-group-${index}`}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.productsContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucune offre disponible</Text>
            </View>
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="flash-off-outline" size={48} color="#DDD" />
          <Text style={styles.emptyText}>Aucune offre disponible</Text>
          <Text style={styles.emptySubtext}>Revenez plus tard</Text>
        </View>
      )}

      {/* Barre de progression */}
      {showProgress && products.length > 0 && (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Offres vendues</Text>
            <Text style={styles.progressPercentage}>{progressPercentage}%</Text>
          </View>
          
          <View style={styles.progressBar}>
            <LinearGradient
              colors={['#ff6a00', '#ff8c00']}
              style={[styles.progressFill, { width: `${progressPercentage}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
          
          <Text style={styles.progressText}>
            {progressPercentage >= 80 ? '⚡ Presque épuisé !' : 'Dépêchez-vous avant rupture'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 20,
    marginTop: 16,
    borderRadius: 20,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  titleSection: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A1A',
    marginLeft: 10,
    marginRight: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 6,
    lineHeight: 20,
  },
  countText: {
    fontSize: 13,
    color: '#FF6A00',
    fontWeight: '600',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
    fontVariant: ['tabular-nums'],
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 106, 0, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 106, 0, 0.2)',
    marginLeft: 12,
  },
  seeAllText: {
    color: '#FF6A00',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  productsContainer: {
    paddingHorizontal: 12,
  },
  productGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  productWrapper: {
    flex: 1,
    marginHorizontal: 4,
    position: 'relative',
  },
  productCard: {
    width: '100%',
  },
  hotBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  hotText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  featuredBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  featuredText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  progressSection: {
    paddingHorizontal: 20,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 16,
    color: '#FF6A00',
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#BBB',
  },
  // ❌ SUPPRIMÉS LES STYLES DU BOUTON TEST
  // testButton: {...},
  // testButtonText: {...},
});
