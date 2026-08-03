import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface QuickChatModalProps {
  visible: boolean;
  onClose: () => void;
  productTitle?: string;
  vendorName?: string;
  onSendMessage: (message: string) => void;
}

export const QuickChatModal: React.FC<QuickChatModalProps> = ({
  visible,
  onClose,
  productTitle,
  vendorName = "Gérant de la boutique",
  onSendMessage,
}) => {
  const [message, setMessage] = useState('');

  // Messages prédéfinis pour accélérer la saisie de l'utilisateur
  const quickMessages = [
    "Bonjour, ce produit est-il toujours disponible ?",
    "Quels sont les délais de livraison ?",
    "Proposez-vous un prix réduit pour les achats en gros ?",
  ];

  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message);
    setMessage('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalWrapper}
      >
        <View style={styles.modalContainer}>
          {/* Poignée supérieure */}
          <View style={styles.dragHandle} />

          {/* En-tête */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Discuter avec le vendeur</Text>
              <Text style={styles.subtitle}>{vendorName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Badge rappel du produit */}
          {productTitle && (
            <View style={styles.productBadge}>
              <Ionicons name="cube-outline" size={16} color="#FF6B00" />
              <Text style={styles.productTitle} numberOfLines={1}>
                {productTitle}
              </Text>
            </View>
          )}

          {/* Suggestions rapides */}
          <Text style={styles.sectionTitle}>Suggestions rapides :</Text>
          <View style={styles.quickChipsContainer}>
            {quickMessages.map((text, index) => (
              <TouchableOpacity
                key={index}
                style={styles.chip}
                onPress={() => setMessage(text)}
              >
                <Text style={styles.chipText}>{text}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Zone de saisie */}
          <TextInput
            style={styles.input}
            placeholder="Écrivez votre message..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            value={message}
            onChangeText={setMessage}
          />

          {/* Bouton d'envoi */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              !message.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!message.trim()}
          >
            <Ionicons name="paper-plane-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.sendButtonText}>Envoyer le message</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalWrapper: {
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  productBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 15,
  },
  productTitle: {
    fontSize: 13,
    color: '#FF6B00',
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  quickChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipText: {
    fontSize: 12,
    color: '#374151',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    textAlignVertical: 'top',
    minHeight: 80,
    marginBottom: 15,
  },
  sendButton: {
    backgroundColor: '#FF6B00',
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#FFC499',
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});