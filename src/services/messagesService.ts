// apps/mobile/src/services/messagesService.ts - VERSION CORRIGÉE
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Message {
  id?: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  timestamp: any; // Timestamp ou Date
  type: 'text' | 'image' | 'file' | 'order' | 'system';
  readBy?: string[];
  metadata?: Record<string, any>;
}

export interface Conversation {
  id?: string;
  title: string;
  type: string;
  participants: string[];
  participantNames: Record<string, string>;
  participantAvatars: Record<string, string>;
  lastMessage: string;
  lastMessageTime: any; // Timestamp ou Date
  unreadCount: Record<string, number>;
  createdAt: any; // Timestamp ou Date
  updatedAt: any; // Timestamp ou Date
  businessData?: {
    companyId: string;
    status: 'online' | 'away' | 'offline' | 'busy';
    verified: boolean;
    category: string;
    responseTime: string;
  };
  shoppingData?: {
    orderId?: string;
    orderStatus?: string;
    totalAmount?: string;
    itemsCount?: number;
    estimatedDelivery?: string;
    trackingNumber?: string;
  };
}

// Démos pré-définies
const DEMO_CONVERSATIONS: Partial<Conversation>[] = [
  {
    title: "Support Assma Express",
    type: "business",
    participants: ['user_id', 'support_1'],
    participantNames: {
      'user_id': 'Vous',
      'support_1': 'Support Assma'
    },
    participantAvatars: {
      'user_id': '👤',
      'support_1': '🏢'
    },
    lastMessage: "Bonjour ! Comment pouvons-nous vous aider ?",
    lastMessageTime: new Date(Date.now() - 3600000), // 1 heure
    unreadCount: { 'user_id': 2 },
    businessData: {
      companyId: 'assma_support',
      status: 'online',
      verified: true,
      category: 'Support Client',
      responseTime: '2-5 min'
    }
  },
  {
    title: "Commande #ORD-12345",
    type: "order",
    participants: ['user_id', 'seller_1'],
    participantNames: {
      'user_id': 'Vous',
      'seller_1': 'Assma Industries'
    },
    participantAvatars: {
      'user_id': '👤',
      'seller_1': '🏭'
    },
    lastMessage: "Votre commande est en préparation",
    lastMessageTime: new Date(Date.now() - 86400000), // 1 jour
    unreadCount: { 'user_id': 0 },
    shoppingData: {
      orderId: 'ORD-12345',
      orderStatus: 'processing',
      totalAmount: '150,000 FCFA',
      itemsCount: 3,
      estimatedDelivery: '5-7 jours'
    }
  },
  {
    title: "Marie Konaté",
    type: "direct",
    participants: ['user_id', 'user_2'],
    participantNames: {
      'user_id': 'Vous',
      'user_2': 'Marie Konaté'
    },
    participantAvatars: {
      'user_id': '👤',
      'user_2': '👩‍💼'
    },
    lastMessage: "Salut ! Tu as reçu le devis ?",
    lastMessageTime: new Date(Date.now() - 172800000), // 2 jours
    unreadCount: { 'user_id': 1 }
  }
];

