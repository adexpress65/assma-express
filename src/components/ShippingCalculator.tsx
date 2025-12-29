// mobile/src/components/ShippingCalculator.tsx - AVEC TELLIMANI À BAMAKO
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface ShippingOption {
  id: string;
  name: string;
  description: string;
  deliveryTime: string;
  cost: number;
  unit: string;
  type: 'express' | 'standard' | 'economy' | 'local';
  features: string[];
  carrier: string;
  tracking: boolean;
  insurance: boolean;
  guaranteed: boolean;
  priceType: 'fixed' | 'variable'; // ✅ NOUVEAU : Type de prix
  coverage: string[]; // ✅ NOUVEAU : Zones couvertes
}

interface ShippingCalculatorProps {
  productId: string;
  quantity: number;
  onOptionsPress?: () => void;
  shippingOptions?: any[];
}

export default function ShippingCalculator({ productId, quantity, onOptionsPress, shippingOptions }: ShippingCalculatorProps) {
  const router = useRouter();
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [userCountry, setUserCountry] = useState('ML');
  const [userAddress, setUserAddress] = useState('Bamako, ML');

  useEffect(() => {
    if (shippingOptions && shippingOptions.length > 0) {
      const formattedOptions = shippingOptions.map(option => ({
        id: option.id,
        name: option.name,
        description: option.description,
        deliveryTime: option.deliveryTime,
        cost: option.cost,
        unit: option.unit,
        type: option.type,
        carrier: getCarrierByType(option.type),
        tracking: true,
        insurance: option.type === 'express',
        guaranteed: option.type === 'express' || option.type === 'standard',
        features: getFeaturesByType(option.type),
        priceType: 'variable',
        coverage: ['National', 'International']
      }));
      
      // ✅ AJOUT : Inclure l'option Tellimani à Bamako
      const fullOptions = [
        ...formattedOptions,
        getTellimaniBamakoOption()
      ];
      
      setOptions(fullOptions);
      setSelectedOption(fullOptions[0]?.id || '');
    } else {
      // ✅ MODIFICATION : Inclure Tellimani dans les options par défaut
      loadDefaultOptions();
    }
  }, [shippingOptions]);

  // ✅ NOUVELLE FONCTION : Option Tellimani à Bamako
  const getTellimaniBamakoOption = (): ShippingOption => {
    return {
      id: 'tellimani_bamako',
      name: 'Livraison Tellimani à Bamako',
      description: 'Service de livraison local rapide et économique dans Bamako et environs',
      deliveryTime: '24 à 48 heures',
      cost: 2000,
      unit: 'FCFA/Commande',
      type: 'local',
      carrier: 'Tellimani Express',
      tracking: true,
      insurance: true,
      guaranteed: true,
      features: [
        'Livraison porte à porte',
        'Suivi en temps réel',
        'Prix fixe sans surprise',
        'Service client dédié'
      ],
      priceType: 'fixed',
      coverage: ['Bamako', 'Kati', 'Koulikoro', 'Sébénikoro']
    };
  };

  const getCarrierByType = (type: string) => {
    switch (type) {
      case 'express': return 'Assma Express Air';
      case 'standard': return 'Assma Cargo Air';
      case 'economy': return 'CMA CGM Maritime';
      case 'local': return 'Tellimani Express';
      default: return 'Assma Logistics';
    }
  };

  const getFeaturesByType = (type: string) => {
    switch (type) {
      case 'express':
        return ['Livraison prioritaire', 'Suivi en temps réel', 'Assurance incluse', 'Dédouanement inclus'];
      case 'standard':
        return ['Suivi disponible', 'Délai garanti', 'Assurance optionnelle'];
      case 'economy':
        return ['Solution économique', 'Idéal gros volumes', 'Suivi maritime'];
      case 'local':
        return ['Livraison rapide', 'Prix fixe', 'Service local'];
      default:
        return ['Livraison standard'];
    }
  };

  const loadDefaultOptions = () => {
    // ✅ MODIFICATION : Inclure Tellimani comme première option
    const defaultOptions: ShippingOption[] = [
      getTellimaniBamakoOption(), // ✅ AJOUTÉ EN PREMIER
      {
        id: 'express_air',
        name: 'Livraison Express par Vol',
        description: 'Envoi par vol express - Idéal pour commandes urgentes',
        deliveryTime: '2 à 5 jours',
        cost: 12000,
        unit: 'FCFA/Kg',
        type: 'express',
        carrier: 'Assma Express Air',
        tracking: true,
        insurance: true,
        guaranteed: true,
        features: ['Livraison prioritaire', 'Suivi en temps réel', 'Assurance incluse', 'Dédouanement inclus'],
        priceType: 'variable',
        coverage: ['International']
      },
      {
        id: 'standard_air',
        name: 'Livraison Standard par Cargo',
        description: 'Envoi par vol cargo - Équilibre prix/délai',
        deliveryTime: '7 à 15 jours',
        cost: 10000,
        unit: 'FCFA/Kg',
        type: 'standard',
        carrier: 'Assma Cargo Air',
        tracking: true,
        insurance: false,
        guaranteed: true,
        features: ['Suivi disponible', 'Délai garanti', 'Assurance optionnelle'],
        priceType: 'variable',
        coverage: ['International']
      },
      {
        id: 'maritime',
        name: 'Livraison Maritime',
        description: 'Envoi par voie maritime - Économique pour gros volumes',
        deliveryTime: '12 semaines',
        cost: 295000,
        unit: 'FCFA/CBM',
        type: 'economy',
        carrier: 'CMA CGM Maritime',
        tracking: true,
        insurance: true,
        guaranteed: false,
        features: ['Solution économique', 'Idéal gros volumes', 'Suivi maritime'],
        priceType: 'fixed',
        coverage: ['International']
      }
    ];
    
    setOptions(defaultOptions);
    // ✅ DÉFINIR TELLIMANI COMMME OPTION PAR DÉFAUT
    setSelectedOption(defaultOptions[0].id);
  };

  const calculateShippingCost = (baseCost: number, quantity: number, unit: string, priceType: string) => {
    // ✅ MODIFICATION : Gestion du prix fixe pour Tellimani
    if (unit === 'FCFA/Commande' || priceType === 'fixed') {
      return baseCost; // Prix fixe pour Tellimani
    }
    
    if (unit === 'FCFA/CBM') {
      // Pour le maritime, prix fixe par CBM
      return baseCost;
    }
    
    // Pour le aérien, calcul basé sur le poids
    const baseWeight = quantity * 0.5; // Estimation 0.5kg par produit
    return Math.round(baseCost * baseWeight);
  };

  const getSelectedOption = () => {
    return options.find(option => option.id === selectedOption);
  };

  const handleChangeAddress = () => {
    Alert.alert(
      'Changer l\'adresse',
      'Cette fonctionnalité sera disponible dans la version complète',
      [{ text: 'OK' }]
    );
  };

  const handleViewAllOptions = () => {
    if (onOptionsPress) {
      onOptionsPress();
    } else {
      router.push({
        pathname: '/shipping-options',
        params: { 
          productId,
          quantity: quantity.toString(),
          shippingOptions: JSON.stringify(options)
        }
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'express': return '#DC2626';
      case 'standard': return '#2563EB';
      case 'economy': return '#059669';
      case 'local': return '#8B5CF6'; // ✅ NOUVELLE COULEUR POUR LOCAL
      default: return '#6B7280';
    }
  };

  const getTypeStyle = (type: string) => {
    const color = getTypeColor(type);
    return {
      backgroundColor: `${color}15`,
      borderColor: color,
    };
  };

  const getTypeBadgeText = (type: string) => {
    switch (type) {
      case 'express': return 'EXPRESS';
      case 'standard': return 'STANDARD';
      case 'economy': return 'ÉCONOMIE';
      case 'local': return 'LOCAL'; // ✅ NOUVEAU BADGE
      default: return 'STANDARD';
    }
  };

  // ✅ NOUVELLE FONCTION : Afficher les zones de couverture
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

  // ✅ NOUVELLE FONCTION : Afficher le type de prix
  const renderPriceTypeBadge = (priceType: string) => {
    if (priceType === 'fixed') {
      return (
        <View style={styles.fixedPriceBadge}>
          <Text style={styles.fixedPriceText}>💰 Prix Fixe</Text>
        </View>
      );
    }
    return null;
  };

  if (options.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Options de livraison</Text>
        <ActivityIndicator size="small" color="#FF6A00" style={styles.loading} />
      </View>
    );
  }

  const selectedShipping = getSelectedOption();
  const calculatedCost = selectedShipping 
    ? calculateShippingCost(selectedShipping.cost, quantity, selectedShipping.unit, selectedShipping.priceType)
    : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🚚 Livraison Grossiste</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Professionnel</Text>
        </View>
      </View>

      {/* Adresse de livraison */}
      <View style={styles.addressSection}>
        <View style={styles.addressHeader}>
          <View style={styles.addressInfo}>
            <Text style={styles.addressTitle}>📍 Adresse de livraison</Text>
            <Text style={styles.addressText}>{userAddress}</Text>
            <Text style={styles.locationNote}>
              Pour les livraisons Tellimani, votre adresse doit être dans la zone couverte
            </Text>
          </View>
          <TouchableOpacity style={styles.changeButton} onPress={handleChangeAddress}>
            <Text style={styles.changeButtonText}>Modifier</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Options de livraison */}
      <View style={styles.optionsSection}>
        <Text style={styles.sectionTitle}>Options de transport</Text>
        <Text style={styles.sectionSubtitle}>Choisissez le mode d'expédition adapté à vos besoins</Text>
        
        {options.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.optionCard,
              getTypeStyle(option.type),
              selectedOption === option.id && styles.optionCardSelected
            ]}
            onPress={() => setSelectedOption(option.id)}
          >
            <View style={styles.optionHeader}>
              <View style={styles.optionSelector}>
                <View style={[
                  styles.radio,
                  selectedOption === option.id && styles.radioSelected
                ]} />
              </View>
              
              <View style={styles.optionMain}>
                <View style={styles.optionTitleRow}>
                  <View style={styles.optionTitleContainer}>
                    <Text style={styles.optionName}>{option.name}</Text>
                    {option.type === 'local' && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>Recommandé</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.badgeContainer}>
                    <View style={[styles.typeBadge, { backgroundColor: getTypeColor(option.type) }]}>
                      <Text style={styles.typeBadgeText}>
                        {getTypeBadgeText(option.type)}
                      </Text>
                    </View>
                    {renderPriceTypeBadge(option.priceType)}
                  </View>
                </View>
                <Text style={styles.optionCarrier}>📦 {option.carrier}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
            </View>

            <View style={styles.optionDetails}>
              <View style={styles.deliveryInfo}>
                <View style={styles.deliveryTimeContainer}>
                  <Text style={styles.deliveryTime}>⏱️ {option.deliveryTime}</Text>
                  {/*option.guaranteed && (
                    <View style={styles.guaranteedBadge}>
                      <Text style={styles.guaranteedText}>Délai garanti</Text>
                    </View>
                  )*/}
                </View>
                <View style={styles.costContainer}>
                  {option.priceType === 'fixed' ? (
                    <Text style={styles.fixedPriceDisplay}>
                      {formatPrice(option.cost)} F CFA
                    </Text>
                  ) : (
                    <Text style={styles.shippingCost}>
                      {formatPrice(calculateShippingCost(option.cost, quantity, option.unit, option.priceType))} F CFA
                    </Text>
                  )}
                  <Text style={styles.priceUnit}>{option.unit}</Text>
                </View>
              </View>
              
              {/* ✅ AJOUT : Zones de couverture */}
              {renderCoverage(option.coverage)}
              
              <View style={styles.features}>
                {option.features.map((feature, index) => (
                  <View key={index} style={[
                    styles.featureTag,
                    option.type === 'local' && styles.localFeatureTag
                  ]}>
                    <Text style={[
                      styles.featureText,
                      option.type === 'local' && styles.localFeatureText
                    ]}>✓ {feature}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.benefits}>
                {option.tracking && (
                  <Text style={styles.benefit}>🔍 Suivi inclus</Text>
                )}
                {option.insurance && (
                  <Text style={styles.benefit}>🛡️ Assurance</Text>
                )}
                {option.guaranteed && (
                  <Text style={styles.benefit}>✅ Garantie délai</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* Action pour plus d'options */}
        <TouchableOpacity style={styles.moreOptionsButton} onPress={handleViewAllOptions}>
          <Text style={styles.moreOptionsText}>
            📋 Voir tous les détails des options de livraison
          </Text>
        </TouchableOpacity>
      </View>

      {/* Résumé des frais */}
      {selectedShipping && (
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>💰 Résumé des frais d'expédition</Text>
          
          <View style={styles.costBreakdown}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Transport {getTypeBadgeText(selectedShipping.type)}</Text>
              <Text style={styles.costValue}>{formatPrice(calculatedCost)} F CFA</Text>
            </View>
            
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Quantité estimée</Text>
              <Text style={styles.costValue}>{quantity} pièces</Text>
            </View>
            
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Transporteur</Text>
              <Text style={styles.costValue}>{selectedShipping.carrier}</Text>
            </View>
            
            {selectedShipping.coverage && selectedShipping.coverage.length > 0 && (
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Zone de couverture</Text>
                <Text style={styles.costValue}>{selectedShipping.coverage.join(', ')}</Text>
              </View>
            )}
            
            <View style={[styles.costRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Frais d'expédition totaux</Text>
              <Text style={styles.totalValue}>{formatPrice(calculatedCost)} F CFA</Text>
            </View>
          </View>

          {/* ✅ AJOUT : Message spécial pour Tellimani */}
          {selectedShipping.type === 'local' && (
            <View style={styles.tellimaniNote}>
              <Text style={styles.tellimaniNoteText}>
                🚚 <Text style={styles.tellimaniHighlight}>Tellimani à Bamako:</Text> Livraison rapide en 24-48h avec suivi en temps réel. Prix fixe de 2000 FCFA quel que soit le volume.
              </Text>
            </View>
          )}

          <Text style={styles.disclaimer}>
            * Les droits de douane, taxes locales et frais de port supplémentaires sont calculés à l'arrivée
          </Text>
        </View>
      )}

      {/* Informations importantes pour grossistes */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>🏭 Informations Grossiste</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📋</Text>
            <Text style={styles.infoText}>Documents d'exportation inclus</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>🏢</Text>
            <Text style={styles.infoText}>Dédouanement professionnel</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📞</Text>
            <Text style={styles.infoText}>Assistance logistique dédiée</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>💼</Text>
            <Text style={styles.infoText}>Solutions sur mesure disponibles</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  badge: {
    backgroundColor: '#FF6A00',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  loading: {
    marginVertical: 20,
  },
  addressSection: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressInfo: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#6B7280',
  },
  locationNote: {
    fontSize: 12,
    color: '#8B5CF6',
    fontStyle: 'italic',
    marginTop: 4,
  },
  changeButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  changeButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  optionsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  optionCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  optionCardSelected: {
    borderColor: '#FF6A00',
    backgroundColor: '#FFF8F0',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  optionSelector: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  radio: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  radioSelected: {
    backgroundColor: '#FF6A00',
  },
  optionMain: {
    flex: 1,
  },
  optionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  optionTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  optionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  recommendedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  recommendedText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  badgeContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  fixedPriceBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fixedPriceText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  optionCarrier: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 18,
  },
  optionDetails: {
    paddingLeft: 36,
  },
  deliveryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deliveryTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deliveryTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  guaranteedBadge: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  guaranteedText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: 'bold',
  },
  costContainer: {
    alignItems: 'flex-end',
  },
  shippingCost: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6A00',
  },
  fixedPriceDisplay: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  priceUnit: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  // ✅ NOUVEAUX STYLES : Zones de couverture
  coverageSection: {
    marginBottom: 12,
  },
  coverageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  coverageTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  coverageTag: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  coverageText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '500',
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  featureTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  localFeatureTag: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  featureText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  localFeatureText: {
    color: '#7C3AED',
  },
  benefits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  benefit: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  moreOptionsButton: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  moreOptionsText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '600',
  },
  summarySection: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#065F46',
    marginBottom: 12,
  },
  costBreakdown: {
    gap: 8,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costLabel: {
    fontSize: 14,
    color: '#374151',
  },
  costValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6A00',
  },
  // ✅ NOUVEAU : Note spéciale Tellimani
  tellimaniNote: {
    backgroundColor: '#F5F3FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  tellimaniNoteText: {
    fontSize: 14,
    color: '#4F46E5',
    lineHeight: 18,
  },
  tellimaniHighlight: {
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  disclaimer: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 8,
  },
  infoSection: {
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 12,
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIcon: {
    fontSize: 16,
    width: 24,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
});