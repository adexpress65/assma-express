// app/orders/[id].tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOrders, Order } from '../../src/contexts/OrderContext';

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
  danger: '#DC3545',
  info: '#17A2B8'
};

const statusConfig = {
  pending: { label: 'En attente', color: COLORS.warning, icon: 'time-outline' as const },
  confirmed: { label: 'Confirmée', color: COLORS.primary, icon: 'checkmark-circle-outline' as const },
  shipped: { label: 'Expédiée', color: COLORS.success, icon: 'car-outline' as const },
  delivered: { label: 'Livrée', color: COLORS.success, icon: 'checkmark-done-outline' as const },
  cancelled: { label: 'Annulée', color: COLORS.danger, icon: 'close-circle-outline' as const }
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getOrderById, updateOrderStatus, loading: contextLoading } = useOrders();
  const [order, setOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (id && typeof id === 'string') {
      const foundOrder = getOrderById(id);
      setOrder(foundOrder || null);
    }
  }, [id, getOrderById]);

  const handleUpdateStatus = async (newStatus: Order['status']) => {
    if (!order || !id) return;

    Alert.alert(
      'Modifier le statut',
      `Voulez-vous vraiment changer le statut en "${statusConfig[newStatus].label}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsUpdating(true);
              await updateOrderStatus(id as string, newStatus);
              // Mettre à jour l'ordre local
              setOrder({ 
                ...order, 
                status: newStatus, 
                updatedAt: new Date() 
              });
              Alert.alert('Succès', 'Statut mis à jour avec succès');
            } catch (error) {
              console.error('Erreur:', error);
              Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
            } finally {
              setIsUpdating(false);
            }
          }
        }
      ]
    );
  };

  const handleCallSupport = () => {
    Linking.openURL(`tel:+221781234567`).catch(err => 
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application téléphone')
    );
  };

  const handleTrackShipping = () => {
    if (order?.shipping?.trackingNumber) {
      // URL de suivi fictive - à adapter selon votre transporteur
      const trackingUrl = `https://tracking.example.com/${order.shipping.trackingNumber}`;
      Linking.openURL(trackingUrl).catch(err =>
        Alert.alert('Erreur', 'Impossible d\'ouvrir le lien de suivi')
      );
    } else {
      Alert.alert('Info', 'Numéro de suivi non disponible');
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Non disponible";
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number | undefined) => {
    if (!price && price !== 0) return "0 FCFA";
    return `${price.toLocaleString()} FCFA`;
  };

  // Récupérer les valeurs avec fallback
  const getShipping = () => {
    return order?.shipping || {
      method: 'Standard',
      cost: 0,
      deliveryTime: '5-7 jours',
      trackingNumber: undefined
    };
  };

  const getAddress = () => {
    return order?.address || {
      fullName: 'Non spécifié',
      street: 'Non spécifié',
      city: 'Non spécifié',
      postalCode: 'Non spécifié',
      country: 'Non spécifié',
      phone: 'Non spécifié'
    };
  };

  const getWholesale = () => {
    return order?.wholesale || {
      totalQuantity: order?.items?.length || 0,
      savings: 0
    };
  };

  if (contextLoading || isUpdating) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.danger} />
        <Text style={styles.errorTitle}>Commande non trouvée</Text>
        <Text style={styles.errorText}>
          La commande #{id?.slice(-8)?.toUpperCase()} n'existe pas ou a été supprimée
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour aux commandes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusInfo = statusConfig[order.status] || statusConfig.pending;
  const shipping = getShipping();
  const address = getAddress();
  const wholesale = getWholesale();
  const subtotal = order.subtotal || order.total || 0;
  const tax = order.tax || 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Détails de la commande</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Statut de la commande */}
      <View style={styles.statusSection}>
        <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}20` }]}>
          <Ionicons name={statusInfo.icon} size={20} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
        <Text style={styles.orderId}>Commande #{order.id.slice(-8).toUpperCase()}</Text>
        <Text style={styles.orderDate}>Passée le {formatDate(order.createdAt)}</Text>
      </View>

      {/* Informations de livraison */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="location-outline" size={20} color={COLORS.primary} />
          <Text style={styles.cardTitle}>Adresse de livraison</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.addressName}>{address.fullName}</Text>
          <Text style={styles.addressText}>{address.street}</Text>
          <Text style={styles.addressText}>
            {address.postalCode} {address.city}
          </Text>
          <Text style={styles.addressText}>{address.country}</Text>
          <Text style={styles.phoneText}>📱 {address.phone}</Text>
        </View>
      </View>

      {/* Informations de livraison */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
          <Text style={styles.cardTitle}>Livraison</Text>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.shippingRow}>
            <Text style={styles.shippingLabel}>Méthode:</Text>
            <Text style={styles.shippingValue}>{shipping.method}</Text>
          </View>
          <View style={styles.shippingRow}>
            <Text style={styles.shippingLabel}>Délai:</Text>
            <Text style={styles.shippingValue}>{shipping.deliveryTime}</Text>
          </View>
          <View style={styles.shippingRow}>
            <Text style={styles.shippingLabel}>Coût:</Text>
            <Text style={styles.shippingValue}>{formatPrice(shipping.cost)}</Text>
          </View>
          {shipping.trackingNumber && (
            <View style={styles.shippingRow}>
              <Text style={styles.shippingLabel}>N° de suivi:</Text>
              <Text style={styles.shippingValue}>{shipping.trackingNumber}</Text>
            </View>
          )}
          {order.status === 'shipped' && (
            <TouchableOpacity style={styles.trackButton} onPress={handleTrackShipping}>
              <Text style={styles.trackButtonText}>Suivre mon colis</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Articles */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cart-outline" size={20} color={COLORS.primary} />
          <Text style={styles.cardTitle}>Articles ({order.items?.length || 0})</Text>
        </View>
        {order.items?.map((item, index) => (
          <View key={index} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDetails}>
                {item.quantity || 1} × {formatPrice(item.price)} • {item.color || 'Non spécifié'} • Taille: {item.size || 'Non spécifié'}
              </Text>
            </View>
            <Text style={styles.itemTotal}>
              {formatPrice(item.price * (item.quantity || 1))}
            </Text>
          </View>
        ))}
      </View>

      {/* Résumé du paiement */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
          <Text style={styles.cardTitle}>Résumé du paiement</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Sous-total</Text>
          <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
        </View>
        {wholesale.savings > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, styles.discountText]}>
              Économies gros ({wholesale.totalQuantity} articles)
            </Text>
            <Text style={[styles.summaryValue, styles.discountText]}>
              -{formatPrice(wholesale.savings)}
            </Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Livraison</Text>
          <Text style={styles.summaryValue}>{formatPrice(shipping.cost)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Taxes</Text>
          <Text style={styles.summaryValue}>{formatPrice(tax)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        {order.status === 'pending' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.confirmButton]}
              onPress={() => handleUpdateStatus('confirmed')}
              disabled={isUpdating}
            >
              <Text style={styles.actionButtonText}>Confirmer la commande</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleUpdateStatus('cancelled')}
              disabled={isUpdating}
            >
              <Text style={styles.cancelButtonText}>Annuler la commande</Text>
            </TouchableOpacity>
          </>
        )}
        
        {order.status === 'confirmed' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.shipButton]}
            onPress={() => handleUpdateStatus('shipped')}
            disabled={isUpdating}
          >
            <Text style={styles.actionButtonText}>Marquer comme expédiée</Text>
          </TouchableOpacity>
        )}
        
        {order.status === 'shipped' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.deliverButton]}
            onPress={() => handleUpdateStatus('delivered')}
            disabled={isUpdating}
          >
            <Text style={styles.actionButtonText}>Marquer comme livrée</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.supportButton]}
          onPress={handleCallSupport}
        >
          <Ionicons name="call-outline" size={18} color={COLORS.white} />
          <Text style={styles.actionButtonText}>Contacter le support</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Dernière mise à jour: {formatDate(order.updatedAt)}
        </Text>
      </View>
    </ScrollView>
  );
}

// Les styles restent les mêmes que dans votre code précédent
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.danger,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 24,
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
  statusSection: {
    backgroundColor: COLORS.white,
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
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
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    margin: 16,
    marginBottom: 0,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  cardContent: {
    gap: 8,
  },
  addressName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 20,
  },
  phoneText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
    marginTop: 4,
  },
  shippingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  shippingLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  shippingValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  trackButton: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  trackButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: `${COLORS.border}80`,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  summaryValue: {
    fontSize: 14,
    color: COLORS.text,
  },
  discountText: {
    color: COLORS.success,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  actionsContainer: {
    margin: 16,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  shipButton: {
    backgroundColor: COLORS.success,
  },
  deliverButton: {
    backgroundColor: COLORS.info,
  },
  supportButton: {
    backgroundColor: COLORS.warning,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
});