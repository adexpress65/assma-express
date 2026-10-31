import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency } from '../../src/contexts/CurrencyContext';
import { isZeroDollarsProduct } from '../../src/utils/zeroDollarsShop';
import {
  anyZeroFcfaMissingWarehouse,
  computeWarehouseFeeBreakdown,
  formatWarehouseFeeUsd,
  ZERO_FCFA_UNAVAILABLE_MESSAGE,
} from '../../src/utils/warehouseFee';
import { useWarehouseFees } from '../../src/hooks/useWarehouseFees';
import { useCheckout } from '../../src/contexts/CheckoutContext';
import type { CartSummary } from '../../src/types/cart';
import type { ProductSpecifications } from '../../src/types/product';
import {
  buildShippingMethodFields,
  getShippingMethodLabel,
  shippingMethodIcon,
} from '../../src/utils/orderShipping';

/** Livraison facturée hors app après pesage — jamais dans le paiement en ligne. */
const CHECKOUT_SHIPPING_FEE = 0;

const SHIPPING_AFTER_WEIGHING_MESSAGE =
  'Frais de livraison calculés après pesage réel de votre colis. Vous serez contacté(e) avant expédition pour le règlement.';

const COLORS = {
  primary: '#FF6A00',
  primaryLight: '#FFF0E6',
  primaryDark: '#E55A00',
  background: '#FFFAF5',
  success: '#28A745',
  successLight: '#E6F7E6',
  text: '#2D3748',
  textLight: '#718096',
  border: '#E2E8F0',
  white: '#FFFFFF'
};

interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  companyName?: string;
  hasFreeShipping?: boolean;
  specifications?: ProductSpecifications;
  originWarehouseId?: string | null;
  originWarehouseLabel?: string | null;
}

interface ShippingOption {
  id: string;
  name: string;
  price: number;
  deliveryTime: string;
  description: string;        // courte description affichée pour tous
  type: 'free' | 'air' | 'sea';
  details: string;             // détails de calcul (ex: "2.5 kg × 12 000 F")
  explanation?: string;        // texte complémentaire (pour l'option gratuite)
}

interface OrderSummary {
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
}

export default function CheckoutShipping() {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const { orderData, initOrder, setShipping, setSummary, setDeliveryMode } = useCheckout();
  const { config: warehouseFeesConfig } = useWarehouseFees();

  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [deliveryMode, setDeliveryModeLocal] = useState<'pickup' | 'home' | ''>(
    orderData?.deliveryMode === 'pickup' || orderData?.deliveryMode === 'home'
      ? orderData.deliveryMode
      : '',
  );
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [isWholesaleOrder, setIsWholesaleOrder] = useState(false);
  const [summary, setSummaryLocal] = useState<CartSummary>({
    subtotal: 0,
    shipping: 0,
    discount: 0,
    total: 0
  });
  const [hasFreeShippingEligible, setHasFreeShippingEligible] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const computeItemsSubtotal = (items: OrderItem[]) =>
    items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);

  const buildSummary = (items: OrderItem[]): CartSummary => {
    const subtotal = computeItemsSubtotal(items);
    const { lines, warehouseFeeTotal } = computeWarehouseFeeBreakdown(
      items,
      warehouseFeesConfig,
    );
    return {
      subtotal,
      shipping: CHECKOUT_SHIPPING_FEE,
      discount: 0,
      warehouseFees: lines,
      warehouseFeeTotal,
      total: subtotal + CHECKOUT_SHIPPING_FEE + warehouseFeeTotal,
    };
  };

  useEffect(() => {
    const loadOrderData = async () => {
      try {
        if (!orderData) {
          Alert.alert('Erreur', 'Aucune donnée de commande reçue. Retour au panier.');
          router.replace('/cart');
          return;
        }

        if (!orderData.items || orderData.items.length === 0) {
          Alert.alert('Panier vide', 'Aucun article sélectionné');
          router.replace('/cart');
          return;
        }

        setSelectedItems(orderData.items);
        const normalizedSummary = buildSummary(orderData.items);
        const incomingSummary = orderData.summary ?? {
          subtotal: 0,
          shipping: 0,
          discount: 0,
          total: 0,
          warehouseFees: [],
          warehouseFeeTotal: 0,
        };
        setSummaryLocal(normalizedSummary);

        const hasGap =
          Math.abs((Number(incomingSummary.subtotal) || 0) - normalizedSummary.subtotal) > 1 ||
          Math.abs((Number(incomingSummary.shipping) || 0) - CHECKOUT_SHIPPING_FEE) > 1 ||
          Math.abs((Number(incomingSummary.total) || 0) - normalizedSummary.total) > 1 ||
          Math.abs((Number(incomingSummary.warehouseFeeTotal) || 0) - (normalizedSummary.warehouseFeeTotal || 0)) > 1 ||
          (Number(incomingSummary.discount) || 0) !== 0;
        if (hasGap) {
          setSummary(normalizedSummary);
        }

        const quantity = orderData.items.reduce((total, item) => total + item.quantity, 0);
        setTotalQuantity(quantity);
        setIsWholesaleOrder(quantity >= 10 || orderData.items.some((item) => item.quantity >= 10));

        const freeEligible = orderData.items.some((item) => {
          const isZero = isZeroDollarsProduct({
            price: item.price,
            companyName: item.companyName,
            supplier: item.seller,
            seller: item.seller,
            name: item.name,
          });
          return item.hasFreeShipping === true && !isZero;
        });
        setHasFreeShippingEligible(freeEligible);

      } catch (error) {
        Alert.alert('Erreur', 'Impossible de charger les données de la commande');
        router.replace('/cart');
      } finally {
        setLoading(false);
      }
    };

    loadOrderData();
  }, [orderData, warehouseFeesConfig]);

  // Construction dynamique des options de livraison