const messagesService = {
  // 🔥 CORRIGÉ : Écouter les conversations SANS orderBy problématique
  listenToUserConversations: (userId: string, callback: (conversations: Conversation[]) => void) => {
    try {
      console.log('🔍 Écoute conversations pour:', userId);
      
      const conversationsRef = collection(db, 'conversations');
      
      // ✅ VERSION CORRIGÉE : Sans orderBy pour éviter l'erreur d'index
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', userId)
        // NOTE: On a enlevé orderBy('lastMessageTime', 'desc') temporairement
      );
      
      return onSnapshot(q, (snapshot) => {
        const conversationsData: Conversation[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          conversationsData.push({
            id: doc.id,
            ...data
          } as Conversation);
        });
        
        // 🔥 TRI MANUEL côté client (évite l'erreur Firebase)
        conversationsData.sort((a, b) => {
          try {
            const timeA = a.lastMessageTime?.toDate?.() || 
                         (a.lastMessageTime instanceof Timestamp ? a.lastMessageTime.toDate() : new Date(0));
            const timeB = b.lastMessageTime?.toDate?.() || 
                         (b.lastMessageTime instanceof Timestamp ? b.lastMessageTime.toDate() : new Date(0));
            return timeB.getTime() - timeA.getTime(); // Tri descendant
          } catch (error) {
            return 0; // En cas d'erreur, garder l'ordre original
          }
        });
        
        console.log(`📦 ${conversationsData.length} conversations chargées (tri manuel)`);
        callback(conversationsData);
      }, (error) => {
        console.error('❌ Erreur écoute conversations:', error);
        // Retourner tableau vide au lieu de crash
        callback([]);
      });
      
    } catch (error) {
      console.error('❌ Erreur initialisation écoute conversations:', error);
      // Retourner une fonction unsubscribe vide
      return () => {};
    }
  },

  // 🔥 CORRIGÉ : Écouter les messages d'une conversation
  listenToConversationMessages: (conversationId: string, callback: (messages: Message[]) => void) => {
    try {
      console.log('📖 Écoute messages pour conversation:', conversationId);
      
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      
      // ✅ VERSION CORRIGÉE : Sans orderBy si problème
      const createMessagesQuery = () => {
        try {
          return query(
            messagesRef,
            orderBy('timestamp', 'asc') // Essayer avec orderBy
          );
        } catch (error) {
          console.log('⚠️ Index messages manquant, chargement sans tri');
          return query(messagesRef); // Sans orderBy
        }
      };

      const q = createMessagesQuery();
      
      return onSnapshot(q, (snapshot) => {
        const messagesData: Message[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          messagesData.push({
            id: doc.id,
            ...data
          } as Message);
        });
        
        // Tri manuel si nécessaire
        if (!q.queryConstraints.some(c => c.type === 'orderBy')) {
          messagesData.sort((a, b) => {
            const timeA = a.timestamp?.toDate?.() || new Date(0);
            const timeB = b.timestamp?.toDate?.() || new Date(0);
            return timeA.getTime() - timeB.getTime(); // Tri ascendant
          });
        }
        
        callback(messagesData);
      }, (error) => {
        console.error('❌ Erreur écoute messages:', error);
        callback([]); // Retourner vide au lieu de crash
      });
      
    } catch (error) {
      console.error('❌ Erreur initialisation écoute messages:', error);
      return () => {};
    }
  },

  // 🔥 CORRIGÉ : Créer des conversations de démo
  createDemoConversations: async (userId: string) => {
    try {
      console.log('🏗️ Création conversations de démo pour:', userId);
      
      // Vérifier d'abord si des conversations existent déjà
      const existingQuery = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', userId)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      
      if (existingSnapshot.size > 0) {
        console.log('ℹ️ Conversations existantes trouvées, pas de démo nécessaire');
        return;
      }
      
      const batch = writeBatch(db);
      let demoCount = 0;
      
      // Créer chaque conversation de démo
      for (const demo of DEMO_CONVERSATIONS) {
        try {
          const conversationRef = doc(collection(db, 'conversations'));
          
          // Remplacer 'user_id' par le vrai userId
          const participants = demo.participants?.map(p => 
            p === 'user_id' ? userId : p
          ) || [userId];
          
          const participantNames = { ...demo.participantNames };
          if (participantNames['user_id']) {
            participantNames[userId] = participantNames['user_id'];
            delete participantNames['user_id'];
          }
          
          const participantAvatars = { ...demo.participantAvatars };
          if (participantAvatars['user_id']) {
            participantAvatars[userId] = participantAvatars['user_id'];
            delete participantAvatars['user_id'];
          }
          
          const unreadCount = { ...demo.unreadCount };
          if (unreadCount['user_id'] !== undefined) {
            unreadCount[userId] = unreadCount['user_id'];
            delete unreadCount['user_id'];
          }
          
          const conversationData: Conversation = {
            title: demo.title || 'Conversation',
            type: demo.type || 'direct',
            participants,
            participantNames,
            participantAvatars,
            lastMessage: demo.lastMessage || 'Nouvelle conversation',
            lastMessageTime: demo.lastMessageTime ? 
              (demo.lastMessageTime instanceof Date ? 
                Timestamp.fromDate(demo.lastMessageTime) : 
                demo.lastMessageTime) : 
              serverTimestamp(),
            unreadCount,
            businessData: demo.businessData,
            shoppingData: demo.shoppingData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          
          batch.set(conversationRef, conversationData);
          demoCount++;
          
        } catch (demoError) {
          console.error('❌ Erreur création démo individuelle:', demoError);
          // Continuer avec les autres démos
        }
      }
      
      if (demoCount > 0) {
        await batch.commit();
        console.log(`✅ ${demoCount} conversations de démo créées`);
      } else {
        console.log('ℹ️ Aucune conversation de démo créée');
      }
      
    } catch (error) {
      console.error('❌ Erreur création démos:', error);
      // Ne pas throw pour éviter les crashs
    }
  },

  // Envoyer un message
  sendMessage: async (conversationId: string, messageData: Omit<Message, 'id' | 'timestamp'>) => {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      
      const messageToSend = {
        ...messageData,
        timestamp: serverTimestamp(),
        readBy: [messageData.senderId] // L'expéditeur a déjà lu
      };
      
      const messageRef = await addDoc(messagesRef, messageToSend);
      
      // Mettre à jour la conversation
      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        lastMessage: messageData.text.substring(0, 100), // Limiter la longueur
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        [`unreadCount.${messageData.senderId}`]: 0 // Remettre à zéro pour l'expéditeur
      });
      
      console.log('✅ Message envoyé:', messageRef.id);
      return messageRef.id;
      
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      throw error;
    }
  },

  // Obtenir ou créer une conversation directe
  getOrCreateDirectConversation: async (
    userId1: string,
    userId2: string,
    userName1: string,
    userName2: string,
    userAvatar1?: string,
    userAvatar2?: string
  ): Promise<string> => {
    try {
      // Chercher une conversation existante
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', userId1)
      );
      
      const snapshot = await getDocs(q);
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.participants.includes(userId2) && data.type === 'direct') {
          console.log('✅ Conversation existante trouvée:', doc.id);
          return doc.id;
        }
      }
      
      // Créer une nouvelle conversation
      const conversationData: Conversation = {
        title: userName2,
        type: 'direct',
        participants: [userId1, userId2],
        participantNames: {
          [userId1]: userName1,
          [userId2]: userName2
        },
        participantAvatars: {
          [userId1]: userAvatar1 || '👤',
          [userId2]: userAvatar2 || '👤'
        },
        lastMessage: 'Nouvelle conversation',
        lastMessageTime: serverTimestamp(),
        unreadCount: {
          [userId1]: 0,
          [userId2]: 0
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const conversationRef = await addDoc(conversationsRef, conversationData);
      console.log('✅ Nouvelle conversation créée:', conversationRef.id);
      
      return conversationRef.id;
      
    } catch (error) {
      console.error('❌ Erreur création conversation directe:', error);
      throw error;
    }
  },

  // Marquer les messages comme lus
  markMessagesAsRead: async (conversationId: string, userId: string) => {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        [`unreadCount.${userId}`]: 0,
        updatedAt: serverTimestamp()
      });
      
      console.log('✅ Messages marqués comme lus pour:', userId);
      
    } catch (error) {
      console.error('❌ Erreur marquage messages comme lus:', error);
      // Ne pas throw pour éviter les crashs
    }
  },

  // Obtenir une conversation par ID
  getConversationById: async (conversationId: string): Promise<Conversation | null> => {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationDoc = await getDocs(collection(db, 'conversations'));
      
      // Chercher dans les résultats (getDoc ne marche pas toujours avec certaines règles)
      for (const doc of conversationDoc.docs) {
        if (doc.id === conversationId) {
          return { id: doc.id, ...doc.data() } as Conversation;
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Erreur récupération conversation:', error);
      return null;
    }
  }
};

export default messagesService;