// âœ… Doit Ãªtre le premier import pour les gestures
import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { Stack, SplashScreen } from 'expo-router';

// âœ… Hooks et Contexts
import { useFirstLaunch } from '../src/hooks/useFirstLaunch';
import { AuthProvider } from '../src/contexts/AuthContext';
import { CartProvider } from '../src/contexts/CartContext';
import { MessagesProvider } from '../src/contexts/MessagesContext';
import { LiveProvider } from '../src/contexts/LiveContext';
import { AgoraProvider } from '../src/contexts/AgoraContext';

// âœ… EmpÃªche le splash de disparaÃ®tre trop tÃ´t
SplashScreen.preventAutoHideAsync();

export default function RootLayout(): JSX.Element | null {
  const { isFirstLaunch, isLoading } = useFirstLaunch();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isLoading]);

  // ðŸ•“ Pendant le chargement, ne rien afficher
  if (isLoading) return null;

  // âœ… Tous les Providers centralisÃ©s ici
  const ProvidersWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AuthProvider>
      <CartProvider>
        <MessagesProvider>
          <LiveProvider>
            <AgoraProvider>{children}</AgoraProvider>
          </LiveProvider>
        </MessagesProvider>
      </CartProvider>
    </AuthProvider>
  );

  return (
    <ProvidersWrapper>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#fff' },
        }}
      >
        {/* âœ… Routes conditionnelles */}
        {isFirstLaunch ? (
          <Stack.Screen name="intro" />
        ) : (
          <Stack.Screen name="(tabs)" />
        )}

        {/* âœ… Routes modales */}
        <Stack.Screen name="live-broadcast" options={{ presentation: 'modal' }} />

        {/* âœ… Routes dynamiques */}
        <Stack.Screen name="conversation/[id]" />
        <Stack.Screen name="stories/[id]" />
        <Stack.Screen name="watch-live" />
        <Stack.Screen name="video-call" />
        <Stack.Screen name="call/[id]" />

        {/* âœ… Routes principales */}
        <Stack.Screen name="become-seller" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="category-products" />
        <Stack.Screen name="checkout-old" />
        <Stack.Screen name="global-suppliers" />
        <Stack.Screen name="index" />
        <Stack.Screen name="product-detail" />
        <Stack.Screen name="search" />
        <Stack.Screen name="suppliers" />
        <Stack.Screen name="addresses/add" />
        <Stack.Screen name="addresses/index" />
        <Stack.Screen name="admin/dashboard" />
        <Stack.Screen name="app/seller/dashboard" />
        <Stack.Screen name="buyer/dashboard" />
        <Stack.Screen name="categories/index" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="coupons/index" />
        <Stack.Screen name="favorites/index" />
        <Stack.Screen name="live/broadcast" />
        <Stack.Screen name="orders/index" />
        <Stack.Screen name="payment/index" />
        <Stack.Screen name="products/[id]" />
        <Stack.Screen name="products/trending" />
        <Stack.Screen name="seller/add-product" />
        <Stack.Screen name="seller/analytics" />
        <Stack.Screen name="seller/dashboard" />
        <Stack.Screen name="seller/promotions" />
        <Stack.Screen name="super-admin/dashboard" />
        <Stack.Screen name="support/index" />
        <Stack.Screen name="warranty/index" />

        {/* âœ… Page 404 */}
        <Stack.Screen name="+not-found" />
      </Stack>
    </ProvidersWrapper>
  );
}

