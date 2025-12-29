import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function FavoritesScreen() {
  const router = useRouter();

  const favorites = [
    {
      id: 1,
      name: 'Smartphone Android 5G 128GB',
      price: '899 DH',
      originalPrice: '1,199 DH',
      image: 'ðŸ“±',
      rating: 4.8,
      orders: '2.4k',
      inStock: true
    },
    {
      id: 2,
      name: 'Casque Audio Bluetooth Noise Cancelling',
      price: '299 DH',
      originalPrice: '499 DH',
      image: 'ðŸŽ§',
      rating: 4.5,
      orders: '1.8k',
      inStock: true
    },
    {
      id: 3,
      name: 'Montre ConnectÃ©e Sport GPS',
      price: '450 DH',
      originalPrice: '699 DH',
      image: 'âŒš',
      rating: 4.3,
      orders: '956',
      inStock: false
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Favoris</Text>
        <TouchableOpacity>
          <Ionicons name="search" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>
          {favorites.length} produits dans vos favoris
        </Text>

        {favorites.map((item) => (
          <TouchableOpacity 
            key={item.id}
            style={styles.productCard}
            onPress={() => router.push(`/products/${item.id}`)}
          >
            <View style={styles.productImage}>
              <Text style={styles.emoji}>{item.image}</Text>
              <TouchableOpacity style={styles.favoriteButtonActive}>
                <Ionicons name="heart" size={20} color="#FF4444" />
              </TouchableOpacity>
            </View>

            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>

              <View style={styles.ratingContainer}>
                <View style={styles.ratingStars}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.rating}>{item.rating}</Text>
                </View>
                <Text style={styles.orders}>{item.orders} commandes</Text>
              </View>

              <View style={styles.priceContainer}>
                <Text style={styles.currentPrice}>{item.price}</Text>
                <Text style={styles.originalPrice}>{item.originalPrice}</Text>
              </View>

              {!item.inStock && (
                <Text style={styles.outOfStock}>Rupture de stock</Text>
              )}
            </View>

            <TouchableOpacity 
              style={[
                styles.cartButton,
                !item.inStock && styles.cartButtonDisabled
              ]}
              disabled={!item.inStock}
            >
              <Ionicons name="cart-outline" size={18} color="#FFF" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: {
    width: 80,
    height: 80,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  emoji: {
    fontSize: 32,
  },
  favoriteButtonActive: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 4,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    lineHeight: 18,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  orders: {
    fontSize: 11,
    color: '#999',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B00',
    marginRight: 6,
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  outOfStock: {
    fontSize: 11,
    color: '#FF4444',
    fontWeight: '500',
  },
  cartButton: {
    backgroundColor: '#FF6B00',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  cartButtonDisabled: {
    backgroundColor: '#CCC',
  },
});

