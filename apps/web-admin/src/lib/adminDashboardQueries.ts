import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { formatMoney } from "./orders";

export type AdminDashboardKpis = {
  pendingOrders: number;
  lowStockProducts: number;
  openSupportTickets: number;
  pendingCompanyVerifications: number;
  unverifiedProducts: number;
};

export type AdminDashboardOrderRow = {
  id: string;
  status: string;
  statusLabel: string;
  totalLabel: string;
  createdAt: Date | null;
};

export type AdminDashboardProductRow = {
  id: string;
  name: string;
  stock: number;
  companyName: string;
  status: "low" | "out" | "unverified";
};

export type AdminDashboardTicketRow = {
  id: string;
  subject: string;
  status: string;
  preview: string;
  createdAt: Date | null;
};

export type AdminDashboardCompanyRow = {
  id: string;
  name: string;
  email: string;
};

export type AdminDashboardSnapshot = {
  kpis: AdminDashboardKpis;
  ordersQueue: AdminDashboardOrderRow[];
  lowStockProducts: AdminDashboardProductRow[];
  pendingProducts: AdminDashboardProductRow[];
  openTickets: AdminDashboardTicketRow[];
  pendingCompanies: AdminDashboardCompanyRow[];
};

const LOW_STOCK_THRESHOLD = 10;
const PENDING_ORDER_STATUSES = new Set(["pending", "confirmed", "processing"]);

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  failed: "Échec",
};

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const ts = v as { toDate?: () => Date };
  if (typeof ts.toDate === "function") {
    try {
      return ts.toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function readStock(data: Record<string, unknown>): number {
  const raw = data.stockQuantity ?? data.stock;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchAdminDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
  const ordersCol = collection(db, "orders");
  const productsCol = collection(db, "products");
  const companiesCol = collection(db, "companies");
  const ticketsQ = query(
    collection(db, "supportTickets"),
    where("status", "in", ["open", "pending"]),
  );
  const pendingCompaniesQ = query(
    companiesCol,
    where("verification.status", "==", "pending"),
  );

  const [
    ordersSnap,
    productsSnap,
    ticketsSnap,
    pendingCompaniesSnap,
    unverifiedProductsSnap,
  ] = await Promise.all([
    getDocs(query(ordersCol, orderBy("createdAt", "desc"), limit(120))).catch(
      async () => getDocs(query(ordersCol, limit(120))),
    ),
    getDocs(query(productsCol, orderBy("createdAt", "desc"), limit(200))).catch(
      async () => getDocs(query(productsCol, limit(200))),
    ),
    getDocs(
      query(collection(db, "supportTickets"), orderBy("createdAt", "desc"), limit(20)),
    ).catch(async () => getDocs(query(collection(db, "supportTickets"), limit(20)))),
    getDocs(
      query(pendingCompaniesQ, orderBy("createdAt", "desc"), limit(8)),
    ).catch(async () => getDocs(query(pendingCompaniesQ, limit(8)))),
    getDocs(query(productsCol, where("isVerified", "==", false), limit(12))).catch(
      async () =>
        getDocs(query(productsCol, limit(50)).then((snap) => ({
          docs: snap.docs.filter((d) => d.data().isVerified === false),
        }))),
    ),
  ]);

  const ordersQueue: AdminDashboardOrderRow[] = [];
  let pendingOrdersCount = 0;

  for (const d of ordersSnap.docs) {
    const data = d.data() as Record<string, unknown>;
    const status = String(data.status ?? "pending").toLowerCase();
    if (PENDING_ORDER_STATUSES.has(status)) {
      pendingOrdersCount += 1;
      if (ordersQueue.length < 8) {
        ordersQueue.push({
          id: d.id,
          status,
          statusLabel: STATUS_LABELS[status] ?? status,
          totalLabel: formatMoney(
            Number(data.total ?? data.amount ?? 0),
            String(data.currency ?? "XOF"),
          ),
          createdAt: toDate(data.createdAt),
        });
      }
    }
  }

  const lowStockProducts: AdminDashboardProductRow[] = productsSnap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      const stock = readStock(data);
      const unlimited = data.unlimitedStock === true;
      return {
        id: d.id,
        name: String(data.name ?? "Sans nom"),
        stock,
        companyName: String(data.companyName ?? data.supplier ?? ""),
        unlimited,
      };
    })
    .filter((p) => !p.unlimited && (p.stock <= 0 || p.stock < LOW_STOCK_THRESHOLD))
    .slice(0, 8)
    .map(({ unlimited: _u, ...p }) => ({
      ...p,
      status: p.stock <= 0 ? ("out" as const) : ("low" as const),
    }));

  const pendingProducts: AdminDashboardProductRow[] = unverifiedProductsSnap.docs
    .slice(0, 8)
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: String(data.name ?? "Sans nom"),
        stock: readStock(data),
        companyName: String(data.companyName ?? data.supplier ?? ""),
        status: "unverified" as const,
      };
    });

  let openSupportTickets = ticketsSnap.docs.length;
  try {
    openSupportTickets = (await getCountFromServer(ticketsQ)).data().count;
  } catch {
    openSupportTickets = ticketsSnap.docs.filter((d) => {
      const s = String(d.data().status ?? "open").toLowerCase();
      return !["resolved", "closed", "done"].includes(s);
    }).length;
  }

  let pendingCompanyVerifications = pendingCompaniesSnap.docs.length;
  try {
    pendingCompanyVerifications = (
      await getCountFromServer(pendingCompaniesQ)
    ).data().count;
  } catch {
    /* keep */
  }

  const pendingCompanies: AdminDashboardCompanyRow[] = pendingCompaniesSnap.docs.map(
    (d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: String(data.name ?? "Sans nom"),
        email: String(data.email ?? data.contactEmail ?? "—"),
      };
    },
  );

  const openTickets: AdminDashboardTicketRow[] = ticketsSnap.docs
    .filter((d) => {
      const s = String(d.data().status ?? "open").toLowerCase();
      return !["resolved", "closed", "done"].includes(s);
    })
    .slice(0, 8)
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      const preview = String(
        data.message ?? data.body ?? data.description ?? "",
      ).trim();
      return {
        id: d.id,
        subject: String(data.subject ?? data.title ?? "Ticket support"),
        status: String(data.status ?? "open"),
        preview: preview.length > 120 ? `${preview.slice(0, 117)}…` : preview || "—",
        createdAt: toDate(data.createdAt ?? data.updatedAt),
      };
    });

  return {
    kpis: {
      pendingOrders: pendingOrdersCount,
      lowStockProducts: lowStockProducts.length,
      openSupportTickets,
      pendingCompanyVerifications,
      unverifiedProducts: pendingProducts.length,
    },
    ordersQueue,
    lowStockProducts,
    pendingProducts,
    openTickets,
    pendingCompanies,
  };
}
