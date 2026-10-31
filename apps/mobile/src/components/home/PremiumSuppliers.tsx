// apps/mobile/src/components/home/PremiumSuppliers.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  rating: number;
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

export default function PremiumSuppliers({ products }: Props) {
  return (
    <View style={styles.container}>
      <SectionTitle 
        title=" Fournisseurs Vérifiés" 
        subtitle="Vendeurs premium avec garantie ASMA"
      />
      
      <View style={styles.benefits}>
        <View style={styles.benefitItem}>
          <Ionicons name="shield-checkmark" size={20} color="#4caf50" />
          <Text style={styles.benefitText}>Garantie qualité</Text>
        </View>
        <View style={styles.benefitItem}>
          <Ionicons name="rocket" size={20} color="#2196f3" />
          <Text style={styles.benefitText}>Livraison express</Text>
        </View>
        <View style={styles.benefitItem}>
          <Ionicons name="headset" size={20} color="#ff6a00" />
          <Text style={styles.benefitText}>Support 24/7</Text>
        </View>
      </View>

      <Text style={styles.productCount}>
        {products?.length || 0} fournisseurs premium disponibles
      </Text>
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
  benefits: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 16,
  },
  benefitItem: {
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    marginTop: 4,
  },
  productCount: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
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
