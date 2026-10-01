/**
 * Retire de l’index Algolia `products` les 143 SKU G-Packing déjà
 * désactivés en Firestore (Lot A). Aucune écriture Firestore.
 *
 *   npx tsx cleanup-algolia-orphan-gpacking.ts
 */
import { createRequire } from "module";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const EXCLUDED_ID = "a4xgZwlMA6xaoGXSGI3V";
const EXPECTED_COUNT = 143;
const ALGOLIA_APP_ID = "ZYRHOXK3WR";
const ALGOLIA_ADMIN_KEY = "db3194e274569db32e5938952f5a3ffd";
const ALGOLIA_INDEX_NAME = "products";
const DELETE_CHUNK = 1000;

type PlannedRow = { id: string; name?: string };

function loadPlannedIds(executePath: string): string[] {
  const raw = JSON.parse(readFileSync(executePath, "utf8")) as {
    plannedCount?: number;
    deactivatedCount?: number;
    planned?: PlannedRow[];
  };
  if (!Array.isArray(raw.planned)) {
    throw new Error("Rapport Lot A invalide : champ `planned` manquant");
  }
  if (raw.plannedCount !== EXPECTED_COUNT || raw.deactivatedCount !== EXPECTED_COUNT) {
    throw new Error(
      `Rapport Lot A inattendu : plannedCount=${raw.plannedCount} deactivatedCount=${raw.deactivatedCount} (attendu ${EXPECTED_COUNT})`,
    );
  }
  const ids = [...new Set(raw.planned.map((row) => String(row.id || "").trim()).filter(Boolean))];
  if (ids.length !== EXPECTED_COUNT) {
    throw new Error(`IDs uniques = ${ids.length}, attendu ${EXPECTED_COUNT}`);
  }
  if (ids.includes(EXCLUDED_ID)) {
    throw new Error(`L’ID exclu ${EXCLUDED_ID} est dans la liste — abort`);
  }
  return ids;
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const executePath = join(here, "backfill-deactivate-orphan-gpacking.execute.json");
  const ids = loadPlannedIds(executePath);

  const requireFromFunctions = createRequire(
    join(here, "..", "functions", "package.json"),
  );
  const algoliasearch = requireFromFunctions("algoliasearch") as typeof import("algoliasearch").default;
  const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
  const index = client.initIndex(ALGOLIA_INDEX_NAME);

  const { results } = await index.getObjects(ids);
  if (!Array.isArray(results) || results.length !== ids.length) {
    throw new Error(
      `getObjects inattendu : ${Array.isArray(results) ? results.length : "n/a"} résultats pour ${ids.length} IDs`,
    );
  }

  const present: string[] = [];
  const absent: string[] = [];
  results.forEach((obj, i) => {
    const id = ids[i];
    if (obj && typeof obj === "object") present.push(id);
    else absent.push(id);
  });

  console.log(`Lot A : ${ids.length} IDs`);
  console.log(`Présents dans Algolia : ${present.length}`);
  console.log(`Déjà absents : ${absent.length}`);

  let deletedCount = 0;
  if (present.length > 0) {
    for (let i = 0; i < present.length; i += DELETE_CHUNK) {
      const chunk = present.slice(i, i + DELETE_CHUNK);
      if (chunk.length === 1) {
        await index.deleteObject(chunk[0]).wait();
      } else {
        await index.deleteObjects(chunk).wait();
      }
      deletedCount += chunk.length;
    }
  }

  const after = await index.getObjects(ids);
  const stillPresent = (after.results || [])
    .map((obj, i) => (obj && typeof obj === "object" ? ids[i] : null))
    .filter((id): id is string => Boolean(id));

  const report = {
    mode: "algolia-only",
    index: ALGOLIA_INDEX_NAME,
    firestoreTouched: false,
    expectedCount: EXPECTED_COUNT,
    scannedIds: ids.length,
    presentBefore: present.length,
    alreadyAbsent: absent.length,
    deleted: deletedCount,
    stillPresentAfter: stillPresent,
    presentIdsBefore: present,
    absentIdsBefore: absent,
    ranAt: new Date().toISOString(),
  };

  const outFile = join(here, "cleanup-algolia-orphan-gpacking.report.json");
  writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");
  console.log("Rapport :", outFile);

  if (stillPresent.length > 0) {
    throw new Error(
      `Après deleteObjects, ${stillPresent.length} ID(s) encore dans l’index : ${stillPresent.join(", ")}`,
    );
  }
  if (deletedCount !== present.length) {
    throw new Error(`deleted=${deletedCount} ≠ presentBefore=${present.length}`);
  }

  console.log("Étape 1 OK : index nettoyé, Firestore intact.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
