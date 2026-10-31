import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function PaymentCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    console.log('[PaymentCallback] Paramètres reçus:', params);

    const orderId =
      firstParam(params.orderId as string | string[] | undefined) ??
      firstParam(params.reference as string | string[] | undefined) ??
      firstParam(params.ref as string | string[] | undefined);

    // Le callback ne prouve rien : la vérification serveur se fait dans /checkout/pending.
    if (orderId) {
      router.replace({
        pathname: '/checkout/pending',
        params: { orderId },
      });
      return;
    }

    console.log('[PaymentCallback] Aucun identifiant de commande, retour au panier');
    router.replace('/cart');
  }, [params, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#FF6A00" />
      <Text style={{ marginTop: 16 }}>Traitement du paiement...</Text>
    </View>
  );
}
