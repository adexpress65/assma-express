import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import { I18nManager } from 'react-native';

// ✅ IMPORT I18N
import i18n from "../src/services/i18n";

// CONTEXTS
import { AuthProvider } from "../src/contexts/AuthContext";
import { CartProvider } from "../src/contexts/CartContext";
import { OrderProvider } from "../src/contexts/OrderContext";
import { MessagesProvider } from "../src/contexts/MessagesContext";
import { LiveProvider } from "../src/contexts/LiveContext";
import { WebRTCProvider } from "../src/contexts/WebRTCContext";
import { CurrencyProvider } from "../src/contexts/CurrencyContext"; // ✅ NOUVEAU

function LanguageDirectionManager({ children }: { children: React.ReactNode }) {
  const { i18n: i18nInstance } = useTranslation();
  
  useEffect(() => {
    const isArabic = i18nInstance.language === 'ar';
    
    if (isArabic && !I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
    
    console.log(`🌐 Language: ${i18nInstance.language}`);
  }, [i18nInstance.language]);
  
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <LanguageDirectionManager>
            <AuthProvider>
              {/* ✅ AJOUT DU CURRENCY PROVIDER ICI */}
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
            </AuthProvider>
          </LanguageDirectionManager>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}