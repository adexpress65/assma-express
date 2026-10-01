/**
 * Migration products.stockQuantity (chiffre sentinelle) → unlimitedStock=true.
 *
 * Défaut : dry-run (aucune écriture).
 * Exécution réelle : node migrateUnlimitedStock.js --execute
 *
 * Règle :
 *   stockQuantity (sinon stock) > 1 000 000
 *   ET unlimitedStock n'est pas déjà true
 *   → update UNIQUEMENT { unlimitedStock: true }
 *   stockQuantity / variants / le reste du document : intouchés.
 */
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount = require("../assma-expresse-firebase-adminsdk-fbsvc-b87148844b.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const EXECUTE = process.argv.includes("--execute");
const THRESHOLD = 1_000_000;
const BATCH_SIZE = 400;

function readStock(data) {
  if (!data) return null;
  const raw = data.stockQuantity ?? data.stock;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function companyOf(data) {
  return {
    companyId: String(data.companyId || data.sellerId || data.supplierId || ""),
    companyName: String(
      data.companyName || data.supplier || data.sellerName || "(sans nom)",
    ).trim(),
  };
}

function variantCount(data) {
  return Array.isArray(data.variants) ? data.variants.length : 0;
}

async function main() {
  const db = admin.firestore();
  const snap = await db.collection("products").get();

  const planned = [];
  const alreadyUnlimited = [];
  let scanned = 0;

  snap.forEach((docSnap) => {
    scanned += 1;
    const data = docSnap.data() || {};
    const stock = readStock(data);
    if (stock == null || stock <= THRESHOLD) return;

    const { companyId, companyName } = companyOf(data);
    const row = {
      id: docSnap.id,
      name: String(data.name || "Sans nom"),
      companyId,
      companyName,
      stockQuantity: stock,
      variantCount: variantCount(data),
    };

    if (data.unlimitedStock === true) {
      alreadyUnlimited.push(row);
      return;
    }

    planned.push(row);
  });

  planned.sort(
    (a, b) =>
      b.stockQuantity - a.stockQuantity || a.name.localeCompare(b.name, "fr"),
  );

  console.log(
    EXECUTE
      ? "=== EXÉCUTION RÉELLE — écriture unlimitedStock=true uniquement ==="
      : "=== DRY-RUN — aucune écriture ===",
  );
  console.log(`Seuil : stockQuantity > ${THRESHOLD}`);
  console.log(`Produits scannés : ${scanned}`);
  console.log(`À migrer : ${planned.length}`);
  console.log(`Déjà unlimitedStock=true (au-dessus du seuil) : ${alreadyUnlimited.length}`);
  console.log("");

  for (const row of planned) {
    console.log(
      `[${EXECUTE ? "SET" : "PLAN"}] id=${row.id} stockQuantity=${row.stockQuantity} variants=${row.variantCount} company=${row.companyName} name=${row.name}`,
    );
  }

  for (const row of alreadyUnlimited) {
    console.log(
      `[SKIP-ALREADY] id=${row.id} stockQuantity=${row.stockQuantity} company=${row.companyName} name=${row.name}`,
    );
  }

  if (EXECUTE && planned.length > 0) {
    for (let i = 0; i < planned.length; i += BATCH_SIZE) {
      const chunk = planned.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const row of chunk) {
        batch.update(db.collection("products").doc(row.id), {
          unlimitedStock: true,
        });
      }
      await batch.commit();
      console.log(
        `[BATCH] ${Math.min(i + chunk.length, planned.length)}/${planned.length} documents mis à jour`,
      );
    }
  }

  const byCompany = {};
  for (const row of planned) {
    const key = row.companyId || "(sans companyId)";
    if (!byCompany[key]) {
      byCompany[key] = {
        companyId: key,
        companyName: row.companyName,
        count: 0,
        withVariants: 0,
      };
    }
    byCompany[key].count += 1;
    if (row.variantCount > 0) byCompany[key].withVariants += 1;
  }

  const companies = Object.values(byCompany).sort((a, b) => b.count - a.count);
  const withVariants = planned.filter((r) => r.variantCount > 0).length;

  const report = {
    mode: EXECUTE ? "execute" : "dry-run",
    threshold: THRESHOLD,
    scanned,
    plannedCount: planned.length,
    alreadyUnlimitedCount: alreadyUnlimited.length,
    plannedWithVariants: withVariants,
    companies,
    alreadyUnlimited,
    planned,
  };

  const outFile = path.join(
    __dirname,
    EXECUTE
      ? "migrateUnlimitedStock.execute.json"
      : "migrateUnlimitedStock.dry-run.json",
  );
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");

  console.log("\n=== RAPPORT ===");
  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        scanned,
        plannedCount: planned.length,
        alreadyUnlimitedCount: alreadyUnlimited.length,
        plannedWithVariants: withVariants,
        companies,
        alreadyUnlimited,
        export: outFile,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
