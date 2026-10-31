import { db } from '../config/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  increment,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';

export class LiveStreamService {
  private static instance: LiveStreamService;

  static getInstance(): LiveStreamService {
    if (!LiveStreamService.instance) {
      LiveStreamService.instance = new LiveStreamService();
    }
    return LiveStreamService.instance;
  }

  // 🔥 CRÉER UN LIVE
  async createLiveStream(liveData: {
    hostId: string;
    hostName: string;
    hostAvatar: string;
    title: string;
    category: string;
    privacy?: string;
    chatEnabled?: boolean;
    giftsEnabled?: boolean;
  }): Promise<string> {
    try {
      console.log('🎥 Début création live...', liveData);

      const liveDoc = {
        ...liveData,
        isLive: true,
        viewersCount: 1,
        likesCount: 0,
        giftsCount: 0,
        startTime: serverTimestamp(),
        endTime: null,
        privacy: liveData.privacy || 'public',
        chatEnabled: liveData.chatEnabled ?? true,
        giftsEnabled: liveData.giftsEnabled ?? true,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'lives'), liveDoc);
      
      console.log('✅ Live créé avec ID:', docRef.id);

      // Ajouter le host comme viewer
      await this.addViewer(docRef.id, liveData.hostId, liveData.hostName);
      
      // Message de bienvenue
      await this.sendSystemMessage(docRef.id, '🎬 Le live a commencé !');

      return docRef.id;
    } catch (error) {
      console.error('❌ Erreur création live:', error);
      throw error;
    }
  }

  // 🔥 REJOINDRE UN LIVE
  async joinLiveStream(liveId: string, userId: string, userName: string): Promise<void> {
    try {
      console.log('🎯 Rejoindre le live:', { liveId, userId, userName });

      const liveRef = doc(db, 'lives', liveId);
      
      // Vérifier si le live existe et est actif
      const liveSnap = await getDoc(liveRef);
      if (!liveSnap.exists()) {
        throw new Error('Live non trouvé');
      }
      
      const liveData = liveSnap.data();
      if (!liveData?.isLive) {
        throw new Error('Ce live est terminé');
      }

      // Incrémenter le compteur de viewers
      await updateDoc(liveRef, {
        viewersCount: increment(1)
      });

      // Ajouter l'utilisateur comme viewer
      await this.addViewer(liveId, userId, userName);

      // Message système
      await this.sendSystemMessage(liveId, `👋 ${userName} a rejoint le live`);

      console.log('✅ Utilisateur a rejoint le live');
    } catch (error) {
      console.error('❌ Erreur rejoindre live:', error);
      throw error;
    }
  }

  // 🔥 QUITTER UN LIVE
  async leaveLiveStream(liveId: string, userId: string): Promise<void> {
    try {
      console.log('🚪 Quitter le live:', { liveId, userId });

      const liveRef = doc(db, 'lives', liveId);
      
      // Décrémenter le compteur
      await updateDoc(liveRef, {
        viewersCount: increment(-1)
      });

      console.log('✅ Utilisateur a quitté le live');
    } catch (error) {
      console.error('❌ Erreur quitter live:', error);
      throw error;
    }
  }

  // 🔥 ARRÊTER UN LIVE
  async stopLiveStream(liveId: string): Promise<void> {
    try {
      console.log('🛑 Arrêt du live:', liveId);

      const liveRef = doc(db, 'lives', liveId);
      
      await updateDoc(liveRef, {
        isLive: false,
        endTime: serverTimestamp()
      });

      await this.sendSystemMessage(liveId, '📴 Le live est terminé. Merci à tous !');

      console.log('✅ Live arrêté avec succès');
    } catch (error) {
      console.error('❌ Erreur arrêt live:', error);
      throw error;
    }
  }

  // 🔥 ENVOYER UN MESSAGE
  async sendMessage(liveId: string, messageData: {
    userId: string;
    userName: string;
    userAvatar: string;
    text: string;
    type?: 'text' | 'gift' | 'system';
  }): Promise<void> {
    try {
      if (!messageData.text.trim()) return;

      console.log('💬 Envoi message:', { 
        liveId, 
        user: messageData.userName, 
        text: messageData.text 
      });

      await addDoc(collection(db, 'lives', liveId, 'messages'), {
        ...messageData,
        timestamp: serverTimestamp(),
        type: messageData.type || 'text'
      });

      console.log('✅ Message envoyé');
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
      throw error;
    }
  }

  // 🔥 ENVOYER UN CADEAU
  async sendGift(liveId: string, giftData: {
    fromUserId: string;
    fromUserName: string;
    toHostId: string;
    giftType: 'heart' | 'confetti' | 'star' | 'crown';
    giftValue: number;
  }): Promise<void> {
    try {
      console.log('🎁 Envoi cadeau:', { 
        liveId, 
        fromUser: giftData.fromUserName, 
        giftType: giftData.giftType,
        value: giftData.giftValue
      });

      const liveRef = doc(db, 'lives', liveId);
      
      // Ajouter le gift à la collection user_gifts
      await addDoc(collection(db, 'user_gifts'), {
        ...giftData,
        toLiveId: liveId,
        timestamp: serverTimestamp()
      });

      // Mettre à jour les stats du live
      await updateDoc(liveRef, {
        giftsCount: increment(1),
        likesCount: increment(giftData.giftValue)
      });

      // Envoyer un message système
      await this.sendMessage(liveId, {
        userId: 'system',
        userName: 'Système',
        userAvatar: '🎁',
        text: `${giftData.fromUserName} a envoyé un ${this.getGiftEmoji(giftData.giftType)} ! (+${giftData.giftValue} ❤️)`,
        type: 'gift'
      });

      console.log('✅ Cadeau envoyé avec succès');
    } catch (error) {
      console.error('❌ Erreur envoi cadeau:', error);
      throw error;
    }
  }

  // 🔥 AIMER UN LIVE
  async likeLive(liveId: string): Promise<void> {
    try {
      console.log('❤️ Like du live:', liveId);

      const liveRef = doc(db, 'lives', liveId);
      await updateDoc(liveRef, {
        likesCount: increment(1)
      });

      console.log('✅ Live liké');
    } catch (error) {
      console.error('❌ Erreur like live:', error);
      throw error;
    }
  }

  // 🔥 ÉCOUTER LES LIVES ACTIFS
  listenToActiveLives(callback: (lives: any[]) => void): () => void {
    console.log('📡 Démarrage écoute des lives actifs...');

    const q = query(
      collection(db, 'lives'),
      where('isLive', '==', true),
      orderBy('startTime', 'desc')
    );

    return onSnapshot(q, 
      (snapshot) => {
        const lives = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('🔴 Lives actifs mis à jour:', lives.length);
        callback(lives);
      },
      (error) => {
        console.error('❌ Erreur écoute lives actifs:', error);
      }
    );
  }

  // 🔥 ÉCOUTER LES MESSAGES D'UN LIVE
  listenToLiveMessages(liveId: string, callback: (messages: any[]) => void): () => void {
    console.log('💬 Démarrage écoute des messages pour live:', liveId);

    const q = query(
      collection(db, 'lives', liveId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    return onSnapshot(q, 
      (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log('📨 Messages mis à jour:', messages.length);
        callback(messages);
      },
      (error) => {
        console.error('❌ Erreur écoute messages:', error);
      }
    );
  }

  // 🔥 ÉCOUTER LES STATS D'UN LIVE
  listenToLiveStats(liveId: string, callback: (stats: any) => void): () => void {
    console.log('📊 Démarrage écoute des stats pour live:', liveId);

    const liveRef = doc(db, 'lives', liveId);

    return onSnapshot(liveRef, 
      (doc) => {
        if (doc.exists()) {
          const stats = doc.data();
          console.log('📈 Stats mises à jour:', stats);
          callback(stats);
        }
      },
      (error) => {
        console.error('❌ Erreur écoute stats:', error);
      }
    );
  }

  // 🔥 RÉCUPÉRER UN LIVE PAR ID
  async getLiveById(liveId: string): Promise<any> {
    try {
      const liveDoc = await getDoc(doc(db, 'lives', liveId));
      if (liveDoc.exists()) {
        return { id: liveDoc.id, ...liveDoc.data() };
      }
      return null;
    } catch (error) {
      console.error('❌ Erreur récupération live:', error);
      throw error;
    }
  }

  // 🎯 MÉTHODES PRIVÉES
  private async addViewer(liveId: string, userId: string, userName: string): Promise<void> {
    try {
      await addDoc(collection(db, 'lives', liveId, 'viewers'), {
        userId,
        userName,
        joinedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('❌ Erreur ajout viewer:', error);
    }
  }

  private async sendSystemMessage(liveId: string, text: string): Promise<void> {
    try {
      await this.sendMessage(liveId, {
        userId: 'system',
        userName: 'Système',
        userAvatar: '🔔',
        text,
        type: 'system'
      });
    } catch (error) {
      console.error('❌ Erreur message système:', error);
    }
  }

  private getGiftEmoji(giftType: string): string {
    const emojis: { [key: string]: string } = {
      heart: '❤️',
      confetti: '🎉',
      star: '⭐',
      crown: '👑'
    };
    return emojis[giftType] || '🎁';
  }

  // 🧪 MÉTHODE DE TEST
  async testLiveSystem(userId: string, userName: string, userAvatar: string = ''): Promise<string> {
    try {
      console.log('🧪 Début test système live...');
      
      // Créer un live de test
      const liveId = await this.createLiveStream({
        hostId: userId,
        hostName: userName,
        hostAvatar: userAvatar,
        title: '🧪 Live de Test - ' + new Date().toLocaleTimeString(),
        category: 'talk',
        privacy: 'public'
      });

      // Attendre un peu
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Envoyer un message de test
      await this.sendMessage(liveId, {
        userId,
        userName,
        userAvatar,
        text: 'Salut ! Ceci est un message de test 🚀'
      });

      // Envoyer un cadeau de test
      await this.sendGift(liveId, {
        fromUserId: userId,
        fromUserName: userName,
        toHostId: userId,
        giftType: 'heart',
        giftValue: 10
      });

      console.log('✅ Test système live terminé avec succès!');
      return liveId;

    } catch (error) {
      console.error('❌ Échec test système live:', error);
      throw error;
    }
  }
}

const liveService = new LiveStreamService();
export { liveService };
