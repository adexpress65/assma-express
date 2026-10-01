/**
 * Audit lecture seule — produits dont le `price` a pu être saisi en CNY
 * avant le modèle multi-devise (pas de `priceCurrency`).
 *
 * Usage (depuis assma/scripts) :
 *   npx tsx audit-cny-products.ts
 *   npx tsx audit-cny-products.ts --max-price=2000
 *   npx tsx audit-cny-products.ts --sellerId=XXXX
 *   npx tsx audit-cny-products.ts --companyId=XXXX
 *
 * N'écrit rien dans Firestore.
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { initAdmin } from "./lib/firebaseAdmin";
import type { DocumentData } from "firebase-admin/firestore";
import {
  DEFAULT_MAX_XOF_SUSPECT,
  argValue,
  asFiniteNumber,
  companyOriginBlob,
  looksChineseOrigin,
  isZeroDollarsShopName,
  parseNumberArg,
  sellerOf,
  type ProductPriceRow,
} from "./lib/cnyProductMigration";

const argv = process.argv.slice(2);
const MAX_PRICE = parseNumberArg(argv, "--max-price", DEFAULT_MAX_XOF_SUSPECT);
const FILTER_SELLER = argValue(argv, "--sellerId")?.trim() || "";
const FILTER_COMPANY = argValue(argv, "--companyId")?.trim() || "";
const PRINT_ALL_LEGACY = argv.includes("--all-legacy");

function rowFrom(
  id: string,
  data: DocumentData,
  reasons: string[],
): ProductPriceRow {
  const ids = sellerOf(data);
  return {
    id,
    name: String(data.name || "Sans nom"),
    sellerId: ids.sellerId,
    companyId: ids.companyId,
    companyName: ids.companyName,
    price: asFiniteNumber(data.price) ?? 0,
    basePrice: asFiniteNumber(data.basePrice),
    originalPrice: asFiniteNumber(data.originalPrice),
    currency: String(data.currency || ""),
    priceCurrency: typeof data.priceCurrency === "string" ? data.priceCurrency : null,
    priceOriginal: asFiniteNumber(data.priceOriginal),
    priceXOF: asFiniteNumber(data.priceXOF),
    variantCount: Array.isArray(data.variants) ? data.variants.length : 0,
    reasons,
  };
}

function printRow(tag: string, row: ProductPriceRow): void {
  console.log(
    `[${tag}] id=${row.id}  price=${row.price}  sellerId=${row.sellerId || "—"}  company=${row.companyName}  name=${row.name}  reasons=${row.reasons.join(",")}`,
  );
}

async function main(): Promise<void> {
  initAdmin();
  const db = admin.firestore();

  const companiesSnap = await db.collection("companies").get();
  const companyById = new Map<string, DocumentData>();
  companiesSnap.forEach((docSnap) => companyById.set(docSnap.id, docSnap.data() || {}));

  const productsSnap = await db.collection("products").get();

  const missingCurrency: ProductPriceRow[] = [];
  const suspects: ProductPriceRow[] = [];
  const alreadyCny: ProductPriceRow[] = [];
  const alreadyOther: ProductPriceRow[] = [];
  let scanned = 0;

  productsSnap.forEach((docSnap) => {
    scanned += 1;
    const data = docSnap.data() || {};
    const ids = sellerOf(data);

    if (FILTER_SELLER && ids.sellerId !== FILTER_SELLER && ids.companyId !== FILTER_SELLER) {
      return;
    }
    if (FILTER_COMPANY && ids.companyId !== FILTER_COMPANY) {
      return;
    }

    const priceCurrency =
      typeof data.priceCurrency === "string" ? data.priceCurrency.trim().toUpperCase() : "";

    if (priceCurrency === "CNY") {
      alreadyCny.push(rowFrom(docSnap.id, data, ["priceCurrency=CNY"]));
      return;
    }
    if (priceCurrency) {
      alreadyOther.push(rowFrom(docSnap.id, data, [`priceCurrency=${priceCurrency}`]));
      return;
    }

    const price = asFiniteNumber(data.price) ?? 0;
    const reasons: string[] = ["no-priceCurrency"];
    const company = companyById.get(ids.companyId);
    const originText = `${ids.companyName} ${companyOriginBlob(company)}`;

    if (price > 0 && price < MAX_PRICE) {
      reasons.push(`price<${MAX_PRICE}`);
    }
    if (looksChineseOrigin(originText) || looksChineseOrigin(String(data.name || ""))) {
      reasons.push("china-origin");
    }
    if (isZeroDollarsShopName(ids.companyName)) {
      reasons.push("zero-dollars");
    }
    if (FILTER_SELLER) {
      reasons.push("filter-sellerId");
    }
    if (FILTER_COMPANY) {
      reasons.push("filter-companyId");
    }

    const row = rowFrom(docSnap.id, data, reasons);
    missingCurrency.push(row);

    const china = reasons.includes("china-origin");
    const zeroDollars = reasons.includes("zero-dollars");
    const lowPrice = price > 1 && price < MAX_PRICE;
    const suspect =
      !zeroDollars &&
      (Boolean(FILTER_SELLER) ||
        Boolean(FILTER_COMPANY) ||
        (china && lowPrice) ||
        (china && price > 1));
    if (suspect) suspects.push(row);
  });

  suspects.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, "fr"));
  missingCurrency.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, "fr"));

  console.log("=== AUDIT CNY — lecture seule, aucune écriture ===");
  console.log(`Produits scannés : ${scanned}`);
  console.log(`Sans priceCurrency : ${missingCurrency.length}`);
  console.log(`Suspects (à examiner) : ${suspects.length}`);
  console.log(`Déjà priceCurrency=CNY : ${alreadyCny.length}`);
  console.log(`Autre priceCurrency : ${alreadyOther.length}`);
  console.log(`Seuil prix suspect : price < ${MAX_PRICE} (FCFA trop bas pour un vrai catalogue)`);
  if (FILTER_SELLER) console.log(`Filtre sellerId : ${FILTER_SELLER}`);
  if (FILTER_COMPANY) console.log(`Filtre companyId : ${FILTER_COMPANY}`);
  console.log("");

  const bySeller = new Map<string, { sellerId: string; companyName: string; count: number; min: number; max: number }>();
  for (const row of suspects) {
    const key = row.sellerId || row.companyId || "?";
    const cur = bySeller.get(key);
    if (!cur) {
      bySeller.set(key, {
        sellerId: key,
        companyName: row.companyName,
        count: 1,
        min: row.price,
        max: row.price,
      });
    } else {
      cur.count += 1;
      cur.min = Math.min(cur.min, row.price);
      cur.max = Math.max(cur.max, row.price);
    }
  }
  console.log("--- PAR BOUTIQUE (suspects) ---");
  const sellers = [...bySeller.values()].sort((a, b) => b.count - a.count);
  if (sellers.length === 0) console.log("(aucune)");
  for (const s of sellers) {
    console.log(
      `sellerId=${s.sellerId}  n=${s.count}  price ${s.min}–${s.max}  company=${s.companyName}`,
    );
  }
  console.log("");

  console.log("--- SUSPECTS ---");
  if (suspects.length === 0) {
    console.log("(aucun)");
  } else {
    for (const row of suspects) printRow("SUSPECT", row);
  }

  if (PRINT_ALL_LEGACY) {
    console.log("");
    console.log("--- TOUS SANS priceCurrency ---");
    if (missingCurrency.length === 0) {
      console.log("(aucun)");
    } else {
      for (const row of missingCurrency) printRow("LEGACY", row);
    }
  } else {
    console.log("");
    console.log(`(liste complète des ${missingCurrency.length} sans priceCurrency : --all-legacy)`);
  }

  if (alreadyCny.length > 0) {
    console.log("");
    console.log("--- DÉJÀ CNY (non à migrer) ---");
    for (const row of alreadyCny) printRow("CNY", row);
  }

  const report = {
    scanned,
    maxPrice: MAX_PRICE,
    filterSeller: FILTER_SELLER || null,
    filterCompany: FILTER_COMPANY || null,
    missingCurrencyCount: missingCurrency.length,
    suspectCount: suspects.length,
    alreadyCnyCount: alreadyCny.length,
    suspects,
    missingCurrency,
    alreadyCny,
  };

  const outFile = join(dirname(fileURLToPath(import.meta.url)), "audit-cny-products.report.json");
  writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");
  console.log("");
  console.log("Rapport JSON :", outFile);
  console.log("");
  console.log("Prochaine étape (dry-run) :");
  console.log("  npx tsx migrate-cny-products.ts --sellerId=SELLER_ID");
  console.log("  npx tsx migrate-cny-products.ts --ids=id1,id2,id3");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
