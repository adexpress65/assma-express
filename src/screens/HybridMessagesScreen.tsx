// src/screens/HybridMessagesScreen.tsx - SANS HOOK
import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  StyleSheet,
  StatusBar,
  Alert,
  TouchableOpacity,
  Text
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HybridHeader } from '../components/HybridHeader';
import { TikTokList } from '../components/TikTokList';
import { BusinessList } from '../components/BusinessList';
import { ShoppingList } from '../components/ShoppingList';

export default function HybridMessagesScreen() {
  // États locaux
  const [selectedTab, setSelectedTab] = useState<'social' | 'business' | 'shopping'>('social');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Données mock
  const [conversations, setConversations] = useState({
    social: [
      { id: '1', name: 'Tech Community', avatar: '💻', lastMessage: 'Nouveau live ce soir!', time: '5 min', unread: true, online: true, story: true, pinned: false, mute: false, isTyping: false },
      { id: '2', name: 'Gaming Group', avatar: '🎮', lastMessage: 'Tournament à 20h', time: '15 min', unread: false, online: true, story: false, pinned: true, mute: false, isTyping: true },
    ],
    business: [
      { id: '3', title: 'Support Assma', avatar: '🛒', lastMessage: 'Votre problème est résolu', time: '2h', unread: true, online: true, verified: true },
      { id: '4', title: 'TechStore', avatar: '💻', lastMessage: 'Commande expédiée', time: '1j', unread: false, online: false, verified: true },
    ],
    shopping: [
      { id: '5', title: 'Commande #12345', avatar: '📦', lastMessage: 'En cours de livraison', time: '3h', unread: false, status: 'shipped', amount: '899 DH' },
      { id: '6', title: 'Commande #67890', avatar: '🛍️', lastMessage: 'En préparation', time: '2j', unread: true, status: 'processing', amount: '1,299 DH' },
    ]
  });

  const unreadCounts = {
    social: conversations.social.filter(c => c.unread).length,
    business: conversations.business.filter(c => c.unread).length,
    shopping: conversations.shopping.filter(c => c.unread).length
  };

  const handleTabPress = (tab: 'social' | 'business' | 'shopping') => {
    setSelectedTab(tab);
  };

  const handleConversationPress = (tab: 'social' | 'business' | 'shopping', id: string) => {
    console.log(`Navigate to ${tab} conversation: ${id}`);
    Alert.alert('Navigation', `Vers conversation ${id} (${tab})`);
  };

  const handleInitializeData = () => {
    Alert.alert('Info', 'Fonctionnalité en développement');
  };

  const addTestConversation = (tab: 'social' | 'business' | 'shopping') => {
    const newConv = {
      id: `test-${Date.now()}`,
      ...(tab === 'social' ? {
        name: `Nouveau ${tab}`,
        avatar: '✨',
        lastMessage: 'Salut!',
        time: 'Maintenant',
        unread: true,
        online: true,
        story: false,
        pinned: false,
        mute: false,
        isTyping: false
      } : tab === 'business' ? {
        title: `Nouveau ${tab}`,
        avatar: '🏢',
        lastMessage: 'Bonjour!',
        time: 'Maintenant',
        unread: true,
        online: true,
        verified: false
      } : {
        title: `Commande #TEST`,
        avatar: '📦',
        lastMessage: 'Commande test',
        time: 'Maintenant',
        unread: true,
        status: 'pending',
        amount: '999 DH'
      })
    };

    setConversations(prev => ({
      ...prev,
      [tab]: [...prev[tab], newConv]
    }));
  };

  // Rendu du contenu
  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>
            Chargement des conversations...
          </Text>
        </View>
      );
    }

    const filteredConversations = conversations[selectedTab] || [];

    console.log('DEBUG - Tab:', selectedTab);
    console.log('DEBUG - Conversations:', filteredConversations.length);

    switch (selectedTab) {
      case 'social':
        return (
          <TikTokList
            conversations={filteredConversations}
            navigateToConversation={(id) => handleConversationPress('social', id)}
          />
        );
      
      case 'business':
        return (
          <BusinessList
            conversations={filteredConversations}
            navigateToConversation={(id) => handleConversationPress('business', id)}
          />
        );
      
      case 'shopping':
        return (
          <ShoppingList
            conversations={filteredConversations}
            navigateToConversation={(id) => handleConversationPress('shopping', id)}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      <HybridHeader
        activeTab={selectedTab}
        onTabChange={handleTabPress}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isSearchVisible={isSearchVisible}
        onSearchVisibilityChange={setIsSearchVisible}
        unreadCounts={unreadCounts}
      />
      
      {/* Bouton debug */}
      <TouchableOpacity 
        style={styles.debugButton}
        onPress={handleInitializeData}
      >
        <Ionicons name="refresh" size={20} color="#FFFFFF" />
        <Text style={styles.debugText}>Init Data</Text>
      </TouchableOpacity>
      
      <View style={styles.content}>
        {renderContent()}
        
        {/* Si pas de conversations */}
        {!isLoading && conversations[selectedTab].length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={selectedTab === 'business' ? 'business' : 'cart'} 
              size={64} 
              color="#666" 
            />
            <Text style={styles.emptyTitle}>
              Aucune conversation {selectedTab}
            </Text>
            <Text style={styles.emptySubtitle}>
              {selectedTab === 'social' ? 'Démarrez des conversations' :
               selectedTab === 'business' ? 'Contactez des entreprises' :
               'Suivez vos commandes'}
            </Text>
            
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => addTestConversation(selectedTab)}
            >
              <Ionicons name="add" size={20} color="#007AFF" />
              <Text style={styles.addButtonText}>
                Ajouter une conversation test
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  addButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  debugButton: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    zIndex: 1000,
  },
  debugText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});