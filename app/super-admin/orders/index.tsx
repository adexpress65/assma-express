import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAdminStatusUi,
  normalizeAdminOrderStatus,
  type AdminOrderStatus,
} from "@/features/super-admin/orders/adminOrderStatus";
import {
  formatAdminCurrency,
  formatAdminOrderDate,
  normalizeShippingFromOrder,
  summarizeOrderItemsForAdmin,
} from "@/features/super-admin/orders/orderUtils";
import {
  isOrderPaymentConfirmed,
  orderStatusImpliesPaymentMismatch,
} from "@/features/super-admin/orders/orderPayment";

const ORDERS_ADMIN_LISTEN_LIMIT = 200;

type FilterKey =
  | "all"
  | "pending"
  | "active"
  | "shipped"
  | "delivered"
  | "issues";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "active", label: "Confirmée / prépa." },
  { key: "shipped", label: "Expédiées" },
  { key: "delivered", label: "Livrées" },
  { key: "issues", label: "Annul. / échec" },
];

export type AdminOrderRow = {
  id: string;
  orderId?: string;
  status: AdminOrderStatus;
  total?: number;
  currency?: string;
  userId?: string;
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    city?: string;
  };
  createdAt?: unknown;
  /** Fournisseurs / boutiques (dérivé des lignes). */
  itemsSummary: ReturnType<typeof summarizeOrderItemsForAdmin>;
  /** Sociétés déjà contactées depuis la fiche admin — `arrayUnion` Firestore. */
  notifiedSupplierCompanies: string[];
  paymentOk: boolean;
  paymentMismatch: boolean;
};

function rowMatchesSearch(row: AdminOrderRow, q: string): boolean {
  if (!q.trim()) return true;
  const n = q.trim().toLowerCase();
  const id = (row.orderId || row.id || "").toLowerCase();
  const name = (row.shippingAddress?.fullName || "").toLowerCase();
  const city = (row.shippingAddress?.city || "").toLowerCase();
  const phone = (row.shippingAddress?.phone || "").replace(/\s/g, "");
  const suppliers = row.itemsSummary.searchBlob;
  return (
    id.includes(n) ||
    name.includes(n) ||
    city.includes(n) ||
    phone.includes(n.replace(/\s/g, "")) ||
    row.id.toLowerCase().includes(n) ||
    suppliers.includes(n)
  );
}

function rowMatchesFilter(row: AdminOrderRow, filter: FilterKey): boolean {
  const s = row.status;
  switch (filter) {
    case "all":
      return true;
    case "pending":
      return s === "pending";
    case "active":
      return s === "confirmed" || s === "processing";
    case "shipped":
      return s === "shipped";
    case "delivered":
      return s === "delivered";
    case "issues":
      return s === "cancelled" || s === "failed";
    default:
      return true;
  }
}

function paramUserId(
  v: string | string[] | undefined,
): string | undefined {
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  const t = String(s).trim();
  return t || undefined;
}

