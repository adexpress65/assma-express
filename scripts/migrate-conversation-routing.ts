/**
 * Corrige le routage des fils boutique existants.
 *
 * DRY-RUN par défaut :
 *   npx tsx migrate-conversation-routing.ts
 * Écriture :
 *   npx tsx migrate-conversation-routing.ts --execute
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type {
  DocumentData,
  Query,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { initAdmin } from "./lib/firebaseAdmin";

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes("--execute");
const BATCH_SIZE = 400;
const PAGE_SIZE = 400;
const SUPPORT_INBOX_UID = "biU1QvlrGtZeqTLdbLONLGbyVQ92";

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
  const admin = initAdmin();
  const db = admin.firestore();
  console.log(`Mode : ${DRY_RUN ? "dry-run" : "EXECUTE"}`);

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

  if (!DRY_RUN && planned.length > 0) {
    for (let i = 0; i < planned.length; i += BATCH_SIZE) {
      const chunk = planned.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const row of chunk) {
        batch.update(db.collection("conversations").doc(row.id), {
          sellerUid: row.newSellerUid,
          clientUid: row.clientUid,
          conversationKind: "customer_to_store",
          type: "seller",
          participants: row.newParticipants,
        });
      }
      await batch.commit();
    }
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
