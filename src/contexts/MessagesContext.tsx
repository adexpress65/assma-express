// src/contexts/MessagesContext.tsx - VERSION COMPLÈTE WHATSAPP-LIKE
import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
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
  limit,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { useAuth } from './AuthContext';
import { Alert } from 'react-native';

// ================================
// TYPES
// ================================
export type ConversationType =
  | "support"
  | "order"
  | "group"
  | "seller"
  | "premium"
  | "delivery"
  | "channel"
  | "direct"
  | "promo"
  | "return"
  | "subscription"
  | "entrepreneur";

export interface Conversation {
  id: string;
  title: string;
  type: ConversationType;
  /** ID document Firestore `companies/{id}` (boutique). */
  companyId?: string;
  companyName?: string;
  companyLogo?: string;
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
  createdAt?: Timestamp | Date;
  readBy: string[];
  type: 'text' | 'image' | 'file' | 'voice' | 'location' | 'product_payment';
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
  product?: {
    id: string;
    name: string;
    price: number;
    currency: string;
    image: string;
    specifications?: {
      weight?: string;
      dimensions?: string;
      volume?: string;
    };
  };
  payment?: {
    url: string;
    provider: 'ngenius';
    status: 'pending' | 'paid' | 'failed';
  };
}

export interface TypingUser {
  uid: string;
  name: string;
  timestamp: Date;
}

/** Fenêtre temps réel : évitez de charger trop de conversations d'un coup. */
const CONVERSATIONS_PAGE_SIZE = 25;

function mapFirestoreConversationDoc(docSnap: QueryDocumentSnapshot): Conversation {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    title: data.title || 'Sans titre',
    type: data.type || 'direct',
    companyId: data.companyId || undefined,
    companyName: data.companyName || undefined,
    companyLogo: data.companyLogo || undefined,
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
  };
}

interface OnlineUser {
  uid: string;
  lastSeen: Date;
  status: 'online' | 'offline' | 'away';
}

interface MessagesContextType {
    getConversationName: (conversation: Conversation) => string;
  // État
  conversations: Conversation[];
  loading: boolean;
  onlineUsers: OnlineUser[];
  typingUsers: Record<string, TypingUser[]>;
  selectedConversation: Conversation | null;
  unreadCount: number;
  
