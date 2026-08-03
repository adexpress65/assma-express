import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  TouchableWithoutFeedback,
  GestureResponderEvent,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedImage = Animated.createAnimatedComponent(Image);
const AnimatedView = Animated.createAnimatedComponent(View);
const MAX_ZOOM = 4;
const MIN_ZOOM = 1;
const DOUBLE_TAP_ZOOM = 2.4;
const DOUBLE_TAP_DELAY_MS = 290;
const DRAG_DEADZONE = 18;
const PINCH_DEADZONE = 0.08;

type ProfileDetail = {
  label: string;
  value: string;
};

type ProfileData = {
  id?: string;
  name: string;
  role?: string;
  avatarUrl?: string | null;
  logo?: string | null;         // Ajouté pour Firestore
  coverImage?: string | null;   // Ajouté pour Firestore
  subtitle?: string;
  phone?: string;
  address?: string;
  details?: ProfileDetail[];
};

type Props = {
  visible: boolean;
  profile: ProfileData | null;
  onClose: () => void;
};

export default function ConversationProfileModal({
  visible,
  profile,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const scaleRef = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastOffset = useRef({ x: 0, y: 0 });
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{
    id: string | number;
    x: number;
    y: number;
    taps: number;
  } | null>(null);
  const twoFingerStartRef = useRef<{
    cx: number;
    cy: number;
    dist: number;
    scale: number;
    tx: number;
    ty: number;
  } | null>(null);
  const pointersCountRef = useRef(0);
  const lastMovedDistance = useRef(0);

  useEffect(() => {
    if (!visible) {
      lastScale.current = 1;
      scaleRef.setValue(1);
      translateX.setValue(0);
      translateX.setOffset(0);
      translateY.setValue(0);
      translateY.setOffset(0);
      lastOffset.current = { x: 0, y: 0 };
      setFullscreenMode(false);
      pointersCountRef.current = 0;
      twoFingerStartRef.current = null;
      touchStartRef.current = null;
      lastMovedDistance.current = 0;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      tapCountRef.current = 0;
    }
  }, [visible, scaleRef, translateX, translateY]);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  const resetZoomState = useCallback(() => {
    lastScale.current = 1;
    lastOffset.current = { x: 0, y: 0 };
    scaleRef.setValue(1);
    translateX.setOffset(0);
    translateY.setOffset(0);
    translateX.setValue(0);
    translateY.setValue(0);
  }, [scaleRef, translateX, translateY]);

  const zoomTo = useCallback(
    (target: number) => {
      lastScale.current = target;
      lastOffset.current = { x: 0, y: 0 };
      translateX.setOffset(0);
      translateY.setOffset(0);
      translateX.setValue(0);
      translateY.setValue(0);
      Animated.spring(scaleRef, {
        toValue: target,
        useNativeDriver: false,
        friction: 9,
        tension: 50,
      }).start();
    },
    [scaleRef, translateX, translateY],
  );

  const scheduleTapResolution = useCallback(() => {
    const currentCount = tapCountRef.current;
    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
    }
    tapTimerRef.current = setTimeout(() => {
      tapTimerRef.current = null;
      tapCountRef.current = 0;
      if (currentCount >= 2) {
        if (lastScale.current > 1.1) {
          zoomTo(1);
        } else {
          zoomTo(DOUBLE_TAP_ZOOM);
        }
      } else if (currentCount === 1) {
        if (lastScale.current > 1.1) {
          zoomTo(1);
        } else {
          setFullscreenMode((prev) => !prev);
        }
      }
    }, DOUBLE_TAP_DELAY_MS);
  }, [zoomTo]);

  const getEventDistance = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;
    if (touches.length < 2) return 0;
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getEventCentroid = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;
    if (touches.length === 0) return { x: 0, y: 0 };
    if (touches.length === 1) return { x: touches[0].pageX, y: touches[0].pageY };
    return {
      x: (touches[0].pageX + touches[1].pageX) / 2,
      y: (touches[0].pageY + touches[1].pageY) / 2,
    };
  };

  const onResponderStart = useCallback((e: GestureResponderEvent) => {
    pointersCountRef.current = e.nativeEvent.touches.length;
    if (e.nativeEvent.touches.length >= 2) {
      const dist = getEventDistance(e);
      const c = getEventCentroid(e);
      twoFingerStartRef.current = {
        cx: c.x,
        cy: c.y,
        dist,
        scale: lastScale.current,
        tx: lastOffset.current.x,
        ty: lastOffset.current.y,
      };
      lastMovedDistance.current = 0;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      tapCountRef.current = 0;
      touchStartRef.current = null;
    } else if (e.nativeEvent.touches.length === 1) {
      const t = e.nativeEvent.touches[0];
      const id = t.identifier ?? Date.now();
      if (!twoFingerStartRef.current) {
        touchStartRef.current = {
          id,
          x: t.pageX,
          y: t.pageY,
          taps: tapCountRef.current,
        };
      } else {
        touchStartRef.current = null;
      }
      lastMovedDistance.current = 0;
    }
  }, []);

  const onResponderMove = useCallback(
    (e: GestureResponderEvent) => {
      const touches = e.nativeEvent.touches;
      pointersCountRef.current = touches.length;

      if (touches.length >= 2 && twoFingerStartRef.current) {
        const dist = getEventDistance(e);
        const start = twoFingerStartRef.current;
        if (start.dist > 0) {
          const ratio = dist / start.dist;
          let target = start.scale * ratio;
          target = Math.max(MIN_ZOOM, Math.min(target, MAX_ZOOM));
          scaleRef.setValue(target);
          const c = getEventCentroid(e);
          const pdx = (c.x - start.cx) / 2;
          const pdy = (c.y - start.cy) / 2;
          translateX.setValue(start.tx + pdx);
          translateY.setValue(start.ty + pdy);
        }
        return;
      }

      if (touches.length === 1 && !twoFingerStartRef.current) {
        const t = touches[0];
        if (!touchStartRef.current) {
          touchStartRef.current = {
            id: t.identifier ?? Date.now(),
            x: t.pageX,
            y: t.pageY,
            taps: tapCountRef.current,
          };
          return;
        }
        const start = touchStartRef.current;
        const dx = t.pageX - start.x;
        const dy = t.pageY - start.y;
        const distFromStart = Math.sqrt(dx * dx + dy * dy);
        lastMovedDistance.current = Math.max(
          lastMovedDistance.current,
          distFromStart,
        );
        if (
          lastScale.current > 1.01 &&
          lastMovedDistance.current > DRAG_DEADZONE
        ) {
          if (tapTimerRef.current) {
            clearTimeout(tapTimerRef.current);
            tapTimerRef.current = null;
          }
          tapCountRef.current = 0;
          translateX.setValue(lastOffset.current.x + dx);
          translateY.setValue(lastOffset.current.y + dy);
        }
      }
    },
    [translateX, translateY, scaleRef],
  );

  const onResponderRelease = useCallback(
    (e: GestureResponderEvent) => {
      const wasTwoFinger = !!twoFingerStartRef.current;

      if (e.nativeEvent.touches.length <= 1 && twoFingerStartRef.current) {
        let finalScale = lastScale.current;
        try {
          const v = (scaleRef as any)._value;
          if (typeof v === "number" && isFinite(v)) finalScale = v;
        } catch {}
        finalScale = Math.max(
          MIN_ZOOM,
          Math.min(finalScale, MAX_ZOOM),
        );
        lastScale.current = finalScale;
        let fx = lastOffset.current.x;
        let fy = lastOffset.current.y;
        try {
          const tv = (translateX as any)._value;
          const tyv = (translateY as any)._value;
          if (typeof tv === "number") fx = tv;
          if (typeof tyv === "number") fy = tyv;
        } catch {}
        if (finalScale <= 1.01) {
          lastOffset.current = { x: 0, y: 0 };
          translateX.setOffset(0);
          translateY.setOffset(0);
          translateX.setValue(0);
          translateY.setValue(0);
          Animated.spring(scaleRef, {
            toValue: 1,
            useNativeDriver: false,
            friction: 9,
            tension: 60,
          }).start();
        } else {
          lastOffset.current = { x: fx, y: fy };
          translateX.setOffset(fx);
          translateY.setOffset(fy);
          translateX.setValue(0);
          translateY.setValue(0);
          Animated.spring(scaleRef, {
            toValue: finalScale,
            useNativeDriver: false,
            friction: 9,
            tension: 60,
          }).start();
        }
        twoFingerStartRef.current = null;
        touchStartRef.current = null;
        pointersCountRef.current = 0;
        return;
      }

      if (
        !wasTwoFinger &&
        touchStartRef.current &&
        pointersCountRef.current >= 0 &&
        e.nativeEvent.touches.length === 0
      ) {
        if (lastMovedDistance.current < DRAG_DEADZONE) {
          tapCountRef.current += 1;
          scheduleTapResolution();
        }
        if (lastScale.current > 1.01) {
          let fx = lastOffset.current.x;
          let fy = lastOffset.current.y;
          try {
            const tv = (translateX as any)._value;
            const tyv = (translateY as any)._value;
            if (typeof tv === "number") fx = tv;
            if (typeof tyv === "number") fy = tyv;
          } catch {}
          lastOffset.current = { x: fx, y: fy };
          translateX.setOffset(fx);
          translateY.setOffset(fy);
          translateX.setValue(0);
          translateY.setValue(0);
        }
        touchStartRef.current = null;
      }

      if (e.nativeEvent.touches.length === 0) {
        twoFingerStartRef.current = null;
        pointersCountRef.current = 0;
      }
    },
    [scaleRef, translateX, translateY, scheduleTapResolution],
  );

  const onStartShouldSetResponder = useCallback(() => true, []);
  const onMoveShouldSetResponder = useCallback(() => true, []);
  const onResponderTerminationRequest = useCallback(() => false, []);

  if (!profile) return null;

  // Récupération intelligente de l'image : priorise avatarUrl, puis le logo Firestore, puis coverImage
  const imageSource = profile.avatarUrl || profile.logo || profile.coverImage;

  // Filtrer les détails techniques pour ne garder que l'essentiel visible
  const filteredDetails = (profile.details || []).filter((detail) => {
    const lowerLabel = detail.label.toLowerCase();
    const isTechnical =
      lowerLabel.includes("id") ||
      lowerLabel.includes("uid") ||
      lowerLabel.includes("conversation") ||
      lowerLabel.includes("boutique") ||
      lowerLabel.includes("type");
    return !isTechnical;
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      transparent={false}
      onRequestClose={onClose}
    >
      <View
        style={[
          fullscreenMode ? styles.overlayDark : styles.overlay,
          { paddingTop: insets.top },
        ]}
      >
        <View
          style={[
            styles.header,
            fullscreenMode && {
              backgroundColor: "rgba(0,0,0,0.45)",
              borderBottomColor: "rgba(255,255,255,0.1)",
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              paddingTop: insets.top + 12,
            },
          ]}
        >
          <View style={styles.headerText}>
            <Text
              style={[styles.title, fullscreenMode && { color: "#FFFFFF" }]}
              numberOfLines={1}
            >
              {profile.name}
            </Text>
            {profile.role ? (
              <Text
                style={[
                  styles.role,
                  fullscreenMode && { color: "rgba(255,255,255,0.8)" },
                ]}
              >
                {profile.role}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerButtonsRow}>
            <Pressable
              style={styles.headerIconBtn}
              onPress={() => {
                if (lastScale.current > 1.1) {
                  resetZoomState();
                } else {
                  setFullscreenMode((p) => !p);
                }
              }}
              hitSlop={8}
              accessibilityLabel="Zoomer la photo"
            >
              <Ionicons
                name={fullscreenMode ? "contract" : "expand"}
                size={22}
                color={fullscreenMode ? "#FFFFFF" : "#111827"}
              />
            </Pressable>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Fermer"
            >
              <Ionicons
                name="close"
                size={26}
                color={fullscreenMode ? "#FFFFFF" : "#111827"}
              />
            </Pressable>
          </View>
        </View>

        <View style={[styles.body, fullscreenMode && styles.bodyFullscreen]}>
          <AnimatedView
            style={[
              fullscreenMode
                ? styles.imageWrapperFullscreen
                : styles.imageWrapper,
            ]}
            onStartShouldSetResponder={onStartShouldSetResponder}
            onMoveShouldSetResponder={onMoveShouldSetResponder}
            onResponderStart={onResponderStart}
            onResponderMove={onResponderMove}
            onResponderRelease={onResponderRelease}
            onResponderTerminationRequest={onResponderTerminationRequest}
            onResponderReject={onResponderRelease}
            pointerEvents="auto"
          >
            <AnimatedView
              style={{
                width: "100%",
                height: "100%",
                transform: [
                  { scale: scaleRef },
                  { translateX },
                  { translateY },
                ],
              }}
            >
              {imageSource ? (
                <AnimatedImage
                  source={{ uri: imageSource }}
                  style={
                    fullscreenMode
                      ? styles.avatarLargeFullscreen
                      : styles.avatarLarge
                  }
                  contentFit="contain"
                  transition={120}
                  cachePolicy="memory-disk"
                />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    fullscreenMode && styles.avatarFallbackDark,
                  ]}
                >
                  <Ionicons
                    name="person"
                    size={fullscreenMode ? 120 : 64}
                    color={fullscreenMode ? "#6B7280" : "#9CA3AF"}
                  />
                </View>
              )}
            </AnimatedView>
          </AnimatedView>

          {!fullscreenMode ? (
            <>
              <TouchableWithoutFeedback
                onPress={() => {
                  if (lastScale.current > 1.1) zoomTo(1);
                  else zoomTo(DOUBLE_TAP_ZOOM);
                }}
              >
                <View style={styles.zoomHintRow}>
                  <Ionicons name="resize" size={14} color="#6B7280" />
                  <Text style={styles.zoomHint}>
                    Double-cliquez ou pincez pour zoomer
                  </Text>
                </View>
              </TouchableWithoutFeedback>

              {profile.subtitle ? (
                <Text style={styles.subtitle}>{profile.subtitle}</Text>
              ) : null}

              {(filteredDetails.length > 0 || profile.phone || profile.address) ? (
                <View style={styles.detailsCard}>
                  {profile.phone ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Téléphone</Text>
                      <Text style={styles.detailValue} numberOfLines={1} selectable>
                        {profile.phone}
                      </Text>
                    </View>
                  ) : null}

                  {profile.address ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Adresse</Text>
                      <Text style={styles.detailValue} numberOfLines={2} selectable>
                        {profile.address}
                      </Text>
                    </View>
                  ) : null}

                  {filteredDetails.map((detail) => (
                    <View key={detail.label} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{detail.label}</Text>
                      <Text
                        style={styles.detailValue}
                        numberOfLines={2}
                        selectable
                      >
                        {detail.value}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.fullscreenBadge}>
              <Text style={styles.fullscreenBadgeText}>
                {lastScale.current > 1.1
                  ? `Zoom ${lastScale.current.toFixed(1)}x`
                  : "Mode plein écran"}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#FFFFFF" },
  overlayDark: { flex: 1, backgroundColor: "#000000" },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  headerText: { flex: 1, minWidth: 0, paddingRight: 8 },
  headerButtonsRow: { flexDirection: "row", alignItems: "center" },
  headerIconBtn: {
    padding: 8,
    marginRight: 4,
    borderRadius: 20,
    minWidth: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  role: { marginTop: 4, fontSize: 14, color: "#6B7280" },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    minWidth: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  bodyFullscreen: {
    paddingHorizontal: 0,
    paddingTop: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  imageWrapper: {
    width: "100%",
    height: 320,
    maxHeight: 360,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  imageWrapperFullscreen: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  avatarLarge: { width: "100%", height: "100%" },
  avatarLargeFullscreen: { width: "100%", height: "100%" },
  avatarFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
  },
  avatarFallbackDark: {
    backgroundColor: "#111827",
    borderRadius: 0,
  },
  zoomHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  zoomHint: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  subtitle: {
    marginTop: 6,
    textAlign: "center",
    fontSize: 14,
    color: "#4B5563",
    maxWidth: "90%",
    lineHeight: 20,
  },
  detailsCard: {
    marginTop: 20,
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: "#6B7280",
    flex: 0.9,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "700",
    flex: 1.1,
    textAlign: "right",
  },
  fullscreenBadge: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  fullscreenBadgeText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    overflow: "hidden",
  },
});