// Dans le useEffect qui construit shippingOptions
// Construction dynamique des options de livraison
  useEffect(() => {
    const options: ShippingOption[] = [];

    if (hasFreeShippingEligible) {
      options.push({
        id: 'free_shipping',
        // Libellé texte pur (sans emoji) — source de vérité Firestore
        name: getShippingMethodLabel('free_shipping'),
        price: CHECKOUT_SHIPPING_FEE,
        deliveryTime: 'Variable selon articles',
        description: 'Profitez de la livraison gratuite sur vos articles éligibles.',
        type: 'free',
        details: 'Gratuite',
        explanation: 'Cette option est disponible pour vos articles bénéficiant de la livraison gratuite.'
      });
    }

    options.push(
      {
        id: 'vol_express',
        name: getShippingMethodLabel('vol_express'),
        price: CHECKOUT_SHIPPING_FEE,
        deliveryTime: '5 jours',
        description: 'Livraison express par avion – Idéal pour les urgences',
        type: 'air',
        details: 'Délai : 5 jours',
      },
      {
        id: 'vol_cargo',
        name: getShippingMethodLabel('vol_cargo'),
        price: CHECKOUT_SHIPPING_FEE,
        deliveryTime: '2 semaines',
        description: 'Livraison économique par cargo aérien',
        type: 'air',
        details: 'Délai : 2 semaines',
      },
      {
        id: 'voie_maritime',
        name: getShippingMethodLabel('voie_maritime'),
        price: CHECKOUT_SHIPPING_FEE,
        deliveryTime: '12 semaines',
        description: 'Livraison la plus économique par bateau',
        type: 'sea',
        details: 'Délai : 12 semaines',
      }
    );

    setShippingOptions(options);

    if (options.length > 0) {
      setSelectedShipping(hasFreeShippingEligible ? 'free_shipping' : options[0].id);
    }
  }, [hasFreeShippingEligible]);


  const getSelectedShippingOption = () => {
    return shippingOptions.find(option => option.id === selectedShipping);
  };

  const handleContinue = () => {
    const selectedOption = getSelectedShippingOption();

    if (!selectedOption) {
      Alert.alert('Erreur', 'Veuillez sélectionner un mode de transport');
      return;
    }

    if (deliveryMode !== 'pickup' && deliveryMode !== 'home') {
      Alert.alert(
        'Choix requis',
        'Veuillez indiquer si vous retirez à l’entrepôt ou si vous souhaitez une livraison à domicile.',
      );
      return;
    }

    if (!orderData || selectedItems.length === 0) {
      Alert.alert('Erreur', 'Données de commande manquantes');
      return;
    }

    if (anyZeroFcfaMissingWarehouse(selectedItems, warehouseFeesConfig)) {
      Alert.alert('Indisponible', ZERO_FCFA_UNAVAILABLE_MESSAGE);
      return;
    }

    const normalizedSummary = buildSummary(selectedItems);
    if (Math.round(normalizedSummary.total) <= 0) {
      Alert.alert(
        'Paiement impossible',
        'Le montant à payer est invalide. Vérifiez les frais d\'entrepôt de vos articles 0 FCFA.',
      );
      return;
    }

    setSummary(normalizedSummary);
    setSummaryLocal(normalizedSummary);

    const methodLabel =
      getShippingMethodLabel(selectedShipping, selectedOption.name) ||
      selectedOption.name;
    const methodType =
      selectedShipping === 'vol_cargo'
        ? 'cargo'
        : selectedShipping === 'voie_maritime'
          ? 'maritime'
          : selectedOption.type === 'sea'
            ? 'maritime'
            : selectedOption.type;

    const shippingSelection = {
      method: selectedShipping,
      option: {
        ...selectedOption,
        name: methodLabel,
        price: CHECKOUT_SHIPPING_FEE,
      },
      cost: CHECKOUT_SHIPPING_FEE,
      details: `${methodLabel} - ${selectedOption.deliveryTime}`,
    };
    const methodFields = buildShippingMethodFields({
      method: selectedShipping,
      option: shippingSelection.option,
    });

    // Sync immédiat du contexte (évite la course setState → navigate → payment)
    setShipping(shippingSelection);
    setDeliveryMode(deliveryMode);
    initOrder({
      ...orderData,
      items: selectedItems,
      summary: normalizedSummary,
      shipping: shippingSelection,
      deliveryMode,
      ...methodFields,
    });

    router.push({
      pathname: '/checkout/payment',
      params: {
        shippingFee: String(CHECKOUT_SHIPPING_FEE),
        shippingMethod: selectedShipping,
        shippingOptionName: methodLabel,
        shippingMethodName: methodLabel,
        shippingMethodDelay: selectedOption.deliveryTime,
        shippingMethodType: methodType,
        shippingDetails: `${methodLabel} - ${selectedOption.deliveryTime}`,
        deliveryMode,
        subtotal: String(normalizedSummary.subtotal),
        warehouseFeeTotal: String(normalizedSummary.warehouseFeeTotal || 0),
        total: String(normalizedSummary.total),
      },
    });
  };

  const renderOrderSummary = () => {
    if (!orderData || selectedItems.length === 0) return null;

    return (
      <View style={styles.orderSummary}>
        <View style={styles.summaryHeader}>
          <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
          <Text style={styles.summaryTitle}>Résumé de votre commande</Text>
        </View>
        <View style={styles.summaryItems}>
          {selectedItems.slice(0, 3).map((item, index) => (
            <View key={index} style={styles.summaryItem}>
              <Text style={styles.summaryItemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.summaryItemQty}>×{item.quantity}</Text>
              <Text style={styles.summaryItemPrice}>
                {formatPrice(item.price * item.quantity)}
              </Text>
            </View>
          ))}
          {selectedItems.length > 3 && (
            <Text style={styles.moreItemsText}>
              +{selectedItems.length - 3} autre(s) article(s)
            </Text>
          )}
        </View>
        <View style={styles.summaryTotals}>
          <View style={styles.summaryTotalRow}>
            <Text style={styles.summaryTotalLabel}>Sous-total :</Text>
            <Text style={styles.summaryTotalValue}>{formatPrice(summary.subtotal)}</Text>
          </View>
          {(summary.warehouseFees ?? []).map((fee) => (
            <View key={fee.warehouseId} style={styles.summaryTotalRow}>
              <Text style={styles.summaryWarehouseLabel}>
                Entrepôt de {fee.label} :
              </Text>
              <Text style={styles.summaryWarehouseValue}>
                {formatWarehouseFeeUsd(fee.feeUsd)}
              </Text>
            </View>
          ))}
          {summary.discount > 0 && (
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryDiscountLabel}>Réduction :</Text>
              <Text style={styles.summaryDiscountValue}>-{formatPrice(summary.discount)}</Text>
            </View>
          )}
          {(summary.warehouseFeeTotal || 0) > 0 && (
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotalLabel}>Total :</Text>
              <Text style={styles.summaryTotalValue}>{formatPrice(summary.total)}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Chargement de votre commande...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!orderData || selectedItems.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>Commande invalide</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={() => router.replace('/cart')}>
            <Text style={styles.emptyButtonText}>Retour au panier</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Indicateur de progression */}
        <View style={styles.progressHeader}>
          <View style={styles.progressStep}>
            <View style={[styles.stepIndicator, styles.stepCompleted]}>
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
            </View>
            <Text style={styles.stepTextCompleted}>Panier</Text>
          </View>
          <View style={styles.progressLineCompleted} />
          <View style={styles.progressStep}>
            <View style={[styles.stepIndicator, styles.stepActive]}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <Text style={styles.stepTextActive}>À confirmer</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.progressStep}>
            <View style={styles.stepIndicator}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <Text style={styles.stepText}>Paiement</Text>
          </View>
        </View>

        <Text style={styles.title}>Mode de livraison</Text>

        <Text style={styles.sectionHeading}>Dernier kilomètre</Text>
        <Text style={styles.sectionHint}>
          Choix obligatoire. Les frais de transport restent calculés après pesage.
        </Text>
        <View style={styles.deliveryModeRow}>
          <TouchableOpacity
            style={[
              styles.deliveryModeCard,
              deliveryMode === 'pickup' && styles.deliveryModeCardSelected,
            ]}
            onPress={() => {
              setDeliveryModeLocal('pickup');
              setDeliveryMode('pickup');
            }}
            activeOpacity={0.85}
          >
            <Ionicons
              name="storefront-outline"
              size={22}
              color={deliveryMode === 'pickup' ? COLORS.primary : COLORS.textLight}
            />
            <Text
              style={[
                styles.deliveryModeTitle,
                deliveryMode === 'pickup' && styles.deliveryModeTitleSelected,
              ]}
            >
              Retrait à l'entrepôt
            </Text>
            <Text style={styles.deliveryModeDesc}>
              Vous récupérez le colis à l'arrivée à l'entrepôt.
            </Text>
            {deliveryMode === 'pickup' && (
              <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.deliveryModeCard,
              deliveryMode === 'home' && styles.deliveryModeCardSelected,
            ]}
            onPress={() => {
              setDeliveryModeLocal('home');
              setDeliveryMode('home');
            }}
            activeOpacity={0.85}
          >
            <Ionicons
              name="home-outline"
              size={22}
              color={deliveryMode === 'home' ? COLORS.primary : COLORS.textLight}
            />
            <Text
              style={[
                styles.deliveryModeTitle,
                deliveryMode === 'home' && styles.deliveryModeTitleSelected,
              ]}
            >
              Livraison à domicile
            </Text>
            <Text style={styles.deliveryModeDesc}>
              Le colis est livré à l'adresse indiquée.
            </Text>
            {deliveryMode === 'home' && (
              <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.pesageNotice}>
          <Ionicons name="information-circle" size={20} color={COLORS.primary} />
          <Text style={styles.pesageNoticeText}>{SHIPPING_AFTER_WEIGHING_MESSAGE}</Text>
        </View>

        {/* Bandeau de succès si livraison gratuite disponible */}
        {hasFreeShippingEligible && (
          <View style={styles.successBanner}>
            <Ionicons name="gift" size={24} color={COLORS.success} />
            <View style={styles.successBannerText}>
              <Text style={styles.successBannerTitle}>🎉 Félicitations !</Text>
              <Text style={styles.successBannerMessage}>
                Vous bénéficiez de la livraison gratuite sur certains articles !
              </Text>
            </View>
          </View>
        )}

        {renderOrderSummary()}

        {isWholesaleOrder && (
          <View style={styles.wholesaleBadge}>
            <Ionicons name="business" size={16} color={COLORS.white} />
            <Text style={styles.wholesaleBadgeText}>
              Commande professionnelle • {totalQuantity} unités
            </Text>
          </View>
        )}

        <View style={styles.shippingOptions}>
          {shippingOptions.map(option => {
            const isSelected = selectedShipping === option.id;
            const isFree = option.type === 'free';

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.shippingCard,
                  isSelected && styles.shippingCardSelected,
                  isFree && styles.freeCard
                ]}
                onPress={() => setSelectedShipping(option.id)}
              >
                <View style={styles.shippingInfo}>
                  <View style={styles.shippingHeader}>
                    <Text style={styles.shippingName}>
                      {shippingMethodIcon(option.type)} {option.name}
                    </Text>
                    <View
                      style={[
                        styles.typeBadge,
                        isFree
                          ? styles.typeFree
                          : option.type === 'air'
                          ? styles.typeAir
                          : styles.typeSea
                      ]}
                    >
                      <Text style={styles.typeBadgeText}>
                        {isFree ? 'OFFERT' : option.type === 'air' ? 'AÉRIEN' : 'MARITIME'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.shippingTime}>{option.deliveryTime}</Text>
                  <Text style={styles.shippingDescription}>{option.description}</Text>

                  {/* Explication dédiée pour l'option gratuite */}
                  {isFree && option.explanation && (
                    <Text style={styles.freeExplanation}>{option.explanation}</Text>
                  )}
                </View>

                {isFree ? (
                  <View style={styles.shippingPriceContainer}>
                    <Text style={[styles.shippingPrice, styles.freePrice]}>GRATUIT</Text>
                  </View>
                ) : null}

                {isSelected && (
                  <View style={styles.selectedIndicator}>
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoHeader}>
            <Ionicons name="alert-circle" size={20} color={COLORS.primary} />
            <Text style={styles.infoTitle}>Informations importantes</Text>
          </View>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>{SHIPPING_AFTER_WEIGHING_MESSAGE}</Text>
            {hasFreeShippingEligible && (
              <Text style={styles.infoItem}>
                • <Text style={styles.infoBold}>Livraison Offerte</Text> : réservée aux articles éligibles
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.fixedBottomContainer}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue} activeOpacity={0.8}>
          <View style={styles.buttonContent}>
            <View>
              <Text style={styles.continueButtonText}>Continuer vers le paiement</Text>
              <Text style={styles.continueButtonSubtext}>
                Total : {formatPrice(summary.total)}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: COLORS.textLight },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.text, marginTop: 16 },
  emptyButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 20 },
  emptyButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  progressStep: { alignItems: 'center', gap: 8 },
  stepIndicator: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  stepActive: { backgroundColor: COLORS.primary },
  stepCompleted: { backgroundColor: COLORS.primary },
  stepNumber: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  stepText: { fontSize: 12, color: COLORS.textLight },
  stepTextActive: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  stepTextCompleted: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  progressLine: { width: 40, height: 2, backgroundColor: COLORS.border, marginHorizontal: 8 },
  progressLineCompleted: { width: 40, height: 2, backgroundColor: COLORS.primary, marginHorizontal: 8 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, textAlign: 'center', color: COLORS.text },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 12,
    lineHeight: 18,
  },
  deliveryModeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  deliveryModeCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  deliveryModeCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  deliveryModeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  deliveryModeTitleSelected: {
    color: COLORS.primary,
  },
  deliveryModeDesc: {
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 16,
  },
  successBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.successLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.success,
    alignItems: 'center',
    gap: 12
  },
  successBannerText: { flex: 1 },
  successBannerTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.success, marginBottom: 4 },
  successBannerMessage: { fontSize: 14, color: COLORS.text },
  orderSummary: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, elevation: 2 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  summaryItems: { marginBottom: 12 },
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingBottom: 6 },
  summaryItemName: { flex: 1, fontSize: 12, color: COLORS.text },
  summaryItemQty: { fontSize: 12, color: COLORS.textLight, marginHorizontal: 8 },
  summaryItemPrice: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  moreItemsText: { fontSize: 11, color: COLORS.textLight, textAlign: 'center' },
  summaryTotals: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryTotalLabel: { fontSize: 14, fontWeight: '600' },
  summaryTotalValue: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  summaryWarehouseLabel: { fontSize: 13, color: COLORS.textLight },
  summaryWarehouseValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  summaryDiscountLabel: { fontSize: 13, color: COLORS.textLight },
  summaryDiscountValue: { fontSize: 13, fontWeight: '600', color: '#e53935' },
  wholesaleBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, padding: 8, borderRadius: 20, marginBottom: 16, alignSelf: 'center' },
  wholesaleBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },
  pesageNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  pesageNoticeText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 20 },
  shippingOptions: { gap: 12, marginBottom: 20 },
  shippingCard: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.white, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border },
  freeCard: { borderColor: COLORS.success, backgroundColor: COLORS.successLight },
  shippingCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  shippingInfo: { flex: 1 },
  shippingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  shippingName: { fontSize: 16, fontWeight: '600', flex: 1 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  typeAir: { backgroundColor: '#E3F2FD' },
  typeSea: { backgroundColor: '#E8F5E8' },
  typeFree: { backgroundColor: COLORS.successLight, borderWidth: 1, borderColor: COLORS.success },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  shippingTime: { fontSize: 14, color: COLORS.textLight, marginBottom: 4 },
  shippingDescription: { fontSize: 12, color: COLORS.textLight, lineHeight: 16 },
  freeExplanation: { fontSize: 12, color: COLORS.success, marginTop: 4, fontStyle: 'italic' },
  shippingPriceContainer: { alignItems: 'flex-end', justifyContent: 'center' },
  shippingPrice: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  freePrice: { color: COLORS.success, fontSize: 18 },
  selectedIndicator: { position: 'absolute', top: 12, right: 12 },
  infoSection: { backgroundColor: COLORS.primaryLight, padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: COLORS.primary, marginBottom: 20 },
  infoHeader: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  infoList: { gap: 6 },
  infoItem: { fontSize: 12, color: COLORS.text },
  infoBold: { fontWeight: '600' },
  fixedBottomContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#f8f9fa', padding: 16, paddingBottom: 68, borderTopWidth: 1, borderTopColor: COLORS.border, elevation: 8 },
  continueButton: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  continueButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  continueButtonSubtext: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 12 },
});
