import React, { useCallback, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/contexts/AuthContext";
import {
  useMessages,
  type Conversation,
} from "../../src/contexts/MessagesContext";

type FilterKey = "all" | "commerce" | "professional" | "social";

function resolveDateLocale(lang: string | undefined): string {
  const base = (lang || "en").split("-")[0]?.toLowerCase() || "en";
  if (base === "fr") return "fr-FR";
  if (base === "zh") return "zh-CN";
  if (base === "ar") return "ar-SA";
  return "en-US";
}

function initialsFromTitle(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (title.slice(0, 2) || "?").toUpperCase();
}

function toDate(timestamp: unknown): Date | null {
  if (!timestamp) return null;
  try {
    if (
      typeof timestamp === "object" &&
      timestamp !== null &&
      "toDate" in timestamp &&
      typeof (timestamp as { toDate: () => Date }).toDate === "function"
    ) {
      return (timestamp as { toDate: () => Date }).toDate();
    }
    return new Date(timestamp as string | number);
  } catch {
    return null;
  }
}

function formatMessageTime(
  timestamp: unknown,
  locale: string,
  t: TFunction,
): string {
  const date = toDate(timestamp);
  if (!date) return "";
  try {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60_000) return t("app.messages.justNow");
    if (diff < 3_600_000) {
      return t("app.messages.minsAgo", { count: Math.floor(diff / 60_000) });
    }
    if (diff < 86_400_000) {
      return date.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

function timeMs(timestamp: unknown): number {
  const d = toDate(timestamp);
  return d ? d.getTime() : 0;
}

function iconForType(type: Conversation["type"]): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "group":
      return "people";
    case "support":
      return "headset";
    case "order":
    case "return":
      return "bag-handle";
    case "seller":
    case "entrepreneur":
      return "storefront";
    case "delivery":
      return "car";
    case "promo":
      return "pricetag";
    case "channel":
      return "radio";
    case "premium":
      return "diamond";
    case "subscription":
      return "repeat";
    case "direct":
    default:
      return "chatbubble-ellipses";
  }
}

function peerUserId(conv: Conversation, uid: string | undefined): string | null {
  if (!uid || !conv.participants?.length) return null;
  const other = conv.participants.find((p) => p !== uid);
  return other ?? null;
}

function peerAvatarUrl(
  conv: Conversation,
  uid: string | undefined,
): string | null {
  const pid = peerUserId(conv, uid);
  if (!pid || !conv.participantAvatars) return null;
  const u = conv.participantAvatars[pid];
  return typeof u === "string" && u.length > 0 ? u : null;
}

function peerDisplayName(
  conv: Conversation,
  uid: string | undefined,
): string | null {
  const pid = peerUserId(conv, uid);
  if (!pid || !conv.participantNames) return null;
  const n = conv.participantNames[pid];
  return typeof n === "string" && n.trim() ? n.trim() : null;
}

export default function MessagesTabScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const {
    conversations,
    loading,
    refreshConversations,
    hasMoreConversations,
    loadingMoreConversations,
    loadMoreConversations,
    deleteConversation,
  } = useMessages();
  const insets = useSafeAreaInsets();

  const dateLocale = useMemo(() => resolveDateLocale(i18n.language), [i18n.language]);

  const filters = useMemo(
    () =>
      [
        { key: "all" as const, label: t("app.messages.filterAll"), types: [] as Conversation["type"][] },
        {
          key: "commerce" as const,
          label: t("app.messages.filterCommerce"),
          types: ["order", "delivery", "return", "promo", "subscription"] as Conversation["type"][],
        },
        {
          key: "professional" as const,
          label: t("app.messages.filterProfessional"),
          types: ["seller", "support", "premium", "entrepreneur"] as Conversation["type"][],
        },
        {
          key: "social" as const,
          label: t("app.messages.filterSocial"),
          types: ["direct", "group", "channel"] as Conversation["type"][],
        },
      ] satisfies { key: FilterKey; label: string; types: Conversation["type"][] }[],
    [t],
  );

  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const sortedConversations = useMemo(() => {
    return [...conversations].sort(
      (a, b) => timeMs(b.lastMessageTime) - timeMs(a.lastMessageTime),
    );
  }, [conversations]);

  const activeTypes = useMemo(() => {
    const f = filters.find((x) => x.key === filter);
    return f?.types ?? [];
  }, [filter, filters]);

  const filteredConversations = useMemo(() => {
    return sortedConversations.filter((c) => {
      if (activeTypes.length > 0 && !activeTypes.includes(c.type)) {
        return false;
      }
      if (!normalizedSearch) return true;
      const peer = peerDisplayName(c, user?.uid) || "";
      const haystack =
        `${c.title || ""} ${c.lastMessage || ""} ${peer} ${c.type || ""}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [sortedConversations, activeTypes, normalizedSearch, user?.uid]);

  const unreadTotal = useMemo(
    () =>
      conversations.reduce(
        (n, c) => n + (c.unreadCount?.[user?.uid || ""] || 0),
        0,
      ),
    [conversations, user?.uid],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshConversations().finally(() => setRefreshing(false));
  }, [refreshConversations]);

  const selectedCount = useMemo(
    () => Object.keys(selectedIds).filter((k) => selectedIds[k]).length,
    [selectedIds],
  );

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds({});
  }, []);

  const toggleRowSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const confirmBulkDelete = useCallback(() => {
    if (selectedCount === 0) return;
    Alert.alert(
      t("app.messages.deleteBulkTitle"),
      t("app.messages.deleteBulkMessage", { count: selectedCount }),
      [
        { text: t("app.messages.cancel"), style: "cancel" },
        {
          text: t("app.messages.deleteBulkAction"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
              let failures = 0;
              for (const id of ids) {
                try {
                  await deleteConversation(id, { suppressErrorAlert: true });
                } catch {
                  failures += 1;
                }
              }
              exitSelectMode();
              if (failures > 0) {
                Alert.alert(
                  t("app.messages.deleteDone"),
                  t("app.messages.deletePartial", {
                    ok: ids.length - failures,
                    fail: failures,
                  }),
                );
              } else {
                Alert.alert(t("app.messages.deleteDone"), t("app.messages.deleteAllOk"));
              }
            })();
          },
        },
      ],
    );
  }, [selectedCount, selectedIds, deleteConversation, exitSelectMode, t]);

  const openConversation = useCallback(
    (c: Conversation) => {
      if (!c?.id) return;
      router.push(`/conversation/${c.id}`);
    },
    [router],
  );

  const onRowPress = useCallback(
    (c: Conversation) => {
      if (selectMode) {
        toggleRowSelect(c.id);
        return;
      }
      openConversation(c);
    },
    [selectMode, toggleRowSelect, openConversation],
  );

  const onRowLongPress = useCallback(
    (c: Conversation) => {
      if (!c?.id) return;
      setSelectMode(true);
      setSelectedIds((prev) => ({ ...prev, [c.id]: true }));
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const unread = item.unreadCount?.[user?.uid || ""] || 0;
      const peerName = peerDisplayName(item, user?.uid);
      const title = (
        (item.type === "direct" && peerName) ||
        item.title ||
        t("app.messages.fallbackConversationTitle")
      ).trim();
      const avatarUrl = peerAvatarUrl(item, user?.uid);
      const typeLabel = t(`app.messages.types.${item.type}`, {
        defaultValue: item.type,
      });
      const preview =
        (item.lastMessage || "").trim() || t("app.messages.noPreviewYet");
      const isSelected = Boolean(selectedIds[item.id]);

      return (
        <Pressable
          onPress={() => onRowPress(item)}
          onLongPress={() => onRowLongPress(item)}
          delayLongPress={380}
          style={({ pressed }) => [
            styles.row,
            unread > 0 && styles.rowUnread,
            pressed && styles.rowPressed,
            selectMode && isSelected && styles.rowSelected,
          ]}
        >
          {selectMode ? (
            <View
              style={styles.selectMark}
              accessibilityLabel={isSelected ? t("app.messages.deselectRow") : t("app.messages.selectRow")}
            >
              <Ionicons
                name={isSelected ? "checkbox" : "square-outline"}
                size={24}
                color={isSelected ? "#EA580C" : "#9CA3AF"}
              />
            </View>
          ) : null}
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={120}
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>
                  {initialsFromTitle(title)}
                </Text>
              </View>
            )}
            {unread > 0 ? (
              <View style={styles.unreadDot} accessibilityLabel={t("app.messages.a11yUnread", { count: unread })} />
            ) : null}
          </View>

          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text
                style={[styles.rowTitle, unread > 0 && styles.rowTitleUnread]}
                numberOfLines={1}
              >
                {title}
              </Text>
              <Text style={styles.rowTime}>
                {formatMessageTime(item.lastMessageTime, dateLocale, t)}
              </Text>
            </View>
            <Text
              style={[styles.rowPreview, unread > 0 && styles.rowPreviewUnread]}
              numberOfLines={2}
            >
              {preview}
            </Text>
            <View style={styles.rowMeta}>
              <View style={styles.typeChip}>
                <Ionicons
                  name={iconForType(item.type)}
                  size={12}
                  color="#C2410C"
                />
                <Text style={styles.typeChipText}>{typeLabel}</Text>
              </View>
              {unread > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unread > 99 ? "99+" : unread}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {!selectMode ? (
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          ) : null}
        </Pressable>
      );
    },
    [onRowPress, onRowLongPress, selectMode, selectedIds, user?.uid],
  );

  const listFooter = useMemo(() => {
    if (loadingMoreConversations) {
      return (
        <View style={styles.listFooter}>
          <ActivityIndicator size="small" color="#EA580C" />
          <Text style={styles.listFooterText}>{t("app.messages.loadMoreFooter")}</Text>
        </View>
      );
    }
    if (hasMoreConversations) {
      return (
        <Pressable
          style={styles.loadMoreBtn}
          onPress={() => void loadMoreConversations()}
        >
          <Text style={styles.loadMoreBtnText}>{t("app.messages.loadMoreOlder")}</Text>
        </Pressable>
      );
    }
    return null;
  }, [hasMoreConversations, loadingMoreConversations, loadMoreConversations, t]);

  if (!user) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <RNStatusBar barStyle="dark-content" />
        <View style={styles.guest}>
          <View style={styles.guestIcon}>
            <Ionicons name="chatbubbles-outline" size={40} color="#EA580C" />
          </View>
          <Text style={styles.guestTitle}>{t("app.messages.guestTitle")}</Text>
          <Text style={styles.guestText}>{t("app.messages.guestBody")}</Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push("/(tabs)/account")}
          >
            <Text style={styles.primaryBtnText}>{t("app.messages.signIn")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <RNStatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>
              {selectMode ? "Sélection" : "Messages"}
            </Text>
            {selectMode ? (
              <Text style={styles.headerSubtitle}>
                {selectedCount} sélectionnée(s). Touchez une ligne pour cocher ou décocher.
              </Text>
            ) : unreadTotal > 0 ? (
              <Text style={styles.headerSubtitle}>
                {unreadTotal} non lu{unreadTotal > 1 ? "s" : ""}
              </Text>
            ) : (
              <Text style={styles.headerSubtitleMuted}>
                Boutiques, commandes et discussions
              </Text>
            )}
          </View>
          <View style={styles.headerActions}>
            {selectMode ? (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.iconBtn,
                    pressed && styles.iconBtnPressed,
                  ]}
                  onPress={exitSelectMode}
                  accessibilityLabel={t("app.messages.cancelSelectA11y")}
                >
                  <Text style={styles.headerActionText}>{t("app.messages.cancel")}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.iconBtn,
                    styles.deleteIconBtn,
                    pressed && styles.iconBtnPressed,
                    selectedCount === 0 && styles.iconBtnDisabled,
                  ]}
                  disabled={selectedCount === 0}
                  onPress={confirmBulkDelete}
                  accessibilityLabel={t("app.messages.deleteSelectA11y")}
                >
                  <Ionicons name="trash-outline" size={22} color="#B91C1C" />
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={({ pressed }) => [
                    styles.iconBtn,
                    pressed && styles.iconBtnPressed,
                  ]}
                  onPress={() => setSelectMode(true)}
                  accessibilityLabel={t("app.messages.selectModeA11y")}
                >
                  <Ionicons name="checkbox-outline" size={22} color="#111827" />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.iconBtn,
                    pressed && styles.iconBtnPressed,
                  ]}
                  onPress={() => router.push("/search-entrepreneurs")}
                  accessibilityLabel={t("app.messages.findShopA11y")}
                >
                  <Ionicons name="storefront-outline" size={22} color="#111827" />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.iconBtn,
                    pressed && styles.iconBtnPressed,
                  ]}
                  onPress={() => router.push("/(tabs)/")}
                  accessibilityLabel={t("app.messages.homeSearchA11y")}
                >
                  <Ionicons name="create-outline" size={22} color="#111827" />
                </Pressable>
              </>
            )}
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher une conversation…"
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList
          horizontal
          data={filters}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          style={styles.chipsList}
          contentContainerStyle={styles.chipsScroll}
          renderItem={({ item: f }) => {
            const active = filter === f.key;
            return (
              <Pressable
                onPress={() => setFilter(f.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          }}
        />

        <View style={styles.shortcuts}>
          <Pressable
            style={styles.shortcut}
            onPress={() => router.push("/orders")}
          >
            <Ionicons name="bag-handle-outline" size={16} color="#EA580C" />
            <Text style={styles.shortcutText}>{t("app.messages.shortcutOrders")}</Text>
          </Pressable>
          <View style={styles.shortcutSep} />
          <Pressable
            style={styles.shortcut}
            onPress={() => router.push("/support")}
          >
            <Ionicons name="help-circle-outline" size={16} color="#EA580C" />
            <Text style={styles.shortcutText}>{t("app.messages.shortcutHelp")}</Text>
          </Pressable>
          <View style={styles.shortcutSep} />
          <Pressable
            style={styles.shortcut}
            onPress={() => router.push("/search-entrepreneurs")}
          >
            <Ionicons name="business-outline" size={16} color="#EA580C" />
            <Text style={styles.shortcutText}>{t("app.messages.shortcutStores")}</Text>
          </Pressable>
        </View>
      </View>

      {loading && conversations.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#EA580C" />
          <Text style={styles.loadingText}>{t("app.messages.loadingConversations")}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
          ListFooterComponent={listFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#EA580C"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbox-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>{t("app.messages.emptyTitle")}</Text>
              <Text style={styles.emptyHint}>
                {normalizedSearch
                  ? t("app.messages.emptyHintSearch")
                  : filter === "all"
                    ? t("app.messages.emptyHintAll")
                    : t("app.messages.emptyHintCategory")}
              </Text>
              {!normalizedSearch && filter === "all" ? (
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => router.push("/(tabs)/index")}
                >
                  <Text style={styles.secondaryBtnText}>{t("app.messages.discoverHome")}</Text>
                </Pressable>
              ) : null}
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  headerTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: "#EA580C",
  },
  headerSubtitleMuted: {
    marginTop: 4,
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
    maxWidth: "52%",
  },
  headerActionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#EA580C",
    paddingHorizontal: 4,
  },
  iconBtn: {
    minWidth: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  deleteIconBtn: {
    backgroundColor: "#FEE2E2",
  },
  iconBtnDisabled: {
    opacity: 0.4,
  },
  iconBtnPressed: {
    opacity: 0.85,
    backgroundColor: "#E5E7EB",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: "#111827",
    paddingVertical: 0,
  },
  chipsList: {
    flexGrow: 0,
  },
  chipsScroll: {
    paddingTop: 14,
    paddingBottom: 4,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: "#111827",
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  chipLabelActive: {
    color: "#FFFFFF",
  },
  shortcuts: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: "#FFFBF5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  shortcut: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  shortcutSep: {
    width: 1,
    height: 16,
    backgroundColor: "#FDBA74",
  },
  shortcutText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9A3412",
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 100,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  rowUnread: {
    borderColor: "#FDBA74",
    backgroundColor: "#FFFBF5",
  },
  rowPressed: {
    opacity: 0.92,
  },
  rowSelected: {
    borderColor: "#EA580C",
    backgroundColor: "#FFF7ED",
  },
  selectMark: {
    marginRight: 8,
    justifyContent: "center",
  },
  listFooter: {
    paddingVertical: 20,
    alignItems: "center",
    gap: 8,
  },
  listFooterText: {
    fontSize: 13,
    color: "#6B7280",
  },
  loadMoreBtn: {
    marginHorizontal: 20,
    marginVertical: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  loadMoreBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#EA580C",
  },
  avatarWrap: {
    position: "relative",
    marginRight: 12,
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F3F4F6",
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: "700",
    color: "#C2410C",
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EA580C",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  rowTitleUnread: {
    fontWeight: "700",
    color: "#111827",
  },
  rowTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  peerName: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
  },
  rowPreview: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
  },
  rowPreviewUnread: {
    color: "#4B5563",
    fontWeight: "500",
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#FFEDD5",
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9A3412",
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: "#EA580C",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 40,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 17,
    fontWeight: "700",
    color: "#374151",
  },
  emptyHint: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
  },
  secondaryBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  guest: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  guestIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
  },
  guestTitle: {
    marginTop: 24,
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  guestText: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
  },
  primaryBtn: {
    marginTop: 28,
    backgroundColor: "#EA580C",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
