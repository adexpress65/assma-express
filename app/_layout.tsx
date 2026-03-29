import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { I18nManager, Platform, Alert } from "react-native";
import { PortalProvider } from "@gorhom/portal"; // Ajout pour la gestion des menus superposés

import * as Updates from "expo-updates";
import * as Notifications from "expo-notifications";

// SÉCURITÉ : Vérification pour ExpoDevice
let Device = null;
try {
  Device = require("expo-device");
} catch (e) {
  console.log("ExpoDevice non disponible");
}

import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../src/config/firebase";

import i18n from "../src/services/i18n";

import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { CartProvider } from "../src/contexts/CartContext";
import { OrderProvider } from "../src/contexts/OrderContext";
import { MessagesProvider } from "../src/contexts/MessagesContext";
import { LiveProvider } from "../src/contexts/LiveContext";
import { WebRTCProvider } from "../src/contexts/WebRTCContext";
import { CurrencyProvider } from "../src/contexts/CurrencyContext";

// Configuration du gestionnaire de notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function LanguageDirectionManager({ children }) {
  const { i18n: i18nInstance } = useTranslation();

  useEffect(() => {
    const isArabic = i18nInstance.language === "ar";
    if (isArabic && !I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
      // Note: Un redémarrage est souvent nécessaire pour le RTL natif
    }
  }, [i18nInstance.language]);

  return <>{children}</>;
}

function AppInitializer({ children }) {
  const { user } = useAuth();

  useEffect(() => {
    // --- 1. LOGIQUE DE MISE À JOUR FORCÉE (OTA OPTIMISÉE) ---
    async function checkOTAUpdate() {
      try {
        if (__DEV__) return; 

        const update = await Updates.checkForUpdateAsync();
        
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          
          Alert.alert(
            "Mise à jour installée 🚀",
            "Une nouvelle version de A2Express a été téléchargée. L'application va redémarrer pour appliquer les corrections immédiatement.",
            [
              { 
                text: "Mettre à jour maintenant", 
                onPress: async () => {
                  await Updates.reloadAsync();
                } 
              }
            ],
            { cancelable: false }
          );
        }
      } catch (error) {
        console.log("Erreur lors de la vérification OTA:", error);
      }
    }

    // --- 2. ENREGISTREMENT DU PUSH TOKEN ---
    async function registerPushToken() {
      if (!Device || !Device.isDevice) {
        console.log("Notifications : Uniquement sur appareil physique");
        return;
      }

      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") {
          console.log("Permission de notification refusée");
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: "bb3399ba-97b7-4707-80eb-b524775df88a",
        });
        const token = tokenData.data;

        console.log("--------------------------");
        console.log("TOKEN PUSH A2EXPRESS :", token);
        console.log("--------------------------");

        if (user?.uid) {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
            pushToken: token,
            lastActive: new Date(),
          });
          console.log("Token sauvegardé dans Firestore pour :", user.uid);
        }
      } catch (e) {
        console.log("Erreur enregistrement Token:", e);
      }
    }

    checkOTAUpdate();
    if (user) {
      registerPushToken();
    }
  }, [user]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* PortalProvider enveloppe tout pour permettre aux composants de "sortir" du layout standard */}
      <PortalProvider>
        <SafeAreaProvider>
          <I18nextProvider i18n={i18n}>
            <LanguageDirectionManager>
              <AuthProvider>
                <AppInitializer>
                  <CurrencyProvider>
                    <CartProvider>
                      <OrderProvider>
                        <MessagesProvider>
                          <LiveProvider>
                            <WebRTCProvider>
                              <Stack
                                screenOptions={{
                                  headerShown: false,
                                  animation: "fade",
                                }}
                              />
                            </WebRTCProvider>
                          </LiveProvider>
                        </MessagesProvider>
                      </OrderProvider>
                    </CartProvider>
                  </CurrencyProvider>
                </AppInitializer>
              </AuthProvider>
            </LanguageDirectionManager>
          </I18nextProvider>
        </SafeAreaProvider>
      </PortalProvider>
    </GestureHandlerRootView>
  );
}