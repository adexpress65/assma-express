import type { User } from "firebase/auth";

export type UserRole =
  | "super-admin"
  | "admin"
  | "seller"
  | "customer"
  | "visitor";

export function normalizeRole(role: unknown): UserRole {
  const raw = String(role ?? "")
    .trim()
    .toLowerCase();
  if (
    ["super-admin", "super_admin", "superadmin", "super admin"].includes(raw)
  ) {
    return "super-admin";
  }
  if (raw === "admin") return "admin";
  if (raw === "seller") return "seller";
  if (raw === "customer") return "customer";
  return "visitor";
}

export function canAccessAdmin(role: UserRole): boolean {
  return role === "super-admin" || role === "admin";
}

export function canAccessSuperAdmin(role: UserRole): boolean {
  return role === "super-admin";
}

export function canAccessOperationalStaff(role: UserRole): boolean {
  return canAccessAdmin(role);
}

/** Claim d'abord ; Firestore seulement si le claim est absent (comptes non migrés). */
export async function resolveAuthorizedRole(
  user: User,
  firestoreRole: unknown,
): Promise<UserRole> {
  try {
    await user.getIdToken(true);
    const token = await user.getIdTokenResult();
    const fromClaim = normalizeRole(token.claims.role);
    if (fromClaim !== "visitor") {
      return fromClaim;
    }
    console.warn("[auth-role] custom claim absent, fallback Firestore", {
      uid: user.uid,
      firestoreRole,
    });
  } catch (err) {
    console.warn("[auth-role] lecture claim échouée, fallback Firestore", err);
  }
  const fromFs = normalizeRole(firestoreRole);
  return fromFs === "visitor" ? "customer" : fromFs;
}
