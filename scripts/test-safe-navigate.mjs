/**
 * Garde-fou des parcours critiques (ajout produit).
 * Doit rester aligné avec src/utils/safeNavigate.ts
 * (`resolveProductCreateSuccessNav`).
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";

function resolveProductCreateSuccessNav(action, productId, fallbackHref) {
  if (action === "continue") {
    return { kind: "stay" };
  }
  const id = String(productId || "").trim();
  return { kind: "replace", href: id ? `/product/${id}` : fallbackHref };
}

test("Continuer reste sur l’écran d’ajout (aucun back/replace)", () => {
  assert.deepEqual(
    resolveProductCreateSuccessNav("continue", "abc123", "/seller/dashboard"),
    { kind: "stay" },
  );
});

test("Voir le produit ouvre la fiche, pas un retour pile", () => {
  assert.deepEqual(
    resolveProductCreateSuccessNav("view", "abc123", "/seller/dashboard"),
    { kind: "replace", href: "/product/abc123" },
  );
});

test("sans id produit, on remplace vers le dashboard (jamais back)", () => {
  assert.deepEqual(
    resolveProductCreateSuccessNav("view", "  ", "/seller/dashboard"),
    { kind: "replace", href: "/seller/dashboard" },
  );
});

test("admin : même contrat, fallback dashboard admin", () => {
  assert.deepEqual(
    resolveProductCreateSuccessNav("view", "p1", "/super-admin/dashboard"),
    { kind: "replace", href: "/product/p1" },
  );
});
