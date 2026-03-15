// screens/CreateLiveScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLive } from '../contexts/LiveContext';
import { useAuth } from '../contexts/AuthContext';

const CreateLiveScreen = () => {
  const navigation = useNavigation();
  const { createLive } = useLive();
  const { user } = useAuth();
  const [liveData, setLiveData] = useState({
    title: '',
    category: 'talk',
    privacy: 'public'
  });
  const [loading, setLoading] = useState(false);

  const handleCreateLive = async () => {
    if (!liveData.title.trim()) {
      Alert.alert('Erreur', 'Veuillez donner un titre à votre live');
      return;
    }

    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté');
      return;
    }

    setLoading(true);
    try {
      const liveId = await createLive(liveData);
      // Navigation simplifiée
      navigation.navigate('BroadcastScreen' as any, { liveId });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer le live');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Créer un Live</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Titre du live"
        value={liveData.title}
        onChangeText={(text) => setLiveData({...liveData, title: text})}
        maxLength={100}
      />

      <Text style={styles.label}>Catégorie</Text>
      <View style={styles.categoryContainer}>
        {['talk', 'music', 'gaming', 'education', 'entertainment'].map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryButton,
              liveData.category === category && styles.categoryButtonSelected
            ]}
            onPress={() => setLiveData({...liveData, category})}
          >
            <Text style={[
              styles.categoryText,
              liveData.category === category && styles.categoryTextSelected
            ]}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Confidentialité</Text>
      <View style={styles.privacyContainer}>
        {[
          { value: 'public', label: '🌍 Public', desc: 'Tout le monde peut voir' },
          { value: 'followers', label: '🔒 Abonnés', desc: 'Seulement vos abonnés' },
          { value: 'private', label: '👤 Privé', desc: 'Sur invitation seulement' }
        ].map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[
              styles.privacyButton,
              liveData.privacy === item.value && styles.privacyButtonSelected
            ]}
            onPress={() => setLiveData({...liveData, privacy: item.value})}
          >
            <Text style={styles.privacyLabel}>{item.label}</Text>
            <Text style={styles.privacyDesc}>{item.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.createButton, loading && styles.createButtonDisabled]}
        onPress={handleCreateLive}
        disabled={loading}
      >
        <Text style={styles.createButtonText}>
          {loading ? 'Création...' : '🎥 Démarrer le Live'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 10,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  categoryButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 10,
    marginBottom: 10,
  },
  categoryButtonSelected: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  categoryTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  privacyContainer: {
    marginBottom: 30,
  },
  privacyButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  privacyButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  privacyLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  privacyDesc: {
    fontSize: 14,
    color: '#666',
  },
  createButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CreateLiveScreen;
