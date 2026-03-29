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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency } from '../../src/contexts/CurrencyContext';

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
  // Ajoute cette section :
  specifications?: {
    weight?: number;
    volume?: number;
    modelNumber?: string;
  };
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
  const params = useLocalSearchParams();
  const { formatPrice } = useCurrency();

  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalWeight, setTotalWeight] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [isWholesaleOrder, setIsWholesaleOrder] = useState(false);
  const [summary, setSummary] = useState<OrderSummary>({
    subtotal: 0,
    shipping: 0,
    discount: 0,
    total: 0
  });
  const [hasFreeShippingEligible, setHasFreeShippingEligible] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);

  // Chargement et calcul des données
  useEffect(() => {
    const loadOrderData = async () => {
      try {
        if (!params.orderData) {
          Alert.alert('Erreur', 'Aucune donnée de commande reçue. Retour au panier.');
          router.replace('/cart');
          return;
        }

        const parsedData = JSON.parse(params.orderData as string);

        if (!parsedData.items || parsedData.items.length === 0) {
          Alert.alert('Panier vide', 'Aucun article sélectionné');
          router.replace('/cart');
          return;
        }

        setOrderData(parsedData);
        setSelectedItems(parsedData.items || []);
        setSummary(parsedData.summary || {
          subtotal: 0,
          shipping: 0,
          discount: 0,
          total: 0
        });

        // Calculs généraux
        const quantity = parsedData.items.reduce((total: number, item: OrderItem) =>
          total + item.quantity, 0);
        setTotalQuantity(quantity);

        setIsWholesaleOrder(quantity >= 10 ||
          parsedData.items.some((item: OrderItem) => item.quantity >= 10));

// Remplace cette partie dans ton premier useEffect :
const weight = parsedData.items.reduce((total: number, item: OrderItem) => {
  // On vérifie d'abord dans specifications, puis à la racine, sinon 0
  const itemWeight = item.specifications?.weight ?? (item as any).weight ?? 0;
  return total + (item.quantity * Number(itemWeight));
}, 0);
setTotalWeight(weight);

const volume = parsedData.items.reduce((total: number, item: OrderItem) => {
  // Idem pour le volume
  const itemVolume = item.specifications?.volume ?? (item as any).volume ?? 0;
  return total + (item.quantity * Number(itemVolume));
}, 0);
setTotalVolume(volume);

        // ✅ Détection correcte du champ Firestore "hasFreeShipping"
        const freeEligible = parsedData.items.some(
          (item: OrderItem) => item.hasFreeShipping === true || item.price === 0
        );
        setHasFreeShippingEligible(freeEligible);

      } catch (error) {
        Alert.alert('Erreur', 'Impossible de charger les données de la commande');
        router.replace('/cart');
      } finally {
        setLoading(false);
      }
    };

    loadOrderData();
  }, [params.orderData]);

  // Construction dynamique des options de livraison
