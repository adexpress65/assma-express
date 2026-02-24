import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ScrollView, 
  TextInput, Alert, ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCart } from '../../src/contexts/CartContext';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency } from '../../src/contexts/CurrencyContext'; // Import du contexte de devise

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
  const { cartItems, getTotalPrice, getTotalItems } = useCart();
  const { formatPrice } = useCurrency(); // Hook pour les devises
  
  const [loading, setLoading] = useState(true);
  const [address, setAddress] = useState({
    fullName: '',
    street: '',
    city: 'Bamako',
    postalCode: '0000',
    country: 'Mali',
    phone: ''
  });

  const [isWholesaleOrder, setIsWholesaleOrder] = useState(false);
  const [wholesaleSavings, setWholesaleSavings] = useState(0);

  useEffect(() => {
    const quantity = getTotalItems();
    const wholesale = quantity >= 10 || cartItems.some(item => item.quantity >= 10);
    setIsWholesaleOrder(wholesale);

    const originalTotal = getTotalPrice();
    const wholesaleTotal = cartItems.reduce((total, item) => {
      return total + (getWholesalePrice(item) * item.quantity);
    }, 0);
    
    setWholesaleSavings(Math.max(0, originalTotal - wholesaleTotal));
    setLoading(false);
  }, [cartItems]);

  const getWholesalePrice = (item: any) => {
    if (item.quantity >= 100) return item.price * 0.70;
    if (item.quantity >= 50) return item.price * 0.75;
    if (item.quantity >= 20) return item.price * 0.80;
    if (item.quantity >= 10) return item.price * 0.85;
    return item.price;
  };

  const handleContinue = () => {
    if (!address.fullName || !address.street || !address.city || !address.phone) {
      Alert.alert('Champs manquants', 'Veuillez remplir les champs obligatoires (*)');
      return;
    }

    const subtotal = cartItems.reduce((total, item) => total + (getWholesalePrice(item) * item.quantity), 0);
    
    const orderDataToSend = {
      items: cartItems.map(item => ({
        id: item.id,
        name: item.name,
        price: getWholesalePrice(item),
        quantity: item.quantity,
        imageUrl: item.image,
        companyName: item.companyName || "A2 Express"
      })),
      summary: {
        subtotal: subtotal,
        shipping: 0,
        discount: wholesaleSavings,
        total: subtotal
      },
      customerName: address.fullName,
      customerPhone: address.phone,
      shippingDetails: `${address.street}, ${address.city}, ${address.country}`
    };

    router.push({
      pathname: '/checkout/shipping',
      params: { orderData: JSON.stringify(orderDataToSend) }
    });
  };

  if (loading) return <ActivityIndicator style={{flex:1}} color={COLORS.primary} />;

  if (cartItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={64} color={COLORS.textLight} />
        <Text style={styles.emptyTitle}>Panier vide</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={() => router.replace('/')}>
          <Text style={styles.emptyButtonText}>Retour aux achats</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{paddingBottom: 40}}>
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

      <Text style={styles.title}>Finaliser la commande</Text>
      
      {/* RÉCAPITULATIF WHOLESALE (PRIX CORRIGÉS) */}
      <View style={styles.summarySection}>
        <Text style={styles.sectionTitle}>Votre commande</Text>
        {isWholesaleOrder && (
          <View style={styles.wholesaleBadge}>
            <Text style={styles.wholesaleBadgeText}>
              🏭 Prix de gros activé (-{formatPrice(wholesaleSavings)})
            </Text>
          </View>
        )}
        
        {cartItems.slice(0, 3).map((item, index) => (
           <View key={index} style={styles.miniItem}>
             <Text style={styles.productName} numberOfLines={1}>{item.name} x{item.quantity}</Text>
             {/* Utilisation de formatPrice ici */}
             <Text style={styles.wholesalePrice}>
               {formatPrice(getWholesalePrice(item) * item.quantity)}
             </Text>
           </View>
        ))}
        {cartItems.length > 3 && <Text style={styles.moreItems}>+ {cartItems.length - 3} autres articles</Text>}
      </View>

      {/* FORMULAIRE */}
      <View style={styles.form}>
        <Text style={styles.formTitle}>Où livrer ?</Text>
        <TextInput
          style={styles.input}
          placeholder="Nom complet *"
          value={address.fullName}
          onChangeText={(text) => setAddress({...address, fullName: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Téléphone (WhatsApp de préférence) *"
          keyboardType="phone-pad"
          value={address.phone}
          onChangeText={(text) => setAddress({...address, phone: text})}
        />
        <TextInput
          style={styles.input}
          placeholder="Adresse précise (Quartier, Rue, Porte) *"
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
            style={[styles.input, styles.halfInput]}
            placeholder="Pays"
            value={address.country}
            onChangeText={(text) => setAddress({...address, country: text})}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
        <Text style={styles.continueButtonText}>Calculer les frais de livraison</Text>
        <Ionicons name="bus-outline" size={20} color={COLORS.white} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: COLORS.background },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  progressStep: { alignItems: 'center', gap: 4 },
  stepIndicator: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  stepActive: { backgroundColor: COLORS.primary },
  stepNumber: { color: COLORS.white, fontSize: 12, fontWeight: 'bold' },
  stepText: { fontSize: 10, color: COLORS.textLight },
  stepTextActive: { fontSize: 10, color: COLORS.primary, fontWeight: 'bold' },
  progressLine: { width: 30, height: 2, backgroundColor: COLORS.border, marginHorizontal: 5 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: COLORS.text, textAlign: 'center' },
  summarySection: { backgroundColor: COLORS.white, padding: 16, borderRadius: 15, marginBottom: 16, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  wholesaleBadge: { backgroundColor: COLORS.success, padding: 8, borderRadius: 8, marginBottom: 10 },
  wholesaleBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  miniItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, gap: 10 },
  productName: { flex: 1, fontSize: 13, color: COLORS.textLight },
  wholesalePrice: { fontWeight: 'bold', color: COLORS.text, fontSize: 13 },
  moreItems: { fontSize: 11, color: COLORS.primary, marginTop: 5, fontStyle: 'italic' },
  form: { backgroundColor: COLORS.white, padding: 20, borderRadius: 15, elevation: 2 },
  formTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  input: { borderWidth: 1, borderColor: COLORS.border, padding: 12, borderRadius: 10, marginBottom: 12, backgroundColor: '#fff' },
  row: { flexDirection: 'row', gap: 10 },
  halfInput: { flex: 1 },
  continueButton: { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 18, borderRadius: 15, marginTop: 20, elevation: 4 },
  continueButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  emptyButton: { backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, marginTop: 20 },
  emptyButtonText: { color: '#fff' }
});