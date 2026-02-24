// app/orders/index.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
  Animated
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOrders } from '../../src/contexts/OrderContext';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;

const COLORS = {
  primary: '#FF6A00',
  primaryGradient: ['#FF6A00', '#FF8C42'],
  background: '#F8F9FA',
  cardBg: '#FFFFFF',
  text: {
    primary: '#1A1A1A',
    secondary: '#666666',
    tertiary: '#999999',
    white: '#FFFFFF'
  },
  status: {
    pending: '#FF9500',
    confirmed: '#007AFF',
    shipped: '#34C759',
    delivered: '#30D158',
    cancelled: '#FF3B30'
  },
  gradient: {
    gold: ['#FFD700', '#FFA500'],
    silver: ['#C0C0C0', '#A9A9A9'],
    bronze: ['#CD7F32', '#8B4513']
  }
};

const statusConfig = {
  pending: {
    label: 'En attente',
    color: COLORS.status.pending,
    icon: 'hourglass-outline',
    bgColor: 'rgba(255, 149, 0, 0.1)'
  },
  confirmed: {
    label: 'Confirmée',
    color: COLORS.status.confirmed,
    icon: 'checkmark-circle-outline',
    bgColor: 'rgba(0, 122, 255, 0.1)'
  },
  shipped: {
    label: 'Expédiée',
    color: COLORS.status.shipped,
    icon: 'airplane-outline',
    bgColor: 'rgba(52, 199, 89, 0.1)'
  },
  delivered: {
    label: 'Livrée',
    color: COLORS.status.delivered,
    icon: 'checkmark-done-circle-outline',
    bgColor: 'rgba(48, 209, 88, 0.1)'
  },
  cancelled: {
    label: 'Annulée',
    color: COLORS.status.cancelled,
    icon: 'close-circle-outline',
    bgColor: 'rgba(255, 59, 48, 0.1)'
  }
};

