// contexts/CartContext.tsx - VERSION CORRIGÉE
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../config/firebase";

// Taux de conversion fixe (1 USD = 650 XOF)
const EXCHANGE_RATE = 650;

export interface CartItem {
  id: string;
  cartId: string;
  name: string;
  price: number;           // ✅ TOUJOURS en XOF (brut Firebase)
  originalCurrency: 'XOF';
  quantity: number;
  image?: string | null;
  selectedSize?: string | null;
  selectedColor?: string | null;
  seller?: string | null;
  minOrder?: number | null;
  inStock?: boolean | null;
  variantInfo?: {
    basePrice?: number;
    priceAdjustment?: number;
    variantId?: string;
  } | null;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: any) => void;
  removeFromCart: (cartId: string) => void;
  updateQuantity: (cartId: string, newQuantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const sanitizeForFirestore = (data: any): any => {
  if (data === undefined || data === null) return null;
  if (Array.isArray(data)) return data.map(item => sanitizeForFirestore(item));
  if (typeof data === 'object' && !(data instanceof Date)) {
    const sanitized: any = {};
    Object.keys(data).forEach(key => { sanitized[key] = sanitizeForFirestore(data[key]); });
    return sanitized;
  }
  return data;
};

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const isInitialMount = useRef(true);
  const syncTimeout = useRef<NodeJS.Timeout | null>(null);

  const STORAGE_KEY = "@assma_cart";

  const saneQty = (q: any): number => {
    const n = Math.floor(Number(q));
    return (!Number.isFinite(n) || n < 1) ? 1 : (n > 999 ? 999 : n);
  };

  // 🔐 AUTH LISTENER
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        mergeCartWithFirestore(user.uid);
      } else {
        setUserId(null);
      }
    });
  }, []);

  // 📦 LOAD LOCAL
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCartItems(parsed.map((item: any) => ({
            ...item,
            cartId: item.cartId || `${item.id}-${item.selectedSize || 'NS'}-${item.selectedColor || 'NS'}`,
            quantity: saneQty(item.quantity),
            originalCurrency: 'XOF',
          })));
        } catch (e) { console.error("Err parse local cart", e); }
      }
    });
  }, []);

  // 💾 AUTO SAVE & SYNC
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems));

    if (userId) {
      if (syncTimeout.current) clearTimeout(syncTimeout.current);
      syncTimeout.current = setTimeout(() => {
        syncToFirestore(userId, cartItems);
      }, 2000);
    }
  }, [cartItems, userId]);

  const syncToFirestore = async (uid: string, items: CartItem[]) => {
    try {
      const ref = doc(db, "users", uid, "data", "cart");
      
      console.log("🔥 SYNC TO FIRESTORE:", {
        itemsCount: items.length,
        samplePrice: items[0]?.price,
        totalXOF: items.reduce((sum, i) => sum + (i.price * i.quantity), 0)
      });
      
      const dataToSave = sanitizeForFirestore({
        items: items.map(item => ({
          ...item,
          originalCurrency: undefined,
        })),
        updatedAt: new Date(),
        totalPrice: items.reduce((sum, i) => sum + (i.price * i.quantity), 0)
      });
      await setDoc(ref, dataToSave, { merge: true });
    } catch (error) { console.error("⚠️ Firestore Sync Error:", error); }
  };

  const mergeCartWithFirestore = async (uid: string) => {
    try {
      const ref = doc(db, "users", uid, "data", "cart");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const remoteItems = snap.data()?.items || [];
        
        console.log("🔥 MERGE FROM FIRESTORE:", {
          remoteCount: remoteItems.length,
          samplePrice: remoteItems[0]?.price,
        });
        
        setCartItems(prev => {
          const merged = [...prev];
          remoteItems.forEach((ri: any) => {
            if (!merged.find(li => li.cartId === ri.cartId)) {
              merged.push({
                ...ri,
                originalCurrency: 'XOF',
              });
            }
          });
          return merged;
        });
      }
    } catch (e) { console.error("Merge error", e); }
  };

  // ✅ ADD TO CART - VERSION SIMPLIFIÉE ET CORRIGÉE
  const addToCart = (product: any) => {
    console.log("🔍 ADD TO CART - INPUT:", {
      id: product.id,
      name: product.name,
      price: product.price,
      selectedSize: product.selectedSize,
      selectedColor: product.selectedColor,
    });

    setCartItems((prev) => {
      const uniqueCartId = `${product.id}-${product.selectedSize || 'NS'}-${product.selectedColor || 'NS'}`;
      const existing = prev.find((i) => i.cartId === uniqueCartId);
      const qtyToAdd = saneQty(product.quantity ?? 1);

      // ✅ SIMPLIFICATION : Utiliser directement le prix fourni
      // Le prix correct est déjà calculé dans l'écran produit
      const finalPrice = Number(product.price) || 0;

      if (finalPrice === 0) {
        console.error("❌ Prix invalide:", product);
      }

      const newItem: CartItem = {
        id: product.id,
        cartId: uniqueCartId,
        name: product.name || "Produit",
        price: finalPrice,  // ✅ Utilise directement le prix de l'écran produit
        originalCurrency: 'XOF',
        quantity: qtyToAdd,
        image: product.image ?? product.imageUrl ?? product.mainImage ?? null,
        selectedSize: product.selectedSize || null,
        selectedColor: product.selectedColor || null,
        seller: product.seller ?? product.supplier ?? product.companyName ?? "ASMA Express",
        minOrder: Number(product.minOrder) || 1,
        inStock: product.inStock ?? true,
        variantInfo: product.variantInfo ? {
          basePrice: product.variantInfo.basePrice,
          priceAdjustment: product.variantInfo.priceAdjustment,
          variantId: product.variantInfo.variantId,
        } : null,
      };

      console.log("✅ ITEM STORED:", {
        price: newItem.price,
        cartId: newItem.cartId,
      });

      if (existing) {
        return prev.map((i) => 
          i.cartId === uniqueCartId 
            ? { ...i, quantity: saneQty(i.quantity + qtyToAdd) } 
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
    AsyncStorage.removeItem(STORAGE_KEY);
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