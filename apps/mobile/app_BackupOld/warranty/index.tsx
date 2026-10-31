import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function WarrantyScreen() {
  const router = useRouter();

  const warranties = [
    {
      id: '1',
      product: 'Smartphone Android 5G',
      orderId: 'ASMA-12345',
      purchaseDate: '15 Oct 2024',
      warrantyEnd: '15 Oct 2025',
      status: 'active',
      image: 'ðŸ“±'
    },
    {
      id: '2',
      product: 'Casque Audio Bluetooth',
      orderId: 'ASMA-12346',
      purchaseDate: '12 Oct 2024',
      warrantyEnd: '12 Oct 2025',
      status: 'active',
      image: 'ðŸŽ§'
    },
    {
      id: '3',
      product: 'Montre ConnectÃ©e Sport',
      orderId: 'ASMA-12347',
      purchaseDate: '10 Oct 2024',
      warrantyEnd: '10 Oct 2024',
      status: 'expired',
      image: 'âŒš'
    },
  ];

  const getStatusInfo = (status: string) => {
    switch(status) {
      case 'active':
        return { color: '#4CAF50', text: 'Active', badgeColor: '#E8F5E8' };
      case 'expired':
        return { color: '#FF4444', text: 'ExpirÃ©e', badgeColor: '#FFE8E8' };
      case 'used':
        return { color: '#FF9800', text: 'UtilisÃ©e', badgeColor: '#FFF3E0' };
      default:
        return { color: '#666', text: 'Inconnu', badgeColor: '#F0F0F0' };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Garanties</Text>
        <TouchableOpacity>
          <Ionicons name="help-circle-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Statistiques */}
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>2</Text>
            <Text style={styles.statLabel}>Actives</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>ExpirÃ©es</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>UtilisÃ©es</Text>
          </View>
        </View>

        {/* Liste des garanties */}
        {warranties.map((warranty) => {
          const statusInfo = getStatusInfo(warranty.status);
          
          return (
            <View key={warranty.id} style={styles.warrantyCard}>
              <View style={styles.warrantyHeader}>
                <View style={styles.productInfo}>
                  <View style={styles.productImage}>
                    <Text style={styles.emoji}>{warranty.image}</Text>
                  </View>
                  <View>
                    <Text style={styles.productName}>{warranty.product}</Text>
                    <Text style={styles.orderId}>Commande #{warranty.orderId}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.badgeColor }]}>
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>
                    {statusInfo.text}
                  </Text>
                </View>
              </View>

              <View style={styles.warrantyDetails}>
                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.detailLabel}>Achat:</Text>
                    <Text style={styles.detailValue}>{warranty.purchaseDate}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="shield-checkmark-outline" size={16} color="#666" />
                    <Text style={styles.detailLabel}>Expire:</Text>
                    <Text style={styles.detailValue}>{warranty.warrantyEnd}</Text>
                  </View>
                </View>
              </View>

              {warranty.status === 'active' && (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="document-text-outline" size={16} color="#FF6B00" />
                    <Text style={styles.actionText}>Certificat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="chatbubble-outline" size={16} color="#FF6B00" />
                    <Text style={styles.actionText}>RÃ©clamation</Text>
                  </TouchableOpacity>
                </View>
              )}

              {warranty.status === 'expired' && (
                <TouchableOpacity style={styles.extendButton}>
                  <Text style={styles.extendButtonText}>Prolonger la garantie</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Information sur la garantie */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Ã€ propos de la garantie A2Express</Text>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.infoText}>Garantie fabricant 1 an incluse</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.infoText}>Support technique dÃ©diÃ©</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.infoText}>RÃ©paration ou remplacement</Text>
          </View>
          <TouchableOpacity style={styles.learnMoreButton}>
            <Text style={styles.learnMoreText}>En savoir plus sur la garantie</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  warrantyCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  warrantyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  productImage: {
    width: 50,
    height: 50,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 24,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  orderId: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  warrantyDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    marginRight: 4,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 12,
    color: '#FF6B00',
    fontWeight: '600',
    marginLeft: 4,
  },
  extendButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  extendButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  learnMoreButton: {
    marginTop: 8,
  },
  learnMoreText: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '600',
  },
});

