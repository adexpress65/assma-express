// 📁 apps/mobile/src/types/payment.ts
export type PaymentMethodType = 
  | 'card' 
  | 'wallet' 
  | 'bank_transfer' 
  | 'cash_on_delivery'
  | 'cih' 
  | 'attijari' 
  | 'bmce';

export type PaymentStatus = 
  | 'pending'
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'refunded'
  | 'cancelled';

export interface PaymentMethod {
  id: string;
  userId: string;
  type: PaymentMethodType;
  isDefault: boolean;
  
  // Pour les cartes
  lastFour?: string;
  cardHolder?: string;
  expiryMonth?: number;
  expiryYear?: number;
  brand?: 'visa' | 'mastercard' | 'amex';
  
  // Pour les virements
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  rib?: string;
  
  // Sécurité
  token?: string; // Pour les gateways
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  orderId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethodId: string;
  paymentMethodType: PaymentMethodType;
  
  // Frais
  fees: number;
  totalAmount: number;
  
  // Références
  gatewayTransactionId?: string;
  gatewayResponse?: Record<string, any>;
  
  // Métadonnées
  description?: string;
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface Wallet {
  userId: string;
  balance: number;
  currency: string;
  totalDeposits: number;
  totalWithdrawals: number;
  lastTransactionDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentConfig {
  feesPercentage: number;
  minAmount: number;
  maxAmount: number;
  supportedBanks: string[];
  testMode: boolean;
}