import React from 'react';
import { Stack } from 'expo-router';

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
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Adresse de livraison',
          headerBackTitle: 'Panier'
        }} 
      />
      <Stack.Screen 
        name="shipping" 
        options={{ 
          title: 'Mode de livraison',
          headerBackTitle: 'Adresse'
        }} 
      />
      <Stack.Screen 
        name="payment" 
        options={{ 
          title: 'Paiement sÃƒÂ©curisÃƒÂ©',
          headerBackTitle: 'Livraison'
        }} 
      />
      <Stack.Screen 
        name="confirmation" 
        options={{ 
          title: 'Confirmation',
          headerBackTitle: 'Accueil',
          headerShown: false
        }} 
      />
    </Stack>
  );
}
