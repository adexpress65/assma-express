import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import {
  PanGestureHandler,
  PinchGestureHandler,
  State,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

const AnimatedImage = Animated.createAnimatedComponent(Image);

const MAX_ZOOM = 4;
const MIN_ZOOM = 1;

type PaymentStatus = "pending" | "paid" | "failed";

export interface ProductPaymentMessage {
  imageUrl?: string;
  image?: string;
  metadata?: Record<string, unknown>;
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

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerImageUri, setViewerImageUri] = useState<string | null>(null);
  const pinchScale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastOffset = useRef({ x: 0, y: 0 });
  const productMetadata = message.metadata || {};

  const resolvedImageUri = useMemo(() => {
    const candidates = [
      product.image,
      message.imageUrl,
      message.image,
      typeof productMetadata.imageUrl === "string" ? productMetadata.imageUrl : undefined,
      typeof productMetadata.image === "string" ? productMetadata.image : undefined,
      typeof productMetadata.photoUrl === "string" ? productMetadata.photoUrl : undefined,
    ];

    return candidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.trim().length > 0,
    ) ?? null;
  }, [message.image, message.imageUrl, product.image, productMetadata]);

  const zoomScale = Animated.multiply(baseScale, pinchScale);

  const openViewer = useCallback(() => {
    if (resolvedImageUri) {
      setViewerImageUri(resolvedImageUri);
      setViewerVisible(true);
    }
  }, [resolvedImageUri]);

  const closeViewer = useCallback(() => {
    setViewerVisible(false);
    setViewerImageUri(null);
    lastScale.current = 1;
    baseScale.setValue(1);
    pinchScale.setValue(1);
    translateX.setValue(0);
    translateX.setOffset(0);
    translateY.setValue(0);
    translateY.setOffset(0);
    lastOffset.current = { x: 0, y: 0 };
  }, [baseScale, pinchScale, translateX, translateY]);

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: false },
  );

  const onPinchStateChange = useCallback(
    (event) => {
      if (
        event.nativeEvent.state === State.END ||
        event.nativeEvent.state === State.CANCELLED ||
        event.nativeEvent.state === State.FAILED
      ) {
        const nextScale = Math.max(
          MIN_ZOOM,
          Math.min(lastScale.current * event.nativeEvent.scale, MAX_ZOOM),
        );
        lastScale.current = nextScale;
        baseScale.setValue(nextScale);
        pinchScale.setValue(1);
      }
    },
    [baseScale, pinchScale],
  );

  const onPanEvent = Animated.event(
    [
      {
        nativeEvent: {
          translationX: translateX,
          translationY: translateY,
        },
      },
    ],
    { useNativeDriver: false },
  );

  const onPanStateChange = useCallback(
    (event) => {
      if (event.nativeEvent.state === State.END) {
        lastOffset.current = {
          x: lastOffset.current.x + event.nativeEvent.translationX,
          y: lastOffset.current.y + event.nativeEvent.translationY,
        };
        translateX.setOffset(lastOffset.current.x);
        translateX.setValue(0);
        translateY.setOffset(lastOffset.current.y);
        translateY.setValue(0);
      }
    },
    [translateX, translateY],
  );

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
          {resolvedImageUri ? (
            <>
              <Pressable
                onPress={openViewer}
                style={styles.imagePressable}
                hitSlop={8}
              >
                <Image
                  source={{ uri: resolvedImageUri }}
                  style={styles.image}
                  contentFit="cover"
                  transition={120}
                  cachePolicy="memory-disk"
                />
              </Pressable>
              <Modal
                visible={viewerVisible}
                animationType="fade"
                transparent={false}
                onRequestClose={closeViewer}
              >
                <View style={styles.modalOverlay}>
                  <SafeAreaView edges={["top"]} style={styles.modalSafeArea}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle} numberOfLines={1}>
                        {product.name || "Photo du colis emballé"}
                      </Text>
                      <Pressable
                        style={styles.modalCloseBtn}
                        onPress={closeViewer}
                        hitSlop={10}
                      >
                        <Text style={styles.modalCloseText}>Fermer</Text>
                      </Pressable>
                    </View>
                  </SafeAreaView>
                  <View style={styles.modalBody}>
                    <PanGestureHandler
                      onGestureEvent={onPanEvent}
                      onHandlerStateChange={onPanStateChange}
                    >
                      <PinchGestureHandler
                        onGestureEvent={onPinchEvent}
                        onHandlerStateChange={onPinchStateChange}
                      >
                        <Animated.View style={styles.zoomContainer}>
                          <AnimatedImage
                            source={{ uri: viewerImageUri || resolvedImageUri }}
                            style={[
                              styles.zoomImage,
                              {
                                transform: [
                                  { scale: zoomScale },
                                  { translateX },
                                  { translateY },
                                ],
                              },
                            ]}
                            contentFit="contain"
                            transition={120}
                            cachePolicy="memory-disk"
                          />
                        </Animated.View>
                      </PinchGestureHandler>
                    </PanGestureHandler>
                  </View>
                </View>
              </Modal>
            </>
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
  imagePressable: { borderRadius: 10 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "#000",
  },
  modalSafeArea: {
    backgroundColor: "#000",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  modalCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  modalCloseText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  modalBody: {
    flex: 1,
  },
  zoomContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});
