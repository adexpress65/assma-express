import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ShopScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Boutique - En dÃ©veloppement</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 18,
    color: '#666',
  },
});

export default ShopScreen;
