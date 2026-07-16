import React, { useCallback } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

type PaymentStatus = "pending" | "paid" | "failed";

export interface ProductPaymentMessage {
  product?: {
    id?: string;
    name?: string;
    price?: number;
    currency?: string;
    image?: string;
    specifications?: {
      weight?: string;
      dimensions?: string;
      volume?: string;
    };
  };
  payment?: {
    url?: string;
    provider?: "ngenius";
    status?: PaymentStatus;
  };
}

export default function ProductMessageCard({
  message,
  isMine,
}: {
  message: ProductPaymentMessage;
  isMine: boolean;
}) {
  const product = message.product || {};
  const payment = message.payment || {};
  const status = payment.status || "pending";
  const hasPaymentUrl = Boolean(payment.url && payment.url.trim().length > 0);

  const statusLabel =
    status === "paid" ? "Paye" : status === "failed" ? "Echec" : "En attente";
  const statusColor =
    status === "paid" ? "#16A34A" : status === "failed" ? "#DC2626" : "#2563EB";
  const statusBg =
    status === "paid" ? "#DCFCE7" : status === "failed" ? "#FEE2E2" : "#DBEAFE";

  const handlePay = useCallback(async () => {
    const url = payment.url;
    if (!url) return;
    const can = await Linking.canOpenURL(url);
    if (!can) return;
    await Linking.openURL(url);
  }, [payment.url]);

  return (
    <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
      <View style={styles.card}>
        <View style={styles.top}>
          <Text style={styles.label}>{hasPaymentUrl ? "Paiement produit" : "Fiche produit"}</Text>
          <View style={[styles.badge, { backgroundColor: statusBg }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {hasPaymentUrl ? statusLabel : "Information"}
            </Text>
          </View>
        </View>
        <View style={styles.body}>
          {product.image ? (
            <Image
              source={{ uri: product.image }}
              style={styles.image}
              contentFit="cover"
              transition={120}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.image, styles.imagePh]} />
          )}
          <View style={styles.mid}>
            <Text style={styles.name} numberOfLines={2}>
              {product.name || "Produit"}
            </Text>
            <Text style={styles.price}>
              {Number(product.price || 0).toLocaleString("fr-FR")} {product.currency || "XOF"}
            </Text>
            {product.specifications?.weight ? (
              <Text style={styles.spec}>Poids: {product.specifications.weight}</Text>
            ) : null}
            {product.specifications?.dimensions ? (
              <Text style={styles.spec}>Dimensions: {product.specifications.dimensions}</Text>
            ) : null}
            {product.specifications?.volume ? (
              <Text style={styles.spec}>Volume: {product.specifications.volume}</Text>
            ) : null}
          </View>
          {hasPaymentUrl ? (
            <Pressable style={styles.payBtn} onPress={() => void handlePay()}>
              <Text style={styles.payBtnText}>Payer</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 10, width: "100%" },
  rowMine: { alignItems: "flex-end" },
  rowTheirs: { alignItems: "flex-start" },
  card: {
    width: "86%",
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  body: { flexDirection: "row", alignItems: "center", gap: 10 },
  image: { width: 56, height: 56, borderRadius: 10, backgroundColor: "#F3F4F6" },
  imagePh: { backgroundColor: "#E5E7EB" },
  mid: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: "700", color: "#111827" },
  price: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#EA580C" },
  spec: { marginTop: 2, fontSize: 11, color: "#6B7280" },
  payBtn: {
    backgroundColor: "#EA580C",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  payBtnText: { color: "#FFF", fontWeight: "700", fontSize: 12 },
});
