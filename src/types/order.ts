// Types commande — utilisés tout au long du flux checkout
import type { CartSummary } from './cart';
import type { ProductSpecifications } from './product';

export interface ShippingAddress {
  fullName: string;
  phone: string;
  city: string;
  country: string;
  /** Rue, numéro, voie */
  street: string;
  /** Facultatif */
  postalCode?: string;
  /** Facultatif */
  apartment?: string;
  /** Facultatif */
  building?: string;
  /** Facultatif */
  floor?: string;
  /** Instructions de livraison (facultatif) */
  deliveryNote?: string;
}

export interface ShippingOption {
  id: string;
  name: string;
  price: number;
  deliveryTime: string;
  description: string;
  type: 'free' | 'air' | 'sea';
  details: string;
  explanation?: string;
}

export interface ShippingSelection {
  method: string;
  option: ShippingOption;
  cost: number;
  details: string;
}

export interface OrderItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  image?: string;
  companyName?: string;
  seller?: string;
  sellerId?: string;
  hasFreeShipping?: boolean;
  specifications?: ProductSpecifications;
}

/** Objet transmis de cart.tsx jusqu'à payment.tsx via le CheckoutContext */
export interface OrderData {
  items: OrderItem[];
  summary: CartSummary;
  shippingAddress?: ShippingAddress;
  shipping?: ShippingSelection;
  selectedItems?: OrderItem[];
  timestamp?: string;
}

export type ShippingDetails = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
  deliveryNote?: string;
};

export type Order = {
  id: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  gateway: string;
  status: string;
  shippingDetails?: ShippingDetails;
};
