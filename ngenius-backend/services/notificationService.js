import { Expo } from 'expo-server-sdk';
import { db } from './firebaseAdmin.js';

const expo = new Expo();

export const sendNotificationToUser = async (userId, title, body, data = {}) => {
  try {
    // 1. Récupérer le token dans Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log(`❌ Utilisateur ${userId} non trouvé dans Firestore`);
      return;
    }

    const pushToken = userDoc.data().pushToken;

    // 2. Vérification du token
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      console.log(`⚠️ Token invalide pour ${userId}`);
      return;
    }

    // 3. Construction du message
    const messages = [{
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
      priority: 'high',
    }];

    // 4. Envoi
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      console.log("✅ Notification A2Express envoyée :", tickets);
    }

  } catch (error) {
    console.error("🔥 Erreur Service Notification :", error);
  }
};