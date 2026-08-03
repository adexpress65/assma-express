import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, 
  query, where, orderBy, limit, startAfter, onSnapshot, writeBatch, 
  serverTimestamp, Timestamp, setDoc, DocumentData, QueryDocumentSnapshot 
} from 'firebase/firestore';
import { Alert } from 'react-native';
import { db } from '../config/firebase'; // Ajustez selon votre chemin d'import firebase

// ================================
// 🔥 TYPES & INTERFACES (À adapter si besoin)
// ================================
export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date | Timestamp;
  createdAt: Date | Timestamp;
  readBy: string[];
  deliveredTo?: string[];
  type?: 'text' | 'image' | 'file' | 'product_payment' | string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  replyTo?: string;
  deleted?: boolean;
  product?: any;
  payment?: any;
  [key: string]: any;
}

export interface Conversation {
  id: string;
  title: string;
  participants: string[];
  participantNames?: Record<string, string>;
  participantAvatars?: Record<string, string>;
  admins?: string[];
  lastMessage?: string;
  lastMessageTime?: Date | Timestamp;
  updatedAt: Date | Timestamp;
  unreadCount?: Record<string, number>;
  archived?: Record<string, boolean>;
  pinned?: Record<string, boolean>;
  muted?: Record<string, boolean>;
  messageCount?: number;
  [key: string]: any;
}

interface MessagesContextType {
  getConversationName: (conv: Conversation) => string;
  conversations: Conversation[];
  loading: boolean;
  hasMoreConversations: boolean;
  loadingMoreConversations: boolean;
  onlineUsers: Record<string, boolean>;
  typingUsers: Record<string, Record<string, boolean>>;
  selectedConversation: Conversation | null;
  unreadCount: number;
  
  createConversation: (participantIds: string[], title?: string, companyFirestoreId?: string, extraData?: any) => Promise<string>;
  deleteConversation: (conversationId: string) => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  leaveConversation: (conversationId: string) => Promise<void>;
  pinConversation: (conversationId: string) => Promise<void>;
  archiveConversation: (conversationId: string) => Promise<void>;
  muteConversation: (conversationId: string) => Promise<void>;
  updateConversation: (conversationId: string, data: any) => Promise<void>;
  
  sendMessage: (conversationId: string, text: string, options?: any) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  clearAllMessagesInConversation: (conversationId: string) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  markAsDelivered: (conversationId: string, messageId: string) => Promise<void>;
  startTyping: (conversationId: string) => Promise<void>;
  stopTyping: (conversationId: string) => Promise<void>;
  
  searchMessages: (conversationId: string, query: string) => Promise<Message[]>;
  searchConversations: (query: string) => Promise<Conversation[]>;
  
  clearAll: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  setSelectedConversation: (conv: Conversation | null) => void;
  getConversationStats: (conversationId: string) => Promise<any>;
}

const MessagesContext = createContext<MessagesContextType | undefined>(undefined);

