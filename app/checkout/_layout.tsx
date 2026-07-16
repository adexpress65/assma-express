import React from 'react';
import { Stack } from 'expo-router';

/** CheckoutProvider est monté dans app/_layout.tsx (panier + flux checkout partagent le même contexte). */
export default function CheckoutLayout() {
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
