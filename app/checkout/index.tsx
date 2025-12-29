// 📁 apps/mobile/app/checkout/index.tsx - VERSION CORRIGÉE
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  Alert,
  Image,
  Switch
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCart } from '../../src/contexts/CartContext';
import { Ionicons } from '@expo/vector-icons';

// COULEURS COHÉRENTES
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
  
  // ============ TOUS LES HOOKS DOIVENT ÊTRE ICI (AVANT TOUT RETURN) ============
  
  const [address, setAddress] = useState({
    fullName: '',
    street: '',
    city: '',
    postalCode: '',
    country: 'Côte d\'Ivoire',
    phone: ''
  });

  // ÉTATS POUR WHOLESALE
  const [isWholesaleOrder, setIsWholesaleOrder] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [wholesaleSavings, setWholesaleSavings] = useState(0);
  const [saveAddress, setSaveAddress] = useState(true);
  
  // CALCULS AUTOMATIQUES WHOLESALE
  useEffect(() => {
    const quantity = getTotalItems();
    setTotalQuantity(quantity);
    
    // Détection automatique wholesale
    const wholesale = quantity >= 10 || cartItems.some(item => item.quantity >= 10);
    setIsWholesaleOrder(wholesale);

    // Calcul des économies wholesale
    const originalTotal = getTotalPrice();
    const wholesaleTotal = cartItems.reduce((total, item) => {
      return total + (getWholesalePrice(item) * item.quantity);
    }, 0);
    
    setWholesaleSavings(Math.max(0, originalTotal - wholesaleTotal));
  }, [cartItems]);

  // ============ FONCTIONS (APRÈS LES HOOKS) ============
  
  // CALCUL DES PRIX WHOLESALE
  const getWholesalePrice = (item: any) => {
    if (item.quantity >= 100) return item.price * 0.70;  // -30%
    if (item.quantity >= 50) return item.price * 0.75;   // -25%
    if (item.quantity >= 20) return item.price * 0.80;   // -20%
    if (item.quantity >= 10) return item.price * 0.85;   // -15%
    if (totalQuantity >= 50) return item.price * 0.90;   // -10% pour commande globale
    return item.price;
  };

  const handleContinue = () => {
    if (!address.fullName || !address.street || !address.city || !address.postalCode || !address.phone) {
      Alert.alert('Champs manquants', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    router.push('/checkout/shipping');
  };

  // ============ CONDITION DE RENDU (APRÈS LES HOOKS) ============
  
  // VÉRIFICATION PANIER VIDE - DOIT ÊTRE APRÈS LES HOOKS
  if (cartItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={64} color={COLORS.textLight} />
        <Text style={styles.emptyTitle}>Panier vide</Text>
        <Text style={styles.emptyText}>Votre panier est vide, ajoutez des articles avant de passer commande.</Text>
        <TouchableOpacity 
          style={styles.emptyButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.emptyButtonText}>Retour aux achats</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ============ FONCTIONS DE RENDU ============
  
  // RÉCAPITULATIF DES ARTICLES
  const renderOrderSummary = () => (
    <View style={styles.summarySection}>
      <Text style={styles.sectionTitle}>Récapitulatif de commande</Text>
      
      {/* Badge Wholesale */}
      {isWholesaleOrder && (
        <View style={styles.wholesaleBadge}>
          <Ionicons name="business" size={16} color={COLORS.white} />
          <Text style={styles.wholesaleBadgeText}>
            🏭 Commande en gros • {totalQuantity} unités
          </Text>
        </View>
      )}

      {/* Liste des articles avec prix wholesale */}
      {cartItems.map((item) => {
        const wholesalePrice = getWholesalePrice(item);
        const isWholesaleItem = wholesalePrice < item.price;
        
        return (
          <View key={item.id} style={styles.productItem}>
            <Image source={{ uri: item.image }} style={styles.productImage} />
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.productQuantity}>Quantité: {item.quantity}</Text>
              
              {/* Prix dégressif */}
              {isWholesaleItem ? (
                <View style={styles.wholesalePriceContainer}>
                  <Text style={styles.originalPrice}>
                    {(item.price * item.quantity).toLocaleString()} FCFA
                  </Text>
                  <Text style={styles.wholesalePrice}>
                    {(wholesalePrice * item.quantity).toLocaleString()} FCFA
                  </Text>
                </View>
              ) : (
                <Text style={styles.normalPrice}>
                  {(item.price * item.quantity).toLocaleString()} FCFA
                </Text>
              )}
            </View>
          </View>
        );
      })}

      {/* Économies totales */}
      {wholesaleSavings > 0 && (
        <View style={styles.savingsContainer}>
          <Text style={styles.savingsText}>
            💰 Économie totale: {wholesaleSavings.toLocaleString()} FCFA
          </Text>
          <Text style={styles.savingsSubtext}>
            Grâce à vos quantités importantes
          </Text>
        </View>
      )}

      {/* Barre de progression wholesale */}
      {totalQuantity > 0 && (
        <View style={styles.wholesaleProgress}>
          <Text style={styles.progressTitle}>Seuils de réduction</Text>
          
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { width: `${Math.min(100, (totalQuantity / 100) * 100)}%` }
              ]} 
            />
          </View>
          
          <View style={styles.thresholds}>
            <View style={styles.threshold}>
              <Text style={totalQuantity >= 10 ? styles.thresholdActive : styles.thresholdText}>
                10+ unités
              </Text>
              <Text style={styles.thresholdDiscount}>-15%</Text>
            </View>
            
            <View style={styles.threshold}>
              <Text style={totalQuantity >= 20 ? styles.thresholdActive : styles.thresholdText}>
                20+ unités
              </Text>
              <Text style={styles.thresholdDiscount}>-20%</Text>
            </View>
            
            <View style={styles.threshold}>
              <Text style={totalQuantity >= 50 ? styles.thresholdActive : styles.thresholdText}>
                50+ unités
              </Text>
              <Text style={styles.thresholdDiscount}>-25%</Text>
            </View>
            
            <View style={styles.threshold}>
              <Text style={totalQuantity >= 100 ? styles.thresholdActive : styles.thresholdText}>
                100+ unités
              </Text>
              <Text style={styles.thresholdDiscount}>-30%</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  // ============ RENDU PRINCIPAL ============
  
  return (
    <ScrollView style={styles.container}>
      {/* En-tête avec progression */}
      <View style={styles.progressHeader}>
        <View style={styles.progressStep}>
          <View style={[styles.stepIndicator, styles.stepActive]}>
            <Text style={styles.stepNumber}>1</Text>
          </View>
          <Text style={styles.stepTextActive}>Adresse</Text>
        </View>
        
        <View style={styles.progressLine} />
        
        <View style={styles.progressStep}>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <Text style={styles.stepText}>Livraison</Text>
        </View>
        
        <View style={styles.progressLine} />
        
        <View style={styles.progressStep}>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
          <Text style={styles.stepText}>Paiement</Text>
        </View>
      </View>

      <Text style={styles.title}>Adresse de livraison</Text>
      
      {/* Récapitulatif de commande */}
      {renderOrderSummary()}
      
      {/* Formulaire d'adresse */}
      <View style={styles.form}>
        <Text style={styles.formTitle}>Informations de livraison</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Nom complet *"
          value={address.fullName}
          onChangeText={(text) => setAddress({...address, fullName: text})}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Adresse complète *"
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
            placeholder="Code postal *"
            value={address.postalCode}
            onChangeText={(text) => setAddress({...address, postalCode: text})}
            keyboardType="numeric"
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder="Pays"
          value={address.country}
          onChangeText={(text) => setAddress({...address, country: text})}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Téléphone *"
          value={address.phone}
          onChangeText={(text) => setAddress({...address, phone: text})}
          keyboardType="phone-pad"
        />

        {/* Option sauvegarde adresse */}
        <View style={styles.saveAddressOption}>
          <Switch
            value={saveAddress}
            onValueChange={setSaveAddress}
            trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
            thumbColor={saveAddress ? COLORS.primary : COLORS.white}
          />
          <Text style={styles.saveAddressText}>
            Sauvegarder cette adresse pour mes prochaines commandes
          </Text>
        </View>
      </View>

      {/* Bouton de continuation */}
      <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
        <Text style={styles.continueButtonText}>
          Continuer vers la livraison
        </Text>
        <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  // STYLES POUR PANIER VIDE
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
  stepNumber: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  stepText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '500',
  },
  stepTextActive: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: COLORS.text,
  },
  summarySection: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
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
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 4,
  },
  productQuantity: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  wholesalePriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originalPrice: {
    fontSize: 12,
    color: COLORS.textLight,
    textDecorationLine: 'line-through',
  },
  wholesalePrice: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  normalPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  savingsContainer: {
    backgroundColor: COLORS.primaryLight,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 2,
  },
  savingsSubtext: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  wholesaleProgress: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  thresholds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  threshold: {
    alignItems: 'center',
  },
  thresholdText: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  thresholdActive: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '700',
  },
  thresholdDiscount: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: '600',
  },
  form: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: COLORS.white,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  saveAddressOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  saveAddressText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 18,
    borderRadius: 12,
    marginBottom: 30,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
});