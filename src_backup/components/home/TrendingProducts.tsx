// apps/mobile/src/components/home/TrendingProducts.tsx
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  rating: number;
  sales: number;
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
  return (
    <View style={styles.container}>
      <SectionTitle 
        title="🔥 Produits Tendances" 
        subtitle="Les plus populaires cette semaine"
      />
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {products.map((product) => (
          <TouchableOpacity key={product.id} style={styles.productCard}>
            <Image source={{ uri: product.image }} style={styles.productImage} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>🔥 {product.sales}+</Text>
            </View>
            <Text style={styles.productName} numberOfLines={2}>
              {product.name}
            </Text>
            <View style={styles.rating}>
              <Ionicons name="star" size={12} color="#ffa726" />
              <Text style={styles.ratingText}>{product.rating}</Text>
            </View>
            <Text style={styles.price}>{product.price}€</Text>
          </TouchableOpacity>
        ))}
        
        {products.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Aucun produit tendance pour le moment</Text>
          </View>
        )}
      </ScrollView>
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
  scrollContent: {
    paddingRight: 16,
  },
  productCard: {
    width: 140,
    marginRight: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  productName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginBottom: 6,
    lineHeight: 14,
    height: 28,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ff6a00',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

const sectionStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
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