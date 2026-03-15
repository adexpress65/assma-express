// apps/mobile/src/components/home/WholesalePayment.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const SectionTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <View style={sectionStyles.container}>
    <Text style={sectionStyles.title}>{title}</Text>
    {subtitle && <Text style={sectionStyles.subtitle}>{subtitle}</Text>}
  </View>
);

export default function WholesalePayment() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <SectionTitle 
        title="💳 Paiement Grossiste" 
        subtitle="Accédez à nos tarifs professionnels"
      />
      
      <View style={styles.cardsContainer}>
        <TouchableOpacity 
          style={styles.card}
          onPress={() => router.push('/become-seller')} // Route existante
        >
          <View style={[styles.iconContainer, { backgroundColor: '#e3f2fd' }]}>
            <Ionicons name="business" size={24} color="#1976d2" />
          </View>
          <Text style={styles.cardTitle}>Devenir Grossiste</Text>
          <Text style={styles.cardDescription}>
            Tarifs préférentiels et conditions exclusives
          </Text>
          <Text style={styles.cardButton}>S'inscrire →</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.card}
          onPress={() => console.log('Catalogue Pro')}
        >
          <View style={[styles.iconContainer, { backgroundColor: '#f3e5f5' }]}>
            <Ionicons name="card" size={24} color="#7b1fa2" />
          </View>
          <Text style={styles.cardTitle}>Catalogue Pro</Text>
          <Text style={styles.cardDescription}>
            Accès aux produits réservés aux professionnels
          </Text>
          <Text style={styles.cardButton}>Voir →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  cardsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    lineHeight: 16,
  },
  cardButton: {
    fontSize: 14,
    color: '#ff6a00',
    fontWeight: '600',
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
