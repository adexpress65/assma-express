import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "./AuthContext";
import { CartItem } from "./CartContext";

/* =======================
    TYPES AMÉLIORÉS
======================= */

export interface Order {
  id: string;
  userId: string;
  items: CartItem[]; // Contient maintenant cartId, selectedSize, selectedColor
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  total: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  subtotal: number;
  shipping: {
    method: "Air" | "Sea" | "Standard"; // Les types que nous avons définis
    cost: number;
    deliveryTime: string;
    trackingNumber?: string;
    weight?: number; // Pour le calcul Assma Express
  };
  address: {
    fullName: string;
    street: string;
    city: string;
    phone: string;
    country: string;
  };
  paymentMethod: string;
  paymentStatus: "unpaid" | "paid" | "refunded";
}

interface OrderContextType {
  orders: Order[];
  loading: boolean;
  createOrder: (data: Omit<Order, "id" | "createdAt" | "updatedAt">) => Promise<string>;
  updateOrderStatus: (orderId: string, status: Order["status"]) => Promise<void>;
  getOrderById: (id: string) => Order | undefined;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

/* =======================
    PROVIDER
======================= */

export const OrderProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Note: Assure-toi d'avoir créé l'index composé sur Firebase (userId: ASC, createdAt: DESC)
    const q = query(
      collection(db, "orders"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const data: Order[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            ...d,
            createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : null,
            updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toDate() : null,
          } as Order;
        });

        setOrders(data);
        setLoading(false);
      }, 
      (error) => {
        console.error("🔥 Firestore OrderContext Error:", error.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  /* =======================
      ACTIONS
  ======================= */

  const createOrder = async (data: Omit<Order, "id" | "createdAt" | "updatedAt">) => {
    if (!user) throw new Error("Utilisateur non connecté");

    try {
      const docRef = await addDoc(collection(db, "orders"), {
        ...data,
        userId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (e) {
      console.error("Erreur création commande:", e);
      throw e;
    }
  };

  const updateOrderStatus = async (orderId: string, status: Order["status"]) => {
    await updateDoc(doc(db, "orders", orderId), {
      status,
      updatedAt: serverTimestamp(),
    });
  };

  const getOrderById = (id: string) => orders.find(o => o.id === id);

  return (
    <OrderContext.Provider value={{ orders, loading, createOrder, updateOrderStatus, getOrderById }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrders must be used within OrderProvider");
  return ctx;
};