/**
 * Migration CNY → XOF pour UN sellerId.
 * Dry-run par défaut. Écriture : --execute
 * Sans --force : ignore price >= 2000 (déjà FCFA probable).
 */
import { writeFileSync, readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const DRY_RUN = !argv.includes("--execute");
const FORCE = argv.includes("--force");
const SAFE = argv.includes("--safe");
const RATE = 83.82;
const MAX_PRICE = 2000;
const SAFE_FR_MAX = 200;
const BATCH_SIZE = 400;
const CJK_RE = /[\u4e00-\u9fff]/;

const sellerId = (argv.find((a) => a.startsWith("--sellerId=")) || "").slice("--sellerId=".length).trim();
if (!sellerId) {
  console.error("Indique --sellerId=XXXX");
  process.exit(1);
}

const credPath = [process.env.GOOGLE_APPLICATION_CREDENTIALS, join(here, "serviceAccount.json")].find(
  (p) => p && existsSync(p),
);
if (!credPath) {
  console.error("serviceAccount.json introuvable");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(readFileSync(credPath, "utf8"))) });
console.log("Admin SDK :", credPath);
console.log(DRY_RUN ? "=== DRY-RUN — aucune écriture ===" : "=== EXÉCUTION — écriture batch ===");
console.log(
  `sellerId=${sellerId}  rate=${RATE}  force=${FORCE}  safe=${SAFE}  skip si price>=${MAX_PRICE} (sauf --force)`,
);
if (SAFE) {
  console.log(
    `Mode --safe : convertit nom chinois, ou prix < ${SAFE_FR_MAX} (titres FR déjà FCFA exclus)`,
  );
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function looksLikeCnyAmount(amount, refPrice) {
  if (amount <= 0) return false;
  return amount <= Math.max(MAX_PRICE * 2, refPrice * 20);
}

function buildCnyPatch(data) {
  const oldPrice = num(data.price) ?? 0;
  const priceXOF = Math.round(oldPrice * RATE);
  const oldCompare = num(data.originalPrice);
  const patch = {
    priceOriginal: oldPrice,
    priceCurrency: "CNY",
    priceXOF,
    price: priceXOF,
    currency: "XOF",
    exchangeRateUsed: RATE,
  };
  if (oldCompare != null && looksLikeCnyAmount(oldCompare, oldPrice)) {
    patch.originalPriceOriginal = oldCompare;
    patch.originalPrice = Math.round(oldCompare * RATE);
  }
  let variantConverted = 0;
  if (Array.isArray(data.variants)) {
    patch.variants = data.variants.map((v) => {
      const entered = num(v.priceOriginal) ?? num(v.price) ?? 0;
      if (!looksLikeCnyAmount(entered, oldPrice)) return v;
      variantConverted += 1;
      return { ...v, priceOriginal: entered, price: Math.round(entered * RATE) };
    });
  }
  return { patch, oldPrice, priceXOF, variantConverted };
}

const db = admin.firestore();
let snap = await db.collection("products").where("sellerId", "==", sellerId).get();
if (snap.empty) snap = await db.collection("products").where("companyId", "==", sellerId).get();
console.log(`Produits matching : ${snap.size}`);

const planned = [];
const skipped = [];

for (const doc of snap.docs) {
  const data = doc.data() || {};
  const cur = typeof data.priceCurrency === "string" ? data.priceCurrency.trim().toUpperCase() : "";
  const oldPrice = num(data.price) ?? 0;
  const name = String(data.name || "Sans nom");

  if (cur === "CNY" && !FORCE) {
    skipped.push({ id: doc.id, reason: "déjà CNY", name, oldPrice });
    continue;
  }
  if (cur && cur !== "CNY" && !FORCE) {
    skipped.push({ id: doc.id, reason: `priceCurrency=${cur}`, name, oldPrice });
    continue;
  }
  if (oldPrice <= 0) {
    skipped.push({ id: doc.id, reason: "price <= 0", name, oldPrice });
    continue;
  }
  if (!FORCE && oldPrice >= MAX_PRICE) {
    skipped.push({ id: doc.id, reason: `price ${oldPrice} >= ${MAX_PRICE}`, name, oldPrice });
    continue;
  }
  const hasChinese = CJK_RE.test(name);
  if (SAFE && !hasChinese && oldPrice >= SAFE_FR_MAX) {
    skipped.push({
      id: doc.id,
      reason: `titre FR / sans chinois et price ${oldPrice} >= ${SAFE_FR_MAX} (déjà FCFA)`,
      name,
      oldPrice,
    });
    continue;
  }

  const built = buildCnyPatch(data);
  planned.push({
    id: doc.id,
    name,
    oldPrice: built.oldPrice,
    priceXOF: built.priceXOF,
    variantConverted: built.variantConverted,
    hasChinese,
    patch: built.patch,
  });
}

for (const row of planned) {
  console.log(
    `[${DRY_RUN ? "PLAN" : "SET"}] ${row.oldPrice} ¥ → ${row.priceXOF} F  zh=${row.hasChinese}  v=${row.variantConverted}  id=${row.id}  ${row.name.slice(0, 60)}`,
  );
}
console.log(`Ignorés : ${skipped.length}`);
for (const s of skipped.slice(0, 15)) {
  console.log(`[SKIP] id=${s.id}  ${s.reason}  ${String(s.name).slice(0, 50)}`);
}
if (skipped.length > 15) console.log(`[SKIP] … +${skipped.length - 15}`);

if (!DRY_RUN && planned.length > 0) {
  for (let i = 0; i < planned.length; i += BATCH_SIZE) {
    const chunk = planned.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const row of chunk) {
      batch.update(db.collection("products").doc(row.id), { ...row.patch, updatedAt: new Date() });
    }
    await batch.commit();
    console.log(`[BATCH] ${Math.min(i + chunk.length, planned.length)}/${planned.length}`);
  }
}

const out = join(
  here,
  DRY_RUN ? `migrate-cny-${sellerId.slice(0, 8)}.dry-run.json` : `migrate-cny-${sellerId.slice(0, 8)}.execute.json`,
);
writeFileSync(
  out,
  JSON.stringify(
    {
      mode: DRY_RUN ? "dry-run" : "execute",
      sellerId,
      rate: RATE,
      plannedCount: planned.length,
      skippedCount: skipped.length,
      planned: planned.map(({ patch, ...rest }) => rest),
      skipped,
    },
    null,
    2,
  ),
  "utf8",
);
console.log(`À migrer : ${planned.length}  |  ignorés : ${skipped.length}`);
console.log("Rapport :", out);
process.exit(0);
