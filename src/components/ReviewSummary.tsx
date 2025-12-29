// mobile/src/components/ReviewSummary.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ReviewSummaryProps {
  productReviews: {
    count: number;
    rating: number;
    distribution?: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
  };
  shopReviews: {
    count: number;
    rating: number;
  };
  onProductReviewsPress?: () => void;
  onShopReviewsPress?: () => void;
}

export default function ReviewSummary({ 
  productReviews, 
  shopReviews, 
  onProductReviewsPress,
  onShopReviewsPress 
}: ReviewSummaryProps) {
  
  // Distribution par défaut si non fournie
  const distribution = productReviews.distribution || {
    5: Math.floor(productReviews.rating * 20),
    4: Math.floor(productReviews.rating * 15),
    3: Math.floor(productReviews.rating * 10),
    2: Math.floor(productReviews.rating * 5),
    1: Math.floor(productReviews.rating * 2)
  };

  const totalDistribution = Object.values(distribution).reduce((a, b) => a + b, 0);

  const renderDistributionBar = (stars: number, count: number) => {
    const percentage = totalDistribution > 0 ? (count / totalDistribution) * 100 : 0;
    
    return (
      <View key={`distribution-${stars}`} style={styles.distributionRow}>
        <Text style={styles.starLabel}>{stars} ⭐</Text>
        <View style={styles.barContainer}>
          <View style={[styles.bar, { width: `${percentage}%` }]} />
        </View>
        <Text style={styles.countLabel}>{count}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 Avis & Évaluations</Text>
      
      <View style={styles.reviewsContainer}>
        {/* Évaluation du produit */}
        <TouchableOpacity 
          style={styles.reviewCard} 
          onPress={onProductReviewsPress}
          activeOpacity={0.7}
        >
          <View style={styles.reviewHeader}>
            <View style={styles.reviewRating}>
              <Text style={styles.ratingValue}>{productReviews.rating.toFixed(1)}</Text>
              <Text style={styles.ratingStars}>⭐⭐⭐⭐⭐</Text>
            </View>
            <View style={styles.reviewCount}>
              <Text style={styles.count}>{productReviews.count}</Text>
              <Text style={styles.countLabelSmall}>avis produit</Text>
            </View>
          </View>
          
          <Text style={styles.reviewTitle}>Avis sur le produit</Text>
          
          {/* Distribution des étoiles */}
          <View style={styles.distributionContainer}>
            {[5, 4, 3, 2, 1].map(stars => 
              renderDistributionBar(stars, distribution[stars as keyof typeof distribution])
            )}
          </View>
          
          <TouchableOpacity style={styles.viewAllButton} onPress={onProductReviewsPress}>
            <Text style={styles.viewAllText}>Voir tous les avis produit</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Évaluation du vendeur */}
        <TouchableOpacity 
          style={styles.reviewCard} 
          onPress={onShopReviewsPress}
          activeOpacity={0.7}
        >
          <View style={styles.reviewHeader}>
            <View style={styles.reviewRating}>
              <Text style={styles.ratingValue}>{shopReviews.rating.toFixed(1)}</Text>
              <Text style={styles.ratingStars}>⭐⭐⭐⭐⭐</Text>
            </View>
            <View style={styles.reviewCount}>
              <Text style={styles.count}>{shopReviews.count}</Text>
              <Text style={styles.countLabelSmall}>avis fournisseur</Text>
            </View>
          </View>
          
          <Text style={styles.reviewTitle}>Évaluation du fournisseur</Text>
          
          <View style={styles.shopMetrics}>
            <View style={styles.metricItem}>
              <Text style={styles.metricIcon}>🚚</Text>
              <Text style={styles.metricText}>Livraison: {shopReviews.rating > 4 ? 'Excellente' : 'Bonne'}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricIcon}>💬</Text>
              <Text style={styles.metricText}>Communication: {shopReviews.rating > 4 ? 'Excellente' : 'Bonne'}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricIcon}>📦</Text>
              <Text style={styles.metricText}>Qualité: {shopReviews.rating > 4 ? 'Excellente' : 'Bonne'}</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.viewAllButton} onPress={onShopReviewsPress}>
            <Text style={styles.viewAllText}>Voir tous les avis fournisseur</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  reviewsContainer: {
    gap: 16,
  },
  reviewCard: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewRating: {
    alignItems: 'center',
  },
  ratingValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF6A00',
  },
  ratingStars: {
    fontSize: 14,
    color: '#FFB800',
    marginTop: 2,
  },
  reviewCount: {
    alignItems: 'center',
  },
  count: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#374151',
  },
  countLabelSmall: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  distributionContainer: {
    gap: 8,
    marginBottom: 16,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starLabel: {
    fontSize: 12,
    color: '#6B7280',
    width: 32,
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    backgroundColor: '#FFB800',
    borderRadius: 4,
  },
  countLabel: {
    fontSize: 12,
    color: '#6B7280',
    width: 32,
    textAlign: 'right',
  },
  viewAllButton: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  viewAllText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  shopMetrics: {
    gap: 8,
    marginBottom: 16,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricIcon: {
    fontSize: 16,
    width: 24,
  },
  metricText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
});