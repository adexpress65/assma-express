import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMessages } from '../../src/contexts/MessagesContext';

type TabType = 'social' | 'business' | 'shopping';

const stories = [
  { id: '1', name: 'Tech News', avatar: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=150', hasNewStories: true, live: true },
  { id: '2', name: 'Gaming', avatar: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=150', hasNewStories: true, live: false },
  { id: '3', name: 'Design', avatar: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=150', hasNewStories: false, live: true },
];

export default function HybridMessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { conversations, loading, refreshConversations } = useMessages();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<TabType>('business');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filterConversations = useMemo(() => {
    return (types: string[]) =>
      conversations.filter((conversation) => {
        const inTab = types.includes(conversation.type);
        if (!inTab) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystack = `${conversation.title || ''} ${conversation.lastMessage || ''} ${conversation.type || ''}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
  }, [conversations, normalizedSearch]);

  const socialConversations = useMemo(
    () => filterConversations(['group', 'channel', 'direct']),
    [filterConversations]
  );
  const businessConversations = useMemo(
    () => filterConversations(['support', 'seller', 'entrepreneur']),
    [filterConversations]
  );
  const shoppingConversations = useMemo(
    () => filterConversations(['order', 'promo']),
    [filterConversations]
  );

  const unreadConversationCount = useMemo(
    () => conversations.filter((item) => (item.unreadCount?.[user?.uid || ''] || 0) > 0).length,
    [conversations, user?.uid]
  );

  const activeConversations = useMemo(() => {
    if (activeTab === 'social') {
      return socialConversations;
    }
    if (activeTab === 'shopping') {
      return shoppingConversations;
    }
    return businessConversations;
  }, [activeTab, businessConversations, shoppingConversations, socialConversations]);

  const navigateToConversation = (conversation: any) => {
    if (!conversation?.id) {
      return;
    }
    router.push(`/conversation/${conversation.id}`);
  };

  const startCall = (type: 'audio' | 'video', conversationId: string) => {
    if (!user) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter');
      return;
    }

    const roomId = `call-${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    router.push({
      pathname: '/call/webrtc/[roomId]',
      params: { roomId, type, conversationId, userId: user.uid },
    });
  };

  const startLiveStream = (channelName?: string) => {
    if (!user) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter');
      return;
    }

    const roomId = `live-${channelName || 'general'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    router.push({
      pathname: '/call/webrtc/[roomId]',
      params: {
        roomId,
        type: 'video',
        mode: 'live',
        isHost: 'true',
        userId: user.uid,
        userName: user.displayName || 'Utilisateur',
        title: channelName || 'Live A2Express',
      },
    });
  };

  const joinLiveStream = (storyId: string) => {
    if (!user) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter');
      return;
    }

    router.push({
      pathname: '/call/webrtc/[roomId]',
      params: {
        roomId: `live-${storyId}`,
        type: 'video',
        mode: 'live',
        isHost: 'false',
        userId: user.uid,
        userName: user.displayName || 'Spectateur',
      },
    });
  };

  const createNewConversation = (type: string = 'direct') => {
    try {
      if (type === 'entrepreneur' || type === 'seller') {
        router.push('/search-entrepreneurs');
        return;
      }

      router.push({
        pathname: '/search-users',
        params: { type },
      });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer la conversation');
      console.error(error);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();

      if (diff < 60000) return 'Maintenant';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
      if (diff < 86400000) {
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  const getConversationIcon = (type: string) => {
    switch (type) {
      case 'group':
        return 'people';
      case 'support':
        return 'headset';
      case 'order':
        return 'bag-handle';
      case 'seller':
        return 'storefront';
      case 'entrepreneur':
        return 'briefcase';
      default:
        return 'chatbubbles';
    }
  };

  const renderConversationItem = ({ item }: { item: any }) => {
    const unreadCount = item.unreadCount?.[user?.uid || ''] || 0;

    return (
      <TouchableOpacity
        style={[styles.conversationCard, unreadCount > 0 && styles.conversationCardUnread]}
        onPress={() => navigateToConversation(item)}
        activeOpacity={0.9}
      >
        <View style={styles.conversationAvatar}>
          <Ionicons name={getConversationIcon(item.type) as any} size={22} color="#ff6a00" />
          {unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.conversationTitle, unreadCount > 0 && styles.conversationTitleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.conversationTime}>{formatTime(item.lastMessageTime)}</Text>
          </View>

          <Text style={[styles.conversationMessage, unreadCount > 0 && styles.conversationMessageUnread]} numberOfLines={2}>
            {item.lastMessage || 'Commencez la conversation...'}
          </Text>

          <View style={styles.conversationFooter}>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>
                {item.type === 'entrepreneur' ? 'Entrepreneur' : item.type}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.callButton} onPress={() => startCall('video', item.id)}>
          <Ionicons name="videocam" size={18} color="#ff6a00" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    const icon = activeTab === 'shopping' ? 'bag-handle-outline' : activeTab === 'social' ? 'chatbubbles-outline' : 'briefcase-outline';
    const title = activeTab === 'shopping' ? 'Aucune conversation shopping' : activeTab === 'social' ? 'Aucune conversation sociale' : 'Aucune conversation business';

    return (
      <View style={styles.emptyState}>
        <Ionicons name={icon as any} size={56} color="#b49a85" />
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptySubtitle}>Votre prochaine discussion importante apparaîtra ici.</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <RNStatusBar barStyle="dark-content" backgroundColor="#f6efe8" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerEyebrow}>Messagerie</Text>
            <Text style={styles.headerTitle}>A2Express</Text>
            <Text style={styles.headerSubtitle}>Messages rapides, business et commandes en un seul écran</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => router.push('/search-entrepreneurs')} style={styles.headerIconButton}>
              <Ionicons name="briefcase-outline" size={20} color="#8b5e34" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => createNewConversation()} style={styles.headerIconButton}>
              <Ionicons name="create-outline" size={20} color="#8b5e34" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{conversations.length}</Text>
            <Text style={styles.metricLabel}>Conversations</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{unreadConversationCount}</Text>
            <Text style={styles.metricLabel}>Non lus</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{loading ? '...' : activeConversations.length}</Text>
            <Text style={styles.metricLabel}>Affichés</Text>
          </View>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#a2866d" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un message, un vendeur, une commande..."
            placeholderTextColor="#a2866d"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.tabsContainer}>
          {[
            { key: 'social', label: 'Social', icon: 'sparkles-outline' },
            { key: 'business', label: 'Business', icon: 'business-outline' },
            { key: 'shopping', label: 'Shopping', icon: 'bag-handle-outline' },
          ].map((tab) => {
            const isActive = activeTab === tab.key;

            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key as TabType)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={isActive ? '#ffffff' : '#8b6b50'}
                />
                <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {activeTab === 'social' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storiesContent}
        >
          <TouchableOpacity style={styles.storyCard}>
            <View style={styles.storyCircleOwn}>
              <Image source={{ uri: user?.photoURL || 'https://via.placeholder.com/150' }} style={styles.storyAvatar} />
              <View style={styles.addStoryButton}>
                <Ionicons name="add" size={14} color="#ffffff" />
              </View>
            </View>
            <Text style={styles.storyName}>Votre story</Text>
          </TouchableOpacity>

          {stories.map((story) => (
            <TouchableOpacity
              key={story.id}
              style={styles.storyCard}
              onPress={() => (story.live ? joinLiveStream(story.id) : undefined)}
            >
              <View style={[styles.storyCircle, story.hasNewStories && styles.storyCircleActive]}>
                <Image source={{ uri: story.avatar }} style={styles.storyAvatar} />
                {story.live ? (
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.storyName}>{story.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : activeTab === 'business' ? (
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/search-entrepreneurs')}>
            <Ionicons name="people-outline" size={22} color="#ff6a00" />
            <Text style={styles.quickCardTitle}>Entrepreneurs</Text>
            <Text style={styles.quickCardText}>Nouveaux contacts qualifiés</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => createNewConversation('support')}>
            <Ionicons name="headset-outline" size={22} color="#ff6a00" />
            <Text style={styles.quickCardTitle}>Support</Text>
            <Text style={styles.quickCardText}>Assistance rapide et directe</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickCard} onPress={() => router.push('/orders')}>
            <Ionicons name="bag-check-outline" size={22} color="#ff6a00" />
            <Text style={styles.quickCardTitle}>Commandes</Text>
            <Text style={styles.quickCardText}>Suivi et discussions achats</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickCard, styles.quickCardAccent]} onPress={() => startLiveStream('shopping')}>
            <Ionicons name="videocam-outline" size={22} color="#ffffff" />
            <Text style={[styles.quickCardTitle, styles.quickCardTitleAccent]}>Live produits</Text>
            <Text style={[styles.quickCardText, styles.quickCardTextAccent]}>Démonstrations en direct</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={activeConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversationItem}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          refreshConversations().finally(() => setRefreshing(false));
        }}
        ListHeaderComponent={
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {activeTab === 'social' ? 'Messages sociaux' : activeTab === 'business' ? 'Conversations business' : 'Conversations shopping'}
            </Text>
            <Text style={styles.sectionMeta}>
              {loading ? 'Chargement...' : `${activeConversations.length} résultats`}
            </Text>
          </View>
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={8}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f1eb',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#f6efe8',
    borderBottomWidth: 1,
    borderBottomColor: '#eaded3',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b56d27',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  headerTitle: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '800',
    color: '#2f241b',
  },
  headerSubtitle: {
    marginTop: 4,
    maxWidth: 240,
    fontSize: 13,
    lineHeight: 18,
    color: '#7d6857',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eaded3',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#eaded3',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2f241b',
  },
  metricLabel: {
    marginTop: 2,
    fontSize: 12,
    color: '#8c7665',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eaded3',
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 13,
    paddingLeft: 10,
    color: '#2f241b',
    fontSize: 15,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eaded3',
  },
  tabButtonActive: {
    backgroundColor: '#1f1f1f',
    borderColor: '#1f1f1f',
  },
  tabButtonText: {
    color: '#8b6b50',
    fontSize: 13,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  storiesContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 12,
  },
  storyCard: {
    alignItems: 'center',
    width: 80,
  },
  storyCircleOwn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 2,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eaded3',
  },
  storyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 2,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eaded3',
  },
  storyCircleActive: {
    borderColor: '#ff6a00',
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
  },
  addStoryButton: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ff6a00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyName: {
    marginTop: 8,
    fontSize: 12,
    color: '#6f5a49',
  },
  liveBadge: {
    position: 'absolute',
    bottom: -2,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff4d73',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 4,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eaded3',
  },
  quickCardAccent: {
    backgroundColor: '#1f1f1f',
    borderColor: '#1f1f1f',
  },
  quickCardTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '800',
    color: '#2f241b',
  },
  quickCardTitleAccent: {
    color: '#fff',
  },
  quickCardText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: '#816d5d',
  },
  quickCardTextAccent: {
    color: '#e7d9cc',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2f241b',
  },
  sectionMeta: {
    fontSize: 12,
    color: '#9a836f',
  },
  listContent: {
    paddingBottom: 28,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eaded3',
  },
  conversationCardUnread: {
    borderColor: '#ffd0aa',
    backgroundColor: '#fffaf6',
  },
  conversationAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff2e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff6a00',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  conversationTitle: {
    flex: 1,
    marginRight: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#2f241b',
  },
  conversationTitleUnread: {
    color: '#1f1f1f',
  },
  conversationTime: {
    fontSize: 11,
    color: '#9b8573',
  },
  conversationMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: '#816d5d',
  },
  conversationMessageUnread: {
    color: '#5d4a3c',
  },
  conversationFooter: {
    flexDirection: 'row',
    marginTop: 8,
  },
  typePill: {
    backgroundColor: '#fff3e7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c56d20',
    textTransform: 'uppercase',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff2e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '800',
    color: '#4d392b',
  },
  emptySubtitle: {
    marginTop: 6,
    textAlign: 'center',
    color: '#8e7766',
    lineHeight: 20,
  },
});
