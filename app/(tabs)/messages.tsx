// app/(tabs)/messages.tsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  FlatList, 
  TouchableOpacity, 
  TextInput,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
  Image,
  StatusBar as RNStatusBar,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useMessages, ConversationType } from '../../src/contexts/MessagesContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth } = Dimensions.get('window');

export default function HybridMessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { conversations, loading, createConversation, refreshConversations } = useMessages();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<'social' | 'business' | 'shopping'>('business'); // Changé à 'business' par défaut
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const stories = [
    { id: '1', name: 'Tech News', avatar: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=150', hasNewStories: true, live: true },
    { id: '2', name: 'Gaming', avatar: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=150', hasNewStories: true, live: false },
    { id: '3', name: 'Design', avatar: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=150', hasNewStories: false, live: true },
  ];

  const navigateToConversation = (conversation: any) => {
    if (!conversation?.id) return;
    router.push(`/conversation/${conversation.id}`);
  };

  const startCall = (type: 'audio' | 'video', conversationId: string) => {
    if (!user) { Alert.alert('Connexion requise', 'Veuillez vous connecter'); return; }
    const roomId = `call-${conversationId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    router.push({ pathname: '/call/webrtc/[roomId]', params: { roomId, type, conversationId, userId: user.uid }});
  };

  const startLiveStream = (channelName?: string) => {
    if (!user) { Alert.alert('Connexion requise', 'Veuillez vous connecter'); return; }
    const roomId = `live-${channelName || 'general'}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    router.push({ pathname: '/call/webrtc/[roomId]', params: { roomId, type: 'video', mode: 'live', isHost: 'true', userId: user.uid, userName: user.displayName || 'Utilisateur', title: channelName || 'Live A2Express' }});
  };

  const joinLiveStream = (storyId: string) => {
    if (!user) { Alert.alert('Connexion requise', 'Veuillez vous connecter'); return; }
    router.push({ pathname: '/call/webrtc/[roomId]', params: { roomId: `live-${storyId}`, type: 'video', mode: 'live', isHost: 'false', userId: user.uid, userName: user.displayName || 'Spectateur' }});
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      if (diff < 60000) return 'maintenant';
      if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
      if (diff < 86400000) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  const SocialTab = () => {
    const socialConversations = conversations.filter(conv => ['group', 'channel', 'direct'].includes(conv.type));
    return (
      <View style={{ flex: 1 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesContent}>
          <TouchableOpacity style={styles.storyCard}>
            <View style={styles.yourStoryCircle}>
              <Image source={{ uri: user?.photoURL || 'https://via.placeholder.com/150' }} style={styles.storyAvatar} />
              <View style={styles.addStoryBtn}><Ionicons name="add" size={16} color="#000" /></View>
            </View>
            <Text style={styles.storyName}>Votre story</Text>
          </TouchableOpacity>
          {stories.map((story) => (
            <TouchableOpacity key={story.id} style={styles.storyCard} onPress={() => story.live ? joinLiveStream(story.id) : null}>
              <View style={[styles.storyCircle, story.hasNewStories && styles.storyCircleNew]}>
                <Image source={{ uri: story.avatar }} style={styles.storyAvatar} />
                {story.live && (<View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>)}
              </View>
              <Text style={styles.storyName}>{story.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => setIsSearchVisible(!isSearchVisible)}>
            <Ionicons name="search" size={20} color="#FFF" />
            <Text style={styles.quickActionText}>Rechercher</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.quickActionBtn} 
            onPress={() => router.push('/innovation-hub')}
          >
            <Ionicons name="rocket" size={20} color="#FFF" /> 
            <Text style={styles.quickActionText}>Innovation</Text> 
          </TouchableOpacity>

          <TouchableOpacity style={[styles.quickActionBtn, styles.liveBtn]} onPress={() => startLiveStream('general')}>
            <Ionicons name="videocam" size={20} color="#FFF" />
            <Text style={styles.quickActionText}>Live</Text>
          </TouchableOpacity>
        </View>

        {isSearchVisible && (
          <View style={styles.searchBox}>
            <TextInput 
              style={styles.searchInput} 
              placeholder="Rechercher..." 
              placeholderTextColor="#666" 
              value={searchQuery} 
              onChangeText={setSearchQuery} 
            />
          </View>
        )}
        
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Messages Sociaux</Text>
          <Text style={styles.listSubtitle}>
            {socialConversations.filter(c => (c.unreadCount?.[user?.uid || ''] || 0) > 0).length} non lus
          </Text>
        </View>
        
        <FlatList
          data={socialConversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversationItem item={item} onPress={() => navigateToConversation(item)} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); refreshConversations().finally(() => setRefreshing(false));}}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={64} color="#333" />
              <Text style={styles.emptyTitle}>Aucune conversation</Text>
            </View>
          }
        />
      </View>
    );
  };

  const BusinessTab = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>Business</Text>
        <Text style={styles.tabSubtitle}>Entrepreneurs, vendeurs et support</Text>
      </View>
      
      {/* ? NOUVEAU : Bannière pour contacter les entrepreneurs */}
      <TouchableOpacity 
        style={styles.entrepreneurBanner}
        onPress={() => router.push('/search-entrepreneurs')}
        activeOpacity={0.7}
      >
        <View style={styles.bannerContent}>
          <View style={styles.bannerIconContainer}>
            <Ionicons name="people" size={32} color="#FF6B00" />
          </View>
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>Contacter un entrepreneur</Text>
            <Text style={styles.bannerSubtitle}>
              Discutez directement avec les créateurs et innovateurs
            </Text>
            <View style={styles.bannerBadge}>
              <Ionicons name="chatbubble" size={12} color="#FF6B00" />
              <Text style={styles.bannerBadgeText}>Nouveau</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </View>
      </TouchableOpacity>

      <View style={styles.businessActions}>
        <TouchableOpacity 
          style={styles.bizActionBtn} 
          onPress={() => router.push('/search-entrepreneurs')}
        >
          <Ionicons name="briefcase" size={24} color="#FF6B00" />
          <Text style={styles.bizActionText}>Entrepreneurs</Text>
          <Text style={styles.bizActionSubtext}>Voir tous</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.bizActionBtn} 
          onPress={() => createNewConversation('seller')}
        >
          <Ionicons name="storefront" size={24} color="#FF6B00" />
          <Text style={styles.bizActionText}>Vendeurs</Text>
          <Text style={styles.bizActionSubtext}>Marketplace</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.bizActionBtn} 
          onPress={() => createNewConversation('support')}
        >
          <Ionicons name="headset" size={24} color="#FF6B00" />
          <Text style={styles.bizActionText}>Support</Text>
          <Text style={styles.bizActionSubtext}>Assistance</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderTitle}>Conversations Business</Text>
        <TouchableOpacity onPress={() => router.push('/search-entrepreneurs')}>
          <Text style={styles.sectionHeaderLink}>Voir tout</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations.filter(c => ['support', 'seller', 'entrepreneur'].includes(c.type))}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ConversationItem item={item} onPress={() => navigateToConversation(item)} showType={true} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={64} color="#333" />
            <Text style={styles.emptyTitle}>Aucune conversation business</Text>
            <TouchableOpacity 
              style={styles.emptyStateButton}
              onPress={() => router.push('/search-entrepreneurs')}
            >
              <Text style={styles.emptyStateButtonText}>Contacter un entrepreneur</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );

  const ShoppingTab = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>Shopping</Text>
        <Text style={styles.tabSubtitle}>Commandes et promotions</Text>
      </View>
      
      <View style={styles.shoppingSummary}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>0</Text>
          <Text style={styles.summaryLabel}>Commandes</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>0</Text>
          <Text style={styles.summaryLabel}>Panier</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>0</Text>
          <Text style={styles.summaryLabel}>Favoris</Text>
        </View>
      </View>

      <FlatList
        data={conversations.filter(c => ['order', 'promo'].includes(c.type))}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ConversationItem item={item} onPress={() => navigateToConversation(item)} showType={true} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cart-outline" size={64} color="#333" />
            <Text style={styles.emptyTitle}>Aucune commande</Text>
          </View>
        }
      />
    </View>
  );

  const ConversationItem = ({ item, onPress, showType }: any) => {
    const unreadCount = item.unreadCount?.[user?.uid || ''] || 0;
    const getIcon = (type: string) => { 
      switch(type) { 
        case 'group': return 'people'; 
        case 'support': return 'headset'; 
        case 'order': return 'bag';
        case 'seller': return 'storefront';
        case 'entrepreneur': return 'briefcase';
        default: return 'chatbubbles'; 
      }
    };
    return (
      <TouchableOpacity style={[styles.convCard, unreadCount > 0 && styles.unreadCard]} onPress={onPress}>
        <View style={styles.convAvatar}>
          <Ionicons name={getIcon(item.type)} size={24} color="#FF6B00" />
          {unreadCount > 0 && <View style={styles.unreadDot} />}
        </View>
        <View style={styles.convContent}>
          <View style={styles.convHeader}>
            <Text style={[styles.convTitle, unreadCount > 0 && styles.unreadTitle]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.convTime}>{formatTime(item.lastMessageTime)}</Text>
          </View>
          <Text style={[styles.convMessage, unreadCount > 0 && styles.unreadMessage]} numberOfLines={2}>
            {item.lastMessage || 'Commencez la conversation...'}
          </Text>
          {showType && (
            <View style={styles.typeContainer}>
              <Text style={styles.convType}>{item.type === 'entrepreneur' ? 'Entrepreneur' : item.type}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => startCall('video', item.id)} style={styles.callBtn}>
          <Ionicons name="videocam" size={18} color="#FFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };
  
  const createNewConversation = async (type: string = 'direct') => {
    try {
      if (type === 'entrepreneur' || type === 'seller') {
        router.push('/search-entrepreneurs');
      } else {
        router.push({
          pathname: '/search-users',
          params: { type }
        });
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible de créer la conversation");
      console.error(error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <RNStatusBar barStyle="light-content" backgroundColor="#000" />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>A2Express Messenger</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              onPress={() => router.push('/search-entrepreneurs')}
              style={styles.headerButton}
            >
              <Ionicons name="briefcase" size={24} color="#FF6B00" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => createNewConversation()}>
              <Ionicons name="create-outline" size={24} color="#FF6B00" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.tabsContainer}>
          {['social', 'business', 'shopping'].map((tab) => (
            <TouchableOpacity key={tab} style={styles.tab} onPress={() => setActiveTab(tab as any)}>
              <View style={styles.tabContent}>
                <Ionicons 
                  name={tab === 'social' ? 'flash' : tab === 'business' ? 'business' : 'cart'} 
                  size={18} 
                  color={activeTab === tab ? '#FF6B00' : '#666'} 
                />
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </View>
              {activeTab === tab && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.content}>
        {activeTab === 'social' && <SocialTab />}
        {activeTab === 'business' && <BusinessTab />}
        {activeTab === 'shopping' && <ShoppingTab />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: { flex: 1 },
  header: { backgroundColor: '#000000', borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  headerTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12 
  },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerButton: { marginRight: 8 },
  tabsContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  tabContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { color: '#666', fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: '#FF6B00' },
  activeIndicator: { 
    position: 'absolute', 
    bottom: 0, 
    width: '60%', 
    height: 3, 
    backgroundColor: '#FF6B00', 
    borderRadius: 2 
  },
  storiesContent: { paddingHorizontal: 12, paddingVertical: 12 },
  storyCard: { alignItems: 'center', marginHorizontal: 8, width: 80 },
  yourStoryCircle: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    borderWidth: 2, 
    borderColor: '#666', 
    padding: 2, 
    position: 'relative' 
  },
  storyCircle: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    borderWidth: 2, 
    borderColor: '#333', 
    padding: 2, 
    position: 'relative' 
  },
  storyCircleNew: { borderColor: '#FF6B00' },
  storyAvatar: { width: '100%', height: '100%', borderRadius: 35 },
  addStoryBtn: { 
    position: 'absolute', 
    bottom: -2, 
    right: -2, 
    backgroundColor: '#FFF', 
    width: 24, 
    height: 24, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderColor: '#000' 
  },
  storyName: { color: '#FFFFFF', fontSize: 12, marginTop: 6 },
  liveBadge: { 
    position: 'absolute', 
    bottom: 0, 
    alignSelf: 'center', 
    backgroundColor: '#FF0066', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 10 
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF', marginRight: 3 },
  liveText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },
  quickActions: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    paddingHorizontal: 12, 
    paddingVertical: 12 
  },
  quickActionBtn: { 
    backgroundColor: '#1A1A1A', 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 20, 
    gap: 6 
  },
  liveBtn: { backgroundColor: '#FF0066' },
  quickActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
  searchBox: { margin: 12, backgroundColor: '#1A1A1A', borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { color: '#FFFFFF', paddingVertical: 12, fontSize: 15 },
  listHeader: { 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  listTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },
  listSubtitle: { color: '#FF6B00', fontSize: 14, fontWeight: '600' },
  
  // ? Nouveaux styles pour les entrepreneurs
  entrepreneurBanner: {
    backgroundColor: '#1A1A1A',
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FF6B00',
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  bannerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B0020',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  bannerSubtitle: {
    color: '#999',
    fontSize: 13,
    marginBottom: 8,
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B0020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  bannerBadgeText: {
    color: '#FF6B00',
    fontSize: 11,
    fontWeight: '600',
  },
  
  businessActions: { 
    flexDirection: 'row', 
    paddingHorizontal: 16, 
    paddingBottom: 16, 
    gap: 12 
  },
  bizActionBtn: { 
    flex: 1, 
    backgroundColor: '#1A1A1A', 
    borderRadius: 12, 
    padding: 16, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#2A2A2A' 
  },
  bizActionText: { color: '#FFFFFF', marginTop: 8, fontWeight: '500' },
  bizActionSubtext: { color: '#999', fontSize: 11, marginTop: 2 },
  
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  sectionHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeaderLink: {
    color: '#FF6B00',
    fontSize: 14,
  },
  
  convCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 14, 
    borderBottomWidth: 0.5, 
    borderBottomColor: '#1A1A1A', 
    backgroundColor: '#000000' 
  },
  unreadCard: { backgroundColor: '#0A0A0A' },
  convAvatar: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: '#1A1A1A', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12, 
    position: 'relative' 
  },
  unreadDot: { 
    position: 'absolute', 
    top: 0, 
    right: 0, 
    width: 12, 
    height: 12, 
    borderRadius: 6, 
    backgroundColor: '#FF6B00', 
    borderWidth: 2, 
    borderColor: '#000' 
  },
  convContent: { flex: 1 },
  convHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 4 
  },
  convTitle: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontWeight: '600', 
    flex: 1, 
    marginRight: 8 
  },
  unreadTitle: { fontWeight: 'bold' },
  convTime: { color: '#666', fontSize: 12 },
  convMessage: { color: '#666', fontSize: 14, lineHeight: 20 },
  unreadMessage: { color: '#CCCCCC' },
  typeContainer: {
    marginTop: 4,
  },
  convType: { 
    color: '#FF6B00', 
    fontSize: 11, 
    textTransform: 'uppercase' 
  },
  callBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#2A2A2A', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginLeft: 8 
  },
  emptyState: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    marginTop: 16,
    marginBottom: 12,
  },
  emptyStateButton: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tabHeader: { 
    padding: 16, 
    borderBottomWidth: 0.5, 
    borderColor: '#1A1A1A' 
  },
  tabTitle: { 
    color: '#FFFFFF', 
    fontSize: 24, 
    fontWeight: 'bold' 
  },
  tabSubtitle: { 
    color: '#666', 
    fontSize: 14, 
    marginTop: 4 
  },
  shoppingSummary: { 
    flexDirection: 'row', 
    padding: 16, 
    gap: 12 
  },
  summaryCard: { 
    flex: 1, 
    backgroundColor: '#1A1A1A', 
    borderRadius: 12, 
    padding: 16, 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#2A2A2A' 
  },
  summaryNumber: { 
    color: '#FF6B00', 
    fontSize: 24, 
    fontWeight: 'bold' 
  },
  summaryLabel: { 
    color: '#666', 
    fontSize: 12, 
    marginTop: 4 
  },
});