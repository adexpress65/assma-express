import React, { useState, useEffect } from 'react';
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
  orangeOM: '#FF7900', // Couleur officielle Orange Money
  paydunyaBlue: '#0070BA'
};

type PaymentMethodType = 'paydunya_om' | 'paydunya_card' | 'ngenius_card';

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { formatPrice, currency } = useCurrency(); 

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>('paydunya_om');
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Ton URL backend déployée sur Render
  const API_URL = 'https://ngenius-backend.onrender.com';

  useEffect(() => {
    try {
      if (!params.orderData) {
        router.replace('/cart');
        return;
      }
      const parsed = JSON.parse(params.orderData as string);
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

  try {
    setIsProcessing(true);

    const orderId = `ORD-${Date.now()}`;
    const isPayDunya = selectedMethod.startsWith("paydunya");
    const isNgenius = selectedMethod === "ngenius_card";

    const endpoint = isPayDunya
      ? `${API_URL}/create-paydunya-payment`
      : `${API_URL}/create-payment`;

    // --- CORRECTION DU MONTANT ---
    // NGenius : 2.96 -> 296 (centimes)
    // PayDunya : 2000.5 -> 2001 (entier)
    const rawTotal = parseFloat(orderData.summary.total);
    const finalAmount = isNgenius 
      ? Math.round(rawTotal * 100) 
      : Math.round(rawTotal);

const payload = {
  orderId,
  userId: user.uid,
  amount: Math.round(parseFloat(orderData.summary.total)), // Pas de * 100 pour le XOF
  currencyCode: "XOF", // Force le test en XOF
  itemsCount: orderData.items.length,
  method: selectedMethod,
};

    console.log("🚀 Payload envoyé :", payload);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let result: any;

    try {
      result = JSON.parse(text);
    } catch {
      throw new Error("Réponse serveur invalide.");
    }

    if (!response.ok) {
      // Affiche l'erreur précise retournée par NGenius
      throw new Error(result?.error || result?.message || "Erreur serveur.");
    }

    const finalUrl = result?.url || result?.paymentUrl;

    if (!finalUrl || !finalUrl.startsWith("http")) {
      throw new Error("Lien de paiement invalide.");
    }

    // ✅ Redirection vers WebView
    router.push({
      pathname: "/checkout/payment-webview",
      params: {
        paymentUrl: finalUrl,
        orderId,
        userId: user.uid,
        orderData: JSON.stringify(orderData),
      },
    });

  } catch (error: any) {
    Alert.alert(
      "Paiement indisponible",
      error.message || "Une erreur est survenue."
    );
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
          {/* Orange Money Mali - Via PayDunya */}
          {renderMethodCard(
            'paydunya_om', 
            'Orange Money Mali', 
            'Paiement mobile sécurisé', 
            'phone-portrait-outline', 
            COLORS.orangeOM
          )}

          {/* Cartes Bancaires - Via PayDunya */}
          {renderMethodCard(
            'paydunya_card', 
            'Carte Bancaire (PayDunya)', 
            'Visa, MasterCard, GIM-UEMOA', 
            'card-outline', 
            COLORS.paydunyaBlue
          )}

          {/* NGenius - Option alternative */}
          {renderMethodCard(
            'ngenius_card', 
            'Carte Internationale (NGenius)', 
            'Visa, MasterCard (Global)', 
            'globe-outline', 
            COLORS.primary
          )}
        </View>

        {/* Résumé de la commande */}
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

        {/* Bouton d'action */}
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
            Vos données sont protégées par un cryptage SSL de niveau bancaire.
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
    // Shadow pour iOS/Android
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