import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function TrendingProductsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular');

  const categories = [
    { id: 'all', name: 'Tous' },
    { id: 'electronics', name: 'Ãƒâ€°lectronique' },
    { id: 'fashion', name: 'Mode' },
    { id: 'home', name: 'Maison' },
    { id: 'beauty', name: 'BeautÃƒÂ©' },
    { id: 'sports', name: 'Sports' }
  ];

  const trendingProducts = [
    {
      id: 1,
      name: 'Smartphone Android 5G 128GB',
      price: '899 DH',
      originalPrice: '1,199 DH',
      image: 'Ã°Å¸â€œÂ±',
      rating: 4.8,
      orders: '2.4k',
      category: 'electronics',
      discount: '-25%',
      isFavorite: true
    },
    {
      id: 2,
      name: 'Casque Audio Bluetooth Noise Cancelling',
      price: '299 DH',
      originalPrice: '499 DH',
      image: 'Ã°Å¸Å½Â§',
      rating: 4.5,
      orders: '1.8k',
      category: 'electronics',
      discount: '-40%',
      isFavorite: false
    },
    {
      id: 3,
      name: 'Montre ConnectÃƒÂ©e Sport GPS',
      price: '450 DH',
      originalPrice: '699 DH',
      image: 'Ã¢Å’Å¡',
      rating: 4.3,
      orders: '956',
      category: 'electronics',
      discount: '-35%',
      isFavorite: true
    },
    {
      id: 4,
      name: 'Sac ÃƒÂ  Dos Ordinateur 15"',
      price: '199 DH',
      originalPrice: '299 DH',
      image: 'Ã°Å¸Å½â€™',
      rating: 4.6,
      orders: '1.2k',
      category: 'fashion',
      discount: '-33%',
      isFavorite: false
    },
    {
      id: 5,
      name: 'Machine ÃƒÂ  CafÃƒÂ© Automatique',
      price: '1,299 DH',
      originalPrice: '1,799 DH',
      image: 'Ã¢Ëœâ€¢',
      rating: 4.7,
      orders: '654',
      category: 'home',
      discount: '-28%',
      isFavorite: false
    },
    {
      id: 6,
      name: 'Set de Maquillage Professionnel',
      price: '349 DH',
      originalPrice: '499 DH',
      image: 'Ã°Å¸â€™â€ž',
      rating: 4.4,
      orders: '892',
      category: 'beauty',
      discount: '-30%',
      isFavorite: true
    }
  ];

  const filteredProducts = trendingProducts.filter(product => {
    const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch(sortBy) {
      case 'price-low':
        return parseFloat(a.price) - parseFloat(b.price);
      case 'price-high':
        return parseFloat(b.price) - parseFloat(a.price);
      case 'rating':
        return b.rating - a.rating;
      case 'popular':
      default:
        return parseFloat(b.orders) - parseFloat(a.orders);
    }
  });

  const toggleFavorite = (productId: number) => {
    // ImplÃƒÂ©mentation de la logique favoris
    console.log('Toggle favorite:', productId);
  };

  const renderProductItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => router.push(`/products/${item.id}`)}
    >
      <View style={styles.productImage}>
        <Text style={styles.emoji}>{item.image}</Text>
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{item.discount}</Text>
        </View>
        <TouchableOpacity 
          style={styles.favoriteButton}
          onPress={() => toggleFavorite(item.id)}
        >
          <Ionicons 
            name={item.isFavorite ? "heart" : "heart-outline"} 
            size={20} 
            color={item.isFavorite ? "#FF4444" : "#FFF"} 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>

        <View style={styles.ratingContainer}>
          <View style={styles.ratingStars}>
            <Ionicons name="star" size={12} color="#FFD700" />
            <Text style={styles.rating}>{item.rating}</Text>
          </View>
          <Text style={styles.orders}>{item.orders} commandes</Text>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.currentPrice}>{item.price}</Text>
          <Text style={styles.originalPrice}>{item.originalPrice}</Text>
        </View>

        <TouchableOpacity style={styles.addToCartButton}>
          <Ionicons name="cart-outline" size={16} color="#FFF" />
          <Text style={styles.addToCartText}>Ajouter</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Produits Tendances</Text>
        <TouchableOpacity>
          <Ionicons name="filter" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher des produits..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* CatÃƒÂ©gories */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesScroll}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryButton,
              activeCategory === category.id && styles.categoryButtonActive
            ]}
            onPress={() => setActiveCategory(category.id)}
          >
            <Text style={[
              styles.categoryText,
              activeCategory === category.id && styles.categoryTextActive
            ]}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filtres de tri */}
      <View style={styles.sortSection}>
        <Text style={styles.sortLabel}>Trier par:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { id: 'popular', name: 'Populaire' },
            { id: 'rating', name: 'Meilleures notes' },
            { id: 'price-low', name: 'Prix croissant' },
            { id: 'price-high', name: 'Prix dÃƒÂ©croissant' }
          ].map((sort) => (
            <TouchableOpacity
              key={sort.id}
              style={[
                styles.sortButton,
                sortBy === sort.id && styles.sortButtonActive
              ]}
              onPress={() => setSortBy(sort.id)}
            >
              <Text style={[
                styles.sortText,
                sortBy === sort.id && styles.sortTextActive
              ]}>
                {sort.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Liste des produits */}
      <FlatList
        data={sortedProducts}
        renderItem={renderProductItem}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.productsGrid}
        showsVerticalScrollIndicator={false}
      />
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
  searchSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
    fontSize: 16,
    color: '#333',
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#FF6B00',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  categoryTextActive: {
    color: '#FFF',
  },
  sortSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 12,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    marginRight: 8,
  },
  sortButtonActive: {
    backgroundColor: '#FF6B00',
  },
  sortText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  sortTextActive: {
    color: '#FFF',
  },
  productsGrid: {
    padding: 8,
  },
  productCard: {
    flex: 1,
    margin: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    maxWidth: '46%',
  },
  productImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  emoji: {
    fontSize: 40,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 4,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    lineHeight: 16,
    height: 32,
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
    fontSize: 10,
    color: '#999',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B00',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  addToCartText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
