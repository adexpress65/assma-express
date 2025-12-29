// components/WholesaleQuoteForm.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
  ActivityIndicator,
  Linking  // ← AJOUTEZ CETTE IMPORTATION
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#FF6A00',
  primaryLight: '#FFF0E6',
  white: '#FFFFFF',
  text: '#2D3748',
  textLight: '#718096',
  border: '#E2E8F0',
  success: '#28A745',
  error: '#DC3545'
};

interface WholesaleQuoteFormProps {
  productName?: string;
  productId?: string;
  visible: boolean;
  onClose: () => void;
}

export default function WholesaleQuoteForm({ 
  productName, 
  productId,
  visible, 
  onClose 
}: WholesaleQuoteFormProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    company: '',
    quantity: '',
    deliveryAddress: '',
    specialRequirements: '',
    budget: ''
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      Alert.alert('Champs requis', 'Veuillez remplir les informations obligatoires');
      return;
    }

    setLoading(true);

    try {
      // Construire le message
      const message = `
        📋 NOUVELLE DEMANDE DE DEVIS GROSSISTE
        ======================================
        
        👤 INFORMATIONS CLIENT:
        ---------------------
        • Nom complet: ${formData.fullName}
        • Email: ${formData.email}
        • Téléphone: ${formData.phone}
        • Société: ${formData.company || 'Non spécifiée'}
        
        📦 DÉTAILS DE LA COMMANDE:
        -------------------------
        • Produit concerné: ${productName || 'Non spécifié'}
        • ID Produit: ${productId || 'N/A'}
        • Quantité souhaitée: ${formData.quantity || 'À préciser'}
        • Budget estimé: ${formData.budget || 'À discuter'} FCFA
        
        🚚 LIVRAISON:
        -------------
        • Adresse de livraison: ${formData.deliveryAddress || 'À préciser'}
        
        📝 EXIGENCES SPÉCIALES:
        ----------------------
        ${formData.specialRequirements || 'Aucune exigence particulière'}
        
        ======================================
        📧 Cette demande a été envoyée depuis l'application Assma Express
        ⏰ Date: ${new Date().toLocaleString('fr-FR')}
      `;

      // Construire l'URL mailto
      const subject = `🔔 Demande Devis Grossiste - ${productName || 'Produit'}`;
      const body = encodeURIComponent(message);
      const toEmails = 'sayon82649500@gmail.com,cheicksy1988@gmail.com';
      const ccEmails = formData.email; // Copie au client
      
      const mailtoUrl = `mailto:${toEmails}?cc=${ccEmails}&subject=${encodeURIComponent(subject)}&body=${body}`;

      // Vérifier si Linking est disponible
      if (!Linking || !Linking.canOpenURL) {
        Alert.alert('Erreur', 'Fonctionnalité non disponible sur cette plateforme');
        setLoading(false);
        return;
      }

      // Ouvrir l'application email
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
        
        Alert.alert(
          'Demande envoyée !',
          'Votre demande de devis a été transférée à notre service commercial. Vous recevrez une réponse dans les 24h.',
          [
            {
              text: 'OK',
              onPress: () => {
                onClose();
                setFormData({
                  fullName: '',
                  email: '',
                  phone: '',
                  company: '',
                  quantity: '',
                  deliveryAddress: '',
                  specialRequirements: '',
                  budget: ''
                });
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Application email non trouvée',
          'Veuillez configurer une application de messagerie sur votre appareil.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Erreur envoi email:', error);
      Alert.alert(
        'Erreur',
        'Impossible d\'ouvrir l\'application email. Veuillez vérifier votre configuration.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Demande de Devis Grossiste</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.formContainer}
            showsVerticalScrollIndicator={false}
          >
            {productName && (
              <View style={styles.productInfo}>
                <Ionicons name="cube-outline" size={20} color={COLORS.primary} />
                <Text style={styles.productInfoText}>Produit: {productName}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>📋 Informations personnelles</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Nom complet <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Votre nom complet"
                value={formData.fullName}
                onChangeText={(text) => updateFormData('fullName', text)}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Email <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="votre@email.com"
                value={formData.email}
                onChangeText={(text) => updateFormData('email', text)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Téléphone <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="+223 XX XX XX XX"
                value={formData.phone}
                onChangeText={(text) => updateFormData('phone', text)}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Société (Optionnel)</Text>
              <TextInput
                style={styles.input}
                placeholder="Nom de votre entreprise"
                value={formData.company}
                onChangeText={(text) => updateFormData('company', text)}
              />
            </View>

            <Text style={styles.sectionTitle}>📦 Détails de la commande</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Quantité souhaitée</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 1000 unités"
                value={formData.quantity}
                onChangeText={(text) => updateFormData('quantity', text)}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Budget estimé (FCFA)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 500000 FCFA"
                value={formData.budget}
                onChangeText={(text) => updateFormData('budget', text)}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Adresse de livraison</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Adresse complète pour la livraison"
                value={formData.deliveryAddress}
                onChangeText={(text) => updateFormData('deliveryAddress', text)}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Exigences spéciales</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Conditionnement, étiquetage, documents spécifiques..."
                value={formData.specialRequirements}
                onChangeText={(text) => updateFormData('specialRequirements', text)}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={20} color={COLORS.primary} />
              <Text style={styles.infoText}>
                Notre service commercial vous contactera dans les 24h pour finaliser votre devis.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <>
                  <Ionicons name="mail" size={20} color={COLORS.white} />
                  <Text style={styles.submitButtonText}>Envoyer la demande</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  formContainer: {
    padding: 20,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.primaryLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  productInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  required: {
    color: COLORS.error,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#F0F9FF',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  submitButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
});