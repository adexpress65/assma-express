/**
 * Aligné avec src/utils/resolveOwnerAwareRole.ts
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";

function resolveOwnerAwareRole(storedRole, ownsCompanyDoc) {
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

test("propriétaire de société n’est jamais visitor", () => {
  assert.equal(resolveOwnerAwareRole("visitor", true), "seller");
  assert.equal(resolveOwnerAwareRole(null, true), "seller");
  assert.equal(resolveOwnerAwareRole("", true), "seller");
  assert.equal(resolveOwnerAwareRole("customer", true), "seller");
});

test("sans société, visitor et customer restent inchangés", () => {
  assert.equal(resolveOwnerAwareRole("visitor", false), "visitor");
  assert.equal(resolveOwnerAwareRole("customer", false), "customer");
  assert.equal(resolveOwnerAwareRole(null, false), "visitor");
});

test("seller admin et super-admin ne changent pas", () => {
  assert.equal(resolveOwnerAwareRole("seller", true), "seller");
  assert.equal(resolveOwnerAwareRole("admin", true), "admin");
  assert.equal(resolveOwnerAwareRole("super-admin", true), "super-admin");
  assert.equal(resolveOwnerAwareRole("seller", false), "seller");
});

test("un client lié à une boutique tierce (companyId) sans companies/{uid} reste customer", () => {
  // ownsCompanyDoc = false même si users.companyId pointe ailleurs (cas Tidio / USINE)
  assert.equal(resolveOwnerAwareRole("customer", false), "customer");
});
