import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { OrderData, ShippingAddress, ShippingSelection } from '../types/order';
import type { CartSummary } from '../types/cart';
import { buildShippingMethodFields } from '../utils/orderShipping';

interface CheckoutContextType {
  orderData: OrderData | null;
  /** Initialise la commande depuis le panier (appelé dans cart.tsx) */
  initOrder: (data: OrderData) => void;
  /** Met à jour l'adresse de livraison (étape 1) */
  setShippingAddress: (address: ShippingAddress) => void;
  /** Met à jour le choix de livraison et recalcule le total (étape 2) */
  setShipping: (selection: ShippingSelection) => void;
  /** Retrait entrepôt / livraison domicile (indépendant des frais). */
  setDeliveryMode: (mode: 'pickup' | 'home') => void;
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
      const warehouseFeeTotal = Number(prev.summary?.warehouseFeeTotal) || 0;
      const warehouseFees = prev.summary?.warehouseFees ?? [];
      const newTotal = subtotal + shipping + warehouseFeeTotal;
      const methodFields = buildShippingMethodFields({
        method: selection.method,
        option: selection.option,
      });
      return {
        ...prev,
        shipping: selection,
        ...methodFields,
        summary: {
          ...prev.summary,
          subtotal,
          shipping,
          discount,
          warehouseFees,
          warehouseFeeTotal,
          total: newTotal,
        },
      };
    });
  }, []);

  const setDeliveryMode = useCallback((mode: 'pickup' | 'home') => {
    setOrderData((prev) => {
      if (!prev) return prev;
      return { ...prev, deliveryMode: mode };
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
      value={{ orderData, initOrder, setShippingAddress, setShipping, setDeliveryMode, setSummary, clearOrder }}
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