// apps/mobile/src/components/account/OrderSection.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOrders } from '../../contexts/OrderContext';
import { COLORS } from '../../constants/Theme'; // IMPORTATION
import { ORDER_STATUS_CONFIG } from '../../constants/Config'; // IMPORTATION

export default function OrderSection() {
  const router = useRouter();
  const { getOrdersCountByStatus, orders } = useOrders();
  const orderCounts = getOrdersCountByStatus();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes Commandes</Text>
        {orders.length > 0 && (
          <TouchableOpacity onPress={() => router.push('/orders')}>
            <Text style={styles.seeAllText}>Tout voir</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.statusGrid}>
        {/* On boucle sur la config centrale plutôt que sur un tableau en dur */}
        {Object.entries(ORDER_STATUS_CONFIG).map(([key, config]) => {
          const count = orderCounts[key as keyof typeof orderCounts] || 0;
          return (
            <TouchableOpacity 
              key={key} 
              style={styles.statusItem}
              onPress={() => router.push(`/orders?status=${key}`)}
            >
              <View style={styles.iconWrapper}>
                <Ionicons name={config.icon} size={24} color={config.color} />
                {count > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{count}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.statusLabel}>{config.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.white, margin: 12, borderRadius: 12, padding: 16, elevation: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  statusGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  statusItem: { alignItems: 'center', flex: 1 },
  iconWrapper: { position: 'relative', marginBottom: 8 },
  countBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: COLORS.danger, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  countText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  statusLabel: { fontSize: 11, color: COLORS.textLight, textAlign: 'center' },
  seeAllText: { color: COLORS.textLight, fontSize: 14 }
});