  // Conversations
  createConversation: (data: Partial<Conversation>) => Promise<string>;
  deleteConversation: (
    conversationId: string,
    options?: { suppressErrorAlert?: boolean },
  ) => Promise<void>;
  /** Suite de la liste (Firestore), après les CONVERSATIONS_PAGE_SIZE premiers fils. */
  hasMoreConversations: boolean;
  loadingMoreConversations: boolean;
  loadMoreConversations: () => Promise<void>;
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
    product?: Message['product'];
    payment?: Message['payment'];
  }) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  /** Supprime tous les messages (participant). Lot de 400 pour Firestore. */
  clearAllMessagesInConversation: (conversationId: string) => Promise<void>;
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
    // Helper pour afficher le nom propre d'une conversation
    const getConversationName = (conversation: Conversation): string => {
      if (conversation.type === 'group') {
        return conversation.title;
      }
      // Trouver l'ID du participant qui n'est pas l'utilisateur courant
      const otherId = conversation.participants.find((id) => id !== user?.uid);
      if (otherId && conversation.participantNames?.[otherId]) {
        return conversation.participantNames[otherId];
      }
      return conversation.title || 'Conversation';
    };
  const { user } = useAuth();
  
  // État
  const [liveConversations, setLiveConversations] = useState<Conversation[]>([]);
  const [extraConversations, setExtraConversations] = useState<Conversation[]>([]);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser[]>>({});
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  const conversations = useMemo(() => {
    const liveIds = new Set(liveConversations.map((c) => c.id));
    const merged = [
      ...liveConversations,
      ...extraConversations.filter((c) => !liveIds.has(c.id)),
    ];
    const uid = user?.uid;
    if (!uid) return merged;
    return merged.filter(
      (c) =>
        Array.isArray(c.participants) && c.participants.includes(uid),
    );
  }, [liveConversations, extraConversations, user?.uid]);

  // Références
  const typingTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const unsubscribeRefs = useRef<{ 
    conversations?: () => void; 
    online?: () => void;
    typing: Record<string, () => void>;
  }>({ typing: {} });
  const prevConversationCountRef = useRef<number | null>(null);
  const listEndDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const loadMoreCursorRef = useRef<QueryDocumentSnapshot | null>(null);
  const liveConversationsRef = useRef<Conversation[]>([]);

  useEffect(() => {
    liveConversationsRef.current = liveConversations;
  }, [liveConversations]);

  useEffect(() => {
    const liveIds = new Set(liveConversations.map((c) => c.id));
    setExtraConversations((prev) => prev.filter((c) => !liveIds.has(c.id)));
  }, [liveConversations]);
  
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
      prevConversationCountRef.current = null;
      setLiveConversations([]);
      setExtraConversations([]);
      listEndDocRef.current = null;
      loadMoreCursorRef.current = null;
      setHasMoreConversations(false);
      setLoading(false);
      return;
    }

    console.log('📡 Connexion à Firestore pour les conversations...');

    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc'),
      limit(CONVERSATIONS_PAGE_SIZE),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const convs: Conversation[] = snapshot.docs.map(mapFirestoreConversationDoc);

        if (snapshot.docs.length >= CONVERSATIONS_PAGE_SIZE) {
          listEndDocRef.current =
            snapshot.docs[snapshot.docs.length - 1] ?? null;
          setHasMoreConversations(true);
          loadMoreCursorRef.current = null;
        } else {
          listEndDocRef.current = null;
          loadMoreCursorRef.current = null;
          setHasMoreConversations(false);
        }

        if (
          __DEV__ &&
          prevConversationCountRef.current !== convs.length
        ) {
          prevConversationCountRef.current = convs.length;
          console.log(`✅ ${convs.length} conversations (temps réel, page 1)`);
        }
        setLiveConversations(convs);
        setLoading(false);
      },
      (error) => {
        console.error('❌ Erreur chargement conversations:', error);
        setLoading(false);
      },
    );

    unsubscribeRefs.current.conversations = unsubscribe;

    return () => {
      if (unsubscribeRefs.current.conversations) {
        unsubscribeRefs.current.conversations();
      }
    };
  }, [user?.uid]);

  const loadMoreConversations = async (): Promise<void> => {
    if (!user?.uid || loadingMoreConversations || !hasMoreConversations) return;
    const cursor =
      loadMoreCursorRef.current ?? listEndDocRef.current;
    if (!cursor) return;

    setLoadingMoreConversations(true);
    try {
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', user.uid),
        orderBy('updatedAt', 'desc'),
        startAfter(cursor),
        limit(CONVERSATIONS_PAGE_SIZE),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setHasMoreConversations(false);
        return;
      }
      const batch = snap.docs.map(mapFirestoreConversationDoc);
      setExtraConversations((prev) => {
        const seen = new Set<string>([
          ...liveConversationsRef.current.map((c) => c.id),
          ...prev.map((c) => c.id),
        ]);
        const add = batch.filter((c) => !seen.has(c.id));
        return [...prev, ...add];
      });
      loadMoreCursorRef.current = snap.docs[snap.docs.length - 1] ?? null;
      if (snap.docs.length < CONVERSATIONS_PAGE_SIZE) {
        setHasMoreConversations(false);
      }
    } catch (e) {
      console.error('❌ loadMoreConversations:', e);
    } finally {
      setLoadingMoreConversations(false);
    }
  };

  // ================================
  // 🔥 SURVEILLANCE DES UTILISATEURS EN LIGNE - OPTIMISÉE
  // ================================
  useEffect(() => {
    if (!user?.uid) return;

    const statusRef = collection(db, 'status');
    const q = query(statusRef, where('state', 'in', ['online', 'away']));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Récupérer tous les participants avec qui on converse
      const participantIds = new Set<string>();
      conversations.forEach(conv => {
        conv.participants.forEach(id => {
          if (id !== user.uid) {
            participantIds.add(id);
          }
        });
      });

      const users: OnlineUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Ne conserver que les participants avec qui on converse
        if (participantIds.has(data.uid)) {
          users.push({
            uid: data.uid,
            lastSeen: data.lastChanged?.toDate() || new Date(),
            status: data.state || 'offline'
          });
        }
      });
      setOnlineUsers(users);
    });

    unsubscribeRefs.current.online = unsubscribe;

    return () => {
      if (unsubscribeRefs.current.online) {
        unsubscribeRefs.current.online();
      }
    };
  }, [user?.uid, conversations]);

  // ================================
  // 🔥 SURVEILLANCE DES TYPING - OPTIMISÉE
  // ================================
  // On écoute UNIQUEMENT la conversation sélectionnée pour éviter trop de listeners
  useEffect(() => {
    if (!user?.uid) return;
    
    // Si aucune conversation sélectionnée, nettoyer tous les listeners et sortir
    if (!selectedConversation) {
      Object.values(unsubscribeRefs.current.typing).forEach(unsubscribe => unsubscribe());
      unsubscribeRefs.current.typing = {};
      setTypingUsers({});
      return;
    }

    const conversationId = selectedConversation.id;
    
    // Vérifier si on a déjà un listener pour cette conversation
    if (unsubscribeRefs.current.typing[conversationId]) {
      return; // Déjà écouté, pas besoin de recréer
    }

    // Créer le listener pour la conversation sélectionnée
    const typingRef = collection(db, 'conversations', conversationId, 'typing');
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
      const typing: TypingUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.uid !== user.uid) {
          typing.push({
            uid: data.uid,
            name: selectedConversation.participantNames?.[data.uid] || data.name || 'Quelqu\'un',
            timestamp: data.timestamp?.toDate() || new Date()
          });
        }
      });
      
      setTypingUsers({ [conversationId]: typing });
    });

    // Enregistrer le nouveau listener
    unsubscribeRefs.current.typing[conversationId] = unsubscribe;

    // Nettoyer les vieux listeners (sauf celui de la conversation sélectionnée)
    Object.keys(unsubscribeRefs.current.typing).forEach(id => {
      if (id !== conversationId) {
        unsubscribeRefs.current.typing[id]?.();
        delete unsubscribeRefs.current.typing[id];
      }
    });

    // Nettoyer à la désinstallation ou quand la conversation change
    return () => {
      if (unsubscribeRefs.current.typing[conversationId]) {
        unsubscribeRefs.current.typing[conversationId]();
        delete unsubscribeRefs.current.typing[conversationId];
      }
    };
  }, [user?.uid, selectedConversation?.id]);

  // ================================
  // 🔥 FONCTIONS DE CONVERSATION
  // ================================

  // CRÉER UNE CONVERSATION
