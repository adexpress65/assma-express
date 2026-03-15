// src/contexts/MessagesContext.tsx - VERSION COMPLÈTE WHATSAPP-LIKE
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
  Timestamp,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  limit
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ================================
// TYPES
// ================================
export type ConversationType = 
  | 'support' | 'order' | 'group' | 'seller' | 'premium' 
  | 'delivery' | 'channel' | 'direct' | 'promo' | 'return' | 'subscription';

export interface Conversation {
  id: string;
  title: string;
  type: ConversationType;
  lastMessage?: string;
  lastMessageTime?: Timestamp | Date;
  participants: string[];
  participantAvatars?: Record<string, string>;
  participantNames?: Record<string, string>;
  unreadCount?: Record<string, number>;
  mute?: Record<string, boolean>;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy: string;
  admins?: string[];
  messageCount?: number;
  pinned?: Record<string, boolean>;
  archived?: Record<string, boolean>;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName?: string;
  timestamp: Timestamp | Date;
  readBy: string[];
  type: 'text' | 'image' | 'file' | 'voice' | 'location';
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  voiceDuration?: number;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  replyTo?: string;
  deleted?: boolean;
}

export interface TypingUser {
  uid: string;
  name: string;
  timestamp: Date;
}

interface OnlineUser {
  uid: string;
  lastSeen: Date;
  status: 'online' | 'offline' | 'away';
}

interface MessagesContextType {
  // État
  conversations: Conversation[];
  loading: boolean;
  onlineUsers: OnlineUser[];
  typingUsers: Record<string, TypingUser[]>;
  selectedConversation: Conversation | null;
  unreadCount: number;
  
  // Conversations
  createConversation: (data: Partial<Conversation>) => Promise<string>;
  deleteConversation: (conversationId: string) => Promise<void>;
  leaveConversation: (conversationId: string) => Promise<void>;
  pinConversation: (conversationId: string, pin: boolean) => Promise<void>;
  archiveConversation: (conversationId: string, archive: boolean) => Promise<void>;
  muteConversation: (conversationId: string, mute: boolean) => Promise<void>;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => Promise<void>;
  
  // Messages
  sendMessage: (conversationId: string, text: string, options?: {
    type?: Message['type'];
    imageUrl?: string;
    fileUrl?: string;
    fileName?: string;
    replyTo?: string;
  }) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  markAsDelivered: (conversationId: string, messageId: string) => Promise<void>;
  startTyping: (conversationId: string) => Promise<void>;
  stopTyping: (conversationId: string) => Promise<void>;
  
  // Recherche & Filtrage
  searchMessages: (conversationId: string, query: string) => Promise<Message[]>;
  searchConversations: (query: string) => Promise<Conversation[]>;
  
  // Gestion
  clearAll: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  setSelectedConversation: (conversation: Conversation | null) => void;
  
  // Statistiques
  getConversationStats: (conversationId: string) => Promise<{
    messageCount: number;
    participantCount: number;
    lastActivity: Date;
  }>;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

// ================================
// PROVIDER
// ================================
export const MessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  // État
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser[]>>({});
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  
  // Références
  const typingTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const unsubscribeRefs = useRef<{ conversations?: () => void; online?: () => void }>({});
  
