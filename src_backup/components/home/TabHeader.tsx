import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Link, usePathname } from "expo-router";

const PRIMARY = "#ff6a00";
const TEXT_DARK = "#1a1a1a";
const TEXT_MUTED = "#666";
const BG_WHITE = "#ffffff";

export default function TabHeader() {
  const pathname = usePathname();

  const isProducts =
    pathname === "/(tabs)/home" ||
    pathname === "/(tabs)" ||
    pathname?.startsWith("/(tabs)") ||
    // Fallback: quand on est sur la home via redirections
    (!pathname?.startsWith("/suppliers") &&
      !pathname?.startsWith("/global-suppliers"));

  const isSuppliers = pathname?.startsWith("/suppliers");
  const isGlobal = pathname?.startsWith("/global-suppliers");

  return (
    <View style={styles.container}>
      {/* Onglets */}
      <View style={styles.tabsRow}>
        {/* Produits (reste sur la Home) */}
        <Link href="/(tabs)/home" asChild>
          <TouchableOpacity style={styles.tab}>
            <Text style={[styles.tabText, isProducts && styles.tabTextActive]}>
              Produits
            </Text>
            {isProducts && <View style={styles.activeBar} />}
          </TouchableOpacity>
        </Link>

        {/* Fabricants -> /suppliers */}
        <Link href="/suppliers" asChild>
          <TouchableOpacity style={styles.tab}>
            <Text style={[styles.tabText, isSuppliers && styles.tabTextActive]}>
              Fabricants
            </Text>
            {isSuppliers && <View style={styles.activeBar} />}
          </TouchableOpacity>
        </Link>

        {/* Mondial -> /global-suppliers */}
        <Link href="/global-suppliers" asChild>
          <TouchableOpacity style={styles.tab}>
            <Text style={[styles.tabText, isGlobal && styles.tabTextActive]}>
              Mondial
            </Text>
            {isGlobal && <View style={styles.activeBar} />}
          </TouchableOpacity>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG_WHITE,
    paddingTop: 4,
    paddingBottom: 0,
  },
  tabsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tab: {
    paddingVertical: 0,
    alignItems: "center",
    minWidth: 100,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_MUTED,
  },
  tabTextActive: {
    color: PRIMARY,
  },
  activeBar: {
    marginTop: 8,
    height: 3,
    width: 34,
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },
});
