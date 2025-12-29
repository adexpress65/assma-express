// mobile/src/components/CustomizationOptions.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';

interface CustomizationOption {
  id: string;
  type: 'logo' | 'packaging' | 'graphic' | 'color' | 'text';
  title: string;
  description: string;
  price: number;
  required: boolean;
  options?: {
    id: string;
    label: string;
    image?: string;
    price: number;
  }[];
}

interface CustomizationOptionsProps {
  productId: string;
  onCustomizationChange?: (customizations: any) => void;
}

export default function CustomizationOptions({ productId, onCustomizationChange }: CustomizationOptionsProps) {
  const router = useRouter();
  const [selectedOptions, setSelectedOptions] = useState<{[key: string]: any}>({});
  const [showCustomizationModal, setShowCustomizationModal] = useState(false);
  const [customText, setCustomText] = useState('');

  // Options de personnalisation réalistes comme Alibaba
  const customizationOptions: CustomizationOption[] = [
    {
      id: 'logo',
      type: 'logo',
      title: 'Logo Personnalisé',
      description: 'Ajoutez votre logo sur le produit',
      price: 5000,
      required: false,
      options: [
        { id: 'logo-embossed', label: 'Logo Embossé', price: 5000 },
        { id: 'logo-printed', label: 'Logo Imprimé', price: 3000 },
        { id: 'logo-laser', label: 'Gravure Laser', price: 8000 },
      ]
    },
    {
      id: 'packaging',
      type: 'packaging',
      title: 'Emballage Personnalisé',
      description: 'Personnalisez l\'emballage avec votre branding',
      price: 2500,
      required: false,
      options: [
        { id: 'box-standard', label: 'Boîte Standard', price: 2500 },
        { id: 'box-premium', label: 'Boîte Premium', price: 5000 },
        { id: 'blister-pack', label: 'Blister Pack', price: 3500 },
      ]
    },
    {
      id: 'graphic',
      type: 'graphic',
      title: 'Personnalisation Graphique',
      description: 'Design personnalisé sur le produit',
      price: 7000,
      required: false,
      options: [
        { id: 'graphic-print', label: 'Impression Couleur', price: 7000 },
        { id: 'graphic-laser', label: 'Gravure Graphique', price: 10000 },
      ]
    },
    {
      id: 'color',
      type: 'color',
      title: 'Couleur Personnalisée',
      description: 'Choisissez la couleur du produit',
      price: 2000,
      required: false,
      options: [
        { id: 'color-black', label: 'Noir', price: 2000, image: '⬛' },
        { id: 'color-silver', label: 'Argent', price: 2000, image: '⚪' },
        { id: 'color-gold', label: 'Or', price: 3500, image: '🟡' },
        { id: 'color-blue', label: 'Bleu', price: 2500, image: '🟦' },
        { id: 'color-red', label: 'Rouge', price: 2500, image: '🟥' },
      ]
    },
    {
      id: 'text',
      type: 'text',
      title: 'Texte Personnalisé',
      description: 'Ajoutez du texte personnalisé',
      price: 1500,
      required: false,
    }
  ];

  const handleOptionSelect = (optionId: string, valueId: string, price: number) => {
    const newSelection = {
      ...selectedOptions,
      [optionId]: {
        optionId,
        valueId,
        price,
        label: customizationOptions.find(opt => opt.id === optionId)?.options?.find(val => val.id === valueId)?.label
      }
    };
    
    setSelectedOptions(newSelection);
    onCustomizationChange?.(newSelection);
  };

  const handleTextCustomization = () => {
    if (customText.trim()) {
      const newSelection = {
        ...selectedOptions,
        text: {
          optionId: 'text',
          valueId: 'custom-text',
          price: 1500,
          label: `Texte: "${customText}"`,
          customText: customText
        }
      };
      
      setSelectedOptions(newSelection);
      onCustomizationChange?.(newSelection);
      setShowCustomizationModal(false);
      setCustomText('');
    }
  };

  const getTotalCustomizationPrice = () => {
    return Object.values(selectedOptions).reduce((total, option) => total + (option.price || 0), 0);
  };

  const handleStartCustomization = () => {
    router.push({
      pathname: '/customization',
      params: { 
        productId,
        selectedOptions: JSON.stringify(selectedOptions)
      }
    });
  };

  const renderOption = (option: CustomizationOption) => {
    switch (option.type) {
      case 'logo':
      case 'packaging':
      case 'graphic':
        return renderSelectableOptions(option);
      case 'color':
        return renderColorOptions(option);
      case 'text':
        return renderTextOption(option);
      default:
        return null;
    }
  };

  const renderSelectableOptions = (option: CustomizationOption) => (
    <View style={styles.optionSection}>
      <View style={styles.optionHeader}>
        <Text style={styles.optionTitle}>{option.title}</Text>
        <Text style={styles.optionPrice}>+ {option.price} F CFA</Text>
      </View>
      <Text style={styles.optionDescription}>{option.description}</Text>
      
      <View style={styles.optionsGrid}>
        {option.options?.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.optionButton,
              selectedOptions[option.id]?.valueId === opt.id && styles.optionButtonSelected
            ]}
            onPress={() => handleOptionSelect(option.id, opt.id, opt.price)}
          >
            <Text style={[
              styles.optionButtonText,
              selectedOptions[option.id]?.valueId === opt.id && styles.optionButtonTextSelected
            ]}>
              {opt.label}
            </Text>
            <Text style={styles.optionButtonPrice}>+ {opt.price} F CFA</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderColorOptions = (option: CustomizationOption) => (
    <View style={styles.optionSection}>
      <View style={styles.optionHeader}>
        <Text style={styles.optionTitle}>{option.title}</Text>
        <Text style={styles.optionPrice}>+ {option.price} F CFA</Text>
      </View>
      <Text style={styles.optionDescription}>{option.description}</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
        {option.options?.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[
              styles.colorOption,
              selectedOptions[option.id]?.valueId === opt.id && styles.colorOptionSelected
            ]}
            onPress={() => handleOptionSelect(option.id, opt.id, opt.price)}
          >
            <Text style={styles.colorIcon}>{opt.image}</Text>
            <Text style={styles.colorLabel}>{opt.label}</Text>
            <Text style={styles.colorPrice}>+ {opt.price} F CFA</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderTextOption = (option: CustomizationOption) => (
    <View style={styles.optionSection}>
      <View style={styles.optionHeader}>
        <Text style={styles.optionTitle}>{option.title}</Text>
        <Text style={styles.optionPrice}>+ {option.price} F CFA</Text>
      </View>
      <Text style={styles.optionDescription}>{option.description}</Text>
      
      <TouchableOpacity
        style={[
          styles.textOptionButton,
          selectedOptions.text && styles.textOptionButtonSelected
        ]}
        onPress={() => setShowCustomizationModal(true)}
      >
        <Text style={styles.textOptionButtonText}>
          {selectedOptions.text ? selectedOptions.text.label : '➕ Ajouter du texte personnalisé'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Options de personnalisation</Text>
      <Text style={styles.subtitle}>Personnalisez ce produit selon vos besoins</Text>

      <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
        {customizationOptions.map((option) => (
          <View key={option.id}>
            {renderOption(option)}
            <View style={styles.separator} />
          </View>
        ))}
      </ScrollView>

      {/* Résumé de personnalisation */}
      {Object.keys(selectedOptions).length > 0 && (
        <View style={styles.customizationSummary}>
          <Text style={styles.summaryTitle}>Résumé de personnalisation</Text>
          {Object.values(selectedOptions).map((option, index) => (
            <View key={index} style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{option.label}</Text>
              <Text style={styles.summaryPrice}>+ {option.price} F CFA</Text>
            </View>
          ))}
          <View style={styles.totalSection}>
            <Text style={styles.totalLabel}>Coût supplémentaire total:</Text>
            <Text style={styles.totalPrice}>+ {getTotalCustomizationPrice()} F CFA</Text>
          </View>
        </View>
      )}

      {/* Bouton d'action */}
      <TouchableOpacity 
        style={[
          styles.customizeButton,
          Object.keys(selectedOptions).length > 0 && styles.customizeButtonActive
        ]}
        onPress={handleStartCustomization}
      >
        <Text style={styles.customizeButtonText}>
          {Object.keys(selectedOptions).length > 0 ? 'Personnaliser Maintenant' : 'Démarrer la Personnalisation'}
        </Text>
      </TouchableOpacity>

      {/* Modal pour texte personnalisé */}
      <Modal
        visible={showCustomizationModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Texte Personnalisé</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Entrez votre texte personnalisé..."
              value={customText}
              onChangeText={setCustomText}
              multiline
              maxLength={50}
            />
            <Text style={styles.charCount}>{customText.length}/50 caractères</Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowCustomizationModal(false)}
              >
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalConfirmButton, !customText.trim() && styles.modalConfirmDisabled]}
                onPress={handleTextCustomization}
                disabled={!customText.trim()}
              >
                <Text style={styles.modalConfirmText}>Ajouter (+1 500 F CFA)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  optionsContainer: {
    maxHeight: 400,
  },
  optionSection: {
    marginBottom: 20,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6a00',
  },
  optionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    minWidth: 100,
  },
  optionButtonSelected: {
    borderColor: '#ff6a00',
    backgroundColor: '#fff8f0',
  },
  optionButtonText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  optionButtonTextSelected: {
    color: '#ff6a00',
    fontWeight: '600',
  },
  optionButtonPrice: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  colorScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  colorOption: {
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    marginRight: 12,
    minWidth: 80,
  },
  colorOptionSelected: {
    borderColor: '#ff6a00',
    backgroundColor: '#fff8f0',
  },
  colorIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  colorLabel: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
  },
  colorPrice: {
    fontSize: 10,
    color: '#666',
  },
  textOptionButton: {
    padding: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    alignItems: 'center',
  },
  textOptionButtonSelected: {
    borderColor: '#ff6a00',
    borderStyle: 'solid',
    backgroundColor: '#fff8f0',
  },
  textOptionButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  customizationSummary: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  summaryPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff6a00',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff6a00',
  },
  customizeButton: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  customizeButtonActive: {
    backgroundColor: '#ff6a00',
  },
  customizeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  customizeButtonActiveText: {
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  modalConfirmButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#ff6a00',
    borderRadius: 6,
    alignItems: 'center',
  },
  modalConfirmDisabled: {
    backgroundColor: '#ccc',
  },
  modalConfirmText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});