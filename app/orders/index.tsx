// app/orders/index.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOrders } from '../../src/contexts/OrderContext';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#FF6A00',
  primaryLight: '#FFF0E6',
  background: '#F8F9FA',
  text: '#2D3748',
  textLight: '#718096',
  border: '#E2E8F0',
  white: '#FFFFFF',
  success: '#28A745',
  warning: '#FFC107',
  danger: '#DC3545'
};

const statusConfig = {
  pending: { label: 'En attente', color: COLORS.warning, icon: 'time-outline' as const },
  confirmed: { label: 'Confirmée', color: COLORS.primary, icon: 'checkmark-circle-outline' as const },
  shipped: { label: 'Expédiée', color: COLORS.success, icon: 'car-outline' as const },
  delivered: { label: 'Livrée', color: COLORS.success, icon: 'checkmark-done-outline' as const },
  cancelled: { label: 'Annulée', color: COLORS.danger, icon: 'close-circle-outline' as const }
};

export default function OrdersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { orders, loading, getOrdersByStatus } = useOrders();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(
    (params.status as string) || null
  );

  const filteredOrders = selectedStatus 
    ? getOrdersByStatus(selectedStatus as any)
    : orders;

  const onRefresh = async () => {
    setRefreshing(true);
    // La synchronisation se fait automatiquement via Firestore
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleOrderPress = (orderId: string) => {
    router.push(`/orders/${orderId}`);
  };

  const getStatusInfo = (status: string) => {
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement des commandes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Commandes</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Filtres de statut */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        <TouchableOpacity
          style={[
            styles.filterButton,
            !selectedStatus && styles.filterButtonActive
          ]}
          onPress={() => setSelectedStatus(null)}
        >
          <Text style={[
            styles.filterText,
            !selectedStatus && styles.filterTextActive
          ]}>
            Toutes ({orders.length})
          </Text>
        </TouchableOpacity>

        {Object.entries(statusConfig).map(([status, config]) => {
          const count = getOrdersByStatus(status as any).length;
          if (count === 0) return null;
          
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                selectedStatus === status && styles.filterButtonActive
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text style={[
                styles.filterText,
                selectedStatus === status && styles.filterTextActive
              ]}>
                {config.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Liste des commandes */}
      <ScrollView
        style={styles.ordersList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons 
              name="receipt-outline" 
              size={64} 
              color={COLORS.textLight} 
            />
            <Text style={styles.emptyTitle}>
              {selectedStatus ? 'Aucune commande' : 'Aucune commande'}
            </Text>
            <Text style={styles.emptyText}>
              {selectedStatus 
                ? `Aucune commande avec le statut "${statusConfig[selectedStatus as keyof typeof statusConfig]?.label}"`
                : 'Vos commandes apparaîtront ici'
              }
            </Text>
            {selectedStatus && (
              <TouchableOpacity
                style={styles.resetFilterButton}
                onPress={() => setSelectedStatus(null)}
              >
                <Text style={styles.resetFilterText}>Voir toutes les commandes</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredOrders.map((order) => {
            const statusInfo = getStatusInfo(order.status);
            const firstItem = order.items[0];
            
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => handleOrderPress(order.id)}
              >
                <View style={styles.orderHeader}>
                  <View>
                    <Text style={styles.orderId}>Commande #{order.id.slice(-8).toUpperCase()}</Text>
                    <Text style={styles.orderDate}>
                      {formatDate(order.createdAt)}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: `${statusInfo.color}20` }
                  ]}>
                    <Ionicons 
                      name={statusInfo.icon} 
                      size={14} 
                      color={statusInfo.color} 
                    />
                    <Text style={[styles.statusText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderContent}>
                  <View style={styles.itemsPreview}>
                    <Text style={styles.itemsText}>
                      {order.items.length} article{order.items.length > 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.totalText}>
                      {order.total.toLocaleString()} FCFA
                    </Text>
                  </View>

                  {firstItem && (
                    <View style={styles.firstItem}>
                      <Ionicons name="cube-outline" size={16} color={COLORS.textLight} />
                      <Text style={styles.firstItemText} numberOfLines={1}>
                        {firstItem.name}
                        {order.items.length > 1 && ` + ${order.items.length - 1} autre(s)`}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.orderFooter}>
                  <Text style={styles.shippingText}>
                    {order.shipping.method} • {order.shipping.deliveryTime}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerRight: {
    width: 32,
  },
  filtersContainer: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  filterTextActive: {
    color: COLORS.white,
  },
  ordersList: {
    flex: 1,
    padding: 16,
  },
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderContent: {
    marginBottom: 12,
  },
  itemsPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemsText: {
    fontSize: 14,
    color: COLORS.text,
  },
  totalText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  firstItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  firstItemText: {
    fontSize: 14,
    color: COLORS.textLight,
    flex: 1,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  shippingText: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
  resetFilterButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  resetFilterText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
});