import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, 
  query, where, orderBy, limit, startAfter, onSnapshot, writeBatch, 
  serverTimestamp, Timestamp, setDoc, DocumentData, QueryDocumentSnapshot 
} from 'firebase/firestore';
import { Alert } from 'react-native';
import { db } from '../config/firebase'; // Ajustez selon votre chemin d'import firebase
import {
  bootstrapStoreConversation,
  bootstrapSupportConversation,
  canonicalStoreConversationId,
  MessagingRoutingError,
  repairMissingConversationKind,
  staffInboxVisible,
} from '../services/conversationRouting';

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

export interface CreateConversationOptions {
  participants?: string[] | string | null;
  title?: string;
  companyId?: string;
  [key: string]: any;
}

/**
 * Accepte aussi bien un tableau qu'une valeur simple ou un objet { uid | id },
 * car les écrans appelants n'envoient pas tous la même forme de données.
 */
const toParticipantIds = (value: unknown): string[] => {
  const rawList = Array.isArray(value) ? value : value == null ? [] : [value];
  return rawList
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      const asObject = entry as { uid?: unknown; id?: unknown } | null;
      const candidate = asObject?.uid ?? asObject?.id;
      return typeof candidate === 'string' ? candidate.trim() : '';
    })
    .filter((id) => id.length > 0);
};

function mapConversationDocs(
  docs: QueryDocumentSnapshot<DocumentData>[],
): Conversation[] {
  return docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  } as Conversation));
}

