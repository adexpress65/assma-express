// src/services/notifications.ts
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Permission refusée pour les notifications');
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  
  // Enregistrer le token dans Firestore
  if (token) {
    await setDoc(doc(db, 'pushTokens', token), {
      token,
      platform: Platform.OS,
      createdAt: new Date()
    });
  }

  return token;
}