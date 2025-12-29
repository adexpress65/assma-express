// apps/mobile/src/components/account/SellerSection.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

interface SellerSectionProps {
  onActionPress: (actionName: string) => void;
  isSeller?: boolean;
}

const SellerSection = ({ onActionPress, isSeller = false }: SellerSectionProps) => {
  const sellerStats = isSeller ? [
    { label: 'Produits', value: '24' },
    { label: 'Ventes', value: '156' },
    { label: 'Avis', value: '4.8' },
  ] : [
    { label: 'Gains Potentiels', value: '∞' },
    { label: 'Clients', value: '10K+' },
    { label: 'Support', value: '24/7' },
  ];

  const sellerActions = isSeller ? [
    { icon: 'add-circle-outline' as const, title: 'Ajouter un produit', action: 'Ajouter un produit' },
    { icon: 'stats-chart-outline' as const, title: 'Analytiques', action: 'Analytiques' },
    { icon: 'storefront-outline' as const, title: 'Ma Boutique', action: 'Ma Boutique' },
    { icon: 'chatbubble-outline' as const, title: 'Messages', action: 'Messages Vendeur' },
  ] : [
    { icon: 'rocket-outline' as const, title: 'Commencer', action: 'Devenir Vendeur' },
    { icon: 'school-outline' as const, title: 'Apprendre', action: 'Formation Vendeur' },
    { icon: 'calculator-outline' as const, title: 'Simuler', action: 'Simulateur Revenus' },
    { icon: 'people-outline' as const, title: 'Communauté', action: 'Communauté Vendeurs' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>
            {isSeller ? 'Vendre sur Assma Express' : 'Devenez Vendeur'}
          </Text>
          <View style={[styles.statusBadge, isSeller ? styles.sellerBadge : styles.prospectBadge]}>
            <Text style={styles.statusText}>
              {isSeller ? 'Vendeur Actif' : 'Opportunité'}
            </Text>
          </View>
        </View>
        
        {isSeller ? (
          <TouchableOpacity 
            style={styles.manageButton}
            onPress={() => onActionPress('Gérer Boutique')}
          >
            <Text style={styles.manageButtonText}>Gérer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.startButton}
            onPress={() => onActionPress('Devenir Vendeur')}
          >
            <MaterialIcons name="rocket-launch" size={16} color="#FFF" />
            <Text style={styles.startButtonText}>Démarrer</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.statsContainer}>
        {sellerStats.map((stat, index) => (
          <View key={index} style={styles.statItem}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actionsContainer}>
        {sellerActions.map((action, index) => (
          <TouchableOpacity 
            key={index}
            style={styles.actionButton}
            onPress={() => onActionPress(action.action)}
          >
            <Ionicons name={action.icon} size={18} color="#FF6B00" />
            <Text style={styles.actionText} numberOfLines={2}>
              {action.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!isSeller && (
        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>Avantages exclusifs :</Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Commission compétitive</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Support dédié</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.benefitText}>Formation gratuite</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  sellerBadge: {
    backgroundColor: '#E8F5E8',
  },
  prospectBadge: {
    backgroundColor: '#FFF3E0',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  manageButton: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  manageButtonText: {
    color: '#FF6B00',
    fontSize: 14,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#FF6B00',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    width: '48%',
    marginBottom: 8,
  },
  actionText: {
    color: '#FF6B00',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  benefitsContainer: {
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  benefitsList: {
    gap: 6,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  benefitText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
  },
});

export default SellerSection;