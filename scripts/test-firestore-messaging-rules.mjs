import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const SUPPORT = "biU1QvlrGtZeqTLdbLONLGbyVQ92";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let testEnv;

function db(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

function storePayload(overrides = {}) {
  return {
    conversationKind: "customer_to_store",
    clientUid: "client_1",
    sellerUid: "seller_real",
    companyId: "shop1",
    participants: ["client_1", "seller_real"],
    ...overrides,
  };
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-a2express-messaging",
    firestore: {
      rules: readFileSync(join(root, "firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, "companies", "shop1"), {
      name: "Boutique",
      ownerUid: "seller_real",
      uid: SUPPORT,
    });
    await setDoc(doc(adminDb, "companies", "shop_admin_only"), {
      name: "Boutique admin",
      ownerUid: SUPPORT,
      uid: SUPPORT,
    });
  });
});

test("client crée un fil boutique vers le propriétaire", async () => {
  await assertSucceeds(
    setDoc(doc(db("client_1"), "conversations", "shop1_client_1"), storePayload()),
  );
});

test("client ne peut pas créer un fil boutique vers le super-admin", async () => {
  await assertFails(
    setDoc(
      doc(db("client_1"), "conversations", "bad_admin"),
      storePayload({
        sellerUid: SUPPORT,
        participants: ["client_1", SUPPORT],
      }),
    ),
  );
  await assertFails(
    setDoc(
      doc(db("client_1"), "conversations", "bad_admin_shop"),
      storePayload({
        sellerUid: SUPPORT,
        companyId: "shop_admin_only",
        participants: ["client_1", SUPPORT],
      }),
    ),
  );
});

test("conversationKind absent ou inconnu est refusé", async () => {
  const payload = storePayload();
  delete payload.conversationKind;
  await assertFails(
    setDoc(doc(db("client_1"), "conversations", "no_kind"), payload),
  );
  await assertFails(
    setDoc(
      doc(db("client_1"), "conversations", "bad_kind"),
      storePayload({ conversationKind: "direct" }),
    ),
  );
});

test("participants invalides ou auteur hors fil est refusé", async () => {
  await assertFails(
    setDoc(
      doc(db("client_1"), "conversations", "extra"),
      storePayload({
        participants: ["client_1", "seller_real", "company_doc"],
      }),
    ),
  );
  await assertFails(
    setDoc(doc(db("intruder"), "conversations", "spy"), storePayload()),
  );
});

test("un destinataire qui n’est pas le propriétaire est refusé", async () => {
  await assertFails(
    setDoc(
      doc(db("client_1"), "conversations", "wrong_owner"),
      storePayload({
        sellerUid: "other_seller",
        participants: ["client_1", "other_seller"],
      }),
    ),
  );
});

test("le support n’accepte que l’inbox super-admin", async () => {
  await assertSucceeds(
    setDoc(doc(db("client_1"), "conversations", "support_client_1"), {
      conversationKind: "customer_to_support",
      clientUid: "client_1",
      sellerUid: SUPPORT,
      participants: ["client_1", SUPPORT],
    }),
  );
  await assertFails(
    setDoc(doc(db("client_1"), "conversations", "support_wrong"), {
      conversationKind: "customer_to_support",
      clientUid: "client_1",
      sellerUid: "seller_real",
      participants: ["client_1", "seller_real"],
    }),
  );
});

test("le vendeur peut ouvrir un fil seller_to_customer", async () => {
  await assertSucceeds(
    setDoc(doc(db("seller_real"), "conversations", "shop1_client_1"), {
      conversationKind: "seller_to_customer",
      clientUid: "client_1",
      sellerUid: "seller_real",
      companyId: "shop1",
      participants: ["client_1", "seller_real"],
    }),
  );
});

test("messages lisibles et écrivables seulement par les participants", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "conversations", "shop1_client_1"), storePayload());
  });
  await assertSucceeds(
    setDoc(doc(db("client_1"), "conversations", "shop1_client_1", "messages", "m1"), {
      senderId: "client_1",
      text: "bonjour",
    }),
  );
  await assertSucceeds(
    getDoc(doc(db("seller_real"), "conversations", "shop1_client_1", "messages", "m1")),
  );
  await assertFails(
    getDoc(doc(db("stranger"), "conversations", "shop1_client_1", "messages", "m1")),
  );
  await assertFails(
    getDoc(doc(db("stranger"), "conversations", "shop1_client_1")),
  );
  await assertFails(
    addDoc(collection(db("stranger"), "conversations", "shop1_client_1", "messages"), {
      senderId: "stranger",
      text: "non",
    }),
  );
  await assertFails(
    addDoc(collection(db("seller_real"), "conversations", "shop1_client_1", "messages"), {
      senderId: "client_1",
      text: "usurpation",
    }),
  );
});