// CRÉER UNE CONVERSATION - VERSION MODIFIÉE
const createConversation = async (data: Partial<Conversation>): Promise<string> => {
  if (!user?.uid) throw new Error('Utilisateur non connecté');

  try {
    let participantIds = [...(data.participants || [])];
    /** ID doc `companies` (boutique), distinct de l’UID propriétaire. */
    let companyFirestoreId: string | null = data.companyId || null;

    if (data.type === 'entrepreneur' || data.type === 'seller') {
      if (!companyFirestoreId && participantIds[0]) {
        const maybeOwner = participantIds[0];
        const userSnap = await getDoc(doc(db, 'users', maybeOwner));
        if (userSnap.exists()) {
          const cid = userSnap.data()?.companyId;
          if (typeof cid === 'string' && cid.length > 0) {
            companyFirestoreId = cid;
          }
        }
        if (!companyFirestoreId) {
          const compSnap = await getDoc(doc(db, 'companies', maybeOwner));
          if (compSnap.exists()) {
            companyFirestoreId = maybeOwner;
          }
        }
      }

      if (companyFirestoreId) {
        const realUserId = await ensureEntrepreneurHasUser(companyFirestoreId);
        participantIds = [realUserId];
        console.log('🔄 Conversation boutique:', { companyFirestoreId, realUserId });

        try {
          const userDoc = await getDoc(doc(db, 'users', realUserId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            data.participantNames = {
              ...data.participantNames,
              [realUserId]: userData.displayName || userData.name || 'Interlocuteur',
            };
            const ph = userData.photoURL;
            data.participantAvatars = {
              ...data.participantAvatars,
              [realUserId]:
                typeof ph === 'string' && ph.startsWith('http') ? ph : '',
            };
          }
        } catch (e) {
          console.log('⚠️ Impossible de charger le nom/photo utilisateur entrepreneur');
        }
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

    if (
      companyFirestoreId &&
      (data.type === 'entrepreneur' || data.type === 'seller')
    ) {
      try {
        const companyDoc = await getDoc(
          doc(db, 'companies', companyFirestoreId),
        );
        if (companyDoc.exists()) {
          const company = companyDoc.data();
          conversationData.companyId = companyFirestoreId;
          conversationData.companyName =
            company.name || data.title || conversationData.title;
          conversationData.companyLogo = company.logo || null;
          if (!conversationData.title || conversationData.title === 'Entrepreneur') {
            conversationData.title =
              company.name || conversationData.title || 'Boutique';
          }
        }
      } catch (e) {
        console.log('⚠️ Impossible de charger les infos entreprise');
      }
    }

    if (
      data.type === 'direct' &&
      typeof data.companyId === 'string' &&
      data.companyId.length > 0 &&
      !conversationData.companyId
    ) {
      try {
        const companyDoc = await getDoc(doc(db, 'companies', data.companyId));
        if (companyDoc.exists()) {
          const company = companyDoc.data();
          conversationData.companyId = data.companyId;
          conversationData.companyName =
            company.name || data.title || conversationData.title;
          conversationData.companyLogo = company.logo || null;
        }
      } catch (e) {
        console.log('⚠️ Infos boutique (conversation directe):', e);
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

  const FIRESTORE_BATCH_MAX = 400;

  async function deleteDocsInChunks(
    docs: QueryDocumentSnapshot[],
  ): Promise<void> {
    for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_MAX) {
      const batch = writeBatch(db);
      docs
        .slice(i, i + FIRESTORE_BATCH_MAX)
        .forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  function isFunctionsNotFoundError(e: unknown): boolean {
    const err = e as { code?: string; message?: string };
    const msg = String(err?.message ?? '');
    return (
      err?.code === 'functions/not-found' ||
      /not\s*found/i.test(msg)
    );
  }

  async function callConversationModeration(
    conversationId: string,
    action: 'clearMessages' | 'deleteThread',
  ): Promise<void> {
    const fn = httpsCallable(functions, 'conversationModeration');
    await fn({ conversationId, action });
  }

  async function clearAllMessagesClientSide(
    conversationId: string,
  ): Promise<void> {
    if (!user?.uid) throw new Error('Utilisateur non connecté');

    const convSnap = await getDoc(doc(db, 'conversations', conversationId));
    if (!convSnap.exists()) {
      throw new Error('Conversation non trouvée');
    }
    const participants = (convSnap.data().participants || []) as string[];
    if (!participants.includes(user.uid)) {
      throw new Error('Accès refusé');
    }

    const messagesRef = collection(
      db,
      'conversations',
      conversationId,
      'messages',
    );
    const messagesSnapshot = await getDocs(messagesRef);
    await deleteDocsInChunks(messagesSnapshot.docs);

    await updateDoc(doc(db, 'conversations', conversationId), {
      lastMessage: '',
      lastMessageTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
      messageCount: 0,
    });
  }

  const clearAllMessagesInConversation = async (
    conversationId: string,
  ): Promise<void> => {
    if (!user?.uid) throw new Error('Utilisateur non connecté');
    try {
      await callConversationModeration(conversationId, 'clearMessages');
    } catch (e) {
      if (!isFunctionsNotFoundError(e)) throw e;
      await clearAllMessagesClientSide(conversationId);
    }
  };

  async function deleteConversationClientSide(
    conversationId: string,
  ): Promise<void> {
    if (!user?.uid) throw new Error('Utilisateur non connecté');

    let conversation = conversations.find((c) => c.id === conversationId);
    if (!conversation) {
      const snap = await getDoc(doc(db, 'conversations', conversationId));
      if (!snap.exists()) throw new Error('Conversation non trouvée');
      const d = snap.data();
      conversation = {
        id: conversationId,
        title: d.title || '',
        type: d.type || 'direct',
        participants: d.participants || [],
        createdBy: d.createdBy || '',
        admins: d.admins || [],
        createdAt: d.createdAt?.toDate() || new Date(),
        updatedAt: d.updatedAt?.toDate() || new Date(),
      } as Conversation;
    }

    const isParticipant = conversation.participants?.includes(user.uid);
    const isCreatorOrAdmin =
      conversation.createdBy === user.uid ||
      conversation.admins?.includes(user.uid);
    const isPair = (conversation.participants?.length || 0) === 2;

    if (!isParticipant || (!isCreatorOrAdmin && !isPair)) {
      throw new Error(
        "Vous n'avez pas la permission de supprimer cette conversation",
      );
    }

    const messagesRef = collection(
      db,
      'conversations',
      conversationId,
      'messages',
    );
    const messagesSnapshot = await getDocs(messagesRef);
    await deleteDocsInChunks(messagesSnapshot.docs);

    const typingRef = collection(
      db,
      'conversations',
      conversationId,
      'typing',
    );
    const typingSnapshot = await getDocs(typingRef);
    await deleteDocsInChunks(typingSnapshot.docs);

    await deleteDoc(doc(db, 'conversations', conversationId));
    console.log('🗑️ Conversation supprimée (client)');
  }

  // SUPPRIMER UNE CONVERSATION
  const deleteConversation = async (
    conversationId: string,
    options?: { suppressErrorAlert?: boolean },
  ): Promise<void> => {
    if (!user?.uid) throw new Error('Utilisateur non connecté');

    try {
      try {
        await callConversationModeration(conversationId, 'deleteThread');
        console.log('🗑️ Conversation supprimée');
      } catch (e) {
        if (!isFunctionsNotFoundError(e)) throw e;
        await deleteConversationClientSide(conversationId);
      }
    } catch (error) {
      console.error('❌ Erreur suppression conversation:', error);
      if (!options?.suppressErrorAlert) {
        Alert.alert('Erreur', 'Impossible de supprimer la conversation');
      }
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
      product?: Message['product'];
      payment?: Message['payment'];
    } = {}
  ): Promise<void> => {
    if (!user?.uid) throw new Error('Utilisateur non connecté');

    try {
      const messageType = options.type || 'text';
      const normalizedText = text.trim();
      const fallbackText =
        messageType === 'product_payment'
          ? `Paiement: ${options.product?.name || 'Produit'}`
          : normalizedText;
      const safeText = normalizedText || fallbackText;
      const messageData: any = {
        text: safeText,
        senderId: user.uid,
        senderName: user.displayName || 'Vous',
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
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
      if (options.product) messageData.product = options.product;
      if (options.payment) messageData.payment = options.payment;

      // 1. Ajouter le message
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(messagesRef, messageData);

      // 2. Mettre à jour la conversation
      const convRef = doc(db, 'conversations', conversationId);
      // 2. Mettre à jour la conversation (messageCount sécurisé)
      const { increment } = await import('firebase/firestore');
      const updateData: any = {
        lastMessage: safeText,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        [`unreadCount.${user.uid}`]: 0,
        messageCount: increment(1)
      };

      await updateDoc(convRef, updateData);

      // 3. Push vers les autres appareils : Cloud Function onNewChatMessagePush (Expo), pas de notif locale ici.

      const conversation = conversations.find(c => c.id === conversationId);
      if (conversation) {
        const otherParticipants = conversation.participants.filter(p => p !== user.uid);

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
    if (!user?.uid || !conversationId) return;

    try {
      const convRef = doc(db, 'conversations', conversationId);
      const convSnap = await getDoc(convRef);
      if (!convSnap.exists()) {
        // Le paramètre route peut être un `companyId`/UID avant bootstrap.
        return;
      }
      const convData = convSnap.data() as Record<string, unknown>;
      const unreadMap = convData.unreadCount as Record<string, unknown> | undefined;
      const currentUnread = Number(unreadMap?.[user.uid] ?? 0);
      if (!Number.isFinite(currentUnread) || currentUnread <= 0) {
        return;
      }

      await updateDoc(convRef, {
        [`unreadCount.${user.uid}`]: 0,
        updatedAt: serverTimestamp()
      });
      
      // Marquer les derniers messages comme lus si nécessaire.
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(
        messagesRef,
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      let hasMessageUpdates = false;
      
      snapshot.docs.forEach(docSnapshot => {
        const readBy = Array.isArray(docSnapshot.data().readBy)
          ? docSnapshot.data().readBy
          : [];
        if (!readBy.includes(user.uid)) {
          batch.update(docSnapshot.ref, {
            readBy: [...readBy, user.uid]
          });
          hasMessageUpdates = true;
        }
      });
      
      if (hasMessageUpdates) {
        await batch.commit();
      }
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

  const searchMessages = async (conversationId: string, searchQuery: string): Promise<Message[]> => {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      // Limiter à 50 résultats pour éviter de lire trop de documents
      const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      
      const messages: Message[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.text?.toLowerCase().includes(searchQuery.toLowerCase()) && !data.deleted) {
          // Convertir le timestamp Firestore en Date
          let messageTimestamp: Date | Timestamp;
          if (data.timestamp && typeof (data.timestamp as Timestamp).toDate === 'function') {
            messageTimestamp = (data.timestamp as Timestamp).toDate();
          } else if (data.timestamp instanceof Date) {
            messageTimestamp = data.timestamp;
          } else {
            messageTimestamp = new Date();
          }
          
          messages.push({
            id: doc.id,
            ...data,
            timestamp: messageTimestamp
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

      // Utiliser le champ messageCount existant au lieu de lire tous les messages
      // Cela évite des milliers de lectures inutiles !
      return {
        messageCount: conversation.messageCount || 0,
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

  // ...existing code...

  // ================================
  // VALEUR DU CONTEXTE
  // ================================

  const value: MessagesContextType = {
    getConversationName,
    // État
    conversations,
    loading,
    hasMoreConversations,
    loadingMoreConversations,
    onlineUsers,
    typingUsers,
    selectedConversation,
    unreadCount,
    
    // Conversations
    createConversation,
    deleteConversation,
    loadMoreConversations,
    leaveConversation,
    pinConversation,
    archiveConversation,
    muteConversation,
    updateConversation,
    
    // Messages
    sendMessage,
    deleteMessage,
    clearAllMessagesInConversation,
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
