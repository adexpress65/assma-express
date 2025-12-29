// 📁 apps/mobile/app/account/wallet.tsx - VERSION SIMPLIFIÉE
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { db } from '../../src/config/firebase'; // Import direct de Firebase
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primary: '#FF6A00',
  primaryLight: '#FFF0E6',
  text: '#2D3748',
  textLight: '#718096',
  white: '#FFFFFF',
  success: '#28A745',
  error: '#DC3545',
  background: '#f8f9fa'
};

interface Wallet {
  id?: string;
  userId: string;
  balance: number;
  balanceFCFA: number;
  balanceUSD: number;
  currency: string;
  isActive: boolean;
  createdAt: Date | any;
  updatedAt: Date | any;
}

// Fonctions de formatage
const formatCurrency = (amount: number): string => {
  return `${amount.toLocaleString('fr-FR')} FCFA`;
};

const formatCurrencyShort = (amount: number): string => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M FCFA`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K FCFA`;
  }
  return `${amount.toLocaleString()} FCFA`;
};

const convertToUSD = (fcfaAmount: number): number => {
  return fcfaAmount / 600;
};

export default function WalletScreen() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechargeAmount, setRechargeAmount] = useState(10000);

  const loadWalletData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Charger directement depuis Firestore
      const walletRef = doc(db, 'wallets', user.uid);
      const walletDoc = await getDoc(walletRef);

      let walletData: Wallet;
      
      if (walletDoc.exists()) {
        const data = walletDoc.data();
        console.log('Firestore wallet data:', data);
        
        walletData = {
          id: walletDoc.id,
          userId: user.uid,
          balance: data?.balance || 0,
          balanceFCFA: data?.balanceFCFA || 0,
          balanceUSD: data?.balanceUSD || convertToUSD(data?.balanceFCFA || 0),
          currency: data?.currency || 'FCFA',
          isActive: data?.isActive ?? true,
          createdAt: data?.createdAt?.toDate() || new Date(),
          updatedAt: data?.updatedAt?.toDate() || new Date(),
        };
      } else {
        // Données par défaut
        walletData = {
          userId: user.uid,
          balance: 0,
          balanceFCFA: 0,
          balanceUSD: 0,
          currency: 'FCFA',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      
      console.log('Wallet data final:', walletData);
      setWallet(walletData);
      
      // Transactions mock pour l'instant
      const mockTransactions = [
        {
          id: 'tx_1',
          userId: user.uid,
          type: 'recharge',
          amount: 5000,
          amountFCFA: 5000,
          amountUSD: 8.33,
          description: 'Recharge initiale',
          status: 'completed',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
          id: 'tx_2',
          userId: user.uid,
          type: 'purchase',
          amount: -2500,
          amountFCFA: -2500,
          amountUSD: -4.17,
          description: 'Achat produit',
          status: 'completed',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        }
      ];
      
      setTransactions(mockTransactions);
      
    } catch (error) {
      console.error('Erreur chargement wallet:', error);
      Alert.alert('Erreur', 'Impossible de charger les données du wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleRecharge = async (amount: number) => {
    if (!user) return;
    
    Alert.alert(
      'Fonctionnalité à venir',
      `La recharge de ${formatCurrency(amount)} sera disponible prochainement.`,
      [{ text: 'OK' }]
    );
  };

  const handleQuickAction = (action: 'history' | 'send' | 'request') => {
    Alert.alert(
      'Fonctionnalité à venir',
      `La fonction "${action}" sera disponible prochainement.`,
      [{ text: 'OK' }]
    );
  };

  useEffect(() => {
    loadWalletData();
  }, [user]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Chargement du portefeuille...</Text>
      </View>
    );
  }

  // Valeur par défaut si wallet est null
  const walletBalance = wallet?.balanceFCFA || 0;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="wallet" size={64} color={COLORS.primary} />
        <Text style={styles.title}>Mon Portefeuille</Text>
        <Text style={styles.userId}>ID: {user?.uid?.substring(0, 8)}...</Text>
      </View>

      {/* Solde */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Solde disponible</Text>
        <Text style={styles.balanceAmount}>
          {formatCurrency(walletBalance)}
        </Text>
        <Text style={styles.balanceNote}>
          {convertToUSD(walletBalance).toFixed(2)} USD
        </Text>
        <Text style={styles.lastUpdated}>
          {wallet?.updatedAt 
            ? `Mis à jour: ${new Date(wallet.updatedAt).toLocaleDateString('fr-FR')}`
            : ''}
        </Text>
      </View>

      {/* Actions rapides */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => handleQuickAction('history')}
        >
          <Ionicons name="time" size={24} color={COLORS.primary} />
          <Text style={styles.quickActionText}>Historique</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => handleQuickAction('send')}
        >
          <Ionicons name="send" size={24} color={COLORS.primary} />
          <Text style={styles.quickActionText}>Envoyer</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickAction}
          onPress={() => handleQuickAction('request')}
        >
          <Ionicons name="download" size={24} color={COLORS.primary} />
          <Text style={styles.quickActionText}>Demander</Text>
        </TouchableOpacity>
      </View>

      {/* Recharge rapide */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recharger rapidement</Text>
        <Text style={styles.sectionSubtitle}>Sélectionnez un montant</Text>
        
        <View style={styles.amountGrid}>
          {[5000, 10000, 25000, 50000, 100000, 250000].map(amount => (
            <TouchableOpacity
              key={amount}
              style={[
                styles.amountButton,
                rechargeAmount === amount && styles.amountButtonSelected
              ]}
              onPress={() => setRechargeAmount(amount)}
            >
              <Text style={[
                styles.amountText,
                rechargeAmount === amount && styles.amountTextSelected
              ]}>
                {formatCurrencyShort(amount)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <TouchableOpacity
          style={styles.rechargeButton}
          onPress={() => handleRecharge(rechargeAmount)}
        >
          <Ionicons name="add-circle" size={24} color={COLORS.white} />
          <Text style={styles.rechargeButtonText}>
            Recharger {formatCurrencyShort(rechargeAmount)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Historique */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Historique récent</Text>
          <Text style={styles.transactionCount}>
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </Text>
        </View>
        
        {transactions.length === 0 ? (
          <View style={styles.emptyTransactions}>
            <Ionicons name="receipt-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Aucune transaction</Text>
            <Text style={styles.emptySubtext}>
              Vos transactions apparaîtront ici
            </Text>
          </View>
        ) : (
          transactions.map(tx => {
            const amount = tx.amountFCFA || 0;
            const isCredit = amount > 0;
            const amountFormatted = isCredit 
              ? `+${formatCurrencyShort(amount)}` 
              : formatCurrencyShort(amount);
            
            const getTransactionIcon = () => {
              switch (tx.type) {
                case 'recharge': return 'add-circle';
                case 'purchase': return 'cart';
                case 'refund': return 'refresh';
                default: return 'cash';
              }
            };

            return (
              <View key={tx.id} style={styles.transactionItem}>
                <View style={[
                  styles.transactionIcon,
                  { backgroundColor: isCredit ? '#E8F7EF' : '#FFE8E6' }
                ]}>
                  <Ionicons 
                    name={getTransactionIcon()} 
                    size={20} 
                    color={isCredit ? COLORS.success : COLORS.error} 
                  />
                </View>
                
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDesc}>
                    {tx.description}
                  </Text>
                  <View style={styles.transactionMeta}>
                    <Text style={styles.transactionDate}>
                      {tx.createdAt instanceof Date 
                        ? tx.createdAt.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Date inconnue'}
                    </Text>
                    <Text style={[
                      styles.transactionStatus,
                      { color: tx.status === 'completed' ? COLORS.success : '#FF9800' }
                    ]}>
                      {tx.status === 'completed' ? '✓ Terminé' : 'En attente'}
                    </Text>
                  </View>
                </View>
                
                <Text style={[
                  styles.transactionAmount,
                  { color: isCredit ? COLORS.success : COLORS.error }
                ]}>
                  {amountFormatted}
                </Text>
              </View>
            );
          })
        )}
      </View>

      {/* Section informations */}
      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>💡 À propos de votre wallet</Text>
        
        <View style={styles.infoItem}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.success} />
          <Text style={styles.infoText}>
            <Text style={styles.infoBold}>Sécurisé:</Text> Votre argent est protégé
          </Text>
        </View>
        
        <View style={styles.infoItem}>
          <Ionicons name="flash" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            <Text style={styles.infoBold}>Instantané:</Text> Recharge et paiement immédiats
          </Text>
        </View>
        
        <View style={styles.infoItem}>
          <Ionicons name="card" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            <Text style={styles.infoBold}>Flexible:</Text> Utilisable sur tous vos achats
          </Text>
        </View>
      </View>

      {/* Espace en bas */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 40 
  },
  loadingText: { 
    marginTop: 16, 
    fontSize: 16,
    color: COLORS.textLight 
  },
  header: { 
    alignItems: 'center', 
    paddingTop: 40,
    paddingBottom: 20,
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16
  },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: COLORS.text, 
    marginTop: 12 
  },
  userId: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    fontFamily: 'monospace'
  },
  balanceCard: { 
    backgroundColor: COLORS.primaryLight, 
    marginHorizontal: 16, 
    marginVertical: 8,
    padding: 24, 
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5
  },
  balanceLabel: { 
    fontSize: 16, 
    color: COLORS.text, 
    marginBottom: 8,
    fontWeight: '500'
  },
  balanceAmount: { 
    fontSize: 36, 
    fontWeight: 'bold', 
    color: COLORS.primary,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2
  },
  balanceNote: { 
    fontSize: 14, 
    color: COLORS.textLight, 
    marginTop: 8,
    fontStyle: 'italic'
  },
  lastUpdated: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 12,
    opacity: 0.8
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3
  },
  quickAction: {
    alignItems: 'center',
    padding: 8,
  },
  quickActionText: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 6,
    fontWeight: '500'
  },
  section: { 
    backgroundColor: COLORS.white, 
    marginHorizontal: 16, 
    marginVertical: 8,
    padding: 20, 
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: COLORS.text
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 16
  },
  transactionCount: {
    fontSize: 14,
    color: COLORS.textLight,
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  amountGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between',
    marginBottom: 20 
  },
  amountButton: { 
    width: '48%', 
    padding: 16, 
    backgroundColor: '#f8f9fa', 
    borderRadius: 12, 
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 60,
    justifyContent: 'center'
  },
  amountButtonSelected: { 
    backgroundColor: COLORS.primaryLight, 
    borderColor: COLORS.primary 
  },
  amountText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: COLORS.text,
    textAlign: 'center'
  },
  amountTextSelected: { 
    color: COLORS.primary, 
    fontWeight: 'bold' 
  },
  rechargeButton: { 
    backgroundColor: COLORS.primary, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 18, 
    borderRadius: 12,
    gap: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  rechargeButtonText: { 
    color: COLORS.white, 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  emptyTransactions: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: { 
    textAlign: 'center', 
    color: COLORS.text, 
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12
  },
  emptySubtext: {
    textAlign: 'center',
    color: COLORS.textLight,
    fontSize: 14,
    marginTop: 4
  },
  transactionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 16,
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0' 
  },
  transactionIcon: { 
    marginRight: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  transactionInfo: { 
    flex: 1 
  },
  transactionDesc: { 
    fontSize: 16, 
    color: COLORS.text, 
    marginBottom: 4,
    fontWeight: '500'
  },
  transactionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  transactionDate: { 
    fontSize: 13, 
    color: COLORS.textLight 
  },
  transactionStatus: {
    fontSize: 12,
    fontWeight: '500'
  },
  transactionAmount: { 
    fontSize: 16, 
    fontWeight: 'bold',
    textAlign: 'right'
  },
  infoSection: {
    backgroundColor: COLORS.white,
    margin: 16,
    padding: 20,
    borderRadius: 16,
    marginBottom: 20
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20
  },
  infoBold: {
    fontWeight: '600'
  },
  bottomSpacer: {
    height: 30
  }
});