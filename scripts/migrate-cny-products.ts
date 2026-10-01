/**
 * Migration sécurisée : anciens `price` saisis en CNY → modèle multi-devise.
 *
 * DRY-RUN par défaut (aucune écriture). Pour écrire :
 *   npx tsx migrate-cny-products.ts --ids=id1,id2 --execute
 *
 * Usage (depuis assma/scripts) :
 *   npx tsx migrate-cny-products.ts --sellerId=XXXX
 *   npx tsx migrate-cny-products.ts --ids=abc,def
 *   npx tsx migrate-cny-products.ts --ids-file=./cny-ids.txt
 *   npx tsx migrate-cny-products.ts --ids=abc --execute
 *
 * Conversion (par produit) :
 *   priceOriginal  = ancien price
 *   priceCurrency  = "CNY"
 *   priceXOF       = Math.round(ancien price * rate)
 *   price          = priceXOF
 *   currency       = "XOF"
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { initAdmin } from "./lib/firebaseAdmin";
import {
  BATCH_SIZE,
  DEFAULT_MAX_XOF_SUSPECT,
  argValue,
  asFiniteNumber,
  buildCnyPatch,
  loadExchangeRateCny,
  parseIdList,
  parseNumberArg,
  sellerOf,
  isZeroDollarsShopName,
} from "./lib/cnyProductMigration";

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes("--execute");
const FORCE = argv.includes("--force");
const MAX_PRICE = parseNumberArg(argv, "--max-price", DEFAULT_MAX_XOF_SUSPECT);
const FILTER_SELLER = argValue(argv, "--sellerId")?.trim() || "";
const RATE_OVERRIDE = argValue(argv, "--rate") ? Number(argValue(argv, "--rate")) : undefined;

function loadIds(): string[] {
  const fromArg = parseIdList(argValue(argv, "--ids"));
  const file = argValue(argv, "--ids-file")?.trim();
  if (!file) return fromArg;
  const raw = readFileSync(file, "utf8");
  const fromFile = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  return [...new Set([...fromArg, ...fromFile])];
}

async function main(): Promise<void> {
  const ids = loadIds();
  if (ids.length === 0 && !FILTER_SELLER) {
    console.error(
      "Indique --ids=id1,id2 et/ou --sellerId=XXXX (refus de tout migrer sans filtre).",
    );
    process.exit(1);
  }

  initAdmin();
  const db = admin.firestore();

  const { rate, source } = await loadExchangeRateCny(db, RATE_OVERRIDE);

  console.log(
    DRY_RUN
      ? "=== DRY-RUN — aucune écriture Firestore ==="
      : "=== EXÉCUTION — écriture batch ===",
  );
  console.log(`Taux CNY → XOF : ${rate} (${source})`);
  console.log(`Seuil skip (sans --force) : price >= ${MAX_PRICE}`);
  if (FILTER_SELLER) console.log(`Filtre sellerId : ${FILTER_SELLER}`);
  if (ids.length) console.log(`IDs explicites : ${ids.length}`);
  console.log("");

  type Plan = {
    id: string;
    name: string;
    sellerId: string;
    oldPrice: number;
    priceXOF: number;
    variantConverted: number;
    patch: Record<string, unknown>;
  };

  const planned: Plan[] = [];
  const skipped: { id: string; reason: string }[] = [];

  const consider = async (id: string) => {
    const ref = db.collection("products").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      skipped.push({ id, reason: "introuvable" });
      return;
    }
    const data = snap.data() || {};
    const idsSeller = sellerOf(data);
    const priceCurrency =
      typeof data.priceCurrency === "string" ? data.priceCurrency.trim().toUpperCase() : "";
    const oldPrice = asFiniteNumber(data.price) ?? 0;

    if (priceCurrency === "CNY" && !FORCE) {
      skipped.push({ id, reason: "déjà priceCurrency=CNY" });
      return;
    }
    if (priceCurrency && priceCurrency !== "CNY" && !FORCE) {
      skipped.push({ id, reason: `priceCurrency=${priceCurrency}` });
      return;
    }
    if (oldPrice <= 0) {
      skipped.push({ id, reason: "price <= 0" });
      return;
    }
    if (!FORCE && (isZeroDollarsShopName(idsSeller.companyName) || oldPrice <= 1)) {
      skipped.push({ id, reason: "boutique Zéro Dollars / price<=1 — ne pas convertir" });
      return;
    }
    if (!FORCE && ids.length === 0 && oldPrice >= MAX_PRICE) {
      skipped.push({ id, reason: `price ${oldPrice} >= ${MAX_PRICE} (passe --force si CNY)` });
      return;
    }

    const { patch, priceXOF, variantConverted } = buildCnyPatch(data, rate, MAX_PRICE);
    planned.push({
      id,
      name: String(data.name || "Sans nom"),
      sellerId: idsSeller.sellerId,
      oldPrice,
      priceXOF,
      variantConverted,
      patch,
    });
  };

  if (ids.length > 0) {
    for (const id of ids) {
      await consider(id);
    }
  } else {
    const snap = await db.collection("products").where("sellerId", "==", FILTER_SELLER).get();
    const alt =
      snap.empty && FILTER_SELLER
        ? await db.collection("products").where("companyId", "==", FILTER_SELLER).get()
        : snap;
    console.log(`Produits matching seller/company : ${alt.size}`);
    for (const docSnap of alt.docs) {
      await consider(docSnap.id);
    }
  }

  for (const row of planned) {
    console.log(
      `[${DRY_RUN ? "PLAN" : "SET"}] id=${row.id}  ${row.oldPrice} CNY → ${row.priceXOF} XOF  variants=${row.variantConverted}  sellerId=${row.sellerId}  name=${row.name}`,
    );
  }

  if (skipped.length) {
    console.log("");
    for (const s of skipped) {
      console.log(`[SKIP] id=${s.id}  ${s.reason}`);
    }
  }

  if (!DRY_RUN && planned.length > 0) {
    for (let i = 0; i < planned.length; i += BATCH_SIZE) {
      const chunk = planned.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const row of chunk) {
        batch.update(db.collection("products").doc(row.id), {
          ...row.patch,
          updatedAt: new Date(),
        });
      }
      await batch.commit();
      console.log(`[BATCH] ${Math.min(i + chunk.length, planned.length)}/${planned.length} mis à jour`);
    }
  }

  const report = {
    mode: DRY_RUN ? "dry-run" : "execute",
    rate,
    source,
    plannedCount: planned.length,
    skippedCount: skipped.length,
    planned: planned.map(({ patch: _p, ...rest }) => rest),
    skipped,
  };
  const outFile = join(
    dirname(fileURLToPath(import.meta.url)),
    DRY_RUN ? "migrate-cny-products.dry-run.json" : "migrate-cny-products.execute.json",
  );
  writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log(`À migrer : ${planned.length}  |  ignorés : ${skipped.length}`);
  console.log("Rapport :", outFile);
  if (DRY_RUN && planned.length > 0) {
    console.log("Pour écrire réellement, relance avec --execute");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
