// apps/mobile/app/suppliers/orders/index.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { fr } from 'date-fns/locale/fr';


type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered';
type FilterTab = 'pending' | 'processing' | 'history';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}

interface Order {
  id: string;
  userName: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  items: OrderItem[];
  sellerId: string;
}

const statusConfig = {
  pending: { 
    color: '#F59E0B', 
    bgColor: '#FEF3C7', 
    label: 'À préparer', 
    icon: 'time-outline' 
  },
  processing: { 
    color: '#3B82F6', 
    bgColor: '#DBEAFE', 
    label: 'En cours', 
    icon: 'cog-outline' 
  },
  shipped: { 
    color: '#8B5CF6', 
    bgColor: '#EDE9FE', 
    label: 'Expédié', 
    icon: 'cube-outline' 
  },
  delivered: { 
    color: '#10B981', 
    bgColor: '#D1FAE5', 
    label: 'Livré', 
    icon: 'checkmark-circle-outline' 
  },
};

export default function SupplierOrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');

  // Récupération des commandes en temps réel
  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    const ordersRef = collection(db, 'orders');
    const q = query(
      ordersRef,
      where('sellerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const ordersList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as Order[];

        setOrders(ordersList);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error('Erreur lors du chargement des commandes:', error);
        Alert.alert('Erreur', 'Impossible de charger les commandes');
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Filtrage des commandes selon l'onglet actif
  useEffect(() => {
    let filtered: Order[] = [];

    switch (activeTab) {
      case 'pending':
        filtered = orders.filter((order) => order.status === 'pending');
        break;
      case 'processing':
        filtered = orders.filter((order) => order.status === 'processing');
        break;
      case 'history':
        filtered = orders.filter(
          (order) => order.status === 'shipped' || order.status === 'delivered'
        );
        break;
    }

    setFilteredOrders(filtered);
  }, [orders, activeTab]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
  }, []);

  const handleOrderPress = (orderId: string) => {
    router.push(`/suppliers/orders/${orderId}`);
  };

  const formatDate = (date: Date) => {
    return format(date, 'dd MMM yyyy • HH:mm', { locale: fr });
  };

  const formatPrice = (price: number) => {
    return `${price.toLocaleString()} XOF`;
  };

  const renderOrderCard = ({ item }: { item: Order }) => {
    const statusInfo = statusConfig[item.status];
    const firstItem = item.items[0];

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleOrderPress(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          {/* Image du premier article */}
          <View style={styles.imageContainer}>
            {firstItem?.imageUrl ? (
              <Image source={{ uri: firstItem.imageUrl }} style={styles.image} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={24} color="#9CA3AF" />
              </View>
            )}
          </View>

          {/* Informations de la commande */}
          <View style={styles.orderInfo}>
            <View style={styles.headerRow}>
              <Text style={styles.orderId}>Commande #{item.id.slice(-6)}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                <Ionicons name={statusInfo.icon as any} size={12} color={statusInfo.color} />
                <Text style={[styles.statusText, { color: statusInfo.color }]}>
                  {statusInfo.label}
                </Text>
              </View>
            </View>

            <Text style={styles.customerName}>{item.userName}</Text>
            
            <View style={styles.itemsPreview}>
              <Ionicons name="cube-outline" size={14} color="#6B7280" />
              <Text style={styles.itemsText} numberOfLines={1}>
                {item.items.map((i) => i.name).join(', ')}
              </Text>
            </View>

            <View style={styles.footerRow}>
              <View style={styles.dateContainer}>
                <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
                <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text style={styles.totalAmount}>{formatPrice(item.totalAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Indicateur de navigation */}
        <View style={styles.chevronContainer}>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="bag-handle-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyStateTitle}>Aucune commande</Text>
      <Text style={styles.emptyStateText}>
        {activeTab === 'pending' && "Vous n'avez pas de commande à préparer"}
        {activeTab === 'processing' && "Aucune commande en cours de traitement"}
        {activeTab === 'history' && "Aucune commande dans l'historique"}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Chargement des commandes...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Commandes</Text>
        <Text style={styles.headerSubtitle}>
          {filteredOrders.length} commande{filteredOrders.length > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Tabs de filtrage */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Ionicons
            name="time"
            size={18}
            color={activeTab === 'pending' ? '#3B82F6' : '#9CA3AF'}
          />
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            À préparer
          </Text>
          {orders.filter((o) => o.status === 'pending').length > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>
                {orders.filter((o) => o.status === 'pending').length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'processing' && styles.activeTab]}
          onPress={() => setActiveTab('processing')}
        >
          <Ionicons
            name="cog"
            size={18}
            color={activeTab === 'processing' ? '#3B82F6' : '#9CA3AF'}
          />
          <Text style={[styles.tabText, activeTab === 'processing' && styles.activeTabText]}>
            En cours
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Ionicons
            name="archive"
            size={18}
            color={activeTab === 'history' ? '#3B82F6' : '#9CA3AF'}
          />
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            Historique
          </Text>
        </TouchableOpacity>
      </View>

      {/* Liste des commandes */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  activeTab: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
  },
  tabBadge: {
    marginLeft: 6,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
  },
  imageContainer: {
    width: 70,
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  orderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '500',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  itemsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemsText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    marginLeft: 4,
    fontSize: 11,
    color: '#9CA3AF',
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  chevronContainer: {
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});