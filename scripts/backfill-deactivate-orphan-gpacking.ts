/**
 * Désactive le catalogue orphelin G-Packing (isActive → false).
 * Ne supprime aucun document. Exclut la presse à huile encore en commandes payées.
 *
 * DRY-RUN par défaut (aucune écriture). Pour écrire :
 *   npx tsx backfill-deactivate-orphan-gpacking.ts --execute
 *
 * Depuis assma/scripts :
 *   npx tsx backfill-deactivate-orphan-gpacking.ts
 *   npx tsx backfill-deactivate-orphan-gpacking.ts --execute
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { initAdmin } from "./lib/firebaseAdmin";

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes("--execute");
const BATCH_SIZE = 400;

const COMPANY_ID = "IdwDQQOSjdMRL4YiClg0hiHlfkF2";
const EXCLUDED_IDS = new Set(["a4xgZwlMA6xaoGXSGI3V"]);

type ProductRow = {
  id: string;
  name: string;
  categoryName: string | null;
  status: string | null;
  isActiveBefore: boolean | null;
  isActiveAfter: boolean;
};

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readIsActive(value: unknown): boolean | null {
  if (value === undefined) return null;
  return value !== false;
}

async function main() {
  const admin = initAdmin();
  const db = admin.firestore();

  console.log(`Mode : ${DRY_RUN ? "dry-run" : "EXECUTE"}`);
  console.log(`companyId : ${COMPANY_ID}`);
  console.log(`Exclusion : ${[...EXCLUDED_IDS].join(", ")}`);
  console.log("");

  const matched: ProductRow[] = [];
  const planned: ProductRow[] = [];
  const excluded: ProductRow[] = [];
  const alreadyInactive: ProductRow[] = [];
  const missingExcluded: string[] = [...EXCLUDED_IDS];

  const snap = await db
    .collection("products")
    .where("companyId", "==", COMPANY_ID)
    .get();

  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    const isActiveBefore = readIsActive(data.isActive);
    const row: ProductRow = {
      id: docSnap.id,
      name: asTrimmedString(data.name) || "Sans nom",
      categoryName: asTrimmedString(data.categoryName),
      status: asTrimmedString(data.status),
      isActiveBefore,
      isActiveAfter: false,
    };
    matched.push(row);

    if (EXCLUDED_IDS.has(docSnap.id)) {
      row.isActiveAfter = isActiveBefore === null ? true : isActiveBefore;
      excluded.push(row);
      const idx = missingExcluded.indexOf(docSnap.id);
      if (idx >= 0) missingExcluded.splice(idx, 1);
      continue;
    }

    if (isActiveBefore === false) {
      alreadyInactive.push(row);
      continue;
    }

    planned.push(row);
  }

  planned.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  excluded.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  alreadyInactive.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  console.log(`Trouvés (companyId) : ${matched.length}`);
  console.log(`Exclus (non touchés) : ${excluded.length}`);
  console.log(`Déjà inactifs : ${alreadyInactive.length}`);
  console.log(`À désactiver (isActive → false) : ${planned.length}`);
  if (missingExcluded.length > 0) {
    console.log(
      `ATTENTION : id d'exclusion introuvable dans ce companyId : ${missingExcluded.join(", ")}`,
    );
  }
  console.log("");

  console.log("--- Exclusion confirmée ---");
  for (const row of excluded) {
    console.log(
      `[KEEP] id=${row.id}  name=${JSON.stringify(row.name)}  isActive=${row.isActiveBefore}`,
    );
  }
  if (excluded.length === 0 && missingExcluded.length > 0) {
    for (const id of missingExcluded) {
      console.log(`[KEEP] id=${id}  (absent de la requête — non modifié)`);
    }
  }
  console.log("");

  console.log(`--- ${planned.length} produit(s) à désactiver ---`);
  for (const row of planned) {
    console.log(
      `[${DRY_RUN ? "PLAN" : "SET"}] id=${row.id}  name=${JSON.stringify(row.name)}  category=${JSON.stringify(row.categoryName)}  status=${row.status}  isActive ${row.isActiveBefore} → false`,
    );
  }

  if (alreadyInactive.length > 0) {
    console.log("");
    console.log("--- Déjà isActive=false ---");
    for (const row of alreadyInactive) {
      console.log(`[SKIP] id=${row.id}  name=${JSON.stringify(row.name)}`);
    }
  }

  if (!DRY_RUN && planned.length > 0) {
    for (let i = 0; i < planned.length; i += BATCH_SIZE) {
      const chunk = planned.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const row of chunk) {
        batch.update(db.collection("products").doc(row.id), {
          isActive: false,
          updatedAt: new Date(),
        });
      }
      await batch.commit();
      console.log(
        `[BATCH] ${Math.min(i + chunk.length, planned.length)}/${planned.length} désactivés`,
      );
    }
  }

  const outFile = join(
    dirname(fileURLToPath(import.meta.url)),
    DRY_RUN
      ? "backfill-deactivate-orphan-gpacking.dry-run.json"
      : "backfill-deactivate-orphan-gpacking.execute.json",
  );
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        mode: DRY_RUN ? "dry-run" : "execute",
        companyId: COMPANY_ID,
        excludedIds: [...EXCLUDED_IDS],
        exclusionConfirmed: excluded.map((row) => ({
          id: row.id,
          name: row.name,
          isActiveBefore: row.isActiveBefore,
          isActiveAfter: row.isActiveAfter,
          touched: false,
        })),
        excludedIdsNotInQuery: missingExcluded,
        scanned: matched.length,
        alreadyInactiveCount: alreadyInactive.length,
        plannedCount: planned.length,
        deactivatedCount: DRY_RUN ? 0 : planned.length,
        before: {
          activeOrUnknown: planned.length + excluded.filter((r) => r.isActiveBefore !== false).length,
          inactive: alreadyInactive.length,
        },
        after: {
          wouldBeInactive: planned.length + alreadyInactive.length,
          stillActiveExcluded: excluded.filter((r) => r.isActiveBefore !== false).length,
        },
        planned,
        alreadyInactive,
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
