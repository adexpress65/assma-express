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
  /** Une ligne panier = une combinaison couleur + taille unique (`cartId`). */
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
  /** Hub d'origine (frais d'entrepôt — produits 0 FCFA) */
  originWarehouseId?: string | null;
  originWarehouseLabel?: string | null;
}

export interface WarehouseFeeSummaryLine {
  warehouseId: string;
  label: string;
  feeUsd: number;
  feeXof: number;
}

export interface CartSummary {
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  /** Détail frais d'entrepôt (une ligne par hub distinct) */
  warehouseFees?: WarehouseFeeSummaryLine[];
  /** Total frais d'entrepôt en XOF */
  warehouseFeeTotal?: number;
}

/** Données passées lors de l'ajout au panier (champs acceptés par addToCart) */
export interface AddToCartInput {
  id: string;
  name?: string;
  /** Snapshot XOF au moment de l’ajout (ne plus recalculer ensuite). */
  price?: number | string;
  /** Alias explicite du snapshot XOF ; prioritaire sur `price` si présent. */
  priceXOF?: number | string;
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
  originWarehouseId?: string | null;
  originWarehouseLabel?: string | null;
}
