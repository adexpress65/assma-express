// app/messages/index.tsx - VERSION ROBUSTE
import React, { useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Text,
  ScrollView
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Hooks
import { useHybridMessaging } from '../../src/hooks/useHybridMessaging';

// NE PAS IMPORTER - Créez des versions simples
// import HybridHeader from '../../src/components/HybridHeader';
// import TikTokList from '../../src/components/TikTokList';
// import BusinessList from '../../src/components/BusinessList';
// import ShoppingList from '../../src/components/ShoppingList';

// Initialisation
import { initializeConversations } from '../../src/config/initFirebaseData';
import { useAuth } from '../../src/contexts/AuthContext';

// COMPOSANTS SIMPLES POUR DÉBUGUER
const HybridHeader = ({ 
  activeTab, 
  onTabChange, 
  searchQuery, 
  onSearchChange, 
  isSearchVisible, 
  onSearchVisibilityChange,
  unreadCounts 
}) => {
  const tabs = [
    { id: 'social', label: 'Social', icon: 'chatbubbles' },
    { id: 'business', label: 'Business', icon: 'business' },
    { id: 'shopping', label: 'Shopping', icon: 'cart' }
  ];
  
  return (
    <View style={customStyles.header}>
      <View style={customStyles.headerTop}>
        <Text style={customStyles.headerTitle}>Messages</Text>
        <TouchableOpacity onPress={() => onSearchVisibilityChange?.(!isSearchVisible)}>
          <Ionicons name="search" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      
      {isSearchVisible && (
        <View style={customStyles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={customStyles.searchInput}
            placeholder="Rechercher..."
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholderTextColor="#666"
          />
        </View>
      )}
      
      <View style={customStyles.tabsContainer}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[
              customStyles.tab,
              activeTab === tab.id && customStyles.activeTab
            ]}
            onPress={() => onTabChange(tab.id)}
          >
            <Ionicons 
              name={tab.icon} 
              size={20} 
              color={activeTab === tab.id ? '#007AFF' : '#666'} 
            />
            <Text style={[
              customStyles.tabLabel,
              activeTab === tab.id && customStyles.activeTabLabel
            ]}>
              {tab.label}
            </Text>
            {unreadCounts?.[tab.id] > 0 && (
              <View style={customStyles.unreadBadge}>
                <Text style={customStyles.unreadText}>{unreadCounts[tab.id]}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const TikTokList = ({ conversations, stories, navigateToConversation }) => (
  <ScrollView style={customStyles.tabContent}>
    <Text style={customStyles.sectionTitle}>Messages sociaux</Text>
    {conversations.map(conv => (
      <TouchableOpacity 
        key={conv.id} 
        style={customStyles.conversationItem}
        onPress={() => navigateToConversation(conv.id)}
      >
        <View style={customStyles.avatar}>
          <Ionicons name="person-circle" size={40} color="#666" />
        </View>
        <View style={customStyles.conversationInfo}>
          <Text style={customStyles.conversationName}>{conv.name || 'Utilisateur'}</Text>
          <Text style={customStyles.lastMessage} numberOfLines={1}>
            {conv.lastMessage || 'Aucun message'}
          </Text>
        </View>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const BusinessList = ({ conversations, navigateToConversation, onStartNewChat }) => (
  <ScrollView style={customStyles.tabContent}>
    <Text style={customStyles.sectionTitle}>Messages professionnels</Text>
    
    <TouchableOpacity 
      style={customStyles.newChatButton}
      onPress={onStartNewChat}
    >
      <Ionicons name="add-circle" size={24} color="#007AFF" />
      <Text style={customStyles.newChatText}>Nouvelle conversation</Text>
    </TouchableOpacity>
    
    {conversations.map(conv => (
      <TouchableOpacity 
        key={conv.id} 
        style={customStyles.conversationItem}
        onPress={() => navigateToConversation(conv.id)}
      >
        <View style={[customStyles.avatar, { backgroundColor: '#1c1c1e' }]}>
          <Ionicons name="business" size={40} color="#666" />
        </View>
        <View style={customStyles.conversationInfo}>
          <Text style={customStyles.conversationName}>{conv.name || 'Entreprise'}</Text>
          <Text style={customStyles.lastMessage} numberOfLines={1}>
            {conv.lastMessage || 'Démarrez la conversation'}
          </Text>
        </View>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const ShoppingList = ({ conversations, navigateToConversation }) => (
  <ScrollView style={customStyles.tabContent}>
    <Text style={customStyles.sectionTitle}>Messages shopping</Text>
    {conversations.map(conv => (
      <TouchableOpacity 
        key={conv.id} 
        style={customStyles.conversationItem}
        onPress={() => navigateToConversation(conv.id)}
      >
        <View style={[customStyles.avatar, { backgroundColor: '#1c1c1e' }]}>
          <Ionicons name="cart" size={40} color="#666" />
        </View>
        <View style={customStyles.conversationInfo}>
          <Text style={customStyles.conversationName}>{conv.name || 'Commande'}</Text>
          <Text style={customStyles.lastMessage} numberOfLines={1}>
            {conv.lastMessage || 'Détails de la commande'}
          </Text>
        </View>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

export default function MessagesScreen() {
  const { user } = useAuth();
  const {
    selectedTab,
    searchQuery,
    isSearchVisible,
    conversations,
    unreadCounts,
    loading,
    setSearchQuery,
    setIsSearchVisible,
    handleTabChange,
    handleConversationPress,
    handleStartBusinessChat,
    refreshConversations
  } = useHybridMessaging();

  const [isInitializing, setIsInitializing] = useState(false);

  const handleInitializeData = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsInitializing(true);
      await initializeConversations();
      await refreshConversations();
      Alert.alert('Succès', 'Données initialisées !');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'initialiser');
    } finally {
      setIsInitializing(false);
    }
  }, [user, refreshConversations]);

  // Rendu du contenu
  const renderContent = () => {
    if (loading || isInitializing) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>
            {isInitializing ? 'Initialisation...' : 'Chargement...'}
          </Text>
        </View>
      );
    }

    switch (selectedTab) {
      case 'social':
        return (
          <TikTokList
            conversations={conversations}
            stories={[]}
            navigateToConversation={(id) => {
              const conv = conversations.find(c => c.id === id);
              if (conv) handleConversationPress(conv);
            }}
          />
        );
      
      case 'business':
        return (
          <BusinessList
            conversations={conversations}
            navigateToConversation={(id) => {
              const conv = conversations.find(c => c.id === id);
              if (conv) handleConversationPress(conv);
            }}
            onStartNewChat={() => {
              Alert.alert(
                'Nouvelle conversation',
                'Choisissez une entreprise',
                [
                  { text: 'Annuler', style: 'cancel' },
                  {
                    text: 'Assma Express',
                    onPress: () => handleStartBusinessChat('company_assma', 'Assma Express')
                  },
                  {
                    text: 'TechStore',
                    onPress: () => handleStartBusinessChat('company_tech', 'TechStore Maroc')
                  }
                ]
              );
            }}
          />
        );
      
      case 'shopping':
        return (
          <ShoppingList
            conversations={conversations}
            navigateToConversation={(id) => {
              const conv = conversations.find(c => c.id === id);
              if (conv) handleConversationPress(conv);
            }}
          />
        );
      
      default:
        return (
          <View style={styles.centerContainer}>
            <Text style={styles.errorText}>Onglet inconnu: {selectedTab}</Text>
          </View>
        );
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          statusBarStyle: 'light',
          statusBarTranslucent: true,
        }}
      />
      
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#000000"
          translucent={Platform.OS === 'android'}
        />
        
        <HybridHeader
          activeTab={selectedTab}
          onTabChange={handleTabChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isSearchVisible={isSearchVisible}
          onSearchVisibilityChange={setIsSearchVisible}
          unreadCounts={unreadCounts}
        />
        
        {/* Bouton debug (en dev seulement) */}
        {__DEV__ && conversations.length === 0 && (
          <TouchableOpacity 
            style={styles.debugButton}
            onPress={handleInitializeData}
          >
            <Ionicons name="rocket" size={16} color="#FFFFFF" />
            <Text style={styles.debugText}>Init Data</Text>
          </TouchableOpacity>
        )}
        
        <View style={styles.content}>
          {renderContent()}
          
          {/* État vide */}
          {!loading && !isInitializing && conversations.length === 0 && (
            <View style={styles.emptyContainer}>
              <Ionicons 
                name={selectedTab === 'business' ? 'business' : 
                       selectedTab === 'shopping' ? 'cart' : 'chatbubbles'} 
                size={64} 
                color="#666" 
              />
              <Text style={styles.emptyTitle}>
                {selectedTab === 'social' && 'Aucune conversation sociale'}
                {selectedTab === 'business' && 'Aucune conversation professionnelle'}
                {selectedTab === 'shopping' && 'Aucune commande en cours'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {selectedTab === 'business' 
                  ? 'Démarrez une conversation avec une entreprise'
                  : selectedTab === 'shopping'
                  ? 'Vos commandes apparaîtront ici'
                  : 'Ajoutez des amis pour chatter'}
              </Text>
              
              {selectedTab === 'business' && (
                <TouchableOpacity 
                  style={styles.startChatButton}
                  onPress={() => handleStartBusinessChat('company_assma', 'Assma Express')}
                >
                  <Text style={styles.startChatButtonText}>Démarrer une conversation</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </>
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
    marginTop: 12,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#000000',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  startChatButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  startChatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
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

const customStyles = StyleSheet.create({
  header: {
    backgroundColor: '#1c1c1e',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2c2c2e',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabLabel: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabLabel: {
    color: '#007AFF',
  },
  unreadBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
    backgroundColor: '#000000',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 12,
  },
  newChatText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1e',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2c2c2e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lastMessage: {
    color: '#666',
    fontSize: 14,
  },
});
