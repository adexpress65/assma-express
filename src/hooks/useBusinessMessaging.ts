// src/hooks/useBusinessMessaging.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import messagingService from '../services/firebase/messagingService';
import { Conversation, Message, BusinessMessage, SupportTicket } from '../services/firebase/messagingService';
import { useAuth } from './useAuth';
import { Company } from '../types/company';

interface UseBusinessMessagingReturn {
  // État
  businessConversations: Conversation[];
  selectedConversation: Conversation | null;
  messages: BusinessMessage[];
  isLoading: boolean;
  isSending: boolean;
  companies: Company[];
  
  // Actions
  loadBusinessConversations: () => Promise<void>;
  selectConversation: (conversation: Conversation | null) => void;
  sendMessage: (text: string, type?: BusinessMessage['type'], metadata?: any) => Promise<void>;
  startNewConversation: (companyId: string, initialMessage?: string) => Promise<string>;
  createSupportTicket: (ticketData: any) => Promise<string>;
  updateOrderStatus: (status: string, metadata?: any) => Promise<void>;
  markAsRead: () => Promise<void>;
  exportHistory: () => Promise<any>;
  
  // UI
  searchMessages: (term: string) => Promise<BusinessMessage[]>;
  getBusinessStats: () => Promise<any>;
}

export const useBusinessMessaging = (): UseBusinessMessagingReturn => {
  const { user } = useAuth();
  const [businessConversations, setBusinessConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<BusinessMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const messagesUnsubscribeRef = useRef<(() => void) | null>(null);

  // Charger les conversations business
  const loadBusinessConversations = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      setIsLoading(true);
      
      // Charger les entreprises disponibles
      const availableCompanies = await messagingService.getAvailableCompanies();
      setCompanies(availableCompanies);
      
      // Écouter les conversations
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      
      unsubscribeRef.current = messagingService.listenToBusinessConversations(
        user.uid,
        (conversations) => {
          setBusinessConversations(conversations);
          setIsLoading(false);
        },
        {
          unreadOnly: false
        }
      );
    } catch (error) {
      console.error('Erreur chargement conversations:', error);
      Alert.alert('Erreur', 'Impossible de charger les conversations');
      setIsLoading(false);
    }
  }, [user?.uid]);

  // Sélectionner une conversation
  const selectConversation = useCallback(async (conversation: Conversation | null) => {
    if (messagesUnsubscribeRef.current) {
      messagesUnsubscribeRef.current();
      messagesUnsubscribeRef.current = null;
    }
    
    setSelectedConversation(conversation);
    setMessages([]);
    
    if (!conversation || !user?.uid) return;
    
    // Marquer comme lu
    await messagingService.markMessagesAsRead(conversation.id, user.uid);
    
    // Écouter les messages
    messagesUnsubscribeRef.current = messagingService.listenToConversationMessages(
      conversation.id,
      (newMessages) => {
        setMessages(newMessages as BusinessMessage[]);
      }
    );
  }, [user?.uid]);

  // Envoyer un message
  const sendMessage = useCallback(async (
    text: string, 
    type: BusinessMessage['type'] = 'text',
    metadata?: any
  ) => {
    if (!selectedConversation || !user?.uid || !text.trim()) return;
    
    try {
      setIsSending(true);
      
      await messagingService.sendBusinessMessage(selectedConversation.id, {
        text,
        type,
        metadata
      });
      
      // Mettre à jour le dernier message localement
      setSelectedConversation(prev => prev ? {
        ...prev,
        lastMessage: text,
        lastMessageTime: new Date()
      } : null);
      
    } catch (error) {
      console.error('Erreur envoi message:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
    } finally {
      setIsSending(false);
    }
  }, [selectedConversation, user?.uid]);

  // Démarrer une nouvelle conversation
  const startNewConversation = useCallback(async (
    companyId: string, 
    initialMessage?: string
  ): Promise<string> => {
    if (!user?.uid) throw new Error('Utilisateur non connecté');
    
    try {
      const conversationId = await messagingService.startBusinessConversation(
        user.uid,
        companyId,
        initialMessage
      );
      
      // Recharger les conversations
      await loadBusinessConversations();
      
      return conversationId;
    } catch (error) {
      console.error('Erreur démarrage conversation:', error);
      throw error;
    }
  }, [user?.uid, loadBusinessConversations]);

  // Créer un ticket de support
  const createSupportTicket = useCallback(async (ticketData: any) => {
    if (!selectedConversation) throw new Error('Aucune conversation sélectionnée');
    
    try {
      const ticketId = await messagingService.createSupportTicket(
        selectedConversation.id,
        ticketData
      );
      
      Alert.alert('Succès', 'Ticket de support créé avec succès');
      return ticketId;
    } catch (error) {
      console.error('Erreur création ticket:', error);
      throw error;
    }
  }, [selectedConversation]);

  // Mettre à jour le statut d'une commande
  const updateOrderStatus = useCallback(async (status: string, metadata?: any) => {
    if (!selectedConversation?.shoppingData?.orderId) {
      throw new Error('Aucune commande dans cette conversation');
    }
    
    try {
      await messagingService.updateOrderStatus(
        selectedConversation.id,
        selectedConversation.shoppingData.orderId!,
        status,
        metadata
      );
      
      Alert.alert('Succès', 'Statut de commande mis à jour');
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      throw error;
    }
  }, [selectedConversation]);

  // Marquer comme lu
  const markAsRead = useCallback(async () => {
    if (!selectedConversation || !user?.uid) return;
    
    try {
      await messagingService.markMessagesAsRead(selectedConversation.id, user.uid);
    } catch (error) {
      console.error('Erreur marquage lu:', error);
    }
  }, [selectedConversation, user?.uid]);

  // Exporter l'historique
  const exportHistory = useCallback(async () => {
    if (!selectedConversation) throw new Error('Aucune conversation sélectionnée');
    
    try {
      const history = await messagingService.exportConversationHistory(selectedConversation.id);
      
      // Ici vous pourriez partager ou sauvegarder l'historique
      Alert.alert('Export réussi', 'L\'historique a été exporté');
      
      return history;
    } catch (error) {
      console.error('Erreur export:', error);
      throw error;
    }
  }, [selectedConversation]);

  // Rechercher dans les messages
  const searchMessages = useCallback(async (term: string) => {
    if (!selectedConversation || !term.trim()) return [];
    
    try {
      return await messagingService.searchBusinessMessages(selectedConversation.id, term);
    } catch (error) {
      console.error('Erreur recherche:', error);
      return [];
    }
  }, [selectedConversation]);

  // Obtenir les statistiques
  const getBusinessStats = useCallback(async () => {
    if (!selectedConversation?.businessData?.companyId) {
      throw new Error('Aucune entreprise dans cette conversation');
    }
    
    try {
      return await messagingService.getBusinessStats(
        selectedConversation.businessData.companyId
      );
    } catch (error) {
      console.error('Erreur statistiques:', error);
      throw error;
    }
  }, [selectedConversation]);

  // Nettoyage
  useEffect(() => {
    if (user?.uid) {
      loadBusinessConversations();
    }
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (messagesUnsubscribeRef.current) {
        messagesUnsubscribeRef.current();
      }
    };
  }, [user?.uid, loadBusinessConversations]);

  return {
    // État
    businessConversations,
    selectedConversation,
    messages,
    isLoading,
    isSending,
    companies,
    
    // Actions
    loadBusinessConversations,
    selectConversation,
    sendMessage,
    startNewConversation,
    createSupportTicket,
    updateOrderStatus,
    markAsRead,
    exportHistory,
    
    // UI
    searchMessages,
    getBusinessStats
  };
};