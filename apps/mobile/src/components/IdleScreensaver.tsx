import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  AppState,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { usePathname, useSegments } from "expo-router";
import { useTranslation } from "react-i18next";
import { db } from "../config/firebase";

/**
 * Inactivité avant l'ouverture de la veille. Doit rester sous la mise en veille
 * de l'appareil (souvent 30 s) : au-delà, l'écran se verrouille avant nous et le
 * compte à rebours repart de zéro à chaque déverrouillage.
 */
const IDLE_DELAY_MS = 25_000;
/** Durée maximale d'affichage : un téléphone abandonné doit finir par s'endormir. */
const MAX_VISIBLE_MS = 180_000;
const KEEP_AWAKE_TAG = "idle-screensaver";
/** Durée d'affichage d'un produit. */
const SLIDE_DURATION_MS = 4_500;
const FADE_DURATION_MS = 700;
const CANDIDATES_FETCHED = 30;
const MAX_SLIDES = 12;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * Écrans où la veille est indésirable : paiement en cours, appel vidéo,
 * conversations (le client peut lire sans toucher), écrans de démarrage.
 */
const DISABLED_ROOT_SEGMENTS = new Set([
  "intro",
  "checkout",
  "payment",
  "payment-callback",
  "call",
  "conversation",
  "chat",
  "product-chat",
  "support",
  "image-picker",
]);

/** Dégradé répété deux fois pour que la boucle de défilement soit sans couture. */
const RAINBOW = [
  "#FF0080",
  "#FF6B00",
  "#FFD700",
  "#22C55E",
  "#0EA5E9",
  "#8B5CF6",
  "#FF0080",
  "#FF6B00",
  "#FFD700",
  "#22C55E",
  "#0EA5E9",
  "#8B5CF6",
  "#FF0080",
] as const;

type Slide = {
  id: string;
  name: string;
  image: string;
  price: string;
};

const asText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const pickImage = (data: Record<string, unknown>): string => {
  const images = Array.isArray(data.images) ? data.images : [];
  return (
    asText(data.mainImage) ||
    asText(data.imageUrl) ||
    asText(data.image) ||
    asText(images[0]) ||
    ""
  );
};

const formatPrice = (data: Record<string, unknown>): string => {
  const raw = data.price;
  const amount = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const currency = asText(data.currency) || "FCFA";
  return `${amount.toLocaleString()} ${currency}`;
};

async function fetchSlides(): Promise<Slide[]> {
  // orderBy sur un seul champ : aucun index composite requis.
  const snapshot = await getDocs(
    query(
      collection(db, "products"),
      orderBy("createdAt", "desc"),
      limit(CANDIDATES_FETCHED),
    ),
  );

  const slides: Slide[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const status = asText(data.status);
    if (status && status !== "published") return;
    if (data.isActive === false) return;

    const image = pickImage(data);
    const name = asText(data.name);
    if (!image || !name) return;

    slides.push({ id: docSnap.id, name, image, price: formatPrice(data) });
  });

  return slides.slice(0, MAX_SLIDES);
}

