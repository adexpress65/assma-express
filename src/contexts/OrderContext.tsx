// src/contexts/OrderContext.tsx
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
  orderBy,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useCart, CartItem } from './CartContext';

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  address: {
    fullName: string;
    street: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  shipping: {
    method: string;
    cost: number;
    details: string;
    deliveryTime: string;
  };
  payment: {
    method: string;
    amount: number;
    status: 'pending' | 'paid' | 'failed';
    transactionId?: string;
  };
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  subtotal: number;
  tax: number;
  total: number;
  wholesale: {
    isWholesale: boolean;
    savings: number;
    totalQuantity: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface OrderContextType {
  orders: Order[];
  loading: boolean;
  createOrder: (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateOrderStatus: (orderId: string, status: Order['status']) => Promise<void>;
  getOrderById: (orderId: string) => Order | undefined;
  getOrdersByStatus: (status: Order['status']) => Order[];
  getOrdersCountByStatus: () => {
    pending: number;
    confirmed: number;
    shipped: number;
    delivered: number;
    cancelled: number;
  };
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const OrderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      if (!user) {
        setOrders([]);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }

    const ordersQuery = query(
      collection(db, 'orders'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(ordersQuery, 
      (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        } as Order));
        setOrders(ordersData);
      },
      (error) => {
        console.error('Erreur écoute commandes Firebase:', error);
      }
    );

    return unsubscribe;
  }, [user]);

  const createOrder = async (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    if (!user) {
      throw new Error('Utilisateur non connecté');
    }

    try {
      const orderWithMetadata = {
        ...orderData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await addDoc(collection(db, 'orders'), orderWithMetadata);
      return docRef.id;
    } catch (error) {
      console.error('Erreur création commande:', error);
      throw error;
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Erreur mise à jour statut commande:', error);
      throw error;
    }
  };

  const getOrderById = (orderId: string) => {
    return orders.find(order => order.id === orderId);
  };

  const getOrdersByStatus = (status: Order['status']) => {
    return orders.filter(order => order.status === status);
  };

  const getOrdersCountByStatus = () => {
    const counts = {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };

    orders.forEach(order => {
      if (counts.hasOwnProperty(order.status)) {
        counts[order.status as keyof typeof counts]++;
      }
    });

    return counts;
  };

  return (
    <OrderContext.Provider value={{
      orders,
      loading,
      createOrder,
      updateOrderStatus,
      getOrderById,
      getOrdersByStatus,
      getOrdersCountByStatus,
    }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};