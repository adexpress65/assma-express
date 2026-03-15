// components/TrustBadges.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TrustBadges() {
  const badges = [
    { icon: 'shield-check-outline', text: 'Paiement Sécurisé' },
    { icon: 'airplane-outline', text: 'Fret Assuré' },
    { icon: 'business-outline', text: 'Vendeur Vérifié' },
  ];

  return (
    <View style={styles.container}>
      {badges.map((b, i) => (
        <View key={i} style={styles.badge}>
          <Ionicons name={b.icon as any} size={14} color="#00B517" />
          <Text style={styles.text}>{b.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingVertical: 12, 
    backgroundColor: '#F9FFF9', // Vert très pâle AliExpress
    borderBottomWidth: 1,
    borderBottomColor: '#E6F4E6'
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: { fontSize: 11, color: '#00B517', fontWeight: '600' }
});
