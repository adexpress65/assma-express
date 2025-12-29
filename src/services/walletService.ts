// apps/mobile/src/services/walletService.ts
import { db } from '../config/firebase'; // Chemin relatif depuis services
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  Timestamp,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from 'firebase/firestore';

export interface Wallet {
  id?: string;
  userId: string;
  balance: number;
  balanceFCFA: number;
  balanceUSD: number;
  currency: string;
  isActive: boolean;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

export interface Transaction {
  id?: string;
  userId: string;
  type: 'credit' | 'debit' | 'refund' | 'purchase' | 'recharge';
  amount: number;
  amountFCFA: number;
  amountUSD: number;
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
  reference?: string;
  orderId?: string;
  paymentMethod?: string;
  metadata?: Record<string, any>;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

class WalletService {
  private readonly WALLET_COLLECTION = 'wallets';
  private readonly TRANSACTIONS_COLLECTION = 'wallet_transactions';

  // Formatage de la devise
  formatCurrency(amount: number): string {
    return `${amount.toLocaleString('fr-FR')} FCFA`;
  }

  formatCurrencyShort(amount: number): string {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M FCFA`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K FCFA`;
    }
    return `${amount.toLocaleString()} FCFA`;
  }

  convertToUSD(fcfaAmount: number): number {
    // Taux approximatif: 1 USD ≈ 600 FCFA
    return fcfaAmount / 600;
  }

  convertFCFAToUSD(fcfaAmount: number): number {
    return fcfaAmount / 600;
  }

  convertUSDToFCFA(usdAmount: number): number {
    return usdAmount * 600;
  }

