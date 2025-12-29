import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

// CONTEXTS
import { AuthProvider } from "../src/contexts/AuthContext";
import { CartProvider } from "../src/contexts/CartContext";
import { OrderProvider } from "../src/contexts/OrderContext";
import { MessagesProvider } from "../src/contexts/MessagesContext";
import { LiveProvider } from "../src/contexts/LiveContext";
import { AgoraProvider } from "../src/contexts/AgoraContext";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <OrderProvider>
              <MessagesProvider>
                <LiveProvider>
                  <AgoraProvider>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        animation: "none",
                      }}
                    >
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="+not-found" />
                    </Stack>
                  </AgoraProvider>
                </LiveProvider>
              </MessagesProvider>
            </OrderProvider>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
