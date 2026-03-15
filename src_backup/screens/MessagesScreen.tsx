import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  FlatList, 
  TouchableOpacity, 
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMessages } from '../../src/contexts/MessagesContext';
import { useAuth } from '../../src/contexts/AuthContext';

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { 
    conversations, 
    loading, 
    setCurrentConversation,
    unreadCount 
  } = useMessages();
  
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrer les conversations
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = conv.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = activeTab === 'all' || (conv.unreadCount?.[user?.uid || ''] || 0) > 0;
    
    return matchesSearch && matchesTab;
  });

  const navigateToConversation = (conversation: any) => {
    setCurrentConversation(conversation);
    router.push(`/conversation/${conversation.id}`);
  };

  const startNewConversation = () => {
    Alert.alert(
      'Nouvelle conversation',
      'Cette fonctionnalité sera disponible bientôt!',
      [{ text: 'OK' }]
    );
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    try {
      // Gérer à la fois les timestamps Firebase et les dates normales
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      
      if (diff < 86400000) { // Moins de 24h
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      }
    } catch (error) {
      return '';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Chargement des messages...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={startNewConversation}>
            <Ionicons name="create-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher des conversations..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Onglets */}
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            Tous
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'unread' && styles.tabActive]}
          onPress={() => setActiveTab('unread')}
        >
          <View style={styles.tabBadge}>
            <Text style={styles.tabText}>
              Non lus
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Liste des conversations */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>Aucune conversation</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Aucun résultat pour votre recherche' : 'Commencez une nouvelle conversation'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const unreadCount = item.unreadCount?.[user?.uid || ''] || 0;
          
          return (
            <TouchableOpacity 
              style={styles.conversationItem}
              onPress={() => navigateToConversation(item)}
            >
              {/* Avatar */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.type === 'support' ? '🛒' : 
                   item.type === 'order' ? '📦' : 
                   item.participantAvatars?.[Object.keys(item.participantAvatars || {})[0]] || '👤'}
                </Text>
                {unreadCount > 0 && (
                  <View style={styles.unreadIndicator}>
                    <Text style={styles.unreadCount}>{unreadCount}</Text>
                  </View>
                )}
              </View>

              {/* Contenu */}
              <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                  <Text style={styles.conversationTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {/* ✅ CORRECTION ICI : lastMessageAt → lastMessageTime */}
                  <Text style={styles.conversationTime}>
                    {formatTime(item.lastMessageTime)}
                  </Text>
                </View>
                
                <Text 
                  style={[
                    styles.lastMessage,
                    unreadCount > 0 && styles.lastMessageUnread
                  ]} 
                  numberOfLines={2}
                >
                  {item.lastMessage || 'Aucun message'}
                </Text>

                {/* Badge type */}
                <View style={[
                  styles.typeBadge,
                  { backgroundColor: getTypeColor(item.type) }
                ]}>
                  <Text style={styles.typeText}>
                    {getTypeLabel(item.type)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

// Fonctions helpers
const getTypeColor = (type: string) => {
  switch (type) {
    case 'support': return '#E3F2FD';
    case 'order': return '#E8F5E8';
    case 'group': return '#FFF3E0';
    default: return '#F5F5F5';
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'support': return 'Support';
    case 'order': return 'Commande';
    case 'group': return 'Groupe';
    default: return 'Direct';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  tabActive: {
    backgroundColor: '#FF6B00',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#FFF',
  },
  tabBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadBadge: {
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  conversationItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  avatarText: {
    fontSize: 20,
  },
  unreadIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCount: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  conversationTime: {
    fontSize: 12,
    color: '#999',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginBottom: 6,
  },
  lastMessageUnread: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
});
