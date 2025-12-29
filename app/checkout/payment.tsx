// 📁 apps/mobile/app/checkout/payment.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ScrollView,
  ActivityIndicator,
  Linking,
  SafeAreaView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCart } from '../../src/contexts/CartContext';
import { createPayment } from "@/services/payment";
import { Ionicons } from '@expo/vector-icons';

// IMPORT FIREBASE
import { db } from '../../src/config/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';

const TEST_USER_ID = 'biU1QvlrGtZeqTLdbLONLGbyVQ92';

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
  white: '#FFFFFF'
};

const formatCurrencyShort = (amount: number): string => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M FCFA`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K FCFA`;
  }
  return `${amount.toLocaleString()} FCFA`;
};

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { cartItems, clearCart, getTotalItems } = useCart();
  
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isWholesaleOrder, setIsWholesaleOrder] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [wholesaleSavings, setWholesaleSavings] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  
  // Vérification panier vide
  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>Panier vide</Text>
          <Text style={styles.emptyText}>Impossible de procéder au paiement.</Text>
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.emptyButtonText}>Retour aux achats</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Détection wholesale
  useEffect(() => {
    const quantity = getTotalItems();
    setTotalQuantity(quantity);
    const wholesale = quantity >= 10 || cartItems.some(item => item.quantity >= 10);
    setIsWholesaleOrder(wholesale);

    const originalTotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    const wholesaleTotal = getWholesaleSubtotal();
    setWholesaleSavings(Math.max(0, originalTotal - wholesaleTotal));
  }, [cartItems]);

  // Charger le solde du wallet
  useEffect(() => {
    loadWalletBalance();
    
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    return () => {
      subscription.remove();
    };
  }, []);

  const loadWalletBalance = async () => {
    try {
      // Simule le chargement du solde
      setWalletBalance(15000); // 15000 XOF pour le test
    } catch (error) {
      console.error('Erreur chargement wallet:', error);
    }
  };

  // Gestion des deep links pour le retour de paiement
  const handleDeepLink = async (event: { url: string }) => {
    console.log('🔗 Deep link reçu:', event.url);
    
    if (event.url.includes('assmaexpress://payment-callback')) {
      try {
        setIsProcessing(true);
        
        const url = new URL(event.url);
        const path = url.pathname;
        
        let status: 'success' | 'cancel' | 'failed' = 'failed';
        if (path.includes('success')) status = 'success';
        if (path.includes('cancel')) status = 'cancel';
        
        const searchParams = new URLSearchParams(url.search);
        const reference = searchParams.get('reference') || searchParams.get('token') || searchParams.get('transaction_id');
        const orderId = searchParams.get('order_id');
        const gateway = 'card'; // Gateway par défaut
        
        if (!reference || !orderId) {
          throw new Error('Paramètres manquants');
        }
        
        if (status === 'success') {
          // Mettre à jour la commande
          await updateOrderStatus(orderId, 'paid', reference, gateway);
          
          Alert.alert(
            '✅ Paiement Réussi',
            'Votre paiement a été confirmé. Merci !',
            [
              {
                text: 'Voir la commande',
                onPress: () => {
                  clearCart();
                  router.replace({
                    pathname: '/checkout/confirmation',
                    params: {
                      orderId,
                      status: 'success',
                      amount: '0',
                      reference,
                      gateway,
                      message: 'Paiement réussi'
                    }
                  });
                }
              }
            ]
          );
        } else {
          await updateOrderStatus(orderId, 'failed', reference, gateway);
          
          Alert.alert(
            '❌ Paiement Échoué',
            'Le paiement a été refusé.',
            [
              {
                text: 'Réessayer',
                onPress: () => setSelectedMethod('card')
              }
            ]
          );
        }
      } catch (error) {
        console.error('Erreur traitement deep link:', error);
        Alert.alert('Erreur', 'Impossible de vérifier le statut du paiement');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Calcul des prix wholesale
  const getWholesalePrice = (item: any) => {
    if (item.quantity >= 100) return item.price * 0.70;
    if (item.quantity >= 50) return item.price * 0.75;
    if (item.quantity >= 20) return item.price * 0.80;
    if (item.quantity >= 10) return item.price * 0.85;
    if (totalQuantity >= 50) return item.price * 0.90;
    return item.price;
  };

  const getWholesaleSubtotal = () => {
    return cartItems.reduce((total, item) => {
      return total + (getWholesalePrice(item) * item.quantity);
    }, 0);
  };

  const subtotal = getWholesaleSubtotal();
  const shippingCost = parseInt(params.shippingCost as string) || 0;
  const tax = Math.round(subtotal * 0.18);
  const total = subtotal + shippingCost + tax;

  // Fonction pour sauvegarder la commande
  const saveOrderToFirestore = async (orderData: any) => {
    try {
      const orderRef = doc(db, 'orders', orderData.orderId);
      
      await setDoc(orderRef, {
        ...orderData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      console.log('✅ Commande sauvegardée:', orderData.orderId);
      return true;
    } catch (error) {
      console.error('❌ Erreur sauvegarde commande:', error);
      return false;
    }
  };

  // Fonction pour mettre à jour le statut
  const updateOrderStatus = async (orderId: string, status: string, reference?: string, gateway?: string) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      
      const updateData: any = {
        status,
        updatedAt: serverTimestamp()
      };
      
      if (reference) {
        updateData.gatewayReference = reference;
      }
      
      if (gateway) {
        updateData.gateway = gateway;
      }
      
      await updateDoc(orderRef, updateData);
      
      console.log(`✅ Statut commande ${orderId} mis à jour: ${status}`);
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour commande:', error);
      return false;
    }
  };

  // Méthodes de paiement
  const paymentMethods = [
    { 
      id: 'orange_money', 
      name: 'Orange Money', 
      icon: 'phone-portrait' as const,
      description: 'Paiement mobile instantané',
      supported: false
    },
    { 
      id: 'mtn_money', 
      name: 'MTN Mobile Money', 
      icon: 'phone-portrait' as const,
      description: 'Paiement mobile sécurisé',
      supported: false
    },
    { 
      id: 'card', 
      name: 'Carte bancaire', 
      icon: 'card' as const,
      description: 'Visa/Mastercard',
      supported: true
    },
    { 
      id: 'bank_transfer', 
      name: 'Virement bancaire', 
      icon: 'business' as const,
      description: 'Traitement sous 24h',
      supported: false
    },
    { 
      id: 'cash_on_delivery', 
      name: 'Paiement à la livraison', 
      icon: 'cash' as const,
      description: 'Payez quand vous recevez',
      supported: false
    },
    { 
      id: 'wallet', 
      name: 'Wallet Assma', 
      icon: 'wallet' as const,
      description: 'Utilisez votre solde',
      supported: false
    }
  ];

  // FONCTION DE PAIEMENT PRINCIPALE
  const handlePayment = async () => {
    if (isProcessing) return;

    // 🔴 PHASE 1 : CARTE UNIQUEMENT
    if (selectedMethod !== 'card') {
      Alert.alert(
        'Méthode non disponible',
        'Seul le paiement par carte est disponible en test interne.'
      );
      return;
    }

    // 🔒 Validation minimale requise par Google
    if (!total || total <= 0) {
      Alert.alert(
        'Montant invalide',
        'Le montant du paiement est incorrect.'
      );
      return;
    }

    try {
      setIsProcessing(true);
      console.log('💳 Démarrage paiement carte');

      // Générer un ID de commande unique
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 🔹 Préparer les métadonnées de la commande
      const orderMetadata = {
        orderId,
        cartItems,
        shippingCost,
        tax,
        subtotal,
        total,
        isWholesaleOrder,
        totalQuantity,
        wholesaleSavings: wholesaleSavings || 0
      };

      // ✅ Appeler le backend pour créer le paiement
      const result = await createPayment(total, TEST_USER_ID, orderMetadata);

      if (!result?.paymentUrl) {
        throw new Error('URL de paiement indisponible');
      }

      // Sauvegarder la commande dans Firestore
      await saveOrderToFirestore({
        orderId,
        userId: TEST_USER_ID,
        items: cartItems,
        subtotal,
        shippingCost,
        tax,
        total,
        status: 'pending',
        paymentMethod: selectedMethod,
        metadata: orderMetadata,
        gateway: 'ngenius',
        gatewayReference: result.reference || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Rediriger vers le webview de paiement
      router.push({
        pathname: '/checkout/payment-webview',
        params: {
          paymentUrl: result.paymentUrl,
          orderId,
          gateway: 'ngenius'
        },
      });

    } catch (error: any) {
      console.error('❌ Payment Error', error);
      
      let errorMessage = 'Impossible de lancer le paiement par carte';
      
      // Gestion des erreurs spécifiques
      if (error.message.includes('Réponse backend invalide')) {
        errorMessage = 'Problème de connexion avec le serveur de paiement';
      } else if (error.message.includes('Payment creation failed')) {
        errorMessage = 'Échec de la création du paiement. Veuillez réessayer.';
      }
      
      Alert.alert(
        'Erreur paiement',
        errorMessage
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Récapitulatif de commande
  const renderOrderSummary = () => (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>Détails de la commande</Text>
      
      {isWholesaleOrder && (
        <View style={styles.wholesaleBadge}>
          <Ionicons name="business" size={16} color={COLORS.white} />
          <Text style={styles.wholesaleBadgeText}>
            Commande en gros • {totalQuantity} unités
          </Text>
        </View>
      )}

      {walletBalance !== null && (
        <View style={styles.walletBalance}>
          <Ionicons name="wallet" size={16} color={COLORS.primary} />
          <Text style={styles.walletBalanceText}>
            Solde: {formatCurrencyShort(walletBalance)}
          </Text>
        </View>
      )}

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Sous-total</Text>
        <Text style={styles.summaryValue}>{subtotal.toLocaleString()} FCFA</Text>
      </View>

      {wholesaleSavings > 0 && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Économie wholesale</Text>
          <Text style={[styles.summaryValue, styles.savingsText]}>
            -{wholesaleSavings.toLocaleString()} FCFA
          </Text>
        </View>
      )}

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Livraison</Text>
        <Text style={styles.summaryValue}>
          {shippingCost === 0 ? 'GRATUIT' : `${shippingCost.toLocaleString()} FCFA`}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>TVA (18%)</Text>
        <Text style={styles.summaryValue}>{tax.toLocaleString()} FCFA</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total à payer</Text>
        <Text style={styles.totalValue}>{formatCurrencyShort(total)}</Text>
      </View>

      {walletBalance !== null && walletBalance < total && (
        <View style={styles.insufficientBalance}>
          <Ionicons name="warning" size={16} color={COLORS.error} />
          <Text style={styles.insufficientBalanceText}>
            Solde insuffisant. Rechargez votre wallet.
          </Text>
        </View>
      )}

      {isWholesaleOrder && (
        <View style={styles.wholesaleNote}>
          <Ionicons name="star" size={16} color={COLORS.primary} />
          <Text style={styles.wholesaleNoteText}>
            Vous bénéficiez de tarifs professionnels
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête avec progression */}
        <View style={styles.progressHeader}>
          <View style={styles.progressStep}>
            <View style={[styles.stepIndicator, styles.stepCompleted]}>
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
            </View>
            <Text style={styles.stepTextCompleted}>Adresse</Text>
          </View>
          
          <View style={styles.progressLineCompleted} />
          
          <View style={styles.progressStep}>
            <View style={[styles.stepIndicator, styles.stepCompleted]}>
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
            </View>
            <Text style={styles.stepTextCompleted}>Livraison</Text>
          </View>
          
          <View style={styles.progressLineCompleted} />
          
          <View style={styles.progressStep}>
            <View style={[styles.stepIndicator, styles.stepActive]}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <Text style={styles.stepTextActive}>Paiement</Text>
          </View>
        </View>

        <Text style={styles.title}>Moyen de paiement</Text>
        
        {/* Sélection méthode de paiement */}
        <View style={styles.methodsContainer}>
          {paymentMethods.map(method => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.methodCard,
                selectedMethod === method.id && styles.methodSelected,
                !method.supported && styles.methodDisabled
              ]}
              onPress={() => setSelectedMethod(method.id)}
              disabled={!method.supported || isProcessing}
            >
              <View style={[
                styles.methodIcon,
                !method.supported && styles.methodIconDisabled
              ]}>
                <Ionicons 
                  name={method.icon} 
                  size={24} 
                  color={method.supported ? COLORS.primary : COLORS.textLight} 
                />
              </View>
              
              <View style={styles.methodInfo}>
                <Text style={[
                  styles.methodName,
                  !method.supported && styles.methodNameDisabled
                ]}>
                  {method.name}
                </Text>
                <Text style={styles.methodDescription}>{method.description}</Text>
                {!method.supported && (
                  <Text style={styles.notAvailableText}>Bientôt disponible</Text>
                )}
              </View>
              
              <View style={[
                styles.radio,
                selectedMethod === method.id && styles.radioSelected,
                !method.supported && styles.radioDisabled
              ]}>
                {selectedMethod === method.id && (
                  <Ionicons name="checkmark" size={12} color={COLORS.white} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Récapitulatif de commande */}
        {renderOrderSummary()}

        {/* Sécurité */}
        <View style={styles.securitySection}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.success} />
          <Text style={styles.securityText}>
            Paiement 100% sécurisé. Vos données sont cryptées SSL.
          </Text>
        </View>

        {/* Bouton de paiement principal */}
        <TouchableOpacity
          style={[
            styles.payButton, 
            (isProcessing || (walletBalance !== null && walletBalance < total)) && styles.payButtonDisabled
          ]}
          onPress={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={styles.payButtonText}>Traitement...</Text>
            </>
          ) : (
            <>
              <Text style={styles.payButtonText}>
                Payer {formatCurrencyShort(total)}
              </Text>
              <Ionicons name="lock-closed" size={16} color={COLORS.white} />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginBottom: 10,
  },
  progressStep: {
    alignItems: 'center',
    gap: 8,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepActive: {
    backgroundColor: COLORS.primary,
  },
  stepCompleted: {
    backgroundColor: COLORS.primary,
  },
  stepNumber: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  stepTextActive: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  stepTextCompleted: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  progressLineCompleted: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.primary,
    marginHorizontal: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: COLORS.text,
  },
  methodsContainer: {
    marginBottom: 20,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  methodDisabled: {
    opacity: 0.6,
  },
  methodSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodIconDisabled: {
    backgroundColor: COLORS.border,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  methodNameDisabled: {
    color: COLORS.textLight,
  },
  methodDescription: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  notAvailableText: {
    fontSize: 11,
    color: COLORS.error,
    backgroundColor: '#fee',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDisabled: {
    borderColor: COLORS.textLight,
  },
  radioSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  summary: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: COLORS.text,
  },
  wholesaleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  wholesaleBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  walletBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  walletBalanceText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  summaryValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  savingsText: {
    color: COLORS.success,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
  },
  insufficientBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEE',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
  },
  insufficientBalanceText: {
    fontSize: 12,
    color: COLORS.error,
    fontWeight: '500',
  },
  wholesaleNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
  },
  wholesaleNoteText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  securitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    marginBottom: 20,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 16,
  },
  payButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 18,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  payButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  payButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  spacer: {
    height: 50,
  },
});