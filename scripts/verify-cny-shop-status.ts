/**
 * Lecture seule : état des prix pour une ou plusieurs boutiques.
 * Usage : npx tsx verify-cny-shop-status.ts --sellerId=A --sellerId=B
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { initAdmin } from "./lib/firebaseAdmin";
import { argValue, asFiniteNumber, sellerOf } from "./lib/cnyProductMigration";

const argv = process.argv.slice(2);
const sellerIds = argv
  .filter((a) => a.startsWith("--sellerId="))
  .map((a) => a.slice("--sellerId=".length).trim())
  .filter(Boolean);
const CJK_RE = /[\u4e00-\u9fff]/;

function collectSellerArgs(): string[] {
  if (sellerIds.length) return sellerIds;
  const one = argValue(argv, "--sellerId")?.trim();
  return one ? [one] : [];
}

async function loadSellerProducts(db: admin.firestore.Firestore, sellerId: string) {
  const snap = await db.collection("products").where("sellerId", "==", sellerId).get();
  if (!snap.empty) return snap.docs;
  const alt = await db.collection("products").where("companyId", "==", sellerId).get();
  return alt.docs;
}

async function main(): Promise<void> {
  const ids = collectSellerArgs();
  if (!ids.length) {
    console.error("Indique au moins --sellerId=XXXX");
    process.exit(1);
  }

  initAdmin();
  const db = admin.firestore();
  const report: Record<string, unknown> = { shops: [] };

  for (const sellerId of ids) {
    const docs = await loadSellerProducts(db, sellerId);
    const buckets = {
      total: docs.length,
      noCurrency: 0,
      cny: 0,
      xof: 0,
      other: 0,
      cnyHigh: 0,
      cnyNoChinese: 0,
      cnyWrong: 0,
      cnyKeep: 0,
      samplesRolledBackLike: [] as unknown[],
      samplesCnyKeep: [] as unknown[],
      samplesCnyWrong: [] as unknown[],
    };

    let companyName = "";
    for (const doc of docs) {
      const data = doc.data() || {};
      if (!companyName) companyName = sellerOf(data).companyName;
      const cur =
        typeof data.priceCurrency === "string" ? data.priceCurrency.trim().toUpperCase() : "";
      const name = String(data.name || "");
      const price = asFiniteNumber(data.price) ?? 0;
      const priceXOF = asFiniteNumber(data.priceXOF) ?? price;
      const priceOriginal = asFiniteNumber(data.priceOriginal);
      const row = {
        id: doc.id,
        name,
        price,
        priceOriginal,
        priceXOF,
        priceCurrency: cur || null,
      };

      if (!cur) {
        buckets.noCurrency += 1;
        continue;
      }
      if (cur === "XOF") {
        buckets.xof += 1;
        continue;
      }
      if (cur !== "CNY") {
        buckets.other += 1;
        continue;
      }

      buckets.cny += 1;
      const noChinese = !CJK_RE.test(name);
      const high = priceXOF > 50_000;
      if (noChinese || high) {
        buckets.cnyWrong += 1;
        if (high) buckets.cnyHigh += 1;
        if (noChinese) buckets.cnyNoChinese += 1;
        if (buckets.samplesCnyWrong.length < 8) buckets.samplesCnyWrong.push(row);
      } else {
        buckets.cnyKeep += 1;
        if (buckets.samplesCnyKeep.length < 8) buckets.samplesCnyKeep.push(row);
      }
    }

    const shop = { sellerId, companyName, ...buckets };
    (report.shops as unknown[]).push(shop);
    console.log(`=== ${companyName || "(?)"}  sellerId=${sellerId} ===`);
    console.log(`total=${buckets.total}  sans currency=${buckets.noCurrency}  CNY=${buckets.cny}  XOF=${buckets.xof}  autre=${buckets.other}`);
    console.log(`CNY encore à rollback=${buckets.cnyWrong}  (sans chinois=${buckets.cnyNoChinese}, >50k=${buckets.cnyHigh})  CNY légitimes=${buckets.cnyKeep}`);
    for (const s of buckets.samplesCnyWrong) {
      const r = s as { id: string; name: string; price: number; priceOriginal: number | null };
      console.log(`[WRONG] id=${r.id}  price=${r.price}  priceOriginal=${r.priceOriginal}  name=${r.name}`);
    }
    for (const s of buckets.samplesCnyKeep) {
      const r = s as { id: string; name: string; price: number; priceOriginal: number | null };
      console.log(`[KEEP] id=${r.id}  price=${r.price}  priceOriginal=${r.priceOriginal}  name=${r.name}`);
    }
    console.log("");
  }

  const out = join(dirname(fileURLToPath(import.meta.url)), "verify-cny-shop-status.json");
  writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
  console.log("Rapport :", out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