export default function IdleScreensaver({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const segments = useSegments();
  const pathname = usePathname();

  const [visible, setVisible] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slidesRequested = useRef(false);

  const disabled = useMemo(
    () => DISABLED_ROOT_SEGMENTS.has(segments[0] ?? ""),
    [segments],
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleIdle = useCallback(() => {
    clearTimer();
    if (disabled) return;
    timerRef.current = setTimeout(() => setVisible(true), IDLE_DELAY_MS);
  }, [clearTimer, disabled]);

  const dismiss = useCallback(() => {
    setVisible(false);
    scheduleIdle();
  }, [scheduleIdle]);

  // La closure du PanResponder est figée à la création : on passe par une ref.
  const onActivityRef = useRef<() => void>(() => {});
  onActivityRef.current = scheduleIdle;

  const panHandlers = useRef(
    PanResponder.create({
      // Capture sans jamais revendiquer le responder : les composants enfants
      // gardent la main sur les gestes, on ne fait qu'observer l'activité.
      onStartShouldSetPanResponderCapture: () => {
        onActivityRef.current();
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => {
        onActivityRef.current();
        return false;
      },
    }),
  ).current.panHandlers;

  useEffect(() => {
    if (disabled) {
      clearTimer();
      setVisible(false);
      return;
    }
    scheduleIdle();
    return clearTimer;
  }, [clearTimer, disabled, pathname, scheduleIdle]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        scheduleIdle();
      } else if (state === "background") {
        // iOS émet "inactive" de façon passagère (bandeau de notification,
        // sélecteur d'apps) : l'ignorer évite de réarmer le compte à rebours.
        clearTimer();
        setVisible(false);
      }
    });
    return () => sub.remove();
  }, [clearTimer, scheduleIdle]);

  useEffect(() => {
    if (!visible) return;
    // Sans cela la veille ne durerait que le temps restant avant le verrouillage
    // automatique de l'écran, soit quelques secondes.
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    const autoClose = setTimeout(() => setVisible(false), MAX_VISIBLE_MS);

    return () => {
      clearTimeout(autoClose);
      try {
        void deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        // Le verrou n'était pas posé : rien à libérer.
      }
    };
  }, [visible]);

  // Chargement à la première ouverture seulement : aucun coût au démarrage.
  useEffect(() => {
    if (!visible || slidesRequested.current) return;
    slidesRequested.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const next = await fetchSlides();
        if (cancelled || next.length === 0) return;
        setSlides(next);
        void Image.prefetch(
          next.map((slide) => slide.image),
          "memory-disk",
        );
      } catch {
        slidesRequested.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const drift = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    drift.setValue(0);
    const loop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 9_000,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [drift, visible]);

  useEffect(() => {
    if (!visible) {
      setIndex(0);
      return;
    }
    if (slides.length === 0) return;

    fade.setValue(0);
    zoom.setValue(1);

    const holdDuration = Math.max(
      0,
      SLIDE_DURATION_MS - FADE_DURATION_MS * 2,
    );
    const sequence = Animated.sequence([
      Animated.timing(fade, {
        toValue: 1,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.delay(holdDuration),
      Animated.timing(fade, {
        toValue: 0,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }),
    ]);

    const kenBurns = Animated.timing(zoom, {
      toValue: 1.08,
      duration: SLIDE_DURATION_MS,
      useNativeDriver: true,
    });

    kenBurns.start();
    sequence.start(({ finished }) => {
      if (finished) setIndex((current) => (current + 1) % slides.length);
    });

    return () => {
      sequence.stop();
      kenBurns.stop();
    };
  }, [fade, index, slides, visible, zoom]);

  const gradientShift = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -SCREEN_HEIGHT],
  });

  const slide = slides[index];

  return (
    <View style={styles.host} {...panHandlers}>
      {children}

      <Modal
        visible={visible}
        transparent={false}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismiss}
      >
        <Pressable style={styles.overlay} onPress={dismiss} accessibilityRole="button">
          <Animated.View
            pointerEvents="none"
            style={[styles.gradientHost, { transform: [{ translateY: gradientShift }] }]}
          >
            <LinearGradient colors={[...RAINBOW]} style={styles.gradient} />
          </Animated.View>

          <View pointerEvents="none" style={styles.scrim} />

          <View pointerEvents="none" style={styles.content}>
            {slide ? (
              <Animated.View style={[styles.card, { opacity: fade }]}>
                <View style={styles.imageFrame}>
                  <Animated.View style={{ transform: [{ scale: zoom }] }}>
                    <Image
                      source={{ uri: slide.image }}
                      style={styles.image}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                    />
                  </Animated.View>
                </View>
                <Text style={styles.name} numberOfLines={2}>
                  {slide.name}
                </Text>
                {slide.price ? <Text style={styles.price}>{slide.price}</Text> : null}
              </Animated.View>
            ) : (
              <Text style={styles.brand}>A2Express</Text>
            )}

            <Text style={styles.hint}>
              {t("app.screensaver.hint", {
                defaultValue: "Touchez l'écran pour continuer",
              })}
            </Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 340);

const styles = StyleSheet.create({
  host: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "#08080C", overflow: "hidden" },
  gradientHost: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: SCREEN_HEIGHT * 2,
  },
  gradient: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: { width: CARD_WIDTH, alignItems: "center" },
  imageFrame: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
  },
  image: { width: CARD_WIDTH, height: CARD_WIDTH },
  name: {
    marginTop: 22,
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  price: {
    marginTop: 8,
    color: "#FFD700",
    fontSize: 18,
    fontWeight: "900",
  },
  brand: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  hint: {
    position: "absolute",
    bottom: 48,
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "600",
  },
});
