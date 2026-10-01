// Types produit — utilisés par Algolia, Firestore et les écrans

export interface ProductVariantInfo {
  basePrice?: number;
  priceAdjustment?: number;
  variantId?: string;
}

/** Devise de saisie vendeur. Absent sur les produits existants → XOF. */
export type ProductPriceCurrency = 'XOF' | 'CNY' | 'USD';

export interface ProductSpecifications {
  /** Chaîne ou nombre (Firestore / formulaires) */
  weight?: number | string;
  volume?: number | string;
  modelNumber?: string;
  dimensions?: string;
}

/** Champs entrepôt d'origine (frais logistique 0 FCFA) */
export type ProductWarehouseOrigin = {
  originWarehouseId?: string | null;
  originWarehouseLabel?: string | null;
};

/** Représente un hit Algolia (index "products") */
export interface AlgoliaHit {
  objectID: string;
  name?: string;
  /** Prix client — toujours en XOF (alias historique de priceXOF). */
  price?: number;
  /** Prix saisi par le vendeur dans `priceCurrency` (ne jamais afficher au client). */
  priceOriginal?: number;
  priceCurrency?: ProductPriceCurrency | string;
  /** Prix converti en F CFA. Fallback : `price`. */
  priceXOF?: number;
  currency?: string;
  supplier?: string;
  companyName?: string;
  companyId?: string;
  storeId?: string;
  merchantId?: string;
  sellerId?: string;
  mainImage?: string;
  imageUrl?: string;
  image?: string;
  images?: string[];
  featured?: boolean;
  updatedAt?: number;
  category?: string;
  categoryName?: string;
  /** Sous-rayon (facette Algolia recommandée pour filtrage strict) */
  subCategory?: string;
  description?: string;
  inStock?: boolean;
  hasFreeShipping?: boolean;
  minOrder?: number;
  visualScore?: number;
  /** Similarité cosinus CLIP brute 0–1 (recherche vectorielle), si fournie par l’API */
  similarity?: number;
  /** Indique qu'une correspondance exacte d'image a été trouvée */
  isExactImageMatch?: boolean;
  /** Origine du hit (Firestore / ancienne API / recherche vectorielle CLIP) */
  sourceType?: 'firebase' | 'api' | 'vector_clip';
  specifications?: ProductSpecifications;
  variantInfo?: ProductVariantInfo;
  /** Voir `getLocalizedProductText` — synchronisé depuis Firestore via `onProductWrite` */
  localizedNames?: Record<string, string>;
  localizedDescriptions?: Record<string, string>;
  i18n?: { name?: Record<string, string>; description?: Record<string, string> };
  name_en?: string;
  name_zh?: string;
  name_ar?: string;
  name_de?: string;
  name_es?: string;
  name_pt?: string;
  name_fr?: string;
  description_en?: string;
  description_zh?: string;
  /** Langue source du catalogue (ex. fr). */
  defaultLocale?: string;
}

/** Carte sélectionnée pour la recherche par image */
export interface SelectedImageCard {
  objectID: string;
  __selectedImage: true;
  imageUri: string;
}

/** Produit minimal utilisé dans l'API REST interne */
export interface ApiProduct {
  id: string;
  name: string;
  price: number;
  image?: string;
  imageUrl?: string;
  description?: string;
  categoryId?: string;
}
