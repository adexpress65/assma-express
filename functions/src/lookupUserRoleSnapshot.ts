import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { resolveCallerStaffRole } from "./resolveCallerStaffRole";

type RoleValue = "super-admin" | "admin" | "seller" | "customer" | null;

function normalizeRole(raw: unknown): RoleValue {
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
  if (value === "admin" || value === "seller" || value === "customer") {
    return value;
  }
  return null;
}

/**
 * Lit le claim Auth `role` et le miroir Firestore pour un uid cible.
 * Réservé aux appelants admin / super-admin.
 */
export const lookupUserRoleSnapshot = onCall(
  {
    region: "europe-west1",
    cors: true,
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Connexion requise");
    }

    const callerStaffRole = await resolveCallerStaffRole(
      request.auth.uid,
      request.auth.token.role,
    );
    if (!callerStaffRole) {
      throw new HttpsError(
        "permission-denied",
        "Action réservée aux comptes admin / super-admin",
      );
    }

    const targetUid = String(request.data?.uid || "").trim();
    if (!targetUid) {
      throw new HttpsError("invalid-argument", "uid cible requis");
    }

    let authUser;
    try {
      authUser = await admin.auth().getUser(targetUid);
    } catch {
      throw new HttpsError("not-found", "Utilisateur Auth introuvable");
    }

    const claimRole = normalizeRole(authUser.customClaims?.role);
    const userDoc = await admin.firestore().collection("users").doc(targetUid).get();
    const firestoreRole = userDoc.exists
      ? normalizeRole(userDoc.data()?.role)
      : null;

    return {
      ok: true,
      uid: targetUid,
      email: authUser.email || "",
      claimRole,
      firestoreRole,
      isDesynced:
        claimRole !== null &&
        firestoreRole !== null &&
        claimRole !== firestoreRole,
    };
  },
);
