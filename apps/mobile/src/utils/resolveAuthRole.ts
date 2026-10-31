import type { User } from "firebase/auth";

export type AuthClaimRole = "super-admin" | "admin" | "seller" | "customer";

function normalizeRoleValue(role: unknown): AuthClaimRole | null {
  const raw = String(role ?? "")
    .trim()
    .toLowerCase();
  if (
    raw === "super-admin" ||
    raw === "super_admin" ||
    raw === "superadmin" ||
    raw === "super admin"
  ) {
    return "super-admin";
  }
  if (raw === "admin" || raw === "seller" || raw === "customer") {
    return raw;
  }
  if (raw === "client" || raw === "user") {
    return "customer";
  }
  return null;
}

/**
 * Source de vérité : custom claim `role`.
 * Fallback Firestore uniquement si le claim est absent (transition).
 * Force un refresh de token pour voir un claim posé récemment.
 */
export async function resolveAuthorizedRole(
  firebaseUser: User,
  firestoreRole: unknown,
): Promise<AuthClaimRole> {
  try {
    await firebaseUser.getIdToken(true);
    const token = await firebaseUser.getIdTokenResult();
    const fromClaim = normalizeRoleValue(token.claims.role);
    if (fromClaim) {
      return fromClaim;
    }
    console.warn("[auth-role] custom claim absent, fallback Firestore", {
      uid: firebaseUser.uid,
      firestoreRole,
    });
  } catch (err) {
    console.warn("[auth-role] lecture claim échouée, fallback Firestore", err);
  }
  return normalizeRoleValue(firestoreRole) || "customer";
}