const OrderCard = ({ order, onPress }: any) => {
  const statusInfo = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending;
  const firstItem = order.items && order.items.length > 0 ? order.items[0] : null;
  const itemCount = order.items?.length || 0;

  const formatPrice = (price: number | undefined | null) => {
    if (!price && price !== 0) return "—";
    return price.toLocaleString("fr-FR") + " FCFA";
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <TouchableOpacity 
      style={styles.orderCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      {/* Header avec dégradé */}
      <LinearGradient
        colors={COLORS.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.orderHeader}
      >
        <View style={styles.orderHeaderContent}>
          <View style={styles.orderIdContainer}>
            <Ionicons name="receipt-outline" size={16} color="#FFFFFF" />
            <Text style={styles.orderId}>Commande #{order.id.slice(-8).toUpperCase()}</Text>
          </View>
          <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
        </View>
      </LinearGradient>

      {/* Contenu de la commande */}
      <View style={styles.orderContent}>
        {/* Statut */}
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
          <Ionicons name={statusInfo.icon as any} size={16} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>

        {/* Détails des articles */}
        <View style={styles.itemsSection}>
          <View style={styles.itemsHeader}>
            <Text style={styles.itemsCount}>
              {itemCount} article{itemCount > 1 ? 's' : ''}
            </Text>
            <Text style={styles.totalPrice}>{formatPrice(order.total)}</Text>
          </View>

          {/* Preview des produits */}
          {firstItem && (
            <View style={styles.productPreview}>
              {firstItem.image ? (
                <Image 
                  source={{ uri: firstItem.image }} 
                  style={styles.productImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.productImagePlaceholder}>
                  <Ionicons name="cube-outline" size={20} color="#999" />
                </View>
              )}
              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {firstItem.name}
                </Text>
                <Text style={styles.productQuantity}>
                  Quantité: {firstItem.quantity || 1}
                </Text>
              </View>
              {itemCount > 1 && (
                <View style={styles.moreItems}>
                  <Text style={styles.moreItemsText}>+{itemCount - 1}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          {order.status === 'delivered' && (
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="star-outline" size={16} color={COLORS.primary} />
              <Text style={styles.actionText}>Noter</Text>
            </TouchableOpacity>
          )}
          
          {order.status === 'pending' && (
            <TouchableOpacity style={[styles.actionButton, styles.cancelButton]}>
              <Ionicons name="close-circle-outline" size={16} color={COLORS.status.cancelled} />
              <Text style={[styles.actionText, { color: COLORS.status.cancelled }]}>
                Annuler
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.detailsButton}>
            <Text style={styles.detailsText}>Voir détails</Text>
            <Feather name="chevron-right" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function OrdersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { orders, loading } = useOrders();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(
    (params.status as string) || null
  );

  const filteredOrders = selectedStatus
    ? orders.filter(o => o.status === selectedStatus)
    : orders;

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleOrderPress = (orderId: string) => {
    router.push(`/orders/${orderId}`);
  };

  const getOrdersCountByStatus = (status: string) => {
    return orders.filter(order => order.status === status).length;
  };

  const getTotalSpent = () => {
    return orders
      .filter(order => order.status === 'delivered')
      .reduce((sum, order) => sum + (order.total || 0), 0)
      .toLocaleString("fr-FR") + " FCFA";
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
      {/* Header avec dégradé */}
      <LinearGradient
        colors={['#FF6A00', '#FF8C42']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mes Commandes</Text>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="filter-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="receipt-outline" size={24} color="#FFFFFF" />
            <Text style={styles.statValue}>{orders.length}</Text>
            <Text style={styles.statLabel}>Commandes</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cart-outline" size={24} color="#FFFFFF" />
            <Text style={styles.statValue}>
              {orders.filter(o => o.status === 'delivered').length}
            </Text>
            <Text style={styles.statLabel}>Livrées</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="wallet-outline" size={24} color="#FFFFFF" />
            <Text style={styles.statValue}>{getTotalSpent()}</Text>
            <Text style={styles.statLabel}>Total dépensé</Text>
          </View>
        </View>
      </LinearGradient>

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
          <Ionicons 
            name="apps-outline" 
            size={16} 
            color={!selectedStatus ? "#FFFFFF" : COLORS.text.secondary} 
          />
          <Text style={[
            styles.filterText,
            !selectedStatus && styles.filterTextActive
          ]}>
            Toutes ({orders.length})
          </Text>
        </TouchableOpacity>

        {Object.entries(statusConfig).map(([status, config]) => {
          const count = getOrdersCountByStatus(status);
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                selectedStatus === status && styles.filterButtonActive,
                { borderColor: config.color + '40' }
              ]}
              onPress={() => setSelectedStatus(status)}
            >
              <Ionicons 
                name={config.icon as any} 
                size={16} 
                color={selectedStatus === status ? "#FFFFFF" : config.color} 
              />
              <Text style={[
                styles.filterText,
                selectedStatus === status && styles.filterTextActive,
                !selectedStatus && { color: config.color }
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
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.ordersListContent}
      >
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons 
                name="receipt-outline" 
                size={80} 
                color="#E0E0E0" 
              />
              <View style={styles.emptyIconCircle}>
                <Ionicons name="search-outline" size={24} color="#999" />
              </View>
            </View>
            <Text style={styles.emptyTitle}>
              {selectedStatus ? 'Aucune commande trouvée' : 'Aucune commande'}
            </Text>
            <Text style={styles.emptyText}>
              {selectedStatus 
                ? `Vous n'avez pas de commande avec le statut "${statusConfig[selectedStatus as keyof typeof statusConfig]?.label}"`
                : 'Commencez vos achats et vos commandes apparaîtront ici'
              }
            </Text>
            {selectedStatus ? (
              <TouchableOpacity
                style={styles.resetFilterButton}
                onPress={() => setSelectedStatus(null)}
              >
                <Text style={styles.resetFilterText}>Voir toutes les commandes</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.shopButton}
                onPress={() => router.push('/')}
              >
                <Ionicons name="cart-outline" size={18} color="#FFFFFF" />
                <Text style={styles.shopButtonText}>Découvrir les produits</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <View style={styles.ordersHeader}>
              <Text style={styles.ordersCount}>
                {filteredOrders.length} commande{filteredOrders.length > 1 ? 's' : ''}
              </Text>
              <TouchableOpacity style={styles.sortButton}>
                <Ionicons name="swap-vertical-outline" size={16} color={COLORS.text.secondary} />
                <Text style={styles.sortText}>Trier</Text>
              </TouchableOpacity>
            </View>
            
            {filteredOrders.map((order) => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onPress={() => handleOrderPress(order.id)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Bouton d'aide flottant */}
      <TouchableOpacity style={styles.helpButton}>
        <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFFFFF" />
      </TouchableOpacity>
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
    marginTop: 16,
    fontSize: 16,
    color: COLORS.text.secondary,
    fontFamily: 'System',
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'System',
    letterSpacing: 0.5,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  statCard: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
    fontFamily: 'System',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    fontFamily: 'System',
  },
  filtersContainer: {
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginTop: -10,
    zIndex: 1,
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: COLORS.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: '600',
    fontFamily: 'System',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  ordersList: {
    flex: 1,
  },
  ordersListContent: {
    padding: 16,
    paddingBottom: 32,
  },
  ordersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  ordersCount: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    fontFamily: 'System',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderRadius: 16,
  },
  sortText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontFamily: 'System',
  },
  orderCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  orderHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  orderHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'System',
  },
  orderDate: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: 'System',
  },
  orderContent: {
    padding: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'System',
  },
  itemsSection: {
    marginBottom: 16,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemsCount: {
    fontSize: 14,
    color: COLORS.text.secondary,
    fontFamily: 'System',
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: 'System',
  },
  productPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
  },
  productImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 4,
    fontFamily: 'System',
  },
  productQuantity: {
    fontSize: 13,
    color: COLORS.text.tertiary,
    fontFamily: 'System',
  },
  moreItems: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 106, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreItemsText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: 'System',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    fontFamily: 'System',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    fontFamily: 'System',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  emptyIconCircle: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'System',
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: 'System',
  },
  resetFilterButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
  },
  resetFilterText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'System',
  },
  shopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shopButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'System',
  },
  helpButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});