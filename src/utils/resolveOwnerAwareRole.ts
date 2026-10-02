import type { UserRole } from "@/types/auth";

/**
 * Rôle affiché / utilisé dans l’app.
 * Un compte qui possède companies/{uid} n’est jamais « visitor ».
 * Ne change pas admin / super-admin / seller déjà corrects.
 * Ne touche pas les comptes sans société.
 */
export function resolveOwnerAwareRole(
  storedRole: unknown,
  ownsCompanyDoc: boolean,
): UserRole {
  const raw = String(storedRole ?? "")
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
  if (raw === "admin") return "admin";
  if (raw === "seller") return "seller";
  if (raw === "customer" || raw === "client" || raw === "user") {
    return ownsCompanyDoc ? "seller" : "customer";
  }
  if (ownsCompanyDoc) return "seller";
  if (raw === "visitor") return "visitor";
  return "visitor";
}
