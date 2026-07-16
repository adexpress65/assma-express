// Types paiement — méthodes checkout et réponses API passerelles
import type { OrderItem, ShippingAddress } from './order';
import type { CartSummary } from './cart';

// ─── Méthodes de paiement du checkout mobile ───────────────────────────────

export type CheckoutPaymentMethod =
  | 'fedapay_mobile'
  | 'fedapay_card'
  | 'ngenius_card'
  | 'paydunya';

// ─── Payload envoyé au backend paiement ────────────────────────────────────

export interface PaymentPayload {
  orderId: string;
  userId: string;
  amount: number;
  currencyCode: string;
  email: string;
  firstname: string;
  lastname: string;
  method: CheckoutPaymentMethod;
  items: OrderItem[];
  summary: CartSummary;
  shippingAddress?: ShippingAddress;
}

// ─── Réponse du backend paiement ───────────────────────────────────────────

export interface PaymentResult {
  url?: string;
  error?: string;
  transactionId?: string;
  status?: string;
}

// ─── Types génériques (méthodes stockées, transactions, wallet) ────────────

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
  lastFour?: string;
  cardHolder?: string;
  expiryMonth?: number;
  expiryYear?: number;
  brand?: 'visa' | 'mastercard' | 'amex';
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  rib?: string;
  token?: string;
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
  fees: number;
  totalAmount: number;
  gatewayTransactionId?: string;
  gatewayResponse?: Record<string, unknown>;
  description?: string;
  metadata?: Record<string, unknown>;
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
