import { writeFileSync, readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const here = dirname(fileURLToPath(import.meta.url));
const sellerIds = process.argv
  .slice(2)
  .filter((a) => a.startsWith("--sellerId="))
  .map((a) => a.slice("--sellerId=".length).trim())
  .filter(Boolean);

if (!sellerIds.length) {
  console.error("Indique au moins --sellerId=XXXX");
  process.exit(1);
}

const credPath = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  join(here, "serviceAccount.json"),
  join(here, "serviceAccountKey.json"),
].find((p) => p && existsSync(p));

if (!credPath) {
  console.error("serviceAccount.json introuvable");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(credPath, "utf8"))) });
console.log("Admin SDK :", credPath);

const CJK_RE = /[\u4e00-\u9fff]/;
const db = admin.firestore();
const shops = [];

for (const sellerId of sellerIds) {
  let snap = await db.collection("products").where("sellerId", "==", sellerId).get();
  if (snap.empty) snap = await db.collection("products").where("companyId", "==", sellerId).get();

  const buckets = {
    sellerId,
    companyName: "",
    total: snap.size,
    noCurrency: 0,
    cny: 0,
    xof: 0,
    other: 0,
    cnyWrong: 0,
    cnyKeep: 0,
    samplesWrong: [],
    samplesKeep: [],
    samplesLegacy: [],
  };

  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (!buckets.companyName) {
      buckets.companyName = String(data.companyName || data.supplier || data.sellerName || "");
    }
    const cur = typeof data.priceCurrency === "string" ? data.priceCurrency.trim().toUpperCase() : "";
    const name = String(data.name || "");
    const price = Number(data.price);
    const priceXOF = Number.isFinite(Number(data.priceXOF)) ? Number(data.priceXOF) : price;
    const priceOriginal = Number.isFinite(Number(data.priceOriginal)) ? Number(data.priceOriginal) : null;
    const row = { id: doc.id, name, price, priceOriginal, priceXOF, priceCurrency: cur || null };

    if (!cur) {
      buckets.noCurrency += 1;
      if (buckets.samplesLegacy.length < 5) buckets.samplesLegacy.push(row);
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
    const wrong = !CJK_RE.test(name) || priceXOF > 50000;
    if (wrong) {
      buckets.cnyWrong += 1;
      if (buckets.samplesWrong.length < 8) buckets.samplesWrong.push(row);
    } else {
      buckets.cnyKeep += 1;
      if (buckets.samplesKeep.length < 8) buckets.samplesKeep.push(row);
    }
  }

  shops.push(buckets);
  console.log(`=== ${buckets.companyName || "?"}  ${sellerId} ===`);
  console.log(
    `total=${buckets.total}  sans currency=${buckets.noCurrency}  CNY=${buckets.cny}  XOF=${buckets.xof}  autre=${buckets.other}`,
  );
  console.log(`CNY encore à rollback=${buckets.cnyWrong}  CNY légitimes=${buckets.cnyKeep}`);
  for (const r of buckets.samplesWrong) {
    console.log(`[WRONG] id=${r.id}  price=${r.price}  orig=${r.priceOriginal}  name=${r.name}`);
  }
  for (const r of buckets.samplesKeep) {
    console.log(`[KEEP] id=${r.id}  price=${r.price}  orig=${r.priceOriginal}  name=${r.name}`);
  }
  for (const r of buckets.samplesLegacy) {
    console.log(`[LEGACY] id=${r.id}  price=${r.price}  name=${r.name}`);
  }
  console.log("");
}

const out = join(here, "verify-cny-shop-status.json");
writeFileSync(out, JSON.stringify({ shops }, null, 2), "utf8");
console.log("Rapport :", out);
process.exit(0);
