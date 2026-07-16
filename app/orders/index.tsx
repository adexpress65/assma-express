import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
  UIManager,
  SafeAreaView,
  Animated,
  Alert
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useOrders } from '../../src/contexts/OrderContext';
import { Ionicons, Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// IMPORTATION DES CONSTANTES CENTRALISÉES
import { COLORS } from '../../src/constants/Theme';
import { ORDER_STATUS_CONFIG, APP_CONFIG } from '../../src/constants/Config';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// --- UTILITAIRES DE FORMATAGE ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR').format(amount || 0) + ` ${APP_CONFIG.currency}`;
};

const formatOrderDate = (dateData: any) => {
  if (!dateData) return "Récemment";
  const d = dateData.toDate ? dateData.toDate() : new Date(dateData);
  return isNaN(d.getTime()) ? "Date invalide" : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

// --- COMPOSANT : Carte de commande individuelle ---
const OrderCard = ({ order, onPress, onDelete }: any) => {
  const statusInfo = ORDER_STATUS_CONFIG[order.status as keyof typeof ORDER_STATUS_CONFIG] || ORDER_STATUS_CONFIG.pending;
  
  // Autoriser la suppression pour les commandes terminées ou annulées
  const canDelete = ['delivered', 'cancelled', 'failed'].includes(order.status?.toLowerCase());

  if (!order.items || order.items.length === 0) return null;

  const firstItem = order.items[0];
  const productName = firstItem.name || firstItem.productName || firstItem.title || `Commande #${order.id.slice(-5)}`;

  const imageUri = useMemo(() => {
    const item = order.items?.[0];
    if (!item) return null;

    let uri = item.image || item.imageUrl || item.photoURL || item.photos?.[0];
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
  }, [order.items]);

  return (
    <Animated.View style={{ marginBottom: 16 }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.orderCard}>
        <LinearGradient colors={COLORS.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cardHeader}>
          <Text style={styles.orderId}>{order.orderId || `ORD-${order.id.slice(-6).toUpperCase()}`}</Text>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={styles.orderDate}>{formatOrderDate(order.createdAt)}</Text>
            {canDelete && (
              <TouchableOpacity 
                onPress={(e) => {
                  e.stopPropagation(); // Évite d'ouvrir les détails de la commande
                  onDelete(order.id);
                }}
                style={styles.deleteMiniBtn}
              >
                <Ionicons name="trash-outline" size={16} color={COLORS.white} />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        <View style={styles.orderContent}>
          <View style={styles.productPreview}>
            <View style={styles.imageContainer}>
                {imageUri ? (
                  <Image 
                    key={imageUri}
                    source={{ uri: imageUri }} 
                    style={styles.productImage} 
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={300}
                    backgroundColor="#F0F0F0"
                  />
                ) : (
                  <View style={styles.placeholderIcon}>
                    <Ionicons name="image-outline" size={24} color={COLORS.border} />
                  </View>
                )}
            </View>
            
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={1}>{productName}</Text>
              <Text style={styles.totalPrice}>{formatCurrency(order.total)}</Text>
              
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor, marginTop: 8 }]}>
                <Ionicons name={statusInfo.icon} size={12} color={statusInfo.color} />
                <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={COLORS.border} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// --- COMPOSANT PRINCIPAL : Liste des commandes ---
export default function OrdersScreen() {
  const router = useRouter();
  const { orders, loading, refreshOrders, deleteOrder } = useOrders() as any;
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filteredOrders = useMemo(() => {
    if (!selectedStatus) return orders;
    return orders.filter((o: any) => 
      o.status?.toLowerCase().trim() === selectedStatus.toLowerCase().trim()
    );
  }, [orders, selectedStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (refreshOrders) await refreshOrders();
    setRefreshing(false);
  };

  const handleDelete = (orderId: string) => {
    Alert.alert(
      "Supprimer",
      "Voulez-vous supprimer cette commande de votre historique ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive",
          onPress: async () => {
            if (deleteOrder) {
              await deleteOrder(orderId);
            }
          }
        }
      ]
    );
  };

  const stats = useMemo(() => {
    const delivered = orders.filter((o: any) => o.status?.toLowerCase() === 'delivered');
    const totalAmount = delivered.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
    
    return {
      count: orders.length,
      deliveredCount: delivered.length,
      spent: formatCurrency(totalAmount)
    };
  }, [orders]);

  if (loading) return (
    <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <LinearGradient colors={COLORS.primaryGradient} style={styles.headerGradient}>
          <SafeAreaView>
            <View style={styles.navBar}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={COLORS.white} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={styles.headerTitle}>Mes commandes</Text>
                <Text style={styles.headerSubtitle}>Achats B2B · références fournisseurs</Text>
              </View>
              <View style={{ width: 44 }} />
            </View>
            
            <View style={styles.statsRow}>
              <StatItem label="Total" value={stats.count} icon="receipt-outline" />
              <StatItem label="Livrées" value={stats.deliveredCount} icon="checkmark-done" />
              <StatItem label="Dépensé" value={stats.spent} icon="wallet-outline" isSmall />
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            <FilterChip 
              active={!selectedStatus} 
              label="Toutes" 
              count={orders.length} 
              onPress={() => setSelectedStatus(null)} 
            />
            {Object.entries(ORDER_STATUS_CONFIG).map(([key, cfg]) => (
              <FilterChip 
                key={key} 
                active={selectedStatus === key} 
                label={cfg.label} 
                count={orders.filter((o: any) => o.status?.toLowerCase() === key.toLowerCase()).length}
                onPress={() => setSelectedStatus(key)} 
              />
            ))}
          </ScrollView>
        </View>
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={false}
        renderItem={({ item }) => (
          <OrderCard 
            order={item} 
            onPress={() => router.push(`/orders/${item.id}`)} 
            onDelete={handleDelete}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={60} color={COLORS.border} />
            <Text style={styles.emptyText}>Aucune commande trouvée</Text>
          </View>
        }
      />
    </View>
  );
}

// --- SOUS-COMPOSANTS ---
const StatItem = ({ label, value, icon, isSmall }: any) => (
  <View style={styles.statCard}>
    <Ionicons name={icon} size={18} color="rgba(255,255,255,0.7)" />
    <Text style={[styles.statValue, isSmall && { fontSize: 13 }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const FilterChip = ({ active, label, count, onPress }: any) => (
  <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    <View style={[styles.chipBadge, { backgroundColor: active ? 'rgba(255,255,255,0.2)' : '#F0F0F0' }]}>
        <Text style={[styles.chipBadgeText, active && { color: COLORS.white }]}>{count}</Text>
    </View>
  </TouchableOpacity>
);

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: { zIndex: 10 },
  headerGradient: { paddingBottom: 30, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: Platform.OS === 'android' ? 40 : 10 },
  headerTitle: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
  statCard: { alignItems: 'center', flex: 1 },
  statValue: { color: COLORS.white, fontSize: 15, fontWeight: '800', marginVertical: 2 },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  filterWrapper: { marginTop: -25 },
  filterContent: { paddingHorizontal: 20, paddingBottom: 15, gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.textLight },
  chipTextActive: { color: COLORS.white },
  chipBadge: { marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  chipBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#888' },
  listContent: { paddingTop: 15, paddingHorizontal: 20, paddingBottom: 40 },
  orderCard: { backgroundColor: COLORS.white, borderRadius: 24, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  orderId: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
  orderDate: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },
  deleteMiniBtn: { backgroundColor: 'rgba(255,255,255,0.25)', padding: 5, borderRadius: 8 },
  orderContent: { padding: 16 },
  statusBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, marginBottom: 8, gap: 6 },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  productPreview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  imageContainer: { width: 75, height: 75, borderRadius: 14, backgroundColor: '#F0F0F0', overflow: 'hidden' },
  productImage: { width: '100%', height: '100%' },
  placeholderIcon: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  totalPrice: { fontSize: 17, fontWeight: '900', color: COLORS.primary },
  emptyContainer: { alignItems: 'center', marginTop: 100, opacity: 0.5 },
  emptyText: { marginTop: 10, fontSize: 16, color: COLORS.textLight, fontWeight: '600' }
});