import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

const products = [
  {
    id: 1,
    name: 'Smartphone Android 2024',
    price: '€189.99',
    image: 'https://via.placeholder.com/120x120',
  },
  {
    id: 2,
    name: 'Casque Bluetooth',
    price: '€45.99',
    image: 'https://via.placeholder.com/120x120',
  },
  {
    id: 3,
    name: 'Montre Connectée',
    price: '€79.99',
    image: 'https://via.placeholder.com/120x120',
  },
  {
    id: 4,
    name: 'Power Bank 20000mAh',
    price: '€29.99',
    image: 'https://via.placeholder.com/120x120',
  },
];

export default function ProductCarousel() {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {products.map((product) => (
        <TouchableOpacity key={product.id} style={styles.productCard}>
          <Image 
            source={{ uri: product.image }} 
            style={styles.productImage}
          />
          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={styles.productPrice}>{product.price}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 0,
  },
  contentContainer: {
    paddingRight: 16,
  },
  productCard: {
    width: 120,
    backgroundColor: 'white',
    borderRadius: 8,
    marginRight: 12,
    padding: 8,
  },
  productImage: {
    width: '100%',
    height: 100,
    borderRadius: 6,
    marginBottom: 8,
  },
  productName: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
    lineHeight: 14,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
});