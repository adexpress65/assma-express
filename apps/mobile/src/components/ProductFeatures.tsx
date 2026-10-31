// mobile/src/components/ProductFeatures.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, LayoutAnimation } from 'react-native';

interface ProductFeature {
  label: string;
  value: string;
}

interface ProductFeaturesProps {
  features: ProductFeature[];
  description: string;
  specifications?: any;
}

export default function ProductFeatures({ features, description, specifications }: ProductFeaturesProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'features' | 'specs' | 'description'>('features');

  // Données réalistes comme sur Alibaba
  const defaultFeatures: ProductFeature[] = [
    { label: 'Marque', value: 'BLACKBERRY SECURITY' },
    { label: 'Numéro de type', value: 'BB-LOCK2024' },
    { label: 'Matériau du corps', value: 'Alliage de zinc renforcé' },
    { label: 'Type de verrouillage', value: 'Combinaison à cadran numérique' },
    { label: 'Longueur du bras', value: '25mm' },
    { label: 'Largeur du corps', value: '50mm' },
    { label: 'Poids', value: '85g' },
    { label: 'Résistance', value: '5 tonnes' },
    { label: 'Couleur', value: 'Argent/Nickel' },
    { label: 'Usage', value: 'Bagage, Valise, Casier, Bureau' },
    { label: 'Norme de sécurité', value: 'EN 12320 Classe 4' },
    { label: 'Garantie', value: '2 ans' },
    { label: 'Origine', value: 'Guangdong, China' },
    { label: 'Certification', value: 'CE, ROHS, ISO9001' },
  ];

  const displayFeatures = features.length > 0 ? features : defaultFeatures;

  const technicalSpecs = {
    'Spécifications Générales': [
      { label: 'Dimensions (L×l×H)', value: '60×50×25 mm' },
      { label: 'Poids net', value: '85g' },
      { label: 'Poids brut', value: '120g' },
      { label: 'Matériau', value: 'Alliage de zinc' },
    ],
    'Spécifications Techniques': [
      { label: 'Type de combinaison', value: '4 chiffres' },
      { label: 'Combinaisons possibles', value: '10,000' },
      { label: 'Résistance à la traction', value: '5000N' },
      { label: 'Température fonctionnement', value: '-20°C à 60°C' },
    ],
    'Emballage': [
      { label: 'Emballage unitaire', value: 'Blister PVC' },
      { label: 'Quantité par carton', value: '50 pièces' },
      { label: 'Poids carton', value: '6kg' },
      { label: 'Dimensions carton', value: '40×30×25 cm' },
    ]
  };

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const renderFeatures = () => (
    <View style={styles.featuresSection}>
      <Text style={styles.sectionTitle}>Caractéristiques du produit</Text>
      <View style={styles.featuresGrid}>
        {displayFeatures.slice(0, expanded ? displayFeatures.length : 6).map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Text style={styles.featureLabel}>{feature.label}</Text>
            <Text style={styles.featureValue}>{feature.value}</Text>
          </View>
        ))}
      </View>
      
      {displayFeatures.length > 6 && (
        <TouchableOpacity onPress={toggleExpand} style={styles.expandButton}>
          <Text style={styles.expandButtonText}>
            {expanded ? '▲ Afficher moins' : '▼ Afficher plus'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSpecifications = () => (
    <View style={styles.specsSection}>
      <Text style={styles.sectionTitle}>Spécifications techniques</Text>
      {Object.entries(technicalSpecs).map(([category, specs]) => (
        <View key={category} style={styles.specCategory}>
          <Text style={styles.specCategoryTitle}>{category}</Text>
          {specs.map((spec, index) => (
            <View key={index} style={styles.specRow}>
              <Text style={styles.specLabel}>{spec.label}</Text>
              <Text style={styles.specValue}>{spec.value}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  const renderDescription = () => (
    <View style={styles.descriptionSection}>
      <Text style={styles.sectionTitle}>Description du produit</Text>
      <Text style={styles.descriptionText}>
        {description || `Ce cadenas à combinaison numérique BLACKBERRY SECURITY offre une protection optimale pour vos effets personnels. Fabriqué en alliage de zinc de haute qualité, il résiste à la corrosion et aux intempéries.

• 🔒 **SÉCURITÉ MAXIMALE** : Combinaison à 4 chiffres avec 10,000 possibilités
• 💪 **ROBUSTE** : Corps en alliage de zinc résistant à la casse
• 🌧️ **ÉTANCHE** : Protection IP54 contre l'eau et la poussière
• ✈️ **IDÉAL VOYAGE** : Léger (85g) et compact, approuvé TSA
• 🎯 **FACILE À UTILISER** : Cadran numérique avec reset simple

**Domaines d'application :**
✓ Bagages et valises
✓ Casiers et vestiaires  
✓ Portes de bureau
✓ Coffres et tiroirs
✓ Équipements sportifs

Livré avec mode d'emploi multilingue et garantie constructeur de 2 ans.`}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Navigation par onglets comme Alibaba */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'features' && styles.activeTab]}
          onPress={() => setActiveTab('features')}
        >
          <Text style={[styles.tabText, activeTab === 'features' && styles.activeTabText]}>
            Caractéristiques
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'specs' && styles.activeTab]}
          onPress={() => setActiveTab('specs')}
        >
          <Text style={[styles.tabText, activeTab === 'specs' && styles.activeTabText]}>
            Spécifications
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'description' && styles.activeTab]}
          onPress={() => setActiveTab('description')}
        >
          <Text style={[styles.tabText, activeTab === 'description' && styles.activeTabText]}>
            Description
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenu des onglets */}
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {activeTab === 'features' && renderFeatures()}
        {activeTab === 'specs' && renderSpecifications()}
        {activeTab === 'description' && renderDescription()}
      </ScrollView>

      {/* Note importante comme sur Alibaba */}
      <View style={styles.noteContainer}>
        <Text style={styles.noteTitle}>📝 Note importante :</Text>
        <Text style={styles.noteText}>
          Les spécifications peuvent varier légèrement selon le lot de fabrication. 
          Contactez-nous pour les détails les plus récents.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    minHeight: 400,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    backgroundColor: '#fafafa',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#ff6a00',
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#ff6a00',
    fontWeight: '600',
  },
  contentContainer: {
    maxHeight: 400,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  featuresSection: {
    paddingBottom: 16,
  },
  featuresGrid: {
    paddingHorizontal: 16,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  featureLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    fontWeight: '500',
  },
  featureValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
    fontWeight: '400',
  },
  expandButton: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 8,
  },
  expandButtonText: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '600',
  },
  specsSection: {
    paddingBottom: 16,
  },
  specCategory: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  specCategoryTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  specLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  specValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
    fontWeight: '500',
  },
  descriptionSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  noteContainer: {
    backgroundColor: '#fff8e1',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffa000',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
});
