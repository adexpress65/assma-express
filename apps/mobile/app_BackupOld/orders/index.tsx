import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function OrdersScreen() {
  const router = useRouter();

  const orders = [
    {
      id: 'ASMA-12345',
      date: '15 Oct 2024',
      status: 'livrÃ©',
      statusColor: '#4CAF50',
      items: 2,
      total: '1,198 DH',
      products: [
        { name: 'Smartphone Android 5G', image: 'ðŸ“±', price: '899 DH' },
        { name: 'Coque Protection', image: 'ðŸ“±', price: '299 DH' }
      ]
    },
    {
      id: 'ASMA-12346',
      date: '12 Oct 2024',
      status: 'en cours',
      statusColor: '#FF9800',
      items: 1,
      total: '299 DH',
      products: [
        { name: 'Casque Audio Bluetooth', image: 'ðŸŽ§', price: '299 DH' }
      ]
    },
    {
      id: 'ASMA-12347',
      date: '10 Oct 2024',
      status: 'annulÃ©',
      statusColor: '#FF4444',
      items: 1,
      total: '450 DH',
      products: [
        { name: 'Montre ConnectÃ©e Sport', image: 'âŒš', price: '450 DH' }
      ]
    },
  ];

  const getStatusText = (status: string) => {
    switch(status) {
    case 'livrÃ©': return <Text>LivrÃ©</Text>;
case 'en cours': return <Text>En cours de livraison</Text>;
case 'annulÃ©': return <Text>AnnulÃ©</Text>;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes Commandes</Text>
        <TouchableOpacity>
          <Ionicons name="filter" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>5</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>3</Text>
            <Text style={styles.statLabel}>LivrÃ©s</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>En cours</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>1</Text>
            <Text style={styles.statLabel}>AnnulÃ©s</Text>
          </View>
        </View>

        {orders.map((order) => (
          <TouchableOpacity key={order.id} style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <View>
                <Text style={styles.orderId}>Commande #{order.id}</Text>
                <Text style={styles.orderDate}>{order.date}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: order.statusColor }]}>
                <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
              </View>
            </View>

            <View style={styles.orderProducts}>
              {order.products.map((product, index) => (
                <View key={index} style={styles.productItem}>
                  <View style={styles.productImage}>
                    <Text style={styles.emoji}>{product.image}</Text>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={styles.productPrice}>{product.price}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.orderFooter}>
              <Text style={styles.orderTotal}>
                {order.items} article{order.items > 1 ? 's' : ''} â€¢ Total: {order.total}
              </Text>
              <View style={styles.actions}>
                {order.status === 'livrÃ©' && (
                  <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}>
                    <Text style={styles.actionText}>Noter</Text>
                  </TouchableOpacity>
                )}
                {order.status === 'en cours' && (
                  <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#2196F3' }]}>
                    <Text style={styles.actionText}>Suivre</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#666' }]}>
                  <Text style={styles.actionText}>DÃ©tails</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}
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
  orderCard: {
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  orderDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  orderProducts: {
    marginBottom: 12,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  productImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 20,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B00',
  },
  orderFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
});

