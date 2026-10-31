// mobile/src/components/ProductSpecifications.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

interface SpecificationItem {
  [key: string]: string | number | undefined;
}

interface ProductSpecificationsProps {
  specifications: SpecificationItem;
  description: string;
}

const COLORS = {
  primary: '#FF6A00',
  primaryLight: '#FFF0E6',
  text: '#2D3748',
  textLight: '#718096',
  border: '#E2E8F0',
  background: '#FFFAF5',
  white: '#FFFFFF',
  success: '#10B981'
};

export default function ProductSpecifications({ specifications, description }: ProductSpecificationsProps) {
  // Liste des spécifications clés à afficher
  const keySpecifications = [
    { key: 'material', label: 'Matériau', icon: '🪵' },
    { key: 'dimensions', label: 'Dimensions', icon: '📏' },
    { key: 'weight', label: 'Poids', icon: '⚖️' },
    { key: 'color', label: 'Couleur', icon: '🎨' },
    { key: 'modelNumber', label: 'Numéro de modèle', icon: '🔢' },
    { key: 'warranty', label: 'Garantie', icon: '🛡️' },
    { key: 'origin', label: 'Origine', icon: '🌍' },
    { key: 'certification', label: 'Certification', icon: '✅' },
    { key: 'packaging', label: 'Emballage', icon: '📦' },
  ];

  // Filtrer les spécifications qui ont une valeur
  const availableSpecs = keySpecifications.filter(
    spec => specifications[spec.key] && 
           specifications[spec.key] !== 'N/A' && 
           specifications[spec.key] !== 'Non spécifié' &&
           specifications[spec.key] !== 'Non spécifiée'
  );

  return (
    <View style={styles.container}>
      {/* Description du produit */}
      <View style={styles.descriptionSection}>
        <Text style={styles.sectionTitle}>Description du Produit</Text>
        <Text style={styles.descriptionText}>
          {description || 'Aucune description disponible pour ce produit.'}
        </Text>
      </View>

      {/* Spécifications techniques */}
      {availableSpecs.length > 0 && (
        <View style={styles.specificationsSection}>
          <Text style={styles.sectionTitle}>Spécifications Techniques</Text>
          <View style={styles.specificationsGrid}>
            {availableSpecs.map((spec, index) => (
              <View 
                key={spec.key} 
                style={[
                  styles.specificationItem,
                  index % 2 === 0 ? styles.evenItem : styles.oddItem
                ]}
              >
                <View style={styles.specificationHeader}>
                  <Text style={styles.specificationIcon}>{spec.icon}</Text>
                  <Text style={styles.specificationLabel}>{spec.label}</Text>
                </View>
                <Text style={styles.specificationValue}>
                  {specifications[spec.key] as string}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Autres spécifications (si disponibles) */}
      {Object.keys(specifications).length > availableSpecs.length && (
        <View style={styles.additionalSpecsSection}>
          <Text style={styles.sectionTitle}>Caractéristiques Additionnelles</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.additionalSpecsScroll}
          >
            {Object.entries(specifications)
              .filter(([key, value]) => {
                // Exclure les spécifications déjà affichées et les valeurs vides
                const isStandardSpec = keySpecifications.some(spec => spec.key === key);
                return !isStandardSpec && 
                       value && 
                       value !== 'N/A' && 
                       value !== 'Non spécifié' &&
                       value !== 'Non spécifiée';
              })
              .map(([key, value], index) => (
                <View key={key} style={styles.additionalSpecCard}>
                  <Text style={styles.additionalSpecLabel}>
                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                  </Text>
                  <Text style={styles.additionalSpecValue} numberOfLines={2}>
                    {value as string}
                  </Text>
                </View>
              ))}
          </ScrollView>
        </View>
      )}

      {/* Message si aucune spécification */}
      {availableSpecs.length === 0 && Object.keys(specifications).length === 0 && (
        <View style={styles.noSpecsContainer}>
          <Text style={styles.noSpecsText}>
            Aucune spécification technique disponible pour ce produit.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  descriptionSection: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  specificationsSection: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: COLORS.textLight,
    lineHeight: 22,
  },
  specificationsGrid: {
    gap: 12,
  },
  specificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  evenItem: {
    backgroundColor: COLORS.background,
  },
  oddItem: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  specificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  specificationIcon: {
    fontSize: 16,
  },
  specificationLabel: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    flex: 1,
  },
  specificationValue: {
    fontSize: 14,
    color: COLORS.textLight,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
  additionalSpecsSection: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  additionalSpecsScroll: {
    flexDirection: 'row',
    gap: 12,
  },
  additionalSpecCard: {
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 12,
    minWidth: 140,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 12,
  },
  additionalSpecLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'capitalize',
  },
  additionalSpecValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    lineHeight: 18,
  },
  noSpecsContainer: {
    backgroundColor: COLORS.background,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noSpecsText: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
});
