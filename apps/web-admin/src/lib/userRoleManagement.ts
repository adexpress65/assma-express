import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "./firebase";
import { normalizeRole, type UserRole } from "./roles";

/** Rôles assignables depuis l'écran back-office (super-admin volontairement exclu). */
export type AssignableUiRole = "admin" | "seller" | "customer";

export const ASSIGNABLE_UI_ROLES: AssignableUiRole[] = [
  "admin",
  "seller",
  "customer",
];

export const ASSIGNABLE_UI_ROLE_LABELS: Record<AssignableUiRole, string> = {
  admin: "Administrateur",
  seller: "Vendeur",
  customer: "Client",
};

export type UserLookupResult = {
  uid: string;
  email: string;
  displayName: string;
  /** Miroir Firestore `users/{uid}.role`. */
  firestoreRole: UserRole;
  /** Custom claim Auth `role` (null = absent ou illisible). */
  claimRole: UserRole | null;
  /** true si claim et Firestore divergent. */
  isDesynced: boolean;
};

export type AssignUserRoleResult = {
  ok: boolean;
  uid: string;
  role: AssignableUiRole;
  note?: string;
};

type RoleSnapshotResponse = {
  ok?: boolean;
  uid?: string;
  email?: string;
  claimRole?: string | null;
  firestoreRole?: string | null;
  isDesynced?: boolean;
};

const EMAIL_LOOKUP_LIMIT = 20;

/** Rafraîchit le token Auth avant un appel Cloud Function callable. */
export async function prepareCallableAuth(): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error(
      "Session inactive. Reconnectez-vous au back-office puis réessayez.",
    );
  }
  try {
    await user.getIdToken(true);
  } catch {
    throw new Error(
      "Impossible de rafraîchir la session. Reconnectez-vous au back-office puis réessayez.",
    );
  }
}

function normalizeEmailInput(raw: string): string {
  return raw.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function pickDisplayName(data: Record<string, unknown>): string {
  const name = String(data.displayName || data.name || "").trim();
  return name || "—";
}

function docCreatedAtMs(data: Record<string, unknown>): number {
  const createdAt = data.createdAt;
  if (
    createdAt &&
    typeof createdAt === "object" &&
    "toMillis" in createdAt &&
    typeof (createdAt as { toMillis: () => number }).toMillis === "function"
  ) {
    return (createdAt as { toMillis: () => number }).toMillis();
  }
  if (
    createdAt &&
    typeof createdAt === "object" &&
    "seconds" in createdAt
  ) {
    return Number((createdAt as { seconds: number }).seconds) * 1000;
  }
  return 0;
}

/** Exclut profils fusionnés ou explicitement inactifs. */
function isEligibleUserDoc(data: Record<string, unknown>): boolean {
  if (String(data.mergedIntoUid || "").trim()) return false;
  if (data.isActive === false) return false;
  return true;
}

function pickBestUserDoc(
  docs: Array<{ id: string; data: Record<string, unknown> }>,
): { id: string; data: Record<string, unknown> } | null {
  const eligible = docs.filter((d) => isEligibleUserDoc(d.data));
  if (eligible.length === 0) return null;

  eligible.sort(
    (a, b) => docCreatedAtMs(b.data) - docCreatedAtMs(a.data),
  );
  return eligible[0];
}

async function queryUsersByEmail(email: string) {
  const usersCol = collection(db, "users");
  const snap = await getDocs(
    query(usersCol, where("email", "==", email), limit(EMAIL_LOOKUP_LIMIT)),
  );
  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    data: docSnap.data() as Record<string, unknown>,
  }));
}

async function findFirestoreUserByEmail(
  rawEmail: string,
): Promise<{ uid: string; data: Record<string, unknown> } | null> {
  const normalized = normalizeEmailInput(rawEmail);
  const trimmedOriginal = rawEmail.trim();

  const emailsToTry = [
    normalized,
    ...(trimmedOriginal && trimmedOriginal !== normalized
      ? [trimmedOriginal]
      : []),
  ];

  const seenIds = new Set<string>();
  const allDocs: Array<{ id: string; data: Record<string, unknown> }> = [];

  for (const email of emailsToTry) {
    const docs = await queryUsersByEmail(email);
    for (const doc of docs) {
      if (!seenIds.has(doc.id)) {
        seenIds.add(doc.id);
        allDocs.push(doc);
      }
    }
  }

  const best = pickBestUserDoc(allDocs);
  if (!best) return null;
  return { uid: best.id, data: best.data };
}

