import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ScrollView, 
  TextInput, Alert, StatusBar 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency } from '../../src/contexts/CurrencyContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCheckout } from '../../src/contexts/CheckoutContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRequireAuth } from '../../src/contexts/AuthGuardContext';
import type { OrderData, ShippingAddress } from '../../src/types/order';
import type { CartItem } from '../../src/types/cart';
import { useWarehouseFees } from '../../src/hooks/useWarehouseFees';
import {
  anyZeroFcfaMissingWarehouse,
  computeWarehouseFeeBreakdown,
  formatWarehouseFeeUsd,
  ZERO_FCFA_UNAVAILABLE_MESSAGE,
} from '../../src/utils/warehouseFee';

const COLORS = {
  primary: '#FF6A00',
  primaryLight: '#FFF0E6',
  primaryDark: '#E55A00',
  background: '#FFFAF5',
  success: '#28A745',
  text: '#2D3748',
  textLight: '#718096',
  border: '#E2E8F0',
  white: '#FFFFFF'
};

export default function CheckoutAddress() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { formatPrice } = useCurrency();
  const insets = useSafeAreaInsets();
  const { orderData: ctxOrder, initOrder, setShippingAddress: ctxSetAddress, setSummary } = useCheckout();
  const { user, isLoading: authLoading } = useAuth();
  const { requireAuth } = useRequireAuth();
  const { config: warehouseFeesConfig } = useWarehouseFees();
  const guestRedirected = useRef(false);

  useEffect(() => {
    if (authLoading || guestRedirected.current) return;
    if (!user) {
      guestRedirected.current = true;
      requireAuth({ reason: 'checkout', href: '/(tabs)/cart' });
      router.replace('/(tabs)/cart');
    }
  }, [authLoading, requireAuth, router, user]);

  /** Parse pur (sans setState) — évite initOrder() pendant le rendu. */
  const orderFromParams = useMemo((): OrderData | null => {
    const raw = params.orderData;
    if (!raw || typeof raw !== "string") return null;
    try {
      return JSON.parse(decodeURIComponent(raw)) as OrderData;
    } catch {
      try {
        return JSON.parse(raw) as OrderData;
      } catch (e) {
        console.error("Erreur de parsing orderData", e);
        return null;
      }
    }
  }, [params.orderData]);

  const getOrderFingerprint = (order: OrderData | null): string => {
    if (!order) return '';
    const itemsFingerprint = (order.items || [])
      .map((item) => `${item.id}:${Number(item.price)}:${Number(item.quantity)}`)
      .join('|');
    const subtotal = Number(order.summary?.subtotal) || 0;
    const shipping = Number(order.summary?.shipping) || 0;
    const total = Number(order.summary?.total) || 0;
    return `${itemsFingerprint}::${subtotal}:${shipping}:${total}`;
  };

  const paramsFingerprint = useMemo(
    () => getOrderFingerprint(orderFromParams),
    [orderFromParams],
  );
  const contextFingerprint = useMemo(
    () => getOrderFingerprint(ctxOrder),
    [ctxOrder],
  );

  /**
   * Hydrate/synchronise le CheckoutProvider avec les params:
   * - évite les données obsolètes (ancienne commande encore en contexte)
   * - garantit la cohérence des quantités entre écran produit et checkout
   */
  useEffect(() => {
    if (orderFromParams?.items?.length && paramsFingerprint !== contextFingerprint) {
      initOrder(orderFromParams);
    }
  }, [orderFromParams, initOrder, paramsFingerprint, contextFingerprint]);

  // Priorité aux params quand présents (commande la plus récente).
  const resolvedOrder: OrderData | null = orderFromParams ?? ctxOrder;
  const selectedItems: CartItem[] = resolvedOrder?.items ?? [];

  const [address, setAddress] = useState<ShippingAddress>({
    fullName: '',
    phone: '',
    city: '',
    country: '',
    street: '',
    postalCode: '',
    apartment: '',
    building: '',
    floor: '',
    deliveryNote: '',
  });

  // Le checkout doit conserver le prix unitaire déjà validé sur la fiche produit.
  // Aucune remise "gros" automatique ne doit être recalculée ici.
  const subtotal = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0,
      ),
    [selectedItems],
  );

  const warehouseBreakdown = useMemo(
    () => computeWarehouseFeeBreakdown(selectedItems, warehouseFeesConfig),
    [selectedItems, warehouseFeesConfig],
  );

  const payableTotal = subtotal + warehouseBreakdown.warehouseFeeTotal;

  // VÉRIFICATION DES CHAMPS (SÉCURITÉ)
  const isFormValid = useMemo(() => {
    return (
      address.fullName.trim() !== '' &&
      address.phone.trim() !== '' &&
      address.street.trim() !== '' &&
      address.city.trim() !== '' &&
      address.country.trim() !== ''
    );
  }, [address]);

  const handleContinue = () => {
    // Sécurité supplémentaire avant la navigation
    if (!isFormValid) {
      Alert.alert(
        "Informations manquantes",
        "Veuillez remplir tous les champs obligatoires (*) pour continuer.",
        [{ text: "Compris" }]
      );
      return;
    }

    if (anyZeroFcfaMissingWarehouse(selectedItems, warehouseFeesConfig)) {
      Alert.alert("Indisponible", ZERO_FCFA_UNAVAILABLE_MESSAGE);
      return;
    }

    const updatedItems = selectedItems.map((item) => ({ ...item }));

    const newSummary = {
      subtotal,
      shipping: 0,
      discount: 0,
      warehouseFees: warehouseBreakdown.lines,
      warehouseFeeTotal: warehouseBreakdown.warehouseFeeTotal,
      total: payableTotal,
    };

    const addressPayload: ShippingAddress = {
      ...address,
      postalCode: address.postalCode?.trim() || undefined,
      apartment: address.apartment?.trim() || undefined,
      building: address.building?.trim() || undefined,
      floor: address.floor?.trim() || undefined,
      deliveryNote: address.deliveryNote?.trim() || undefined,
    };

    ctxSetAddress(addressPayload);
    setSummary(newSummary);
    // Mise à jour des items avec prix de gros dans le contexte
    initOrder({
      items: updatedItems,
      summary: newSummary,
      shippingAddress: addressPayload,
    });

    router.push({ pathname: '/checkout/shipping' });
  };

  if (!resolvedOrder || selectedItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={64} color={COLORS.textLight} />
        <Text style={styles.emptyTitle}>Aucun article sélectionné</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={() => router.replace('/cart')}>
          <Text style={styles.emptyButtonText}>Retour au panier</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <StatusBar barStyle="dark-content" />
      
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stepper visuel */}
        <View style={styles.progressHeader}>
          <View style={styles.progressStep}>
            <View style={[styles.stepIndicator, styles.stepActive]}><Text style={styles.stepNumber}>1</Text></View>
            <Text style={styles.stepTextActive}>Adresse</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.progressStep}>
            <View style={styles.stepIndicator}><Text style={styles.stepNumber}>2</Text></View>
            <Text style={styles.stepText}>À confirmer</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.progressStep}>
            <View style={styles.stepIndicator}><Text style={styles.stepNumber}>3</Text></View>
            <Text style={styles.stepText}>Paiement</Text>
          </View>
        </View>

        <Text style={styles.title}>Informations de livraison</Text>
        
        {/* RÉCAPITULATIF */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Résumé de la sélection</Text>
          {selectedItems.map((item, index) => (
             <View key={index} style={styles.miniItem}>
               <Text style={styles.productName} numberOfLines={1}>{item.name} x{item.quantity}</Text>
               <Text style={styles.wholesalePrice}>
                 {formatPrice(Number(item.price) * Number(item.quantity))}
               </Text>
             </View>
          ))}
          {warehouseBreakdown.lines.map((fee) => (
            <View key={fee.warehouseId} style={styles.miniItem}>
              <Text style={styles.productName} numberOfLines={1}>
                Entrepôt de {fee.label}
              </Text>
              <Text style={styles.wholesalePrice}>
                {formatWarehouseFeeUsd(fee.feeUsd)}
              </Text>
            </View>
          ))}
        </View>

        {/* FORMULAIRE — ordre : identité → contact → localisation → rue → optionnels */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Adresse de livraison</Text>
          <Text style={styles.formHint}>
            Champs obligatoires (*). Compléments (appartement, étage…) facultatifs.
          </Text>

          <Text style={styles.fieldLabel}>Nom complet *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom et prénom du destinataire"
            placeholderTextColor="#A0AEC0"
            value={address.fullName}
            onChangeText={(text) => setAddress({ ...address, fullName: text })}
          />

          <Text style={styles.fieldLabel}>Numéro de téléphone *</Text>
          <TextInput
            style={styles.input}
            placeholder="Téléphone (appel / WhatsApp)"
            placeholderTextColor="#A0AEC0"
            keyboardType="phone-pad"
            value={address.phone}
            onChangeText={(text) => setAddress({ ...address, phone: text })}
          />

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Ville *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ville"
                placeholderTextColor="#A0AEC0"
                value={address.city}
                onChangeText={(text) => setAddress({ ...address, city: text })}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Pays *</Text>
              <TextInput
                style={styles.input}
                placeholder="Pays"
                placeholderTextColor="#A0AEC0"
                value={address.country}
                onChangeText={(text) => setAddress({ ...address, country: text })}
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Rue, numéro, voie *</Text>
          <TextInput
            style={styles.input}
            placeholder="Adresse — rue, numéro, quartier…"
            placeholderTextColor="#A0AEC0"
            value={address.street}
            onChangeText={(text) => setAddress({ ...address, street: text })}
          />

          <Text style={styles.fieldLabel}>Code postal (facultatif)</Text>
          <TextInput
            style={styles.input}
            placeholder="Code postal"
            placeholderTextColor="#A0AEC0"
            value={address.postalCode ?? ''}
            onChangeText={(text) => setAddress({ ...address, postalCode: text })}
          />

          <Text style={styles.optionalSection}>Complément d’adresse (facultatif)</Text>

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabelSub}>Appartement</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex. A12"
                placeholderTextColor="#A0AEC0"
                value={address.apartment ?? ''}
                onChangeText={(text) => setAddress({ ...address, apartment: text })}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabelSub}>Bâtiment</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex. Tour B"
                placeholderTextColor="#A0AEC0"
                value={address.building ?? ''}
                onChangeText={(text) => setAddress({ ...address, building: text })}
              />
            </View>
          </View>

          <Text style={styles.fieldLabelSub}>Étage</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex. 3e étage"
            placeholderTextColor="#A0AEC0"
            value={address.floor ?? ''}
            onChangeText={(text) => setAddress({ ...address, floor: text })}
          />

          <Text style={styles.fieldLabelSub}>Note pour le livreur (facultatif)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Digicode, horaires, point de retrait…"
            placeholderTextColor="#A0AEC0"
            value={address.deliveryNote ?? ''}
            onChangeText={(text) => setAddress({ ...address, deliveryNote: text })}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* FOOTER FIXE */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 15) }]}>
        <TouchableOpacity 
          style={[
            styles.continueButton, 
            !isFormValid && { opacity: 0.6 } // Le bouton devient plus clair si le formulaire est vide
          ]} 
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>Continuer</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  progressStep: { alignItems: 'center', gap: 4 },
  stepIndicator: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  stepActive: { backgroundColor: COLORS.primary },
  stepNumber: { color: COLORS.white, fontSize: 14, fontWeight: 'bold' },
  stepText: { fontSize: 11, color: COLORS.textLight },
  stepTextActive: { fontSize: 11, color: COLORS.primary, fontWeight: 'bold' },
  progressLine: { width: 30, height: 2, backgroundColor: COLORS.border, marginHorizontal: 5 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: COLORS.text },
  summarySection: { backgroundColor: COLORS.white, padding: 16, borderRadius: 16, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12, color: COLORS.text },
  wholesaleBadge: { backgroundColor: COLORS.success, padding: 8, borderRadius: 10, marginBottom: 12 },
  wholesaleBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  miniItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  productName: { flex: 1, fontSize: 13, color: COLORS.textLight, marginRight: 10 },
  wholesalePrice: { fontWeight: '700', color: COLORS.text, fontSize: 13 },
  form: { backgroundColor: COLORS.white, padding: 20, borderRadius: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 },
  formTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: COLORS.text },
  formHint: { fontSize: 12, color: COLORS.textLight, marginBottom: 14, lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  fieldLabelSub: { fontSize: 12, fontWeight: '600', color: '#64748B', marginBottom: 6 },
  optionalSection: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginTop: 8, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: COLORS.border, padding: 12, borderRadius: 12, marginBottom: 12, backgroundColor: '#FAFAFA', color: COLORS.text },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  halfField: { flex: 1 },
  halfInput: { flex: 1 },
  textArea: { minHeight: 88, paddingTop: 12 },
  footer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 50,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 20,
  },
  continueButton: { 
    backgroundColor: COLORS.primary, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8, 
    paddingVertical: 12, 
    borderRadius: 30, 
    elevation: 3 
  },
  continueButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: COLORS.background },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 15, color: COLORS.text },
  emptyButton: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, marginTop: 20 },
  emptyButtonText: { color: '#fff', fontWeight: '700' }
});