import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase'; 
import { Ionicons } from '@expo/vector-icons';
import { isOrderPaymentConfirmed } from '@/features/super-admin/orders/orderPayment';

function normalizeOrderIdParam(
  raw: string | string[] | undefined,
): string | undefined {
  if (raw == null) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

/** Paiement refusé, annulé ou commande supprimée côté flux paiement. */
function isFailedLike(status: unknown, paymentStatus?: unknown): boolean {
  const s = String(status ?? '').toLowerCase().trim();
  const ps = String(paymentStatus ?? '').toLowerCase().trim();
  return (
    s === 'failed' ||
    s === 'cancelled' ||
    s === 'canceled' ||
    s === 'payment_failed' ||
    s === 'payment_cancelled' ||
    ps === 'failed' ||
    ps === 'cancelled' ||
    ps === 'canceled' ||
    ps === 'payment_failed' ||
    ps === 'payment_cancelled' ||
    ps === 'declined' ||
    ps === 'rejected'
  );
}

export default function PendingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string | string[] }>();
  const orderId = normalizeOrderIdParam(params.orderId);
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed'>('pending');

  useEffect(() => {
    if (!orderId) return;

    const orderRef = doc(db, "orders", orderId);

    const unsub = onSnapshot(orderRef, (docSnap) => {
      if (!docSnap.exists()) {
        setStatus("failed");
        return;
      }

      const data = docSnap.data();
      const st = data?.status;
      const paymentStatus = data?.paymentStatus ?? data?.paymentState;

      if (isOrderPaymentConfirmed(data as Record<string, unknown>)) {
        setStatus("paid");

        setTimeout(() => {
          router.replace({
            pathname: "/checkout/confirmation",
            params: { status: "success", orderId },
          });
        }, 2000);
      } else if (isFailedLike(st, paymentStatus)) {
        setStatus("failed");
      }
    });

    return () => {
      unsub();
    };
  }, [orderId, router]);

  return (
    <View style={styles.container}>
      {status === 'pending' ? (
        <>
          <ActivityIndicator size="large" color="#FF6A00" />
          <Text style={styles.title}>Vérification du paiement...</Text>
          <Text style={styles.subtitle}>Nous attendons la confirmation de votre banque.</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              router.replace({
                pathname: '/checkout/confirmation',
                params: { status: 'cancel', orderId: orderId ?? '' },
              })
            }
          >
            <Text style={styles.secondaryButtonText}>
              J’ai quitté ou annulé le paiement
            </Text>
          </TouchableOpacity>
        </>
      ) : status === 'paid' ? (
        <>
          <Ionicons name="checkmark-circle" size={80} color="#28A745" />
          <Text style={[styles.title, { color: '#28A745' }]}>Paiement Reçu !</Text>
        </>
      ) : (
        <>
          <Ionicons name="close-circle" size={80} color="#DC3545" />
          <Text style={[styles.title, { color: '#DC3545' }]}>Paiement Refusé</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/cart')}>
            <Text style={styles.buttonText}>Retour au panier</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginTop: 20 },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 10 },
  button: { backgroundColor: '#FF6A00', padding: 15, borderRadius: 10, marginTop: 20 },
  buttonText: { color: '#FFF', fontWeight: 'bold' },
  secondaryButton: { marginTop: 28, paddingVertical: 12, paddingHorizontal: 16 },
  secondaryButtonText: {
    color: '#718096',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
