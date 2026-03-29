import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ScrollView,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext'; 

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

type PaymentMethodType = 'fedapay_mobile' | 'fedapay_card' | 'ngenius_card' | 'paydunya';

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { formatPrice } = useCurrency(); 

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('fedapay_mobile');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const hasSubmittedRef = useRef(false);

  const API_URL = 'https://ngenius-backend.onrender.com';

  useEffect(() => {
    try {
      if (!params.orderData) {
        router.replace('/cart');
        return;
      }
      const parsed = JSON.parse(params.orderData as string);
      
      const subtotal = parseFloat(parsed.summary.subtotal || 0);
      const shipping = parseFloat(parsed.summary.shipping || 0);
      
      parsed.summary.total = subtotal + shipping;
      
      setOrderData(parsed);
    } catch (e) {
      console.error("Erreur parsing:", e);
      router.replace('/cart');
    } finally {
      setLoading(false);
    }
  }, [params.orderData]);

  const handlePayment = async () => {
    if (!orderData || isProcessing || !user) return;
    if (hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;

    const finalAmount = Math.round(parseFloat(orderData.summary.total));
    
    // ✅ CORRECTION : On s'assure que le poids voyage bien vers le backend
    const itemsWithSpecs = orderData.items.map((item: any) => ({
      ...item,
      specifications: {
        weight: item.specifications?.weight || "0",
        volume: item.specifications?.volume || "0",
      }
    }));

    const payload = {
      orderId: `ORD-${Date.now()}`,
      userId: user.uid,
      amount: finalAmount,
      currencyCode: "XOF",
      email: user.email || `${user.uid}@a2-expres.com`,
      firstname: user.displayName?.split(' ')[0] || 'Client',
      lastname: user.displayName?.split(' ')[1] || 'A2Express',
      method: selectedMethod,
      items: itemsWithSpecs, // Utilise les items avec specs
      summary: {
        ...orderData.summary,
        total: finalAmount
      },
      shippingAddress: orderData.shippingAddress
    };

    console.log("🚀 [A2Express] Envoi au Backend :", JSON.stringify(payload, null, 2));

    try {
      setIsProcessing(true);
      
      let endpoint = `${API_URL}/create-payment`;
      if (selectedMethod.startsWith("fedapay")) {
        endpoint = `${API_URL}/create-fedapay-payment`;
      } else if (selectedMethod === "paydunya") {
        endpoint = `${API_URL}/create-paydunya-payment`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      console.log("📥 [A2Express] Réponse du Serveur :", JSON.stringify(result, null, 2));

      if (!response.ok) {
        throw new Error(result?.error || "Erreur de configuration.");
      }

      if (result?.url) {
        router.push({
          pathname: "/checkout/payment-webview" as any,
          params: {
            paymentUrl: result.url,
            orderId: payload.orderId,
            userId: user.uid,
            orderData: JSON.stringify(orderData),
          },
        });
      } else {
        // Backend OK, mais pas d'URL => autoriser à réessayer
        hasSubmittedRef.current = false;
        Alert.alert("Paiement indisponible", result?.error || "URL de paiement introuvable.");
      }
    } catch (error: any) {
      console.error("❌ [A2Express] Erreur Paiement :", error.message);
      Alert.alert("Paiement indisponible", error.message);
      hasSubmittedRef.current = false;
    } finally {
      setIsProcessing(false);
    }
  };

  const renderMethodCard = (id: PaymentMethodType, title: string, subtitle: string, icon: any, color: string) => (
    <TouchableOpacity 
      style={[
        styles.methodCard, 
        selectedMethod === id && { borderColor: color, backgroundColor: color + '08' } 
      ]} 
      onPress={() => setSelectedMethod(id)}
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

  if (loading) return (
    <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.headerTitle}>Mode de Paiement</Text>
        <Text style={styles.headerSubtitle}>Sélectionnez votre méthode préférée</Text>

        <View style={styles.methodsList}>
          {renderMethodCard('paydunya', 'PayDunya', 'Orange Money, Wave, Surtout au Sénégal/CI', 'wallet-outline', COLORS.paydunyaBlue)}
          {renderMethodCard('fedapay_mobile', 'Mobile Money (FedaPay)', 'Orange, MTN, Moov, Wave', 'phone-portrait-outline', COLORS.fedapayPurple)}
          {renderMethodCard('ngenius_card', 'Carte Internationale (Orabank)', 'Visa, MasterCard via NGenius', 'globe-outline', COLORS.primary)}
          {renderMethodCard('fedapay_card', 'Carte Bancaire (FedaPay)', 'Option de secours Visa/MasterCard', 'card-outline', COLORS.fedapayPurple)}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Résumé de la transaction</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Sous-total</Text>
            <Text style={styles.summaryValue}>{formatPrice(orderData.summary.subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Frais de livraison</Text>
            <Text style={styles.summaryValue}>{formatPrice(orderData.summary.shipping)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total à payer</Text>
            <Text style={styles.totalValue}>{formatPrice(orderData.summary.total)}</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.payButton, isProcessing && styles.payButtonDisabled]} 
          onPress={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color={COLORS.white} />
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
            Paiement sécurisé via PayDunya, FedaPay & NGenius.
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
  methodName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
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