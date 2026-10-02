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

function companyOwnerCandidates(data, options) {
  const out = [];
  const seen = new Set();
  const push = (value) => {
    const id = nonEmptyId(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  if (data) {
    for (const key of ["ownerUid", "ownerId", "sellerUid"]) push(data[key]);
  }
  const hasExplicitOwner = out.length > 0;
  if (!hasExplicitOwner && options?.companyIdIsAccount) push(options.companyId);
  if (data) push(data.uid);
  return out;
}

function pickStoreOwnerUid(input) {
  const blocked = new Set();
  const support = nonEmptyId(input.supportInboxUid ?? SUPPORT_INBOX_UID);
  const shopAccount = nonEmptyId(input.shopAccountUid);
  if (support && support !== shopAccount) blocked.add(support);

  const candidates = [];
  const seen = new Set();
  for (const id of input.companyCandidates) {
    const clean = nonEmptyId(id);
    if (!clean || blocked.has(clean) || seen.has(clean)) continue;
    seen.add(clean);
    candidates.push(clean);
  }

  const productSeller = nonEmptyId(input.productSellerUid);
  if (shopAccount && candidates[0] === shopAccount) return shopAccount;
  if (productSeller && seen.has(productSeller)) return productSeller;

  if (candidates.length === 0) {
    const err = new Error("STORE_OWNER_UNRESOLVED");
    err.code = "STORE_OWNER_UNRESOLVED";
    throw err;
  }
  return candidates[0];
}

function staffInboxVisible(conv, staffUid) {
  if (conv.type === "support" || conv.conversationKind === "customer_to_support") {
    return true;
  }
  const uid = nonEmptyId(staffUid);
  if (!uid) return false;
  const participants = Array.isArray(conv.participants) ? conv.participants : [];
  return participants.includes(uid) || conv.sellerUid === uid || conv.clientUid === uid;
}

function buildKindParticipants(kind, input) {
  const clientUid = nonEmptyId(input.clientUid);
  if (!clientUid) throw new Error("MISSING_CLIENT");
  if (kind === "customer_to_support") {
    return [clientUid, SUPPORT_INBOX_UID];
  }
  const sellerUid = nonEmptyId(input.sellerUid);
  if (!sellerUid) throw new Error("MISSING_SELLER");
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
});

test("la boutique du super-admin arrive chez son compte, pas chez un uid écrasé", () => {
  const superAdmin = "super_admin_shop";
  const strayCustomer = "client_lie_a_la_boutique";
  const candidates = companyOwnerCandidates(
    { uid: strayCustomer },
    { companyId: superAdmin, companyIdIsAccount: true },
  );
  const seller = pickStoreOwnerUid({
    companyCandidates: candidates,
    shopAccountUid: superAdmin,
    productSellerUid: strayCustomer,
  });
  assert.equal(seller, superAdmin);
  const parts = buildKindParticipants("customer_to_store", {
    clientUid: "client_1",
    sellerUid: seller,
  });
  assert.deepEqual(parts, ["client_1", superAdmin]);
  assert.equal(parts.includes(strayCustomer), false);
  assert.equal(parts.includes(SUPPORT_INBOX_UID), false);
});

test("une autre boutique n’est pas envoyée au compte support", () => {
  const seller = pickStoreOwnerUid({
    productSellerUid: SUPPORT_INBOX_UID,
    companyCandidates: ["seller_real", SUPPORT_INBOX_UID],
    shopAccountUid: "seller_real",
  });
  assert.equal(seller, "seller_real");
  const parts = buildKindParticipants("customer_to_store", {
    clientUid: "client_1",
    sellerUid: seller,
  });
  assert.equal(parts.includes(SUPPORT_INBOX_UID), false);
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

test("un sellerId produit hors propriétaires société est ignoré", () => {
  const seller = pickStoreOwnerUid({
    productSellerUid: "intrus_ou_super_admin",
    companyCandidates: ["seller_real", SUPPORT_INBOX_UID],
  });
  assert.equal(seller, "seller_real");
});

test("la boîte du super-admin montre sa boutique et le support, pas une autre boutique", () => {
  const staff = "super_admin_shop";
  assert.equal(
    staffInboxVisible(
      {
        conversationKind: "customer_to_store",
        sellerUid: staff,
        clientUid: "client_1",
        participants: ["client_1", staff],
      },
      staff,
    ),
    true,
  );
  assert.equal(
    staffInboxVisible(
      {
        conversationKind: "customer_to_support",
        sellerUid: SUPPORT_INBOX_UID,
        clientUid: "client_1",
        participants: ["client_1", SUPPORT_INBOX_UID],
      },
      staff,
    ),
    true,
  );
  assert.equal(
    staffInboxVisible(
      {
        conversationKind: "customer_to_store",
        sellerUid: "seller_real",
        clientUid: "client_1",
        participants: ["client_1", "seller_real"],
      },
      staff,
    ),
    false,
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
