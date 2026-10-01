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
