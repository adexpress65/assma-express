import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal,
  ScrollView,
  Alert  // IMPORT AJOUTÉ
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#ff6a00',
  text: '#2D3748',
  textLight: '#718096',
  white: '#FFFFFF',
  local: '#8B5CF6',
};

interface ShippingOption {
  id: string;
  name: string;
  deliveryTime: string;
  cost: number;
  unit: string;
  type: 'express' | 'local';
  features: string[];
  carrier: string;
  coverage: string[];
}

interface ShippingCalculatorProps {
  productId: string;
  quantity: number;
  weight?: string;
  shippingCost?: number;
  onOptionsPress?: () => void;
}

export default function ShippingCalculator({ 
  productId, 
  quantity,
  onOptionsPress 
}: ShippingCalculatorProps) {
  const [options] = useState<ShippingOption[]>([
    {
      id: 'tellimani_bamako',
      name: 'Livraison Tellimani à Bamako',
      deliveryTime: '24-48h',
      cost: 2000,
      unit: 'FCFA/Commande',
      type: 'local',
      carrier: 'Tellimani Express',
      features: ['Livraison porte à porte', 'Suivi en temps réel', 'Prix fixe sans surprise', 'Service client dédié'],
      coverage: ['Bamako', 'Kati', 'Koulikoro', 'Sébénikoro']
    },
    {
      id: 'express_air',
      name: 'Livraison Express par Vol',
      deliveryTime: '2-5 jours',
      cost: 6000,
      unit: 'FCFA/Kg',
      type: 'express',
      carrier: 'Assma Express Air',
      features: ['Livraison prioritaire', 'Dédouanement inclus'],
      coverage: ['International']
    }
  ]);
  
  const [selectedOption, setSelectedOption] = useState('tellimani_bamako');
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const getTypeColor = (type: string) => {
    return type === 'express' ? '#DC2626' : COLORS.local;
  };

  const getTypeBadgeText = (type: string) => {
    return type === 'express' ? 'EXPRESS' : 'LOCAL';
  };

  const calculateShippingCost = (option: ShippingOption) => {
    return option.cost;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const handleViewAllOptions = () => {
    console.log('📦 Ouvrir la modal des options');
    setShowModal(true);
    
    if (onOptionsPress) {
      onOptionsPress();
    }
  };

  const selectedOpt = options.find(opt => opt.id === selectedOption);
  const selectedCost = selectedOpt ? calculateShippingCost(selectedOpt) : 0;

  return (
    <View style={styles.container}>
      {/* HEADER COMPACT */}
      <TouchableOpacity 
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerContent}>
          <Ionicons name="rocket-outline" size={20} color={COLORS.primary} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Livraison</Text>
            <Text style={styles.headerSubtitle}>
              {selectedOpt ? `${selectedOpt.deliveryTime} • ${formatPrice(selectedCost)} F CFA` : 'Calculer la livraison'}
            </Text>
          </View>
        </View>
        <Ionicons 
          name={expanded ? "chevron-up" : "chevron-down"} 
          size={20} 
          color="#666" 
        />
      </TouchableOpacity>

      {/* CONTENU EXPANDÉ */}
      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.selectedCard}>
            <View style={styles.selectedHeader}>
              <View style={[styles.typeBadge, { backgroundColor: selectedOpt ? getTypeColor(selectedOpt.type) : '#666' }]}>
                <Text style={styles.typeBadgeText}>
                  {selectedOpt ? getTypeBadgeText(selectedOpt.type) : 'LOCAL'}
                </Text>
              </View>
              <Text style={styles.selectedName} numberOfLines={1}>
                {selectedOpt ? selectedOpt.name : 'Livraison standard'}
              </Text>
            </View>
            
            <View style={styles.selectedDetails}>
              <Text style={styles.selectedCarrier}>
                {selectedOpt ? `📦 ${selectedOpt.carrier}` : '📦 Tellimani Express'}
              </Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{formatPrice(selectedCost)} F CFA</Text>
                <Text style={styles.unit}>{selectedOpt?.unit || 'FCFA/Commande'}</Text>
              </View>
            </View>
          </View>

          {/* BOUTON VOIR TOUTES LES OPTIONS */}
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={handleViewAllOptions}
            activeOpacity={0.7}
          >
            <Ionicons name="list-outline" size={18} color="#666" />
            <Text style={styles.viewAllText}>Voir tous les détails des options</Text>
            <Ionicons name="chevron-forward" size={16} color="#999" />
          </TouchableOpacity>
        </View>
      )}

      {/* MODAL DES OPTIONS DE LIVRAISON */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showModal}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* EN-TÊTE MODAL */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Options de transport</Text>
              <TouchableOpacity 
                onPress={() => setShowModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* CONTENU MODAL */}
            <ScrollView style={styles.modalContent}>
              <View style={styles.addressSection}>
                <Text style={styles.addressTitle}>📍 Adresse de livraison</Text>
                <Text style={styles.addressText}>Bamako, ML</Text>
              </View>
              
              <Text style={styles.modalSubtitle}>Choisissez le mode d'expédition adapté à vos besoins</Text>
              
              {options.map((option) => {
                const cost = calculateShippingCost(option);
                const isSelected = selectedOption === option.id;
                
                return (
                  <View key={option.id} style={styles.optionCard}>
                    <View style={styles.optionHeader}>
                      <View style={[styles.optionBadge, { backgroundColor: getTypeColor(option.type) }]}>
                        <Text style={styles.optionBadgeText}>{getTypeBadgeText(option.type)}</Text>
                      </View>
                      <Text style={styles.optionName}>{option.name}</Text>
                    </View>
                    
                    <Text style={styles.optionCarrier}>📦 {option.carrier}</Text>
                    <Text style={styles.optionDelivery}>⏱️ {option.deliveryTime}</Text>
                    
                    <View style={styles.optionPriceRow}>
                      <Text style={styles.optionPrice}>{formatPrice(cost)} F CFA</Text>
                      <Text style={styles.optionUnit}>{option.unit}</Text>
                    </View>
                    
                    <Text style={styles.coverageLabel}>📍 Zones couvertes:</Text>
                    <View style={styles.coverageTags}>
                      {option.coverage.map((zone, idx) => (
                        <View key={idx} style={styles.coverageTag}>
                          <Text style={styles.coverageText}>{zone}</Text>
                        </View>
                      ))}
                    </View>
                    
                    <View style={styles.featuresList}>
                      {option.features.map((feature, idx) => (
                        <View key={idx} style={styles.featureItem}>
                          <Ionicons name="checkmark-circle" size={16} color="#00B517" />
                          <Text style={styles.featureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>
                    
                    <View style={styles.benefitsRow}>
                      <Text style={styles.benefit}>🔍 Suivi</Text>
                      <Text style={styles.benefit}>🛡️ Assuré</Text>
                      <Text style={styles.benefit}>✅ Garanti</Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={[
                        styles.selectButton,
                        isSelected && { backgroundColor: getTypeColor(option.type) }
                      ]}
                      onPress={() => {
                        setSelectedOption(option.id);
                        setShowModal(false);
                        Alert.alert('Succès', `Option "${option.name}" sélectionnée`);
                      }}
                    >
                      <Text style={styles.selectButtonText}>
                        {isSelected ? '✓ Option sélectionnée' : 'Sélectionner cette option'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  expandedContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  selectedCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  selectedDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedCarrier: {
    fontSize: 13,
    color: '#6B7280',
  },
  priceRow: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  unit: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginLeft: 12,
  },
  
  // MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalContent: {
    padding: 20,
  },
  addressSection: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 12,
  },
  optionBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  optionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  optionCarrier: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  optionDelivery: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  optionPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  optionPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginRight: 8,
  },
  optionUnit: {
    fontSize: 14,
    color: '#6B7280',
  },
  coverageLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 8,
  },
  coverageTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  coverageTag: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  coverageText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  featuresList: {
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
    flex: 1,
  },
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 20,
  },
  benefit: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
  },
  selectButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});