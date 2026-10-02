/**
 * Répare les fils boutique envoyés au mauvais compte,
 * quand l’id du document société est un vendeur, un admin ou le super-admin,
 * et qu’aucun ownerUid / ownerId / sellerUid n’est renseigné.
 * Propose aussi de remettre le champ uid de cette société sur ce compte.
 *
 * Ne touche pas un fil où le super-admin est seulement le client d’une autre personne.
 *
 * 1. Sauvegarde (ne modifie rien) :
 *    npx tsx scripts/repair-store-account-owner.ts --backup
 * 2. Aperçu :
 *    npx tsx scripts/repair-store-account-owner.ts
 * 3. Écriture, seulement après une sauvegarde non vide :
 *    npx tsx scripts/repair-store-account-owner.ts --execute
 * 4. Annulation, d’après la sauvegarde :
 *    npx tsx scripts/repair-store-account-owner.ts --rollback
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { initAdmin } from "./lib/firebaseAdmin";

const argv = process.argv.slice(2);
const flags = ["--backup", "--execute", "--rollback"].filter((flag) => argv.includes(flag));
if (flags.length > 1) {
  console.error("Un seul mode à la fois : --backup, --execute ou --rollback.");
  process.exit(1);
}
const mode = flags[0] ?? "--dry-run";
const here = dirname(fileURLToPath(import.meta.url));
const BACKUP_FILE = join(here, "repair-store-account-owner.backup.json");
const PLAN_FILE = join(here, "repair-store-account-owner.plan.json");
const SHOP_OWNER_ROLES = new Set(["seller", "admin", "super-admin", "super_admin"]);
const NOT_USINE_THREAD_IDS = [
  "tL2VAkCxqhZUU01qazUN6YOMMFh2_yxlcK76I8KWWl3aZjIiZPxGDbdH2",
  "WIOk6LDphYPdAzcfS33wAGcHYzF2_yxlcK76I8KWWl3aZjIiZPxGDbdH2",
];

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasExplicitOwner(company: DocumentData): boolean {
  return Boolean(
    nonEmpty(company.ownerUid) || nonEmpty(company.ownerId) || nonEmpty(company.sellerUid),
  );
}

function isVerifiedRole(role: unknown): boolean {
  return typeof role === "string" && SHOP_OWNER_ROLES.has(role.trim());
}

type PlanRow = {
  id: string;
  companyId: string;
  companyName: string | null;
  clientUid: string;
  sellerBefore: string;
  sellerAfter: string;
  participantsBefore: string[];
  participantsAfter: string[];
};

type CompanyRow = {
  id: string;
  name: string | null;
  uidBefore: string;
  uidAfter: string;
};

type LeftRow = {
  id: string;
  reason: string;
  clientUid: string | null;
  otherUid: string | null;
  lastMessage: string | null;
};

async function findMisrouted(db: admin.firestore.Firestore): Promise<{
  plan: PlanRow[];
  companies: CompanyRow[];
  left: LeftRow[];
  skipped: { id: string; reason: string }[];
}> {
  const plan: PlanRow[] = [];
  const companies: CompanyRow[] = [];
  const left: LeftRow[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const roleCache = new Map<string, string | null>();

  const roleOf = async (uid: string) => {
    if (!roleCache.has(uid)) {
      const userSnap = await db.collection("users").doc(uid).get();
      roleCache.set(uid, userSnap.exists ? nonEmpty(userSnap.data()?.role) : null);
    }
    return roleCache.get(uid) ?? null;
  };

  const companySnaps = await db.collection("companies").get();
  for (const companySnap of companySnaps.docs) {
    const company = companySnap.data();
    if (hasExplicitOwner(company)) continue;
    const uid = nonEmpty(company.uid);
    if (!uid || uid === companySnap.id) continue;
    const role = await roleOf(companySnap.id);
    if (!isVerifiedRole(role)) continue;
    companies.push({
      id: companySnap.id,
      name: nonEmpty(company.name) || nonEmpty(company.companyName),
      uidBefore: uid,
      uidAfter: companySnap.id,
    });
  }

  const snap = await db.collection("conversations").get();
  for (const docSnap of snap.docs as QueryDocumentSnapshot[]) {
    const data = docSnap.data();
    const kind = nonEmpty(data.conversationKind);
    if (kind !== "customer_to_store" && kind !== "seller_to_customer") {
      continue;
    }
    const companyId = nonEmpty(data.companyId);
    const sellerUid = nonEmpty(data.sellerUid);
    const clientUid = nonEmpty(data.clientUid);
    const participants = Array.isArray(data.participants)
      ? data.participants.filter((id): id is string => typeof id === "string")
      : [];
    if (!companyId || !sellerUid || !clientUid) {
      skipped.push({ id: docSnap.id, reason: "champs_incomplets" });
      continue;
    }
    if (sellerUid === companyId) continue;

    const companySnap = await db.collection("companies").doc(companyId).get();
    if (!companySnap.exists) {
      skipped.push({ id: docSnap.id, reason: "societe_absente" });
      continue;
    }
    const company = companySnap.data() || {};
    if (hasExplicitOwner(company)) {
      skipped.push({ id: docSnap.id, reason: "proprietaire_explicite" });
      continue;
    }
    const role = await roleOf(companyId);
    if (!isVerifiedRole(role)) {
      skipped.push({ id: docSnap.id, reason: "compte_pas_vendeur" });
      continue;
    }
    const expected =
      participants.length === 2 &&
      participants.includes(clientUid) &&
      participants.includes(sellerUid);
    if (!expected || clientUid === companyId) {
      skipped.push({ id: docSnap.id, reason: "participants_non_sûrs" });
      continue;
    }
    plan.push({
      id: docSnap.id,
      companyId,
      companyName: nonEmpty(company.name) || nonEmpty(company.companyName),
      clientUid,
      sellerBefore: sellerUid,
      sellerAfter: companyId,
      participantsBefore: participants,
      participantsAfter: [clientUid, companyId],
    });
  }

  for (const id of NOT_USINE_THREAD_IDS) {
    const thread = await db.collection("conversations").doc(id).get();
    if (!thread.exists) {
      left.push({ id, reason: "introuvable", clientUid: null, otherUid: null, lastMessage: null });
      continue;
    }
    const data = thread.data() || {};
    const companyId = nonEmpty(data.companyId);
    const linked = companies.some((company) => company.id === companyId) || plan.some((row) => row.id === id);
    if (linked) continue;
    const participants = Array.isArray(data.participants)
      ? data.participants.filter((item): item is string => typeof item === "string")
      : [];
    left.push({
      id,
      reason: "pas_la_boutique_USINE_le_super_admin_est_le_client",
      clientUid: nonEmpty(data.clientUid),
      otherUid: participants.find((item) => item !== data.clientUid) ?? null,
      lastMessage: nonEmpty(data.lastMessage),
    });
  }

  return { plan, companies, left, skipped };
}

type BackupFile = {
  at: string;
  conversations: { id: string; sellerUid: unknown; participants: unknown }[];
  companies: { id: string; uid: unknown }[];
};

async function writeBackup(db: admin.firestore.Firestore, plan: PlanRow[], companies: CompanyRow[]) {
  const conversations = [];
  for (const row of plan) {
    const snap = await db.collection("conversations").doc(row.id).get();
    const data = snap.data() || {};
    conversations.push({
      id: row.id,
      sellerUid: data.sellerUid ?? null,
      participants: data.participants ?? null,
    });
  }
  const companyDocs = [];
  for (const row of companies) {
    const snap = await db.collection("companies").doc(row.id).get();
    companyDocs.push({ id: row.id, uid: snap.data()?.uid ?? null });
  }
  const payload = {
    at: new Date().toISOString(),
    conversations,
    companies: companyDocs,
  };
  writeFileSync(BACKUP_FILE, JSON.stringify(payload, null, 2));
  return payload;
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  if (mode === "--rollback") {
    if (!existsSync(BACKUP_FILE) || statSync(BACKUP_FILE).size < 20) {
      console.error("Refus : aucune sauvegarde à restaurer.");
      process.exit(1);
    }
    const backup = JSON.parse(readFileSync(BACKUP_FILE, "utf8")) as BackupFile;
    for (const row of backup.conversations || []) {
      await db.collection("conversations").doc(row.id).update({
        sellerUid: row.sellerUid,
        participants: row.participants,
      });
      console.log(`Restauré fil : ${row.id}`);
    }
    for (const row of backup.companies || []) {
      await db.collection("companies").doc(row.id).update({ uid: row.uid });
      console.log(`Restauré société : ${row.id}`);
    }
    console.log("Annulation terminée d’après la sauvegarde.");
    return;
  }

  const { plan, companies, left, skipped } = await findMisrouted(db);
  const summary = {
    mode,
    at: new Date().toISOString(),
    threads: plan.length,
    companies: companies.length,
    left: left.length,
    skipped: skipped.length,
    plan,
    companyPlan: companies,
    leftAlone: left,
    skippedDetails: skipped,
  };

  if (mode === "--backup") {
    const payload = await writeBackup(db, plan, companies);
    console.log(
      `Sauvegarde : ${payload.conversations.length} fil(s), ${payload.companies.length} société(s) → ${BACKUP_FILE}`,
    );
    console.log("Aucune écriture Firestore.");
    return;
  }

  writeFileSync(PLAN_FILE, JSON.stringify(summary, null, 2));
  console.log(`Aperçu : ${plan.length} fil(s), ${companies.length} société(s).`);
  for (const row of companies) {
    console.log(`Société ${row.name ?? row.id} | uid ${row.uidBefore} → ${row.uidAfter}`);
  }
  for (const row of plan) {
    console.log(
      `Fil ${row.id} | ${row.companyName ?? row.companyId} | vendeur ${row.sellerBefore} → ${row.sellerAfter}`,
    );
  }
  for (const row of left) {
    console.log(`Laissé ${row.id} | ${row.reason}`);
  }
  console.log(`Détail : ${PLAN_FILE}`);

  if (mode !== "--execute") {
    console.log("Dry-run : aucune écriture Firestore.");
    return;
  }

  if (!existsSync(BACKUP_FILE) || statSync(BACKUP_FILE).size < 20) {
    console.error("Refus : lance d’abord --backup et vérifie que le fichier n’est pas vide.");
    process.exit(1);
  }
  const backup = JSON.parse(readFileSync(BACKUP_FILE, "utf8")) as BackupFile;
  if ((backup.conversations || []).length < plan.length || (backup.companies || []).length < companies.length) {
    console.error("Refus : la sauvegarde ne couvre pas l’aperçu. Relance --backup.");
    process.exit(1);
  }

  for (const row of companies) {
    await db.collection("companies").doc(row.id).update({ uid: row.uidAfter });
    console.log(`Société corrigée : ${row.id}`);
  }
  for (const row of plan) {
    await db.collection("conversations").doc(row.id).update({
      sellerUid: row.sellerAfter,
      participants: row.participantsAfter,
    });
    console.log(`Fil corrigé : ${row.id}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
