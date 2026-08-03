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

const REJECTED_STATUSES = [
  "failed",
  "cancelled",
  "canceled",
  "payment_failed",
  "payment_cancelled",
  "declined",
  "rejected",
  "expired",
];

/** Paiement explicitement refusé, annulé ou expiré. */
export function isOrderPaymentRejected(data: Record<string, unknown>): boolean {
  const status = String(data.status ?? "").toLowerCase().trim();
  const paymentStatus = String(data.paymentStatus ?? data.paymentState ?? "")
    .toLowerCase()
    .trim();

  return (
    REJECTED_STATUSES.includes(status) || REJECTED_STATUSES.includes(paymentStatus)
  );
}

/**
 * Seule porte d'entrée autorisée pour présenter une commande comme payée dans le
 * tunnel de checkout : un signal de paiement positif ET aucun signal de refus.
 */
export function isCheckoutPaymentConfirmed(
  data: Record<string, unknown> | undefined | null,
): boolean {
  if (!data) return false;
  return isOrderPaymentConfirmed(data) && !isOrderPaymentRejected(data);
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
