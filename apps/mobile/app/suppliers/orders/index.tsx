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
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

/** Évite de synchroniser des milliers de commandes (très lent + coûteux). Ajuster / pagination plus tard. */
const ORDERS_PAGE_LIMIT = 150;
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { fr } from 'date-fns/locale/fr';
import { format } from 'date-fns';

type OrderStatus = 'paid' | 'pending' | 'processing' | 'shipped' | 'delivered';
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
  userName?: string;
  total: number;
  status: OrderStatus;
  paymentStatus?: string;
  createdAt: Date;
  items: OrderItem[];
  sellerId: string;
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
}

const statusConfig = {
  paid: { 
    color: '#2563EB', 
    bgColor: '#DBEAFE', 
    label: 'À préparer', 
    icon: 'card-outline' 
  },
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

/**
 * Fonction utilitaire pour extraire proprement l'adresse et le nom du client
 * peu importe le format de sauvegarde dans Firestore.
 */
const parseOrderDocument = (doc: any, currentUserId: string): Order => {
  const data = doc.data();

  // 1. Récupération brute de l'adresse (shippingAddress, address ou deliveryAddress)
  const rawAddress = data.shippingAddress || data.address || data.deliveryAddress || null;

  // 2. Résolution du nom du client
  const resolvedName =
    data.userName ||
    data.clientName ||
    data.customerName ||
    (typeof rawAddress === 'object' && rawAddress ? rawAddress.fullName || rawAddress.name : '') ||
    'Client inconnu';

  // 3. Résolution du téléphone du client
  const resolvedPhone =
    data.userPhone ||
    data.clientPhone ||
    (typeof rawAddress === 'object' && rawAddress ? rawAddress.phone || rawAddress.telephone || rawAddress.mobile : '') ||
    '';

  // 4. Mappage de l'adresse de livraison
  let shippingAddressObj: Order['shippingAddress'] = undefined;

  if (typeof rawAddress === 'string') {
    shippingAddressObj = {
      fullName: resolvedName,
      phone: resolvedPhone,
      street: rawAddress,
    };
  } else if (rawAddress && typeof rawAddress === 'object') {
    shippingAddressObj = {
      fullName: rawAddress.fullName || rawAddress.name || resolvedName,
      phone: rawAddress.phone || rawAddress.telephone || rawAddress.mobile || resolvedPhone,
      street: rawAddress.street || rawAddress.addressLine1 || rawAddress.address || rawAddress.fullAddress || '',
      city: rawAddress.city || rawAddress.town || rawAddress.district || rawAddress.commune || '',
      postalCode: rawAddress.postalCode || rawAddress.zip || rawAddress.postal_code || '',
      country: rawAddress.country || rawAddress.countryCode || '',
    };
  }

  const resolvedSellerId = data.sellerId ?? (Array.isArray(data.sellerIds) ? data.sellerIds.find((value: string) => value === currentUserId) : undefined);
  const resolvedStatus = data.status || data.paymentStatus || 'paid';
  const effectiveStatus = resolvedStatus === 'paid' || data.paymentStatus === 'paid' ? 'paid' : resolvedStatus;

  return {
    id: doc.id,
    ...data,
    sellerId: resolvedSellerId || data.sellerId || currentUserId,
    status: effectiveStatus,
    paymentStatus: data.paymentStatus || (effectiveStatus === 'paid' ? 'paid' : undefined),
    userName: resolvedName,
    shippingAddress: shippingAddressObj,
    createdAt: data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : new Date()),
  } as Order;
};

