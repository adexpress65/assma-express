// src/components/TikTokList.tsx - VERSION CORRIGÉE AVEC DÉFAUTS
import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SocialConversation {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: boolean;
  online: boolean;
  story: boolean;
  pinned: boolean;
  mute: boolean;
  isTyping: boolean;
  members?: string[];
  lastSeen?: string;
}

interface TikTokListProps {
  conversations?: SocialConversation[];
  navigateToConversation: (id: string) => void;
}

const TikTokList: React.FC<TikTokListProps> = memo(({ 
  conversations = [], // VALEUR PAR DÉFAUT IMPORTANTE
  navigateToConversation 
}) => {
  const renderItem = useCallback(({ item }: { item: SocialConversation }) => {
    return (
      <TouchableOpacity
        style={[
          styles.conversationCard,
          item.pinned && styles.pinnedCard,
        ]}
        onPress={() => navigateToConversation(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.leftSection}>
          <View style={[
            styles.avatar,
            item.online && styles.onlineAvatar,
            item.story && styles.hasStory
          ]}>
            <Text style={styles.avatarText}>
              {item.avatar || '👤'}
            </Text>
            {item.online && <View style={styles.onlineDot} />}
          </View>
          
          <View style={styles.conversationInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              {item.pinned && (
                <Ionicons name="pin" size={12} color="#FF6B00" />
              )}
            </View>
            
            <Text style={[
              styles.lastMessage,
              item.unread && styles.unreadMessage
            ]} numberOfLines={2}>
              {item.isTyping ? '... en train d\'écrire' : item.lastMessage}
            </Text>
            
            {item.members && item.members.length > 0 && (
              <Text style={styles.membersText}>
                {item.members.length} membres • {item.lastSeen || 'récemment'}
              </Text>
            )}
          </View>
        </View>
        
        <View style={styles.rightSection}>
          <Text style={styles.time}>
            {item.time}
          </Text>
          {item.unread && <View style={styles.unreadBadge} />}
          {item.mute && (
            <Ionicons name="volume-mute" size={14} color="#666" />
          )}
        </View>
      </TouchableOpacity>
    );
  }, [navigateToConversation]);

  const keyExtractor = useCallback((item: SocialConversation) => item.id, []);

  // VÉRIFIEZ SI conversations EST DÉFINI ET NON VIDE
  if (!conversations || conversations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubble-ellipses-outline" size={64} color="#666" />
        <Text style={styles.emptyTitle}>Aucune conversation sociale</Text>
        <Text style={styles.emptySubtitle}>
          Rejoignez des groupes ou démarrez des conversations
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
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
    minHeight: 80,
  },
  pinnedCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B00',
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#3A3A3C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  onlineAvatar: {
    borderWidth: 2,
    borderColor: '#34C759',
  },
  hasStory: {
    borderWidth: 2,
    borderColor: '#FF6B00',
  },
  avatarText: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  onlineDot: {
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
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
  },
  lastMessage: {
    color: '#8E8E93',
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 18,
  },
  unreadMessage: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  membersText: {
    color: '#666',
    fontSize: 12,
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 50,
  },
  time: {
    color: '#8E8E93',
    fontSize: 12,
    marginBottom: 8,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B00',
  },
});

export default TikTokList; 
