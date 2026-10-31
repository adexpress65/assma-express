/**
 * Statuts commande — vue super-admin (aligné checkout / vendeurs + annulations).
 */
export type AdminOrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "failed";

export type AdminStatusUi = {
  color: string;
  bgColor: string;
  label: string;
  icon: string;
  nextAction?: string;
  nextStatus?: AdminOrderStatus;
};

export const ADMIN_ORDER_STATUS_CONFIG: Record<AdminOrderStatus, AdminStatusUi> = {
  pending: {
    color: "#B45309",
    bgColor: "#FEF9C3",
    label: "En attente",
    icon: "hourglass-outline",
    nextAction: "Confirmer la commande",
    nextStatus: "confirmed",
  },
  confirmed: {
    color: "#D97706",
    bgColor: "#FEF3C7",
    label: "Confirmée",
    icon: "checkmark-done-outline",
    nextAction: "Préparer la commande",
    nextStatus: "processing",
  },
  processing: {
    color: "#2563EB",
    bgColor: "#DBEAFE",
    label: "En préparation",
    icon: "hammer-outline",
    nextAction: "Marquer expédiée",
    nextStatus: "shipped",
  },
  shipped: {
    color: "#7C3AED",
    bgColor: "#EDE9FE",
    label: "Expédiée",
    icon: "bicycle-outline",
    nextAction: "Confirmer la livraison",
    nextStatus: "delivered",
  },
  delivered: {
    color: "#059669",
    bgColor: "#D1FAE5",
    label: "Livrée",
    icon: "happy-outline",
  },
  cancelled: {
    color: "#DC2626",
    bgColor: "#FEE2E2",
    label: "Annulée",
    icon: "close-circle-outline",
  },
  failed: {
    color: "#991B1B",
    bgColor: "#FEE2E2",
    label: "Échouée",
    icon: "alert-circle-outline",
  },
};

export function normalizeAdminOrderStatus(raw: unknown): AdminOrderStatus {
  const s = String(raw ?? "pending")
    .toLowerCase()
    .trim();
  if (s in ADMIN_ORDER_STATUS_CONFIG) {
    return s as AdminOrderStatus;
  }
  if (s === "paid" || s === "payment_pending") return "pending";
  return "pending";
}

export function getAdminStatusUi(status: unknown): AdminStatusUi {
  const key = normalizeAdminOrderStatus(status);
  return ADMIN_ORDER_STATUS_CONFIG[key];
}
