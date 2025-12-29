import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  Alert,
  SafeAreaView 
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

export default function CheckoutShipping() {
  const router = useRouter();
  const { cartItems, getTotalItems } = useCart();
  
  // VÉRIFICATION PANIER VIDE
  if (cartItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart-outline" size={64} color={COLORS.textLight} />
        <Text style={styles.emptyTitle}>Panier vide</Text>
        <Text style={styles.emptyText}>Impossible de continuer avec un panier vide.</Text>
        <TouchableOpacity 
          style={styles.emptyButton}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={styles.emptyButtonText}>Retour aux achats</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const [selectedShipping, setSelectedShipping] = useState('tellimani_bamako'); // ✅ DÉFAUT : TELLIMANI
  const [isWholesaleOrder, setIsWholesaleOrder] = useState(false);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalWeight, setTotalWeight] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);

  // DÉTECTION WHOLESALE ET CALCULS POIDS/VOLUME
  useEffect(() => {
    const quantity = getTotalItems();
    setTotalQuantity(quantity);
    setIsWholesaleOrder(quantity >= 10 || cartItems.some(item => item.quantity >= 10));

    // CALCUL POIDS TOTAL (estimation: 1 produit = 0.5kg)
    const weight = cartItems.reduce((total, item) => total + (item.quantity * 0.5), 0);
    setTotalWeight(weight);

    // CALCUL VOLUME TOTAL (estimation: 1 produit = 0.01 CBM)
    const volume = cartItems.reduce((total, item) => total + (item.quantity * 0.01), 0);
    setTotalVolume(volume);
  }, [cartItems]);

  // CALCUL DES PRIX WHOLESALE
  const getWholesalePrice = (item) => {
    if (item.quantity >= 100) return item.price * 0.70;
    if (item.quantity >= 50) return item.price * 0.75;
    if (item.quantity >= 20) return item.price * 0.80;
    if (item.quantity >= 10) return item.price * 0.85;
    if (totalQuantity >= 50) return item.price * 0.90;
    return item.price;
  };

  // SOUS-TOTAL WHOLESALE
  const getWholesaleSubtotal = () => {
    return cartItems.reduce((total, item) => {
      return total + (getWholesalePrice(item) * item.quantity);
    }, 0);
  };

  // ✅ OPTIONS DE LIVRAISON AVEC TELLIMANI À BAMAKO
  const shippingOptions = [
    {
      id: 'tellimani_bamako',
      name: '🚚 Tellimani à Bamako',
      price: 2000, // ✅ PRIX FIXE DE 2000 FCFA
      deliveryTime: '24-48 heures',
      description: 'Livraison locale rapide et économique dans Bamako et environs',
      type: 'local',
      details: 'Prix fixe de 2000 FCFA',
      features: ['Livraison porte à porte', 'Suivi en temps réel', 'Prix fixe sans surprise'],
      coverage: ['Bamako', 'Kati', 'Koulikoro', 'Sébénikoro'],
      recommended: true
    },
    {
      id: 'vol_express',
      name: '✈️ Vol Express',
      price: Math.ceil(totalWeight * 12000), // 12,000 FCFA/kg
      deliveryTime: '5 jours',
      description: 'Livraison express par avion - Idéal pour les urgences',
      type: 'air',
      details: `${totalWeight.toFixed(1)} kg × 12,000 FCFA`
    },
    {
      id: 'vol_cargo', 
      name: '✈️ Vol Cargo',
      price: Math.ceil(totalWeight * 10000), // 10,000 FCFA/kg
      deliveryTime: '2 semaines',
      description: 'Livraison économique par cargo aérien',
      type: 'air',
      details: `${totalWeight.toFixed(1)} kg × 10,000 FCFA`
    },
    {
      id: 'voie_maritime',
      name: '🚢 Voie Maritime',
      price: Math.ceil(totalVolume * 295000), // 295,000 FCFA/CBM
      deliveryTime: '12 semaines',
      description: 'Livraison la plus économique par bateau',
      type: 'sea',
      details: `${totalVolume.toFixed(2)} CBM × 295,000 FCFA`
    }
  ];

  // CONVERSION FCFA À USD
  const convertToUSD = (fcfAmount: number) => {
    const exchangeRate = 600; // 1 USD = 600 FCFA (à ajuster selon taux réel)
    return (fcfAmount / exchangeRate).toFixed(2);
  };

  const getSelectedShippingOption = () => {
    return shippingOptions.find(option => option.id === selectedShipping);
  };

  const handleContinue = () => {
    const selectedOption = getSelectedShippingOption();
    
    if (!selectedOption) {
      Alert.alert('Erreur', 'Veuillez sélectionner un mode de livraison');
      return;
    }

    router.push({
      pathname: '/checkout/payment',
      params: {
        shippingMethod: selectedShipping,
        shippingCost: selectedOption.price.toString(),
        shippingDetails: `${selectedOption.name} - ${selectedOption.deliveryTime}`
      }
    });
  };

  // ✅ FONCTION POUR AFFICHER LES ZONES DE COUVERTURE
  const renderCoverage = (coverage: string[]) => {
    if (!coverage || coverage.length === 0) return null;
    
    return (
      <View style={styles.coverageSection}>
        <Text style={styles.coverageLabel}>📍 Zones couvertes:</Text>
        <View style={styles.coverageTags}>
          {coverage.map((zone, index) => (
            <View key={index} style={styles.coverageTag}>
              <Text style={styles.coverageText}>{zone}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ✅ FONCTION POUR AFFICHER LES FEATURES
  const renderFeatures = (features: string[]) => {
    if (!features || features.length === 0) return null;
    
    return (
      <View style={styles.featuresSection}>
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // AFFICHAGE DES INFORMATIONS DE CALCUL
  const renderShippingCalculations = () => (
    <View style={styles.calculationsSection}>
      <Text style={styles.calculationsTitle}>Calcul des frais de transport</Text>
      
      <View style={styles.calculationRow}>
        <Text style={styles.calculationLabel}>Poids total estimé:</Text>
        <Text style={styles.calculationValue}>{totalWeight.toFixed(1)} kg</Text>
      </View>
      
      <View style={styles.calculationRow}>
        <Text style={styles.calculationLabel}>Volume total estimé:</Text>
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

  const renderWholesaleBenefits = () => {
    if (!isWholesaleOrder) return null;

    return (
      <View style={styles.wholesaleBenefits}>
        <View style={styles.benefitsHeader}>
          <Ionicons name="business" size={20} color={COLORS.primary} />
          <Text style={styles.benefitsTitle}>Avantages Professionnels</Text>
        </View>
        
        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            <Text style={styles.benefitText}>Tarifs wholesale sur les articles</Text>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            <Text style={styles.benefitText}>Support dédié aux professionnels</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
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

        {/* Badge Wholesale */}
        {isWholesaleOrder && (
          <View style={styles.wholesaleBadge}>
            <Ionicons name="business" size={16} color={COLORS.white} />
            <Text style={styles.wholesaleBadgeText}>
              Commande professionnelle • {totalQuantity} unités
            </Text>
          </View>
        )}

        {/* Avantages wholesale */}
        {renderWholesaleBenefits()}

        {/* CALCULS DES FRAIS */}
        {renderShippingCalculations()}
        
        <View style={styles.shippingOptions}>
          {shippingOptions.map(option => {
            const isSelected = selectedShipping === option.id;
            const isLocal = option.type === 'local';
            
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.shippingCard,
                  isSelected && styles.shippingCardSelected,
                  isLocal && styles.localCard
                ]}
                onPress={() => setSelectedShipping(option.id)}
              >
                <View style={styles.shippingInfo}>
                  <View style={styles.shippingHeader}>
                    <View style={styles.shippingTitleContainer}>
                      <Text style={styles.shippingName}>{option.name}</Text>
                      {option.recommended && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedBadgeText}>Recommandé</Text>
                        </View>
                      )}
                    </View>
                    <View style={[
                      styles.typeBadge,
                      isLocal ? styles.typeLocal : 
                      option.type === 'air' ? styles.typeAir : styles.typeSea
                    ]}>
                      <Text style={styles.typeBadgeText}>
                        {isLocal ? 'LOCAL' : option.type === 'air' ? 'AÉRIEN' : 'MARITIME'}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.shippingTime}>📅 {option.deliveryTime}</Text>
                  <Text style={styles.shippingDescription}>{option.description}</Text>
                  <Text style={styles.shippingDetails}>{option.details}</Text>
                  
                  {/* ✅ ZONES DE COUVERTURE POUR TELLIMANI */}
                  {option.coverage && renderCoverage(option.coverage)}
                  
                  {/* ✅ FEATURES POUR TELLIMANI */}
                  {option.features && renderFeatures(option.features)}
                </View>
                
                <View style={styles.shippingPriceContainer}>
                  <Text style={[
                    styles.shippingPrice,
                    isLocal && styles.localPrice
                  ]}>
                    {option.price.toLocaleString()} FCFA
                  </Text>
                  <Text style={styles.usdPrice}>
                    {convertToUSD(option.price)} USD
                  </Text>
                  {isLocal && (
                    <Text style={styles.fixedPriceBadge}>💰 Prix Fixe</Text>
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

        {/* Informations importantes */}
        <View style={styles.infoSection}>
          <View style={styles.infoHeader}>
            <Ionicons name="alert-circle" size={20} color={COLORS.primary} />
            <Text style={styles.infoTitle}>Informations importantes</Text>
          </View>
          <View style={styles.infoList}>
            <Text style={styles.infoItem}>• 🚚 <Text style={styles.infoBold}>Tellimani à Bamako</Text>: Livraison locale rapide en 24-48h (2000 FCFA fixe)</Text>
            <Text style={styles.infoItem}>• ✈️ <Text style={styles.infoBold}>Vol Express</Text>: Idéal pour les commandes urgentes (12,000 FCFA/kg)</Text>
            <Text style={styles.infoItem}>• ✈️ <Text style={styles.infoBold}>Vol Cargo</Text>: Équilibre entre prix et délai (10,000 FCFA/kg)</Text>
            <Text style={styles.infoItem}>• 🚢 <Text style={styles.infoBold}>Voie Maritime</Text>: Solution la plus économique (295,000 FCFA/CBM)</Text>
            <Text style={styles.infoItem}>• Les frais réels seront confirmés après pesage</Text>
          </View>
        </View>

        {/* ✅ ESPACE POUR LE BOUTON FLOATING */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ✅ BOUTON FLOATING POUR CONTINUER VERS LE PAIEMENT */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>
            Continuer vers le paiement
          </Text>
          <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
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
    paddingBottom: 100, // ✅ ESPACE POUR LE BOUTON FLOATING
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
  stepTextCompleted: {
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
  progressLineCompleted: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.primary,
    marginHorizontal: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
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
    marginBottom: 16,
    alignSelf: 'center',
  },
  wholesaleBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  wholesaleBenefits: {
    backgroundColor: COLORS.primaryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  benefitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  benefitsList: {
    gap: 6,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  benefitText: {
    fontSize: 14,
    color: COLORS.text,
  },
  // STYLES POUR LES CALCULS
  calculationsSection: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calculationsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calculationLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  calculationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  calculationNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  calculationNoteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 16,
  },
  shippingOptions: {
    gap: 12,
    marginBottom: 20,
  },
  shippingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    position: 'relative',
  },
  localCard: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
  },
  shippingCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  shippingInfo: {
    flex: 1,
    marginRight: 12,
  },
  shippingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  shippingTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  shippingName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  recommendedBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  recommendedBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeAir: {
    backgroundColor: '#E3F2FD',
  },
  typeSea: {
    backgroundColor: '#E8F5E8',
  },
  typeLocal: {
    backgroundColor: '#EDE9FE',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  shippingTime: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  shippingDescription: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
    lineHeight: 16,
  },
  shippingDetails: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  // ✅ STYLES POUR ZONES DE COUVERTURE
  coverageSection: {
    marginBottom: 8,
  },
  coverageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 4,
  },
  coverageTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  coverageTag: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverageText: {
    fontSize: 10,
    color: '#4F46E5',
    fontWeight: '500',
  },
  // ✅ STYLES POUR FEATURES
  featuresSection: {
    marginTop: 4,
  },
  featuresContainer: {
    gap: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureText: {
    fontSize: 11,
    color: '#7C3AED',
    fontWeight: '500',
  },
  shippingPriceContainer: {
    alignItems: 'flex-end',
  },
  shippingPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  localPrice: {
    color: '#8B5CF6',
  },
  usdPrice: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  fixedPriceBadge: {
    fontSize: 10,
    color: '#8B5CF6',
    fontWeight: '600',
    marginTop: 4,
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  // SECTION INFORMATIONS
  infoSection: {
    backgroundColor: COLORS.primaryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  infoList: {
    gap: 6,
  },
  infoItem: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 16,
  },
  infoBold: {
    fontWeight: '600',
  },
  // ✅ ESPACE POUR LE BOUTON FLOATING
  bottomSpacer: {
    height: 80,
  },
  // ✅ BOUTON FLOATING CONTAINER
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 18,
    borderRadius: 12,
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