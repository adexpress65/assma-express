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

/** Mode de transport plat (persisté sur le document Firestore `orders`) */
export type ShippingMethodType = 'free' | 'air' | 'cargo' | 'maritime' | 'sea' | string;

export interface OrderVariantLine {
  color?: string | null;
  size?: string | null;
  quantity: number;
}

export interface OrderItem {
  id: string;
  productId?: string;
  cartId?: string;
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
  originWarehouseId?: string | null;
  originWarehouseLabel?: string | null;
  /** Variante choisie au checkout (source de vérité) */
  selectedSize?: string | null;
  selectedColor?: string | null;
  /** Alias compat lecture dashboards / anciennes commandes */
  size?: string | null;
  color?: string | null;
  /**
   * Détail des quantités par déclinaison (couleur + taille).
   * Une ligne = une combinaison ; le tableau sert de filet si plusieurs
   * déclinaisons sont regroupées sous la même fiche produit.
   */
  variantLines?: OrderVariantLine[];
}

/** Objet transmis de cart.tsx jusqu'à payment.tsx via le CheckoutContext */
export interface OrderData {
  items: OrderItem[];
  summary: CartSummary;
  shippingAddress?: ShippingAddress;
  shipping?: ShippingSelection;
  /** Dernier kilomètre : retrait entrepôt ou domicile. */
  deliveryMode?: 'pickup' | 'home';
  /** Identifiant technique (ex. vol_express) */
  shippingMethod?: string;
  /** Libellé affiché (ex. Vol Express) */
  shippingMethodName?: string;
  /** Délai d'acheminement (ex. 5 jours) */
  shippingMethodDelay?: string;
  /** Alias délai */
  shippingEstimatedDays?: string;
  /** Catégorie (air | cargo | maritime | free) */
  shippingMethodType?: ShippingMethodType;
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
  shippingMethod?: string;
  shippingMethodName?: string;
  shippingMethodDelay?: string;
  shippingEstimatedDays?: string;
  shippingMethodType?: ShippingMethodType;
  shipping?: ShippingSelection;
};