  // ================================
// 🚀 SOLUTION ENTREPRENEURS - SIMPLE & IMMÉDIATE
// ================================
const ensureEntrepreneurHasUser = async (companyId: string): Promise<string> => {
  try {
    // 1️⃣ Récupérer les infos de l'entreprise
    const companyDoc = await getDoc(doc(db, 'companies', companyId));
    
    if (!companyDoc.exists()) {
      console.log('⚠️ Entreprise non trouvée:', companyId);
      return companyId; // Fallback
    }

    const company = companyDoc.data();
    const ownerId = company.uid;

    // 2️⃣ Si l'entreprise a déjà un propriétaire avec un UID, l'utiliser
    if (ownerId) {
      // Vérifier si cet utilisateur existe dans users
      const userDoc = await getDoc(doc(db, 'users', ownerId));
      
      if (!userDoc.exists()) {
        // ✅ CRÉER AUTOMATIQUEMENT LE COMPTE UTILISATEUR
        console.log('👤 Création automatique du compte entrepreneur pour:', company.name);
        
        await setDoc(doc(db, 'users', ownerId), {
          uid: ownerId,
          displayName: company.name || 'Entrepreneur',
          email: company.email || `contact-${companyId.slice(0,6)}@a2express.com`,
          photoURL: company.logo || company.coverImage || null,
          phone: company.phone || '',
          role: 'entrepreneur',
          companyId: companyId,
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp(),
          isActive: true
        });
        
        console.log('✅ Compte entrepreneur créé avec succès');
      }
      
      return ownerId;
    }

    // 3️⃣ Si pas d'ownerId, on utilise l'ID de l'entreprise comme UID
    console.log('🏢 Utilisation de l\'ID entreprise comme UID:', companyId);
    
    // Créer un compte avec l'ID de l'entreprise
    const userDoc = await getDoc(doc(db, 'users', companyId));
    
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', companyId), {
        uid: companyId,
        displayName: company.name || 'Entrepreneur',
        email: company.email || `company-${companyId.slice(0,6)}@a2express.com`,
        photoURL: company.logo || company.coverImage || null,
        phone: company.phone || '',
        role: 'entrepreneur',
        companyId: companyId,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        isActive: true
      });
    }
    
    return companyId;
    
  } catch (error) {
    console.error('❌ Erreur ensureEntrepreneurHasUser:', error);
    return companyId; // En cas d'erreur, on garde l'ID original
  }
};

  // ================================
  // 🔥 CHARGEMENT DES CONVERSATIONS
  // ================================
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    console.log('📡 Connexion à Firestore pour les conversations...');
    
    // Query: Toutes les conversations où l'utilisateur est participant
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs: Conversation[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        convs.push({
          id: doc.id,
          title: data.title || 'Sans titre',
          type: data.type || 'direct',
          lastMessage: data.lastMessage || '',
          lastMessageTime: data.lastMessageTime?.toDate() || new Date(),
          participants: data.participants || [],
          participantAvatars: data.participantAvatars || {},
          participantNames: data.participantNames || {},
          unreadCount: data.unreadCount || {},
          mute: data.mute || {},
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          createdBy: data.createdBy || '',
          admins: data.admins || [],
          messageCount: data.messageCount || 0,
          pinned: data.pinned || {},
          archived: data.archived || {},
        });
      });

      console.log(`✅ ${convs.length} conversations chargées`);
      setConversations(convs);
      setLoading(false);
    }, (error) => {
      console.error('❌ Erreur chargement conversations:', error);
      setLoading(false);
    });

    unsubscribeRefs.current.conversations = unsubscribe;

    return () => {
      if (unsubscribeRefs.current.conversations) {
        unsubscribeRefs.current.conversations();
      }
    };
  }, [user?.uid]);

  // ================================
  // 🔥 SURVEILLANCE DES UTILISATEURS EN LIGNE
  // ================================
  useEffect(() => {
    if (!user?.uid) return;

    const statusRef = collection(db, 'status');
    const q = query(statusRef, where('state', 'in', ['online', 'away']));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: OnlineUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        users.push({
          uid: data.uid,
          lastSeen: data.lastChanged?.toDate() || new Date(),
          status: data.state || 'offline'
        });
      });
      setOnlineUsers(users);
    });

    unsubscribeRefs.current.online = unsubscribe;

    return () => {
      if (unsubscribeRefs.current.online) {
        unsubscribeRefs.current.online();
      }
    };
  }, [user?.uid]);

  // ================================
  // 🔥 SURVEILLANCE DES TYPING
  // ================================
