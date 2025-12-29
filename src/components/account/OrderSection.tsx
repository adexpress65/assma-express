// src/components/account/OrderSection.tsx - VERSION SYNCHRONISÉE
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOrders } from '../../contexts/OrderContext';

const statusConfig = [
  { 
    icon: 'card-outline', 
    label: 'À payer', 
    status: 'pending' as const,
    color: '#FF6B00'
  },
  { 
    icon: 'cube-outline', 
    label: 'À expédier', 
    status: 'confirmed' as const,
    color: '#FF6B00'
  },
  { 
    icon: 'car-outline', 
    label: 'Expédié', 
    status: 'shipped' as const,
    color: '#FF6B00'
  },
  { 
    icon: 'checkmark-done-outline', 
    label: 'Livré', 
    status: 'delivered' as const,
    color: '#FF6B00'
  },
  { 
    icon: 'refresh-circle-outline', 
    label: 'Retour', 
    status: 'cancelled' as const,
    color: '#FF6B00'
  },
];

export default function OrderSection() {
  const router = useRouter();
  const { getOrdersCountByStatus, orders } = useOrders();
  const orderCounts = getOrdersCountByStatus();

  const getCountForStatus = (status: string) => {
    return orderCounts[status as keyof typeof orderCounts] || 0;
  };

  const handleStatusPress = (status: string) => {
    router.push(`/orders?status=${status}`);
  };

  const handleSeeAll = () => {
    router.push('/orders');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes Commandes</Text>
        {orders.length > 0 && (
          <TouchableOpacity style={styles.seeAllButton} onPress={handleSeeAll}>
            <Text style={styles.seeAllText}>Tout voir</Text>
            <Ionicons name="chevron-forward" size={16} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={48} color="#CCC" />
          <Text style={styles.emptyText}>Aucune commande</Text>
          <Text style={styles.emptySubtext}>Vos commandes apparaîtront ici</Text>
        </View>
      ) : (
        <View style={styles.statusGrid}>
          {statusConfig.map((status, index) => {
            const count = getCountForStatus(status.status);
            return (
              <TouchableOpacity 
                key={index} 
                style={styles.statusItem}
                onPress={() => handleStatusPress(status.status)}
              >
                <View style={styles.iconWrapper}>
                  <Ionicons 
                    name={status.icon as any} 
                    size={24} 
                    color={status.color} 
                  />
                  {count > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{count}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.statusLabel}>{status.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
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
    paddingHorizontal: 4,
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});