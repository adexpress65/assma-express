// src/hooks/useConversations.ts - VERSION FINALE
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  addDoc,
  doc,
  getDoc
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { initializeConversations, testFirebaseConnection } from '../config/initFirebaseData';

// Types
export type TabType = 'social' | 'business' | 'shopping';

export interface Story {
  id: string;
  name: string;
  avatar: string;
  hasNewStories: boolean;
  seen: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  type: 'direct' | 'group' | 'business' | 'order' | 'support' | 'channel' | 'live';
  participants: string[];
  participantNames: { [key: string]: string };
  participantAvatars: { [key: string]: string };
  lastMessage?: string;
  lastMessageTime?: any;
  unreadCount?: { [key: string]: number };
  createdAt: any;
  updatedAt: any;
  businessData?: {
    companyId: string;
    companyName?: string;
    status: 'online' | 'offline' | 'away';
    verified: boolean;
    category: string;
    responseTime: string;
    avatar?: string;
    rating?: number;
    chatEnabled?: boolean;
  };
  shoppingData?: {
    orderId?: string;
    orderStatus?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    totalAmount?: string;
    itemsCount?: number;
    estimatedDelivery?: string;
    productName?: string;
    productImage?: string;
    trackingNumber?: string;
  };
  socialData?: {
    isLive?: boolean;
    liveViewers?: number;
    lastPostTime?: any;
    isChannel?: boolean;
    channelType?: 'public' | 'private';
    hashtags?: string[];
    isOnline?: boolean;
    lastSeen?: any;
  };
}

export interface UnreadCounts {
  social: number;
  business: number;
  shopping: number;
}

// Stories pour l'onglet Social (TikTok-like)
const INITIAL_STORIES: Story[] = [
  { id: '1', name: 'Tech Trends', avatar: '💻', hasNewStories: true, seen: false },
  { id: '2', name: 'Gaming', avatar: '🎮', hasNewStories: true, seen: false },
  { id: '3', name: 'Fashion', avatar: '👗', hasNewStories: true, seen: false },
  { id: '4', name: 'Food', avatar: '🍔', hasNewStories: true, seen: false },
  { id: '5', name: 'Travel', avatar: '✈️', hasNewStories: true, seen: false },
  { id: '6', name: 'Music', avatar: '🎵', hasNewStories: true, seen: false },
  { id: '7', name: 'Fitness', avatar: '💪', hasNewStories: true, seen: false },
  { id: '8', name: 'Assma', avatar: '✨', hasNewStories: true, seen: false }
];