// Dans le useEffect qui construit shippingOptions
// Construction dynamique des options de livraison
  useEffect(() => {
    const options: ShippingOption[] = [];

    // Sécurité : On utilise le poids calculé (0.0 par défaut)
    const displayWeight = totalWeight > 0 ? totalWeight : 0;
    const displayVolume = totalVolume > 0 ? totalVolume : 0;

    // 1. Option gratuite (si éligible)
    if (hasFreeShippingEligible) {
      options.push({
        id: 'free_shipping',
        name: '🎁 Livraison Offerte',
        price: 0,
        deliveryTime: 'Variable selon articles',
        description: 'Profitez de la livraison gratuite sur vos articles éligibles.',
        type: 'free',
        details: 'Gratuite',
        explanation: 'Cette option est disponible pour vos articles bénéficiant de la livraison gratuite.'
      });
    }

    // 2. Options payantes
    options.push(
      {
        id: 'vol_express',
        name: '✈️ Vol Express',
        price: Math.ceil(displayWeight * 12000),
        deliveryTime: '5 jours',
        description: 'Livraison express par avion – Idéal pour les urgences',
        type: 'air',
        details: `${displayWeight.toFixed(2)} kg × ${formatPrice(12000)}`
      },
      {
        id: 'vol_cargo',
        name: '✈️ Vol Cargo',
        price: Math.ceil(displayWeight * 10000),
        deliveryTime: '2 semaines',
        description: 'Livraison économique par cargo aérien',
        type: 'air',
        details: `${displayWeight.toFixed(2)} kg × ${formatPrice(10000)}`
      },
      {
        id: 'voie_maritime',
        name: '🚢 Voie Maritime',
        price: Math.ceil(displayVolume * 295000),
        deliveryTime: '12 semaines',
        description: 'Livraison la plus économique par bateau',
        type: 'sea',
        details: `${displayVolume.toFixed(3)} CBM × ${formatPrice(295000)}`
      }
    );

    setShippingOptions(options);

    // Sélection par défaut
    if (options.length > 0) {
      setSelectedShipping(hasFreeShippingEligible ? 'free_shipping' : options[0].id);
    }
  }, [hasFreeShippingEligible, totalWeight, totalVolume, formatPrice]); // La ligne 214 est ici, bien fermée.


  const getSelectedShippingOption = () => {
    return shippingOptions.find(option => option.id === selectedShipping);
  };

  const handleContinue = () => {
    const selectedOption = getSelectedShippingOption();

    if (!selectedOption) {
      Alert.alert('Erreur', 'Veuillez sélectionner un mode de livraison');
      return;
    }

    if (!orderData || selectedItems.length === 0) {
      Alert.alert('Erreur', 'Données de commande manquantes');
      return;
    }

    const newTotal = summary.subtotal + selectedOption.price - summary.discount;

    const completeOrderData = {
      ...orderData,
      items: selectedItems,
      shipping: {
        method: selectedShipping,
        option: selectedOption,
        cost: selectedOption.price,
        details: `${selectedOption.name} - ${selectedOption.deliveryTime}`
      },
      summary: {
        ...summary,
        shipping: selectedOption.price,
        total: newTotal
      },
      selectedItems,
      timestamp: new Date().toISOString()
    };

    router.push({
      pathname: '/checkout/payment',
      params: {
        orderData: JSON.stringify(completeOrderData)
      }
    });
  };

  const renderShippingCalculations = () => (
    <View style={styles.calculationsSection}>
      <Text style={styles.calculationsTitle}>Calcul des frais de transport</Text>
      <View style={styles.calculationRow}>
        <Text style={styles.calculationLabel}>Articles commandés :</Text>
        <Text style={styles.calculationValue}>{selectedItems.length} produit(s)</Text>
      </View>
      <View style={styles.calculationRow}>
        <Text style={styles.calculationLabel}>Quantité totale :</Text>
        <Text style={styles.calculationValue}>{totalQuantity} unité(s)</Text>
      </View>
      <View style={styles.calculationRow}>
        <Text style={styles.calculationLabel}>Poids total estimé :</Text>
        <Text style={styles.calculationValue}>{totalWeight.toFixed(1)} kg</Text>
      </View>
      <View style={styles.calculationRow}>
        <Text style={styles.calculationLabel}>Volume total estimé :</Text>
        <Text style={styles.calculationValue}>{totalVolume.toFixed(2)} CBM</Text>
      </View>
      <View style={styles.calculationNote}>
        <Ionicons name="information-circle" size={16} color={COLORS.textLight} />
        <Text style={styles.calculationNoteText}>
          Calcul basé sur une estimation standard. Le prix final peut être ajusté après pesage réel.
        </Text>
      </View>
    </View>
  );

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
          {summary.discount > 0 && (
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryDiscountLabel}>Réduction :</Text>
              <Text style={styles.summaryDiscountValue}>-{formatPrice(summary.discount)}</Text>
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
            <Text style={styles.stepTextActive}>Livraison</Text>
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

        {renderShippingCalculations()}

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
                    <Text style={styles.shippingName}>{option.name}</Text>
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

                  <Text style={styles.shippingTime}>📅 {option.deliveryTime}</Text>
                  <Text style={styles.shippingDescription}>{option.description}</Text>

                  {/* Explication dédiée pour l'option gratuite */}
                  {isFree && option.explanation && (
                    <Text style={styles.freeExplanation}>{option.explanation}</Text>
                  )}

                  <Text style={styles.shippingDetails}>{option.details}</Text>
                </View>

                <View style={styles.shippingPriceContainer}>
                  {isFree ? (
                    <Text style={[styles.shippingPrice, styles.freePrice]}>GRATUIT</Text>
                  ) : (
                    <Text style={styles.shippingPrice}>{formatPrice(option.price)}</Text>
                  )}
                </View>

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
            <Text style={styles.infoItem}>
              • ✈️ <Text style={styles.infoBold}>Vol Express</Text> : {formatPrice(12000)}/kg
            </Text>
            <Text style={styles.infoItem}>
              • ✈️ <Text style={styles.infoBold}>Vol Cargo</Text> : {formatPrice(10000)}/kg
            </Text>
            <Text style={styles.infoItem}>
              • 🚢 <Text style={styles.infoBold}>Maritime</Text> : {formatPrice(295000)}/CBM
            </Text>
            {hasFreeShippingEligible && (
              <Text style={styles.infoItem}>
                • 🎁 <Text style={styles.infoBold}>Livraison Offerte</Text> : réservée aux articles éligibles
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
                Total :{' '}
                {formatPrice(
                  summary.subtotal + (getSelectedShippingOption()?.price || 0) - summary.discount
                )}
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
  summaryDiscountLabel: { fontSize: 13, color: COLORS.textLight },
  summaryDiscountValue: { fontSize: 13, fontWeight: '600', color: '#e53935' },
  wholesaleBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, padding: 8, borderRadius: 20, marginBottom: 16, alignSelf: 'center' },
  wholesaleBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },
  calculationsSection: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  calculationsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  calculationRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  calculationLabel: { fontSize: 14, color: COLORS.textLight },
  calculationValue: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  calculationNote: { flexDirection: 'row', gap: 8, marginTop: 12, padding: 12, backgroundColor: COLORS.background, borderRadius: 8 },
  calculationNoteText: { flex: 1, fontSize: 12, color: COLORS.textLight },
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
  shippingDetails: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
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