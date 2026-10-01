import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/config/firebase";
import { Ionicons } from "@expo/vector-icons";
import {
  isCheckoutPaymentConfirmed,
  isOrderPaymentRejected,
} from "@/features/super-admin/orders/orderPayment";
import { PAYMENT_ENDPOINTS } from "@/config/api";
import { clearInFlightPayment } from "@/services/ngeniusVerify";

type PaymentPhase = "pending" | "paid" | "failed" | "unconfirmed";

/** Le webhook NGenius peut arriver avec un léger décalage : on réinterroge par paliers. */
const VERIFY_DELAYS_MS = [0, 3000, 8000, 15000, 25000, 40000];
const GIVE_UP_DELAY_MS = 55000;

function normalizeOrderIdParam(
  raw: string | string[] | undefined
): string | undefined {
  if (raw == null) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

export default function PendingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string | string[] }>();
  const orderId = normalizeOrderIdParam(params.orderId);

  const [phase, setPhase] = useState<PaymentPhase>("pending");
  const [isRechecking, setIsRechecking] = useState(false);
  const [networkUnstable, setNetworkUnstable] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const phaseRef = useRef<PaymentPhase>("pending");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const applyPhase = useCallback(
    (next: PaymentPhase) => {
      if (!isMountedRef.current) return;
      // Un paiement confirmé ne peut plus être dégradé par une réponse tardive.
      if (phaseRef.current === "paid") return;
      phaseRef.current = next;
      setPhase(next);
    },
    []
  );

  const confirmPaid = useCallback(() => {
    if (phaseRef.current === "paid") return;
    phaseRef.current = "paid";
    if (isMountedRef.current) setPhase("paid");
    if (orderId) void clearInFlightPayment(orderId);

    console.log("[Pending] Paiement confirmé, redirection vers la confirmation", {
      orderId,
    });

    redirectTimerRef.current = setTimeout(() => {
      router.replace({
        pathname: "/checkout/confirmation" as never,
        params: { status: "success", orderId },
      });
    }, 1500);
  }, [orderId, router]);

  const stopScheduledVerifications = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const verifyWithBackend = useCallback(async () => {
    if (!orderId || phaseRef.current === "paid") return;

    try {
      const response = await fetch(PAYMENT_ENDPOINTS.ngeniusVerify, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      if (isMountedRef.current) setNetworkUnstable(false);

      // Le corps est exploité même sur un code HTTP d'erreur : il porte le
      // verdict de vérification (415 NGenius, référence absente, ...).
      const result = await response.json().catch(() => null);

      console.log("[Pending] Réponse de vérification NGenius", {
        orderId,
        httpStatus: response.status,
        result,
      });

      if (!result) return;

      if (result.isPaid === true) {
        confirmPaid();
        return;
      }

      // Refus avéré par la passerelle.
      if (result.isFailed === true) {
        stopScheduledVerifications();
        if (orderId) void clearInFlightPayment(orderId);
        applyPhase("failed");
        return;
      }

      // Vérification impossible : on cesse d'attendre au lieu de laisser
      // l'utilisateur devant un écran de chargement jusqu'au dernier palier.
      const reportedStatus = String(result.status ?? "").toUpperCase();
      if (
        result.verified === false ||
        result.success === false ||
        reportedStatus === "FAILED" ||
        reportedStatus === "CANCELLED"
      ) {
        console.log("[Pending] Vérification non concluante, arrêt de l'attente", {
          orderId,
          reportedStatus,
          httpStatus: response.status,
          error: result.error,
        });
        stopScheduledVerifications();
        applyPhase("unconfirmed");
      }
    } catch (err) {
      console.log("[Pending] Vérification backend indisponible", {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
      if (isMountedRef.current) setNetworkUnstable(true);
    }
  }, [applyPhase, confirmPaid, orderId, stopScheduledVerifications]);

  const handleManualRecheck = useCallback(async () => {
    setIsRechecking(true);
    applyPhase("pending");
    await verifyWithBackend();
    if (isMountedRef.current) {
      setIsRechecking(false);
      if (phaseRef.current === "pending") applyPhase("unconfirmed");
    }
  }, [applyPhase, verifyWithBackend]);

  useEffect(() => {
    isMountedRef.current = true;

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    if (!orderId) {
      router.replace("/cart");
      return;
    }

    for (const delay of VERIFY_DELAYS_MS) {
      timersRef.current.push(setTimeout(() => void verifyWithBackend(), delay));
    }

    // Sans confirmation de paiement, on n'affiche jamais un succès implicite.
    timersRef.current.push(
      setTimeout(() => {
        if (phaseRef.current === "pending") applyPhase("unconfirmed");
      }, GIVE_UP_DELAY_MS)
    );

    const unsub = onSnapshot(
      doc(db, "orders", orderId),
      (docSnap) => {
        if (!docSnap.exists()) {
          console.log("[Pending] Commande introuvable dans Firestore", { orderId });
          applyPhase("failed");
          return;
        }

        const data = docSnap.data() as Record<string, unknown>;

        console.log("[Pending] Statut Firestore", {
          orderId,
          status: data?.status,
          paymentStatus: data?.paymentStatus,
          ngeniusPaymentState: data?.ngeniusPaymentState,
        });

        if (isCheckoutPaymentConfirmed(data)) {
          confirmPaid();
        } else if (isOrderPaymentRejected(data)) {
          if (orderId) void clearInFlightPayment(orderId);
          applyPhase("failed");
        }
      },
      (error) => {
        console.log("[Pending] Erreur d'écoute Firestore", {
          orderId,
          error: error.message,
        });
      }
    );

    return () => {
      isMountedRef.current = false;
      unsub();
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [applyPhase, confirmPaid, fadeAnim, orderId, router, verifyWithBackend]);

  const renderFailure = (title: string, message: string) => (
    <>
      <View style={styles.iconBadgeFailed}>
        <Ionicons name="close-sharp" size={48} color="#EF4444" />
      </View>
      <Text style={[styles.title, { color: "#EF4444" }]}>{title}</Text>
      <Text style={styles.subtitle}>{message}</Text>

      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.8}
          onPress={() => router.replace("/cart")}
        >
          <Text style={styles.primaryButtonText}>Revoir mon panier</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          activeOpacity={0.7}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.secondaryButtonText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        {phase === "pending" ? (
          <>
            <View style={styles.iconBadgePending}>
              <ActivityIndicator size="large" color="#FF6A00" />
            </View>

            <Text style={styles.title}>Vérification du paiement</Text>
            <Text style={styles.subtitle}>
              Nous synchronisons le statut de votre transaction auprès de la banque.
            </Text>
            {networkUnstable ? (
              <Text style={styles.networkHint}>
                Connexion instable, vérification en cours...
              </Text>
            ) : null}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color="#4A5568" />
              <Text style={styles.infoBoxText}>
                Veuillez patienter quelques instants sans fermer l'application.
              </Text>
            </View>
          </>
        ) : phase === "paid" ? (
          <>
            <View style={styles.iconBadgeSuccess}>
              <Ionicons name="checkmark-sharp" size={48} color="#10B981" />
            </View>
            <Text style={[styles.title, { color: "#10B981" }]}>
              Paiement Confirmé !
            </Text>
            <Text style={styles.subtitle}>
              Votre commande #{orderId?.slice(0, 8)} a bien été enregistrée.
              Redirection en cours...
            </Text>
          </>
        ) : phase === "unconfirmed" ? (
          <>
            <View style={styles.iconBadgeWarning}>
              <Ionicons name="help-outline" size={48} color="#F59E0B" />
            </View>
            <Text style={[styles.title, { color: "#F59E0B" }]}>
              Paiement non confirmé
            </Text>
            <Text style={styles.subtitle}>
              Nous n'avons pas reçu de confirmation de votre banque. Votre commande
              n'est pas validée pour le moment.
            </Text>

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.primaryButton, isRechecking && styles.buttonDisabled]}
                activeOpacity={0.8}
                disabled={isRechecking}
                onPress={handleManualRecheck}
              >
                <Text style={styles.primaryButtonText}>
                  {isRechecking ? "Vérification..." : "Vérifier à nouveau"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.7}
                onPress={() => router.replace("/cart")}
              >
                <Text style={styles.secondaryButtonText}>Revoir mon panier</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          renderFailure(
            "Paiement non finalisé",
            "La transaction a été refusée ou interrompue. Aucun débit n'a été effectué."
          )
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  iconBadgePending: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFF5EB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  iconBadgeSuccess: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  iconBadgeFailed: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  iconBadgeWarning: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FFFBEB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  networkHint: {
    fontSize: 13,
    color: "#C05621",
    textAlign: "center",
    lineHeight: 18,
    marginTop: -12,
    marginBottom: 16,
    fontWeight: "600",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 8,
  },
  infoBoxText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
    flex: 1,
  },
  buttonGroup: {
    width: "100%",
    marginTop: 10,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#FF6A00",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    width: "100%",
    backgroundColor: "#F1F5F9",
  },
  secondaryButtonText: {
    color: "#475569",
    fontWeight: "600",
    fontSize: 14,
  },
});
