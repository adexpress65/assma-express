import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  PanResponder,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Portal } from "@gorhom/portal";
import { useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Écrans où le raccourci est inutile ou gênant : accueil (déjà sur place),
 * saisie de message, tunnel de paiement, sélection d'image, intro.
 * Visible partout ailleurs (super-admin, produit, checkout terminé, etc.).
 */
const HIDDEN_ROOT_SEGMENTS = new Set([
  "intro",
  "conversation",
  "chat",
  "product-chat",
  "checkout",
  "payment",
  "payment-callback",
  "image-picker",
  "+not-found",
]);

const STORAGE_KEY = "floating-home-button-position-v1";
const DRAG_THRESHOLD = 10;
const DEFAULT_SIZE = { w: 110, h: 40 };

type Point = { x: number; y: number };

function isHomeTab(segments: string[]): boolean {
  if (segments[0] !== "(tabs)") return false;
  const tab = segments[1];
  return !tab || tab === "index";
}

export default function FloatingHomeButton() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [size, setSize] = useState(DEFAULT_SIZE);
  const [position, setPosition] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const positionRef = useRef<Point | null>(null);
  const dragOriginRef = useRef<Point | null>(null);
  const hasCustomPositionRef = useRef(false);
  const storageLoadedRef = useRef(false);

  const hidden = useMemo(() => {
    const rootSegment = segments[0];
    if (!rootSegment || HIDDEN_ROOT_SEGMENTS.has(rootSegment)) return true;
    return isHomeTab(segments as string[]);
  }, [segments]);

  const isProductScreen = segments[0] === "product";
  const bottomOffset = insets.bottom + (isProductScreen ? 148 : 96);

  const clamp = useCallback(
    (x: number, y: number): Point => {
      const minX = insets.left + 8;
      const maxX = screenW - size.w - insets.right - 8;
      const minY = insets.top + 8;
      const maxY = screenH - size.h - insets.bottom - 8;
      return {
        x: Math.min(maxX, Math.max(minX, x)),
        y: Math.min(maxY, Math.max(minY, y)),
      };
    },
    [insets.bottom, insets.left, insets.right, insets.top, screenH, screenW, size.h, size.w],
  );

  const defaultPosition = useMemo(
    () =>
      clamp(
        screenW - size.w - 14,
        screenH - bottomOffset - size.h,
      ),
    [bottomOffset, clamp, screenH, screenW, size.h, size.w],
  );

  const applyPosition = useCallback((next: Point) => {
    const clamped = clamp(next.x, next.y);
    positionRef.current = clamped;
    setPosition(clamped);
  }, [clamp]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Point>;
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            hasCustomPositionRef.current = true;
            applyPosition({ x: parsed.x, y: parsed.y });
          }
        }
      } catch {
        // Position par défaut si lecture impossible.
      } finally {
        storageLoadedRef.current = true;
        if (!cancelled && !hasCustomPositionRef.current) {
          applyPosition(defaultPosition);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyPosition, defaultPosition]);

  useEffect(() => {
    if (!storageLoadedRef.current || hasCustomPositionRef.current) return;
    applyPosition(defaultPosition);
  }, [applyPosition, defaultPosition]);

  const goToHome = useCallback(() => {
    router.dismissTo("/(tabs)");
    router.navigate("/(tabs)");
  }, [router]);

  const savePosition = useCallback(async (point: Point) => {
    const clamped = clamp(point.x, point.y);
    hasCustomPositionRef.current = true;
    positionRef.current = clamped;
    setPosition(clamped);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
    } catch {
      // Non bloquant.
    }
  }, [clamp]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const current = positionRef.current ?? defaultPosition;
          dragOriginRef.current = current;
          setDragging(true);
        },
        onPanResponderMove: (_, gesture) => {
          const origin = dragOriginRef.current;
          if (!origin) return;
          applyPosition({
            x: origin.x + gesture.dx,
            y: origin.y + gesture.dy,
          });
        },
        onPanResponderRelease: (_, gesture) => {
          const moved = Math.abs(gesture.dx) + Math.abs(gesture.dy);
          const finalPoint = positionRef.current ?? defaultPosition;

          if (moved < DRAG_THRESHOLD) {
            goToHome();
          } else {
            void savePosition(finalPoint);
          }

          dragOriginRef.current = null;
          setDragging(false);
        },
        onPanResponderTerminate: () => {
          dragOriginRef.current = null;
          setDragging(false);
        },
      }),
    [applyPosition, defaultPosition, goToHome, savePosition],
  );

  if (hidden) return null;

  const current = position ?? defaultPosition;

  return (
    <Portal>
      <View pointerEvents="box-none" style={styles.overlay}>
        <View
          {...panResponder.panHandlers}
          accessibilityRole="button"
          accessibilityLabel={t("app.tabs.home")}
          accessibilityHint="Appuyez pour l'accueil. Maintenez et glissez pour déplacer le bouton."
          collapsable={false}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0) {
              setSize({ w: width, h: height });
            }
          }}
          style={[
            styles.button,
            dragging && styles.buttonDragging,
            {
              left: current.x,
              top: current.y,
            },
          ]}
        >
          <Ionicons name="home" size={18} color="#FFFFFF" />
          <Text style={styles.label} numberOfLines={1}>
            {t("app.tabs.home")}
          </Text>
        </View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  button: {
    position: "absolute",
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: "rgba(255, 107, 0, 0.94)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  buttonDragging: {
    opacity: 0.92,
    transform: [{ scale: 1.04 }],
  },
  label: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