  // CRUD WALLET
  async getWallet(userId: string): Promise<Wallet | null> {
    try {
      const walletRef = doc(db, this.WALLET_COLLECTION, userId);
      const walletDoc = await getDoc(walletRef);

      if (walletDoc.exists()) {
        const data = walletDoc.data();
        console.log('Firestore wallet data:', data);
        
        return {
          id: walletDoc.id,
          userId,
          balance: data?.balance || 0,
          balanceFCFA: data?.balanceFCFA || 0,
          balanceUSD: data?.balanceUSD || this.convertFCFAToUSD(data?.balanceFCFA || 0),
          currency: data?.currency || 'FCFA',
          isActive: data?.isActive ?? true,
          createdAt: data?.createdAt?.toDate() || new Date(),
          updatedAt: data?.updatedAt?.toDate() || new Date(),
        } as Wallet;
      } else {
        console.log('Wallet non trouvé, création par défaut...');
        return await this.createDefaultWallet(userId);
      }
    } catch (error) {
      console.error('Erreur récupération wallet:', error);
      // Retourner un wallet par défaut en cas d'erreur
      return {
        userId,
        balance: 0,
        balanceFCFA: 0,
        balanceUSD: 0,
        currency: 'FCFA',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  private async createDefaultWallet(userId: string): Promise<Wallet> {
    try {
      const defaultWallet: Omit<Wallet, 'id'> = {
        userId,
        balance: 0,
        balanceFCFA: 0,
        balanceUSD: 0,
        currency: 'FCFA',
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const walletRef = doc(db, this.WALLET_COLLECTION, userId);
      await setDoc(walletRef, defaultWallet);

      console.log('Wallet par défaut créé pour:', userId);

      return {
        id: userId,
        ...defaultWallet,
        createdAt: defaultWallet.createdAt.toDate(),
        updatedAt: defaultWallet.updatedAt.toDate(),
      };
    } catch (error) {
      console.error('Erreur création wallet par défaut:', error);
      throw error;
    }
  }

  async updateWallet(userId: string, updates: Partial<Wallet>): Promise<boolean> {
    try {
      const walletRef = doc(db, this.WALLET_COLLECTION, userId);
      
      await updateDoc(walletRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });

      console.log('Wallet mis à jour pour:', userId);
      return true;
    } catch (error) {
      console.error('Erreur mise à jour wallet:', error);
      return false;
    }
  }

  // GESTION DES TRANSACTIONS
  async getTransactions(userId: string, limitCount: number = 20): Promise<Transaction[]> {
    try {
      const transactionsRef = collection(db, this.TRANSACTIONS_COLLECTION);
      const q = query(
        transactionsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId,
          type: data.type || 'credit',
          amount: data.amount || 0,
          amountFCFA: data.amountFCFA || 0,
          amountUSD: data.amountUSD || 0,
          description: data.description || 'Transaction',
          status: data.status || 'completed',
          reference: data.reference,
          orderId: data.orderId,
          paymentMethod: data.paymentMethod,
          metadata: data.metadata,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Transaction;
      });
    } catch (error) {
      console.error('Erreur récupération transactions:', error);
      // Retourner des transactions mock en attendant
      return this.getMockTransactions(userId);
    }
  }

  private getMockTransactions(userId: string): Transaction[] {
    return [
      {
        id: 'mock_1',
        userId,
        type: 'recharge',
        amount: 5000,
        amountFCFA: 5000,
        amountUSD: 8.33,
        description: 'Recharge initiale (mock)',
        status: 'completed',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        id: 'mock_2',
        userId,
        type: 'purchase',
        amount: -2500,
        amountFCFA: -2500,
        amountUSD: -4.17,
        description: 'Achat produit (mock)',
        status: 'completed',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      }
    ];
  }

  async createTransaction(transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
    try {
      const transactionData: Omit<Transaction, 'id'> = {
        ...transaction,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const transactionsRef = collection(db, this.TRANSACTIONS_COLLECTION);
      const docRef = doc(transactionsRef);
      await setDoc(docRef, transactionData);

      console.log('Transaction créée:', transaction.description);
      return docRef.id;
    } catch (error) {
      console.error('Erreur création transaction:', error);
      return null;
    }
  }

  // OPÉRATIONS DE WALLET
  async addToWallet(userId: string, amountFCFA: number, description: string, reference?: string): Promise<boolean> {
    try {
      console.log('Début addToWallet:', { userId, amountFCFA, description });
      
      // 1. Récupérer le wallet actuel
      const wallet = await this.getWallet(userId);
      if (!wallet) {
        console.error('Wallet non trouvé');
        return false;
      }

      const amountUSD = this.convertFCFAToUSD(amountFCFA);
      
      // 2. Mettre à jour le solde
      const updatedWallet = {
        balance: (wallet.balance || 0) + amountFCFA,
        balanceFCFA: (wallet.balanceFCFA || 0) + amountFCFA,
        balanceUSD: (wallet.balanceUSD || 0) + amountUSD,
      };

      const updateSuccess = await this.updateWallet(userId, updatedWallet);
      if (!updateSuccess) {
        console.error('Échec mise à jour wallet');
        return false;
      }

      // 3. Créer une transaction
      const transactionId = await this.createTransaction({
        userId,
        type: 'recharge',
        amount: amountFCFA,
        amountFCFA,
        amountUSD,
        description,
        status: 'completed',
        reference,
        paymentMethod: 'wallet_recharge',
      });

      console.log('addToWallet réussi, transaction ID:', transactionId);
      return true;
    } catch (error) {
      console.error('Erreur addToWallet:', error);
      return false;
    }
  }

  async deductFromWallet(userId: string, amountFCFA: number, description: string, orderId?: string): Promise<boolean> {
    try {
      // 1. Récupérer le wallet actuel
      const wallet = await this.getWallet(userId);
      if (!wallet) return false;

      // 2. Vérifier si le solde est suffisant
      if (wallet.balanceFCFA < amountFCFA) {
        throw new Error('Solde insuffisant');
      }

      const amountUSD = this.convertFCFAToUSD(amountFCFA);
      
      // 3. Mettre à jour le solde
      const updatedWallet = {
        balance: wallet.balance - amountFCFA,
        balanceFCFA: wallet.balanceFCFA - amountFCFA,
        balanceUSD: wallet.balanceUSD - amountUSD,
      };

      await this.updateWallet(userId, updatedWallet);

      // 4. Créer une transaction
      await this.createTransaction({
        userId,
        type: 'purchase',
        amount: -amountFCFA,
        amountFCFA: -amountFCFA,
        amountUSD: -amountUSD,
        description,
        status: 'completed',
        orderId,
        paymentMethod: 'wallet',
      });

      return true;
    } catch (error) {
      console.error('Erreur déduction wallet:', error);
      return false;
    }
  }

  // VERSION SIMPLIFIÉE POUR DÉVELOPPEMENT
  async addToWalletSimple(userId: string, amountFCFA: number, description: string): Promise<boolean> {
    console.log('addToWalletSimple appelé:', { userId, amountFCFA, description });
    
    // Simulation réussie pour le développement
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('addToWalletSimple: simulation réussie');
        resolve(true);
      }, 500);
    });
  }
}

// Export singleton instance
export const walletService = new WalletService();