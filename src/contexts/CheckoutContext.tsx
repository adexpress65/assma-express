import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { OrderData, ShippingAddress, ShippingSelection } from '../types/order';
import type { CartSummary } from '../types/cart';

interface CheckoutContextType {
  orderData: OrderData | null;
  /** Initialise la commande depuis le panier (appelé dans cart.tsx) */
  initOrder: (data: OrderData) => void;
  /** Met à jour l'adresse de livraison (étape 1) */
  setShippingAddress: (address: ShippingAddress) => void;
  /** Met à jour le choix de livraison et recalcule le total (étape 2) */
  setShipping: (selection: ShippingSelection) => void;
  /** Met à jour le résumé financier */
  setSummary: (summary: CartSummary) => void;
  /** Vide la commande en cours (après paiement réussi) */
  clearOrder: () => void;
}

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [orderData, setOrderData] = useState<OrderData | null>(null);

  const initOrder = useCallback((data: OrderData) => {
    setOrderData((prev) => ({
      ...prev,
      ...data,
      // Sécurité : Conserve l'ancienne adresse si la nouvelle ne la fournit pas explicitement
      shippingAddress: data.shippingAddress ?? prev?.shippingAddress,
    }));
  }, []);

  const setShippingAddress = useCallback((address: ShippingAddress) => {
    setOrderData((prev) => {
      if (!prev) return prev;
      return { ...prev, shippingAddress: address };
    });
  }, []);

  const setShipping = useCallback((selection: ShippingSelection) => {
    setOrderData((prev) => {
      if (!prev) return prev;
      const computedSubtotal = prev.items.reduce(
        (sum, item) => sum + Number(item.price) * Number(item.quantity),
        0,
      );
      const subtotal =
        Number.isFinite(computedSubtotal) && computedSubtotal >= 0
          ? computedSubtotal
          : Number(prev.summary?.subtotal) || 0;
      const shipping = Number(selection.cost) || 0;
      const discount = 0;
      const newTotal = subtotal + shipping;
      return {
        ...prev,
        shipping: selection,
        summary: {
          ...prev.summary,
          subtotal,
          shipping,
          discount,
          total: newTotal,
        },
      };
    });
  }, []);

  const setSummary = useCallback((summary: CartSummary) => {
    setOrderData((prev) => {
      if (!prev) return prev;
      return { ...prev, summary };
    });
  }, []);

  const clearOrder = useCallback(() => {
    setOrderData(null);
  }, []);

  return (
    <CheckoutContext.Provider
      value={{ orderData, initOrder, setShippingAddress, setShipping, setSummary, clearOrder }}
    >
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout(): CheckoutContextType {
  const ctx = useContext(CheckoutContext);
  if (!ctx) throw new Error('useCheckout must be used within a CheckoutProvider');
  return ctx;
}