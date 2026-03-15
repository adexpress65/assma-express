import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const orderStatuses = [
  { icon: 'card-outline', label: 'À payer', count: 0 },
  { icon: 'cube-outline', label: 'À expédier', count: 0 },
  { icon: 'car-outline', label: 'Expédié', count: 1 },
  { icon: 'star-outline', label: 'À évaluer', count: 4 },
  { icon: 'refresh-circle-outline', label: 'Retour', count: 0 },
];

export default function OrderSection() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes Commandes</Text>
        <TouchableOpacity style={styles.seeAllButton}>
          <Text style={styles.seeAllText}>Tout voir</Text>
          <Ionicons name="chevron-forward" size={16} color="#666" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.statusGrid}>
        {orderStatuses.map((status, index) => (
          <TouchableOpacity key={index} style={styles.statusItem}>
            <View style={styles.iconWrapper}>
              <Ionicons 
                name={status.icon as any} 
                size={24} 
                color="#FF6B00" 
              />
              {status.count > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{status.count}</Text>
                </View>
              )}
            </View>
            <Text style={styles.statusLabel}>{status.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    color: '#666',
    fontSize: 14,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    position: 'relative',
    marginBottom: 8,
  },
  countBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
