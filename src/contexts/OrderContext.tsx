import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc, // ✅ Ajouté pour la suppression
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

/** Limite les écoutes temps réel : évite de télécharger TOUT l'historique (lenteur / Mo data). */
const ORDERS_LISTEN_LIMIT = 80;
import { db } from "@/config/firebase";
import { useAuth } from "./AuthContext";

/* =======================
    TYPES
======================= */
export interface Order {
  id: string;
  userId: string;
  items: any[]; 
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "failed";
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
  deleteOrder: (orderId: string) => Promise<void>; // ✅ Ajouté au type
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
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(ORDERS_LISTEN_LIMIT)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
      const data = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();

        // Normalisation des items avec nettoyage des URLs d'images (Glide Fix)
        const normalizedItems = (d.items || []).map((item: any) => {
          let cleanImage = item.image || item.imageUrl || null;

          if (cleanImage && typeof cleanImage === "string") {
            cleanImage = cleanImage.trim().replace(/[\s\u0000-\u001F\u007F-\u009F\uFEFF]+/g, "");
            // Correction spécifique Firebase Storage
            if (cleanImage.includes('/products/') && !cleanImage.includes('products%2F')) {
              cleanImage = cleanImage.replace('/products/', '/products%2F');
            }
          }

          return {
            ...item,
            image: cleanImage,
            name: item.name || item.productName || "Produit sans nom",
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1
          };
        });

        // Anti-doublons (certains paiements/retours peuvent ramener des lignes répétées).
        // On fusionne les lignes ayant le même `id` (souvent le cartId) en additionnant la quantité.
        const dedupedItems = (() => {
          const byKey = new Map<string, any>();
          normalizedItems.forEach((it: any) => {
            const key = String(it?.id ?? it?.cartId ?? it?.productId ?? it?.name ?? "");
            if (!key) return;

            const qty = Number(it.quantity) || 0;
            if (byKey.has(key)) {
              const existing = byKey.get(key);
              existing.quantity = Number(existing.quantity) + qty;

              // Garder un meilleur prix si jamais l'un des doublons est à 0
              if ((Number(existing.price) || 0) === 0 && (Number(it.price) || 0) > 0) {
                existing.price = Number(it.price) || 0;
              }
              if (!existing.image && it.image) existing.image = it.image;
              if (!existing.imageUrl && it.imageUrl) existing.imageUrl = it.imageUrl;
            } else {
              byKey.set(key, { ...it, quantity: qty || 1 });
            }
          });
          return Array.from(byKey.values());
        })();

        const rawStatus = d.status ? String(d.status).toLowerCase().trim() : "pending";
        // Normalisation : le backend/PC peut stocker "paid" ou "pending_payment"
        const normalizedStatus =
          rawStatus === "paid"
            ? "confirmed"
            : rawStatus === "pending_payment"
              ? "pending"
              : rawStatus;

        return {
          id: docSnap.id,
          ...d,
          items: dedupedItems,
          total: Number(d.total) || 0,
          status: normalizedStatus,
          createdAt: d.createdAt instanceof Timestamp
            ? d.createdAt.toDate()
            : new Date()
        } as Order;
      });

      // Tri par date décroissante
      data.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

      setOrders(data);
      setLoading(false);
    },
    (err) => {
      console.error("[OrderContext] onSnapshot orders:", err);
      setLoading(false);
      // Index manquant possible : créer l’index composite userId + createdAt (lien dans la console Firebase)
    }
    );

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

  // ✅ NOUVELLE FONCTION : Suppression de commande
  const deleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, "orders", orderId));
    } catch (error) {
      console.error("Erreur lors de la suppression de la commande:", error);
      throw error;
    }
  };

  const getOrderById = (id: string) => orders.find(o => o.id === id);

  return (
    <OrderContext.Provider value={{ 
      orders, 
      loading, 
      createOrder, 
      updateOrderStatus, 
      deleteOrder, // ✅ Ajouté ici
      getOrderById 
    }}>
      {children}
    </OrderContext.Provider>
  );
};

export const useOrders = () => {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error("useOrders must be used within OrderProvider");
  return ctx;
};