export const useConversations = () => {
  const navigation = useNavigation();
  
  // États
  const [conversations, setConversations] = useState<{
    social: Conversation[];
    business: Conversation[];
    shopping: Conversation[];
  }>({
    social: [],
    business: [],
    shopping: []
  });
  
  const [stories, setStories] = useState<Story[]>(INITIAL_STORIES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  
  // Navigation states
  const [selectedTab, setSelectedTab] = useState<TabType>('social');
  
  // Références
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Écouter les changements d'authentification
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (user) {
        loadConversations();
      } else {
        setConversations({ social: [], business: [], shopping: [] });
        setIsLoading(false);
      }
    });
    
    return unsubscribe;
  }, []);

  // Classer les conversations par type
  const classifyConversation = (conversation: Conversation): TabType => {
    switch (conversation.type) {
      case 'business':
      case 'support':
        return 'business';
      case 'order':
        return 'shopping';
      default: // direct, group, channel, live
        return 'social';
    }
  };

  // Formater les données Firestore
  const formatConversation = (docId: string, data: any): Conversation => {
    const defaultUnreadCount = currentUser ? { [currentUser.uid]: 0 } : {};
    
    return {
      id: docId,
      title: data.title || 'Sans titre',
      type: data.type || 'direct',
      participants: data.participants || [],
      participantNames: data.participantNames || {},
      participantAvatars: data.participantAvatars || {},
      lastMessage: data.lastMessage || '',
      lastMessageTime: data.lastMessageTime || data.updatedAt,
      unreadCount: data.unreadCount || defaultUnreadCount,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt || data.createdAt,
      businessData: data.businessData,
      shoppingData: data.shoppingData,
      socialData: data.socialData
    };
  };

  // Charger les conversations en temps réel
  const loadConversations = useCallback(async () => {
    if (!currentUser?.uid) {
      console.log('⚠️ Utilisateur non connecté');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('👤 Chargement conversations pour:', currentUser.uid);
      console.log('📡 Connexion Firebase établie');

      // Tester la connexion
      const totalConvs = await testFirebaseConnection();
      console.log('📊 Conversations existantes dans Firestore:', totalConvs);

      // Si aucune conversation, initialiser
      if (totalConvs === 0) {
        console.log('🔄 Initialisation des données...');
        await initializeConversations();
      }

      // Écouter les conversations en temps réel
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', currentUser.uid),
        orderBy('updatedAt', 'desc')
      );

      // Nettoyer l'ancien listener
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }

      // Configurer l'écoute en temps réel
      unsubscribeRef.current = onSnapshot(q, 
        (snapshot) => { // Succès
          console.log('📱 Mise à jour en temps réel:', snapshot.size, 'conversations');
          
          const socialConvs: Conversation[] = [];
          const businessConvs: Conversation[] = [];
          const shoppingConvs: Conversation[] = [];
          
          snapshot.forEach((doc) => {
            try {
              const formattedConv = formatConversation(doc.id, doc.data());
              const tabType = classifyConversation(formattedConv);
              
              switch (tabType) {
                case 'social':
                  socialConvs.push(formattedConv);
                  break;
                case 'business':
                  businessConvs.push(formattedConv);
                  break;
                case 'shopping':
                  shoppingConvs.push(formattedConv);
                  break;
              }
            } catch (error) {
              console.error('❌ Erreur format conversation:', error);
            }
          });

          // Mettre à jour l'état
          setConversations({
            social: socialConvs,
            business: businessConvs,
            shopping: shoppingConvs
          });

          console.log('📊 Statistiques mises à jour:');
          console.log('  Social:', socialConvs.length);
          console.log('  Business:', businessConvs.length);
          console.log('  Shopping:', shoppingConvs.length);
          
          setIsLoading(false);
        },
        (error) => { // Erreur
          console.error('❌ Erreur écoute Firestore:', error);
          setError('Connexion interrompue. Vérifiez votre connexion internet.');
          setIsLoading(false);
        }
      );

    } catch (error) {
      console.error('❌ Erreur chargement conversations:', error);
      setError('Impossible de charger les conversations');
      setIsLoading(false);
    }
  }, [currentUser?.uid]);

  // Initialisation
  useEffect(() => {
    if (currentUser) {
      loadConversations();
    }
    
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [loadConversations, currentUser]);

  // Rafraîchir quand l'écran est focus
  useFocusEffect(
    useCallback(() => {
      if (currentUser) {
        loadConversations();
      }
    }, [loadConversations, currentUser])
  );

  // Calculer les messages non lus
  const getUnreadCount = useCallback((tab: TabType): number => {
    if (!currentUser?.uid) return 0;
    
    return conversations[tab].reduce((count, conv) => {
      return count + (conv.unreadCount?.[currentUser.uid] || 0);
    }, 0);
  }, [conversations, currentUser?.uid]);

  const unreadCounts: UnreadCounts = {
    social: getUnreadCount('social'),
    business: getUnreadCount('business'),
    shopping: getUnreadCount('shopping')
  };

  // Marquer comme lu
  const markAsRead = useCallback((tab: TabType, conversationId: string) => {
    if (!currentUser?.uid) return;
    
    console.log(`📌 Marquer comme lu: ${conversationId}`);
    
    setConversations(prev => ({
      ...prev,
      [tab]: prev[tab].map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            unreadCount: {
              ...conv.unreadCount,
              [currentUser.uid]: 0
            }
          };
        }
        return conv;
      })
    }));
  }, [currentUser?.uid]);

  // Navigation vers une conversation
  const handleConversationPress = useCallback((tab: TabType, conversationId: string) => {
    const conversation = conversations[tab].find(c => c.id === conversationId);
    
    if (!conversation) {
      Alert.alert('Erreur', 'Conversation non trouvée');
      return;
    }
    
    // Marquer comme lu
    markAsRead(tab, conversationId);
    
    // Naviguer selon le type
    let screenName = '';
    let params: any = { conversationId };
    
    switch (tab) {
      case 'business':
        screenName = 'BusinessChat';
        params.conversationTitle = conversation.title;
        break;
      case 'shopping':
        screenName = 'ShoppingChat';
        params.conversationTitle = conversation.title;
        break;
      case 'social':
        screenName = conversation.type === 'live' ? 'LiveChat' : 'SocialChat';
        params.conversationTitle = conversation.title;
        params.isLive = conversation.socialData?.isLive;
        break;
    }
    
    if (screenName) {
      navigation.navigate(screenName as never, params as never);
    }
  }, [conversations, navigation, markAsRead]);

  // Changer d'onglet
  const handleTabPress = useCallback((tab: TabType) => {
    console.log(`🔀 Onglet: ${tab}`);
    setSelectedTab(tab);
  }, []);

  // Rechercher
  const searchConversations = useCallback((query: string, tab: TabType) => {
    if (!query.trim()) return conversations[tab];
    
    const searchTerm = query.toLowerCase();
    return conversations[tab].filter(conv =>
      conv.title.toLowerCase().includes(searchTerm) ||
      conv.lastMessage?.toLowerCase().includes(searchTerm) ||
      conv.businessData?.companyName?.toLowerCase().includes(searchTerm) ||
      conv.shoppingData?.productName?.toLowerCase().includes(searchTerm)
    );
  }, [conversations]);

  // Ajouter une conversation test
  const addTestConversation = useCallback(async (tab: TabType) => {
    if (!currentUser?.uid) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return;
    }
    
    try {
      const conversationsRef = collection(db, 'conversations');
      const now = new Date();
      
      let testData: any = {
        title: '',
        type: '',
        participants: [currentUser.uid],
        participantNames: { [currentUser.uid]: 'Vous' },
        participantAvatars: { [currentUser.uid]: '👤' },
        lastMessage: 'Message de test',
        lastMessageTime: now,
        unreadCount: { [currentUser.uid]: 1 },
        createdAt: now,
        updatedAt: now,
      };
      
      switch (tab) {
        case 'social':
          testData = {
            ...testData,
            title: 'Groupe Test Social',
            type: 'group',
            participants: [...testData.participants, 'test_user_1', 'test_user_2'],
            participantNames: {
              ...testData.participantNames,
              'test_user_1': 'Test User 1',
              'test_user_2': 'Test User 2'
            },
            participantAvatars: {
              ...testData.participantAvatars,
              'test_user_1': '😀',
              'test_user_2': '😎'
            },
            lastMessage: 'Bienvenue dans le groupe test! 🎉',
            socialData: {
              isLive: Math.random() > 0.5,
              isChannel: true,
              channelType: 'public'
            }
          };
          break;
          
        case 'business':
          testData = {
            ...testData,
            title: 'Entreprise Test',
            type: 'business',
            participants: [...testData.participants, 'test_company'],
            participantNames: {
              ...testData.participantNames,
              'test_company': 'Entreprise Test'
            },
            participantAvatars: {
              ...testData.participantAvatars,
              'test_company': '🏢'
            },
            lastMessage: 'Bonjour, comment pouvons-nous vous aider?',
            businessData: {
              companyId: 'test_company',
              companyName: 'Entreprise Test',
              status: 'online',
              verified: true,
              category: 'Test',
              responseTime: '5 min',
              rating: 4.5,
              chatEnabled: true
            }
          };
          break;
          
        case 'shopping':
          testData = {
            ...testData,
            title: 'Commande Test #TEST123',
            type: 'order',
            participants: [...testData.participants, 'test_store'],
            participantNames: {
              ...testData.participantNames,
              'test_store': 'Boutique Test'
            },
            participantAvatars: {
              ...testData.participantAvatars,
              'test_store': '🛍️'
            },
            lastMessage: 'Votre commande test est en préparation',
            shoppingData: {
              orderId: `TEST-${Date.now()}`,
              orderStatus: 'processing',
              totalAmount: '299 DH',
              itemsCount: 1,
              estimatedDelivery: 'Demain',
              productName: 'Produit Test',
              productImage: '📦'
            }
          };
          break;
      }
      
      const docRef = await addDoc(conversationsRef, testData);
      
      Alert.alert('✅', 'Conversation test créée !', [
        { 
          text: 'OK', 
          onPress: () => {
            // Recharger les conversations
            loadConversations();
          }
        }
      ]);
      
    } catch (error) {
      console.error('❌ Erreur création test:', error);
      Alert.alert('❌', 'Erreur lors de la création');
    }
  }, [currentUser?.uid, loadConversations]);

  // Marquer une story comme vue
  const markStoryAsSeen = useCallback((storyId: string) => {
    setStories(prev =>
      prev.map(story =>
        story.id === storyId 
          ? { ...story, seen: true, hasNewStories: false } 
          : story
      )
    );
  }, []);

  return {
    // États
    conversations,
    stories,
    isLoading,
    error,
    selectedTab,
    unreadCounts,
    currentUser,
    
    // Actions
    refresh: loadConversations,
    setSelectedTab,
    handleTabPress,
    handleConversationPress,
    markAsRead,
    markStoryAsSeen,
    searchConversations,
    addTestConversation,
    loadConversations,
    
    // Utilitaires
    getUnreadCount,
    getConversationsByTab: (tab: TabType) => conversations[tab],
    hasData: () => 
      conversations.social.length > 0 || 
      conversations.business.length > 0 || 
      conversations.shopping.length > 0
  };
};

export default useConversations;