export default function SuperAdminOrdersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const filterUserId = paramUserId(params.userId);
  const { user, isSuperAdmin } = useAuth();
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user || !isSuperAdmin) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(ORDERS_ADMIN_LISTEN_LIMIT),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AdminOrderRow[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const rawNotified = data.notifiedSupplierCompanies;
          const notifiedSupplierCompanies = Array.isArray(rawNotified)
            ? rawNotified.filter((x): x is string => typeof x === "string")
            : [];
          const shippingAddress = normalizeShippingFromOrder(data);
          const paymentOk = isOrderPaymentConfirmed(data);
          const paymentMismatch = orderStatusImpliesPaymentMismatch(
            String(data.status ?? ""),
            data,
          );
          return {
            id: d.id,
            orderId: typeof data.orderId === "string" ? data.orderId : undefined,
            status: normalizeAdminOrderStatus(data.status),
            total: typeof data.total === "number" ? data.total : Number(data.total) || 0,
            currency: typeof data.currency === "string" ? data.currency : "XOF",
            userId: typeof data.userId === "string" ? data.userId : undefined,
            shippingAddress:
              Object.keys(shippingAddress).length > 0
                ? shippingAddress
                : undefined,
            createdAt: data.createdAt,
            itemsSummary: summarizeOrderItemsForAdmin(data),
            notifiedSupplierCompanies,
            paymentOk,
            paymentMismatch,
          };
        });
        setRows(list);
        setLoading(false);
        setRefreshing(false);
      },
      (err) => {
        console.error("[super-admin/orders]", err);
        Alert.alert(
          "Erreur",
          "Impossible de charger les commandes. Vérifiez votre connexion et les règles Firestore.",
        );
        setLoading(false);
        setRefreshing(false);
      },
    );

    return () => unsub();
  }, [user, isSuperAdmin]);

  useEffect(() => {
    if (!user) {
      router.replace("/(tabs)/account");
      return;
    }
    if (!isSuperAdmin) {
      Alert.alert("Accès refusé", "Cet espace est réservé aux super-administrateurs.");
      router.back();
    }
  }, [user, isSuperAdmin, router]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // onSnapshot se met à jour seul ; court délai pour le feedback visuel
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterUserId && r.userId !== filterUserId) {
        return false;
      }
      return rowMatchesFilter(r, filter) && rowMatchesSearch(r, search);
    });
  }, [rows, filter, search, filterUserId]);

  const counts = useMemo(() => {
    const c = {
      all: rows.length,
      pending: 0,
      active: 0,
      shipped: 0,
      delivered: 0,
      issues: 0,
    };
    for (const r of rows) {
      if (r.status === "pending") c.pending += 1;
      if (r.status === "confirmed" || r.status === "processing") c.active += 1;
      if (r.status === "shipped") c.shipped += 1;
      if (r.status === "delivered") c.delivered += 1;
      if (r.status === "cancelled" || r.status === "failed") c.issues += 1;
    }
    return c;
  }, [rows]);

  const renderItem = useCallback(
    ({ item }: { item: AdminOrderRow }) => {
      const ui = getAdminStatusUi(item.status);
      const client =
        item.shippingAddress?.fullName?.trim() ||
        (item.userId ? `Client (${item.userId.slice(0, 8)}…)` : "Client inconnu");
      const total = item.total ?? 0;
      const cur = item.currency || "XOF";
      const sum = item.itemsSummary;
      const supplierCount = sum.supplierNames.length;
      const notified = item.notifiedSupplierCompanies.filter(Boolean);
      const notifiedCount = new Set(notified).size;
      let notifyLabel: string | null = null;
      let notifyStyle: "ok" | "partial" | "todo" | "blocked" | null = null;
      if (!item.paymentOk) {
        notifyLabel = "Paiement non confirmé — ne pas traiter";
        notifyStyle = "blocked";
      } else if (item.paymentMismatch) {
        notifyLabel = "Anomalie : statut sans paiement";
        notifyStyle = "blocked";
      } else if (supplierCount > 0) {
        if (notifiedCount >= supplierCount) {
          notifyLabel = "Fournisseurs contactés";
          notifyStyle = "ok";
        } else if (notifiedCount > 0) {
          notifyLabel = `Contactés ${notifiedCount}/${supplierCount}`;
          notifyStyle = "partial";
        } else if (
          item.status === "pending" ||
          item.status === "confirmed" ||
          item.status === "processing"
        ) {
          notifyLabel = "À contacter (SMS / appel)";
          notifyStyle = "todo";
        }
      }

      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/super-admin/orders/${item.id}`)}
          activeOpacity={0.85}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.orderId} numberOfLines={1}>
              {item.orderId || `#${item.id.slice(0, 8)}`}
            </Text>
            <View style={[styles.badge, { backgroundColor: ui.bgColor }]}>
              <Text style={[styles.badgeText, { color: ui.color }]}>
                {ui.label}
              </Text>
            </View>
          </View>
          <Text style={styles.clientName} numberOfLines={1}>
            Client : {client}
          </Text>
          <View style={styles.marketplaceRow}>
            <Ionicons name="cube-outline" size={14} color="#6B7280" />
            <Text style={styles.marketplaceText} numberOfLines={2}>
              {sum.lineCount} ligne{sum.lineCount > 1 ? "s" : ""} ·{" "}
              {sum.qtyTotal} article{sum.qtyTotal > 1 ? "s" : ""}
              {supplierCount > 0
                ? ` · ${supplierCount} fournisseur${supplierCount > 1 ? "s" : ""}`
                : ""}
            </Text>
          </View>
          {sum.displaySuppliers ? (
            <View style={styles.supplierRow}>
              <Ionicons name="storefront-outline" size={14} color="#EA580C" />
              <Text style={styles.supplierText} numberOfLines={2}>
                {sum.displaySuppliers}
              </Text>
            </View>
          ) : null}
          {notifyLabel && notifyStyle ? (
            <View
              style={[
                styles.notifyPill,
                notifyStyle === "ok" && styles.notifyPillOk,
                notifyStyle === "partial" && styles.notifyPillPartial,
                  notifyStyle === "todo" && styles.notifyPillTodo,
                  notifyStyle === "blocked" && styles.notifyPillBlocked,
                ]}
              >
              <Ionicons
                name={
                  notifyStyle === "ok"
                    ? "checkmark-circle"
                    : notifyStyle === "partial"
                      ? "alert-circle-outline"
                      : notifyStyle === "blocked"
                        ? "shield-outline"
                        : "chatbubbles-outline"
                }
                size={14}
                color={
                  notifyStyle === "ok"
                    ? "#047857"
                    : notifyStyle === "partial"
                      ? "#B45309"
                      : "#C2410C"
                }
              />
              <Text
                style={[
                  styles.notifyPillText,
                  notifyStyle === "ok" && styles.notifyPillTextOk,
                  notifyStyle === "partial" && styles.notifyPillTextPartial,
                  notifyStyle === "todo" && styles.notifyPillTextTodo,
                  notifyStyle === "blocked" && styles.notifyPillTextBlocked,
                ]}
              >
                {notifyLabel}
              </Text>
            </View>
          ) : null}
          <View style={styles.cardFooter}>
            <Text style={styles.amount}>{formatAdminCurrency(total, cur)}</Text>
            <Text style={styles.date}>
              {formatAdminOrderDate(item.createdAt)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [router],
  );

  if (!isSuperAdmin) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#EA580C" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={26} color="#111827" />
        </TouchableOpacity>
        <View style={styles.topTitleBlock}>
          <Text style={styles.title}>Commandes clients</Text>
          <Text style={styles.subtitle}>
            {counts.all} commande{counts.all > 1 ? "s" : ""} (max{" "}
            {ORDERS_ADMIN_LISTEN_LIMIT}) · relais fournisseurs depuis la fiche
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={18} color="#9A3412" />
        <Text style={styles.infoBannerText}>
          Vue marketplace : une commande peut regrouper plusieurs boutiques. Seules les
          commandes avec paiement confirmé doivent être traitées. Ouvrez une ligne pour
          appeler / SMS aux fournisseurs.
        </Text>
      </View>

      {filterUserId ? (
        <View style={styles.clientFilterBanner}>
          <Ionicons name="person-outline" size={18} color="#1D4ED8" />
          <Text style={styles.clientFilterText} numberOfLines={2}>
            Filtre client : commandes de l’utilisateur{" "}
            <Text style={styles.clientFilterId} selectable>
              {filterUserId}
            </Text>
          </Text>
          <TouchableOpacity
            style={styles.clientFilterClear}
            onPress={() => router.replace("/super-admin/orders")}
            hitSlop={8}
          >
            <Text style={styles.clientFilterClearText}>Tout afficher</Text>
            <Ionicons name="close-circle" size={20} color="#1D4ED8" />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="N°, client, téléphone, boutique…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode={Platform.OS === "ios" ? "while-editing" : undefined}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsList}
        contentContainerStyle={styles.chipsContent}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count =
            f.key === "all"
              ? counts.all
              : f.key === "pending"
                ? counts.pending
                : f.key === "active"
                  ? counts.active
                  : f.key === "shipped"
                    ? counts.shipped
                    : f.key === "delivered"
                      ? counts.delivered
                      : counts.issues;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
                numberOfLines={1}
              >
                {f.label}
                {f.key !== "all" ? ` (${count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && rows.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color="#EA580C" size="large" />
          <Text style={styles.loadingHint}>Synchronisation…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#EA580C"
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Aucune commande</Text>
              <Text style={styles.emptyHint}>
                Ajustez les filtres ou la recherche.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F9FAFB" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingHint: { marginTop: 12, fontSize: 14, color: "#6B7280" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  topTitleBlock: { flex: 1, alignItems: "center" },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 8,
    lineHeight: 15,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 17,
  },
  clientFilterBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  clientFilterText: {
    flex: 1,
    fontSize: 12,
    color: "#1E3A8A",
    lineHeight: 17,
  },
  clientFilterId: {
    fontWeight: "700",
    fontSize: 11,
  },
  clientFilterClear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clientFilterClearText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: "#111827",
    paddingVertical: 0,
  },
  chipsList: { flexGrow: 0, marginTop: 12, maxHeight: 48 },
  chipsContent: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingVertical: 4,
    alignItems: "center",
    flexDirection: "row",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#E5E7EB",
    marginRight: 8,
    minHeight: 40,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: "#111827" },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
    includeFontPadding: false,
  },
  chipTextActive: { color: "#FFFFFF" },
  listContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  orderId: {
    flex: 1,
    fontWeight: "800",
    color: "#374151",
    fontSize: 15,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  clientName: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 6 },
  marketplaceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 4,
  },
  marketplaceText: {
    flex: 1,
    fontSize: 12,
    color: "#4B5563",
    lineHeight: 17,
  },
  supplierRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 8,
  },
  supplierText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#9A3412",
    lineHeight: 18,
  },
  notifyPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
  },
  notifyPillOk: { backgroundColor: "#D1FAE5" },
  notifyPillPartial: { backgroundColor: "#FEF3C7" },
  notifyPillTodo: { backgroundColor: "#FFEDD5" },
  notifyPillBlocked: { backgroundColor: "#FEE2E2" },
  notifyPillText: { fontSize: 11, fontWeight: "700" },
  notifyPillTextOk: { color: "#047857" },
  notifyPillTextPartial: { color: "#B45309" },
  notifyPillTextTodo: { color: "#C2410C" },
  notifyPillTextBlocked: { color: "#B91C1C" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F3F4F6",
    paddingTop: 10,
  },
  amount: { fontWeight: "800", color: "#EA580C", fontSize: 16 },
  date: { color: "#9CA3AF", fontSize: 12 },
  empty: { alignItems: "center", paddingTop: 48 },
  emptyTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "700",
    color: "#374151",
  },
  emptyHint: {
    marginTop: 6,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
});
