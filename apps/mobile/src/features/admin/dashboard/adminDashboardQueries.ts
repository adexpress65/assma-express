import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { fetchAdminProductStock } from "@/features/stock/fetchProductStock";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  getStockStatus,
} from "@/features/stock/productStock";
import { fetchSupportTickets } from "@/features/super-admin/support/adminSupportFirestore";
import {
  getAdminStatusUi,
  normalizeAdminOrderStatus,
} from "@/features/super-admin/orders/adminOrderStatus";
import { formatAdminCurrency } from "@/features/super-admin/orders/orderUtils";

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
  ordersByStatus: Record<string, AdminDashboardOrderRow[]>;
  lowStockProducts: AdminDashboardProductRow[];
  pendingProducts: AdminDashboardProductRow[];
  openTickets: AdminDashboardTicketRow[];
  pendingCompanies: AdminDashboardCompanyRow[];
};

const PENDING_ORDER_STATUSES = ["pending", "confirmed", "processing"] as const;

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
    stockRows,
    tickets,
    pendingCompaniesSnap,
    unverifiedProductsSnap,
  ] = await Promise.all([
    getDocs(
      query(ordersCol, orderBy("createdAt", "desc"), limit(120)),
    ).catch(async () => getDocs(query(ordersCol, limit(120)))),
    fetchAdminProductStock(),
    fetchSupportTickets(20),
    getDocs(
      query(pendingCompaniesQ, orderBy("createdAt", "desc"), limit(8)),
    ).catch(async () => getDocs(query(pendingCompaniesQ, limit(8)))),
    getDocs(
      query(productsCol, where("isVerified", "==", false), limit(12)),
    ).catch(async () =>
      getDocs(query(productsCol, limit(50)).then((snap) => ({
        docs: snap.docs.filter((d) => d.data().isVerified === false),
      }))),
    ),
  ]);

  const ordersByStatus: Record<string, AdminDashboardOrderRow[]> = {
    pending: [],
    confirmed: [],
    processing: [],
    other: [],
  };

  let pendingOrdersCount = 0;

  for (const d of ordersSnap.docs) {
    const data = d.data() as Record<string, unknown>;
    const status = normalizeAdminOrderStatus(String(data.status ?? "pending"));
    const row: AdminDashboardOrderRow = {
      id: d.id,
      status,
      statusLabel: getAdminStatusUi(status).label,
      totalLabel: formatAdminCurrency(
        Number(data.total ?? data.amount ?? 0),
        String(data.currency ?? "XOF"),
      ),
      createdAt: toDate(data.createdAt),
    };

    if ((PENDING_ORDER_STATUSES as readonly string[]).includes(status)) {
      pendingOrdersCount += 1;
      if (ordersByStatus[status].length < 6) {
        ordersByStatus[status].push(row);
      }
    } else if (ordersByStatus.other.length < 4) {
      ordersByStatus.other.push(row);
    }
  }

  const lowStockProducts: AdminDashboardProductRow[] = stockRows
    .filter((row) => {
      const st = getStockStatus(
        row.stock,
        DEFAULT_LOW_STOCK_THRESHOLD,
        row.unlimitedStock,
      );
      return st === "low" || st === "out";
    })
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      name: row.name,
      stock: row.stock,
      companyName: row.companyName,
      status: row.stock <= 0 ? "out" : "low",
    }));

  const pendingProducts: AdminDashboardProductRow[] = unverifiedProductsSnap.docs
    .slice(0, 8)
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: String(data.name ?? "Sans nom"),
        stock: Number(data.stockQuantity ?? data.stock ?? 0) || 0,
        companyName: String(data.companyName ?? data.supplier ?? ""),
        status: "unverified" as const,
      };
    });

  let openSupportTickets = tickets.length;
  try {
    openSupportTickets = (await getCountFromServer(ticketsQ)).data().count;
  } catch {
    openSupportTickets = tickets.filter((t) =>
      ["open", "pending", "in_progress"].includes(t.status),
    ).length;
  }

  let pendingCompanyVerifications = pendingCompaniesSnap.docs.length;
  try {
    pendingCompanyVerifications = (
      await getCountFromServer(pendingCompaniesQ)
    ).data().count;
  } catch {
    /* keep list length */
  }

  const pendingCompanies: AdminDashboardCompanyRow[] =
    pendingCompaniesSnap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        name: String(data.name ?? "Sans nom"),
        email: String(data.email ?? data.contactEmail ?? "—"),
      };
    });

  const openTickets: AdminDashboardTicketRow[] = tickets
    .filter((t) => !["resolved", "closed", "done"].includes(t.status))
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      preview: t.preview,
      createdAt: t.createdAt,
    }));

  return {
    kpis: {
      pendingOrders: pendingOrdersCount,
      lowStockProducts: lowStockProducts.length,
      openSupportTickets,
      pendingCompanyVerifications,
      unverifiedProducts: pendingProducts.length,
    },
    ordersByStatus,
    lowStockProducts,
    pendingProducts,
    openTickets,
    pendingCompanies,
  };
}
