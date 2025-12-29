// src/components/SellerCard.tsx - VERSION CORRIGÉE
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Seller {
  id: string;
  name: string;
  logo: string;
  type: string;
  rating: number;
  yearsOnPlatform: number;
  country: string;
  responseTime: string;
  deliveryRate: number;
  verified?: boolean;
  location?: string;
  totalOrders?: number;
  goldSupplier?: boolean;
}

interface SellerCardProps {
  seller: Seller;
  onPress: () => void;
}

export default function SellerCard({ seller, onPress }: SellerCardProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.header}>
        <Image source={{ uri: seller.logo }} style={styles.logo} />
        <View style={styles.sellerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.sellerName} numberOfLines={1}>
              {seller.name}
            </Text>
            {seller.verified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✅ Vérifié</Text>
              </View>
            )}
            {seller.goldSupplier && (
              <View style={styles.goldBadge}>
                <Text style={styles.goldText}>🥇 Gold</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.sellerType}>{seller.type}</Text>
          <Text style={styles.sellerLocation}>
            📍 {seller.location || seller.country}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{seller.rating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Note</Text>
        </View>
        
        <View style={styles.stat}>
          <Text style={styles.statValue}>{seller.yearsOnPlatform}</Text>
          <Text style={styles.statLabel}>Ans</Text>
        </View>
        
        <View style={styles.stat}>
          <Text style={styles.statValue}>{seller.responseTime}</Text>
          <Text style={styles.statLabel}>Réponse</Text>
        </View>
        
        <View style={styles.stat}>
          <Text style={styles.statValue}>{seller.deliveryRate}%</Text>
          <Text style={styles.statLabel}>Livraison</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.contactButton}>
          <Ionicons name="chatbubble-outline" size={16} color="#007AFF" />
          <Text style={styles.contactText}>Contacter</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.viewButton}>
          <Text style={styles.viewText}>Voir l'entreprise</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  sellerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  sellerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginRight: 8,
    flex: 1,
  },
  verifiedBadge: {
    backgroundColor: '#e7f7ef',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  verifiedText: {
    fontSize: 10,
    color: '#00a650',
    fontWeight: '600',
  },
  goldBadge: {
    backgroundColor: '#fff8e6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  goldText: {
    fontSize: 10,
    color: '#ffa500',
    fontWeight: '600',
  },
  sellerType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  sellerLocation: {
    fontSize: 14,
    color: '#666',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    marginBottom: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 6,
    gap: 6,
  },
  contactText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  viewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  viewText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});