export async function fetchUserRoleSnapshot(
  uid: string,
): Promise<Pick<UserLookupResult, "claimRole" | "firestoreRole" | "isDesynced">> {
  await prepareCallableAuth();
  const fn = httpsCallable(functions, "lookupUserRoleSnapshot");
  const res = await fn({ uid });
  const data = res.data as RoleSnapshotResponse | undefined;

  if (!data?.ok) {
    throw new Error("Impossible de lire le claim Auth pour cet utilisateur.");
  }

  const claimRaw = data.claimRole;
  const claimRole =
    claimRaw === null || claimRaw === undefined
      ? null
      : normalizeRole(claimRaw);

  const firestoreRole = normalizeRole(data.firestoreRole);

  return {
    claimRole: claimRole === "visitor" ? null : claimRole,
    firestoreRole: firestoreRole === "visitor" ? "customer" : firestoreRole,
    isDesynced: Boolean(data.isDesynced),
  };
}

function buildLookupResult(
  uid: string,
  data: Record<string, unknown>,
  snapshot: Pick<UserLookupResult, "claimRole" | "firestoreRole" | "isDesynced">,
): UserLookupResult {
  const firestoreRole = normalizeRole(data.role);
  return {
    uid,
    email: String(data.email || "").trim(),
    displayName: pickDisplayName(data),
    firestoreRole: firestoreRole === "visitor" ? "customer" : firestoreRole,
    claimRole: snapshot.claimRole,
    isDesynced:
      snapshot.isDesynced ||
      (snapshot.claimRole !== null &&
        snapshot.claimRole !==
          (firestoreRole === "visitor" ? "customer" : firestoreRole)),
  };
}

/**
 * Recherche un compte par email (Firestore filtré) puis lit le claim Auth via CF.
 */
export async function lookupUserByEmailInFirestore(
  rawEmail: string,
): Promise<UserLookupResult | null> {
  const normalized = normalizeEmailInput(rawEmail);
  if (!normalized) {
    throw new Error("Saisissez une adresse email.");
  }
  if (!isValidEmail(normalized)) {
    throw new Error("Adresse email invalide.");
  }

  const match = await findFirestoreUserByEmail(rawEmail);
  if (!match) return null;

  const snapshot = await fetchUserRoleSnapshot(match.uid);
  return buildLookupResult(match.uid, match.data, snapshot);
}

/** Rôle effectif côté Auth (claim prioritaire). */
export function getAuthoritativeRole(user: UserLookupResult): UserRole {
  return user.claimRole ?? user.firestoreRole;
}

export function mapCallableErrorToMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const code = "code" in err ? String((err as { code?: string }).code) : "";
    const message =
      "message" in err ? String((err as { message?: string }).message) : "";

    if (code === "functions/unauthenticated") {
      return "Session expirée ou token invalide. Reconnectez-vous au back-office, puis réessayez.";
    }
    if (code === "auth/user-token-expired" || code === "auth/requires-recent-login") {
      return "Session expirée. Reconnectez-vous au back-office, puis réessayez.";
    }
    if (code === "functions/permission-denied") {
      return message || "Action réservée aux super-administrateurs.";
    }
    if (code === "functions/not-found") {
      return "Utilisateur introuvable côté Firebase Auth.";
    }
    if (code === "functions/invalid-argument") {
      return message || "Paramètres invalides (uid ou rôle).";
    }
    if (message) {
      return message;
    }
  }
  return "Impossible d'attribuer le rôle. Réessayez.";
}

/**
 * Attribue un rôle via la Cloud Function setUserRole (custom claim + miroir Firestore côté serveur).
 */
export async function assignUserRole(
  uid: string,
  role: AssignableUiRole,
): Promise<AssignUserRoleResult> {
  await prepareCallableAuth();

  if (import.meta.env.DEV) {
    console.log("[setUserRole] appel httpsCallable", { uid, role });
  }

  const fn = httpsCallable(functions, "setUserRole");
  const res = await fn({ uid, role });
  const data = res.data as AssignUserRoleResult | undefined;

  if (!data?.ok) {
    throw new Error("La Cloud Function n'a pas confirmé l'attribution.");
  }

  if (import.meta.env.DEV) {
    console.log("[setUserRole] réponse CF confirmée", data);
  }

  return {
    ok: true,
    uid: data.uid || uid,
    role: (data.role as AssignableUiRole) || role,
    note: data.note,
  };
}

export function formatRoleLabel(role: UserRole | AssignableUiRole | null): string {
  if (!role) return "Absent";
  if (role === "super-admin") return "Super-administrateur";
  if (role === "admin") return "Administrateur";
  if (role === "seller") return "Vendeur";
  if (role === "customer") return "Client";
  return "Visiteur";
}

export function formatRoleSyncSummary(user: UserLookupResult): string {
  const fs = formatRoleLabel(user.firestoreRole);
  const claim = user.claimRole ? formatRoleLabel(user.claimRole) : "absent";
  if (user.isDesynced) {
    return `Firestore : ${fs} / Claim Auth : ${claim} — désynchronisé`;
  }
  return `Firestore : ${fs} / Claim Auth : ${claim}`;
}
