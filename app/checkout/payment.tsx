import React, { useState, useRef, useEffect, type ComponentProps } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCheckout } from '@/contexts/CheckoutContext';
import type { CheckoutPaymentMethod, PaymentPayload, PaymentResult } from '@/types/payment';
import { PAYMENT_ENDPOINTS } from '@/config/api';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseMoneyParam(value: string | string[] | undefined): number | null {
  const raw = firstParam(value);
  if (raw == null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function isLocalPaymentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.16.') ||
      host.startsWith('172.17.') ||
      host.startsWith('172.18.') ||
      host.startsWith('172.19.') ||
      host.startsWith('172.2') ||
      host.endsWith('.local')
    );
  } catch {
    return true;
  }
}

const COLORS = {
  primary: '#FF6A00',
  primaryLight: '#FFF0E6',
  primaryDark: '#E55A00',
  background: '#FFFAF5',
  success: '#28A745',
  error: '#DC3545',
  text: '#2D3748',
  textLight: '#718096',
  border: '#E2E8F0',
  white: '#FFFFFF',
  fedapayPurple: '#662D91',
  paydunyaBlue: '#0065ff',
};

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    shippingFee?: string | string[];
    shippingMethod?: string | string[];
    shippingOptionName?: string | string[];
    shippingDetails?: string | string[];
    subtotal?: string | string[];
    total?: string | string[];
  }>();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const { orderData, setSummary } = useCheckout();

  // ✅ Méthode sélectionnée changée par défaut vers NGenius
  const [selectedMethod, setSelectedMethod] = useState<CheckoutPaymentMethod>('ngenius_card');
  const [isProcessing, setIsProcessing] = useState(false);
  const hasSubmittedRef = useRef(false);
  const isSubmittingRef = useRef(false); // ✅ Verrou synchrone pour clics multiples
  const summarySyncRef = useRef<string | null>(null);

  const computeItemsSubtotal = (items: Array<{ price: number; quantity: number }>) =>
    items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const hasOrderData = Boolean(orderData);
  const subtotalParam = parseMoneyParam(params.subtotal);
  const shippingFeeParam = parseMoneyParam(params.shippingFee);
  const orderItems = orderData?.items ?? [];
  const itemsSignature = orderItems
    .map((item) => `${String(item.id)}:${Number(item.price)}:${Number(item.quantity)}`)
    .join('|');
  const summarySubtotal = Number(orderData?.summary?.subtotal) || 0;
  const summaryShipping = Number(orderData?.summary?.shipping) || 0;
  const summaryDiscount = Number(orderData?.summary?.discount) || 0;
  const summaryTotal = Number(orderData?.summary?.total) || 0;
  const contextShipping =
    Number(orderData?.shipping?.cost ?? orderData?.summary?.shipping) || 0;
  const normalizedSubtotal = subtotalParam ?? computeItemsSubtotal(orderItems);
  const normalizedShipping = shippingFeeParam ?? contextShipping;
  const normalizedSummary = {
    subtotal: normalizedSubtotal,
    shipping: normalizedShipping,
    discount: 0,
    total: normalizedSubtotal + normalizedShipping,
  };
  const isNgeniusSelected = selectedMethod === 'ngenius_card';

  useEffect(() => {
    if (!hasOrderData) {
      router.replace('/cart');
    }
  }, [hasOrderData, router]);

  useEffect(() => {
    if (!hasOrderData) return;
    const syncKey = `${normalizedSummary.subtotal}|${normalizedSummary.shipping}|${normalizedSummary.total}`;
    if (summarySyncRef.current === syncKey) {
      return;
    }
    const gap =
      Math.abs(summarySubtotal - normalizedSummary.subtotal) > 1 ||
      Math.abs(summaryShipping - normalizedSummary.shipping) > 1 ||
      Math.abs(summaryTotal - normalizedSummary.total) > 1 ||
      summaryDiscount !== 0;
    if (!gap) {
      summarySyncRef.current = syncKey;
      return;
    }
    summarySyncRef.current = syncKey;
    setSummary(normalizedSummary);
  }, [
    hasOrderData,
    itemsSignature,
    normalizedSummary.subtotal,
    normalizedSummary.shipping,
    normalizedSummary.total,
    setSummary,
    summaryDiscount,
    summaryShipping,
    summarySubtotal,
    summaryTotal,
  ]);

  if (!orderData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const handlePayment = async () => {
    // ✅ Bloque instantanément si une soumission est déjà en cours
    if (isSubmittingRef.current || isProcessing || hasSubmittedRef.current) return;
    
    if (!user) {
      Alert.alert('Connexion requise', 'Veuillez vous reconnecter avant de payer.');
      router.replace('/(tabs)/account');
      return;
    }

    isSubmittingRef.current = true;
    hasSubmittedRef.current = true;

    const finalAmount = Math.round(Number(normalizedSummary.total));

    const itemsWithSpecs = orderData.items.map((item) => ({
      ...item,
      specifications: {
        weight: item.specifications?.weight ?? 0,
        volume: item.specifications?.volume ?? 0,
      },
    }));

    const payload: PaymentPayload = {
      orderId: `ORD-${Date.now()}`,
      userId: user.uid,
      amount: finalAmount,
      currencyCode: 'XOF',
      email: user.email ?? `${user.uid}@a2-expres.com`,
      firstname: user.displayName?.split(' ')[0] ?? 'Client',
      lastname: user.displayName?.split(' ')[1] ?? 'A2Express',
      method: selectedMethod,
      items: itemsWithSpecs,
      summary: { ...normalizedSummary, total: finalAmount },
      shippingAddress: orderData.shippingAddress,
    };

    try {
      setIsProcessing(true);

      let endpoint: string;
      if (isNgeniusSelected) {
        endpoint = PAYMENT_ENDPOINTS.ngenius;
      } else if (selectedMethod.startsWith('fedapay')) {
        endpoint = PAYMENT_ENDPOINTS.fedapay;
      } else if (selectedMethod === 'paydunya') {
        endpoint = PAYMENT_ENDPOINTS.paydunya;
      } else {
        endpoint = PAYMENT_ENDPOINTS.ngenius;
      }

      if (isNgeniusSelected && isLocalPaymentUrl(endpoint)) {
        throw new Error(
          "Le backend de paiement n'est pas configure sur une URL Render de production accessible depuis le mobile.",
        );
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result: PaymentResult = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? 'Erreur de configuration.');
      }

      if (result.url) {
        router.push({
          pathname: '/checkout/payment-webview' as never,
          params: {
            paymentUrl: result.url,
            orderId: payload.orderId,
            userId: user.uid,
          },
        });
      } else {
        hasSubmittedRef.current = false;
        Alert.alert('Paiement indisponible', result.error ?? 'URL de paiement introuvable.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur réseau';
      console.error(isNgeniusSelected ? '[Payment][NGenius] Erreur:' : '[Payment] Erreur:', message);
      Alert.alert(isNgeniusSelected ? 'Erreur de paiement' : 'Paiement indisponible', message);
      hasSubmittedRef.current = false;
    } finally {
      setIsProcessing(false);
      // Débloque le verrou synchrone après traitement
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1000);
    }
  };

  const renderMethodCard = (id: CheckoutPaymentMethod, title: string, subtitle: string, icon: IoniconsName, color: string) => (
    <TouchableOpacity 
      style={[
        styles.methodCard, 
        selectedMethod === id && { borderColor: color, backgroundColor: color + '08' } 
      ]} 
      onPress={() => setSelectedMethod(id)}
      disabled={isProcessing}
    >
      <View style={[styles.methodIcon, { backgroundColor: color + '15' }]}>
         <Ionicons name={icon} size={26} color={color} />
      </View>
      <View style={styles.methodInfo}>
        <Text style={[styles.methodName, selectedMethod === id && { color: color }]}>{title}</Text>
        <Text style={styles.methodDescription}>{subtitle}</Text>
      </View>
      <View style={[styles.radio, selectedMethod === id && { borderColor: color, backgroundColor: color }]}>
        {selectedMethod === id && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.headerTitle}>Mode de Paiement</Text>
        <Text style={styles.headerSubtitle}>Sélectionnez votre méthode préférée</Text>

        <View style={styles.methodsList}>
          {renderMethodCard(
            'ngenius_card', 
            'Carte Visa, Mastercard, Orange Visa/Mastercard', 
            'Paiement par carte bancaire sécurisé', 
            'card-outline', 
            COLORS.primary
          )}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Résumé de la transaction</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total</Text>
            <Text style={styles.summaryValue}>{formatPrice(normalizedSummary.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Frais de livraison</Text>
            <Text style={styles.summaryValue}>{formatPrice(normalizedSummary.shipping)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total à payer</Text>
            <Text style={styles.totalValue}>{formatPrice(normalizedSummary.total)}</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.payButton, isProcessing && styles.payButtonDisabled]} 
          onPress={handlePayment}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <>
              <ActivityIndicator color={COLORS.white} />
              <Text style={styles.payButtonText}>
                Connexion sécurisée...
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.payButtonText}>Procéder au paiement</Text>
              <Ionicons name="lock-closed" size={20} color={COLORS.white} />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textLight} />
          <Text style={styles.securityNoteText}>
            Paiement sécurisé via Carte Visa, Mastercard, Orange Visa/Mastercard.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 50 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text, marginBottom: 5 },
  headerSubtitle: { fontSize: 14, color: COLORS.textLight, marginBottom: 25 },
  methodsList: { marginBottom: 30 },
  methodCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.white, 
    padding: 18, 
    borderRadius: 16, 
    marginBottom: 15, 
    borderWidth: 2, 
    borderColor: 'transparent',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  methodIcon: { 
    width: 50, 
    height: 50, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  methodInfo: { flex: 1, marginLeft: 15 },
  methodName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  methodDescription: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  radio: { 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    borderWidth: 2, 
    borderColor: COLORS.border, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  summaryCard: { 
    backgroundColor: COLORS.white, 
    padding: 20, 
    borderRadius: 20, 
    marginBottom: 30,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 15 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 14, color: COLORS.textLight },
  summaryValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 15 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  totalValue: { fontSize: 22, fontWeight: '900', color: COLORS.primary },
  payButton: { 
    backgroundColor: COLORS.primary, 
    padding: 20, 
    borderRadius: 16, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 12,
    elevation: 5,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  payButtonDisabled: { opacity: 0.5, elevation: 0 },
  payButtonText: { color: COLORS.white, fontSize: 18, fontWeight: 'bold' },
  securityNote: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 20, 
    gap: 8 
  },
  securityNoteText: { fontSize: 11, color: COLORS.textLight, textAlign: 'center' }
});