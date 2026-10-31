// app/components/supplier/ContactSupplier.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface ContactSupplierProps {
  supplier: {
    id: string;
    name: string;
    logo: string;
    responseTime: string;
    responseRate: number;
  };
  currentUser?: {
    uid: string;
    displayName: string | null;
    photoURL: string | null;
  };
}

export default function ContactSupplier({ supplier, currentUser }: ContactSupplierProps) {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const defaultMessages = [
    "Bonjour, je suis intéressé par vos produits. Pouvez-vous me envoyer plus d'informations ?",
    "Je souhaite obtenir un devis pour une commande en gros.",
    "Quelles sont vos conditions de livraison pour mon pays ?",
    "Avez-vous des échantillons disponibles ?",
    "Pouvez-vous me donner plus de détails sur les spécifications techniques ?"
  ];

  const handleContactPress = () => {
    if (!currentUser) {
      // Rediriger vers la page de connexion
      Alert.alert(
        'Connexion requise',
        'Veuillez vous connecter pour contacter ce fournisseur',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se connecter', onPress: () => router.push('/login') }
        ]
      );
      return;
    }
    setModalVisible(true);
  };

  const startConversation = async (customMessage?: string) => {
    if (!currentUser) {
      Alert.alert('Connexion requise', 'Veuillez vous connecter pour contacter ce fournisseur');
      return;
    }

    setLoading(true);
    try {
      const finalMessage = customMessage || message;
      
      if (!finalMessage.trim()) {
        Alert.alert('Message requis', 'Veuillez saisir un message');
        return;
      }

      // Ici vous intégrerez Firebase plus tard
      // Pour l'instant, simulation d'envoi
      
      Alert.alert(
        'Message envoyé !',
        `Votre message a été envoyé à ${supplier.name}. Ils vous répondront dans les ${supplier.responseTime}.`,
        [{ text: 'OK', onPress: () => setModalVisible(false) }]
      );

      setMessage('');
      
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer le message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Boutons d'action rapide */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton]}
          onPress={handleContactPress}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
          <Text style={styles.primaryButtonText}>Discuter maintenant</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
          <Ionicons name="call" size={20} color="#007AFF" />
          <Text style={styles.secondaryButtonText}>Appeler</Text>
        </TouchableOpacity>
      </View>

      {/* Statistiques de réponse */}
      <View style={styles.responseStats}>
        <Text style={styles.statText}>
          ⏱️ Temps de réponse: <Text style={styles.statValue}>{supplier.responseTime}</Text>
        </Text>
        <Text style={styles.statText}>
          📞 Taux de réponse: <Text style={styles.statValue}>{supplier.responseRate}%</Text>
        </Text>
      </View>

      {/* Modal de contact */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contacter {supplier.name}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.sectionTitle}>Messages prédéfinis</Text>
              
              {defaultMessages.map((msg, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.defaultMessage}
                  onPress={() => startConversation(msg)}
                >
                  <Text style={styles.defaultMessageText}>{msg}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.sectionTitle}>Ou écrivez votre message</Text>
              
              <TextInput
                style={[styles.input, styles.textArea]}
                value={message}
                onChangeText={setMessage}
                placeholder="Décrivez votre demande, posez vos questions..."
                multiline
                numberOfLines={4}
              />

              <TouchableOpacity
                style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                onPress={() => startConversation()}
                disabled={loading}
              >
                <Text style={styles.sendButtonText}>
                  {loading ? 'Envoi...' : 'Envoyer le message'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#fff',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  responseStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  statValue: {
    fontWeight: '600',
    color: '#333',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalBody: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  defaultMessage: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  defaultMessageText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
