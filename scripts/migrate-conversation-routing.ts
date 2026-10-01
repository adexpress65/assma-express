/**
 * Corrige le routage des fils boutique existants.
 *
 * 1. Sauvegarde (ne modifie rien) :
 *    npx tsx migrate-conversation-routing.ts --backup
 * 2. Aperçu :
 *    npx tsx migrate-conversation-routing.ts
 * 3. Écriture (refuse de tourner sans le fichier de sauvegarde) :
 *    npx tsx migrate-conversation-routing.ts --execute
 * 4. Annulation (remet l'état d'avant, d'après le journal) :
 *    npx tsx migrate-conversation-routing.ts --rollback
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import type {
  DocumentData,
  Query,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { initAdmin } from "./lib/firebaseAdmin";

const argv = process.argv.slice(2);
const FLAGS = ["--backup", "--execute", "--rollback"] as const;
const selected = FLAGS.filter((flag) => argv.includes(flag));
if (selected.length > 1) {
  console.error("Un seul mode à la fois : --backup, --execute ou --rollback.");
  process.exit(1);
}
const MODE = selected[0] ?? "--dry-run";
const DRY_RUN = MODE !== "--execute";
const BATCH_SIZE = 400;
const PAGE_SIZE = 400;
const SUPPORT_INBOX_UID = "biU1QvlrGtZeqTLdbLONLGbyVQ92";
const here = dirname(fileURLToPath(import.meta.url));
const BACKUP_FILE = join(here, "migrate-conversation-routing.backup.json");
const JOURNAL_FILE = join(here, "migrate-conversation-routing.journal.json");
const ROLLBACK_FILE = join(here, "migrate-conversation-routing.rollback.json");

type RoutingSnapshot = {
  sellerUid: string | null;
  clientUid: string | null;
  conversationKind: string | null;
  type: string | null;
  participants: string[] | null;
};

function serializeValue(value: unknown): unknown {
  if (value == null) return value ?? null;
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return { __timestamp: (value as { toDate: () => Date }).toDate().toISOString() };
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = serializeValue(nested);
    }
    return out;
  }
  return value;
}

function routingSnapshot(data: DocumentData | undefined): RoutingSnapshot {
  if (!data) {
    return {
      sellerUid: null,
      clientUid: null,
      conversationKind: null,
      type: null,
      participants: null,
    };
  }
  return {
    sellerUid: nonEmptyString(data.sellerUid),
    clientUid: nonEmptyString(data.clientUid),
    conversationKind: nonEmptyString(data.conversationKind),
    type: nonEmptyString(data.type),
    participants: Array.isArray(data.participants)
      ? data.participants.filter((id): id is string => typeof id === "string")
      : null,
  };
}

function restorePayload(before: RoutingSnapshot): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of ["sellerUid", "clientUid", "conversationKind", "type", "participants"] as const) {
    payload[key] = before[key] == null ? admin.firestore.FieldValue.delete() : before[key];
  }
  return payload;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function companyOwnerCandidates(data: DocumentData | undefined): string[] {
  if (!data) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of ["ownerUid", "ownerId", "sellerUid", "uid"] as const) {
    const found = nonEmptyString(data[key]);
    if (found && found !== SUPPORT_INBOX_UID && !seen.has(found)) {
      seen.add(found);
      out.push(found);
    }
  }
  return out;
}

type PlannedRow = {
  id: string;
  companyId: string | null;
  clientUid: string | null;
  oldParticipants: string[];
  newParticipants: string[];
  oldSellerUid: string | null;
  newSellerUid: string;
  conversationKind: "customer_to_store";
};

async function main() {
  const app = initAdmin();
  const db = app.firestore();
  console.log(`Mode : ${MODE}`);

  if (MODE === "--rollback") {
    if (!existsSync(JOURNAL_FILE)) {
      console.error("Journal introuvable. Rien à annuler :", JOURNAL_FILE);
      process.exit(1);
    }
    const journal = JSON.parse(readFileSync(JOURNAL_FILE, "utf8")) as {
      entries: { id: string; before: RoutingSnapshot; after: RoutingSnapshot }[];
    };
    const entries = journal.entries || [];
    const rolled: { id: string; before: RoutingSnapshot; after: RoutingSnapshot }[] = [];
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const chunk = entries.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const entry of chunk) {
        const ref = db.collection("conversations").doc(entry.id);
        const live = await ref.get();
        const current = routingSnapshot(live.data());
        batch.update(ref, restorePayload(entry.before));
        rolled.push({ id: entry.id, before: current, after: entry.before });
      }
      await batch.commit();
    }
    writeFileSync(
      ROLLBACK_FILE,
      JSON.stringify({ mode: "rollback", at: new Date().toISOString(), entries: rolled }, null, 2),
      "utf8",
    );
    console.log(`Annulé : ${rolled.length}`);
    console.log("Journal d'annulation :", ROLLBACK_FILE);
    return;
  }

  if (MODE === "--backup") {
    const docs: { id: string; data: unknown }[] = [];
    let last: QueryDocumentSnapshot | null = null;
    for (;;) {
      let q: Query = db.collection("conversations").orderBy("__name__").limit(PAGE_SIZE);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      if (snap.empty) break;
      for (const docSnap of snap.docs) {
        docs.push({ id: docSnap.id, data: serializeValue(docSnap.data() || {}) });
      }
      last = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE_SIZE) break;
    }
    writeFileSync(
      BACKUP_FILE,
      JSON.stringify({ mode: "backup", at: new Date().toISOString(), count: docs.length, docs }, null, 2),
      "utf8",
    );
    console.log(`Sauvegarde : ${docs.length} conversations`);
    console.log("Fichier :", BACKUP_FILE);
    return;
  }

  const planned: PlannedRow[] = [];
  const skipped: { id: string; reason: string }[] = [];
  let scanned = 0;
  let lastDoc: QueryDocumentSnapshot | null = null;
  const companyCache = new Map<string, DocumentData | null>();

  async function companyData(companyId: string) {
    if (companyCache.has(companyId)) return companyCache.get(companyId) ?? null;
    const snap = await db.collection("companies").doc(companyId).get();
    const data = snap.exists ? snap.data() || null : null;
    companyCache.set(companyId, data);
    return data;
  }

  for (;;) {
    let q: Query = db.collection("conversations").orderBy("__name__").limit(PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      scanned += 1;
      const data = docSnap.data() || {};
      const type = nonEmptyString(data.type);
      const kind = nonEmptyString(data.conversationKind);
      if (type === "support" || kind === "customer_to_support") {
        skipped.push({ id: docSnap.id, reason: "support_inchangé" });
        continue;
      }

      const companyId = nonEmptyString(data.companyId);
      const suffix = docSnap.id.includes("_")
        ? docSnap.id.slice(docSnap.id.indexOf("_") + 1)
        : null;
      const clientUid =
        nonEmptyString(data.clientUid) ||
        (suffix && suffix !== companyId ? suffix : null) ||
        nonEmptyString(data.createdBy);

      let sellerUid = nonEmptyString(data.sellerUid);
      if (sellerUid === SUPPORT_INBOX_UID) sellerUid = null;
      if (!sellerUid && companyId) {
        const company = await companyData(companyId);
        sellerUid = companyOwnerCandidates(company || undefined)[0] || null;
      }
      if (!sellerUid || !clientUid) {
        skipped.push({
          id: docSnap.id,
          reason: !clientUid ? "client_introuvable" : "seller_introuvable",
        });
        continue;
      }

      const oldParticipants = Array.isArray(data.participants)
        ? (data.participants as string[])
        : [];
      const newParticipants = [clientUid, sellerUid];
      const sameParts =
        oldParticipants.length === 2 &&
        newParticipants.every((id) => oldParticipants.includes(id)) &&
        oldParticipants.every((id) => newParticipants.includes(id));
      const sellerAlready = nonEmptyString(data.sellerUid) === sellerUid;
      const kindAlready = kind === "customer_to_store";
      if (sameParts && sellerAlready && kindAlready) continue;

      planned.push({
        id: docSnap.id,
        companyId,
        clientUid,
        oldParticipants,
        newParticipants,
        oldSellerUid: nonEmptyString(data.sellerUid),
        newSellerUid: sellerUid,
        conversationKind: "customer_to_store",
      });
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }

  console.log(`Scannés : ${scanned}`);
  console.log(`À modifier : ${planned.length}`);
  console.log(`Ignorés : ${skipped.length}`);
  for (const row of planned) {
    console.log(
      `[${DRY_RUN ? "PLAN" : "SET"}] ${row.id} participants ${JSON.stringify(row.oldParticipants)} → ${JSON.stringify(row.newParticipants)} sellerUid=${row.newSellerUid}`,
    );
  }

  const journal: { id: string; before: RoutingSnapshot; after: RoutingSnapshot }[] = [];

  if (MODE === "--execute" && planned.length > 0) {
    if (!existsSync(BACKUP_FILE)) {
      console.error("Refus : lancez d'abord --backup. Fichier attendu :", BACKUP_FILE);
      process.exit(1);
    }
    for (let i = 0; i < planned.length; i += BATCH_SIZE) {
      const chunk = planned.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const row of chunk) {
        const ref = db.collection("conversations").doc(row.id);
        const live = await ref.get();
        const before = routingSnapshot(live.data());
        const after: RoutingSnapshot = {
          sellerUid: row.newSellerUid,
          clientUid: row.clientUid,
          conversationKind: "customer_to_store",
          type: "seller",
          participants: row.newParticipants,
        };
        batch.update(ref, {
          sellerUid: after.sellerUid,
          clientUid: after.clientUid,
          conversationKind: after.conversationKind,
          type: after.type,
          participants: after.participants,
        });
        journal.push({ id: row.id, before, after });
      }
      await batch.commit();
    }
    writeFileSync(
      JOURNAL_FILE,
      JSON.stringify({ mode: "execute", at: new Date().toISOString(), entries: journal }, null, 2),
      "utf8",
    );
    console.log("Journal avant/après :", JOURNAL_FILE);
  }

  const outFile = join(
    dirname(fileURLToPath(import.meta.url)),
    DRY_RUN
      ? "migrate-conversation-routing.dry-run.json"
      : "migrate-conversation-routing.execute.json",
  );
  writeFileSync(
    outFile,
    JSON.stringify({ mode: DRY_RUN ? "dry-run" : "execute", scanned, planned, skipped }, null, 2),
    "utf8",
  );
  console.log("Rapport :", outFile);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
