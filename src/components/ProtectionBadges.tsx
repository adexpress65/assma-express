// mobile/src/components/ProtectionBadges.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProtectionBadgesProps {
  warranty?: {
    duration?: string;
    type?: string;
    coverage?: string[];
    provider?: string;
  };
  productType?: string;
}

export default function ProtectionBadges({ warranty, productType }: ProtectionBadgesProps) {
  // Données de garantie réelles avec fallback
  const realWarranty = warranty || {
    duration: '12 mois',
    type: 'Garantie constructeur',
    coverage: ['Défauts de fabrication', 'Pièces défectueuses'],
    provider: 'Assma Guarantee'
  };

  const getWarrantyColor = (duration: string) => {
    if (duration.includes('24') || duration.includes('2')) return '#DC2626';
    if (duration.includes('18')) return '#2563EB';
    if (duration.includes('12')) return '#059669';
    return '#6B7280';
  };

  const protectionFeatures = [
    {
      icon: '🛡️',
      title: 'Garantie Produit',
      description: realWarranty.duration,
      color: getWarrantyColor(realWarranty.duration),
      details: realWarranty.coverage?.join(', ') || 'Couverture standard'
    },
    {
      icon: '✅',
      title: 'Authenticité',
      description: 'Produit certifié',
      color: '#059669',
      details: 'Authenticité garantie - Contrefaçon remboursée'
    },
    {
      icon: '🚚',
      title: 'Livraison sécurisée',
      description: 'Suivi et assurance',
      color: '#2563EB',
      details: 'Suivi en temps réel + assurance incluse'
    },
    {
      icon: '💎',
      title: 'Qualité Premium',
      description: 'Contrôles qualité',
      color: '#7C3AED',
      details: 'Multiples contrôles qualité avant expédition'
    }
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🛡️ Protection Assma</Text>
        <Text style={styles.subtitle}>Votre achat 100% sécurisé</Text>
      </View>

      <View style={styles.badgesGrid}>
        {protectionFeatures.map((feature, index) => (
          <View key={index} style={styles.badgeCard}>
            <View style={[styles.badgeIcon, { backgroundColor: `${feature.color}15` }]}>
              <Text style={styles.icon}>{feature.icon}</Text>
            </View>
            
            <View style={styles.badgeContent}>
              <Text style={styles.badgeTitle}>{feature.title}</Text>
              <Text style={[styles.badgeDescription, { color: feature.color }]}>
                {feature.description}
              </Text>
              <Text style={styles.badgeDetails}>{feature.details}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Section Garantie détaillée */}
      <View style={styles.warrantySection}>
        <View style={styles.warrantyHeader}>
          <Text style={styles.warrantyTitle}>📋 Détails de la Garantie</Text>
          <View style={[styles.warrantyDuration, { backgroundColor: getWarrantyColor(realWarranty.duration) }]}>
            <Text style={styles.warrantyDurationText}>{realWarranty.duration}</Text>
          </View>
        </View>
        
        <View style={styles.warrantyDetails}>
          <View style={styles.warrantyItem}>
            <Text style={styles.warrantyLabel}>Type de garantie:</Text>
            <Text style={styles.warrantyValue}>{realWarranty.type}</Text>
          </View>
          
          <View style={styles.warrantyItem}>
            <Text style={styles.warrantyLabel}>Fournisseur:</Text>
            <Text style={styles.warrantyValue}>{realWarranty.provider}</Text>
          </View>
          
          <View style={styles.warrantyItem}>
            <Text style={styles.warrantyLabel}>Couverture:</Text>
            <View style={styles.coverageList}>
              {realWarranty.coverage?.map((item, idx) => (
                <View key={idx} style={styles.coverageItem}>
                  <Text style={styles.coverageIcon}>✓</Text>
                  <Text style={styles.coverageText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.guaranteeNote}>
          <Text style={styles.guaranteeText}>
            💎 Tous nos produits sont couverts par notre politique de satisfaction garantie.
            Retour sous 30 jours si non satisfait.
          </Text>
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
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  badgesGrid: {
    gap: 12,
    marginBottom: 20,
  },
  badgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  badgeContent: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  badgeDescription: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  badgeDetails: {
    fontSize: 12,
    color: '#6B7280',
  },
  warrantySection: {
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  warrantyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  warrantyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#92400E',
    flex: 1,
  },
  warrantyDuration: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  warrantyDurationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  warrantyDetails: {
    gap: 8,
  },
  warrantyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warrantyLabel: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '600',
    width: 120,
  },
  warrantyValue: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    fontWeight: '500',
  },
  coverageList: {
    flex: 1,
    gap: 4,
  },
  coverageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coverageIcon: {
    color: '#059669',
    fontWeight: 'bold',
    fontSize: 12,
  },
  coverageText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  guaranteeNote: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  guaranteeText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
    textAlign: 'center',
  },
});