import * as admin from "firebase-admin";

export type StaffRole = "super-admin" | "admin";

function normalizeStaffRole(raw: unknown): StaffRole | null {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (
    value === "super-admin" ||
    value === "super_admin" ||
    value === "superadmin" ||
    value === "super admin"
  ) {
    return "super-admin";
  }
  if (value === "admin") {
    return "admin";
  }
  return null;
}

/**
 * Rôle staff de l'appelant : custom claim en priorité, miroir Firestore en secours
 * (comptes admin / super-admin pas encore migrés côté claims).
 */
export async function resolveCallerStaffRole(
  authUid: string,
  tokenRole: unknown,
): Promise<StaffRole | null> {
  const fromClaim = normalizeStaffRole(tokenRole);
  if (fromClaim) {
    return fromClaim;
  }

  const callerDoc = await admin
    .firestore()
    .collection("users")
    .doc(authUid)
    .get();

  if (!callerDoc.exists) {
    return null;
  }

  return normalizeStaffRole(callerDoc.data()?.role);
}
