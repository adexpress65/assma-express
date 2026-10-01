import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useOperationalStaffAccess } from "@/hooks/useOperationalStaffAccess";
import {
  fetchAdminDashboardSnapshot,
  type AdminDashboardSnapshot,
} from "./adminDashboardQueries";
import { adminDashboardTheme } from "./adminDashboardTheme";

function formatWhen(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function KpiCard({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  const content = (
    <View style={[styles.kpiCard, adminDashboardTheme.shadow]}>
      <View style={styles.kpiIconWrap}>
        <Ionicons name={icon} size={22} color={adminDashboardTheme.accent} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={styles.kpiTouchable} onPress={onPress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={styles.kpiTouchable}>{content}</View>;
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { allowed, isLoading: accessLoading } = useOperationalStaffAccess();
  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!allowed) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await fetchAdminDashboardSnapshot();
      setSnapshot(data);
    } catch (e) {
      console.error("[admin-dashboard]", e);
      setError("Impossible de charger le tableau de bord.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [allowed]);

  useEffect(() => {
    if (allowed) void load(false);
  }, [allowed, load]);

  if (accessLoading || !allowed) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={adminDashboardTheme.accent} />
      </View>
    );
  }

  const displayName =
    userProfile?.displayName || userProfile?.name || "Administrateur";

  const pendingQueue = [
    ...(snapshot?.ordersByStatus.pending ?? []),
    ...(snapshot?.ordersByStatus.confirmed ?? []),
    ...(snapshot?.ordersByStatus.processing ?? []),
  ].slice(0, 8);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={adminDashboardTheme.accent}
          />
        }
      >
        <View style={styles.hero}>
          <View>
            <Text style={styles.eyebrow}>Administration opérationnelle</Text>
            <Text style={styles.heroTitle}>Bonjour, {displayName}</Text>
            <Text style={styles.heroSubtitle}>
              Vue du jour — commandes, stock et support
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Ionicons name="shield-checkmark" size={18} color={adminDashboardTheme.accent} />
            <Text style={styles.heroBadgeText}>Admin</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading && !snapshot ? (
          <ActivityIndicator
            size="large"
            color={adminDashboardTheme.accent}
            style={{ marginTop: 32 }}
          />
        ) : (
          <>
            <View style={styles.kpiGrid}>
              <KpiCard
                label="Commandes en attente"
                value={snapshot?.kpis.pendingOrders ?? 0}
                icon="cart-outline"
                onPress={() => router.push("/super-admin/orders")}
              />
              <KpiCard
                label="Stock faible"
                value={snapshot?.kpis.lowStockProducts ?? 0}
                icon="layers-outline"
                onPress={() => router.push("/super-admin/stock")}
              />
              <KpiCard
                label="Tickets support"
                value={snapshot?.kpis.openSupportTickets ?? 0}
                icon="headset-outline"
                onPress={() => router.push("/super-admin/support")}
              />
            </View>

            <SectionHeader
              title="Commandes — file de traitement"
              actionLabel="Voir tout"
              onAction={() => router.push("/super-admin/orders")}
            />
            <View style={[styles.panel, adminDashboardTheme.shadow]}>
              {pendingQueue.length === 0 ? (
                <Text style={styles.empty}>Aucune commande en attente de traitement.</Text>
              ) : (
                pendingQueue.map((row) => (
                  <TouchableOpacity
                    key={row.id}
                    style={styles.listRow}
                    onPress={() => router.push(`/super-admin/orders/${row.id}`)}
                  >
                    <View style={styles.listRowMain}>
                      <Text style={styles.listRowTitle}>#{row.id.slice(0, 8)}</Text>
                      <Text style={styles.listRowMeta}>{row.statusLabel}</Text>
                    </View>
                    <View style={styles.listRowEnd}>
                      <Text style={styles.listRowAmount}>{row.totalLabel}</Text>
                      <Text style={styles.listRowDate}>{formatWhen(row.createdAt)}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => router.push("/super-admin/orders")}
              >
                <Ionicons name="flash-outline" size={18} color={adminDashboardTheme.accent} />
                <Text style={styles.quickActionText}>Traiter les commandes</Text>
              </TouchableOpacity>
            </View>

            <SectionHeader
              title="Catalogue & stock"
              actionLabel="Stock"
              onAction={() => router.push("/super-admin/stock")}
            />
            <View style={[styles.panel, adminDashboardTheme.shadow]}>
              <Text style={styles.subSectionLabel}>Produits à stock faible</Text>
              {(snapshot?.lowStockProducts ?? []).length === 0 ? (
                <Text style={styles.empty}>Aucun produit en stock faible.</Text>
              ) : (
                snapshot!.lowStockProducts.map((p) => (
                  <View key={p.id} style={styles.listRow}>
                    <View style={styles.listRowMain}>
                      <Text style={styles.listRowTitle} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.listRowMeta}>{p.companyName || "—"}</Text>
                    </View>
                    <Text
                      style={[
                        styles.stockBadge,
                        p.status === "out" ? styles.stockBadgeOut : styles.stockBadgeLow,
                      ]}
                    >
                      {p.status === "out" ? "Rupture" : `${p.stock} restants`}
                    </Text>
                  </View>
                ))
              )}

              <Text style={[styles.subSectionLabel, { marginTop: 12 }]}>
                En attente de validation
              </Text>
              {(snapshot?.pendingProducts ?? []).length === 0 ? (
                <Text style={styles.empty}>Aucun produit en attente.</Text>
              ) : (
                snapshot!.pendingProducts.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.listRow}
                    onPress={() =>
                      router.push(`/super-admin/add-product?productId=${p.id}`)
                    }
                  >
                    <View style={styles.listRowMain}>
                      <Text style={styles.listRowTitle} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.listRowMeta}>Non vérifié</Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={adminDashboardTheme.muted}
                    />
                  </TouchableOpacity>
                ))
              )}
            </View>

            <SectionHeader
              title="Support"
              actionLabel="Tickets"
              onAction={() => router.push("/super-admin/support")}
            />
            <View style={[styles.panel, adminDashboardTheme.shadow]}>
              {(snapshot?.openTickets ?? []).length === 0 ? (
                <Text style={styles.empty}>Aucun ticket ouvert.</Text>
              ) : (
                snapshot!.openTickets.map((t) => (
                  <View key={t.id} style={styles.listRow}>
                    <View style={styles.listRowMain}>
                      <Text style={styles.listRowTitle} numberOfLines={1}>
                        {t.subject}
                      </Text>
                      <Text style={styles.listRowMeta} numberOfLines={1}>
                        {t.preview}
                      </Text>
                    </View>
                    <Text style={styles.ticketStatus}>{t.status}</Text>
                  </View>
                ))
              )}
              {(snapshot?.pendingCompanies ?? []).length > 0 ? (
                <>
                  <Text style={[styles.subSectionLabel, { marginTop: 12 }]}>
                    Fournisseurs à valider ({snapshot!.kpis.pendingCompanyVerifications})
                  </Text>
                  {snapshot!.pendingCompanies.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.listRow}
                      onPress={() =>
                        router.push(`/super-admin/verifications/${c.id}`)
                      }
                    >
                      <View style={styles.listRowMain}>
                        <Text style={styles.listRowTitle}>{c.name}</Text>
                        <Text style={styles.listRowMeta}>{c.email}</Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={adminDashboardTheme.muted}
                      />
                    </TouchableOpacity>
                  ))}
                </>
              ) : null}
            </View>

            <View style={styles.quickLinks}>
              {[
                { label: "Produits", icon: "cube-outline", href: "/super-admin/products" },
                { label: "Fournisseurs", icon: "business-outline", href: "/super-admin/companies" },
                { label: "Analytiques", icon: "stats-chart-outline", href: "/super-admin/analytics" },
              ].map((link) => (
                <TouchableOpacity
                  key={link.href}
                  style={[styles.quickLinkCard, adminDashboardTheme.shadow]}
                  onPress={() => router.push(link.href as never)}
                >
                  <Ionicons
                    name={link.icon as keyof typeof Ionicons.glyphMap}
                    size={22}
                    color={adminDashboardTheme.accent}
                  />
                  <Text style={styles.quickLinkText}>{link.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: adminDashboardTheme.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: adminDashboardTheme.background,
  },
  hero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "600",
    color: adminDashboardTheme.accent,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: adminDashboardTheme.text,
    marginTop: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: adminDashboardTheme.muted,
    marginTop: 4,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: adminDashboardTheme.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: adminDashboardTheme.accent,
    fontWeight: "700",
    fontSize: 13,
  },
  error: {
    color: "#B42318",
    marginBottom: 12,
    fontSize: 14,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  kpiTouchable: { width: "31%", minWidth: 100, flexGrow: 1 },
  kpiCard: {
    backgroundColor: adminDashboardTheme.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: adminDashboardTheme.border,
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: adminDashboardTheme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: "800",
    color: adminDashboardTheme.text,
  },
  kpiLabel: {
    fontSize: 12,
    color: adminDashboardTheme.muted,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: adminDashboardTheme.text,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: "600",
    color: adminDashboardTheme.accent,
  },
  panel: {
    backgroundColor: adminDashboardTheme.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: adminDashboardTheme.border,
    marginBottom: 18,
  },
  subSectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: adminDashboardTheme.muted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: adminDashboardTheme.border,
    gap: 8,
  },
  listRowMain: { flex: 1 },
  listRowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: adminDashboardTheme.text,
  },
  listRowMeta: {
    fontSize: 12,
    color: adminDashboardTheme.muted,
    marginTop: 2,
  },
  listRowEnd: { alignItems: "flex-end" },
  listRowAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: adminDashboardTheme.text,
  },
  listRowDate: {
    fontSize: 11,
    color: adminDashboardTheme.muted,
    marginTop: 2,
  },
  stockBadge: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  stockBadgeLow: { backgroundColor: "#FEF3C7", color: "#B45309" },
  stockBadgeOut: { backgroundColor: "#FEE2E2", color: "#B42318" },
  ticketStatus: {
    fontSize: 11,
    fontWeight: "600",
    color: adminDashboardTheme.accent,
    textTransform: "uppercase",
  },
  empty: {
    fontSize: 14,
    color: adminDashboardTheme.muted,
    paddingVertical: 8,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: adminDashboardTheme.border,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: adminDashboardTheme.accent,
  },
  quickLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 4,
  },
  quickLinkCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: adminDashboardTheme.card,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: adminDashboardTheme.border,
  },
  quickLinkText: {
    fontSize: 13,
    fontWeight: "600",
    color: adminDashboardTheme.text,
    textAlign: "center",
  },
});
