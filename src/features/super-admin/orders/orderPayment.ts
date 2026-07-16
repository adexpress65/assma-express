import type { Timestamp } from "firebase/firestore";

/**
 * Paiement réellement enregistré (évite de traiter / livrer des commandes de test).
 * On exige un signal explicite côté document : paidAt ou paymentStatus concluant.
 */
export function isOrderPaymentConfirmed(data: Record<string, unknown>): boolean {
  const paidAt = data.paidAt;
  if (paidAt != null) {
    if (typeof (paidAt as Timestamp).toDate === "function") return true;
    if (paidAt instanceof Date) return true;
  }

  const ps = String(data.paymentStatus ?? data.paymentState ?? "")
    .toLowerCase()
    .trim();
  if (
    ["paid", "completed", "success", "succeeded", "captured", "paid_out"].includes(
      ps,
    )
  ) {
    return true;
  }

  return false;
}

/** Statuts qui ne doivent pas exister sans paiement (sauf annulation / échec). */
const STATUSES_REQUIRING_PAYMENT: string[] = [
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

export function orderStatusImpliesPaymentMismatch(
  status: string,
  data: Record<string, unknown>,
): boolean {
  const s = status.toLowerCase();
  if (!STATUSES_REQUIRING_PAYMENT.includes(s)) return false;
  return !isOrderPaymentConfirmed(data);
}

export function canAdvanceOrderStatus(
  newStatus: string,
  data: Record<string, unknown>,
): boolean {
  const next = newStatus.toLowerCase();
  if (next === "cancelled" || next === "failed" || next === "pending") {
    return true;
  }
  if (STATUSES_REQUIRING_PAYMENT.includes(next)) {
    return isOrderPaymentConfirmed(data);
  }
  return true;
}