// --- VERSION CORRIGÉE ET OPTIMISÉE ---
useEffect(() => {
  if (!user?.uid || conversations.length === 0) return;

  // On stocke tous nos abonnements dans un objet
  const unsubscribes: Record<string, () => void> = {};

  conversations.forEach(conversation => {
    const typingRef = collection(db, 'conversations', conversation.id, 'typing');
    
    // On enregistre l'écouteur
    unsubscribes[conversation.id] = onSnapshot(typingRef, (snapshot) => {
      const typing: TypingUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.uid !== user.uid) {
          typing.push({
            uid: data.uid,
            name: conversation.participantNames?.[data.uid] || data.name || 'Quelqu\'un',
            timestamp: data.timestamp?.toDate() || new Date()
          });
        }
      });
      
      setTypingUsers(prev => ({
        ...prev,
        [conversation.id]: typing
      }));
    });
  });

  // FONCTION DE NETTOYAGE : Ferme tous les écouteurs d'un coup
  return () => {
    Object.values(unsubscribes).forEach(unsubscribe => unsubscribe());
  };
}, [conversations, user?.uid]);

  // ================================
  // 🔥 FONCTIONS DE CONVERSATION
  // ================================

  // CRÉER UNE CONVERSATION
// CRÉER UNE CONVERSATION - VERSION MODIFIÉE
const createConversation = async (data: Partial<Conversation>): Promise<string> => {
  if (!user?.uid) throw new Error('Utilisateur non connecté');

  try {
    // 🚀 SI C'EST UN ENTREPRENEUR, ON ADAPTE AUTOMATIQUEMENT
    let participantIds = [...(data.participants || [])];
    
    if (data.type === 'entrepreneur' || data.type === 'seller') {
      const companyId = participantIds[0]; // Le premier participant est l'entreprise
      
      if (companyId) {
        // ✅ ASSURER QUE L'ENTREPRENEUR A UN COMPTE UTILISATEUR
        const realUserId = await ensureEntrepreneurHasUser(companyId);
        
        // Remplacer l'ID entreprise par le vrai UID utilisateur
        participantIds = [realUserId];
        console.log('🔄 Conversation avec entrepreneur:', { companyId, realUserId });
      }
    }

    const conversationData: any = {
      title: data.title || (data.type === 'entrepreneur' ? 'Entrepreneur' : 'Nouvelle conversation'),
      type: data.type || 'direct',
      lastMessage: '',
      participants: [...new Set([user.uid, ...participantIds])],
      participantAvatars: {
        [user.uid]: user.photoURL || '👤',
        ...data.participantAvatars
      },
      participantNames: {
        [user.uid]: user.displayName || 'Vous',
        ...data.participantNames
      },
      unreadCount: {
        [user.uid]: 0
      },
      mute: {
        [user.uid]: false
      },
      pinned: {
        [user.uid]: false
      },
      archived: {
        [user.uid]: false
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
      admins: [user.uid],
      messageCount: 0
    };

    // Ajouter les infos de l'entreprise si c'est une conversation entrepreneur
    if (data.type === 'entrepreneur' && participantIds[0]) {
      try {
        const companyDoc = await getDoc(doc(db, 'companies', participantIds[0]));
        if (companyDoc.exists()) {
          const company = companyDoc.data();
          conversationData.companyId = participantIds[0];
          conversationData.companyName = company.name;
          conversationData.companyLogo = company.logo;
        }
      } catch (e) {
        console.log('⚠️ Impossible de charger les infos entreprise');
      }
    }

    const docRef = await addDoc(collection(db, 'conversations'), conversationData);
    console.log('✅ Conversation créée:', docRef.id);
    
    // 🚀 ENVOYER UN MESSAGE DE BIENVENUE AUTOMATIQUE
    if (data.type === 'entrepreneur') {
      setTimeout(async () => {
        try {
          await sendMessage(
            docRef.id,
            `👋 Bonjour ! Je suis intéressé par vos services.`,
            { type: 'text' }
          );
        } catch (e) {
          console.log('⚠️ Message de bienvenue non envoyé');
        }
      }, 500);
    }
    
    return docRef.id;
  } catch (error) {
    console.error('❌ Erreur création conversation:', error);
    throw error;
  }
};

  // SUPPRIMER UNE CONVERSATION
  const deleteConversation = async (conversationId: string): Promise<void> => {
    if (!user?.uid) throw new Error('Utilisateur non connecté');

    try {
      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) throw new Error('Conversation non trouvée');

      // Vérifier les permissions
      if (conversation.createdBy !== user.uid && !conversation.admins?.includes(user.uid)) {
        throw new Error('Vous n\'avez pas la permission de supprimer cette conversation');
      }

      // Supprimer tous les messages d'abord
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const messagesSnapshot = await getDocs(messagesRef);
      
      const batch = writeBatch(db);
      messagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Supprimer les données de typing
      const typingRef = collection(db, 'conversations', conversationId, 'typing');
      const typingSnapshot = await getDocs(typingRef);
      typingSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Supprimer la conversation
      batch.delete(doc(db, 'conversations', conversationId));
      
      await batch.commit();
      console.log('🗑️ Conversation supprimée');
      
      Alert.alert('Succès', 'Conversation supprimée');
    } catch (error) {
      console.error('❌ Erreur suppression conversation:', error);
      Alert.alert('Erreur', 'Impossible de supprimer la conversation');
      throw error;
    }
  };

  // QUITTER UNE CONVERSATION
  const leaveConversation = async (conversationId: string): Promise<void> => {
    if (!user?.uid) throw new Error('Utilisateur non connecté');

    try {
      const conversation = conversations.find(c => c.id === conversationId);
      if (!conversation) throw new Error('Conversation non trouvée');

      // Ne peut pas quitter si c'est le créateur (doit supprimer)
      if (conversation.createdBy === user.uid) {
        Alert.alert('Information', 'En tant que créateur, vous devez supprimer la conversation');
        return;
      }

      await updateDoc(doc(db, 'conversations', conversationId), {
        participants: conversation.participants.filter(p => p !== user.uid),
        [`participantAvatars.${user.uid}`]: null,
        [`participantNames.${user.uid}`]: null,
        [`unreadCount.${user.uid}`]: null,
        [`mute.${user.uid}`]: null,
        [`pinned.${user.uid}`]: null,
        [`archived.${user.uid}`]: null,
        updatedAt: serverTimestamp()
      });

      console.log('👋 Conversation quittée');
      Alert.alert('Succès', 'Vous avez quitté la conversation');
    } catch (error) {
      console.error('❌ Erreur quitter conversation:', error);
      Alert.alert('Erreur', 'Impossible de quitter la conversation');
      throw error;
    }
  };

  // ÉPINGLER/DÉSÉPINGLER
  const pinConversation = async (conversationId: string, pin: boolean): Promise<void> => {
    if (!user?.uid) return;

    try {
      await updateDoc(doc(db, 'conversations', conversationId), {
        [`pinned.${user.uid}`]: pin,
        updatedAt: serverTimestamp()
      });
      console.log(`📌 Conversation ${pin ? 'épinglée' : 'désépinglée'}`);
    } catch (error) {
      console.error('❌ Erreur épinglage:', error);
    }
  };

  // ARCHIVER/DÉSARCHIVER
  const archiveConversation = async (conversationId: string, archive: boolean): Promise<void> => {
    if (!user?.uid) return;

    try {
      await updateDoc(doc(db, 'conversations', conversationId), {
        [`archived.${user.uid}`]: archive,
        updatedAt: serverTimestamp()
      });
      console.log(`📁 Conversation ${archive ? 'archivée' : 'désarchivée'}`);
    } catch (error) {
      console.error('❌ Erreur archivage:', error);
    }
  };

  // MUTER/DÉMUTER
  const muteConversation = async (conversationId: string, mute: boolean): Promise<void> => {
    if (!user?.uid) return;

    try {
      await updateDoc(doc(db, 'conversations', conversationId), {
        [`mute.${user.uid}`]: mute,
        updatedAt: serverTimestamp()
      });
      console.log(`🔇 Conversation ${mute ? 'mutée' : 'démutée'}`);
    } catch (error) {
      console.error('❌ Erreur mute:', error);
    }
  };

  // METTRE À JOUR UNE CONVERSATION
  const updateConversation = async (conversationId: string, updates: Partial<Conversation>): Promise<void> => {
    try {
      const cleanUpdates: any = { ...updates };
      delete cleanUpdates.id;
      delete cleanUpdates.createdAt;
      delete cleanUpdates.updatedAt;
      
      cleanUpdates.updatedAt = serverTimestamp();
      
      await updateDoc(doc(db, 'conversations', conversationId), cleanUpdates);
      console.log('🔄 Conversation mise à jour');
    } catch (error) {
      console.error('❌ Erreur mise à jour conversation:', error);
      throw error;
    }
  };

  // ================================
  // 🔥 FONCTIONS DE MESSAGES
  // ================================

  // ENVOYER UN MESSAGE
  const sendMessage = async (
    conversationId: string, 
    text: string, 
    options: {
      type?: Message['type'];
      imageUrl?: string;
      fileUrl?: string;
      fileName?: string;
      replyTo?: string;
    } = {}
  ): Promise<void> => {
    if (!user?.uid) throw new Error('Utilisateur non connecté');

    try {
      const messageType = options.type || 'text';
      const messageData: any = {
        text,
        senderId: user.uid,
        senderName: user.displayName || 'Vous',
        timestamp: serverTimestamp(),
        readBy: [user.uid],
        type: messageType
      };

      // Ajouter les options
      if (options.imageUrl) messageData.imageUrl = options.imageUrl;
      if (options.fileUrl) {
        messageData.fileUrl = options.fileUrl;
        messageData.fileName = options.fileName;
      }
      if (options.replyTo) messageData.replyTo = options.replyTo;

      // 1. Ajouter le message
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(messagesRef, messageData);

      // 2. Mettre à jour la conversation
      const convRef = doc(db, 'conversations', conversationId);
      const updateData: any = {
        lastMessage: text,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        [`unreadCount.${user.uid}`]: 0,
        messageCount: await (async () => {
          const convDoc = await getDoc(convRef);
          return (convDoc.data()?.messageCount || 0) + 1;
        })()
      };

      await updateDoc(convRef, updateData);

      // 3. Envoyer des notifications aux autres participants
      const conversation = conversations.find(c => c.id === conversationId);
      if (conversation) {
        const otherParticipants = conversation.participants.filter(p => p !== user.uid);
        
        // Envoyer une notification push (si configuré)
        if (Platform.OS !== 'web') {
          otherParticipants.forEach(async (participantId) => {
            // Vérifier si la conversation est mutée pour cet utilisateur
            if (conversation.mute?.[participantId]) {
              return;
            }

            try {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: conversation.title,
                  body: `${user.displayName || 'Quelqu\'un'}: ${text.substring(0, 50)}`,
                  data: { 
                    conversationId,
                    type: 'new_message',
                    senderId: user.uid 
                  },
                  sound: true,
                  badge: 1,
                },
                trigger: null,
              });
            } catch (error) {
              console.log('⚠️ Notifications non configurées');
            }
          });
        }

        // Incrémenter le compteur non-lu pour les autres
        otherParticipants.forEach(async (participantId) => {
          await updateDoc(convRef, {
            [`unreadCount.${participantId}`]: (conversation.unreadCount?.[participantId] || 0) + 1
          });
        });
      }

      console.log('✅ Message envoyé');
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      throw error;
    }
  };

  // SUPPRIMER UN MESSAGE
  const deleteMessage = async (conversationId: string, messageId: string): Promise<void> => {
    if (!user?.uid) throw new Error('Utilisateur non connecté');

    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (!messageDoc.exists()) {
        throw new Error('Message non trouvé');
      }

      const message = messageDoc.data();
      
      // Vérifier les permissions
      if (message.senderId !== user.uid) {
        const conversation = conversations.find(c => c.id === conversationId);
        if (!conversation?.admins?.includes(user.uid)) {
          throw new Error('Vous ne pouvez pas supprimer ce message');
        }
      }

      // Marquer comme supprimé plutôt que supprimer définitivement
      await updateDoc(messageRef, {
        deleted: true,
        text: 'Message supprimé',
        imageUrl: null,
        fileUrl: null
      });

      console.log('🗑️ Message supprimé');
    } catch (error) {
      console.error('❌ Erreur suppression message:', error);
      throw error;
    }
  };

  // MARQUER COMME LU
  const markAsRead = async (conversationId: string): Promise<void> => {
    if (!user?.uid) return;

    try {
      const convRef = doc(db, 'conversations', conversationId);
      await updateDoc(convRef, {
        [`unreadCount.${user.uid}`]: 0,
        updatedAt: serverTimestamp()
      });
      
      // Marquer tous les messages comme lus
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(
        messagesRef,
        where('readBy', 'array-contains', user.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(docSnapshot => {
        if (!docSnapshot.data().readBy.includes(user.uid)) {
          batch.update(docSnapshot.ref, {
            readBy: [...docSnapshot.data().readBy, user.uid]
          });
        }
      });
      
      if (snapshot.docs.length > 0) {
        await batch.commit();
      }
      
      console.log('👀 Messages marqués comme lus');
    } catch (error) {
      console.error('❌ Erreur marquer comme lu:', error);
    }
  };

  // MARQUER COMME LIVRÉ
  const markAsDelivered = async (conversationId: string, messageId: string): Promise<void> => {
    if (!user?.uid) return;

    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      await updateDoc(messageRef, {
        deliveredTo: [...(await getDoc(messageRef)).data()?.deliveredTo || [], user.uid]
      });
    } catch (error) {
      console.error('❌ Erreur marquer comme livré:', error);
    }
  };

  // COMMENCER À ÉCRIRE
  const startTyping = async (conversationId: string): Promise<void> => {
    if (!user?.uid || !conversationId) return;

    try {
      const typingRef = doc(db, 'conversations', conversationId, 'typing', user.uid);
      const conversation = conversations.find(c => c.id === conversationId);
      
      await setDoc(typingRef, {
        uid: user.uid,
        name: conversation?.participantNames?.[user.uid] || user.displayName || 'Vous',
        timestamp: serverTimestamp()
      });

      // Nettoyer le timeout précédent
      if (typingTimeouts.current[conversationId]) {
        clearTimeout(typingTimeouts.current[conversationId]);
      }

      // Définir un timeout pour arrêter automatiquement
      typingTimeouts.current[conversationId] = setTimeout(async () => {
        await stopTyping(conversationId);
        delete typingTimeouts.current[conversationId];
      }, 3000);
    } catch (error) {
      console.error('❌ Erreur start typing:', error);
    }
  };

  // ARRÊTER D'ÉCRIRE
  const stopTyping = async (conversationId: string): Promise<void> => {
    if (!user?.uid) return;

    try {
      const typingRef = doc(db, 'conversations', conversationId, 'typing', user.uid);
      await deleteDoc(typingRef);
    } catch (error) {
      console.error('❌ Erreur stop typing:', error);
    }
  };

  // ================================
  // 🔥 RECHERCHE
  // ================================

  const searchMessages = async (conversationId: string, query: string): Promise<Message[]> => {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const snapshot = await getDocs(messagesRef);
      
      const messages: Message[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.text?.toLowerCase().includes(query.toLowerCase()) && !data.deleted) {
          messages.push({
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate() || new Date()
          } as Message);
        }
      });
      
      return messages;
    } catch (error) {
      console.error('❌ Erreur recherche messages:', error);
      return [];
    }
  };

  const searchConversations = async (query: string): Promise<Conversation[]> => {
    const searchTerm = query.toLowerCase();
    
    return conversations.filter(conversation => 
      conversation.title.toLowerCase().includes(searchTerm) ||
      Object.values(conversation.participantNames || {}).some(name => 
        name.toLowerCase().includes(searchTerm)
      ) ||
      conversation.lastMessage?.toLowerCase().includes(searchTerm)
    );
  };

  // ================================
  // 🔥 GESTION
  // ================================

  const clearAll = async (): Promise<void> => {
    if (!user?.uid) return;

    try {
      const batch = writeBatch(db);
      
      // Marquer toutes les conversations comme archivées
      conversations.forEach(conversation => {
        const convRef = doc(db, 'conversations', conversation.id);
        batch.update(convRef, {
          [`archived.${user.uid}`]: true,
          updatedAt: serverTimestamp()
        });
      });
      
      await batch.commit();
      Alert.alert('Succès', 'Toutes les conversations ont été archivées');
    } catch (error) {
      console.error('❌ Erreur clear all:', error);
      Alert.alert('Erreur', 'Impossible de nettoyer les conversations');
    }
  };

  const refreshConversations = async (): Promise<void> => {
    setLoading(true);
    // La mise à jour se fait automatiquement via onSnapshot
    setTimeout(() => setLoading(false), 1000);
  };

  // ================================
  // 🔥 STATISTIQUES
  // ================================

  const getConversationStats = async (conversationId: string): Promise<{
    messageCount: number;
    participantCount: number;
    lastActivity: Date;
  }> => {
    try {
      const conversation = conversations.find(c => c.id === conversationId);
      
      if (!conversation) {
        throw new Error('Conversation non trouvée');
      }

      // Compter les messages
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const snapshot = await getDocs(messagesRef);
      
      return {
        messageCount: snapshot.size,
        participantCount: conversation.participants.length,
        lastActivity: conversation.updatedAt instanceof Date 
          ? conversation.updatedAt 
          : (conversation.updatedAt as Timestamp).toDate()
      };
    } catch (error) {
      console.error('❌ Erreur statistiques:', error);
      return {
        messageCount: 0,
        participantCount: 0,
        lastActivity: new Date()
      };
    }
  };

  // ================================
  // 🔥 CALCUL DES MESSAGES NON LUS
  // ================================

  const unreadCount = conversations.reduce((total, conv) => {
    const userUnread = conv.unreadCount?.[user?.uid || ''] || 0;
    const isArchived = conv.archived?.[user?.uid || ''] || false;
    return total + (isArchived ? 0 : userUnread);
  }, 0);

  // ================================
  // VALEUR DU CONTEXTE
  // ================================

  const value: MessagesContextType = {
    // État
    conversations,
    loading,
    onlineUsers,
    typingUsers,
    selectedConversation,
    unreadCount,
    
    // Conversations
    createConversation,
    deleteConversation,
    leaveConversation,
    pinConversation,
    archiveConversation,
    muteConversation,
    updateConversation,
    
    // Messages
    sendMessage,
    deleteMessage,
    markAsRead,
    markAsDelivered,
    startTyping,
    stopTyping,
    
    // Recherche
    searchMessages,
    searchConversations,
    
    // Gestion
    clearAll,
    refreshConversations,
    setSelectedConversation: (conv) => setSelectedConversation(conv),
    
    // Statistiques
    getConversationStats
  };

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  );
};

// ================================
// HOOK
// ================================
export const useMessages = (): MessagesContextType => {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error('useMessages must be used within MessagesProvider');
  }
  return context;
};