export default function SupplierOrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');

  const getEffectiveStatus = (order: Order): OrderStatus => {
    if (order.status === 'paid' || order.paymentStatus === 'paid') {
      return 'paid';
    }
    return order.status;
  };

  const isPaidOrder = (order: Order) => getEffectiveStatus(order) === 'paid';

  // Récupération des commandes en temps réel
  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    const ordersRef = collection(db, 'orders');
    const qSellerId = query(
      ordersRef,
      where('sellerId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(ORDERS_PAGE_LIMIT)
    );
    const qSellerIds = query(
      ordersRef,
      where('sellerIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc'),
      limit(ORDERS_PAGE_LIMIT)
    );

    let latestA: Order[] = [];
    let latestB: Order[] = [];

    const mergeAndSet = () => {
      const byId = new Map<string, Order>();
      [...latestA, ...latestB].forEach((o) => byId.set(o.id, o));
      const merged = Array.from(byId.values()).sort(
        (a, b) => (b.createdAt?.getTime?.() || 0) - (a.createdAt?.getTime?.() || 0)
      );
      setOrders(merged);
      setLoading(false);
      setRefreshing(false);
    };

    const unsubA = onSnapshot(
      qSellerId,
      (snapshot) => {
        latestA = snapshot.docs.map((doc) => parseOrderDocument(doc, user.uid));
        mergeAndSet();
      },
      (error) => {
        console.error('Erreur lors du chargement des commandes (sellerId):', error);
        Alert.alert('Erreur', 'Impossible de charger les commandes');
        setLoading(false);
        setRefreshing(false);
      }
    );

    const unsubB = onSnapshot(
      qSellerIds,
      (snapshot) => {
        latestB = snapshot.docs.map((doc) => parseOrderDocument(doc, user.uid));
        mergeAndSet();
      },
      (error) => {
        console.error('Erreur lors du chargement des commandes (sellerIds):', error);
      }
    );

    return () => {
      unsubA();
      unsubB();
    };
  }, [user]);

  // Filtrage des commandes selon l'onglet actif
  useEffect(() => {
    let filtered: Order[] = [];

    switch (activeTab) {
      case 'pending':
        filtered = orders.filter((order) => isPaidOrder(order));
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
  
  // SYSTEME DE NETTOYAGE D'IMAGE
  const getCleanImage = (item: any) => {
    if (!item) return null;
    let uri = item.image || item.imageUrl || item.photoURL;
    if (!uri || typeof uri !== 'string') return null;

    try {
      let clean = uri.trim().replace(/[\s\u0000-\u001F\u007F-\u009F\uFEFF]+/g, '');
      if (clean.includes('/products/') && !clean.includes('products%2F')) {
        clean = clean.replace('/products/', '/products%2F');
      }
      return clean;
    } catch (e) {
      return uri;
    }
  };

  const renderOrderCard = ({ item }: { item: Order }) => {
    const displayStatus = getEffectiveStatus(item);
    const statusInfo = statusConfig[displayStatus] || statusConfig.pending;
    const firstItem = item.items && item.items[0];
    const cleanUri = getCleanImage(firstItem);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleOrderPress(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={styles.imageContainer}>
            {cleanUri ? (
              <Image 
                source={{ uri: cleanUri }} 
                style={styles.image} 
                resizeMode="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={24} color="#9CA3AF" />
              </View>
            )}
          </View>

          <View style={styles.orderInfo}>
            <View style={styles.headerRow}>
              <Text style={styles.orderId}>Commande #{item.id.slice(-6).toUpperCase()}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                <Ionicons name={statusInfo.icon as any} size={12} color={statusInfo.color} />
                <Text style={[styles.statusText, { color: statusInfo.color }]}>
                  {statusInfo.label}
                </Text>
              </View>
            </View>

            <Text style={styles.customerName}>
              {item.shippingAddress?.fullName || item.userName || 'Client inconnu'}
            </Text>
            
            <View style={styles.itemsPreview}>
              <Ionicons name="cube-outline" size={14} color="#6B7280" />
              <Text style={styles.itemsText} numberOfLines={1}>
                {item.items ? item.items.map((i) => i.name).join(', ') : 'Aucun produit'}
              </Text>
            </View>

            <View style={styles.footerRow}>
              <View style={styles.dateContainer}>
                <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
                <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text style={styles.totalAmount}>{formatPrice(item.total)}</Text>
            </View>
          </View>
        </View>

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
        {activeTab === 'pending' && "Aucune commande payée à préparer"}
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

  const pendingCount = orders.filter((o) => isPaidOrder(o)).length;

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
          {pendingCount > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pendingCount}</Text>
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
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#EFF6FF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#3B82F6',
  },
  tabBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginRight: 12,
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
  },
  orderInfo: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  customerName: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
    marginBottom: 6,
  },
  itemsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemsText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
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
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  chevronContainer: {
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
});