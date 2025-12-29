// src/contexts/CartContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  where,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  image: string;
  seller: string;
  minOrder: number;
  shipping: string;
  inStock: boolean;
  userId?: string;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: any) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, newQuantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  getTotalPrice: () => number;
  getTotalItems: () => number;
  loading: boolean;
  syncCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      if (!user) {
        setCartItems([]);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setCartItems([]);
      return;
    }

    const cartQuery = query(collection(db, 'cart'), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(cartQuery, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as CartItem));
        setCartItems(items);
      },
      (error) => {
        console.error('Erreur écoute Firebase:', error);
      }
    );

    return unsubscribe;
  }, [user]);

  const syncCart = async () => {
    if (!user) return;

    try {
      const cartQuery = query(collection(db, 'cart'), where('userId', '==', user.uid));
      const snapshot = await getDocs(cartQuery);
      const firebaseCart = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CartItem));

      setCartItems(firebaseCart);
    } catch (error) {
      console.error('Erreur synchronisation:', error);
    }
  };

  const addToCart = async (product: any) => {
    if (!user) {
      setCartItems(prev => {
        const existing = prev.find(item => item.productId === product.id);
        if (existing) {
          return prev.map(item =>
            item.productId === product.id 
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }
        
        return [...prev, {
          id: `local_${Date.now()}`,
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          image: product.imageUrl || product.image || `https://picsum.photos/200/200?${product.id}`,
          seller: product.seller || 'ASMA Express',
          minOrder: product.minOrder || 1,
          shipping: product.shipping || 'Livraison gratuite',
          inStock: product.inStock !== undefined ? product.inStock : true
        }];
      });
      return;
    }

    try {
      const existingQuery = query(
        collection(db, 'cart'),
        where('userId', '==', user.uid),
        where('productId', '==', product.id)
      );
      
      const snapshot = await getDocs(existingQuery);
      
      const productData: any = {
        userId: user.uid,
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.imageUrl || product.image,
        seller: product.seller || 'ASMA Express',
        minOrder: product.minOrder || 1,
        shipping: product.shipping || 'Livraison gratuite',
        inStock: product.inStock !== undefined ? product.inStock : true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (product.originalPrice !== undefined) {
        productData.originalPrice = product.originalPrice;
      }

      if (!snapshot.empty) {
        const existingDoc = snapshot.docs[0];
        const currentQuantity = existingDoc.data().quantity;
        
        await updateDoc(doc(db, 'cart', existingDoc.id), {
          quantity: currentQuantity + 1,
          updatedAt: new Date()
        });
      } else {
        await addDoc(collection(db, 'cart'), productData);
      }
    } catch (error) {
      console.error('Erreur ajout panier Firebase:', error);
      addToCartLocal(product);
    }
  };

  const addToCartLocal = (product: any) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item =>
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      return [...prev, {
        id: `local_${Date.now()}`,
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.imageUrl || product.image,
        seller: product.seller || 'ASMA Express',
        minOrder: product.minOrder || 1,
        shipping: product.shipping || 'Livraison gratuite',
        inStock: product.inStock !== undefined ? product.inStock : true
      }];
    });
  };

  const removeFromCart = async (productId: string) => {
    if (!user) {
      setCartItems(prev => prev.filter(item => item.productId !== productId));
      return;
    }

    try {
      const cartQuery = query(
        collection(db, 'cart'),
        where('userId', '==', user.uid),
        where('productId', '==', productId)
      );
      
      const snapshot = await getDocs(cartQuery);
      if (!snapshot.empty) {
        await deleteDoc(doc(db, 'cart', snapshot.docs[0].id));
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      setCartItems(prev => prev.filter(item => item.productId !== productId));
    }
  };

  const updateQuantity = async (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      await removeFromCart(productId);
      return;
    }

    if (!user) {
      setCartItems(prev => 
        prev.map(item => 
          item.productId === productId ? { ...item, quantity: newQuantity } : item
        )
      );
      return;
    }

    try {
      const cartQuery = query(
        collection(db, 'cart'),
        where('userId', '==', user.uid),
        where('productId', '==', productId)
      );
      
      const snapshot = await getDocs(cartQuery);
      if (!snapshot.empty) {
        await updateDoc(doc(db, 'cart', snapshot.docs[0].id), {
          quantity: newQuantity,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Erreur mise à jour quantité:', error);
      setCartItems(prev => 
        prev.map(item => 
          item.productId === productId ? { ...item, quantity: newQuantity } : item
        )
      );
    }
  };

  const clearCart = async () => {
    if (!user) {
      setCartItems([]);
      return;
    }

    try {
      const cartQuery = query(collection(db, 'cart'), where('userId', '==', user.uid));
      const snapshot = await getDocs(cartQuery);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      console.error('Erreur vidage panier:', error);
      setCartItems([]);
    }
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      getTotalPrice,
      getTotalItems,
      loading,
      syncCart
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};