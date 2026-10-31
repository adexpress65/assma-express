import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { AppState } from "react-native";

/** Limite les écoutes temps réel : évite de télécharger TOUT l'historique (lenteur / Mo data). */
const ORDERS_LISTEN_LIMIT = 80;
import { db } from "@/config/firebase";
import { useAuth } from "./AuthContext";
import {
  dedupeOrderLineItems,
  pickOrderItemsArray,
} from "@/utils/orderLineItemsDedupe";
import type { FulfillmentStatus } from "@/constants/Config";
import { isFulfillmentStatus } from "@/constants/Config";
import {
  clearInFlightPayment,
  isOrderAwaitingNgeniusPayment,
  peekInFlightPayment,
  verifyOrderWithBackend,
} from "@/services/ngeniusVerify";

/* =======================
    TYPES
======================= */
export interface Order {
  id: string;
  orderId?: string;
  userId: string;
  items: any[];
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled" | "failed";
  /** Statut logistique (indépendant du paiement). */
  fulfillmentStatus?: FulfillmentStatus;
  /** Dernier kilomètre : retrait entrepôt ou domicile. */
  deliveryMode?: "pickup" | "home" | "unknown";
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
  provider?: string;
  /** Avis client enregistré sur la commande */
  customerReview?: {
    rating: number;
    comment?: string;
    createdAt: Date | null;
  };
}

interface OrderContextType {
  orders: Order[];
  loading: boolean;
  createOrder: (data: any) => Promise<string>;
  updateOrderStatus: (orderId: string, status: Order["status"]) => Promise<void>;
  updateFulfillmentStatus: (orderId: string, fulfillmentStatus: FulfillmentStatus) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  getOrderById: (id: string) => Order | undefined;
  /** Listener temps réel : no-op (compat écran commandes) */
  refreshOrders: () => Promise<void>;
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

          const rawItems = pickOrderItemsArray(d as Record<string, unknown>);

          const normalizedItems = rawItems.map((item: any) => {
            let cleanImage = item.image || item.imageUrl || null;

            if (cleanImage && typeof cleanImage === "string") {
              cleanImage = cleanImage.trim().replace(/[\s\u0000-\u001F\u007F-\u009F\uFEFF]+/g, "");
              if (cleanImage.includes("/products/") && !cleanImage.includes("products%2F")) {
                cleanImage = cleanImage.replace("/products/", "/products%2F");
              }
            }

            return {
              ...item,
              image: cleanImage,
              name: item.name || item.productName || "Produit sans nom",
              price: Number(item.price) || 0,
              quantity: Number(item.quantity) || 1,
              selectedColor: item.selectedColor ?? item.color ?? null,
              selectedSize: item.selectedSize ?? item.size ?? null,
              color: item.color ?? item.selectedColor ?? null,
              size: item.size ?? item.selectedSize ?? null,
            };
          });

          const dedupedItems = dedupeOrderLineItems(normalizedItems) as any[];

          const cr = d.customerReview as Record<string, unknown> | undefined;
          const customerReview =
            cr && typeof cr === "object"
              ? {
                  rating: Number(cr.rating) || 0,
                  comment: typeof cr.comment === "string" ? cr.comment : undefined,
                  createdAt:
                    cr.createdAt instanceof Timestamp
                      ? cr.createdAt.toDate()
                      : null,
                }
              : undefined;

          const rawStatus = d.status ? String(d.status).toLowerCase().trim() : "pending";
          // Normalisation : le backend/PC peut stocker "paid" ou "pending_payment"
          const normalizedStatus =
            rawStatus === "paid"
              ? "confirmed"
              : rawStatus === "pending_payment"
                ? "pending"
                : rawStatus;

          const fulfillmentStatus = isFulfillmentStatus(d.fulfillmentStatus)
            ? d.fulfillmentStatus
            : undefined;
          const rawMode = String(d.deliveryMode ?? "").toLowerCase().trim();
          const deliveryMode =
            rawMode === "pickup" || rawMode === "home" || rawMode === "unknown"
              ? rawMode
              : undefined;

          return {
            id: docSnap.id,
            ...d,
            items: dedupedItems,
            total: Number(d.total) || 0,
            status: normalizedStatus,
            fulfillmentStatus,
            deliveryMode,
            customerReview,
            createdAt: d.createdAt instanceof Timestamp
              ? d.createdAt.toDate()
              : new Date()
          } as Order;
        });

        // 1. Tri par date décroissante
        data.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

        // 2. ✅ FILTRE DE DÉDUPLICATION AUTOMATIQUE
        const seenKeys = new Set<string>();
        const uniqueOrders = data.filter((order) => {
          // Clé unique basée prioritairement sur orderId (ex: ORD-170000) ou sur l'id de document
          const uniqueKey = order.orderId || order.id;
          if (seenKeys.has(uniqueKey)) {
            return false; // Ignore le doublon
          }
          seenKeys.add(uniqueKey);
          return true;
        });

        setOrders(uniqueOrders);
        setLoading(false);
      },
      (err) => {
        console.error("[OrderContext] onSnapshot orders:", err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const ordersRef = useRef<Order[]>([]);
  const reconcilingRef = useRef(false);
  const lastVerifyAttemptRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const reconcilePendingPayments = useCallback(async () => {
    if (!user || reconcilingRef.current) return;
    reconcilingRef.current = true;
    try {
      const storedId = await peekInFlightPayment().catch(() => null);
      const now = Date.now();
      const ids = new Set<string>();

      for (const order of ordersRef.current) {
        const createdAt = order.createdAt?.getTime?.() ?? 0;
        const isRecent = !createdAt || now - createdAt < 72 * 60 * 60 * 1000;
        if (isRecent && isOrderAwaitingNgeniusPayment(order)) {
          ids.add(order.id);
        }
      }
      if (storedId) ids.add(storedId);

      for (const id of ids) {
        const last = lastVerifyAttemptRef.current.get(id) ?? 0;
        if (now - last < 15000) continue;
        lastVerifyAttemptRef.current.set(id, now);
        try {
          const result = await verifyOrderWithBackend(id);
          if (result.isPaid || result.isFailed) {
            await clearInFlightPayment(id);
          }
        } catch (err) {
          lastVerifyAttemptRef.current.delete(id);
          console.log("[OrderContext] Vérification NGenius indisponible", {
            orderId: id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } finally {
      reconcilingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (!user || loading) return;
    void reconcilePendingPayments();
  }, [user, loading, orders, reconcilePendingPayments]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void reconcilePendingPayments();
    });
    return () => sub.remove();
  }, [reconcilePendingPayments]);

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

  const updateFulfillmentStatus = async (
    orderId: string,
    fulfillmentStatus: FulfillmentStatus,
  ) => {
    await updateDoc(doc(db, "orders", orderId), {
      fulfillmentStatus,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, "orders", orderId));
    } catch (error) {
      console.error("Erreur lors de la suppression de la commande:", error);
      throw error;
    }
  };

  const getOrderById = (id: string) => orders.find(o => o.id === id);

  const refreshOrders = async () => {
    await reconcilePendingPayments();
  };

  return (
    <OrderContext.Provider value={{ 
      orders, 
      loading, 
      createOrder, 
      updateOrderStatus,
      updateFulfillmentStatus,
      deleteOrder,
      getOrderById,
      refreshOrders,
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