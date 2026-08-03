import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  ActivityIndicator,
  BackHandler,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/config/firebase";
import {
  isCheckoutPaymentConfirmed,
  isOrderPaymentRejected,
} from "@/features/super-admin/orders/orderPayment";

// ⚙️ INTERRUPTEUR (FEATURE FLAG)
// ✅ Réactivé à true pour afficher la confirmation et gérer les erreurs de paiement
const ENABLE_CONFIRMATION_SCREEN = true;

/** Au-delà de ce délai sans preuve de paiement dans Firestore, on refuse le succès. */
const VERIFICATION_TIMEOUT_MS = 12000;

type VerificationState = "checking" | "confirmed" | "unconfirmed";

const C = {
  primary: "#FF6A00",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  bg: "#F8FAFC",
  cardBg: "#FFFFFF",
  text: "#1E293B",
  subText: "#64748B",
  border: "#E2E8F0",
};

export default function ConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string; orderId?: string }>();

  const status = params.status ?? "failed";
  const orderId = params.orderId;

  // Le paramètre de navigation n'est qu'une intention : seul Firestore fait foi.
  const claimsSuccess = status === "success";

  const [verification, setVerification] = useState<VerificationState>(
    claimsSuccess ? "checking" : "unconfirmed"
  );

  const isSuccess = claimsSuccess && verification === "confirmed";
  const isVerifying = claimsSuccess && verification === "checking";

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const verificationRef = useRef<VerificationState>(verification);
  const hapticsPlayedRef = useRef(false);

  const setVerificationState = useCallback((next: VerificationState) => {
    if (verificationRef.current === next) return;
    verificationRef.current = next;
    setVerification(next);
  }, []);

  const handleMainAction = useCallback(() => {
    if (isSuccess) {
      router.replace("/orders");
      return;
    }
    router.replace("/cart");
  }, [isSuccess, router]);

  // Vérification du paiement auprès de Firestore avant toute annonce de succès.
  useEffect(() => {
    if (!claimsSuccess) return;

    if (!orderId) {
      console.log(
        "[Confirmation] Succès annoncé sans orderId : impossible à vérifier"
      );
      setVerificationState("unconfirmed");
      return;
    }

    const timeout = setTimeout(() => {
      if (verificationRef.current === "checking") {
        console.log("[Confirmation] Délai de vérification dépassé", { orderId });
        setVerificationState("unconfirmed");
      }
    }, VERIFICATION_TIMEOUT_MS);

    const unsub = onSnapshot(
      doc(db, "orders", orderId),
      (snap) => {
        if (!snap.exists()) {
          console.log("[Confirmation] Commande introuvable", { orderId });
          setVerificationState("unconfirmed");
          return;
        }

        const data = snap.data() as Record<string, unknown>;

        console.log("[Confirmation] Statut Firestore", {
          orderId,
          status: data?.status,
          paymentStatus: data?.paymentStatus,
        });

        if (isCheckoutPaymentConfirmed(data)) {
          setVerificationState("confirmed");
        } else if (isOrderPaymentRejected(data)) {
          setVerificationState("unconfirmed");
        }
      },
      (error) => {
        console.log("[Confirmation] Erreur d'écoute Firestore", {
          orderId,
          error: error.message,
        });
        setVerificationState("unconfirmed");
      }
    );

    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, [claimsSuccess, orderId, setVerificationState]);

  useEffect(() => {
    // 🛡️ Redirection de secours si l'écran devait être masqué
    if (!ENABLE_CONFIRMATION_SCREEN) {
      if (claimsSuccess && orderId) {
        router.replace({
          pathname: "/checkout/pending" as never,
          params: { orderId },
        });
      } else {
        router.replace("/cart");
      }
      return;
    }

    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleMainAction();
      return true;
    });

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    return () => backSub.remove();
  }, [claimsSuccess, fadeAnim, handleMainAction, orderId, router, scaleAnim]);

  // Le retour haptique attend l'issue réelle pour ne pas célébrer un échec.
  useEffect(() => {
    if (isVerifying || hapticsPlayedRef.current) return;
    hapticsPlayedRef.current = true;

    try {
      Haptics.notificationAsync(
        isSuccess
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error
      );
    } catch {
      // Ignoré si non supporté sur l'appareil
    }
  }, [isSuccess, isVerifying]);

  if (!ENABLE_CONFIRMATION_SCREEN) {
    return null;
  }

  if (isVerifying) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={[styles.title, styles.verifyingTitle]}>
            Vérification du paiement
          </Text>
          <Text style={styles.message}>
            Nous confirmons votre transaction auprès de la banque avant de valider
            la commande.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Configuration du contenu dynamique (Succès, Annulation, Rejet, Non confirmé)
  const getConfig = () => {
    if (isSuccess) {
      return {
        title: "Paiement Réussi",
        message:
          "Votre commande a été validée avec succès. Merci pour votre confiance !",
        icon: "checkmark-circle" as const,
        color: C.success,
        bgColor: "#ECFDF5",
        btnText: "Voir mes commandes",
        btnIcon: "receipt-outline" as const,
      };
    }

    // Succès annoncé par la passerelle mais jamais confirmé côté backend.
    if (claimsSuccess) {
      return {
        title: "Paiement Non Confirmé",
        message:
          "Nous n'avons pas reçu de confirmation de paiement pour cette commande. Elle n'a pas été validée et aucun montant ne sera débité sans confirmation.",
        icon: "help-circle" as const,
        color: C.warning,
        bgColor: "#FFFBEB",
        btnText: "Retourner au panier",
        btnIcon: "cart-outline" as const,
      };
    }

    if (status === "cancel") {
      return {
        title: "Paiement Annulé",
        message:
          "Vous avez interrompu le paiement. Aucun montant n'a été débité de votre carte.",
        icon: "close-circle" as const,
        color: C.primary,
        bgColor: "#FFF0E6",
        btnText: "Retourner au panier",
        btnIcon: "cart-outline" as const,
      };
    }

    return {
      title: "Paiement Non Validé",
      message:
        "La transaction a échoué ou a été refusée par la banque. Votre carte n'a pas été débitée.",
      icon: "alert-circle" as const,
      color: C.error,
      bgColor: "#FEF2F2",
      btnText: "Réessayer le paiement",
      btnIcon: "refresh-outline" as const,
    };
  };

  const config = getConfig();

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        
        {/* Badge d'icône animé */}
        <Animated.View
          style={[
            styles.iconBadge,
            {
              backgroundColor: config.bgColor,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Ionicons name={config.icon} size={68} color={config.color} />
        </Animated.View>

        {/* Titre & Message principal */}
        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.message}>{config.message}</Text>

        {/* Carte de référence de commande */}
        {orderId && (
          <View style={styles.orderCard}>
            <Text style={styles.orderLabel}>RÉFÉRENCE COMMANDE</Text>
            <Text style={styles.orderValue}>#{orderId}</Text>
          </View>
        )}

        {/* Groupe de boutons */}
        <View style={styles.actionGroup}>
          <TouchableOpacity
            style={[styles.primaryBtn, !isSuccess && { backgroundColor: C.primary }]}
            activeOpacity={0.8}
            onPress={handleMainAction}
          >
            <Ionicons name={config.btnIcon} size={20} color="#FFF" />
            <Text style={styles.primaryBtnText}>{config.btnText}</Text>
          </TouchableOpacity>

          {!isSuccess && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              activeOpacity={0.7}
              onPress={() => router.replace("/")}
            >
              <Text style={styles.secondaryBtnText}>Retour à l'accueil</Text>
            </TouchableOpacity>
          )}
        </View>

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: C.text,
    textAlign: "center",
    marginBottom: 8,
  },
  verifyingTitle: {
    marginTop: 24,
  },
  message: {
    fontSize: 14,
    color: C.subText,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: 24,
  },
  orderCard: {
    width: "100%",
    backgroundColor: C.cardBg,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 28,
  },
  orderLabel: {
    fontSize: 11,
    color: C.subText,
    letterSpacing: 1,
    fontWeight: "600",
    marginBottom: 4,
  },
  orderValue: {
    fontSize: 16,
    fontWeight: "700",
    color: C.primary,
  },
  actionGroup: {
    width: "100%",
    gap: 12,
  },
  primaryBtn: {
    flexDirection: "row",
    backgroundColor: C.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    elevation: 2,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: C.subText,
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
