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

export type SellerAnalyticsSnapshot = {
  rangeKey: AnalyticsTimeRange;
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
  totalProductsInCatalog: number;
  productsViewSample: number;
};

const ORDERS_LIMIT = 2000;

function isSellerOrder(data: Record<string, unknown>, sellerUid: string): boolean {
  if (String(data.sellerId ?? "") === sellerUid) return true;
  const ids = data.sellerIds;
  if (Array.isArray(ids) && ids.includes(sellerUid)) return true;
  return false;
}

/** Si les requêtes composées échouent (index), on retombe sur un échantillon filtré en mémoire. */
async function fetchSellerOrdersFallback(
  sellerUid: string,
  fetchFrom: Date,
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  try {
    const snap = await getDocs(
      query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(3000)),
    );
    snap.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      if (!isSellerOrder(data, sellerUid)) return;
      const dt = orderDate(data);
      if (!dt || dt < fetchFrom) return;
      out.set(d.id, data);
    });
  } catch (e) {
    console.warn("[sellerAnalytics] fallback orders:", e);
  }
  return out;
}

/**
 * Charge les commandes liées au vendeur (sellerId ou sellerIds), puis agrège comme l’admin.
 */
export async function fetchSellerAnalyticsSnapshot(
  sellerUid: string,
  timeRange: AnalyticsTimeRange,
): Promise<SellerAnalyticsSnapshot> {
  const { curStart, curEnd, prevStart, prevEnd } = getAnalyticsWindows(timeRange);
  const fetchFrom = prevStart;
  const fromTs = Timestamp.fromDate(fetchFrom);
  const productsCol = collection(db, "products");

  const [productsCountSnap, ordersSnapA, ordersSnapB, productsViewSnap] = await Promise.all([
    getCountFromServer(query(productsCol, where("sellerId", "==", sellerUid))).catch(() => ({
      data: () => ({ count: 0 }),
    })),
    getDocs(
      query(
        collection(db, "orders"),
        where("sellerId", "==", sellerUid),
        where("createdAt", ">=", fromTs),
        orderBy("createdAt", "asc"),
        limit(ORDERS_LIMIT),
      ),
    ).catch(() => null),
    getDocs(
      query(
        collection(db, "orders"),
        where("sellerIds", "array-contains", sellerUid),
        where("createdAt", ">=", fromTs),
        orderBy("createdAt", "asc"),
        limit(ORDERS_LIMIT),
      ),
    ).catch(() => null),
    getDocs(
      query(
        productsCol,
        where("sellerId", "==", sellerUid),
        orderBy("createdAt", "desc"),
        limit(120),
      ),
    ).catch(() => null),
  ]);

  let merged = new Map<string, Record<string, unknown>>();
  [ordersSnapA, ordersSnapB].forEach((snap) => {
    if (!snap) return;
    snap.forEach((d) => {
      if (!merged.has(d.id)) merged.set(d.id, d.data() as Record<string, unknown>);
    });
  });

  if (!ordersSnapA && !ordersSnapB) {
    merged = await fetchSellerOrdersFallback(sellerUid, fetchFrom);
  }

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

  merged.forEach((data) => {
    if (!isSellerOrder(data, sellerUid)) return;
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
    totalProductsInCatalog: productsCountSnap.data().count,
    productsViewSample,
  };
}
