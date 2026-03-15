import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "./AuthContext";

/* =======================
    TYPES
======================= */
export interface Order {
  id: string;
  userId: string;
  items: any[]; 
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  total: number;
  createdAt: Date | null;
  updatedAt: Date | null;
  subtotal: number;
  shipping: {
    method: string;
    cost: number;
    deliveryTime: string;
  };
  address: {
    fullName: string;
    street: string;
    city: string;
    phone: string;
  };
  paymentMethod: string;
  paymentStatus: string;
}

interface OrderContextType {
  orders: Order[];
  loading: boolean;
  createOrder: (data: any) => Promise<string>;
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

  const q = query(
    collection(db, "orders"),
    where("userId", "==", user.uid)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {

  const data = snapshot.docs.map((docSnap) => {

    const d = docSnap.data();

    const normalizedItems = (d.items || []).map((item:any) => {

      let cleanImage = item.image || null;

      if (cleanImage && typeof cleanImage === "string") {
        cleanImage = cleanImage.replace(/[\s\u0000-\u001F\u007F-\u009F]+/g,"");
      }

      return {
        ...item,
        image: cleanImage,
        name: item.name || "Produit sans nom",
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1
      };

    });

    return {
      id: docSnap.id,
      ...d,
      items: normalizedItems,
      total: Number(d.total) || 0,
      status: d.status ? d.status.toLowerCase().trim() : "pending",
      createdAt: d.createdAt instanceof Timestamp
        ? d.createdAt.toDate()
        : new Date()
    };

  });

  data.sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime());

  setOrders(data);
  setLoading(false);

});

  return unsubscribe;
}, [user]);

  const createOrder = async (data: any) => {
    if (!user) throw new Error("Utilisateur non connecté");
    const docRef = await addDoc(collection(db, "orders"), {
      ...data,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
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