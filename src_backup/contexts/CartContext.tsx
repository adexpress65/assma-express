import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../config/firebase";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  image?: string;
  imageUrl?: string;
  seller?: string;
  minOrder?: number;
  shipping?: string;
  inStock?: boolean;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: any) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, newQuantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const STORAGE_KEY = "@assma_cart";
  const db = getFirestore(app);
  const auth = getAuth(app);

  // ===============================
  // 🔹 SURVEILLER LA CONNEXION UTILISATEUR
  // ===============================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        await mergeCartWithFirestore(user.uid);
      } else {
        setUserId(null);
      }
    });
    return unsubscribe;
  }, []);

  // ===============================
  // 🔹 CHARGER LE PANIER LOCAL AU DÉMARRAGE
  // ===============================
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setCartItems(JSON.parse(stored));
      } catch (error) {
        console.error("⚠️ Erreur chargement panier local:", error);
      }
    })();
  }, []);

  // ===============================
  // 🔹 SAUVEGARDE AUTOMATIQUE (LOCAL + CLOUD)
  // ===============================
  useEffect(() => {
    if (!cartItems) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cartItems)).catch((e) =>
      console.error("Erreur sauvegarde locale:", e)
    );
    if (userId) syncToFirestore(userId, cartItems);
  }, [cartItems]);

  // ===============================
  // 🔁 SYNCHRONISATION FIRESTORE
  // ===============================
  const getFirestoreCart = async (uid: string): Promise<CartItem[]> => {
    try {
      const ref = doc(db, "users", uid, "data", "cart");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data()?.items || [];
      }
    } catch (error) {
      console.error("⚠️ Erreur lecture Firestore:", error);
    }
    return [];
  };

  const syncToFirestore = async (uid: string, items: CartItem[]) => {
    try {
      const ref = doc(db, "users", uid, "data", "cart");
      await setDoc(ref, { items, updatedAt: new Date() }, { merge: true });
    } catch (error) {
      console.error("⚠️ Erreur synchronisation Firestore:", error);
    }
  };

  // ===============================
  // 🧩 FUSION INTELLIGENTE LOCAL + CLOUD
  // ===============================
  const mergeCartWithFirestore = async (uid: string) => {
    try {
      const localCart = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) || "[]");
      const remoteCart = await getFirestoreCart(uid);

      // Crée une map pour éviter les doublons
      const mergedMap = new Map<string, CartItem>();

      [...localCart, ...remoteCart].forEach((item: CartItem) => {
        if (mergedMap.has(item.id)) {
          const existing = mergedMap.get(item.id)!;
          mergedMap.set(item.id, {
            ...existing,
            quantity: existing.quantity + (item.quantity || 1),
          });
        } else {
          mergedMap.set(item.id, item);
        }
      });

      const mergedCart = Array.from(mergedMap.values());
      setCartItems(mergedCart);

      // Sauvegarde fusionnée dans les deux sources
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mergedCart));
      await syncToFirestore(uid, mergedCart);

      console.log("✅ Panier fusionné entre local & Firestore");
    } catch (error) {
      console.error("⚠️ Erreur fusion panier:", error);
    }
  };

  // ===============================
  // 🛒 LOGIQUE PANIER
  // ===============================
  const addToCart = (product: any) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name || "Produit sans nom",
          price: product.price || 0,
          quantity: 1,
          image: product.image || product.imageUrl || `https://picsum.photos/200/200?${product.id}`,
          imageUrl: product.imageUrl,
          seller: product.seller || "ASMA Express",
          minOrder: product.minOrder || 1,
          shipping: product.shipping || "Livraison: 15.99€",
          inStock: product.inStock ?? true,
        },
      ];
    });
  };

  const removeFromCart = (productId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const clearCart = async () => {
    setCartItems([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
    if (userId) await syncToFirestore(userId, []);
  };

  const getTotalPrice = () =>
    cartItems.reduce(
      (total, item) => total + (item.price || 0) * (item.quantity || 0),
      0
    );

  const getTotalItems = () =>
    cartItems.reduce((total, item) => total + (item.quantity || 0), 0);

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
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
