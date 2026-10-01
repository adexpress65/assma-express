/**
 * Rollback des produits déjà en FCFA convertis par erreur en CNY.
 *
 * DRY-RUN par défaut. Pour écrire :
 *   npx tsx rollback-wrong-cny-products.ts --sellerId=XXXX --execute
 *
 * Cible : sellerId + priceCurrency=CNY + (nom anglais / sans chinois OU priceXOF > 50000)
 *
 * Restaure price = priceOriginal, currency = XOF, et supprime les champs de conversion.
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { initAdmin } from "./lib/firebaseAdmin";
import {
  BATCH_SIZE,
  argValue,
  asFiniteNumber,
  sellerOf,
} from "./lib/cnyProductMigration";

const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes("--execute");
const FILTER_SELLER = argValue(argv, "--sellerId")?.trim() || "";
const PRICE_XOF_LIMIT = 50_000;
const CJK_RE = /[\u4e00-\u9fff]/;
const SHOE_RE = /shoe/i;

function wrongConversionReasons(name: string, priceXOF: number): string[] {
  const reasons: string[] = [];
  if (SHOE_RE.test(name)) reasons.push('name contient "Shoe"');
  if (!CJK_RE.test(name)) reasons.push("name sans caractère chinois");
  if (priceXOF > PRICE_XOF_LIMIT) reasons.push(`priceXOF ${priceXOF} > ${PRICE_XOF_LIMIT}`);
  return reasons;
}

function restoreVariants(variants: unknown): { variants?: unknown[]; restored: number } {
  if (!Array.isArray(variants)) return { restored: 0 };
  let restored = 0;
  const next = variants.map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const v = raw as Record<string, unknown>;
    const original = asFiniteNumber(v.priceOriginal);
    if (original == null) return v;
    restored += 1;
    const { priceOriginal: _drop, ...rest } = v;
    return { ...rest, price: original };
  });
  return { variants: next, restored };
}

function buildRollbackPatch(data: Record<string, unknown>): {
  patch: Record<string, unknown>;
  priceOriginal: number;
  priceXOF: number;
  variantsRestored: number;
} | null {
  const priceOriginal = asFiniteNumber(data.priceOriginal);
  if (priceOriginal == null || priceOriginal <= 0) return null;

  const priceXOF = asFiniteNumber(data.priceXOF) ?? asFiniteNumber(data.price) ?? 0;
  const del = admin.firestore.FieldValue.delete();
  const { variants, restored } = restoreVariants(data.variants);

  const patch: Record<string, unknown> = {
    price: priceOriginal,
    currency: "XOF",
    priceOriginal: del,
    priceCurrency: del,
    priceXOF: del,
    exchangeRateUsed: del,
  };

  const originalPriceOriginal = asFiniteNumber(data.originalPriceOriginal);
  if (originalPriceOriginal != null) {
    patch.originalPrice = originalPriceOriginal;
    patch.originalPriceOriginal = del;
  }

  if (variants) patch.variants = variants;

  return { patch, priceOriginal, priceXOF, variantsRestored: restored };
}

async function main(): Promise<void> {
  if (!FILTER_SELLER) {
    console.error("Indique --sellerId=XXXX (refus de rollback sans filtre boutique).");
    process.exit(1);
  }

  initAdmin();
  const db = admin.firestore();

  console.log(
    DRY_RUN
      ? "=== DRY-RUN rollback — aucune écriture Firestore ==="
      : "=== EXÉCUTION rollback — écriture batch ===",
  );
  console.log(`Filtre sellerId : ${FILTER_SELLER}`);
  console.log(`Critères : priceCurrency=CNY + (Shoe / sans chinois OU priceXOF > ${PRICE_XOF_LIMIT})`);
  console.log("");

  type Plan = {
    id: string;
    name: string;
    sellerId: string;
    priceOriginal: number;
    priceXOF: number;
    reasons: string[];
    variantsRestored: number;
    patch: Record<string, unknown>;
  };

  const planned: Plan[] = [];
  const skipped: { id: string; reason: string }[] = [];

  const snap = await db.collection("products").where("sellerId", "==", FILTER_SELLER).get();
  const docs =
    snap.empty
      ? (await db.collection("products").where("companyId", "==", FILTER_SELLER).get()).docs
      : snap.docs;

  console.log(`Produits matching seller/company : ${docs.length}`);

  for (const docSnap of docs) {
    const data = (docSnap.data() || {}) as Record<string, unknown>;
    const idsSeller = sellerOf(data);
    const priceCurrency =
      typeof data.priceCurrency === "string" ? data.priceCurrency.trim().toUpperCase() : "";
    const name = String(data.name || "Sans nom");
    const priceXOF = asFiniteNumber(data.priceXOF) ?? asFiniteNumber(data.price) ?? 0;

    if (priceCurrency !== "CNY") {
      skipped.push({ id: docSnap.id, reason: priceCurrency ? `priceCurrency=${priceCurrency}` : "pas de priceCurrency=CNY" });
      continue;
    }

    const reasons = wrongConversionReasons(name, priceXOF);
    if (reasons.length === 0) {
      skipped.push({ id: docSnap.id, reason: "CNY légitime (nom chinois et priceXOF ≤ 50000)" });
      continue;
    }

    const built = buildRollbackPatch(data);
    if (!built) {
      skipped.push({ id: docSnap.id, reason: "priceOriginal manquant — rollback impossible" });
      continue;
    }

    planned.push({
      id: docSnap.id,
      name,
      sellerId: idsSeller.sellerId,
      priceOriginal: built.priceOriginal,
      priceXOF: built.priceXOF,
      reasons,
      variantsRestored: built.variantsRestored,
      patch: built.patch,
    });
  }

  for (const row of planned) {
    console.log(
      `[${DRY_RUN ? "PLAN" : "SET"}] id=${row.id}  ${row.priceXOF} XOF → ${row.priceOriginal} (priceOriginal)  variants=${row.variantsRestored}  ${row.reasons.join(" | ")}  name=${row.name}`,
    );
  }

  if (skipped.length) {
    console.log("");
    console.log(`Ignorés : ${skipped.length} (détail dans le rapport JSON)`);
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
      console.log(`[BATCH] ${Math.min(i + chunk.length, planned.length)}/${planned.length} restaurés`);
    }
  }

  const report = {
    mode: DRY_RUN ? "dry-run" : "execute",
    sellerId: FILTER_SELLER,
    plannedCount: planned.length,
    skippedCount: skipped.length,
    planned: planned.map(({ patch: _p, ...rest }) => rest),
    skipped,
  };
  const outFile = join(
    dirname(fileURLToPath(import.meta.url)),
    DRY_RUN ? "rollback-wrong-cny-products.dry-run.json" : "rollback-wrong-cny-products.execute.json",
  );
  writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");

  console.log("");
  console.log(`À restaurer : ${planned.length}  |  ignorés : ${skipped.length}`);
  console.log("Rapport :", outFile);
  if (DRY_RUN && planned.length > 0) {
    console.log("Pour écrire réellement, relance avec --execute");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