export const MessagesProvider: React.FC<{ children: ReactNode; user: { uid: string; displayName?: string } | null }> = ({ children, user }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, Record<string, boolean>>>({});
  const [hasMoreConversations, setHasMoreConversations] = useState<boolean>(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState<boolean>(false);

  const lastVisibleDoc = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const typingTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // ================================
  // 🔄 ÉCOUTEURS TEMPS RÉEL (CONVERSATIONS)
  // ================================
  useEffect(() => {
    if (!user?.uid) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      lastVisibleDoc.current = snapshot.docs[snapshot.docs.length - 1] || null;
      setHasMoreConversations(snapshot.docs.length === 20);

      const list: Conversation[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as Conversation));

      setConversations(list);
      setLoading(false);
    }, (error) => {
      console.error('❌ Erreur écoute conversations:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // ================================
  // 🛠️ FONCTIONS UTILITAIRES & GESTION CONVERSATIONS
  // ================================
  const getConversationName = (conv: Conversation): string => {
    if (conv.title) return conv.title;
    const otherId = conv.participants?.find(id => id !== user?.uid);
    return (otherId && conv.participantNames?.[otherId]) || 'Conversation';
  };

  const ensureEntrepreneurHasUser = async (companyFirestoreId: string): Promise<string> => {
    return companyFirestoreId; 
  };

  const createConversation = async (
    participantIds: string[], 
    title?: string, 
    companyFirestoreId?: string, 
    extraData?: any
  ): Promise<string> => {
    if (!user?.uid) throw new Error('Utilisateur non connecté');

    let finalParticipants = [...participantIds];
    if (companyFirestoreId) {
      const realUserId = await ensureEntrepreneurHasUser(companyFirestoreId);
      finalParticipants = finalParticipants.map(id => (id === companyFirestoreId || id === finalParticipants[0]) ? realUserId : id);
      if (!finalParticipants.includes(realUserId)) finalParticipants.push(realUserId);
    }

    const uniqueParticipants = Array.from(new Set([user.uid, ...finalParticipants]));

    const newConvRef = await addDoc(collection(db, 'conversations'), {
      title: title || 'Discussion',
      participants: uniqueParticipants,
      admins: [user.uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      messageCount: 0,
      ...extraData
    });

    return newConvRef.id;
  };

  const deleteConversation = async (conversationId: string): Promise<void> => {
    await deleteDoc(doc(db, 'conversations', conversationId));
  };

  const loadMoreConversations = async (): Promise<void> => {
    if (!user?.uid || !lastVisibleDoc.current || loadingMoreConversations) return;
    setLoadingMoreConversations(true);
    try {
      const q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', user.uid),
        orderBy('updatedAt', 'desc'),
        startAfter(lastVisibleDoc.current),
        limit(15)
      );
      const snapshot = await getDocs(q);
      lastVisibleDoc.current = snapshot.docs[snapshot.docs.length - 1] || null;
      setHasMoreConversations(snapshot.docs.length === 15);

      const moreList: Conversation[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
      setConversations(prev => [...prev, ...moreList]);
    } catch (error) {
      console.error('❌ Erreur pagination conversations:', error);
    } finally {
      setLoadingMoreConversations(false);
    }
  };

  const leaveConversation = async (conversationId: string): Promise<void> => {
    if (!user?.uid) return;
    const convRef = doc(db, 'conversations', conversationId);
    const snap = await getDoc(convRef);
    if (!snap.exists()) return;
    const participants = (snap.data().participants || []).filter((id: string) => id !== user.uid);
    await updateDoc(convRef, { participants });
  };

  const pinConversation = async (conversationId: string): Promise<void> => {
    if (!user?.uid) return;
    const conv = conversations.find(c => c.id === conversationId);
    const isPinned = !conv?.pinned?.[user.uid];
    await updateDoc(doc(db, 'conversations', conversationId), { [`pinned.${user.uid}`]: isPinned });
  };

  const archiveConversation = async (conversationId: string): Promise<void> => {
    if (!user?.uid) return;
    const conv = conversations.find(c => c.id === conversationId);
    const isArchived = !conv?.archived?.[user.uid];
    await updateDoc(doc(db, 'conversations', conversationId), { [`archived.${user.uid}`]: isArchived });
  };

  const muteConversation = async (conversationId: string): Promise<void> => {
    if (!user?.uid) return;
    const conv = conversations.find(c => c.id === conversationId);
    const isMuted = !conv?.muted?.[user.uid];
    await updateDoc(doc(db, 'conversations', conversationId), { [`muted.${user.uid}`]: isMuted });
  };

  const updateConversation = async (conversationId: string, data: any): Promise<void> => {
    await updateDoc(doc(db, 'conversations', conversationId), data);
  };

  const clearAllMessagesInConversation = async (conversationId: string): Promise<void> => {
    // Logique de nettoyage des messages si implémentée
  };

  // ================================
  // 🔥 GESTION DES MESSAGES
  // ================================
  const sendMessage = async (conversationId: string, text: string, options: any = {}): Promise<void> => {
    if (!user || !user.uid) {
      throw new Error('Utilisateur non connecté');
    }

    try {
      const type = options.type || 'text';
      const safeText = text.trim() || (type === 'product_payment' ? `Paiement: ${options.product?.name || 'Produit'}` : '');
      
      const messageData = {
        text: safeText,
        senderId: user.uid,
        senderName: user.displayName || 'Vous',
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        readBy: [user.uid],
        type,
        ...options
      };

      await addDoc(collection(db, 'conversations', conversationId, 'messages'), messageData);

      const { increment, arrayUnion } = await import('firebase/firestore');
      const convRef = doc(db, 'conversations', conversationId);

      const updateData: Record<string, any> = {
        id: conversationId,
        lastMessage: safeText,
        lastMessageType: type,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        [`unreadCount.${user.uid}`]: 0,
        messageCount: increment(1),
        participants: arrayUnion(user.uid),
      };

      const conversation = conversations.find(c => c.id === conversationId);
      if (conversation?.participants) {
        conversation.participants
          .filter(p => p !== user.uid)
          .forEach(id => { updateData[`unreadCount.${id}`] = increment(1); });
      }

      // UTILISATION DE setDoc AVEC MERGE AU LIEU DE updateDoc POUR ÉVITER L'ERREUR DE DOCUMENT MANQUANT
      await setDoc(convRef, updateData, { merge: true });
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      throw error;
    }
  };

  const deleteMessage = async (conversationId: string, messageId: string): Promise<void> => {
    if (!user?.uid) throw new Error('Utilisateur non connecté');
    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    const messageDoc = await getDoc(messageRef);
    
    if (!messageDoc.exists()) throw new Error('Message non trouvé');
    const message = messageDoc.data();

    if (message.senderId !== user.uid && !conversations.find(c => c.id === conversationId)?.admins?.includes(user.uid)) {
      throw new Error('Vous ne pouvez pas supprimer ce message');
    }

    await updateDoc(messageRef, { deleted: true, text: 'Message supprimé', imageUrl: null, fileUrl: null });
  };

  const markAsRead = async (conversationId: string): Promise<void> => {
    if (!user?.uid || !conversationId) return;
    try {
      const convRef = doc(db, 'conversations', conversationId);
      const convSnap = await getDoc(convRef);
      if (!convSnap.exists() || Number((convSnap.data().unreadCount as any)?.[user.uid] ?? 0) <= 0) return;

      await updateDoc(convRef, { [`unreadCount.${user.uid}`]: 0, updatedAt: serverTimestamp() });
      
      const snapshot = await getDocs(query(collection(db, 'conversations', conversationId, 'messages'), orderBy('timestamp', 'desc'), limit(50)));
      const batch = writeBatch(db);
      let updated = false;

      snapshot.docs.forEach(d => {
        const readBy = d.data().readBy || [];
        if (!readBy.includes(user.uid)) {
          batch.update(d.ref, { readBy: [...readBy, user.uid] });
          updated = true;
        }
      });
      if (updated) await batch.commit();
    } catch (error) {
      console.error('❌ Erreur marquer comme lu:', error);
    }
  };

  const markAsDelivered = async (conversationId: string, messageId: string): Promise<void> => {
    if (!user?.uid) return;
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const docSnap = await getDoc(messageRef);
      await updateDoc(messageRef, { deliveredTo: [...(docSnap.data()?.deliveredTo || []), user.uid] });
    } catch (error) {
      console.error('❌ Erreur marquer comme livré:', error);
    }
  };

  const startTyping = async (conversationId: string): Promise<void> => {
    if (!user?.uid || !conversationId) return;
    const typingRef = doc(db, 'conversations', conversationId, 'typing', user.uid);
    const conv = conversations.find(c => c.id === conversationId);
    
    await setDoc(typingRef, {
      uid: user.uid,
      name: conv?.participantNames?.[user.uid] || user.displayName || 'Vous',
      timestamp: serverTimestamp()
    });

    if (typingTimeouts.current[conversationId]) clearTimeout(typingTimeouts.current[conversationId]);
    typingTimeouts.current[conversationId] = setTimeout(() => stopTyping(conversationId), 3000);
  };

  const stopTyping = async (conversationId: string): Promise<void> => {
    if (!user?.uid) return;
    try { await deleteDoc(doc(db, 'conversations', conversationId, 'typing', user.uid)); } catch (e) {}
  };

  // ================================
  // 🔍 RECHERCHE & GESTION GLOBALE
  // ================================
  const searchMessages = async (conversationId: string, searchQuery: string): Promise<Message[]> => {
    try {
      const snapshot = await getDocs(query(collection(db, 'conversations', conversationId, 'messages'), orderBy('timestamp', 'desc'), limit(50)));
      const queryLower = searchQuery.toLowerCase();
      
      return snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(data => !data.deleted && data.text?.toLowerCase().includes(queryLower))
        .map(data => ({
          ...data,
          timestamp: typeof data.timestamp?.toDate === 'function' ? data.timestamp.toDate() : (data.timestamp instanceof Date ? data.timestamp : new Date())
        }));
    } catch (error) {
      return [];
    }
  };

  const searchConversations = async (query: string): Promise<Conversation[]> => {
    const term = query.toLowerCase();
    return conversations.filter(c => 
      c.title.toLowerCase().includes(term) ||
      Object.values(c.participantNames || {}).some(n => n.toLowerCase().includes(term)) ||
      c.lastMessage?.toLowerCase().includes(term)
    );
  };

  const clearAll = async (): Promise<void> => {
    if (!user?.uid) return;
    try {
      const batch = writeBatch(db);
      conversations.forEach(c => batch.update(doc(db, 'conversations', c.id), { [`archived.${user.uid}`]: true, updatedAt: serverTimestamp() }));
      await batch.commit();
      Alert.alert('Succès', 'Toutes les conversations ont été archivées');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de nettoyer les conversations');
    }
  };

  const refreshConversations = async (): Promise<void> => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  const getConversationStats = async (conversationId: string) => {
    const c = conversations.find(conv => conv.id === conversationId);
    if (!c) throw new Error('Conversation non trouvée');
    return {
      messageCount: c.messageCount || 0,
      participantCount: c.participants.length,
      lastActivity: c.updatedAt instanceof Date ? c.updatedAt : (c.updatedAt as Timestamp).toDate()
    };
  };

  const unreadCount = conversations.reduce((total, conv) => {
    return total + (conv.archived?.[user?.uid || ''] ? 0 : (conv.unreadCount?.[user?.uid || ''] || 0));
  }, 0);

  // ================================
  // 📦 VALEUR DU CONTEXTE & EXPORT
  // ================================
  const value: MessagesContextType = {
    getConversationName, conversations, loading, hasMoreConversations, loadingMoreConversations,
    onlineUsers, typingUsers, selectedConversation, unreadCount,
    createConversation, deleteConversation, loadMoreConversations, leaveConversation,
    pinConversation, archiveConversation, muteConversation, updateConversation,
    sendMessage, deleteMessage, clearAllMessagesInConversation, markAsRead, markAsDelivered,
    startTyping, stopTyping, searchMessages, searchConversations, clearAll, refreshConversations,
    setSelectedConversation, getConversationStats
  };

  return <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>;
};

export const useMessages = (): MessagesContextType => {
  const context = useContext(MessagesContext);
  if (!context) throw new Error('useMessages must be used within MessagesProvider');
  return context;
};