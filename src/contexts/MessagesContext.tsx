// src/contexts/MessagesContext.tsx - VERSION MISE À JOUR
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import messagesService, { Conversation, Message } from '../services/messagesService';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  getDocs,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Définition des types
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
  | 'subscription'
  | 'business'; // AJOUTÉ

// Types pour Business
export interface BusinessData {
  companyId: string;
  status: 'online' | 'away' | 'offline' | 'busy';
  verified: boolean;
  category: string;
  responseTime: string;
}

export interface ShoppingData {
  orderId?: string;
  orderStatus?: string;
  totalAmount?: string;
  itemsCount?: number;
  estimatedDelivery?: string;
  trackingNumber?: string;
}

// Étendre l'interface Conversation
interface ExtendedConversation extends Omit<Conversation, 'type'> {
  type: ConversationType;
  businessData?: BusinessData;
  shoppingData?: ShoppingData;
}

// Types pour le contexte
interface MessagesContextType {
  // États principaux
  conversations: ExtendedConversation[];
  conversationsByTab: {
    social: ExtendedConversation[];
    business: ExtendedConversation[];
    shopping: ExtendedConversation[];
  };
  currentConversation: ExtendedConversation | null;
  messages: Message[];
  loading: boolean;
  
  // Compteurs
  unreadCount: number;
  unreadCounts: {
    social: number;
    business: number;
    shopping: number;
  };
  
  // Actions de base
  sendMessage: (conversationId: string, text: string, type?: Message['type']) => Promise<void>;
  createDirectConversation: (otherUserId: string, otherUserName: string, otherUserAvatar?: string) => Promise<string>;
  markAsRead: (conversationId: string) => void;
  setCurrentConversation: (conversation: ExtendedConversation | null) => void;
  createDemoConversations: () => Promise<void>;
  
  // Actions Business/Shopping (NOUVELLES)
  startBusinessConversation: (companyId: string, companyName: string, initialMessage?: string) => Promise<string>;
  createOrderConversation: (orderData: {
    orderId: string;
    companyId: string;
    companyName: string;
    totalAmount: string;
    items: string[];
    estimatedDelivery?: string;
  }) => Promise<string>;
  
  // Gestion des onglets
  getConversationsByType: (type: 'social' | 'business' | 'shopping') => ExtendedConversation[];
  refreshConversations: () => Promise<void>;
  
  // Statistiques
  getBusinessStats: () => {
    total: number;
    unread: number;
    online: number;
  };
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export const MessagesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ExtendedConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ExtendedConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [demoCreated, setDemoCreated] = useState(false);
  
  // Convertir une Conversation en ExtendedConversation
  const convertToExtendedConversation = (conv: Conversation): ExtendedConversation => {
    return {
      ...conv,
      type: conv.type as ConversationType
    };
  };

  // Classer les conversations par onglet
  const conversationsByTab = {
    social: conversations.filter(conv => 
      conv.type === 'direct' || conv.type === 'group' || conv.type === 'channel'
    ),
    business: conversations.filter(conv => 
      conv.type === 'business' || conv.type === 'support' || conv.type === 'seller' || conv.type === 'premium'
    ),
    shopping: conversations.filter(conv => 
      conv.type === 'order' || conv.type === 'promo' || conv.type === 'return' || conv.type === 'subscription' || conv.type === 'delivery'
    )
  };

  // Calculer les messages non lus
  const unreadCount = conversations.reduce((total, conv) => {
    return total + (conv.unreadCount?.[user?.uid || ''] || 0);
  }, 0);

  const unreadCounts = {
    social: conversationsByTab.social.reduce((total, conv) => 
      total + (conv.unreadCount?.[user?.uid || ''] || 0), 0
    ),
    business: conversationsByTab.business.reduce((total, conv) => 
      total + (conv.unreadCount?.[user?.uid || ''] || 0), 0
    ),
    shopping: conversationsByTab.shopping.reduce((total, conv) => 
      total + (conv.unreadCount?.[user?.uid || ''] || 0), 0
    )
  };

  // ==================== FONCTIONS BUSINESS ====================

