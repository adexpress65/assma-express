// Types panier — source de vérité pour CartContext et le checkout
import type { ProductVariantInfo, ProductSpecifications } from './product';

export interface CartItem {
  id: string;
  cartId: string;
  name: string;
  /** Prix toujours en XOF */
  price: number;
  originalCurrency: 'XOF';
  quantity: number;
  image?: string | null;
  selectedSize?: string | null;
  selectedColor?: string | null;
  seller?: string | null;
  sellerId?: string | null;
  minOrder?: number | null;
  inStock?: boolean | null;
  hasFreeShipping?: boolean;
  variantInfo?: ProductVariantInfo | null;
  /** Pour frais de port (checkout) */
  specifications?: ProductSpecifications | null;
}

export interface CartSummary {
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
}

/** Données passées lors de l'ajout au panier (champs acceptés par addToCart) */
export interface AddToCartInput {
  id: string;
  name?: string;
  price?: number | string;
  quantity?: number | string;
  image?: string | null;
  imageUrl?: string | null;
  mainImage?: string | null;
  selectedSize?: string | null;
  selectedColor?: string | null;
  seller?: string | null;
  supplier?: string | null;
  companyName?: string | null;
  sellerId?: string | null;
  companyId?: string | null;
  storeId?: string | null;
  merchantId?: string | null;
  minOrder?: number | string | null;
  inStock?: boolean | null;
  hasFreeShipping?: boolean;
  basePrice?: number;
  variantInfo?: ProductVariantInfo | null;
  specifications?: ProductSpecifications | null;
}