test("un participant d’une ancienne conversation sans conversationKind peut envoyer", async () => {
  const id = "old_extra_client_1";
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "conversations", id), {
      clientUid: "client_1",
      sellerUid: "seller_real",
      companyId: "shop1",
      participants: ["client_1", "seller_real", "extra_person"],
      lastMessage: "ancien",
    });
  });
  await assertSucceeds(
    addDoc(collection(db("client_1"), "conversations", id, "messages"), {
      senderId: "client_1",
      text: "bonjour",
    }),
  );
  await assertSucceeds(
    updateDoc(doc(db("client_1"), "conversations", id), {
      lastMessage: "bonjour",
      lastMessageType: "text",
      [`unreadCount.client_1`]: 0,
      messageCount: increment(1),
    }),
  );
  await assertFails(
    updateDoc(doc(db("client_1"), "conversations", id), {
      conversationKind: "customer_to_store",
    }),
  );
});

test("un non-participant est refusé sur une ancienne conversation", async () => {
  const id = "old_closed";
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "conversations", id), {
      clientUid: "client_1",
      sellerUid: "seller_real",
      companyId: "shop1",
      participants: ["client_1", "seller_real"],
    });
  });
  await assertFails(getDoc(doc(db("stranger"), "conversations", id)));
  await assertFails(
    addDoc(collection(db("stranger"), "conversations", id, "messages"), {
      senderId: "stranger",
      text: "non",
    }),
  );
  await assertFails(
    updateDoc(doc(db("stranger"), "conversations", id), { lastMessage: "non" }),
  );
});

test("on peut ajouter conversationKind sans changer le vendeur", async () => {
  const id = "old_repair";
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "conversations", id), {
      clientUid: "client_1",
      sellerUid: "seller_real",
      companyId: "shop1",
      participants: ["client_1", "seller_real"],
    });
  });
  await assertSucceeds(
    updateDoc(doc(db("client_1"), "conversations", id), {
      conversationKind: "customer_to_store",
    }),
  );
  await assertFails(
    updateDoc(doc(db("client_1"), "conversations", id), {
      sellerUid: SUPPORT,
    }),
  );
});

test("un fil boutique ne peut pas être créé ni marqué vers le super-admin", async () => {
  await assertFails(
    setDoc(
      doc(db("client_1"), "conversations", "create_admin"),
      storePayload({
        sellerUid: SUPPORT,
        participants: ["client_1", SUPPORT],
      }),
    ),
  );
  const id = "old_admin_seller";
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "conversations", id), {
      clientUid: "client_1",
      sellerUid: SUPPORT,
      companyId: "shop_admin_only",
      participants: ["client_1", SUPPORT],
    });
  });
  await assertFails(
    updateDoc(doc(db("client_1"), "conversations", id), {
      conversationKind: "customer_to_store",
    }),
  );
  await assertSucceeds(
    addDoc(collection(db("client_1"), "conversations", id, "messages"), {
      senderId: "client_1",
      text: "ancien fil",
    }),
  );
  await assertSucceeds(
    updateDoc(doc(db("client_1"), "conversations", id), { lastMessage: "ancien fil" }),
  );
});

test("client vers la boutique du super-admin arrive chez ce compte", async () => {
  const shop = "super_shop";
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "companies", shop), {
      name: "Boutique du super-admin",
      uid: "client_lie",
    });
    await setDoc(doc(ctx.firestore(), "users", shop), { role: "super-admin" });
  });
  const id = `${shop}_client_1`;
  await assertSucceeds(
    setDoc(
      doc(db("client_1"), "conversations", id),
      storePayload({
        sellerUid: shop,
        companyId: shop,
        participants: ["client_1", shop],
      }),
    ),
  );
  await assertFails(
    setDoc(
      doc(db("client_1"), "conversations", "super_shop_mauvais_uid"),
      storePayload({
        sellerUid: "client_lie",
        companyId: shop,
        participants: ["client_1", "client_lie"],
      }),
    ),
  );
  await assertSucceeds(
    addDoc(collection(db(shop), "conversations", id, "messages"), {
      senderId: shop,
      text: "réponse boutique",
    }),
  );
  await assertFails(
    addDoc(collection(db(SUPPORT), "conversations", id, "messages"), {
      senderId: SUPPORT,
      text: "le support n’est pas ce fil",
    }),
  );
  await assertFails(getDoc(doc(db("seller_real"), "conversations", id)));
});

test("une boutique dont l’id n’est pas un compte utilise encore uid", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "companies", "legacy_shop"), {
      name: "Ancienne boutique",
      uid: "seller_real",
    });
  });
  await assertSucceeds(
    setDoc(
      doc(db("client_1"), "conversations", "legacy_shop_client_1"),
      storePayload({
        sellerUid: "seller_real",
        companyId: "legacy_shop",
        participants: ["client_1", "seller_real"],
      }),
    ),
  );
  await assertFails(
    setDoc(
      doc(db("client_1"), "conversations", "legacy_shop_mauvais"),
      storePayload({
        sellerUid: "legacy_shop",
        companyId: "legacy_shop",
        participants: ["client_1", "legacy_shop"],
      }),
    ),
  );
});

