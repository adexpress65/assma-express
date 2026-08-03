/**
 * @file _layout.tsx
 * @description Code source de l'application ASSMA Express.
 * @author Salambéré Askia Mohamed (NEXYORA)
 * @date Juillet 2026
 * 
 * Ce code a été écrit et structuré de bout en bout par Salambéré Askia Mohamed.
 * Toute modification ultérieure doit mentionner l'auteur original.
 */

import {
  registerSentryNavigationContainer,
  wrapRootComponent,
} from "../src/config/sentry";
import { Stack, useNavigationContainerRef, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { AppState, Platform, Alert } from "react-native";
import Constants from "expo-constants";
import { PortalProvider } from "@gorhom/portal"; // Ajout pour la gestion des menus superposés
import * as SplashScreen from "expo-splash-screen";
import * as Font from "expo-font";
import { Ionicons } from "@expo/vector-icons";

import * as Updates from "expo-updates";
import * as Notifications from "expo-notifications";
import { onAuthStateChanged } from "firebase/auth";

// SÉCURITÉ : Vérification pour ExpoDevice
let Device = null;
try {
  Device = require("expo-device");
} catch (e) {
  console.log("ExpoDevice non disponible");
}

import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../src/config/firebase";

import i18n from "../src/services/i18n";
import { applyLayoutDirectionForLanguage } from "../src/utils/layoutDirection";

import { AuthProvider, useAuth } from "../src/contexts/AuthContext";
import { CartProvider } from "../src/contexts/CartContext";
import { CheckoutProvider } from "../src/contexts/CheckoutContext";
import { OrderProvider } from "../src/contexts/OrderContext";
import { MessagesProvider } from "../src/contexts/MessagesContext";
import { LiveProvider } from "../src/contexts/LiveContext";
import { WebRTCProvider } from "../src/contexts/WebRTCContext";
import { CurrencyProvider } from "../src/contexts/CurrencyContext";

// Garde le splash natif visible jusqu'à préparation complète de l'app.
void SplashScreen.preventAutoHideAsync().catch(() => {});

async function waitForI18nReady(timeoutMs = 4000): Promise<void> {
  if (i18n.isInitialized) return;
  await new Promise<void>((resolve) => {
    const onInitialized = () => {
      i18n.off("initialized", onInitialized);
      clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = setTimeout(() => {
      i18n.off("initialized", onInitialized);
      resolve();
    }, timeoutMs);
    i18n.on("initialized", onInitialized);
  });
}

async function prepareApp(): Promise<void> {
  await Promise.allSettled([
    waitForI18nReady(),
    Font.loadAsync(Ionicons.font),
    import("../src/config/firebase"),
  ]);
}

// Configuration du gestionnaire de notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Ouverture conversation / fiche produit quand l’utilisateur tape une notification push. */
function PushNotificationRouter() {
  const router = useRouter();
  const handledColdStart = useRef(false);

  useEffect(() => {
    const openFromNotification = (notification: Notifications.Notification) => {
      const data = notification.request.content
        .data as Record<string, unknown> | undefined;
      if (!data) return;
      const convId = data.conversationId;
      if (typeof convId === "string" && convId.length > 0) {
        router.push(`/conversation/${convId}`);
        return;
      }
      const productId = data.productId;
      if (typeof productId === "string" && productId.length > 0) {
        router.push(`/product/${productId}`);
      }
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        openFromNotification(response.notification);
      },
    );

    const last = Notifications.getLastNotificationResponse();
    if (last?.notification && !handledColdStart.current) {
      handledColdStart.current = true;
      openFromNotification(last.notification);
    }

    return () => subscription.remove();
  }, [router]);

  return null;
}

function LanguageDirectionManager({ children }: { children: ReactNode }) {
  const { i18n: i18nInstance } = useTranslation();

  useEffect(() => {
    applyLayoutDirectionForLanguage(i18nInstance.language);
  }, [i18nInstance.language]);

  return <>{children}</>;
}

function AppInitializer({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUid(nextUser?.uid ?? null);
    });
    return unsubscribe;
  }, []);

  const registerPushToken = useCallback(async () => {
    if (!Device || !Device.isDevice) {
      console.log("Notifications : Uniquement sur appareil physique");
      return;
    }

    if (!uid) return;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.warn(
          "[push] Permission notifications refusée — activez-les dans Réglages > A2Express pour recevoir les alertes.",
        );
        return;
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "A2Express",
          importance: Notifications.AndroidImportance.MAX,
          sound: "default",
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      const easExtra = Constants.expoConfig?.extra as
        | { eas?: { projectId?: string } }
        | undefined;
      const projectId =
        easExtra?.eas?.projectId ??
        (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
        "bb3399ba-97b7-4707-80eb-b524775df88a";

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      console.log("--------------------------");
      console.log("TOKEN PUSH A2EXPRESS :", token);
      console.log("--------------------------");

      const userRef = doc(db, "users", uid);
      try {
        await updateDoc(userRef, {
          pushToken: token,
          lastActive: serverTimestamp(),
        });
      } catch (error) {
        await setDoc(userRef, {
          pushToken: token,
          lastActive: serverTimestamp(),
          role: "customer",
        }, { merge: true });
      }
      console.log("Token push enregistré (Firestore) pour :", uid);
    } catch (e) {
      console.warn("[push] Erreur enregistrement token :", e);
    }
  }, [uid]);

  useEffect(() => {
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
                },
              },
            ],
            { cancelable: false },
          );
        }
      } catch (error) {
        console.log("Erreur lors de la vérification OTA:", error);
      }
    }

    void checkOTAUpdate();
    if (uid) {
      void registerPushToken();
    }
  }, [uid, registerPushToken]);

  useEffect(() => {
    if (!uid) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void registerPushToken();
      }
    });
    return () => sub.remove();
  }, [uid, registerPushToken]);

  return <>{children}</>;
}

/** Composant intermédiaire pour injecter l'utilisateur connecté dans MessagesProvider */
function AuthenticatedProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <MessagesProvider user={user}>
      <LiveProvider>
        <WebRTCProvider>
          {children}
        </WebRTCProvider>
      </LiveProvider>
    </MessagesProvider>
  );
}

function RootLayout() {
  const navigationRef = useNavigationContainerRef();
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const bootstrap = async () => {
      await prepareApp();
      if (isMounted) {
        setIsAppReady(true);
      }
    };
    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    registerSentryNavigationContainer(navigationRef);
  }, [navigationRef]);

  const onLayoutRootView = useCallback(async () => {
    if (!isAppReady) return;
    await SplashScreen.hideAsync();
  }, [isAppReady]);

  if (!isAppReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <PortalProvider>
        <SafeAreaProvider>
          <I18nextProvider i18n={i18n}>
            <LanguageDirectionManager>
              <AuthProvider>
                <PushNotificationRouter />
                <AppInitializer>
                  <CurrencyProvider>
                    <CartProvider>
                      <CheckoutProvider>
                        <OrderProvider>
                          <AuthenticatedProviders>
                            <Stack
                              screenOptions={{
                                headerShown: false,
                                animation: "fade",
                              }}
                            >
                              <Stack.Screen
                                name="profile"
                                options={{
                                  headerShown: false,
                                  animation: "slide_from_right",
                                }}
                              />
                            </Stack>
                          </AuthenticatedProviders>
                        </OrderProvider>
                      </CheckoutProvider>
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

export default wrapRootComponent(RootLayout);