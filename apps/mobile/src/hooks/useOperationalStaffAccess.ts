import { useEffect } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

type Options = {
  /** Si true, redirige automatiquement quand l'accès est refusé. */
  redirectOnDeny?: boolean;
  /** Message affiché dans l'alerte de refus. */
  deniedMessage?: string;
};

/**
 * Accès back-office opérationnel : admin ou super-admin.
 * Pattern réutilisable (orders/[id].tsx : isSuperAdmin || isAdmin).
 */
export function useOperationalStaffAccess(options: Options = {}) {
  const {
    redirectOnDeny = true,
    deniedMessage = "Accès réservé aux administrateurs.",
  } = options;

  const router = useRouter();
  const { user, isLoading, isSuperAdmin, isAdmin } = useAuth();
  const allowed = !!user && (isSuperAdmin || isAdmin);
  const checking = isLoading;

  useEffect(() => {
    if (checking || !redirectOnDeny) return;

    if (!user) {
      router.replace("/");
      return;
    }

    if (!allowed) {
      Alert.alert("Accès refusé", deniedMessage, [
        { text: "OK", onPress: () => router.replace("/") },
      ]);
    }
  }, [allowed, checking, deniedMessage, redirectOnDeny, router, user]);

  return {
    user,
    isLoading: checking,
    isSuperAdmin,
    isAdmin,
    isOperationalStaff: allowed,
    allowed,
  };
}
