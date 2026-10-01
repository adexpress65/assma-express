import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useSegments } from 'expo-router';
import { useOtaUpdate, type OtaStatus } from '../../src/contexts/OtaUpdateContext';

/** 'payment' inclus : une entrée directe (deep link) ne doit pas déclencher de reload pendant la saisie carte. */
const PAYMENT_IN_FLIGHT_SCREENS = new Set([
  'payment',
  'payment-webview',
  'pending',
  'confirmation',
]);

/** Seuls ces statuts signifient qu'une mise à jour existe réellement et va être appliquée. */
const BLOCKING_STATUSES = new Set<OtaStatus>(['downloading', 'pending-reload']);

/** CheckoutProvider est monté dans app/_layout.tsx (panier + flux checkout partagent le même contexte). */
export default function CheckoutLayout() {
  const segments = useSegments();
  const screen = segments[segments.length - 1] ?? 'index';
  const paymentInFlight = PAYMENT_IN_FLIGHT_SCREENS.has(String(screen));
  const { status, ensureCheckoutReady } = useOtaUpdate();
  const [gateOpen, setGateOpen] = useState(paymentInFlight);

  useEffect(() => {
    if (paymentInFlight) {
      setGateOpen(true);
      return;
    }
    let live = true;
    setGateOpen(false);
    void (async () => {
      const ok = await ensureCheckoutReady();
      if (live) setGateOpen(ok);
    })();
    return () => {
      live = false;
    };
  }, [ensureCheckoutReady, paymentInFlight]);

  const blocking = !paymentInFlight && !gateOpen && BLOCKING_STATUSES.has(status);

  if (blocking) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator size="large" color="#FF6A00" />
        <Text style={styles.gateTitle}>Mise à jour de l’application</Text>
        <Text style={styles.gateHint}>
          Une version plus récente est en cours d’installation. L’application va redémarrer,
          puis vous pourrez reprendre votre paiement.
        </Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTintColor: '#1a1a1a',
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: '#f8f9fa',
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Adresse de livraison',
          headerBackTitle: 'Panier',
          headerBackVisible: true,
        }} 
      />
      <Stack.Screen 
        name="shipping" 
        options={{ 
          title: 'Mode de livraison',
          headerBackTitle: 'Adresse',
          headerBackVisible: true,
        }} 
      />
      <Stack.Screen 
        name="payment" 
        options={{ 
          title: 'Paiement sécurisé',
          headerBackTitle: 'À confirmer', 
          headerBackVisible: true,
        }} 
      />
      <Stack.Screen
        name="payment-webview"
        options={{
          title: 'Paiement sécurisé',
          headerShown: false,
          gestureEnabled: false,
          headerBackVisible: false,
        }}
      />
      <Stack.Screen
        name="pending"
        options={{
          title: 'Vérification du paiement',
          headerBackTitle: 'Retour',
        }}
      />
      <Stack.Screen 
        name="confirmation" 
        options={{ 
          title: 'Confirmation',
          headerShown: false,
          headerBackVisible: false,
        }} 
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    backgroundColor: '#FFFAF5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  gateTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    textAlign: 'center',
  },
  gateHint: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#718096',
    textAlign: 'center',
  },
});
