import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  RefreshControl,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  getStockStatus,
  type ProductStockRow,
  type StockStatusKey,
} from "./productStock";
import {
  fetchAdminProductStock,
  fetchCompaniesForStockFilter,
  fetchSellerProductStock,
  type CompanyFilterOption,
} from "./fetchProductStock";

type Mode = "seller" | "admin";

const STATUS_COLORS: Record<
  StockStatusKey,
  { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  ok: { bg: "#ECFDF3", text: "#027A48", icon: "checkmark-circle" },
  low: { bg: "#FFF7ED", text: "#B54708", icon: "warning" },
  out: { bg: "#FEF3F2", text: "#B42318", icon: "close-circle" },
};

export default function ProductStockListScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, userProfile } = useAuth();

  const [rows, setRows] = useState<ProductStockRow[]>([]);
  const [companies, setCompanies] = useState<CompanyFilterOption[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [companySearch, setCompanySearch] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StockStatusKey | "all">("all");
  const [threshold, setThreshold] = useState(DEFAULT_LOW_STOCK_THRESHOLD);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!user?.uid) return;
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        if (mode === "admin") {
          const products = await fetchAdminProductStock(companyId || null);
          setRows(products);
        } else {
          setRows(
            await fetchSellerProductStock([
              user.uid,
              userProfile?.companyId,
            ]),
          );
        }
      } catch (e) {
        console.error("Erreur chargement stock produits:", e);
        setRows([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.uid, userProfile?.companyId, mode, companyId],
  );

  useEffect(() => {
    if (mode !== "admin") return;
    void fetchCompaniesForStockFilter()
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, [mode]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const counts = useMemo(() => {
    let ok = 0;
    let low = 0;
    let out = 0;
    for (const row of rows) {
      const s = getStockStatus(row.stock, threshold, row.unlimitedStock);
      if (s === "ok") ok += 1;
      else if (s === "low") low += 1;
      else out += 1;
    }
    return { ok, low, out, all: rows.length };
  }, [rows, threshold]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const status = getStockStatus(row.stock, threshold, row.unlimitedStock);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.companyName.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, threshold]);

  const companySuggestions = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return [];
    return companies
      .filter((c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
      .slice(0, 8);
  }, [companies, companySearch]);

  const selectedCompany = companies.find((c) => c.id === companyId);

  const statusLabel = (key: StockStatusKey) => {
    if (key === "ok") return t("app.supplier.stockView.inStock");
    if (key === "low") return t("app.supplier.stockView.lowStock");
    return t("app.supplier.stockView.outOfStock");
  };

  const renderItem = ({ item }: { item: ProductStockRow }) => {
    const status = getStockStatus(item.stock, threshold, item.unlimitedStock);
    const colors = STATUS_COLORS[status];
    return (
      <View style={styles.card}>
        <Image
          source={{
            uri: item.mainImage || "https://via.placeholder.com/100",
          }}
          style={styles.image}
        />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          {mode === "admin" ? (
            <Text style={styles.supplier} numberOfLines={1}>
              {item.companyName || t("app.supplier.stockView.companyUnknown")}
            </Text>
          ) : null}
          <Text style={styles.stockValue}>
            {item.unlimitedStock
              ? t("app.supplier.stockView.unlimitedStock")
              : `${t("app.supplier.stockView.stock")}: ${item.stock}`}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
          <Ionicons name={colors.icon} size={14} color={colors.text} />
          <Text style={[styles.statusText, { color: colors.text }]}>
            {statusLabel(status)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {mode === "admin"
            ? t("app.supplier.stockView.adminTitle")
            : t("app.supplier.stockView.title")}
        </Text>
        <TouchableOpacity onPress={() => void load(true)} style={styles.iconBtn}>
          <Ionicons name="refresh" size={22} color="#FF6B00" />
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            style={styles.input}
            placeholder={t("app.supplier.stockView.searchPlaceholder")}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>

        {mode === "admin" ? (
          <View style={styles.companyBlock}>
            {selectedCompany ? (
              <TouchableOpacity
                style={styles.selectedChip}
                onPress={() => {
                  setCompanyId("");
                  setCompanySearch("");
                }}
              >
                <Text style={styles.selectedChipText} numberOfLines={1}>
                  {selectedCompany.name}
                </Text>
                <Ionicons name="close-circle" size={16} color="#FF6B00" />
              </TouchableOpacity>
            ) : (
              <View style={styles.searchBar}>
                <Ionicons name="business-outline" size={18} color="#999" />
                <TextInput
                  style={styles.input}
                  placeholder={t("app.supplier.stockView.filterCompany")}
                  value={companySearch}
                  onChangeText={setCompanySearch}
                  autoCapitalize="none"
                />
              </View>
            )}
            {companySuggestions.length > 0 && !selectedCompany ? (
              <View style={styles.suggestBox}>
                {companySuggestions.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.suggestRow}
                    onPress={() => {
                      setCompanyId(c.id);
                      setCompanySearch("");
                    }}
                  >
                    <Text style={styles.suggestText}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.thresholdRow}>
          <Text style={styles.thresholdLabel}>
            {t("app.supplier.stockView.threshold")}: {threshold}
          </Text>
          <View style={styles.thresholdBtns}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setThreshold((n) => Math.max(1, n - 1))}
            >
              <Ionicons name="remove" size={16} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setThreshold((n) => Math.min(999, n + 1))}
            >
              <Ionicons name="add" size={16} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {(
            [
              ["all", counts.all],
              ["out", counts.out],
              ["low", counts.low],
              ["ok", counts.ok],
            ] as const
          ).map(([key, count]) => {
            const active = statusFilter === key;
            const label =
              key === "all"
                ? t("app.supplier.stockView.all")
                : statusLabel(key);
            return (
              <TouchableOpacity
                key={key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setStatusFilter(key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <Text style={styles.hint}>{t("app.supplier.stockView.criticalFirst")}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#FF6B00" />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              colors={["#FF6B00"]}
              tintColor="#FF6B00"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={56} color="#CCC" />
              <Text style={styles.emptyText}>
                {t("app.supplier.stockView.empty")}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FFF",
  },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: "#1A1A1A" },
  iconBtn: { padding: 4, width: 36 },
  filters: {
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F2F5",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 8,
  },
  input: { flex: 1, marginLeft: 8, fontSize: 15, color: "#111" },
  companyBlock: { marginBottom: 4 },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "#FFF7ED",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  selectedChipText: { color: "#C2410C", fontWeight: "700", maxWidth: 240 },
  suggestBox: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#EEE",
    borderRadius: 10,
    marginBottom: 8,
  },
  suggestRow: { paddingHorizontal: 12, paddingVertical: 10 },
  suggestText: { fontSize: 14, color: "#111827" },
  thresholdRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  thresholdLabel: { fontSize: 13, color: "#4B5563", fontWeight: "600" },
  thresholdBtns: { flexDirection: "row", gap: 8 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  chips: { gap: 8, paddingVertical: 4 },
  chip: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: "#FF6B00", borderColor: "#FF6B00" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#374151" },
  chipTextActive: { color: "#FFF" },
  hint: { marginTop: 6, fontSize: 11, color: "#9CA3AF" },
  list: { padding: 16 },
  card: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  image: { width: 60, height: 60, borderRadius: 8, marginRight: 12, backgroundColor: "#F3F4F6" },
  info: { flex: 1, marginRight: 8 },
  name: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  supplier: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  stockValue: { fontSize: 13, color: "#111827", fontWeight: "700", marginTop: 4 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusText: { fontSize: 11, fontWeight: "800" },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { marginTop: 10, fontSize: 15, color: "#999" },
});
