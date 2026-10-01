/**
 * Doit rester aligné avec src/services/conversationRouting.ts
 * (pickStoreOwnerUid, buildKindParticipants, companyOwnerCandidates).
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";

const SUPPORT_INBOX_UID = "biU1QvlrGtZeqTLdbLONLGbyVQ92";

function nonEmptyId(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function companyOwnerCandidates(data) {
  if (!data) return [];
  const out = [];
  const seen = new Set();
  for (const key of ["ownerUid", "ownerId", "sellerUid", "uid"]) {
    const id = nonEmptyId(data[key]);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function pickStoreOwnerUid(input) {
  const blocked = new Set();
  const support = nonEmptyId(input.supportInboxUid ?? SUPPORT_INBOX_UID);
  if (support) blocked.add(support);

  const ordered = [];
  const productSeller = nonEmptyId(input.productSellerUid);
  if (productSeller) ordered.push(productSeller);
  for (const id of input.companyCandidates) {
    const clean = nonEmptyId(id);
    if (clean) ordered.push(clean);
  }

  const unique = [];
  const seen = new Set();
  for (const id of ordered) {
    if (blocked.has(id) || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  if (unique.length === 0) {
    const err = new Error("STORE_OWNER_UNRESOLVED");
    err.code = "STORE_OWNER_UNRESOLVED";
    throw err;
  }
  return unique[0];
}

function buildKindParticipants(kind, input) {
  const clientUid = nonEmptyId(input.clientUid);
  if (!clientUid) throw new Error("MISSING_CLIENT");
  if (kind === "customer_to_support") {
    return [clientUid, SUPPORT_INBOX_UID];
  }
  const sellerUid = nonEmptyId(input.sellerUid);
  if (!sellerUid) throw new Error("MISSING_SELLER");
  if (sellerUid === SUPPORT_INBOX_UID) throw new Error("STAFF_AS_STORE_OWNER");
  return [clientUid, sellerUid];
}

test("client → boutique : sellerId produit, PAS le super-admin", () => {
  const seller = pickStoreOwnerUid({
    productSellerUid: "seller_real",
    companyCandidates: [SUPPORT_INBOX_UID, "seller_real"],
  });
  assert.equal(seller, "seller_real");
  const parts = buildKindParticipants("customer_to_store", {
    clientUid: "client_1",
    sellerUid: seller,
  });
  assert.deepEqual(parts, ["client_1", "seller_real"]);
  assert.equal(parts.includes(SUPPORT_INBOX_UID), false);
});

test("client → support : uniquement le super-admin", () => {
  const parts = buildKindParticipants("customer_to_support", {
    clientUid: "client_1",
  });
  assert.deepEqual(parts, ["client_1", SUPPORT_INBOX_UID]);
});

test("storeId / owner manquant = erreur, pas de fallback admin", () => {
  assert.throws(
    () =>
      pickStoreOwnerUid({
        productSellerUid: SUPPORT_INBOX_UID,
        companyCandidates: [SUPPORT_INBOX_UID],
      }),
    (err) => err.code === "STORE_OWNER_UNRESOLVED",
  );
  assert.throws(
    () =>
      buildKindParticipants("customer_to_store", {
        clientUid: "client_1",
        sellerUid: SUPPORT_INBOX_UID,
      }),
    (err) => err.message === "STAFF_AS_STORE_OWNER",
  );
});

test("ownerUid de société est préféré à uid si pas de sellerId produit", () => {
  const candidates = companyOwnerCandidates({
    uid: SUPPORT_INBOX_UID,
    ownerUid: "seller_real",
  });
  assert.deepEqual(candidates[0], "seller_real");
  assert.equal(
    pickStoreOwnerUid({ companyCandidates: candidates }),
    "seller_real",
  );
});

test("un utilisateur hors participants n’est pas dans le fil boutique", () => {
  const parts = buildKindParticipants("customer_to_store", {
    clientUid: "client_1",
    sellerUid: "seller_real",
  });
  assert.equal(parts.includes("super_admin_spy"), false);
  assert.equal(parts.includes("random_company_doc_id"), false);
});
