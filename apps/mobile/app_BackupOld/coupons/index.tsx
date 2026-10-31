import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function CouponsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('active');

  const activeCoupons = [
    {
      id: 'CPN-001',
      code: 'WELCOME10',
      discount: '10%',
      description: '10% de rÃ©duction sur votre premiÃ¨re commande',
      minAmount: '100 DH',
      expiryDate: '30 Nov 2024',
      used: false
    },
    {
      id: 'CPN-002',
      code: 'FREE50',
      discount: '50 DH',
      description: '50 DH de rÃ©duction dÃ¨s 200 DH d\'achat',
      minAmount: '200 DH',
      expiryDate: '15 Nov 2024',
      used: false
    },
  ];

  const expiredCoupons = [
    {
      id: 'CPN-003',
      code: 'SUMMER20',
      discount: '20%',
      description: '20% de rÃ©duction Ã©tÃ© 2024',
      minAmount: '150 DH',
      expiryDate: '30 Sep 2024',
      used: true
    },
  ];

  const coupons = activeTab === 'active' ? activeCoupons : expiredCoupons;

  const copyToClipboard = (code: string) => {
    // Ici vous utiliseriez un package de clipboard
    alert(`Code ${code} copiÃ© !`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Coupons</Text>
        <TouchableOpacity>
          <Ionicons name="gift-outline" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Actifs ({activeCoupons.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'expired' && styles.tabActive]}
          onPress={() => setActiveTab('expired')}
        >
          <Text style={[styles.tabText, activeTab === 'expired' && styles.tabTextActive]}>
            ExpirÃ©s ({expiredCoupons.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {coupons.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="ticket-outline" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>Aucun coupon {activeTab === 'active' ? 'actif' : 'expirÃ©'}</Text>
            <Text style={styles.emptyDescription}>
              {activeTab === 'active' 
                ? 'Les coupons disponibles apparaÃ®tront ici' 
                : 'Les coupons expirÃ©s apparaÃ®tront ici'
              }
            </Text>
          </View>
        ) : (
          coupons.map((coupon) => (
            <View key={coupon.id} style={[
              styles.couponCard,
              activeTab === 'expired' && styles.couponCardExpired
            ]}>
              <View style={styles.couponHeader}>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{coupon.discount}</Text>
                  <Text style={styles.offText}>DE RÃ‰DUCTION</Text>
                </View>
                <View style={styles.codeSection}>
                  <Text style={styles.codeLabel}>CODE</Text>
                  <View style={styles.codeContainer}>
                    <Text style={styles.codeText}>{coupon.code}</Text>
                    <TouchableOpacity 
                      style={styles.copyButton}
                      onPress={() => copyToClipboard(coupon.code)}
                    >
                      <Ionicons name="copy-outline" size={16} color="#FF6B00" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.couponBody}>
                <Text style={styles.couponDescription}>{coupon.description}</Text>
                
                <View style={styles.couponDetails}>
                  <View style={styles.detailItem}>
                    <Ionicons name="cart-outline" size={14} color="#666" />
                    <Text style={styles.detailText}>Min. {coupon.minAmount}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar-outline" size={14} color="#666" />
                    <Text style={styles.detailText}>Expire le {coupon.expiryDate}</Text>
                  </View>
                </View>

                {activeTab === 'active' && (
                  <TouchableOpacity style={styles.useButton}>
                    <Text style={styles.useButtonText}>Utiliser ce coupon</Text>
                  </TouchableOpacity>
                )}

                {activeTab === 'expired' && (
                  <View style={styles.expiredBadge}>
                    <Text style={styles.expiredText}>ExpirÃ©</Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
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
  tabs: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#FF6B00',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#FF6B00',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  couponCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FF6B00',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  couponCardExpired: {
    borderColor: '#CCC',
    opacity: 0.7,
  },
  couponHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFF8F0',
    padding: 16,
  },
  discountBadge: {
    alignItems: 'center',
    marginRight: 16,
  },
  discountText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  offText: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  },
  codeSection: {
    flex: 1,
  },
  codeLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  codeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  codeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 1,
  },
  copyButton: {
    padding: 4,
  },
  couponBody: {
    padding: 16,
  },
  couponDescription: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
    lineHeight: 20,
  },
  couponDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  useButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  useButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  expiredBadge: {
    backgroundColor: '#CCC',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  expiredText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
});

