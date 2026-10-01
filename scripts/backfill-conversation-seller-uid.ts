/**
 * Backfill sellerUid sur les conversations existantes.
 *
 * DRY-RUN par défaut (aucune écriture). Pour écrire :
 *   npx tsx backfill-conversation-seller-uid.ts --execute
 *
 * Depuis assma/scripts :
 *   npx tsx backfill-conversation-seller-uid.ts
 *   npx tsx backfill-conversation-seller-uid.ts --execute
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

type PlannedRow = {
  id: string;
  companyId: string;
  oldSellerUid: string | null;
  newSellerUid: string;
};

type UnresolvedRow = {
  id: string;
  companyId: string | null;
  oldSellerUid: string | null;
  reason: string;
};

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function companyOwnerUidFromData(data: DocumentData | undefined): string | null {
  if (!data) return null;
  for (const key of ["uid", "ownerId", "ownerUid"] as const) {
    const found = nonEmptyString(data[key]);
    if (found) return found;
  }
  return null;
}

async function main() {
  const admin = initAdmin();
  const db = admin.firestore();

  console.log(`Mode : ${DRY_RUN ? "dry-run" : "EXECUTE"}`);

  const planned: PlannedRow[] = [];
  const unresolved: UnresolvedRow[] = [];
  let scanned = 0;
  let alreadyOk = 0;
  let lastDoc: QueryDocumentSnapshot | null = null;

  const companyCache = new Map<
    string,
    { exists: boolean; ownerUid: string | null }
  >();

  async function resolveCompany(companyId: string) {
    const cached = companyCache.get(companyId);
    if (cached) return cached;
    const snap = await db.collection("companies").doc(companyId).get();
    const resolved = snap.exists
      ? { exists: true, ownerUid: companyOwnerUidFromData(snap.data()) }
      : { exists: false, ownerUid: null };
    companyCache.set(companyId, resolved);
    return resolved;
  }

  for (;;) {
    let q: Query = db
      .collection("conversations")
      .orderBy("__name__")
      .limit(PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      scanned += 1;
      const data = docSnap.data() || {};
      const existingSellerUid = nonEmptyString(data.sellerUid);
      if (existingSellerUid) {
        alreadyOk += 1;
        continue;
      }

      const companyId = nonEmptyString(data.companyId);
      if (!companyId) {
        unresolved.push({
          id: docSnap.id,
          companyId: null,
          oldSellerUid: existingSellerUid,
          reason: "companyId_absent",
        });
        continue;
      }

      const company = await resolveCompany(companyId);
      if (!company.exists) {
        unresolved.push({
          id: docSnap.id,
          companyId,
          oldSellerUid: existingSellerUid,
          reason: "company_introuvable",
        });
        continue;
      }
      if (!company.ownerUid) {
        unresolved.push({
          id: docSnap.id,
          companyId,
          oldSellerUid: existingSellerUid,
          reason: "proprietaire_non_identifiable",
        });
        continue;
      }

      planned.push({
        id: docSnap.id,
        companyId,
        oldSellerUid: existingSellerUid,
        newSellerUid: company.ownerUid,
      });
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }

  console.log("");
  console.log(`Scannés : ${scanned}`);
  console.log(`Déjà OK (sellerUid présent) : ${alreadyOk}`);
  console.log(`À modifier : ${planned.length}`);
  console.log(`Non résolues : ${unresolved.length}`);
  console.log("");

  for (const row of planned) {
    console.log(
      `[${DRY_RUN ? "PLAN" : "SET"}] id=${row.id}  companyId=${row.companyId}  sellerUid ${(row.oldSellerUid || "(vide)")} → ${row.newSellerUid}`,
    );
  }

  if (unresolved.length > 0) {
    console.log("");
    console.log("--- Non résolues ---");
    for (const row of unresolved) {
      console.log(
        `[SKIP] id=${row.id}  companyId=${row.companyId || "(absent)"}  reason=${row.reason}`,
      );
    }
  }

  if (!DRY_RUN && planned.length > 0) {
    for (let i = 0; i < planned.length; i += BATCH_SIZE) {
      const chunk = planned.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const row of chunk) {
        batch.update(db.collection("conversations").doc(row.id), {
          sellerUid: row.newSellerUid,
        });
      }
      await batch.commit();
      console.log(
        `[BATCH] ${Math.min(i + chunk.length, planned.length)}/${planned.length} mis à jour`,
      );
    }
  }

  const outFile = join(
    dirname(fileURLToPath(import.meta.url)),
    DRY_RUN
      ? "backfill-conversation-seller-uid.dry-run.json"
      : "backfill-conversation-seller-uid.execute.json",
  );
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        mode: DRY_RUN ? "dry-run" : "execute",
        scanned,
        alreadyOkCount: alreadyOk,
        plannedCount: planned.length,
        unresolvedCount: unresolved.length,
        planned,
        unresolved,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("");
  console.log("Rapport :", outFile);
  if (DRY_RUN && planned.length > 0) {
    console.log("Pour écrire réellement, relance avec --execute");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
