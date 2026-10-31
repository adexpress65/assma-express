// apps/mobile/app/category/category-products.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function CategoryProductsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Produits de la CatÃ©gorie</Text>
      <Text>Ã‰cran des produits par catÃ©gorie - En dÃ©veloppement</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});
