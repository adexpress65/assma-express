// src/hooks/useHybridMessaging.ts
import { useState, useCallback, useMemo } from 'react';
import { useMessages, ExtendedConversation } from '../contexts/MessagesContext';

export type TabType = 'social' | 'business' | 'shopping';

export const useHybridMessaging = () => {
  const {
    conversationsByTab,
    unreadCounts,
    loading,
    startBusinessConversation,
    createOrderConversation,
    sendMessage,
    markAsRead,
    refreshConversations
  } = useMessages();

  const [selectedTab, setSelectedTab] = useState<TabType>('social');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

  // Filtrer les conversations par recherche
  const filteredConversations = useMemo(() => {
    const conversations = conversationsByTab[selectedTab];
    
    if (!searchQuery.trim()) {
      return conversations;
    }

    const query = searchQuery.toLowerCase();
    return conversations.filter(conv =>
      conv.title.toLowerCase().includes(query) ||
      conv.lastMessage?.toLowerCase().includes(query) ||
      conv.businessData?.category.toLowerCase().includes(query) ||
      conv.shoppingData?.orderId?.toLowerCase().includes(query)
    );
  }, [conversationsByTab, selectedTab, searchQuery]);

  // Gérer le changement d'onglet
  const handleTabChange = useCallback((tab: TabType) => {
    setSelectedTab(tab);
    setSearchQuery('');
    setIsSearchVisible(false);
  }, []);

  // Gérer le clic sur une conversation
  const handleConversationPress = useCallback((conversation: ExtendedConversation) => {
    // Navigation vers l'écran de chat
    // Vous utiliserez votre système de navigation ici
    console.log('Ouvrir conversation:', conversation.id);
    
    // Marquer comme lu
    markAsRead(conversation.id);
  }, [markAsRead]);

  // Démarrer une nouvelle conversation business
  const handleStartBusinessChat = useCallback(async (companyId: string, companyName: string) => {
    try {
      const conversationId = await startBusinessConversation(
        companyId,
        companyName,
        'Bonjour, je souhaite des informations.'
      );
      
      // Naviguer vers la conversation
      console.log('Nouvelle conversation créée:', conversationId);
      return conversationId;
    } catch (error) {
      console.error('Erreur démarrage conversation:', error);
      throw error;
    }
  }, [startBusinessConversation]);

  // Créer une conversation pour une commande
  const handleCreateOrderChat = useCallback(async (orderData: any) => {
    try {
      const conversationId = await createOrderConversation(orderData);
      console.log('Conversation commande créée:', conversationId);
      return conversationId;
    } catch (error) {
      console.error('Erreur création conversation commande:', error);
      throw error;
    }
  }, [createOrderConversation]);

  return {
    // États
    selectedTab,
    searchQuery,
    isSearchVisible,
    conversations: filteredConversations,
    conversationsByTab,
    unreadCounts,
    loading,
    
    // Setters
    setSelectedTab,
    setSearchQuery,
    setIsSearchVisible,
    
    // Actions
    handleTabChange,
    handleConversationPress,
    handleStartBusinessChat,
    handleCreateOrderChat,
    sendMessage,
    refreshConversations,
    
    // Utilitaires
    hasConversations: filteredConversations.length > 0,
    getConversationById: (id: string) => 
      conversationsByTab[selectedTab].find(c => c.id === id)
  };
};