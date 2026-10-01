// contexts/CartContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../config/firebase";
import { isZeroDollarsProduct } from "../utils/zeroDollarsShop";
import { getClientPriceXOF } from "../utils/productPrice";
import {
  isZeroFcfaCatalogPrice,
  ZERO_FCFA_UNAVAILABLE_MESSAGE,
} from "../utils/warehouseFee";
import type { CartItem, AddToCartInput } from "../types/cart";
import { MAX_ORDER_QUANTITY } from "../constants/order";
import { buildCartLineId } from "../utils/orderItemVariants";

// Ré-export pour rétrocompatibilité avec les fichiers qui importent CartItem depuis ce module
export type { CartItem } from "../types/cart";

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: AddToCartInput) => void;
  removeFromCart: (cartId: string) => void;
  updateQuantity: (cartId: string, newQuantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// --- UTILITAIRES DE NETTOYAGE ---

const fixFirebaseUrl = (url: unknown): string | null => {
  if (!url || typeof url !== 'string') return null;
  try {
    // Décode l'URL pour éviter le double encodage qui cause l'erreur 400 sur Android
    // et retire les espaces parasites
    return decodeURIComponent(url.trim());
  } catch (e) {
    return url.trim();
  }
};

const sanitizeForFirestore = (data: unknown): unknown => {
  if (data === undefined || data === null) return null;
  if (Array.isArray(data)) return data.map(item => sanitizeForFirestore(item));
  if (typeof data === 'object' && !(data instanceof Date)) {
    const sanitized: Record<string, unknown> = {};
    Object.keys(data as object).forEach(key => {
      sanitized[key] = sanitizeForFirestore((data as Record<string, unknown>)[key]);
    });
    return sanitized;
  }
  return data;
};

// --- PROVIDER ---

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  /** AsyncStorage lu au moins une fois — évite merge Firestore avant le panier local */
  const [storageHydrated, setStorageHydrated] = useState(false);
  const isInitialMount = useRef(true);
  const syncTimeout = useRef<NodeJS.Timeout | null>(null);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;

  const STORAGE_KEY = "@assma_cart"; // Gardé tel quel pour la compatibilité des données existantes
  const CART_TS_KEY = "@assma_cart_updatedAt";

  const saneQty = (q: unknown): number => {
    const n = Math.floor(Number(q));
    return (!Number.isFinite(n) || n < 1) ? 1 : (n > MAX_ORDER_QUANTITY ? MAX_ORDER_QUANTITY : n);
  };

  const normalizeParsedItem = (item: AddToCartInput): CartItem => {
    const cleanPrice = getClientPriceXOF(item);
    const isZero = isZeroDollarsProduct({
      price: cleanPrice,
      companyName: item.companyName ?? item.seller ?? item.supplier,
      supplier: item.supplier ?? undefined,
      seller: item.seller ?? undefined,
      name: item.name ?? "",
    });
    const warehouseId =
      typeof item.originWarehouseId === "string" && item.originWarehouseId.trim()
        ? item.originWarehouseId.trim()
        : null;
    const warehouseLabel =
      typeof item.originWarehouseLabel === "string" &&
      item.originWarehouseLabel.trim()
        ? item.originWarehouseLabel.trim()
        : null;
    return {
      ...item,
      cartId: buildCartLineId(item.id, item.selectedSize, item.selectedColor),
      quantity: saneQty(item.quantity),
      originalCurrency: "XOF",
      image: fixFirebaseUrl(item.image),
      hasFreeShipping: isZero ? false : !!item.hasFreeShipping,
      price: isZero ? 0 : cleanPrice,
      originWarehouseId: warehouseId,
      originWarehouseLabel: warehouseLabel,
    } as CartItem;
  };

  const firestoreUpdatedAtToMs = (v: unknown): number => {
    if (v == null) return 0;
    if (v instanceof Timestamp) return v.toMillis();
    if (typeof (v as Timestamp)?.toMillis === "function") {
      try {
        return (v as Timestamp).toMillis();
      } catch {
        /* ignore */
      }
    }
    if (v instanceof Date) return v.getTime();
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return 0;
  };

  // 🔐 AUTH
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
    });
  }, []);

  // 📦 LOAD LOCAL STORAGE (toujours avant merge Firestore)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stored, ts] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(CART_TS_KEY),
        ]);
        if (!ts) {
          await AsyncStorage.setItem(CART_TS_KEY, String(Date.now()));
        }
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (!cancelled) {
              setCartItems((parsed as AddToCartInput[]).map(normalizeParsedItem));
            }
          } catch (e) {
            console.error("Err parse local cart", e);
          }
        }
      } finally {
        if (!cancelled) setStorageHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ☁️ Après hydratation locale + utilisateur connecté : résoudre conflit local / nuage
  useEffect(() => {
    if (!userId || !storageHydrated) return;
    void mergeCartWithFirestore(userId);
  }, [userId, storageHydrated]);

  // 💾 AUTO SAVE & SYNC
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const now = Date.now();
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));
    void AsyncStorage.setItem(CART_TS_KEY, String(now));

    if (userId) {
      if (syncTimeout.current) clearTimeout(syncTimeout.current);
      syncTimeout.current = setTimeout(() => {
        void syncToFirestore(userId, cartItems, now);
      }, 2000);
    }
  }, [cartItems, userId]);

  const syncToFirestore = async (uid: string, items: CartItem[], updatedAtMs?: number) => {
    try {
      const ref = doc(db, "users", uid, "data", "cart");
      const at = updatedAtMs ?? Date.now();
      const dataToSave = sanitizeForFirestore({
        items: items.map((item) => ({
          ...item,
          originalCurrency: undefined,
        })),
        updatedAt: Timestamp.fromMillis(at),
        totalPrice: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      });
      await setDoc(ref, dataToSave, { merge: true });
    } catch (error) {
      console.error("⚠️ Firestore Sync Error:", error);
    }
  };

  /** Écriture immédiate (vidage panier, éviter que le merge réinjecte l’ancien nuage). */
  const syncToFirestoreImmediate = async (uid: string, items: CartItem[]) => {
    const at = Date.now();
    await AsyncStorage.setItem(CART_TS_KEY, String(at));
    await syncToFirestore(uid, items, at);
  };

  /**
   * Au login : un seul jeu de données gagne (dernier `updatedAt`).
   * Avant : fusion = réinjection de centaines de lignes distantes après suppression locale.
   */
  const mergeCartWithFirestore = async (uid: string) => {
    try {
      const ref = doc(db, "users", uid, "data", "cart");
      const [snap, localJson, localTsStr] = await Promise.all([
        getDoc(ref),
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(CART_TS_KEY),
      ]);

      const localTs = localTsStr ? parseInt(localTsStr, 10) : 0;
      let localItems: CartItem[] = [];
      if (localJson) {
        try {
          localItems = (JSON.parse(localJson) as AddToCartInput[]).map(normalizeParsedItem);
        } catch {
          localItems = [];
        }
      }

      if (!snap.exists()) {
        if (localItems.length > 0) {
          await syncToFirestoreImmediate(uid, localItems);
        }
        return;
      }

      const data = snap.data() as Record<string, unknown>;
      const remoteItems = (data?.items || []) as AddToCartInput[];
      const remoteTs = firestoreUpdatedAtToMs(data?.updatedAt);

      if (localTs > remoteTs) {
        setCartItems(localItems);
        await syncToFirestoreImmediate(uid, localItems);
        return;
      }

      if (localTs < remoteTs) {
        const normalizedRemote = remoteItems.map(normalizeParsedItem);
        setCartItems(normalizedRemote);
        const at = remoteTs || Date.now();
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedRemote));
        await AsyncStorage.setItem(CART_TS_KEY, String(at));
        return;
      }

      // Égalité : garder le panier local s’il contient encore des lignes (évite écrasement fantôme)
      if (localItems.length > 0) {
        setCartItems(localItems);
        await syncToFirestoreImmediate(uid, localItems);
        return;
      }

      const normalizedRemote = remoteItems.map(normalizeParsedItem);
      setCartItems(normalizedRemote);
      const at = remoteTs || Date.now();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedRemote));
      await AsyncStorage.setItem(CART_TS_KEY, String(at));
    } catch (e) {
      console.error("Merge error", e);
    }
  };

  const addToCart = (product: AddToCartInput) => {
    const rawPrice = getClientPriceXOF(product);
    const warehouseId =
      typeof product.originWarehouseId === "string" &&
      product.originWarehouseId.trim()
        ? product.originWarehouseId.trim()
        : null;
    if (isZeroFcfaCatalogPrice(rawPrice) && !warehouseId) {
      throw new Error(ZERO_FCFA_UNAVAILABLE_MESSAGE);
    }

    setCartItems((prev) => {
      const uniqueCartId = buildCartLineId(
        product.id,
        product.selectedSize,
        product.selectedColor,
      );
      const existing = prev.find((i) => i.cartId === uniqueCartId);
      const qtyToAdd = saneQty(product.quantity ?? 1);
      const isZero = isZeroDollarsProduct({
        price: rawPrice,
        basePrice: product.variantInfo?.basePrice ?? product.basePrice,
        companyName: product.companyName ?? product.supplier ?? product.seller,
        supplier: product.supplier,
        seller: product.seller,
        name: product.name,
      });
      const finalPrice = isZero ? 0 : rawPrice;
      const warehouseLabel =
        typeof product.originWarehouseLabel === "string" &&
        product.originWarehouseLabel.trim()
          ? product.originWarehouseLabel.trim()
          : null;

      const cleanStr = (str: unknown) => (typeof str === 'string' ? str.trim() : null);
      const cleanId = (v: unknown) => {
        const s = typeof v === "string" ? v.trim() : "";
        return s.length ? s : null;
      };

      const newItem: CartItem = {
        id: product.id,
        cartId: uniqueCartId,
        name: cleanStr(product.name) || "Produit",
        price: finalPrice,
        originalCurrency: 'XOF',
        quantity: qtyToAdd,
        // ✅ APPLICATION DU FIX IMAGE ICI
        image: fixFirebaseUrl(product.image ?? product.imageUrl ?? product.mainImage),
        selectedSize: cleanStr(product.selectedSize),
        selectedColor: cleanStr(product.selectedColor),
        seller: cleanStr(product.seller ?? product.supplier ?? product.companyName) || "A2Express",
        sellerId: cleanId(product.sellerId ?? product.companyId ?? product.storeId ?? product.merchantId),
        minOrder: Number(product.minOrder) || 1,
        inStock: product.inStock ?? true,
        hasFreeShipping: isZero ? false : (product.hasFreeShipping ?? false), 
        variantInfo: product.variantInfo ? {
          basePrice: product.variantInfo.basePrice,
          priceAdjustment: product.variantInfo.priceAdjustment,
          variantId: product.variantInfo.variantId,
        } : null,
        originWarehouseId: warehouseId,
        originWarehouseLabel: warehouseLabel,
        ...(product.specifications != null
          ? { specifications: product.specifications }
          : {}),
      };

      if (existing) {
        return prev.map((i) => 
          i.cartId === uniqueCartId 
            ? {
                ...i,
                quantity: saneQty(i.quantity + qtyToAdd),
                originWarehouseId: warehouseId ?? i.originWarehouseId,
                originWarehouseLabel: warehouseLabel ?? i.originWarehouseLabel,
                ...(i.specifications == null && product.specifications != null
                  ? { specifications: product.specifications }
                  : {}),
              }
            : i
        );
      }
      return [...prev, newItem];
    });
  };

  const removeFromCart = (cartId: string) => {
    setCartItems((prev) => prev.filter((i) => i.cartId !== cartId));
  };

  const updateQuantity = (cartId: string, rawQty: number) => {
    setCartItems((prev) => prev.map((i) => 
      i.cartId === cartId ? { ...i, quantity: saneQty(rawQty) } : i
    ));
  };

  const clearCart = () => {
    setCartItems([]);
    const at = Date.now();
    void AsyncStorage.multiRemove([STORAGE_KEY]);
    void AsyncStorage.setItem(CART_TS_KEY, String(at));
    const uid = userIdRef.current;
    if (uid) {
      void syncToFirestoreImmediate(uid, []);
    }
  };

  const getTotalPrice = () => cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const getTotalItems = () => cartItems.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider 
      value={{ 
        cartItems, 
        addToCart, 
        removeFromCart, 
        updateQuantity, 
        clearCart, 
        getTotalPrice, 
        getTotalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
};
