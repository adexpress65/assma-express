import type { Timestamp } from "firebase/firestore";

export type AnalyticsTimeRange = "day" | "week" | "month" | "year";

export function orderTotal(data: Record<string, unknown>): number {
  return Number(data.totalAmount ?? data.total ?? data.amount ?? 0) || 0;
}

export function orderDate(data: Record<string, unknown>): Date | null {
  const c = data.createdAt;
  if (c != null && typeof (c as Timestamp).toDate === "function") {
    try {
      return (c as Timestamp).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

export function getAnalyticsWindows(range: AnalyticsTimeRange): {
  curStart: Date;
  curEnd: Date;
  prevStart: Date;
  prevEnd: Date;
} {
  const curEnd = new Date();
  let curStart: Date;
  let prevEnd: Date;
  let prevStart: Date;

  switch (range) {
    case "day": {
      curStart = new Date(curEnd);
      curStart.setHours(0, 0, 0, 0);
      prevEnd = new Date(curStart.getTime() - 1);
      prevStart = new Date(curStart);
      prevStart.setDate(prevStart.getDate() - 1);
      break;
    }
    case "week": {
      curStart = new Date(curEnd);
      curStart.setDate(curStart.getDate() - 6);
      curStart.setHours(0, 0, 0, 0);
      prevEnd = new Date(curStart.getTime() - 1);
      prevStart = new Date(curStart);
      prevStart.setDate(prevStart.getDate() - 7);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case "month": {
      curStart = new Date(curEnd);
      curStart.setDate(curStart.getDate() - 30);
      curStart.setHours(0, 0, 0, 0);
      prevEnd = new Date(curStart.getTime() - 1);
      prevStart = new Date(curStart);
      prevStart.setDate(prevStart.getDate() - 30);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
    case "year":
    default: {
      curStart = new Date(curEnd.getFullYear(), curEnd.getMonth() - 11, 1);
      curStart.setHours(0, 0, 0, 0);
      prevEnd = new Date(curStart.getTime() - 1);
      prevStart = new Date(curEnd.getFullYear(), curEnd.getMonth() - 23, 1);
      prevStart.setHours(0, 0, 0, 0);
      break;
    }
  }

  return { curStart, curEnd, prevStart, prevEnd };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function buildAnalyticsBuckets(
  range: AnalyticsTimeRange,
  curStart: Date,
  curEnd: Date,
): { labels: string[]; n: number; bucketIndex: (d: Date) => number } {
  if (range === "day") {
    const labels = Array.from({ length: 8 }, (_, i) => `${i * 3}h-${(i + 1) * 3}h`);
    return {
      labels,
      n: 8,
      bucketIndex: (d: Date) => {
        const h = d.getHours();
        return Math.min(7, Math.floor(h / 3));
      },
    };
  }
  if (range === "week") {
    const labels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const x = new Date(curEnd);
      x.setDate(x.getDate() - i);
      labels.push(
        x.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
      );
    }
    return {
      labels,
      n: 7,
      bucketIndex: (d: Date) => {
        const dayStart = new Date(d);
        dayStart.setHours(0, 0, 0, 0);
        const startDay = new Date(curStart);
        startDay.setHours(0, 0, 0, 0);
        const diff = Math.floor(
          (dayStart.getTime() - startDay.getTime()) / 86400000,
        );
        if (diff < 0 || diff > 6) return -1;
        return diff;
      },
    };
  }
  if (range === "month") {
    const labels = ["S1", "S2", "S3", "S4", "S5", "S6"];
    return {
      labels,
      n: 6,
      bucketIndex: (d: Date) => {
        const diffDays = Math.floor(
          (d.getTime() - curStart.getTime()) / 86400000,
        );
        if (diffDays < 0) return -1;
        return Math.min(5, Math.floor(diffDays / 5));
      },
    };
  }
  const labels: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const x = new Date(curEnd.getFullYear(), curEnd.getMonth() - i, 1);
    labels.push(x.toLocaleDateString("fr-FR", { month: "short" }));
  }
  return {
    labels,
    n: 12,
    bucketIndex: (d: Date) => {
      const idx =
        (d.getFullYear() - curStart.getFullYear()) * 12 +
        (d.getMonth() - curStart.getMonth());
      if (idx < 0 || idx > 11) return -1;
      return idx;
    },
  };
}

export function analyticsRangeLabel(range: AnalyticsTimeRange): string {
  switch (range) {
    case "day":
      return "Aujourd’hui";
    case "week":
      return "7 derniers jours";
    case "month":
      return "30 derniers jours";
    case "year":
      return "12 derniers mois";
    default:
      return "";
  }
}