test("un compte client n’est pas propriétaire même si son id est celui de la société", async () => {
  const shop = "shop_client";
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "companies", shop), {
      name: "Mauvais compte",
      uid: "seller_real",
    });
    await setDoc(doc(ctx.firestore(), "users", shop), { role: "customer" });
  });
  await assertFails(
    setDoc(
      doc(db("client_1"), "conversations", "shop_client_comme_vendeur"),
      storePayload({
        sellerUid: shop,
        companyId: shop,
        participants: ["client_1", shop],
      }),
    ),
  );
  await assertSucceeds(
    setDoc(
      doc(db("client_1"), "conversations", "shop_client_uid"),
      storePayload({
        sellerUid: "seller_real",
        companyId: shop,
        participants: ["client_1", "seller_real"],
      }),
    ),
  );
});

test("Zero Dollars : le fil arrive chez le propriétaire et chez personne d’autre", async () => {
  const shop = "ZcxPuoYOjZVsTX634Cyr2jkt59A3";
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "companies", shop), {
      name: "Zéro Dollars",
      uid: shop,
    });
    await setDoc(doc(ctx.firestore(), "users", shop), { role: "seller" });
    await setDoc(doc(ctx.firestore(), "conversations", `${shop}_dBEI`), {
      conversationKind: "customer_to_store",
      companyId: shop,
      sellerUid: shop,
      clientUid: "dBEI_client",
      participants: ["dBEI_client", shop],
    });
  });
  await assertSucceeds(getDoc(doc(db(shop), "conversations", `${shop}_dBEI`)));
  await assertFails(getDoc(doc(db(SUPPORT), "conversations", `${shop}_dBEI`)));
  await assertFails(getDoc(doc(db("seller_real"), "conversations", `${shop}_dBEI`)));
  await assertSucceeds(
    addDoc(collection(db(shop), "conversations", `${shop}_dBEI`, "messages"), {
      senderId: shop,
      text: "réponse vendeur",
    }),
  );
});

test("non-régression : produits commandes utilisateurs gardent leurs règles", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "products", "p1"), {
      name: "Produit",
      sellerId: "seller_real",
    });
    await setDoc(doc(ctx.firestore(), "orders", "o1"), {
      userId: "client_1",
      sellerId: "seller_real",
    });
    await setDoc(doc(ctx.firestore(), "users", "client_1"), {
      role: "customer",
      email: "c@test.com",
    });
  });
  await assertSucceeds(getDoc(doc(db("stranger"), "products", "p1")));
  await assertSucceeds(getDoc(doc(db("client_1"), "orders", "o1")));
  await assertFails(getDoc(doc(db("stranger"), "orders", "o1")));
  await assertSucceeds(getDoc(doc(db("client_1"), "users", "client_1")));
  await assertFails(
    updateDoc(doc(db("client_1"), "users", "client_1"), { role: "admin" }),
  );
});

test("client vers une autre boutique n’arrive pas chez le super-admin", async () => {
  await assertSucceeds(
    setDoc(doc(db("client_1"), "conversations", "shop1_client_1"), storePayload()),
  );
  await assertFails(getDoc(doc(db(SUPPORT), "conversations", "shop1_client_1")));
  await assertFails(
    setDoc(
      doc(db("client_1"), "conversations", "shop1_vers_support"),
      storePayload({
        sellerUid: SUPPORT,
        participants: ["client_1", SUPPORT],
      }),
    ),
  );
});

test("client vers le support arrive chez le compte support", async () => {
  const id = "support_client_1_ok";
  await assertSucceeds(
    setDoc(doc(db("client_1"), "conversations", id), {
      conversationKind: "customer_to_support",
      clientUid: "client_1",
      sellerUid: SUPPORT,
      participants: ["client_1", SUPPORT],
    }),
  );
  await assertSucceeds(getDoc(doc(db(SUPPORT), "conversations", id)));
  await assertFails(getDoc(doc(db("seller_real"), "conversations", id)));
});

test("un participant ne peut pas changer le destinataire", async () => {
  await assertSucceeds(
    setDoc(doc(db("client_1"), "conversations", "shop1_client_1"), storePayload()),
  );
  await assertFails(
    updateDoc(doc(db("client_1"), "conversations", "shop1_client_1"), {
      sellerUid: SUPPORT,
    }),
  );
  await assertSucceeds(
    updateDoc(doc(db("client_1"), "conversations", "shop1_client_1"), {
      lastMessage: "ok",
    }),
  );
});
