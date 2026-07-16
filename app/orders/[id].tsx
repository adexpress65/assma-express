// app/orders/[id].tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useOrders, Order } from '../../src/contexts/OrderContext';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { APP_CONFIG } from '@/constants/Config';

const COLORS = {
  primary: '#FF6A00',
  primaryGradient: ['#FF6A00', '#FF8C42'],
  primaryLight: '#FFF0E6',
  background: '#F8F9FA',
  text: '#2D3748',
  textLight: '#718096',
  border: '#E2E8F0',
  white: '#FFFFFF',
  success: '#28A745',
  warning: '#FFC107',
  danger: '#DC3545',
  info: '#17A2B8',
  shadow: {
    light: 'rgba(0, 0, 0, 0.05)',
    medium: 'rgba(0, 0, 0, 0.1)',
    dark: 'rgba(0, 0, 0, 0.15)'
  }
};

const statusConfig = {
  pending: { 
    label: 'En attente', 
    color: COLORS.warning, 
    icon: 'time-outline' as const,
    bgColor: 'rgba(255, 193, 7, 0.1)'
  },
  confirmed: { 
    label: 'Confirmée', 
    color: COLORS.primary, 
    icon: 'checkmark-circle-outline' as const,
    bgColor: 'rgba(255, 106, 0, 0.1)'
  },
  shipped: { 
    label: 'Expédiée', 
    color: COLORS.success, 
    icon: 'car-outline' as const,
    bgColor: 'rgba(40, 167, 69, 0.1)'
  },
  delivered: { 
    label: 'Livrée', 
    color: COLORS.success, 
    icon: 'checkmark-done-outline' as const,
    bgColor: 'rgba(40, 167, 69, 0.1)'
  },
  cancelled: { 
    label: 'Avis', 
    color: '#7C3AED', 
    icon: 'star-outline' as const,
    bgColor: 'rgba(124, 58, 237, 0.12)'
  },
  failed: {
    label: 'Échouée',
    color: COLORS.danger,
    icon: 'close-circle-outline' as const,
    bgColor: 'rgba(220, 53, 69, 0.1)',
  },
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isSuperAdmin, isAdmin } = useAuth();
  /** Seuls les comptes internes peuvent faire avancer le workflow logistique sur cet écran (les acheteurs B2B passent par fournisseurs / support). */
  const canManageFulfillment = isSuperAdmin || isAdmin;
  const { getOrderById, updateOrderStatus, loading: contextLoading, orders } = useOrders();
  const [order, setOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  const loadOrder = useCallback(() => {
    const foundOrder = getOrderById(id as string);
    setOrder(foundOrder || null);
  }, [id, getOrderById]);

  useEffect(() => {
    if (id && typeof id === 'string') {
      loadOrder();
    }
  }, [id, loadOrder, orders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    loadOrder();
    setRefreshing(false);
  }, [loadOrder]);

  // Mémoïsation des valeurs dérivées
  const statusInfo = useMemo(() => {
    if (!order) return statusConfig.pending;
    const k = order.status as keyof typeof statusConfig;
    return statusConfig[k] || statusConfig.pending;
  }, [order]);

  const canLeaveReview =
    !!user &&
    !!order &&
    (order.status === 'delivered' || order.status === 'cancelled');

  const submitReview = useCallback(async () => {
    if (!order || !id || !user || reviewRating < 1) {
      Alert.alert('Avis', 'Veuillez choisir une note de 1 à 5 étoiles.');
      return;
    }
    try {
      setSavingReview(true);
      await updateDoc(doc(db, 'orders', String(id)), {
        customerReview: {
          rating: reviewRating,
          comment: reviewComment.trim() || null,
          userId: user.uid,
          createdAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });
      setReviewComment('');
      setReviewRating(0);
      Alert.alert('Merci', 'Votre avis a bien été enregistré.');
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Impossible d’enregistrer votre avis pour le moment.');
    } finally {
      setSavingReview(false);
    }
  }, [order, id, user, reviewRating, reviewComment]);

  const shipping = useMemo(() => 
    order?.shipping || {
      method: 'Standard',
      cost: 0,
      deliveryTime: '5-7 jours',
      trackingNumber: undefined
    }, [order]
  );

  const address = useMemo(() => 
    order?.address || {
      fullName: 'Non spécifié',
      street: 'Non spécifié',
      city: 'Non spécifié',
      postalCode: 'Non spécifié',
      country: 'Non spécifié',
      phone: 'Non spécifié'
    }, [order]
  );

  const wholesale = useMemo(() => 
    order?.wholesale || {
      totalQuantity: order?.items?.length || 0,
      savings: 0
    }, [order]
  );

  const subtotal = useMemo(() => 
    order?.subtotal || order?.total || 0, [order]
  );

  const tax = useMemo(() => 
    order?.tax || 0, [order]
  );

  const itemCount = useMemo(() => 
    order?.items?.length || 0, [order]
  );

  // Callbacks mémoïsés
  const handleUpdateStatus = useCallback(async (newStatus: Order['status']) => {
    if (!order || !id || !canManageFulfillment) return;
    const cfg = statusConfig[newStatus as keyof typeof statusConfig];
    if (!cfg) return;

    Alert.alert(
      'Modifier le statut',
      `Voulez-vous vraiment changer le statut en "${cfg.label}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsUpdating(true);
              await updateOrderStatus(id as string, newStatus);
              setOrder(prev => prev ? { 
                ...prev, 
                status: newStatus, 
                updatedAt: new Date() 
              } : null);
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
  }, [order, id, updateOrderStatus, canManageFulfillment]);

  const handleCallSupport = useCallback(() => {
    const raw = APP_CONFIG.supportPhone.replace(/\s/g, '');
    Linking.openURL(`tel:${raw}`).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir l'application téléphone"),
    );
  }, []);

  const handleRequestCancellation = useCallback(() => {
    const ref = (order as any)?.orderId || order?.id || id;
    const subject = encodeURIComponent(`Demande concernant la commande ${ref}`);
    const body = encodeURIComponent(
      `Bonjour,\n\nJe souhaite obtenir de l'aide concernant ma commande ${ref}.\n\n`,
    );
    Linking.openURL(
      `mailto:${APP_CONFIG.supportEmail}?subject=${subject}&body=${body}`,
    ).catch(() => Alert.alert('Erreur', 'Ouvrez votre messagerie et écrivez à ' + APP_CONFIG.supportEmail));
  }, [order, id]);

  const handleTrackShipping = useCallback(() => {
    if (!shipping.trackingNumber) {
      Alert.alert('Info', 'Numéro de suivi non disponible');
      return;
    }
    const base = APP_CONFIG.shippingTrackingUrlBase?.trim();
    if (base) {
      const url = base.includes('{num}')
        ? base.replace('{num}', encodeURIComponent(String(shipping.trackingNumber)))
        : base.endsWith('/')
          ? `${base}${encodeURIComponent(String(shipping.trackingNumber))}`
          : `${base}/${encodeURIComponent(String(shipping.trackingNumber))}`;
      Linking.openURL(url).catch(() =>
        Alert.alert('Erreur', "Impossible d'ouvrir le lien de suivi"),
      );
    } else {
      Alert.alert(
        'Suivi',
        `Numéro : ${shipping.trackingNumber}\n` +
          'Le lien de suivi en ligne sera communiqué par le transporteur ou le support si configuré (APP_CONFIG.shippingTrackingUrlBase).',
      );
    }
  }, [shipping.trackingNumber]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const formatDate = useCallback((date: Date | null) => {
    if (!date) return "Non disponible";
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const formatPrice = useCallback((price: number | undefined) => {
    if (!price && price !== 0) return "0 FCFA";
    return `${price.toLocaleString()} FCFA`;
  }, []);

  if (contextLoading) {
    return (
      <LinearGradient
        colors={COLORS.primaryGradient}
        style={styles.loadingContainer}
      >
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </LinearGradient>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <LinearGradient
          colors={['rgba(220, 53, 69, 0.1)', 'rgba(220, 53, 69, 0.05)']}
          style={styles.errorIconContainer}
        >
          <Ionicons name="alert-circle-outline" size={64} color={COLORS.danger} />
        </LinearGradient>
        <Text style={styles.errorTitle}>Commande non trouvée</Text>
        <Text style={styles.errorText}>
          La commande #{id?.slice(-8)?.toUpperCase()} n'existe pas ou a été supprimée
        </Text>
        <TouchableOpacity style={styles.errorBackButton} onPress={handleBack}>
          <LinearGradient
            colors={COLORS.primaryGradient}
            style={styles.errorBackButtonGradient}
          >
            <Text style={styles.errorBackButtonText}>Retour aux commandes</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[COLORS.primary]}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* Header avec dégradé */}
      <LinearGradient
        colors={COLORS.primaryGradient}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Bon de commande</Text>
            <Text style={styles.headerSubtitle}>Achat B2B · fournisseurs partenaires</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>

      {/* Statut de la commande */}
      <View style={styles.statusSection}>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
          <Ionicons name={statusInfo.icon} size={20} color={statusInfo.color} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
        <Text style={styles.orderRef}>
          {(order as any).orderId ? String((order as any).orderId) : `#${order.id.slice(-8).toUpperCase()}`}
        </Text>
        <Text style={styles.orderDate}>Passée le {formatDate(order.createdAt)}</Text>
      </View>

      {(() => {
        const company =
          String((order as any).companyName ?? (order as any).buyerCompany ?? '').trim() ||
          String((address as any).companyName ?? '').trim();
        if (!company) return null;
        return (
          <View style={styles.b2bBanner}>
            <Ionicons name="business-outline" size={18} color={COLORS.primary} />
            <Text style={styles.b2bBannerText}>{company}</Text>
          </View>
        );
      })()}

      {/* Informations de livraison */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="location-outline" size={20} color={COLORS.primary} />
          </View>
          <Text style={styles.cardTitle}>Adresse de livraison</Text>
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.addressName}>{address.fullName}</Text>
          <Text style={styles.addressText}>{address.street}</Text>
          <Text style={styles.addressText}>
            {address.postalCode} {address.city}
          </Text>
          <Text style={styles.addressText}>{address.country}</Text>
          <View style={styles.phoneContainer}>
            <Ionicons name="call-outline" size={16} color={COLORS.primary} />
            <Text style={styles.phoneText}>{address.phone}</Text>
          </View>
        </View>
      </View>

      {/* Informations de livraison */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
          </View>
          <Text style={styles.cardTitle}>Livraison</Text>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Méthode:</Text>
            <Text style={styles.infoValue}>{shipping.method}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Délai:</Text>
            <Text style={styles.infoValue}>{shipping.deliveryTime}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Coût:</Text>
            <Text style={styles.infoValue}>{formatPrice(shipping.cost)}</Text>
          </View>
          {shipping.trackingNumber && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>N° de suivi:</Text>
              <Text style={styles.infoValue}>{shipping.trackingNumber}</Text>
            </View>
          )}
          {order.status === 'shipped' && (
            <TouchableOpacity 
              style={styles.trackButton} 
              onPress={handleTrackShipping}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                style={styles.trackButtonGradient}
              >
                <Ionicons name="locate-outline" size={18} color="#FFFFFF" />
                <Text style={styles.trackButtonText}>Suivre mon colis</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Articles */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="cart-outline" size={20} color={COLORS.primary} />
          </View>
          <Text style={styles.cardTitle}>Articles ({itemCount})</Text>
        </View>
        {order.items?.map((item, index) => (
          <View
            key={`${String((item as any).productId ?? (item as any).id ?? '')}-${String((item as any).name)}-${index}`}
            style={styles.itemRow}
          >
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemDetails}>
                {item.quantity || 1} × {formatPrice(item.price)}
                {item.color && ` • ${item.color}`}
                {item.size && ` • Taille: ${item.size}`}
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
          <View style={styles.cardIconContainer}>
            <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
          </View>
          <Text style={styles.cardTitle}>Résumé du paiement</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Sous-total</Text>
          <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
        </View>
        {wholesale.savings > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, styles.discountText]}>
              Économies ({wholesale.totalQuantity} articles)
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

      {canLeaveReview && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconContainer}>
              <Ionicons name="star-outline" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.cardTitle}>Avis sur la commande / fournisseur</Text>
          </View>
          {order.customerReview ? (
            <View style={styles.cardContent}>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Ionicons
                    key={n}
                    name={n <= order.customerReview!.rating ? 'star' : 'star-outline'}
                    size={22}
                    color="#F59E0B"
                  />
                ))}
              </View>
              {order.customerReview.comment ? (
                <Text style={styles.reviewCommentText}>{order.customerReview.comment}</Text>
              ) : null}
              <Text style={styles.reviewDate}>
                Envoyé le{' '}
                {order.customerReview.createdAt
                  ? formatDate(order.customerReview.createdAt)
                  : '—'}
              </Text>
            </View>
          ) : (
            <View style={styles.cardContent}>
              <Text style={styles.reviewHint}>Notez votre expérience (commande livrée ou annulée).</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setReviewRating(n)} hitSlop={8}>
                    <Ionicons
                      name={n <= reviewRating ? 'star' : 'star-outline'}
                      size={32}
                      color="#F59E0B"
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.reviewInput}
                placeholder="Commentaire (optionnel)"
                placeholderTextColor="#A0AEC0"
                multiline
                value={reviewComment}
                onChangeText={setReviewComment}
                maxLength={800}
              />
              <TouchableOpacity
                style={[styles.reviewSubmit, savingReview && { opacity: 0.6 }]}
                onPress={() => void submitReview()}
                disabled={savingReview}
              >
                <Text style={styles.reviewSubmitText}>
                  {savingReview ? 'Envoi…' : 'Envoyer mon avis'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Actions : workflow logistique réservé aux comptes internes ; acheteurs B2B : suivi + support */}
      <View style={styles.actionsContainer}>
        {canManageFulfillment && order.status === 'pending' && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, isUpdating && { opacity: 0.65 }]}
              onPress={() => handleUpdateStatus('confirmed')}
              disabled={isUpdating}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={COLORS.primaryGradient}
                style={styles.actionButtonGradient}
              >
                <Text style={styles.actionButtonText}>Confirmer la commande</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton, isUpdating && { opacity: 0.65 }]}
              onPress={() => handleUpdateStatus('cancelled')}
              disabled={isUpdating}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Annuler la commande</Text>
            </TouchableOpacity>
          </>
        )}

        {!canManageFulfillment && order.status === 'pending' && (
          <View style={styles.buyerPendingCard}>
            <View style={styles.buyerPendingRow}>
              <Ionicons name="information-circle-outline" size={22} color={COLORS.primary} />
              <Text style={styles.buyerPendingText}>
                Votre bon de commande est en traitement côté fournisseur. Pour une modification ou une annulation,
                contactez le support avec la référence affichée ci-dessus.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.buyerHelpButton}
              onPress={handleRequestCancellation}
              activeOpacity={0.85}
            >
              <Ionicons name="mail-outline" size={18} color={COLORS.primary} />
              <Text style={styles.buyerHelpButtonText}>Demander une modification par e-mail</Text>
            </TouchableOpacity>
          </View>
        )}

        {canManageFulfillment && order.status === 'confirmed' && (
          <TouchableOpacity
            style={[styles.actionButton, isUpdating && { opacity: 0.65 }]}
            onPress={() => handleUpdateStatus('shipped')}
            disabled={isUpdating}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#34C759', '#30D158']}
              style={styles.actionButtonGradient}
            >
              <Text style={styles.actionButtonText}>Marquer comme expédiée</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {canManageFulfillment && order.status === 'shipped' && (
          <TouchableOpacity
            style={[styles.actionButton, isUpdating && { opacity: 0.65 }]}
            onPress={() => handleUpdateStatus('delivered')}
            disabled={isUpdating}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#30D158', '#34C759']}
              style={styles.actionButtonGradient}
            >
              <Text style={styles.actionButtonText}>Marquer comme livrée</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.supportButton]}
          onPress={handleCallSupport}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#FFC107', '#FFB300']}
            style={styles.actionButtonGradient}
          >
            <Ionicons name="call-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Contacter le support</Text>
          </LinearGradient>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
  },
  errorIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.danger,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorBackButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  errorBackButtonGradient: {
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  errorBackButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 4,
    fontWeight: '500',
  },
  headerRight: {
    width: 40,
  },
  statusSection: {
    backgroundColor: COLORS.white,
    marginTop: -10,
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
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
  orderRef: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  b2bBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  b2bBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  buyerPendingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  buyerPendingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  buyerPendingText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 20,
  },
  buyerHelpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  buyerHelpButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  orderDate: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  cardContent: {
    gap: 12,
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
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  phoneText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  trackButton: {
    marginTop: 12,
    borderRadius: 10,
    overflow: 'hidden',
  },
  trackButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
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
    marginHorizontal: 20,
    marginTop: 20,
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  cancelButtonText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 16,
  },
  supportButton: {
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontStyle: 'italic',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  reviewHint: {
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 18,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 88,
    textAlignVertical: 'top',
    fontSize: 14,
    color: COLORS.text,
  },
  reviewSubmit: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  reviewSubmitText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  reviewCommentText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  reviewDate: {
    fontSize: 12,
    color: COLORS.textLight,
  },
});