// components/TestLiveSystem.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLive } from '../contexts/LiveContext';
import { useAuth } from '../contexts/AuthContext';

const TestLiveSystem = () => {
  const { activeLives, createLive, liveService } = useLive();
  const { user } = useAuth();

  const testCreateLive = async () => {
    if (!user) {
      Alert.alert('Erreur', 'Utilisateur non connecté');
      return;
    }

    try {
      const liveId = await liveService.testLiveSystem(
        user.uid, 
        user.displayName || 'Test User',
        user.photoURL || ''
      );
      Alert.alert('Succès', `Live créé: ${liveId}`);
    } catch (error) {
      Alert.alert('Erreur', 'Échec du test');
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test du système Live</Text>
      <Text>Lives actifs: {activeLives.length}</Text>
      <Text>Utilisateur: {user?.email}</Text>
      
      <TouchableOpacity style={styles.testButton} onPress={testCreateLive}>
        <Text style={styles.testButtonText}>🧪 Tester la création de live</Text>
      </TouchableOpacity>

      {activeLives.map((live) => (
        <View key={live.id} style={styles.liveItem}>
          <Text>{live.title}</Text>
          <Text>Spectateurs: {live.viewersCount}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  testButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    marginVertical: 10,
  },
  testButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  liveItem: {
    backgroundColor: '#fff',
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
  },
});

export default TestLiveSystem;