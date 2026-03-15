import React, { useState, useMemo } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ScrollView, 
  TextInput, Alert, StatusBar 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency } from '../../src/contexts/CurrencyContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

  // Récupération sécurisée des données du panier
  const initialOrderData = useMemo(() => {
    try {
      return params.orderData ? JSON.parse(decodeURIComponent(params.orderData as string)) : null;
    } catch (e) {
      console.error("Erreur de parsing orderData", e);
      return null;
    }
  }, [params.orderData]);

  const selectedItems = initialOrderData?.items || [];

  const [address, setAddress] = useState({
    fullName: '',
    street: '',
    city: '',
    postalCode: '0000',
    country: '',
    phone: ''
  });

  // Logique du prix de gros
  const getWholesalePrice = (price: number, quantity: number) => {
    if (quantity >= 100) return price * 0.70;
    if (quantity >= 50) return price * 0.75;
    if (quantity >= 20) return price * 0.80;
    if (quantity >= 10) return price * 0.85;
    return price;
  };

  const { isWholesaleOrder, subtotal, savings } = useMemo(() => {
    let totalOriginal = 0;
    let totalWholesale = 0;
    let wholesaleActive = false;

    selectedItems.forEach((item: any) => {
      const price = Number(item.price);
      const qty = Number(item.quantity);
      totalOriginal += price * qty;
      
      const wPrice = getWholesalePrice(price, qty);
      totalWholesale += wPrice * qty;
      
      if (qty >= 10) wholesaleActive = true;
    });

    return {
      isWholesaleOrder: wholesaleActive,
      subtotal: totalWholesale,
      savings: totalOriginal - totalWholesale
    };
  }, [selectedItems]);

const handleContinue = () => {

  const orderDataToSend = {
    ...initialOrderData,

    items: selectedItems.map((item: any) => ({
      ...item,
      price: getWholesalePrice(Number(item.price), Number(item.quantity))
    })),

    summary: {
      subtotal: subtotal,
      shipping: 0,
      discount: savings,
      total: subtotal
    },

    shippingAddress: {
      fullName: address.fullName,
      phone: address.phone,
      street: address.street,
      city: address.city,
      postalCode: address.postalCode,
      country: address.country
    }
  };

  router.push({
    pathname: '/checkout/shipping',
    params: { orderData: JSON.stringify(orderDataToSend) }
  });

};
  if (!initialOrderData || selectedItems.length === 0) {
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
            <Text style={styles.stepText}>Livraison</Text>
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
          {isWholesaleOrder && (
            <View style={styles.wholesaleBadge}>
              <Text style={styles.wholesaleBadgeText}>
                🚀 Économie de gros appliquée : -{formatPrice(savings)}
              </Text>
            </View>
          )}
          {selectedItems.map((item: any, index: number) => (
             <View key={index} style={styles.miniItem}>
               <Text style={styles.productName} numberOfLines={1}>{item.name} x{item.quantity}</Text>
               <Text style={styles.wholesalePrice}>
                 {formatPrice(getWholesalePrice(Number(item.price), Number(item.quantity)) * item.quantity)}
               </Text>
             </View>
          ))}
        </View>

        {/* FORMULAIRE */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Où devons-nous livrer ?</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom complet *"
            placeholderTextColor="#A0AEC0"
            value={address.fullName}
            onChangeText={(text) => setAddress({...address, fullName: text})}
          />
          <TextInput
            style={styles.input}
            placeholder="Téléphone (WhatsApp) *"
            placeholderTextColor="#A0AEC0"
            keyboardType="phone-pad"
            value={address.phone}
            onChangeText={(text) => setAddress({...address, phone: text})}
          />
          <TextInput
            style={styles.input}
            placeholder="Quartier, Rue, Porte *"
            placeholderTextColor="#A0AEC0"
            value={address.street}
            onChangeText={(text) => setAddress({...address, street: text})}
          />
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Ville *"
              value={address.city}
              onChangeText={(text) => setAddress({...address, city: text})}
            />
<TextInput
  style={[styles.input, styles.halfInput]} // J'ai enlevé le fond gris
  placeholder="Pays *"
  placeholderTextColor="#A0AEC0"
  value={address.country}
  editable={true} // Remets-le à true ou supprime simplement la ligne
  onChangeText={(text) => setAddress({...address, country: text})} // Ajoute ça !
/>
          </View>
        </View>
      </ScrollView>

      {/* FOOTER FIXE ET AFFINÉ */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 15) }]}>
        <TouchableOpacity 
          style={styles.continueButton} 
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
  formTitle: { fontSize: 16, fontWeight: '700', marginBottom: 15, color: COLORS.text },
  input: { borderWidth: 1, borderColor: COLORS.border, padding: 12, borderRadius: 12, marginBottom: 12, backgroundColor: '#FAFAFA', color: COLORS.text },
  row: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },
  footer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 50, // Resserre le bouton vers le centre
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