// 📁 apps/mobile/app/account/payment-methods.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#FF6A00',
  primaryLight: '#FFF0E6',
  text: '#2D3748',
  textLight: '#718096',
  white: '#FFFFFF',
  success: '#28A745',
  error: '#DC3545',
  background: '#f8f9fa',
  border: '#E2E8F0'
};

// 🔥 AJOUT: Fonctions mock temporaires pour remplacer PaymentService
const mockGetPaymentMethods = async (userId: string): Promise<any[]> => {
  // Données de simulation
  return [
    {
      id: 'pm_1',
      type: 'card',
      lastFour: '4242',
      cardHolder: 'John Doe',
      brand: 'visa',
      isDefault: true,
      phoneNumber: '',
      accountName: ''
    },
    {
      id: 'pm_2',
      type: 'mobile_money',
      lastFour: '',
      cardHolder: '',
      brand: '',
      isDefault: false,
      phoneNumber: '+221 77 123 45 67',
      accountName: 'Orange Money'
    }
  ];
};

const mockAddPaymentMethod = async (userId: string, method: any): Promise<boolean> => {
  console.log('Mock: Ajout méthode de paiement pour', userId, method);
  return true; // Simulation réussie
};
// 🔥 FIN DES FONCTIONS MOCK

export default function PaymentMethodsScreen() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newMethod, setNewMethod] = useState({
    type: 'card',
    lastFour: '',
    cardHolder: '',
    brand: 'visa',
    isDefault: false
  });

  const loadPaymentMethods = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // 🔥 REMPLACÉ: Utilisez la fonction mock
      const paymentMethods = await mockGetPaymentMethods(user.uid);
      setMethods(paymentMethods);
    } catch (error) {
      console.error('Erreur chargement méthodes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentMethods();
  }, [user]);

  const handleAddMethod = async () => {
    if (!user) return;
    
    if (!newMethod.lastFour || !newMethod.cardHolder) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    try {
      // 🔥 REMPLACÉ: Utilisez la fonction mock
      await mockAddPaymentMethod(user.uid, newMethod);
      Alert.alert('✅ Succès (simulation)', 'Méthode de paiement ajoutée (simulation)');
      setModalVisible(false);
      setNewMethod({
        type: 'card',
        lastFour: '',
        cardHolder: '',
        brand: 'visa',
        isDefault: false
      });
      await loadPaymentMethods();
    } catch (error: any) {
      Alert.alert('❌ Erreur', error.message || 'Impossible d\'ajouter la méthode');
    }
  };

  const handleSetDefault = async (methodId: string) => {
    if (!user) return;
    
    Alert.alert(
      'Définir par défaut',
      'Voulez-vous définir cette méthode comme méthode de paiement par défaut ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Définir', 
          onPress: async () => {
            try {
              // Mettre à jour localement
              const updatedMethods = methods.map(method => ({
                ...method,
                isDefault: method.id === methodId
              }));
              setMethods(updatedMethods);
              
              Alert.alert('✅ Succès (simulation)', 'Méthode définie par défaut (simulation)');
            } catch (error) {
              Alert.alert('❌ Erreur', 'Impossible de mettre à jour');
            }
          }
        }
      ]
    );
  };

  const handleDeleteMethod = async (methodId: string) => {
    Alert.alert(
      'Supprimer',
      'Êtes-vous sûr de vouloir supprimer cette méthode de paiement ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Supprimer', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Supprimer localement
              const updatedMethods = methods.filter(method => method.id !== methodId);
              setMethods(updatedMethods);
              
              Alert.alert('✅ Succès (simulation)', 'Méthode supprimée (simulation)');
            } catch (error) {
              Alert.alert('❌ Erreur', 'Impossible de supprimer');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Moyens de Paiement</Text>
          <Text style={styles.subtitle}>
            Gérez vos méthodes de paiement pour des achats plus rapides (mode simulation)
          </Text>
        </View>

        {/* Liste des méthodes */}
        <View style={styles.section}>
          {methods.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="card-outline" size={64} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>Aucune méthode</Text>
              <Text style={styles.emptyText}>
                Ajoutez une carte ou un moyen de paiement pour des achats plus rapides
              </Text>
            </View>
          ) : (
            methods.map(method => (
              <View key={method.id} style={styles.methodCard}>
                <View style={styles.methodHeader}>
                  <View style={styles.methodIcon}>
                    {method.type === 'card' ? (
                      <Ionicons name="card" size={24} color={COLORS.primary} />
                    ) : method.type === 'mobile_money' ? (
                      <Ionicons name="phone-portrait" size={24} color={COLORS.primary} />
                    ) : (
                      <Ionicons name="business" size={24} color={COLORS.primary} />
                    )}
                  </View>
                  
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodTitle}>
                      {method.type === 'card' ? 'Carte bancaire' : 
                       method.type === 'mobile_money' ? 'Mobile Money' : 'Virement bancaire'}
                    </Text>
                    <Text style={styles.methodDetail}>
                      {method.type === 'card' ? `**** ${method.lastFour}` : 
                       method.phoneNumber || method.accountName || 'Sans nom'}
                    </Text>
                  </View>
                  
                  {method.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Défaut</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.methodActions}>
                  {!method.isDefault && (
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleSetDefault(method.id)}
                    >
                      <Ionicons name="star-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.actionText}>Définir par défaut</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    style={[styles.actionButton, { marginLeft: 12 }]}
                    onPress={() => handleDeleteMethod(method.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                    <Text style={[styles.actionText, { color: COLORS.error }]}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Informations */}
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={24} color={COLORS.success} />
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>Paiements sécurisés</Text>
            <Text style={styles.infoDescription}>
              Vos informations sont cryptées et protégées. Nous ne stockons jamais votre code CVC.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bouton Ajouter */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add-circle" size={24} color={COLORS.white} />
          <Text style={styles.addButtonText}>Ajouter un moyen de paiement (simulation)</Text>
        </TouchableOpacity>
      </View>

      {/* Modal Ajout */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter une carte (simulation)</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Nom sur la carte"
                value={newMethod.cardHolder}
                onChangeText={(text) => setNewMethod({...newMethod, cardHolder: text})}
              />
              
              <TextInput
                style={styles.input}
                placeholder="4 derniers chiffres (simulation)"
                value={newMethod.lastFour}
                onChangeText={(text) => setNewMethod({...newMethod, lastFour: text})}
                keyboardType="numeric"
                maxLength={4}
              />
              
              <View style={styles.checkboxContainer}>
                <TouchableOpacity 
                  style={styles.checkbox}
                  onPress={() => setNewMethod({...newMethod, isDefault: !newMethod.isDefault})}
                >
                  {newMethod.isDefault && (
                    <Ionicons name="checkmark" size={16} color={COLORS.white} />
                  )}
                </TouchableOpacity>
                <Text style={styles.checkboxLabel}>
                  Définir comme méthode de paiement par défaut
                </Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.saveButton}
                onPress={handleAddMethod}
              >
                <Text style={styles.saveButtonText}>Ajouter la carte (simulation)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Les styles restent exactement les mêmes
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.textLight },
  scrollView: { flex: 1 },
  
  header: { padding: 24, backgroundColor: COLORS.white },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text },
  subtitle: { fontSize: 16, color: COLORS.textLight, marginTop: 8, lineHeight: 22 },
  
  section: { padding: 16 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginTop: 16 },
  emptyText: { textAlign: 'center', color: COLORS.textLight, marginTop: 8, lineHeight: 20 },
  
  methodCard: { 
    backgroundColor: COLORS.white, 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  methodHeader: { flexDirection: 'row', alignItems: 'center' },
  methodIcon: { marginRight: 12 },
  methodInfo: { flex: 1 },
  methodTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  methodDetail: { fontSize: 14, color: COLORS.textLight, marginTop: 2 },
  defaultBadge: { 
    backgroundColor: COLORS.primary, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 4 
  },
  defaultBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },
  methodActions: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  actionButton: { flexDirection: 'row', alignItems: 'center' },
  actionText: { marginLeft: 6, fontSize: 14, color: COLORS.primary },
  
  infoCard: { 
    backgroundColor: '#E8F4FD', 
    margin: 16, 
    padding: 16, 
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  infoText: { flex: 1, marginLeft: 12 },
  infoTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  infoDescription: { fontSize: 14, color: COLORS.textLight, marginTop: 4, lineHeight: 20 },
  
  footer: { 
    padding: 16, 
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border
  },
  addButton: { 
    backgroundColor: COLORS.primary, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 16, 
    borderRadius: 12,
    gap: 8
  },
  addButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
  
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    backgroundColor: COLORS.white, 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    padding: 24 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  form: { marginBottom: 24 },
  input: { 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    padding: 16, 
    borderRadius: 8, 
    marginBottom: 12,
    fontSize: 16 
  },
  checkboxContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 12 
  },
  checkbox: { 
    width: 24, 
    height: 24, 
    borderRadius: 6, 
    borderWidth: 2, 
    borderColor: COLORS.primary, 
    backgroundColor: COLORS.primary, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  checkboxLabel: { fontSize: 14, color: COLORS.text },
  modalActions: { 
    flexDirection: 'row', 
    gap: 12 
  },
  cancelButton: { 
    flex: 1, 
    padding: 16, 
    borderRadius: 8, 
    backgroundColor: '#f8f9fa', 
    alignItems: 'center' 
  },
  cancelButtonText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  saveButton: { 
    flex: 1, 
    padding: 16, 
    borderRadius: 8, 
    backgroundColor: COLORS.primary, 
    alignItems: 'center' 
  },
  saveButtonText: { color: COLORS.white, fontSize: 16, fontWeight: '600' },
});