/**
 * Réparation ciblée messagerie / boutique (strictement limitée).
 *
 * Modes :
 *   npx tsx scripts/repair-store-account-owner.ts --backup
 *   npx tsx scripts/repair-store-account-owner.ts
 *   npx tsx scripts/repair-store-account-owner.ts --execute   (ne pas lancer sans ordre)
 *   npx tsx scripts/repair-store-account-owner.ts --rollback
 *
 * Touche seulement :
 * - fils USINE A2EXPRESS mal envoyés (seller = uid écrasé)
 * - uid de la société USINE si écrasé
 * - fil Zero Dollars ZcxP…_dBEI… (rattachement companyId/sellerUid/clientUid/kind)
 * - archivage IdwD… (Guangzhou, boutique absente) via archived=true
 * - rôles visitor/absents UNIQUEMENT si companies/{uid} existe
 *
 * Ne touche PAS : tL2V…_yxlc…, WIOk…_yxlc… (super-admin = client), F0bk…_zc94…
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import type { DocumentData } from "firebase-admin/firestore";
import { initAdmin } from "./lib/firebaseAdmin";

const argv = process.argv.slice(2);
const flags = ["--backup", "--execute", "--rollback"].filter((f) => argv.includes(f));
if (flags.length > 1) {
  console.error("Un seul mode à la fois : --backup, --execute ou --rollback.");
  process.exit(1);
}
const mode = flags[0] ?? "--dry-run";
const here = dirname(fileURLToPath(import.meta.url));
const BACKUP_FILE = join(here, "repair-store-account-owner.backup.json");
const PLAN_FILE = join(here, "repair-store-account-owner.plan.json");

const USINE = "yxlcK76I8KWWl3aZjIiZPxGDbdH2";
const ZERO = "ZcxPuoYOjZVsTX634Cyr2jkt59A3";
const ZERO_THREAD = "ZcxPuoYOjZVsTX634Cyr2jkt59A3_dBEI7KtAboQP1UsKEgNfx2hoTGn1";
const ZERO_CLIENT = "dBEI7KtAboQP1UsKEgNfx2hoTGn1";
const ARCHIVE_THREADS = [
  "IdwDQQOSjdMRL4YiClg0hiHlfkF2_ZcxPuoYOjZVsTX634Cyr2jkt59A3",
  "IdwDQQOSjdMRL4YiClg0hiHlfkF2_tL2VAkCxqhZUU01qazUN6YOMMFh2",
];
const LEAVE_ALONE = [
  "tL2VAkCxqhZUU01qazUN6YOMMFh2_yxlcK76I8KWWl3aZjIiZPxGDbdH2",
  "WIOk6LDphYPdAzcfS33wAGcHYzF2_yxlcK76I8KWWl3aZjIiZPxGDbdH2",
  "F0bkRlYMPUVBauzV7m0XVQmYIt83_zc94oBEXpEXEzGD2DgqmpjGVuMv2",
];
const SHOP_OWNER_ROLES = new Set(["seller", "admin", "super-admin", "super_admin"]);

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function hasExplicitOwner(company: DocumentData): boolean {
  return Boolean(
    nonEmpty(company.ownerUid) || nonEmpty(company.ownerId) || nonEmpty(company.sellerUid),
  );
}

type Change = {
  type: "thread_owner" | "thread_attach" | "thread_archive" | "company_uid" | "user_role";
  id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  note?: string;
};

async function buildPlan(db: admin.firestore.Firestore): Promise<{
  changes: Change[];
  leftAlone: { id: string; reason: string }[];
}> {
  const changes: Change[] = [];
  const leftAlone: { id: string; reason: string }[] = [];

  for (const id of LEAVE_ALONE) {
    const snap = await db.collection("conversations").doc(id).get();
    if (!snap.exists) {
      leftAlone.push({ id, reason: "introuvable" });
      continue;
    }
    const data = snap.data() || {};
    leftAlone.push({
      id,
      reason:
        id.startsWith("F0bk")
          ? "laisse_tel_quel_dernier_message_du_vendeur"
          : "pas_USINE_super_admin_est_le_client",
    });
    void data;
  }

  // Société USINE : uid écrasé
  const usineSnap = await db.collection("companies").doc(USINE).get();
  if (usineSnap.exists) {
    const company = usineSnap.data() || {};
    const uid = nonEmpty(company.uid);
    if (!hasExplicitOwner(company) && uid && uid !== USINE) {
      const account = await db.collection("users").doc(USINE).get();
      const role = nonEmpty(account.data()?.role);
      if (role && SHOP_OWNER_ROLES.has(role)) {
        changes.push({
          type: "company_uid",
          id: USINE,
          before: { uid },
          after: { uid: USINE },
          note: "USINE A2EXPRESS",
        });
      }
    }
  }

  // Fils USINE mal routés
  const convs = await db.collection("conversations").get();
  for (const docSnap of convs.docs) {
    const data = docSnap.data();
    const kind = nonEmpty(data.conversationKind);
    if (kind !== "customer_to_store" && kind !== "seller_to_customer") continue;
    if (nonEmpty(data.companyId) !== USINE) continue;
    const seller = nonEmpty(data.sellerUid);
    const client = nonEmpty(data.clientUid);
    const parts = Array.isArray(data.participants)
      ? data.participants.filter((x): x is string => typeof x === "string")
      : [];
    if (!seller || !client || seller === USINE) continue;
    if (!(parts.includes(client) && parts.includes(seller))) continue;
    changes.push({
      type: "thread_owner",
      id: docSnap.id,
      before: { sellerUid: seller, participants: parts },
      after: { sellerUid: USINE, participants: [client, USINE] },
      note: "USINE A2EXPRESS",
    });
  }

  // Zero Dollars ZcxP_dBEI : rattacher
  const zeroThread = await db.collection("conversations").doc(ZERO_THREAD).get();
  if (zeroThread.exists) {
    const data = zeroThread.data() || {};
    const parts = Array.isArray(data.participants)
      ? data.participants.filter((x): x is string => typeof x === "string")
      : [];
    if (parts.includes(ZERO) && parts.includes(ZERO_CLIENT)) {
      const needs =
        nonEmpty(data.companyId) !== ZERO ||
        nonEmpty(data.sellerUid) !== ZERO ||
        nonEmpty(data.clientUid) !== ZERO_CLIENT ||
        nonEmpty(data.conversationKind) !== "customer_to_store";
      if (needs) {
        changes.push({
          type: "thread_attach",
          id: ZERO_THREAD,
          before: {
            companyId: data.companyId ?? null,
            sellerUid: data.sellerUid ?? null,
            clientUid: data.clientUid ?? null,
            conversationKind: data.conversationKind ?? null,
            participants: parts,
          },
          after: {
            companyId: ZERO,
            companyName: "Zéro Dollars",
            sellerUid: ZERO,
            clientUid: ZERO_CLIENT,
            conversationKind: "customer_to_store",
            participants: parts,
          },
          note: "rattachement Zero Dollars, messages intacts",
        });
      }
    }
  } else {
    leftAlone.push({ id: ZERO_THREAD, reason: "introuvable" });
  }

  // Archivage Guangzhou
  for (const id of ARCHIVE_THREADS) {
    const snap = await db.collection("conversations").doc(id).get();
    if (!snap.exists) {
      leftAlone.push({ id, reason: "introuvable" });
      continue;
    }
    const data = snap.data() || {};
    if (data.archived === true) continue;
    changes.push({
      type: "thread_archive",
      id,
      before: { archived: data.archived ?? null },
      after: { archived: true },
      note: "Guangzhou G-Packing — boutique absente",
    });
  }

  // Rôles visitor / absents pour owners companies/{uid}
  const companies = await db.collection("companies").get();
  for (const company of companies.docs) {
    const userSnap = await db.collection("users").doc(company.id).get();
    if (!userSnap.exists) continue;
    const role = nonEmpty(userSnap.data()?.role);
    if (role && role !== "visitor") continue;
    changes.push({
      type: "user_role",
      id: company.id,
      before: { role: role },
      after: { role: "seller" },
      note: nonEmpty(company.data()?.name) || "société",
    });
  }

  return { changes, leftAlone };
}

type BackupFile = {
  at: string;
  changes: Change[];
  docs: {
    conversations: Record<string, unknown>;
    companies: Record<string, unknown>;
    users: Record<string, unknown>;
  };
};

async function writeBackup(db: admin.firestore.Firestore, changes: Change[]) {
  const conversations: Record<string, unknown> = {};
  const companies: Record<string, unknown> = {};
  const users: Record<string, unknown> = {};
  for (const change of changes) {
    if (change.type.startsWith("thread")) {
      const snap = await db.collection("conversations").doc(change.id).get();
      conversations[change.id] = snap.data() ?? null;
    } else if (change.type === "company_uid") {
      const snap = await db.collection("companies").doc(change.id).get();
      companies[change.id] = { uid: snap.data()?.uid ?? null };
    } else if (change.type === "user_role") {
      const snap = await db.collection("users").doc(change.id).get();
      users[change.id] = { role: snap.data()?.role ?? null };
    }
  }
  const payload: BackupFile = {
    at: new Date().toISOString(),
    changes,
    docs: { conversations, companies, users },
  };
  writeFileSync(BACKUP_FILE, JSON.stringify(payload, null, 2));
  return payload;
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  if (mode === "--rollback") {
    if (!existsSync(BACKUP_FILE) || statSync(BACKUP_FILE).size < 20) {
      console.error("Refus : aucune sauvegarde.");
      process.exit(1);
    }
    const backup = JSON.parse(readFileSync(BACKUP_FILE, "utf8")) as BackupFile;
    for (const change of backup.changes || []) {
      if (change.type.startsWith("thread")) {
        const original = backup.docs.conversations[change.id] as Record<string, unknown> | null;
        if (!original) continue;
        const patch: Record<string, unknown> = {};
        for (const key of Object.keys(change.after)) {
          patch[key] =
            original[key] === undefined ? admin.firestore.FieldValue.delete() : original[key];
        }
        await db.collection("conversations").doc(change.id).update(patch);
        console.log(`Restauré fil ${change.id}`);
      } else if (change.type === "company_uid") {
        const original = backup.docs.companies[change.id] as { uid?: unknown } | undefined;
        await db.collection("companies").doc(change.id).update({
          uid: original?.uid ?? admin.firestore.FieldValue.delete(),
        });
        console.log(`Restauré société ${change.id}`);
      } else if (change.type === "user_role") {
        const original = backup.docs.users[change.id] as { role?: unknown } | undefined;
        await db.collection("users").doc(change.id).update({
          role:
            original?.role == null
              ? admin.firestore.FieldValue.delete()
              : original.role,
        });
        console.log(`Restauré rôle ${change.id}`);
      }
    }
    console.log("Annulation terminée.");
    return;
  }

  const { changes, leftAlone } = await buildPlan(db);
  const byType = changes.reduce<Record<string, number>>((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});

  if (mode === "--backup") {
    await writeBackup(db, changes);
    console.log(`Sauvegarde : ${changes.length} changement(s) → ${BACKUP_FILE}`);
    console.log(JSON.stringify(byType));
    console.log("Aucune écriture Firestore.");
    return;
  }

  const summary = {
    mode,
    at: new Date().toISOString(),
    counts: byType,
    total: changes.length,
    changes,
    leftAlone,
  };
  writeFileSync(PLAN_FILE, JSON.stringify(summary, null, 2));

  console.log(`Aperçu : ${changes.length} élément(s)`);
  console.log(JSON.stringify(byType));
  for (const c of changes) {
    console.log(
      `${c.type} | ${c.id} | ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}${c.note ? " | " + c.note : ""}`,
    );
  }
  for (const row of leftAlone) {
    console.log(`laissé | ${row.id} | ${row.reason}`);
  }
  console.log(`Détail : ${PLAN_FILE}`);

  const roleCount = byType.user_role || 0;
  if (roleCount > 3) {
    console.error(
      `STOP : ${roleCount} comptes visitor/sans rôle avec société — trop pour continuer sans validation.`,
    );
    process.exit(2);
  }

  if (mode !== "--execute") {
    console.log("Dry-run : aucune écriture Firestore.");
    return;
  }

  if (!existsSync(BACKUP_FILE) || statSync(BACKUP_FILE).size < 20) {
    console.error("Refus : lance --backup d’abord.");
    process.exit(1);
  }

  for (const change of changes) {
    if (change.type.startsWith("thread")) {
      await db.collection("conversations").doc(change.id).update(change.after);
    } else if (change.type === "company_uid") {
      await db.collection("companies").doc(change.id).update(change.after);
    } else if (change.type === "user_role") {
      await db.collection("users").doc(change.id).update(change.after);
    }
    console.log(`Corrigé ${change.type} ${change.id}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
