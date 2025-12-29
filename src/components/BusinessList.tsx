// src/components/BusinessList.tsx - VERSION CORRIGÉE
import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  Platform,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Créer FlatList animée
const AnimatedFlatList = Animated.createAnimatedComponent(Animated.FlatList);

interface BusinessConversation {
  id: string;
  title: string;
  type: string;
  participantNames: { [key: string]: string };
  participantAvatars: { [key: string]: string };
  lastMessage?: string;
  lastMessageTime?: any;
  unreadCount?: { [key: string]: number };
  businessData?: {
    companyId: string;
    status: 'online' | 'away' | 'offline' | 'busy';
    verified: boolean;
    category: string;
    responseTime: string;
  };
}

interface BusinessListProps {
  conversations: BusinessConversation[];
  navigateToConversation: (id: string) => void;
}

const BusinessList: React.FC<BusinessListProps> = memo(({ 
  conversations, 
  navigateToConversation 
}) => {
  const renderItem = ({ item }: { item: BusinessConversation }) => {
    const unread = item.unreadCount ? Object.values(item.unreadCount).some(count => count > 0) : false;
    const isOnline = item.businessData?.status === 'online';
    
    return (
      <TouchableOpacity
        style={styles.conversationCard}
        onPress={() => navigateToConversation(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <View style={[
            styles.avatar,
            isOnline && styles.onlineAvatar
          ]}>
            <Text style={styles.avatarText}>
              {item.participantAvatars[Object.keys(item.participantAvatars)[1]] || '🏢'}
            </Text>
          </View>
          {isOnline && <View style={styles.onlineIndicator} />}
        </View>
        
        <View style={styles.conversationInfo}>
          <View style={styles.headerRow}>
            <Text style={styles.conversationTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.businessData?.verified && (
              <Ionicons name="checkmark-circle" size={16} color="#007AFF" />
            )}
          </View>
          
          {item.businessData && (
            <Text style={styles.companyCategory}>
              {item.businessData.category} • {item.businessData.responseTime}
            </Text>
          )}
          
          <Text style={styles.lastMessage} numberOfLines={2}>
            {item.lastMessage || 'Nouvelle conversation'}
          </Text>
        </View>
        
        <View style={styles.rightSection}>
          {unread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {Object.values(item.unreadCount || {}).reduce((a, b) => a + b, 0)}
              </Text>
            </View>
          )}
          
          {item.lastMessageTime && (
            <Text style={styles.timeText}>
              {formatTime(item.lastMessageTime)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 60) return `${diffMins} min`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
      return `${Math.floor(diffMins / 1440)}j`;
    } catch (error) {
      return '';
    }
  };

  if (conversations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="business" size={64} color="#666" />
        <Text style={styles.emptyTitle}>Aucune conversation business</Text>
        <Text style={styles.emptySubtitle}>
          Contactez des entreprises pour commencer
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
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3A3A3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineAvatar: {
    borderWidth: 2,
    borderColor: '#34C759',
  },
  avatarText: {
    fontSize: 24,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#1C1C1E',
  },
  conversationInfo: {
    flex: 1,
    marginRight: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
    flex: 1,
  },
  companyCategory: {
    color: '#8E8E93',
    fontSize: 12,
    marginBottom: 6,
  },
  lastMessage: {
    color: '#8E8E93',
    fontSize: 14,
    lineHeight: 18,
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 50,
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timeText: {
    color: '#8E8E93',
    fontSize: 12,
  },
});

export default BusinessList;