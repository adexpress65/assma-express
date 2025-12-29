// src/config/initFirebaseData.ts
import { db, auth } from './firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';

export const initializeConversations = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('⚠️ Utilisateur non connecté');
      return;
    }

    const userId = user.uid;
    console.log('👤 Utilisateur ID:', userId);

    // Vérifier si des conversations existent déjà
    const conversationsRef = collection(db, 'conversations');
    const userConversationsQuery = query(
      conversationsRef,
      where('participants', 'array-contains', userId)
    );
    
    const existingConversations = await getDocs(userConversationsQuery);
    
    if (existingConversations.size > 0) {
      console.log('✅ Conversations déjà existantes:', existingConversations.size);
      return;
    }

    console.log('🔄 Création des conversations de démonstration...');

    // 1. CRÉER LES ENTREPRISES DANS LA COLLECTION "companies"
    const companies = [
      {
        id: 'company_assma',
        name: 'Assma Express',
        logo: '🛒',
        category: 'Marketplace',
        status: 'online',
        verified: true,
        chatEnabled: true,
        responseTime: '2 min',
        rating: 4.8
      },
      {
        id: 'company_tech',
        name: 'TechStore Maroc',
        logo: '💻',
        category: 'Électronique',
        status: 'online',
        verified: true,
        chatEnabled: true,
        responseTime: '5 min',
        rating: 4.5
      },
      {
        id: 'company_delivery',
        name: 'Livraison Express',
        logo: '🚚',
        category: 'Logistique',
        status: 'away',
        verified: true,
        chatEnabled: true,
        responseTime: '15 min',
        rating: 4.2
      }
    ];

    // Ajouter les entreprises
    for (const company of companies) {
      await addDoc(collection(db, 'companies'), company);
      console.log(`🏢 Entreprise créée: ${company.name}`);
    }

    // 2. CRÉER LES CONVERSATIONS BUSINESS
    const businessConversations = [
      {
        id: 'business_1',
        title: 'Support Assma Express',
        type: 'business',
        participants: [userId, 'company_assma'],
        participantNames: {
          [userId]: 'Vous',
          'company_assma': 'Assma Express'
        },
        participantAvatars: {
          [userId]: '👤',
          'company_assma': '🛒'
        },
        lastMessage: 'Bienvenue sur Assma Express! Comment pouvons-nous vous aider?',
        unreadCount: {
          [userId]: 2,
          'company_assma': 0
        },
        businessData: {
          companyId: 'company_assma',
          status: 'online',
          verified: true,
          category: 'Marketplace',
          responseTime: '2 min'
        }
      },
      {
        id: 'business_2',
        title: 'Support TechStore Maroc',
        type: 'business',
        participants: [userId, 'company_tech'],
        participantNames: {
          [userId]: 'Vous',
          'company_tech': 'TechStore Maroc'
        },
        participantAvatars: {
          [userId]: '👤',
          'company_tech': '💻'
        },
        lastMessage: 'Votre commande #12345 a été expédiée 📦',
        unreadCount: {
          [userId]: 1,
          'company_tech': 0
        },
        businessData: {
          companyId: 'company_tech',
          status: 'online',
          verified: true,
          category: 'Électronique',
          responseTime: '5 min'
        }
      }
    ];

    // 3. CRÉER LES CONVERSATIONS SHOPPING (COMMANDES)
    const shoppingConversations = [
      {
        id: 'order_1',
        title: 'Commande #ASMA-12345',
        type: 'order',
        participants: [userId, 'company_assma'],
        participantNames: {
          [userId]: 'Vous',
          'company_assma': 'Assma Express'
        },
        participantAvatars: {
          [userId]: '👤',
          'company_assma': '🛒'
        },
        lastMessage: 'Votre colis est en route 🚚',
        unreadCount: {
          [userId]: 1,
          'company_assma': 0
        },
        shoppingData: {
          orderId: 'ASMA-12345',
          orderStatus: 'shipped',
          totalAmount: '1,198 DH',
          itemsCount: 2,
          estimatedDelivery: 'Aujourd\'hui, 14h-16h'
        }
      },
      {
        id: 'order_2',
        title: 'Commande #TECH-67890',
        type: 'order',
        participants: [userId, 'company_tech'],
        participantNames: {
          [userId]: 'Vous',
          'company_tech': 'TechStore Maroc'
        },
        participantAvatars: {
          [userId]: '👤',
          'company_tech': '💻'
        },
        lastMessage: 'En préparation ⚙️',
        unreadCount: {
          [userId]: 0,
          'company_tech': 0
        },
        shoppingData: {
          orderId: 'TECH-67890',
          orderStatus: 'processing',
          totalAmount: '899 DH',
          itemsCount: 1,
          estimatedDelivery: 'Demain'
        }
      }
    ];
	
	const socialConversations = [
  {
    id: 'social_1',
    title: 'Tech Trends Live 🚀',
    type: 'live',
    participants: [userId, 'tech_influencer_1', 'tech_influencer_2', 'tech_influencer_3', 'viewer_1', 'viewer_2'],
    participantNames: {
      [userId]: 'Vous',
      'tech_influencer_1': 'Alex Tech',
      'tech_influencer_2': 'Sarah Dev',
      'tech_influencer_3': 'Mike Reviews',
      'viewer_1': 'Viewer 1',
      'viewer_2': 'Viewer 2'
    },
    participantAvatars: {
      [userId]: '👤',
      'tech_influencer_1': '💻',
      'tech_influencer_2': '📱',
      'tech_influencer_3': '🎮',
      'viewer_1': '😊',
      'viewer_2': '🤩'
    },
    lastMessage: 'Live en cours! Nouveaux smartphones 2025 📱🔥',
    unreadCount: {
      [userId]: 15
    },
    socialData: {
      isLive: true,
      liveViewers: 2456,
      lastPostTime: serverTimestamp(),
      isChannel: true,
      channelType: 'public',
      hashtags: ['#tech', '#live', '#smartphone']
    }
  },
  {
    id: 'social_2',
    title: 'Gaming Community 🎮',
    type: 'channel',
    participants: [userId, 'gamer_1', 'gamer_2', 'gamer_3', 'gamer_4', 'gamer_5'],
    participantNames: {
      [userId]: 'Vous',
      'gamer_1': 'Pro Gamer',
      'gamer_2': 'Stream Queen',
      'gamer_3': 'Game Master',
      'gamer_4': 'Casual Player',
      'gamer_5': 'Newbie'
    },
    participantAvatars: {
      [userId]: '👤',
      'gamer_1': '🎮',
      'gamer_2': '👑',
      'gamer_3': '👨‍💻',
      'gamer_4': '😎',
      'gamer_5': '🐣'
    },
    lastMessage: 'Tournament ce soir à 20h! Qui participe? 🏆',
    unreadCount: {
      [userId]: 8
    },
    socialData: {
      isLive: false,
      liveViewers: 0,
      lastPostTime: serverTimestamp(),
      isChannel: true,
      channelType: 'public',
      hashtags: ['#gaming', '#tournament', '#esports']
    }
  },
  {
    id: 'social_3',
    title: 'Sarah Dev',
    type: 'direct',
    participants: [userId, 'sarah_dev'],
    participantNames: {
      [userId]: 'Vous',
      'sarah_dev': 'Sarah Dev'
    },
    participantAvatars: {
      [userId]: '👤',
      'sarah_dev': '👩‍💻'
    },
    lastMessage: 'Salut! Tu as testé le nouveau React Native?',
    unreadCount: {
      [userId]: 3
    },
    socialData: {
      isLive: false,
      isOnline: true,
      lastSeen: serverTimestamp()
    }
  }
];

    // Ajouter toutes les conversations
    const allConversations = [...businessConversations, ...shoppingConversations];
    
    for (const convData of allConversations) {
      const conversationToAdd = {
        ...convData,
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Note: On utilise addDoc pour que Firebase génère l'ID
      const conversationRef = await addDoc(conversationsRef, conversationToAdd);
      
      // Ajouter des messages initiaux
      const messagesRef = collection(db, 'conversations', conversationRef.id, 'messages');
      
      if (convData.type === 'business') {
        // Message de bienvenue
        await addDoc(messagesRef, {
          text: convData.lastMessage,
          senderId: convData.participants[1], // L'entreprise
          senderName: convData.participantNames[convData.participants[1]],
          senderAvatar: convData.participantAvatars[convData.participants[1]],
          timestamp: serverTimestamp(),
          type: 'text',
          readBy: [convData.participants[1]]
        });
      } else if (convData.type === 'order') {
        // Message système pour la commande
        await addDoc(messagesRef, {
          text: `✅ Commande ${convData.shoppingData?.orderId} confirmée\n💰 Total: ${convData.shoppingData?.totalAmount}\n📦 Statut: ${convData.shoppingData?.orderStatus}`,
          senderId: 'system',
          senderName: 'Système',
          senderAvatar: '🤖',
          timestamp: serverTimestamp(),
          type: 'order',
          metadata: {
            orderId: convData.shoppingData?.orderId,
            amount: convData.shoppingData?.totalAmount,
            status: convData.shoppingData?.orderStatus
          },
          readBy: []
        });
      }
      
      console.log(`💬 Conversation créée: ${convData.title}`);
    }

    console.log('🎉 Données initialisées avec succès !');
    return true;
    
  } catch (error) {
    console.error('❌ Erreur initialisation Firebase:', error);
    throw error;
  }
};

// Fonction simple pour tester la connexion
export const testFirebaseConnection = async () => {
  try {
    const conversationsRef = collection(db, 'conversations');
    const snapshot = await getDocs(conversationsRef);
    console.log('📊 Total conversations dans Firestore:', snapshot.size);
    return snapshot.size;
  } catch (error) {
    console.error('❌ Erreur connexion Firestore:', error);
    return 0;
  }
};