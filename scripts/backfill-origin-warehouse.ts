/**
 * Backfill originWarehouseId sur les produits catalogue 0 / 1 FCFA.
 *
 * DRY-RUN par défaut (aucune écriture). Pour écrire :
 *   npx tsx backfill-origin-warehouse.ts --execute
 *
 * Depuis assma/scripts :
 *   npx tsx backfill-origin-warehouse.ts
 *   npx tsx backfill-origin-warehouse.ts --execute
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
const DEFAULT_WAREHOUSE_ID = "guangzhou";

type WarehouseEntry = {
  id: string;
  label: string;
  active: boolean;
};

type PlannedRow = {
  id: string;
  name: string;
  price: number;
  oldOriginWarehouseId: string | null;
  oldOriginWarehouseLabel: string | null;
  newOriginWarehouseId: string;
  newOriginWarehouseLabel: string;
  reason: string;
};

function normalizeWarehouseId(id: unknown): string | null {
  if (id == null) return null;
  const s = String(id).trim().toLowerCase();
  return s.length > 0 ? s : null;
}

function catalogPrice(data: DocumentData): number | null {
  const raw = data.price ?? data.priceXOF;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseActiveWarehouses(raw: DocumentData | undefined): WarehouseEntry[] {
  const list = Array.isArray(raw?.warehouses) ? raw.warehouses : [];
  const parsed: WarehouseEntry[] = list
    .map((row: unknown, index: number) => {
      const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      const id = normalizeWarehouseId(r.id);
      if (!id) return null;
      return {
        id,
        label: String(r.label || id).trim() || id,
        active: r.active !== false,
        sortOrder: Number(r.sortOrder) || index + 1,
      };
    })
    .filter((x): x is WarehouseEntry & { sortOrder: number } => x != null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ id, label, active }) => ({ id, label, active }));

  if (parsed.length > 0) return parsed;
  return [
    { id: "guangzhou", label: "Guangzhou", active: true },
    { id: "yiwu", label: "Yiwu", active: true },
  ];
}

async function main() {
  const admin = initAdmin();
  const db = admin.firestore();

  const feeSnap = await db.doc("config/warehouseFees").get();
  const warehouses = parseActiveWarehouses(
    feeSnap.exists ? feeSnap.data() : undefined,
  );
  const active = warehouses.filter((w) => w.active);
  const activeById = new Map(active.map((w) => [w.id, w]));
  const defaultHub = activeById.get(DEFAULT_WAREHOUSE_ID);

  console.log(`Mode : ${DRY_RUN ? "dry-run" : "EXECUTE"}`);
  console.log(
    `Hubs actifs : ${active.map((w) => `${w.id} (${w.label})`).join(", ") || "(aucun)"}`,
  );

  if (!defaultHub) {
    console.error(
      `Hub par défaut "${DEFAULT_WAREHOUSE_ID}" absent ou inactif. Abandon.`,
    );
    process.exit(1);
  }

  const planned: PlannedRow[] = [];
  const alreadyOk: { id: string; name: string; originWarehouseId: string }[] = [];
  let scanned = 0;
  let lastDoc: QueryDocumentSnapshot | null = null;

  for (;;) {
    let q: Query = db
      .collection("products")
      .orderBy("__name__")
      .limit(PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      scanned += 1;
      const data = docSnap.data() || {};
      const price = catalogPrice(data);
      if (price == null || price > 1) continue;

      const oldId = normalizeWarehouseId(data.originWarehouseId);
      const oldLabel =
        typeof data.originWarehouseLabel === "string" && data.originWarehouseLabel.trim()
          ? data.originWarehouseLabel.trim()
          : null;
      const name = String(data.name || "Sans nom");
      const hub = oldId ? activeById.get(oldId) : undefined;

      if (hub) {
        alreadyOk.push({ id: docSnap.id, name, originWarehouseId: hub.id });
        continue;
      }

      planned.push({
        id: docSnap.id,
        name,
        price,
        oldOriginWarehouseId: oldId,
        oldOriginWarehouseLabel: oldLabel,
        newOriginWarehouseId: defaultHub.id,
        newOriginWarehouseLabel: defaultHub.label,
        reason: oldId ? "hub_invalide_ou_inactif" : "absent",
      });
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break;
  }

  console.log("");
  console.log(`Scannés : ${scanned}`);
  console.log(`Déjà OK (0/1 FCFA + hub actif) : ${alreadyOk.length}`);
  console.log(`À modifier : ${planned.length}`);
  console.log("");

  for (const row of planned) {
    console.log(
      `[${DRY_RUN ? "PLAN" : "SET"}] id=${row.id}  name=${JSON.stringify(row.name)}  price=${row.price}  ${row.oldOriginWarehouseId || "(vide)"} → ${row.newOriginWarehouseId} (${row.reason})`,
    );
  }

  if (!DRY_RUN && planned.length > 0) {
    for (let i = 0; i < planned.length; i += BATCH_SIZE) {
      const chunk = planned.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const row of chunk) {
        batch.update(db.collection("products").doc(row.id), {
          originWarehouseId: row.newOriginWarehouseId,
          originWarehouseLabel: row.newOriginWarehouseLabel,
          updatedAt: new Date(),
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
      ? "backfill-origin-warehouse.dry-run.json"
      : "backfill-origin-warehouse.execute.json",
  );
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        mode: DRY_RUN ? "dry-run" : "execute",
        defaultWarehouse: defaultHub,
        scanned,
        alreadyOkCount: alreadyOk.length,
        plannedCount: planned.length,
        planned,
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
