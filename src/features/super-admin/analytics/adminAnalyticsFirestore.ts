import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { extractOrderItemsArray } from "@/features/super-admin/orders/orderUtils";
import {
  analyticsRangeLabel,
  buildAnalyticsBuckets,
  getAnalyticsWindows,
  orderDate,
  orderTotal,
  pctChange,
  type AnalyticsTimeRange,
} from "@/features/analytics/analyticsWindows";

export type AdminTimeRange = AnalyticsTimeRange;

export type AdminAnalyticsSnapshot = {
  rangeKey: AdminTimeRange;
  rangeLabel: string;
  totalRevenue: number;
  orderCount: number;
  avgBasket: number;
  prevRevenue: number;
  prevOrderCount: number;
  revenueChangePct: number | null;
  ordersChangePct: number | null;
  chartLabels: string[];
  revenueSeries: number[];
  ordersSeries: number[];
  topProducts: { name: string; sales: number; revenue: number }[];
  totalProducts: number;
  totalCompanies: number;
  totalUsers: number;
  productsViewSample: number;
};

const ORDERS_LIMIT = 3000;

/**
 * Agrège commandes et compteurs globaux pour le dashboard super-admin (Firestore).
 */
export async function fetchAdminAnalyticsSnapshot(
  timeRange: AdminTimeRange,
): Promise<AdminAnalyticsSnapshot> {
  const { curStart, curEnd, prevStart, prevEnd } = getAnalyticsWindows(timeRange);
  const fetchFrom = prevStart;

  const ordersCol = collection(db, "orders");
  const q = query(
    ordersCol,
    where("createdAt", ">=", Timestamp.fromDate(fetchFrom)),
    orderBy("createdAt", "asc"),
    limit(ORDERS_LIMIT),
  );

  const [ordersSnap, productsCount, companiesCount, usersCount, productsViewSnap] =
    await Promise.all([
      getDocs(q).catch(() => null),
      getCountFromServer(collection(db, "products")).catch(() => ({
        data: () => ({ count: 0 }),
      })),
      getCountFromServer(collection(db, "companies")).catch(() => ({
        data: () => ({ count: 0 }),
      })),
      getCountFromServer(collection(db, "users")).catch(() => ({
        data: () => ({ count: 0 }),
      })),
      getDocs(query(collection(db, "products"), orderBy("createdAt", "desc"), limit(200))).catch(
        () => null,
      ),
    ]);

  let productsViewSample = 0;
  if (productsViewSnap) {
    productsViewSnap.forEach((docSnap) => {
      const v = docSnap.data() as Record<string, unknown>;
      const st = v.stats;
      const nestedViews =
        st && typeof st === "object" && !Array.isArray(st)
          ? Number((st as Record<string, unknown>).views ?? 0) || 0
          : 0;
      productsViewSample +=
        (Number(v.views ?? v.viewCount ?? 0) || 0) + nestedViews;
    });
  }

  const { labels, n, bucketIndex } = buildAnalyticsBuckets(timeRange, curStart, curEnd);
  const revenueSeries = new Array(n).fill(0);
  const ordersSeries = new Array(n).fill(0);

  let totalRevenue = 0;
  let orderCount = 0;
  let prevRevenue = 0;
  let prevOrderCount = 0;

  const productMap = new Map<string, { sales: number; revenue: number }>();

  if (ordersSnap) {
    ordersSnap.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const d = orderDate(data);
      if (!d) return;

      const amount = orderTotal(data);
      const inCur = d >= curStart && d <= curEnd;
      const inPrev = d >= prevStart && d <= prevEnd;

      if (inCur) {
        totalRevenue += amount;
        orderCount += 1;
        const bi = bucketIndex(d);
        if (bi >= 0 && bi < n) {
          revenueSeries[bi] += amount;
          ordersSeries[bi] += 1;
        }

        const items = extractOrderItemsArray(data);
        for (const raw of items) {
          const it = raw as Record<string, unknown>;
          const name =
            String(it.name ?? it.title ?? it.productName ?? "Produit").trim() || "Produit";
          const qty = Number(it.quantity ?? it.qty ?? 1) || 1;
          const price = Number(it.price ?? it.unitPrice ?? 0) || 0;
          const lineRev = price > 0 ? price * qty : amount / Math.max(1, items.length);
          const cur = productMap.get(name) ?? { sales: 0, revenue: 0 };
          cur.sales += qty;
          cur.revenue += lineRev;
          productMap.set(name, cur);
        }
      } else if (inPrev) {
        prevRevenue += amount;
        prevOrderCount += 1;
      }
    });
  }

  const topProducts = Array.from(productMap.entries())
    .map(([name, v]) => ({ name, sales: v.sales, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const avgBasket = orderCount > 0 ? totalRevenue / orderCount : 0;

  return {
    rangeKey: timeRange,
    rangeLabel: analyticsRangeLabel(timeRange),
    totalRevenue,
    orderCount,
    avgBasket,
    prevRevenue,
    prevOrderCount,
    revenueChangePct: pctChange(totalRevenue, prevRevenue),
    ordersChangePct: pctChange(orderCount, prevOrderCount),
    chartLabels: labels,
    revenueSeries,
    ordersSeries,
    topProducts,
    totalProducts: productsCount.data().count,
    totalCompanies: companiesCount.data().count,
    totalUsers: usersCount.data().count,
    productsViewSample,
  };
}
