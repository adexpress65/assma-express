import AsyncStorage from "@react-native-async-storage/async-storage";
import { PAYMENT_ENDPOINTS } from "@/config/api";
import { PENDING_PAYMENT_ORDER_ID_KEY } from "@/constants/storageKeys";

export type NgeniusVerifyResult = {
  isPaid: boolean;
  isFailed: boolean;
};

export async function rememberInFlightPayment(orderId: string): Promise<void> {
  const id = String(orderId || "").trim();
  if (!id) return;
  await AsyncStorage.setItem(PENDING_PAYMENT_ORDER_ID_KEY, id);
}

export async function peekInFlightPayment(): Promise<string | null> {
  const id = await AsyncStorage.getItem(PENDING_PAYMENT_ORDER_ID_KEY);
  const trimmed = String(id || "").trim();
  return trimmed || null;
}

export async function clearInFlightPayment(orderId?: string): Promise<void> {
  const current = await AsyncStorage.getItem(PENDING_PAYMENT_ORDER_ID_KEY);
  if (orderId && current && current !== orderId) return;
  await AsyncStorage.removeItem(PENDING_PAYMENT_ORDER_ID_KEY);
}

export async function verifyOrderWithBackend(
  orderId: string,
): Promise<NgeniusVerifyResult> {
  const response = await fetch(PAYMENT_ENDPOINTS.ngeniusVerify, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  const result = await response.json().catch(() => null);
  return {
    isPaid: result?.isPaid === true,
    isFailed: result?.isFailed === true,
  };
}

export function isOrderAwaitingNgeniusPayment(order: {
  status?: string;
  paymentStatus?: string;
  provider?: string;
}): boolean {
  const provider = String(order.provider ?? "ngenius").toLowerCase().trim();
  if (provider && provider !== "ngenius") return false;

  const status = String(order.status ?? "").toLowerCase().trim();
  const paymentStatus = String(order.paymentStatus ?? "").toLowerCase().trim();

  if (
    paymentStatus === "paid" ||
    paymentStatus === "success" ||
    status === "confirmed" ||
    status === "paid" ||
    status === "processing" ||
    status === "shipped" ||
    status === "delivered"
  ) {
    return false;
  }

  if (
    ["cancelled", "canceled", "failed"].includes(status) ||
    ["failed", "cancelled", "canceled"].includes(paymentStatus)
  ) {
    return false;
  }

  return (
    paymentStatus === "pending" ||
    status === "pending" ||
    status === "pending_payment"
  );
}
