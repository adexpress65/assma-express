// src/components/ShoppingList.tsx - VERSION SIMPLIFIÉE
import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Créer FlatList animée
const AnimatedFlatList = Animated.createAnimatedComponent(Animated.FlatList);

interface ShoppingConversation {
  id: string;
  title: string;
  type: string;
  participantNames: { [key: string]: string };
  participantAvatars: { [key: string]: string };
  lastMessage?: string;
  lastMessageTime?: any;
  unreadCount?: { [key: string]: number };
  shoppingData?: {
    orderId?: string;
    orderStatus?: string;
    totalAmount?: string;
    itemsCount?: number;
    estimatedDelivery?: string;
    trackingNumber?: string;
  };
}

interface ShoppingListProps {
  conversations: ShoppingConversation[];
  navigateToConversation: (id: string) => void;
}

const ShoppingList: React.FC<ShoppingListProps> = memo(({ 
  conversations, 
  navigateToConversation 
}) => {
  const renderItem = ({ item }: { item: ShoppingConversation }) => {
    const unread = item.unreadCount ? Object.values(item.unreadCount).some(count => count > 0) : false;
    
    return (
      <TouchableOpacity
        style={styles.conversationCard}
        onPress={() => navigateToConversation(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.leftSection}>
          <View style={[
            styles.statusIcon,
            getStatusStyle(item.shoppingData?.orderStatus)
          ]}>
            <Ionicons 
              name={getStatusIcon(item.shoppingData?.orderStatus)} 
              size={24} 
              color="#FFFFFF" 
            />
          </View>
          
          <View style={styles.conversationInfo}>
            <Text style={styles.conversationTitle} numberOfLines={1}>
              {item.title}
            </Text>
            
            {item.shoppingData && (
              <>
                <Text style={styles.orderInfo}>
                  {item.shoppingData.itemsCount} article{item.shoppingData.itemsCount !== 1 ? 's' : ''} • {item.shoppingData.totalAmount}
                </Text>
                
                <Text style={styles.statusText}>
                  Statut: <Text style={getStatusTextStyle(item.shoppingData.orderStatus)}>
                    {item.shoppingData.orderStatus}
                  </Text>
                  {item.shoppingData.estimatedDelivery && ` • ${item.shoppingData.estimatedDelivery}`}
                </Text>
              </>
            )}
            
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage || 'Suivi de commande'}
            </Text>
          </View>
        </View>
        
        <View style={styles.rightSection}>
          {unread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {Object.values(item.unreadCount || {}).reduce((a, b) => a + b, 0)}
              </Text>
            </View>
          )}
          
          <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
        </View>
      </TouchableOpacity>
    );
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'delivered': return 'checkmark-circle';
      case 'shipped': return 'airplane';
      case 'processing': return 'time';
      case 'cancelled': return 'close-circle';
      default: return 'cart';
    }
  };

  const getStatusStyle = (status?: string) => {
    switch (status) {
      case 'delivered': return styles.statusDelivered;
      case 'shipped': return styles.statusShipped;
      case 'processing': return styles.statusProcessing;
      case 'cancelled': return styles.statusCancelled;
      default: return styles.statusDefault;
    }
  };

  const getStatusTextStyle = (status?: string) => {
    switch (status) {
      case 'delivered': return styles.statusTextDelivered;
      case 'shipped': return styles.statusTextShipped;
      case 'processing': return styles.statusTextProcessing;
      case 'cancelled': return styles.statusTextCancelled;
      default: return styles.statusTextDefault;
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  if (conversations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cart" size={64} color="#666" />
        <Text style={styles.emptyTitle}>Aucune commande en cours</Text>
        <Text style={styles.emptySubtitle}>
          Vos conversations de commande apparaîtront ici
        </Text>
      </View>
    );
  }

  return (
    <AnimatedFlatList
      data={conversations}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContainer}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews={Platform.OS === 'android'}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={21}
      updateCellsBatchingPeriod={50}
    />
  );
});

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
    backgroundColor: '#000000',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#000000',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
  },
  conversationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statusIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusDefault: { backgroundColor: '#007AFF' },
  statusProcessing: { backgroundColor: '#FF9500' },
  statusShipped: { backgroundColor: '#5856D6' },
  statusDelivered: { backgroundColor: '#34C759' },
  statusCancelled: { backgroundColor: '#FF3B30' },
  conversationInfo: {
    flex: 1,
  },
  conversationTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  orderInfo: {
    color: '#8E8E93',
    fontSize: 12,
    marginBottom: 4,
  },
  statusText: {
    color: '#8E8E93',
    fontSize: 12,
    marginBottom: 4,
  },
  statusTextDefault: { color: '#007AFF' },
  statusTextProcessing: { color: '#FF9500' },
  statusTextShipped: { color: '#5856D6' },
  statusTextDelivered: { color: '#34C759' },
  statusTextCancelled: { color: '#FF3B30' },
  lastMessage: {
    color: '#8E8E93',
    fontSize: 14,
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 50,
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default ShoppingList;
