import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useEffect } from 'react';

/**
 * MODE SAFE
 * - Aucune permission auto
 * - Aucun push token
 * - Aucune dépendance EAS
 * - Notifications locales uniquement
 */
const SAFE_NOTIFICATIONS = true;

/* ==============================
   CONFIG GLOBALE (SAFE)
================================ */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/* ==============================
   SERVICE MINIMAL
================================ */
export class NotificationService {
  /**
   * Notification locale simple (SAFE)
   */
  static async notify(title: string, body: string, data?: any) {
    if (!SAFE_NOTIFICATIONS) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
        },
        trigger: null,
      });
    } catch (e) {
      console.log('🔕 Notification ignorée (safe mode)');
    }
  }
}

/* ==============================
   HOOK NON BLOQUANT
================================ */
export function useNotificationHandler() {
  useEffect(() => {
    if (!SAFE_NOTIFICATIONS) return;

    // Android channel (obligatoire mais non bloquant)
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      }).catch(() => {});
    }

    // AUCUN listener
    // AUCUNE permission
    // AUCUN token
  }, []);

  return {};
}
