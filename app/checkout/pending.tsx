import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase'; 
import { Ionicons } from '@expo/vector-icons';

export default function PendingScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed'>('pending');

  useEffect(() => {
    if (!orderId) return;

    const unsub = onSnapshot(doc(db, "orders", orderId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'paid') { // Détecte le changement du backend
          setStatus('paid');
          setTimeout(() => {
            router.replace({ pathname: '/checkout/confirmation', params: { status: 'success', orderId } });
          }, 2000);
        } else if (data.status === 'failed') {
          setStatus('failed');
        }
      }
    });
    return () => unsub();
  }, [orderId]);

  return (
    <View style={styles.container}>
      {status === 'pending' ? (
        <>
          <ActivityIndicator size="large" color="#FF6A00" />
          <Text style={styles.title}>Vérification du paiement...</Text>
          <Text style={styles.subtitle}>Nous attendons la confirmation de votre banque.</Text>
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
  buttonText: { color: '#FFF', fontWeight: 'bold' }
});