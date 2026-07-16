import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LineChart } from "react-native-chart-kit";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAdminAnalyticsSnapshot,
  type AdminTimeRange,
  type AdminAnalyticsSnapshot,
} from "./adminAnalyticsFirestore";
import { formatAdminCurrency } from "@/features/super-admin/orders/orderUtils";

const screenWidth = Dimensions.get("window").width;
const ORDERS_LIMIT_HINT = 3000;

function formatChange(pct: number | null): { text: string; positive: boolean } {
  if (pct == null) return { text: "—", positive: true };
  const positive = pct >= 0;
  return {
    text: `${positive ? "+" : ""}${pct.toFixed(1)}%`,
    positive,
  };
}

export default function SuperAdminAnalyticsScreen() {
  const router = useRouter();
  const { user, isSuperAdmin } = useAuth();
  const [timeRange, setTimeRange] = useState<AdminTimeRange>("week");
  const [activeMetric, setActiveMetric] = useState<"revenue" | "orders">("revenue");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snap, setSnap] = useState<AdminAnalyticsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user || !isSuperAdmin) return;
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        const data = await fetchAdminAnalyticsSnapshot(timeRange);
        setSnap(data);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Erreur inconnue";
        setError(msg);
        setSnap(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, isSuperAdmin, timeRange],
  );

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    if (!isSuperAdmin) {
      Alert.alert("Accès refusé", "Réservé aux super-administrateurs.");
      router.back();
      return;
    }
    void load(false);
  }, [user, isSuperAdmin, timeRange, load, router]);

  const chartConfig = {
    backgroundColor: "#FFFFFF",
    backgroundGradientFrom: "#FFFFFF",
    backgroundGradientTo: "#FFFFFF",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: "4", strokeWidth: "2", stroke: "#FF6B00" },
  };

  if (!user || !isSuperAdmin) {
    return null;
  }

  if (loading && !snap) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={styles.muted}>Chargement des statistiques…</Text>
      </SafeAreaView>
    );
  }

  const revChange = snap ? formatChange(snap.revenueChangePct) : { text: "—", positive: true };
  const ordChange = snap ? formatChange(snap.ordersChangePct) : { text: "—", positive: true };

  const kpiCards = snap
    ? [
        {
          title: "Chiffre d’affaires",
          value: formatAdminCurrency(snap.totalRevenue, "XOF"),
          change: revChange.text,
          isPositive: revChange.positive,
          icon: "trending-up" as const,
          color: "#FF6B00",
        },
        {
          title: "Commandes",
          value: String(snap.orderCount),
          change: ordChange.text,
          isPositive: ordChange.positive,
          icon: "cart" as const,
          color: "#4CAF50",
        },
        {
          title: "Panier moyen",
          value: formatAdminCurrency(snap.avgBasket, "XOF"),
          change: snap.rangeLabel,
          isPositive: true,
          icon: "cash" as const,
          color: "#2196F3",
        },
        {
          title: "Produits (total)",
          value: String(snap.totalProducts),
          change: `${snap.totalCompanies} fourn.`,
          isPositive: true,
          icon: "cube" as const,
          color: "#9C27B0",
        },
      ]
    : [];

  const lineData =
    snap && activeMetric === "revenue"
      ? {
          labels: snap.chartLabels,
          datasets: [
            {
              data:
                snap.revenueSeries.length > 0
                  ? snap.revenueSeries.map((v) => Math.max(0, v))
                  : [0],
              color: () => "#FF6B00",
              strokeWidth: 2,
            },
          ],
        }
      : snap
        ? {
            labels: snap.chartLabels,
            datasets: [
              {
                data:
                  snap.ordersSeries.length > 0
                    ? snap.ordersSeries.map((v) => Math.max(0, v))
                    : [0],
                color: () => "#4CAF50",
                strokeWidth: 2,
              },
            ],
          }
        : { labels: [""], datasets: [{ data: [0], color: () => "#CCC", strokeWidth: 1 }] };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button">
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytiques (Firestore)</Text>
        <View style={{ width: 24 }} />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={20} color="#B91C1C" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void load(false)}>
            <Text style={styles.retry}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor="#FF6B00"
          />
        }
      >
        <Text style={styles.rangeHint}>
          Période : {snap?.rangeLabel ?? "—"} · tendance vs période précédente
        </Text>

        <View style={styles.filters}>
          {(["day", "week", "month", "year"] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[styles.filterButton, timeRange === period && styles.filterButtonActive]}
              onPress={() => setTimeRange(period)}
            >
              <Text
                style={[styles.filterText, timeRange === period && styles.filterTextActive]}
              >
                {period === "day"
                  ? "Jour"
                  : period === "week"
                    ? "Semaine"
                    : period === "month"
                      ? "Mois"
                      : "Année"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.kpiScroll}
        >
          {kpiCards.map((kpi, index) => (
            <View key={index} style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <View style={[styles.kpiIcon, { backgroundColor: kpi.color + "20" }]}>
                  <Ionicons name={kpi.icon} size={20} color={kpi.color} />
                </View>
                <View
                  style={[
                    styles.changeBadge,
                    {
                      backgroundColor:
                        kpi.title === "Panier moyen" || kpi.title === "Produits (total)"
                          ? "#F3F4F6"
                          : kpi.isPositive
                            ? "#E8F5E8"
                            : "#FFE8E8",
                    },
                  ]}
                >
                  {kpi.title !== "Panier moyen" && kpi.title !== "Produits (total)" ? (
                    <Ionicons
                      name={kpi.isPositive ? "trending-up" : "trending-down"}
                      size={12}
                      color={kpi.isPositive ? "#4CAF50" : "#FF4444"}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.changeText,
                      {
                        color:
                          kpi.title === "Panier moyen" || kpi.title === "Produits (total)"
                            ? "#6B7280"
                            : kpi.isPositive
                              ? "#4CAF50"
                              : "#FF4444",
                      },
                    ]}
                  >
                    {kpi.change}
                  </Text>
                </View>
              </View>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
              <Text style={styles.kpiTitle}>{kpi.title}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Activité</Text>
            <View style={styles.chartTabs}>
              {(["revenue", "orders"] as const).map((metric) => (
                <TouchableOpacity
                  key={metric}
                  style={[styles.chartTab, activeMetric === metric && styles.chartTabActive]}
                  onPress={() => setActiveMetric(metric)}
                >
                  <Text
                    style={[
                      styles.chartTabText,
                      activeMetric === metric && styles.chartTabTextActive,
                    ]}
                  >
                    {metric === "revenue" ? "Revenus" : "Commandes"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {snap && (
            <LineChart
              data={lineData}
              width={screenWidth - 32}
              height={220}
              chartConfig={chartConfig}
              bezier
              fromZero
              style={styles.chart}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Produits les plus vendus (période)</Text>
          {!snap || snap.topProducts.length === 0 ? (
            <Text style={styles.muted}>Aucune ligne de commande sur cette période.</Text>
          ) : (
            snap.topProducts.map((product, index) => (
              <View key={`${product.name}-${index}`} style={styles.productRow}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <Text style={styles.productSales}>{product.sales} unités</Text>
                </View>
                <Text style={styles.productRevenue}>
                  {formatAdminCurrency(product.revenue, "XOF")}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Ionicons name="people-outline" size={24} color="#666" />
            <Text style={styles.metricValue}>{snap?.totalUsers ?? "—"}</Text>
            <Text style={styles.metricLabel}>Utilisateurs</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="business-outline" size={24} color="#666" />
            <Text style={styles.metricValue}>{snap?.totalCompanies ?? "—"}</Text>
            <Text style={styles.metricLabel}>Fournisseurs</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="eye-outline" size={24} color="#666" />
            <Text style={styles.metricValue}>
              {snap?.productsViewSample != null
                ? snap.productsViewSample >= 1000
                  ? `${(snap.productsViewSample / 1000).toFixed(1)}k`
                  : String(snap.productsViewSample)
                : "—"}
            </Text>
            <Text style={styles.metricLabel}>Vues (échantillon)</Text>
          </View>
          <View style={styles.metricCard}>
            <Ionicons name="cube-outline" size={24} color="#666" />
            <Text style={styles.metricValue}>{snap?.totalProducts ?? "—"}</Text>
            <Text style={styles.metricLabel}>Produits catalogue</Text>
          </View>
        </View>

        <Text style={styles.footnote}>
          Données issues de Firestore (commandes avec champ createdAt). Au-delà de{" "}
          {ORDERS_LIMIT_HINT} commandes sur la fenêtre analysée, les totaux peuvent être
          tronqués.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF",
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#333" },
  content: { flex: 1 },
  rangeHint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 13,
    color: "#6B7280",
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  errorText: { flex: 1, color: "#991B1B", fontSize: 13 },
  retry: { color: "#FF6B00", fontWeight: "700", fontSize: 14 },
  muted: { fontSize: 14, color: "#9CA3AF", paddingHorizontal: 16, paddingVertical: 8 },
  filters: { flexDirection: "row", padding: 16, gap: 8, flexWrap: "wrap" },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F8F9FA",
  },
  filterButtonActive: { backgroundColor: "#FF6B00" },
  filterText: { fontSize: 14, fontWeight: "600", color: "#666" },
  filterTextActive: { color: "#FFF" },
  kpiScroll: { paddingHorizontal: 16, marginBottom: 16 },
  kpiCard: {
    width: 168,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  kpiIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    maxWidth: 96,
  },
  changeText: { fontSize: 11, fontWeight: "600", marginLeft: 2 },
  kpiValue: { fontSize: 18, fontWeight: "800", color: "#333", marginBottom: 4 },
  kpiTitle: { fontSize: 13, color: "#666" },
  chartSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#333" },
  chartTabs: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
    padding: 4,
  },
  chartTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  chartTabActive: {
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  chartTabText: { fontSize: 12, fontWeight: "600", color: "#666" },
  chartTabTextActive: { color: "#333" },
  chart: { borderRadius: 12 },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F8F9FA",
  },
  productInfo: { flex: 1, marginRight: 8 },
  productName: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 2 },
  productSales: { fontSize: 12, color: "#666" },
  productRevenue: { fontSize: 14, fontWeight: "700", color: "#FF6B00" },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 12,
  },
  metricCard: {
    width: (screenWidth - 56) / 2,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  metricValue: { fontSize: 20, fontWeight: "800", color: "#333", marginVertical: 8 },
  metricLabel: { fontSize: 12, color: "#666", textAlign: "center" },
  footnote: {
    fontSize: 11,
    color: "#9CA3AF",
    paddingHorizontal: 16,
    paddingBottom: 32,
    lineHeight: 16,
  },
});
