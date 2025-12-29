import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  Timestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  timestamp: any;
  type: 'text' | 'image' | 'system';
  read?: boolean;
  readBy?: string[];
}

export interface Conversation {
  id: string;
  title: string;
  type: 'direct' | 'group' | 'support' | 'order' | 'channel';
  participants: string[];
  participantNames: { [key: string]: string };
  participantAvatars: { [key: string]: string };
  lastMessage?: string;
  lastMessageTime?: any;
  unreadCount?: { [key: string]: number };
  createdAt: any;
  updatedAt: any;
}

class MessagesService {
  // Écouter les conversations d'un utilisateur
  listenToUserConversations(userId: string, callback: (conversations: Conversation[]) => void) {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const conversations: Conversation[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        conversations.push({
          id: doc.id,
          ...data
        } as Conversation);
      });
      callback(conversations);
    }, (error) => {
      console.error('Erreur écoute conversations:', error);
    });
  }

  // Écouter les messages d'une conversation
  listenToConversationMessages(conversationId: string, callback: (messages: Message[]) => void) {
    const q = query(
      collection(db, 'conversations', conversationId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const messages: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          ...data
        } as Message);
      });
      callback(messages);
    }, (error) => {
      console.error('Erreur écoute messages:', error);
    });
  }

  // Envoyer un message
  async sendMessage(conversationId: string, messageData: {
    text: string;
    senderId: string;
    senderName: string;
    senderAvatar: string;
    type: 'text' | 'image' | 'system';
  }) {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      
      const message = {
        ...messageData,
        timestamp: serverTimestamp(),
        read: false,
        readBy: [messageData.senderId]
      };

      // Ajouter le message
      const docRef = await addDoc(messagesRef, message);

      // Mettre à jour la conversation
      await updateDoc(conversationRef, {
        lastMessage: messageData.text,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Incrémenter les compteurs de messages non lus pour tous les participants sauf l'envoyeur
      const conversationDoc = await getDoc(conversationRef);
      const conversation = conversationDoc.data() as Conversation;
      
      const batch = writeBatch(db);
      
      conversation.participants.forEach((participantId) => {
        if (participantId !== messageData.senderId) {
          const unreadCount = conversation.unreadCount?.[participantId] || 0;
          batch.update(conversationRef, {
            [`unreadCount.${participantId}`]: unreadCount + 1
          });
        }
      });

      await batch.commit();

      return docRef.id;
    } catch (error) {
      console.error('Erreur envoi message:', error);
      throw error;
    }
  }

  // Créer ou récupérer une conversation directe
  async getOrCreateDirectConversation(
    userId1: string, 
    userId2: string, 
    userName1: string, 
    userName2: string, 
    userAvatar1?: string, 
    userAvatar2?: string
  ): Promise<string> {
    try {
      // Vérifier si une conversation existe déjà
      const q = query(
        collection(db, 'conversations'),
        where('type', '==', 'direct'),
        where('participants', 'array-contains', userId1)
      );

      const querySnapshot = await getDocs(q);
      
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        if (data.participants.includes(userId2)) {
          return doc.id; // Conversation existante
        }
      }

      // Créer une nouvelle conversation
      const conversationData = {
        title: `${userName1} & ${userName2}`,
        type: 'direct' as const,
        participants: [userId1, userId2],
        participantNames: {
          [userId1]: userName1,
          [userId2]: userName2
        },
        participantAvatars: {
          [userId1]: userAvatar1 || '',
          [userId2]: userAvatar2 || ''
        },
        unreadCount: {
          [userId1]: 0,
          [userId2]: 0
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'conversations'), conversationData);
      return docRef.id;

    } catch (error) {
      console.error('Erreur création conversation:', error);
      throw error;
    }
  }

  // Marquer les messages comme lus - CORRIGÉ
  async markMessagesAsRead(conversationId: string, userId: string) {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      
      // CORRECTION : Utiliser une approche différente pour les messages non lus
      // Récupérer tous les messages et filtrer côté client
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.forEach((doc) => {
        const messageData = doc.data();
        const readBy = messageData.readBy || [];
        
        if (!readBy.includes(userId)) {
          const messageRef = doc.ref;
          batch.update(messageRef, {
            readBy: arrayUnion(userId),
            read: true
          });
        }
      });

      // Réinitialiser le compteur de messages non lus
      batch.update(conversationRef, {
        [`unreadCount.${userId}`]: 0
      });

      await batch.commit();
    } catch (error) {
      console.error('Erreur marquage messages lus:', error);
      throw error;
    }
  }

  // Créer des conversations de démonstration
  async createDemoConversations(userId: string) {
    try {
      const demoConversations = [
        {
          title: 'Support Assma Express',
          type: 'support' as const,
          participants: [userId, 'support_bot'],
          participantNames: {
            [userId]: 'Vous',
            'support_bot': 'Support Assma Express'
          },
          participantAvatars: {
            [userId]: '',
            'support_bot': '🛒'
          },
          unreadCount: { [userId]: 1, 'support_bot': 0 },
          lastMessage: 'Bienvenue sur Assma Express! Comment pouvons-nous vous aider?',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          title: 'Tech Influencers',
          type: 'group' as const,
          participants: [userId, 'user2', 'user3'],
          participantNames: {
            [userId]: 'Vous',
            'user2': 'Tech Expert',
            'user3': 'Gadget Lover'
          },
          participantAvatars: {
            [userId]: '',
            'user2': '📱',
            'user3': '💻'
          },
          unreadCount: { [userId]: 3, 'user2': 0, 'user3': 0 },
          lastMessage: 'Nouveau smartphone en review! 📱',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          title: 'Commande #ASMA-12345',
          type: 'order' as const,
          participants: [userId, 'order_system'],
          participantNames: {
            [userId]: 'Vous',
            'order_system': 'Système de Commandes'
          },
          participantAvatars: {
            [userId]: '',
            'order_system': '📦'
          },
          unreadCount: { [userId]: 1, 'order_system': 0 },
          lastMessage: 'Votre colis est en route 🚚',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      ];

      const batch = writeBatch(db);

      for (const conversationData of demoConversations) {
        const conversationRef = doc(collection(db, 'conversations'));
        batch.set(conversationRef, conversationData);

        // Ajouter un message de bienvenue pour chaque conversation
        const welcomeMessage = {
          text: conversationData.lastMessage,
          senderId: conversationData.participants.find(p => p !== userId) || 'system',
          senderName: conversationData.participantNames[conversationData.participants.find(p => p !== userId) || 'system'],
          senderAvatar: conversationData.participantAvatars[conversationData.participants.find(p => p !== userId) || 'system'],
          type: 'text' as const,
          timestamp: serverTimestamp(),
          read: false,
          readBy: []
        };

        const messageRef = doc(collection(db, 'conversations', conversationRef.id, 'messages'));
        batch.set(messageRef, welcomeMessage);
      }

      await batch.commit();
      console.log('✅ Conversations de démonstration créées avec succès');

    } catch (error) {
      console.error('Erreur création démos:', error);
      throw error;
    }
  }

  // Supprimer une conversation
  async deleteConversation(conversationId: string) {
    try {
      await deleteDoc(doc(db, 'conversations', conversationId));
    } catch (error) {
      console.error('Erreur suppression conversation:', error);
      throw error;
    }
  }

  // Ajouter un participant à une conversation
  async addParticipant(conversationId: string, userId: string, userName: string, userAvatar?: string) {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      
      await updateDoc(conversationRef, {
        participants: arrayUnion(userId),
        [`participantNames.${userId}`]: userName,
        [`participantAvatars.${userId}`]: userAvatar || '',
        [`unreadCount.${userId}`]: 0,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Erreur ajout participant:', error);
      throw error;
    }
  }
}

export default new MessagesService();