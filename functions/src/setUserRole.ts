import * as admin from "firebase-admin";
import { onInit } from "firebase-functions/v2/core";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { resolveCallerStaffRole } from "./resolveCallerStaffRole";

onInit(() => {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }
});

const ASSIGNABLE_ROLES = ["super-admin", "admin", "seller", "customer"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

function normalizeCallerRole(raw: unknown): AssignableRole | null {
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

function isAssignableRole(value: string): value is AssignableRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

/**
 * Seul moyen légitime de changer un rôle : custom claim via Admin SDK.
 * L’appelant est autorisé UNIQUEMENT via son token (`request.auth.token.role`),
 * jamais via une relecture Firestore.
 *
 * Prérequis : le script de migration doit déjà avoir posé les claims
 * admin / super-admin, sinon aucun appelant n’est autorisé.
 */
export const setUserRole = onCall(
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
    const requestedRole = String(request.data?.role || "")
      .trim()
      .toLowerCase();
    const role = normalizeCallerRole(requestedRole);

    if (!targetUid) {
      throw new HttpsError("invalid-argument", "uid cible requis");
    }
    if (!role || !isAssignableRole(role)) {
      throw new HttpsError(
        "invalid-argument",
        "role invalide (super-admin | admin | seller | customer)",
      );
    }
    if (role === "super-admin" && callerStaffRole !== "super-admin") {
      throw new HttpsError(
        "permission-denied",
        "Seul un super-admin peut attribuer le rôle super-admin",
      );
    }

    let target;
    try {
      target = await admin.auth().getUser(targetUid);
    } catch {
      throw new HttpsError("not-found", "Utilisateur Auth introuvable");
    }

    const nextClaims = { ...(target.customClaims || {}), role };
    await admin.auth().setCustomUserClaims(targetUid, nextClaims);

    await admin.firestore().collection("users").doc(targetUid).set(
      {
        role,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return {
      ok: true,
      uid: targetUid,
      role,
      note: "Le client cible doit appeler getIdToken(true) (ou se reconnecter) pour voir le nouveau claim.",
    };
  },
);