function conversationTimeMs(conv: Conversation): number {
  const value = conv.updatedAt || conv.lastMessageTime;
  if (!value) return 0;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as Timestamp).toMillis === 'function'
  ) {
    return (value as Timestamp).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function mergeConversationLists(lists: Conversation[][]): Conversation[] {
  const map = new Map<string, Conversation>();
  for (const list of lists) {
    for (const conv of list) map.set(conv.id, conv);
  }
  return [...map.values()].sort(
    (a, b) => conversationTimeMs(b) - conversationTimeMs(a),
  );
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
  
  createConversation: (
    participantsOrOptions: string[] | string | CreateConversationOptions,
    title?: string,
    companyFirestoreId?: string,
    extraData?: any
  ) => Promise<string>;
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

export const MessagesProvider: React.FC<{
  children: ReactNode;
  user: { uid: string; displayName?: string } | null;
  userRole?: string | null;
}> = ({ children, user, userRole = null }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, Record<string, boolean>>>({});
  const [hasMoreConversations, setHasMoreConversations] = useState<boolean>(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState<boolean>(false);

  const lastVisibleDoc = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const typingTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const participantConversations = useRef<Conversation[]>([]);
  const clientUidConversations = useRef<Conversation[]>([]);
  const sellerUidConversations = useRef<Conversation[]>([]);
  const supportConversations = useRef<Conversation[]>([]);
  const recoveredConversations = useRef<Conversation[]>([]);

  const publishConversations = () => {
    const merged = mergeConversationLists([
      participantConversations.current,
      clientUidConversations.current,
      sellerUidConversations.current,
      supportConversations.current,
      recoveredConversations.current,
    ]);
    if (userRole === 'super-admin' || userRole === 'admin') {
      const uid = user?.uid;
      setConversations(
        merged.filter((conv) => staffInboxVisible(conv, uid || '')),
      );
      return;
    }
    setConversations(merged);
  };

  // ================================
  // 🔄 ÉCOUTEURS TEMPS RÉEL (CONVERSATIONS)
  // ================================
  useEffect(() => {
    if (!user?.uid) {
      participantConversations.current = [];
      clientUidConversations.current = [];
      sellerUidConversations.current = [];
      supportConversations.current = [];
      recoveredConversations.current = [];
      setConversations([]);
      setLoading(false);
      return;
    }

    const uid = user.uid;
    setLoading(true);

    const participantsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', uid),
      orderBy('updatedAt', 'desc'),
      limit(20),
    );

    const unsubscribeParticipants = onSnapshot(
      participantsQuery,
      (snapshot) => {
        lastVisibleDoc.current = snapshot.docs[snapshot.docs.length - 1] || null;
        setHasMoreConversations(snapshot.docs.length === 20);
        const list = mapConversationDocs(snapshot.docs);
        participantConversations.current = list;
        publishConversations();
        setLoading(false);
      },
      (error) => {
        console.error('❌ Erreur écoute conversations:', error);
        setLoading(false);
      },
    );

    const unsubscribeClientUid = onSnapshot(
      query(
        collection(db, 'conversations'),
        where('clientUid', '==', uid),
        limit(40),
      ),
      (snapshot) => {
        const list = mapConversationDocs(snapshot.docs);
        clientUidConversations.current = list;
        publishConversations();
      },
      (error) => {
        console.warn('Écoute conversations clientUid:', error);
      },
    );

    const unsubscribeSellerUid = onSnapshot(
      query(
        collection(db, 'conversations'),
        where('sellerUid', '==', uid),
        limit(40),
      ),
      (snapshot) => {
        sellerUidConversations.current = mapConversationDocs(snapshot.docs);
        publishConversations();
      },
      (error) => {
        console.warn('Écoute conversations sellerUid:', error);
      },
    );

    const unsubscribeSupportKind = onSnapshot(
      query(
        collection(db, 'conversations'),
        where('conversationKind', '==', 'customer_to_support'),
        limit(40),
      ),
      (snapshot) => {
        if (userRole !== 'super-admin' && userRole !== 'admin') {
          supportConversations.current = [];
          return;
        }
        supportConversations.current = mapConversationDocs(snapshot.docs);
        publishConversations();
      },
      (error) => {
        console.warn('Écoute conversations support:', error);
      },
    );

    let cancelled = false;
    const recoverFromOrders = async () => {
      try {
        const ordersSnap = await getDocs(
          query(collection(db, 'orders'), where('userId', '==', uid), limit(40)),
        );
        const companyIds = new Set<string>();
        ordersSnap.forEach((orderDoc) => {
          const data = orderDoc.data() as Record<string, any>;
          const fromItem = data.items?.[0]?.companyId || data.items?.[0]?.sellerId;
          for (const candidate of [data.companyId, data.sellerId, fromItem]) {
            if (typeof candidate === 'string' && candidate.trim()) {
              companyIds.add(candidate.trim());
            }
          }
        });

        const recovered: Conversation[] = [];
        await Promise.all(
          [...companyIds].map(async (companyId) => {
            const convId = `${companyId}_${uid}`;
            const snap = await getDoc(doc(db, 'conversations', convId));
            if (!snap.exists()) return;
            const conv = { id: snap.id, ...snap.data() } as Conversation;
            recovered.push(conv);
          }),
        );
        if (cancelled) return;
        recoveredConversations.current = recovered;
        publishConversations();
      } catch (error) {
        console.warn('Récupération conversations via commandes:', error);
      }
    };

    void recoverFromOrders();

    return () => {
      cancelled = true;
      unsubscribeParticipants();
      unsubscribeClientUid();
      unsubscribeSellerUid();
      unsubscribeSupportKind();
    };
  }, [user?.uid, userRole]);

  // ================================
  // 🛠️ FONCTIONS UTILITAIRES & GESTION CONVERSATIONS
  // ================================
  const getConversationName = (conv: Conversation): string => {
    if (conv.title) return conv.title;
    const otherId = conv.participants?.find(id => id !== user?.uid);
    return (otherId && conv.participantNames?.[otherId]) || 'Conversation';
  };

  const createConversation = async (
    participantsOrOptions: string[] | string | CreateConversationOptions,
    title?: string,
    companyFirestoreId?: string,
    extraData?: any
  ): Promise<string> => {
    if (!user?.uid) throw new Error('Utilisateur non connecté');

    const isOptionsObject =
      !!participantsOrOptions &&
      typeof participantsOrOptions === 'object' &&
      !Array.isArray(participantsOrOptions);

    const {
      participants: optionParticipants,
      title: optionTitle,
      companyId: optionCompanyId,
      ...optionExtra
    } = (isOptionsObject ? participantsOrOptions : {}) as CreateConversationOptions;

    const companyId = optionCompanyId || companyFirestoreId;
    if (!companyId) {
      throw new MessagingRoutingError(
        'MISSING_COMPANY',
        'Toute conversation boutique doit passer par storeId. Aucun fallback support.',
      );
    }

    const conversationId = canonicalStoreConversationId(companyId, user.uid);
    await bootstrapStoreConversation({
      conversationId,
      companyId,
      viewerUid: user.uid,
      productSellerUid:
        typeof optionExtra.sellerUid === 'string' ? optionExtra.sellerUid : null,
      clientUid: user.uid,
      companyName: optionTitle || title,
      clientName: user.displayName || 'Client',
    });
    return conversationId;
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
      const requestedId = typeof options.messageId === 'string' ? options.messageId.trim() : '';
      const { messageId: _ignoredMessageId, ...messageOptions } = options;
      
      const messageData = {
        text: safeText,
        senderId: user.uid,
        senderName: user.displayName || 'Vous',
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        readBy: [user.uid],
        type,
        ...messageOptions
      };

      const { increment } = await import('firebase/firestore');
      const convRef = doc(db, 'conversations', conversationId);
      let convSnap = await getDoc(convRef);

      if (!convSnap.exists()) {
        if (conversationId.startsWith('support_')) {
          const supportClientUid = conversationId.slice('support_'.length);
          if (!supportClientUid || supportClientUid !== user.uid) {
            throw new MessagingRoutingError(
              'MISSING_CONVERSATION',
              'Fil support introuvable.',
            );
          }
          await bootstrapSupportConversation({
            clientUid: supportClientUid,
            clientName: user.displayName || 'Client',
          });
        } else {
          const cached = conversations.find((c) => c.id === conversationId);
          const optionCompany =
            typeof options.companyId === 'string' ? options.companyId.trim() : '';
          const suffixCompany =
            conversationId.endsWith(`_${user.uid}`)
              ? conversationId.slice(0, conversationId.length - user.uid.length - 1)
              : '';
          const companyId =
            optionCompany ||
            (typeof cached?.companyId === 'string' ? cached.companyId : '') ||
            suffixCompany;
          if (!companyId) {
            throw new MessagingRoutingError(
              'MISSING_CONVERSATION',
              'Conversation introuvable. Ouvrez-la depuis la boutique avant d’envoyer.',
            );
          }
          await bootstrapStoreConversation({
            conversationId,
            companyId,
            viewerUid: user.uid,
            productSellerUid:
              typeof options.sellerUid === 'string' ? options.sellerUid : null,
            clientUid: user.uid,
            clientName: user.displayName || 'Client',
          });
        }
        convSnap = await getDoc(convRef);
      }

      const messageRef = requestedId
        ? doc(db, 'conversations', conversationId, 'messages', requestedId)
        : doc(collection(db, 'conversations', conversationId, 'messages'));
      await setDoc(messageRef, messageData);

      if (!convSnap.data()?.conversationKind) {
        try {
          const repaired = await repairMissingConversationKind({
            conversationId,
            viewerUid: user.uid,
          });
          if (repaired) convSnap = await getDoc(convRef);
        } catch (repairError) {
          const repairCode =
            repairError && typeof repairError === 'object' && 'code' in repairError
              ? String((repairError as { code?: string }).code)
              : '';
          console.warn('Réparation du fil ignorée:', repairCode || repairError);
        }
      }

      const participants = Array.isArray(convSnap.data()?.participants)
        ? (convSnap.data()?.participants as string[])
        : [];
      const updateData: Record<string, any> = {
        lastMessage: safeText,
        lastMessageType: type,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        [`unreadCount.${user.uid}`]: 0,
        messageCount: increment(1),
      };
      participants
        .filter((id) => id && id !== user.uid)
        .forEach((id) => {
          updateData[`unreadCount.${id}`] = increment(1);
        });

      try {
        await updateDoc(convRef, updateData);
      } catch (updateError) {
        try {
          await deleteDoc(messageRef);
        } catch (rollbackError) {
          console.warn('Message non confirmé, suppression impossible:', rollbackError);
        }
        throw updateError;
      }
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      console.error('❌ Erreur envoi message:', code || error);
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