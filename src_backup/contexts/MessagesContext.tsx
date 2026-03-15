import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import messagesService, { Conversation, Message } from '../services/messagesService';

// Définition du type commun pour toutes les conversations
export type ConversationType = 
  | 'direct' 
  | 'group' 
  | 'order' 
  | 'channel' 
  | 'support' 
  | 'seller' 
  | 'premium' 
  | 'delivery' 
  | 'promo' 
  | 'return' 
  | 'subscription';

// Étendre l'interface Conversation pour utiliser le nouveau type
interface ExtendedConversation extends Omit<Conversation, 'type'> {
  type: ConversationType;
}

interface MessagesContextType {
  conversations: ExtendedConversation[];
  currentConversation: ExtendedConversation | null;
  messages: Message[];
  loading: boolean;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  createDirectConversation: (otherUserId: string, otherUserName: string, otherUserAvatar?: string) => Promise<string>;
  markAsRead: (conversationId: string) => void;
  setCurrentConversation: (conversation: ExtendedConversation | null) => void;
  unreadCount: number;
  createDemoConversations: () => Promise<void>;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export const MessagesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ExtendedConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ExtendedConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [demoCreated, setDemoCreated] = useState(false);

  // Fonction pour convertir une Conversation en ExtendedConversation
  const convertToExtendedConversation = (conv: Conversation): ExtendedConversation => {
    return {
      ...conv,
      type: conv.type as ConversationType // Conversion de type sécurisée
    };
  };

  // Écouter les conversations de l'utilisateur
  useEffect(() => {
    if (!user) {
      console.log('🚫 Aucun utilisateur connecté');
      setConversations([]);
      setLoading(false);
      return;
    }

    console.log('🔍 Début chargement conversations pour user:', user.uid);
    setLoading(true);
    
    try {
      const unsubscribe = messagesService.listenToUserConversations(
        user.uid,
        (conversationsData) => {
          console.log('📦 Conversations reçues:', conversationsData);
          console.log('📊 Nombre de conversations:', conversationsData.length);
          
          // Vérifie si tes conversations sont bien récupérées
          if (conversationsData.length > 0) {
            console.log('✅ Données de la première conversation:', conversationsData[0]);
            console.log('👥 Participants:', conversationsData[0].participants);
            console.log('🔍 Type de participants:', typeof conversationsData[0].participants);
          } else {
            console.log('❌ Aucune conversation trouvée pour cet utilisateur');
            console.log('🆔 UID utilisateur:', user.uid);
          }
          
          // Convertir les conversations en ExtendedConversation
          const extendedConversations: ExtendedConversation[] = conversationsData.map(convertToExtendedConversation);
          
          setConversations(extendedConversations);
          setLoading(false);
          
          // ✅ CRÉER DES DÉMOS SI AUCUNE CONVERSATION
          if (conversationsData.length === 0 && !demoCreated) {
            console.log('🏗️ Aucune conversation, création de démos...');
            setTimeout(() => {
              messagesService.createDemoConversations(user.uid);
              setDemoCreated(true);
            }, 2000);
          }
          
          // Calculer le total des messages non lus
          const totalUnread = conversationsData.reduce((total, conv) => {
            return total + (conv.unreadCount?.[user.uid] || 0);
          }, 0);
          setUnreadCount(totalUnread);
          
          console.log('✅ Chargement terminé - Conversations:', extendedConversations.length);
          console.log('📨 Messages non lus:', totalUnread);
        }
      );

      return unsubscribe;
    } catch (error: any) {
      console.error('❌ Erreur lors du chargement des conversations:', error);
      setLoading(false);
      setConversations([]);
    }
  }, [user, demoCreated]);

  // Écouter les messages de la conversation courante
  useEffect(() => {
    if (!currentConversation || !user) {
      setMessages([]);
      return;
    }

    console.log('📖 Écoute des messages pour la conversation:', currentConversation.id);
    
    try {
      const unsubscribe = messagesService.listenToConversationMessages(
        currentConversation.id,
        (messagesData) => {
          console.log('💬 Messages reçus:', messagesData.length);
          setMessages(messagesData);
        }
      );

      return unsubscribe;
    } catch (error: any) {
      console.error('❌ Erreur lors du chargement des messages:', error);
    }
  }, [currentConversation, user]);

  const sendMessage = async (conversationId: string, text: string) => {
    if (!user || !text.trim()) {
      console.log('❌ Envoi message annulé - utilisateur ou texte manquant');
      return;
    }

    console.log('📤 Envoi message:', { conversationId, text: text.trim() });

    try {
      await messagesService.sendMessage(conversationId, {
        text: text.trim(),
        senderId: user.uid,
        senderName: user.email || 'Utilisateur',
        senderAvatar: user.photoURL || '',
        type: 'text'
      });
      console.log('✅ Message envoyé avec succès');
    } catch (error: any) {
      console.error('❌ Erreur envoi message:', error);
      throw error;
    }
  };

  const createDirectConversation = async (
    otherUserId: string, 
    otherUserName: string, 
    otherUserAvatar?: string
  ): Promise<string> => {
    if (!user) {
      console.log('❌ Création conversation annulée - utilisateur non connecté');
      throw new Error('Utilisateur non connecté');
    }

    console.log('🆕 Création conversation directe avec:', otherUserName);

    try {
      const conversationId = await messagesService.getOrCreateDirectConversation(
        user.uid,
        otherUserId,
        user.email || 'Utilisateur',
        otherUserName,
        user.photoURL || '',
        otherUserAvatar
      );
      console.log('✅ Conversation créée avec ID:', conversationId);
      return conversationId;
    } catch (error: any) {
      console.error('❌ Erreur création conversation:', error);
      throw error;
    }
  };

  const markAsRead = async (conversationId: string) => {
    if (!user) {
      console.log('❌ Marquer comme lu annulé - utilisateur non connecté');
      return;
    }

    console.log('📖 Marquage comme lu pour la conversation:', conversationId);

    try {
      await messagesService.markMessagesAsRead(conversationId, user.uid);
      console.log('✅ Messages marqués comme lus');
    } catch (error: any) {
      console.error('❌ Erreur marquage comme lu:', error);
    }
  };

  const createDemoConversations = async () => {
    if (!user) {
      console.log('❌ Création démos annulée - utilisateur non connecté');
      return;
    }
    
    console.log('🎮 Début création conversations de démo');

    try {
      await messagesService.createDemoConversations(user.uid);
      setDemoCreated(true);
      console.log('✅ Conversations de démo créées avec succès');
    } catch (error: any) {
      console.error('❌ Erreur création démos:', error);
    }
  };

  const value: MessagesContextType = {
    conversations,
    currentConversation,
    messages,
    loading,
    sendMessage,
    createDirectConversation,
    markAsRead,
    setCurrentConversation,
    unreadCount,
    createDemoConversations
  };

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
};

export const useMessages = () => {
  const context = useContext(MessagesContext);
  if (context === undefined) {
    throw new Error('useMessages must be used within a MessagesProvider');
  }
  return context;
};
