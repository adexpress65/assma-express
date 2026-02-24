// 📁 apps/mobile/src/screens/TestPaymentScreen.tsx - VERSION COMPLÈTE CORRIGÉE
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { PaymentService } from '@/services/payment.service';
import { PaymentInitService } from '@/services/payment-init.service';
import { PaymentMethod, Transaction } from '@/types/payment';

export default function TestPaymentScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);
  
  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      console.log('📥 Chargement des données...');
      
      // Charger les méthodes de paiement
      const methods = await PaymentService.getPaymentMethods(user.uid);
      setPaymentMethods(methods);
      console.log('💳 Méthodes chargées:', methods.length);
      
      // Charger les transactions
      const tx = await PaymentService.getTransactions(user.uid, 10);
      setTransactions(tx);
      console.log('📊 Transactions chargées:', tx.length);
      
      // Charger le wallet
      const wallet = await PaymentService.getWallet(user.uid);
      setWalletBalance(wallet?.balance || 0);
      console.log('💰 Solde wallet:', wallet?.balance);
      
    } catch (error) {
      console.error('❌ Erreur chargement:', error);
      Alert.alert('Erreur', 'Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  };
  
  // ============ FONCTIONS DE TEST ============
  
  const initializeCollections = async () => {
    if (!user) {
      Alert.alert('Erreur', 'Connectez-vous d\'abord');
      return;
    }
    
    setLoading(true);
    try {
      console.log('🏗️ Initialisation des collections...');
      
      const success = await PaymentInitService.initializeCollections(user.uid);
      
      if (success) {
        Alert.alert(
          '✅ SUCCÈS !', 
          'Collections créées dans Firebase!\n\n' +
          '1. transactions ✓\n' +
          '2. wallets ✓\n' +
          '3. users/{userId}/paymentMethods ✓\n\n' +
          'Vous pouvez maintenant tester le paiement.'
        );
        
        // Attendre 2 secondes puis recharger
        setTimeout(() => {
          loadData();
        }, 2000);
        
      } else {
        Alert.alert('❌ Échec', 'Impossible de créer les collections');
      }
      
    } catch (error: any) {
      console.error('❌ Erreur initialisation:', error);
      Alert.alert('Erreur', 'Échec de l\'initialisation: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const createTestData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await PaymentService.createTestData(user.uid);
      Alert.alert('✅ Succès', 'Données de test créées !');
      
      // Recharger après 1 seconde
      setTimeout(() => {
        loadData();
      }, 1000);
      
    } catch (error: any) {
      console.error('❌ Erreur création données:', error);
      Alert.alert('❌ Erreur', 'Impossible de créer les données test: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const testAddPaymentMethod = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      await PaymentService.addPaymentMethod(user.uid, {
        type: 'card',
        isDefault: true,
        lastFour: '4242',
        cardHolder: 'Test User',
        brand: 'visa'
      });
      
      Alert.alert('✅ Succès', 'Méthode de paiement ajoutée');
      loadData();
    } catch (error: any) {
      console.error('❌ Erreur ajout méthode:', error);
      Alert.alert('❌ Erreur', 'Impossible d\'ajouter la méthode: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const testCreateTransaction = async () => {
  if (!user) return;
  
  setLoading(true);
  try {
    // UTILISER processPayment() au lieu de createTransaction()
    const result = await PaymentService.processPayment(user.uid, {
      amount: 150,
      paymentMethodType: 'mobile_money',
      description: 'Transaction manuelle de test'
    });
    
    if (result.success) {
      Alert.alert(
        '✅ Succès', 
        `Transaction créée: ${result.transactionId}\n\n` +
        `Montant: 150 FCFA débité du wallet`
      );
    } else {
      Alert.alert('❌ Échec', result.error || 'Paiement échoué');
    }
    
    loadData();
  } catch (error: any) {
    console.error('❌ Erreur création transaction:', error);
    Alert.alert('❌ Erreur', 'Impossible de créer la transaction: ' + error.message);
  } finally {
    setLoading(false);
  }
};
  
  const createIndexFirebase = () => {
    const indexUrl = "https://console.firebase.google.com/v1/r/project/assma-expresse/firestore/indexes?create_composite=ClNwcm9qZWN0cy9hc3NtYS1leHByZXNzZS9kYXRhYmFzZXMvKGRlZmF1bHQpL2NvbGxlY3Rpb25Hcm91cHMvdHJhbnNhY3Rpb25zL2luZGV4ZXMvXxABGgoKBnVzZXJJZBABGg0KCWNyZWF0ZWRBdBACGgwKCF9fbmFtZV9fEAI";
    
    Alert.alert(
      'Créer Index Firebase',
      'Cette opération est nécessaire pour les requêtes. Ouvrir la console Firebase ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Ouvrir', 
          onPress: () => {
            Linking.openURL(indexUrl).catch(err => 
              console.error('Erreur ouverture URL:', err)
            );
          }
        }
      ]
    );
  };
  
  const runCompleteTest = async () => {
    if (!user) {
      Alert.alert('Erreur', 'Connectez-vous d\'abord');
      return;
    }
    
    setLoading(true);
    try {
      console.log('🚀 Début test complet...');
      
      // 1. Initialiser les collections si nécessaire
      await PaymentInitService.testAndInitialize(user.uid);
      
      // 2. Créer des données de test
      await PaymentService.createTestData(user.uid);
      
      // 3. Recharger les données
      await loadData();
      
      Alert.alert(
        '🎉 SUCCÈS COMPLET !', 
        'Tous les tests ont été passés avec succès!\n\n' +
        '✅ Collections vérifiées\n' +
        '✅ Données de test créées\n' +
        '✅ Données chargées\n\n' +
        'Vérifiez Firebase Console pour voir les données.'
      );
      
    } catch (error: any) {
      console.error('💥 Test complet échoué:', error);
      Alert.alert(
        '❌ TEST ÉCHOUÉ', 
        `Erreur: ${error.message}\n\nVérifiez la console pour les détails.`
      );
    } finally {
      setLoading(false);
    }
  };
  
  // ============ RENDER ============
  
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>🧪 Test Système de Paiement</Text>
        <Text style={styles.subtitle}>
          {user ? `Connecté: ${user.email}` : 'Non connecté'}
        </Text>
      </View>
      
      {/* CARD 1: Portefeuille */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>💰 Portefeuille</Text>
        <Text style={styles.balance}>
          {PaymentService.formatCurrency(walletBalance)}
        </Text>
        <Text style={styles.cardSubtitle}>
          {transactions.length} transaction(s) • {paymentMethods.length} méthode(s)
        </Text>
      </View>
      
      {/* CARD 2: Étapes d'initialisation */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🚀 Initialisation</Text>
        <Text style={styles.cardText}>
          Commencez par ces étapes dans l'ordre :
        </Text>
        
        <View style={styles.stepsContainer}>
          <TouchableOpacity 
            style={[styles.stepButton, { backgroundColor: '#34C759' }]}
            onPress={initializeCollections}
          >
            <Text style={styles.stepButtonText}>1. 🏗️ Créer Collections</Text>
            <Text style={styles.stepButtonSubtext}>Crée transactions, wallets, etc.</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.stepButton, { backgroundColor: '#007AFF' }]}
            onPress={createIndexFirebase}
          >
            <Text style={styles.stepButtonText}>2. 🔧 Créer Index Firebase</Text>
            <Text style={styles.stepButtonSubtext}>Nécessaire pour les requêtes</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.stepButton, { backgroundColor: '#FF9500' }]}
            onPress={runCompleteTest}
          >
            <Text style={styles.stepButtonText}>3. 🚀 Test Complet</Text>
            <Text style={styles.stepButtonSubtext}>Exécute toutes les étapes</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* CARD 3: Tests individuels */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🧪 Tests Individuels</Text>
        
        <View style={styles.testButtonsContainer}>
          <TouchableOpacity 
            style={[styles.testButton, { backgroundColor: '#9C27B0' }]}
            onPress={testAddPaymentMethod}
          >
            <Text style={styles.testButtonText}>+ Méthode Paiement</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.testButton, { backgroundColor: '#2196F3' }]}
            onPress={testCreateTransaction}
          >
            <Text style={styles.testButtonText}>+ Transaction</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.testButton, { backgroundColor: '#4CAF50' }]}
            onPress={createTestData}
          >
            <Text style={styles.testButtonText}>Données Test</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* CARD 4: Méthodes de paiement */}
      {paymentMethods.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💳 Méthodes de Paiement</Text>
          <Text style={styles.count}>{paymentMethods.length} méthode(s)</Text>
          
          {paymentMethods.map(method => (
            <View key={method.id} style={styles.methodItem}>
              <View style={styles.methodIcon}>
                <Text style={styles.methodIconText}>💳</Text>
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodType}>{method.type.toUpperCase()}</Text>
                <Text style={method.isDefault ? styles.methodDetailDefault : styles.methodDetail}>
                  {method.lastFour ? `**** ${method.lastFour}` : method.bankName || 'Sans nom'}
                  {method.isDefault && ' • Défaut'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      
      {/* CARD 5: Transactions */}
      {transactions.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 Transactions Récentes</Text>
          <Text style={styles.count}>{transactions.length} transaction(s)</Text>
          
          {transactions.slice(0, 5).map(tx => (
            <View key={tx.id} style={styles.transactionItem}>
              <View style={styles.transactionIcon}>
                <Text style={styles.transactionIconText}>
                  {tx.status === 'completed' ? '✅' : '🔄'}
                </Text>
              </View>
              <View style={styles.transactionInfo}>
                <Text style={styles.txDescription} numberOfLines={1}>
                  {tx.description || 'Transaction'}
                </Text>
                <Text style={styles.txDate}>
                  {new Date(tx.createdAt).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <View style={styles.transactionAmount}>
                <Text style={styles.txAmount}>
                  {PaymentService.formatCurrency(tx.amount)}
                </Text>
                <Text style={[
                  styles.txStatus,
                  { 
                    color: tx.status === 'completed' ? '#4CAF50' : 
                           tx.status === 'pending' ? '#FF9800' : '#FF4444'
                  }
                ]}>
                  {tx.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      
      {/* Bouton Rafraîchir */}
      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={loadData}
      >
        <Text style={styles.refreshButtonText}>🔄 Rafraîchir les données</Text>
      </TouchableOpacity>
      
      {/* Message si pas connecté */}
      {!user && (
        <View style={styles.notConnectedCard}>
          <Text style={styles.notConnectedTitle}>🔒 Connectez-vous</Text>
          <Text style={styles.notConnectedText}>
            Vous devez être connecté pour tester le système de paiement.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    marginVertical: 24,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  balance: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B00',
    textAlign: 'center',
    marginVertical: 8,
  },
  count: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    fontWeight: '500',
  },
  
  // Steps
  stepsContainer: {
    marginTop: 8,
  },
  stepButton: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stepButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  stepButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
  },
  
  // Test buttons
  testButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  testButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  testButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Payment methods
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B0010',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  methodIconText: {
    fontSize: 20,
  },
  methodInfo: {
    flex: 1,
  },
  methodType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  methodDetail: {
    fontSize: 13,
    color: '#666',
  },
  methodDetailDefault: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '500',
  },
  
  // Transactions
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionIconText: {
    fontSize: 16,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  txDescription: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  txDate: {
    fontSize: 12,
    color: '#999',
  },
  txAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B00',
    marginBottom: 4,
  },
  txStatus: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  
  // Refresh button
  refreshButton: {
    backgroundColor: '#FF6B00',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 20,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  refreshButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Not connected
  notConnectedCard: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FFEEBA',
  },
  notConnectedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  notConnectedText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
});
