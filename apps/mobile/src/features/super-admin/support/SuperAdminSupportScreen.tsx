import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchSupportTickets,
  updateSupportTicketStatus,
  type SupportTicketRow,
} from "./adminSupportFirestore";

function statusStyle(status: string): { bg: string; fg: string; label: string } {
  const s = status.toLowerCase();
  if (s === "resolved" || s === "closed" || s === "done")
    return { bg: "#D1FAE5", fg: "#065F46", label: "Résolu" };
  if (s === "pending" || s === "in_progress")
    return { bg: "#FEF3C7", fg: "#92400E", label: "En cours" };
  return { bg: "#FEE2E2", fg: "#991B1B", label: "Ouvert" };
}

function formatWhen(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SuperAdminSupportScreen() {
  const router = useRouter();
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const isOperationalStaff = isSuperAdmin || isAdmin;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
      if (!user || !isOperationalStaff) return;
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const rows = await fetchSupportTickets(60);
      setTickets(rows);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Impossible de charger les tickets";
      setError(msg);
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isOperationalStaff]);

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    if (!isOperationalStaff) {
      Alert.alert("Accès refusé", "Réservé aux administrateurs.");
      router.back();
      return;
    }
    void load(false);
  }, [user, isOperationalStaff, load, router]);

  const onMarkResolved = (row: SupportTicketRow) => {
    Alert.alert(
      "Clôturer le ticket",
      `Marquer « ${row.subject} » comme résolu ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Résolu",
          onPress: async () => {
            try {
              await updateSupportTicketStatus(row.id, "resolved");
              await load(true);
            } catch (e) {
              Alert.alert(
                "Erreur",
                e instanceof Error ? e.message : "Mise à jour impossible",
              );
            }
          },
        },
      ],
    );
  };

  if (!user || !isSuperAdmin) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support & tickets</Text>
        <TouchableOpacity onPress={() => router.push("/support")}>
          <Ionicons name="help-circle-outline" size={24} color="#FF6B00" />
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void load(false)}>
            <Text style={styles.retry}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && tickets.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B00" />
          <Text style={styles.muted}>Chargement des tickets Firestore…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor="#FF6B00"
            />
          }
        >
          <Text style={styles.intro}>
            Collection <Text style={styles.code}>supportTickets</Text> — ouvrez la FAQ via
            l’icône aide si la liste est vide.
          </Text>

          {tickets.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="file-tray-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>Aucun ticket</Text>
              <Text style={styles.emptyText}>
                Les demandes créées par l’app apparaîtront ici lorsque la collection sera
                alimentée.
              </Text>
            </View>
          ) : (
            tickets.map((row) => {
              const st = statusStyle(row.status);
              const open = !["resolved", "closed", "done"].includes(row.status.toLowerCase());
              return (
                <View key={row.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={[styles.badge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
                    </View>
                    <Text style={styles.date}>{formatWhen(row.createdAt)}</Text>
                  </View>
                  <Text style={styles.subject}>{row.subject}</Text>
                  {row.userEmail ? (
                    <Text style={styles.email}>{row.userEmail}</Text>
                  ) : null}
                  <Text style={styles.preview}>{row.preview}</Text>
                  <Text style={styles.id}>ID : {row.id}</Text>
                  {open ? (
                    <TouchableOpacity
                      style={styles.resolveBtn}
                      onPress={() => onMarkResolved(row)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                      <Text style={styles.resolveBtnText}>Marquer résolu</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111" },
  errorBanner: {
    margin: 12,
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
  },
  errorText: { color: "#991B1B", marginBottom: 8 },
  retry: { color: "#FF6B00", fontWeight: "700" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  muted: { color: "#6B7280", fontSize: 14 },
  scroll: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 13, color: "#6B7280", marginBottom: 16, lineHeight: 18 },
  code: { fontFamily: "monospace", color: "#374151", fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#374151", marginTop: 12 },
  emptyText: { fontSize: 14, color: "#9CA3AF", textAlign: "center", marginTop: 8 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  date: { fontSize: 12, color: "#9CA3AF" },
  subject: { fontSize: 16, fontWeight: "700", color: "#111", marginBottom: 4 },
  email: { fontSize: 13, color: "#3B82F6", marginBottom: 6 },
  preview: { fontSize: 14, color: "#4B5563", lineHeight: 20 },
  id: { fontSize: 11, color: "#9CA3AF", marginTop: 8 },
  resolveBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    paddingVertical: 10,
    borderRadius: 10,
  },
  resolveBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
});
