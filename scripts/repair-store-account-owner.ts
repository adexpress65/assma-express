/**
 * Répare un fil boutique déjà créé vers le mauvais compte,
 * quand l’id du document société EST le compte propriétaire
 * et qu’aucun ownerUid / ownerId / sellerUid n’est renseigné.
 *
 * Ne touche pas les autres fils. Ne change pas conversationKind.
 *
 * 1. Sauvegarde des fils concernés (ne modifie rien) :
 *    npx tsx scripts/repair-store-account-owner.ts --backup
 * 2. Aperçu :
 *    npx tsx scripts/repair-store-account-owner.ts
 * 3. Écriture, seulement après une sauvegarde non vide :
 *    npx tsx scripts/repair-store-account-owner.ts --execute
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import type { DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { initAdmin } from "./lib/firebaseAdmin";

const argv = process.argv.slice(2);
const flags = ["--backup", "--execute"].filter((flag) => argv.includes(flag));
if (flags.length > 1) {
  console.error("Un seul mode à la fois : --backup ou --execute.");
  process.exit(1);
}
const mode = flags[0] ?? "--dry-run";
const here = dirname(fileURLToPath(import.meta.url));
const BACKUP_FILE = join(here, "repair-store-account-owner.backup.json");
const PLAN_FILE = join(here, "repair-store-account-owner.plan.json");

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

async function findMisrouted(db: admin.firestore.Firestore): Promise<{
  plan: PlanRow[];
  skipped: { id: string; reason: string }[];
}> {
  const plan: PlanRow[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const accountCache = new Map<string, boolean>();

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
    if (!accountCache.has(companyId)) {
      const userSnap = await db.collection("users").doc(companyId).get();
      accountCache.set(companyId, userSnap.exists);
    }
    if (!accountCache.get(companyId)) {
      skipped.push({ id: docSnap.id, reason: "id_societe_pas_un_compte" });
      continue;
    }
    const expected = participants.length === 2 && participants.includes(clientUid) && participants.includes(sellerUid);
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
  return { plan, skipped };
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const { plan, skipped } = await findMisrouted(db);
  const summary = {
    mode,
    at: new Date().toISOString(),
    toFix: plan.length,
    skipped: skipped.length,
    plan,
    skipped,
  };

  if (mode === "--backup") {
    const docs = [];
    for (const row of plan) {
      const snap = await db.collection("conversations").doc(row.id).get();
      docs.push({ id: row.id, data: snap.data() ?? null });
    }
    writeFileSync(
      BACKUP_FILE,
      JSON.stringify({ at: summary.at, count: docs.length, docs }, null, 2),
    );
    console.log(`Sauvegarde : ${docs.length} fil(s) → ${BACKUP_FILE}`);
    console.log("Aucune écriture Firestore.");
    return;
  }

  writeFileSync(PLAN_FILE, JSON.stringify(summary, null, 2));
  console.log(`Aperçu : ${plan.length} fil(s) à réparer, ${skipped.length} ignoré(s).`);
  for (const row of plan) {
    console.log(
      `${row.id} | ${row.companyName ?? row.companyId} | vendeur ${row.sellerBefore} → ${row.sellerAfter}`,
    );
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
  const backup = JSON.parse(readFileSync(BACKUP_FILE, "utf8")) as { count?: number };
  if (!backup.count || backup.count < plan.length) {
    console.error("Refus : la sauvegarde ne couvre pas tous les fils de l’aperçu. Relance --backup.");
    process.exit(1);
  }

  for (const row of plan) {
    await db.collection("conversations").doc(row.id).update({
      sellerUid: row.sellerAfter,
      participants: row.participantsAfter,
    });
    console.log(`Corrigé : ${row.id}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
