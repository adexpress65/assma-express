// src/services/messagingService.ts - SERVICE PROFESSIONNEL COMPLET
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import { db, auth, storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getUserDisplayLabel } from '../utils/userIdentity';

export class MessagingService {
  // Créer une nouvelle conversation
  static async createConversation(data: {
    title: string;
    type: 'order' | 'inquiry' | 'support' | 'partner' | 'direct';
    participants: string[];
    participantNames: { [userId: string]: string };
    participantAvatars: { [userId: string]: string };
    orderData?: {
      orderId: string;
      orderNumber: string;
      status: string;
      totalAmount: string;
      productName?: string;
      productImage?: string;
    };
    partnerData?: {
      companyId: string;
      companyName: string;
      verified: boolean;
      category: string;
      responseTime: string;
      rating: number;
      online: boolean;
    };
    metadata?: {
      productId?: string;
      categoryId?: string;
      liveStreamId?: string;
      ticketNumber?: string;
    };
  }) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Utilisateur non connecté');

      const conversationData = {
        ...data,
        lastMessage: 'Conversation démarrée',
        lastMessageTime: serverTimestamp(),
        unreadCount: data.participants.reduce((acc, participant) => ({
          ...acc,
          [participant]: participant === currentUser.uid ? 0 : 1
        }), {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const conversationRef = await addDoc(collection(db, 'conversations'), conversationData);
      
      // Envoyer un message de bienvenue
      await this.sendMessage(conversationRef.id, {
        text: 'Bienvenue ! Comment pouvons-nous vous aider ?',
        type: 'system',
        metadata: {}
      });

      return conversationRef.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  // Envoyer un message
  static async sendMessage(conversationId: string, data: {
    text: string;
    type: 'text' | 'image' | 'order_update' | 'system' | 'product' | 'offer';
    metadata?: any;
  }) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Utilisateur non connecté');

      // Vérifier si la conversation existe
      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) {
        throw new Error('Conversation introuvable');
      }

      const conversation = conversationSnap.data();
      
      // Créer le message
      const messageData = {
        conversationId,
        text: data.text,
        senderId: currentUser.uid,
        senderName: getUserDisplayLabel(
          {
            displayName: currentUser.displayName,
            email: currentUser.email,
            phoneNumber: currentUser.phoneNumber,
          },
          'Client',
        ),
        senderAvatar: currentUser.photoURL || '👤',
        type: data.type,
        metadata: data.metadata || {},
        readBy: [currentUser.uid],
        createdAt: serverTimestamp()
      };

      // Ajouter le message
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      await addDoc(messagesRef, messageData);

      // Mettre à jour la conversation
      const updateData: any = {
        lastMessage: data.text,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Mettre à jour les compteurs de non-lus
      conversation.participants.forEach((participantId: string) => {
        if (participantId !== currentUser.uid) {
          updateData[`unreadCount.${participantId}`] = increment(1);
        }
      });

      await updateDoc(conversationRef, updateData);

      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Marquer les messages comme lus
  static async markAsRead(conversationId: string, userId: string) {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      
      // Mettre à jour la conversation
      await updateDoc(conversationRef, {
        [`unreadCount.${userId}`]: 0
      });

      // Marquer les messages non lus
      const q = query(
        messagesRef,
        where('senderId', '!=', userId),
        where('readBy', 'array-contains', userId)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.forEach((docSnap) => {
        const messageRef = doc(db, 'conversations', conversationId, 'messages', docSnap.id);
        batch.update(messageRef, {
          readBy: arrayUnion(userId)
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }

  // Télécharger une image
  static async uploadImage(uri: string, conversationId: string): Promise<string> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const timestamp = Date.now();
      const fileName = `chat_images/${conversationId}/${timestamp}.jpg`;
      const imageRef = ref(storage, fileName);
      
      await uploadBytes(imageRef, blob);
      const downloadURL = await getDownloadURL(imageRef);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  // Obtenir les conversations d'un utilisateur
  static async getUserConversations(userId: string, limitCount: number = 50) {
    try {
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', userId),
        orderBy('updatedAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const conversations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return conversations;
    } catch (error) {
      console.error('Error getting user conversations:', error);
      throw error;
    }
  }

  // Obtenir les messages d'une conversation
  static async getConversationMessages(conversationId: string, limitCount: number = 100) {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return messages;
    } catch (error) {
      console.error('Error getting conversation messages:', error);
      throw error;
    }
  }

  // Supprimer une conversation
  static async deleteConversation(conversationId: string, userId: string) {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) {
        throw new Error('Conversation introuvable');
      }

      const conversation = conversationSnap.data();
      
      // Si l'utilisateur est le seul participant, supprimer complètement
      if (conversation.participants.length === 1) {
        // Supprimer tous les messages d'abord
        const messagesRef = collection(db, 'conversations', conversationId, 'messages');
        const messagesSnap = await getDocs(messagesRef);
        
        const batch = writeBatch(db);
        messagesSnap.forEach((docSnap) => {
          batch.delete(doc(db, 'conversations', conversationId, 'messages', docSnap.id));
        });
        
        await batch.commit();
        await deleteDoc(conversationRef);
      } else {
        // Sinon, retirer l'utilisateur des participants
        await updateDoc(conversationRef, {
          participants: arrayRemove(userId),
          [`participantNames.${userId}`]: deleteField(),
          [`participantAvatars.${userId}`]: deleteField(),
          [`unreadCount.${userId}`]: deleteField()
        });
      }

      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }

  // Rechercher dans les messages
  static async searchMessages(conversationId: string, searchTerm: string) {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        limit(100)
      );

      const snapshot = await getDocs(q);
      const messages = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(message => 
          message.text.toLowerCase().includes(searchTerm.toLowerCase())
        );

      return messages;
    } catch (error) {
      console.error('Error searching messages:', error);
      throw error;
    }
  }

  // Obtenir les statistiques de messagerie
  static async getMessagingStats(userId: string) {
    try {
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', userId)
      );

      const snapshot = await getDocs(q);
      let totalUnread = 0;
      let totalConversations = 0;
      let activePartners = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        totalUnread += data.unreadCount?.[userId] || 0;
        totalConversations++;
        
        if (data.partnerData?.online) {
          activePartners++;
        }
      });

      return {
        totalUnread,
        totalConversations,
        activePartners
      };
    } catch (error) {
      console.error('Error getting messaging stats:', error);
      throw error;
    }
  }

  // Mettre à jour les données de partenaire
  static async updatePartnerData(companyId: string, data: {
    online?: boolean;
    responseTime?: string;
    rating?: number;
    lastActive?: Date;
  }) {
    try {
      // Mettre à jour dans companies
      const companyRef = doc(db, 'companies', companyId);
      await updateDoc(companyRef, data);

      // Mettre à jour dans toutes les conversations où ce partenaire est présent
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', companyId),
        where('type', '==', 'partner')
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.forEach((docSnap) => {
        const conversationRef = doc(db, 'conversations', docSnap.id);
        batch.update(conversationRef, {
          'partnerData.online': data.online,
          'partnerData.responseTime': data.responseTime,
          'partnerData.rating': data.rating,
          'partnerData.lastActive': data.lastActive
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error updating partner data:', error);
      throw error;
    }
  }

  // Gérer les notifications push
  static async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data: any = {}
  ) {
    try {
      // Récupérer le token FCM de l'utilisateur
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const fcmToken = userData.fcmToken;
        
        if (fcmToken) {
          // Envoyer la notification via votre service ou Firebase Cloud Functions
          // Exemple avec Cloud Functions:
          // await functions().httpsCallable('sendPushNotification')({
          //   token: fcmToken,
          //   title,
          //   body,
          //   data
          // });
          
          console.log('Push notification sent to:', userId);
        }
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Gérer les conversations de commande
  static async createOrderConversation(orderData: any, userId: string) {
    try {
      const { bootstrapSupportConversation } = await import('./conversationRouting');
      const conversationId = await bootstrapSupportConversation({
        clientUid: userId,
        clientName: 'Client',
      });
      await this.sendMessage(conversationId, {
        text: `Votre commande #${orderData.orderNumber} a été confirmée. Nous vous tiendrons informé de son statut.`,
        type: 'order_update'
      });
      return conversationId;
    } catch (error) {
      console.error('Error creating order conversation:', error);
      throw error;
    }
  }

  // Gérer les mises à jour de statut de commande
  static async updateOrderStatus(conversationId: string, status: string, trackingNumber?: string) {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      
      // Mettre à jour la conversation
      await updateDoc(conversationRef, {
        'orderData.status': status,
        ...(trackingNumber && { 'orderData.trackingNumber': trackingNumber })
      });

      // Envoyer une notification
      let message = '';
      switch (status) {
        case 'processing':
          message = 'Votre commande est en cours de traitement.';
          break;
        case 'shipped':
          message = `Votre commande a été expédiée.${trackingNumber ? ` Numéro de suivi: ${trackingNumber}` : ''}`;
          break;
        case 'delivered':
          message = 'Votre commande a été livrée !';
          break;
        case 'cancelled':
          message = 'Votre commande a été annulée.';
          break;
      }

      if (message) {
        await this.sendMessage(conversationId, {
          text: message,
          type: 'order_update',
          metadata: { status, trackingNumber }
        });
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }
}

// Note: Pour utiliser deleteField(), vous devez l'importer de firebase/firestore
import { deleteField } from 'firebase/firestore';