  // Démarrer une conversation business
  const startBusinessConversation = useCallback(async (
    companyId: string, 
    companyName: string, 
    initialMessage?: string
  ): Promise<string> => {
    if (!user) {
      throw new Error('Utilisateur non connecté');
    }

    console.log('🏢 Démarrage conversation business avec:', companyName);

    try {
      // Vérifier si une conversation existe déjà
      const existingQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.uid),
        where('type', 'in', ['business', 'support']),
        where('businessData.companyId', '==', companyId)
      );

      const existingSnapshot = await getDocs(existingQuery);
      
      if (!existingSnapshot.empty) {
        const existingId = existingSnapshot.docs[0].id;
        console.log('✅ Conversation existante trouvée:', existingId);
        return existingId;
      }

      // Créer une nouvelle conversation
      const conversationData = {
        title: `Support ${companyName}`,
        type: 'business' as const,
        participants: [user.uid, companyId],
        participantNames: {
          [user.uid]: user.displayName || user.email || 'Client',
          [companyId]: companyName
        },
        participantAvatars: {
          [user.uid]: user.photoURL || '👤',
          [companyId]: '🏢'
        },
        lastMessage: initialMessage || 'Nouvelle conversation',
        lastMessageTime: serverTimestamp(),
        unreadCount: {
          [user.uid]: 0,
          [companyId]: 0
        },
        businessData: {
          companyId,
          status: 'online',
          verified: true,
          category: 'Support',
          responseTime: '2-5 min'
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const conversationRef = await addDoc(collection(db, 'conversations'), conversationData);
      console.log('✅ Nouvelle conversation créée:', conversationRef.id);

      // Envoyer un message initial si fourni
      if (initialMessage) {
        await addDoc(collection(db, 'conversations', conversationRef.id, 'messages'), {
          text: initialMessage,
          senderId: user.uid,
          senderName: user.displayName || user.email || 'Client',
          senderAvatar: user.photoURL || '👤',
          timestamp: serverTimestamp(),
          type: 'text',
          readBy: [user.uid]
        });
      }

      // Réponse automatique simulée
      setTimeout(async () => {
        try {
          await addDoc(collection(db, 'conversations', conversationRef.id, 'messages'), {
            text: `Bonjour ! 👋 Bienvenue sur le support de ${companyName}. \nUn conseiller vous répondra dans les plus brefs délais.`,
            senderId: companyId,
            senderName: companyName,
            senderAvatar: '🏢',
            timestamp: serverTimestamp(),
            type: 'text',
            readBy: [companyId]
          });

          // Mettre à jour le dernier message
          await updateDoc(doc(db, 'conversations', conversationRef.id), {
            lastMessage: `Bonjour ! Bienvenue sur le support de ${companyName}.`,
            lastMessageTime: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          console.error('Erreur réponse automatique:', error);
        }
      }, 2000);

      return conversationRef.id;

    } catch (error) {
      console.error('❌ Erreur démarrage conversation business:', error);
      throw error;
    }
  }, [user]);

  // Créer une conversation pour une commande
  const createOrderConversation = useCallback(async (orderData: {
    orderId: string;
    companyId: string;
    companyName: string;
    totalAmount: string;
    items: string[];
    estimatedDelivery?: string;
  }): Promise<string> => {
    if (!user) {
      throw new Error('Utilisateur non connecté');
    }

    console.log('🛒 Création conversation pour commande:', orderData.orderId);

    try {
      const conversationData = {
        title: `Commande #${orderData.orderId}`,
        type: 'order' as const,
        participants: [user.uid, orderData.companyId],
        participantNames: {
          [user.uid]: user.displayName || user.email || 'Client',
          [orderData.companyId]: orderData.companyName
        },
        participantAvatars: {
          [user.uid]: user.photoURL || '👤',
          [orderData.companyId]: '🏢'
        },
        lastMessage: `Commande #${orderData.orderId} créée`,
        lastMessageTime: serverTimestamp(),
        unreadCount: {
          [user.uid]: 1,
          [orderData.companyId]: 0
        },
        shoppingData: {
          orderId: orderData.orderId,
          orderStatus: 'pending',
          totalAmount: orderData.totalAmount,
          itemsCount: orderData.items.length,
          estimatedDelivery: orderData.estimatedDelivery
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const conversationRef = await addDoc(collection(db, 'conversations'), conversationData);

      // Message système de confirmation
      await addDoc(collection(db, 'conversations', conversationRef.id, 'messages'), {
        text: `✅ Commande #${orderData.orderId} confirmée\n💰 Montant: ${orderData.totalAmount}\n📦 Articles: ${orderData.items.length} items\n🚚 ${orderData.estimatedDelivery ? `Livraison estimée: ${orderData.estimatedDelivery}` : 'Livraison à confirmer'}`,
        senderId: 'system',
        senderName: 'Système',
        senderAvatar: '🤖',
        timestamp: serverTimestamp(),
        type: 'order',
        metadata: {
          orderId: orderData.orderId,
          amount: orderData.totalAmount,
          items: orderData.items,
          status: 'confirmed'
        },
        readBy: []
      });

      console.log('✅ Conversation commande créée:', conversationRef.id);
      return conversationRef.id;

    } catch (error) {
      console.error('❌ Erreur création conversation commande:', error);
      throw error;
    }
  }, [user]);

  // ==================== FONCTIONS EXISTANTES ====================

  // Écouter les conversations
  useEffect(() => {
    if (!user) {
      console.log('🚫 Aucun utilisateur connecté');
      setConversations([]);
      setLoading(false);
      return;
    }

    console.log('🔍 Chargement conversations pour user:', user.uid);
    setLoading(true);
    
    try {
      const unsubscribe = messagesService.listenToUserConversations(
        user.uid,
        (conversationsData) => {
          console.log('📦 Conversations reçues:', conversationsData.length);
          
          const extendedConversations: ExtendedConversation[] = conversationsData.map(convertToExtendedConversation);
          setConversations(extendedConversations);
          setLoading(false);
          
          // Créer des démos si aucune conversation
          if (conversationsData.length === 0 && !demoCreated) {
            console.log('🏗️ Création conversations de démo...');
            setTimeout(() => {
              messagesService.createDemoConversations(user.uid);
              setDemoCreated(true);
            }, 2000);
          }
        }
      );

      return unsubscribe;
    } catch (error: any) {
      console.error('❌ Erreur chargement conversations:', error);
      setLoading(false);
      setConversations([]);
    }
  }, [user, demoCreated]);

  // Écouter les messages
  useEffect(() => {
    if (!currentConversation || !user) {
      setMessages([]);
      return;
    }

    console.log('📖 Écoute messages pour:', currentConversation.id);
    
    try {
      const unsubscribe = messagesService.listenToConversationMessages(
        currentConversation.id,
        (messagesData) => {
          setMessages(messagesData);
        }
      );

      return unsubscribe;
    } catch (error: any) {
      console.error('❌ Erreur chargement messages:', error);
    }
  }, [currentConversation, user]);

  // Envoyer un message
  const sendMessage = async (conversationId: string, text: string, type: Message['type'] = 'text') => {
    if (!user || !text.trim()) {
      console.log('❌ Envoi annulé');
      return;
    }

    try {
      await messagesService.sendMessage(conversationId, {
        text: text.trim(),
        senderId: user.uid,
        senderName: user.displayName || user.email || 'Utilisateur',
        senderAvatar: user.photoURL || '',
        type
      });
    } catch (error: any) {
      console.error('❌ Erreur envoi message:', error);
      throw error;
    }
  };

  // Créer conversation directe
  const createDirectConversation = async (
    otherUserId: string, 
    otherUserName: string, 
    otherUserAvatar?: string
  ): Promise<string> => {
    if (!user) {
      throw new Error('Utilisateur non connecté');
    }

    try {
      const conversationId = await messagesService.getOrCreateDirectConversation(
        user.uid,
        otherUserId,
        user.displayName || user.email || 'Utilisateur',
        otherUserName,
        user.photoURL || '',
        otherUserAvatar
      );
      return conversationId;
    } catch (error: any) {
      console.error('❌ Erreur création conversation:', error);
      throw error;
    }
  };

  // Marquer comme lu
  const markAsRead = async (conversationId: string) => {
    if (!user) return;

    try {
      await messagesService.markMessagesAsRead(conversationId, user.uid);
    } catch (error: any) {
      console.error('❌ Erreur marquage comme lu:', error);
    }
  };

  // Créer démos
  const createDemoConversations = async () => {
    if (!user) return;
    
    try {
      await messagesService.createDemoConversations(user.uid);
      setDemoCreated(true);
    } catch (error: any) {
      console.error('❌ Erreur création démos:', error);
    }
  };

  // Obtenir les conversations par type
  const getConversationsByType = (type: 'social' | 'business' | 'shopping') => {
    return conversationsByTab[type];
  };

  // Rafraîchir
  const refreshConversations = async () => {
    // Cette fonction force le rechargement
    // L'écoute en temps réel s'occupe déjà des mises à jour
    console.log('🔄 Rafraîchissement conversations');
  };

  // Statistiques Business
  const getBusinessStats = () => {
    const businessConvs = conversationsByTab.business;
    return {
      total: businessConvs.length,
      unread: businessConvs.filter(conv => conv.unreadCount?.[user?.uid || ''] > 0).length,
      online: businessConvs.filter(conv => conv.businessData?.status === 'online').length
    };
  };

  // Valeur du contexte
  const value: MessagesContextType = {
    // États
    conversations,
    conversationsByTab,
    currentConversation,
    messages,
    loading,
    
    // Compteurs
    unreadCount,
    unreadCounts,
    
    // Actions de base
    sendMessage,
    createDirectConversation,
    markAsRead,
    setCurrentConversation,
    createDemoConversations,
    
    // Actions Business/Shopping
    startBusinessConversation,
    createOrderConversation,
    
    // Gestion des onglets
    getConversationsByType,
    refreshConversations,
    
    // Statistiques
    getBusinessStats
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