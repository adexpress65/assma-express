// 📁 apps/mobile/app/checkout/_layout.tsx - VERSION CORRIGÉE
import React from 'react';
import { Stack } from 'expo-router';

export default function CheckoutLayout() {
  // ============ AUCUN HOOK ICI ============
  // Si vous n'avez pas besoin de useCart(), supprimez-le
  
  // ============ RENDU DIRECT ============
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
          headerBackTitle: 'Livraison', 
          headerBackVisible: true,
        }} 
      />
      <Stack.Screen 
        name="confirmation" 
        options={{ 
          title: 'Confirmation',
          headerShown: false, // Cache le header pour l'écran de confirmation
          headerBackVisible: false,
        }} 
      />
    </Stack>
  );
}
