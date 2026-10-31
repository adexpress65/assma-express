// apps/mobile/src/components/home/SpecialOffers.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  image: string;
  soldCount: number;
}

interface Props {
  products: Product[];
}

export default function SpecialOffers({ products }: Props) {
  const navigation = useNavigation();

  const handleProductPress = (productId: string) => {
    navigation.navigate('ProductDetails', { productId });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Special Offers</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {products.map((product) => (
          <TouchableOpacity 
            key={product.id}
            style={styles.productCard}
            onPress={() => handleProductPress(product.id)}
          >
            {/* Votre code produit existant */}
            <Image source={{ uri: product.image }} style={styles.productImage} />
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.price}>{product.price.toLocaleString()} FCFA</Text>
            {/* ... reste du code */}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ... vos styles existants

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAll: {
    color: '#ff6a00',
    fontSize: 14,
  },
  scrollView: {
    paddingLeft: 16,
  },
  productCard: {
    width: 140,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ff4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  productImage: {
    width: 120,
    height: 120,
    borderRadius: 6,
    alignSelf: 'center',
  },
  currentPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  productName: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    height: 32,
  },
  soldCount: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
});
