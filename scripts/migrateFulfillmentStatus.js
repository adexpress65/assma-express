/**
 * Migration orders : pose fulfillmentStatus à partir de l'ancien status mixte.
 *
 * Défaut : dry-run (aucune écriture).
 * Exécution réelle : node migrateFulfillmentStatus.js --execute
 *
 * Mapping (approximation sur l'historique) :
 *   paid | confirmed  → prise_en_charge
 *   processing        → preparation
 *   shipped           → arrivee_entrepot
 *   delivered         → termine
 *   pending | cancelled | failed | canceled : aucun fulfillmentStatus
 *
 * Garde-fou paiement : n'écrit QUE si paymentStatus (ou paymentState /
 * payment.status) est payé / confirmé. Les commandes mappables mais
 * non payées restent sans fulfillmentStatus.
 *
 * N'écrit QUE { fulfillmentStatus } (+ updatedAt). Ne touche pas à status.
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
const BATCH_SIZE = 400;

const CHAIN = [
  "prise_en_charge",
  "preparation",
  "route_entrepot",
  "transit_international",
  "arrivee_entrepot",
  "termine",
];

const LEGACY_MAP = {
  paid: "prise_en_charge",
  confirmed: "prise_en_charge",
  processing: "preparation",
  shipped: "arrivee_entrepot",
  delivered: "termine",
};

const SKIP_STATUSES = new Set([
  "pending",
  "cancelled",
  "canceled",
  "failed",
  "payment_failed",
  "payment_cancelled",
]);

const PAID_EQUIVALENTS = new Set([
  "paid",
  "confirmed",
  "success",
  "succeeded",
  "completed",
  "captured",
  "paid_out",
]);

function isFulfillmentStatus(value) {
  return CHAIN.includes(String(value || ""));
}

function proposedFromStatus(status) {
  const s = String(status || "").toLowerCase().trim();
  if (!s) return { kind: "skip-empty", proposed: null };
  if (SKIP_STATUSES.has(s)) return { kind: "skip-payment", proposed: null };
  if (LEGACY_MAP[s]) return { kind: "map", proposed: LEGACY_MAP[s] };
  return { kind: "skip-unmapped", proposed: null };
}

function hasCustomerReview(data) {
  const cr = data && data.customerReview;
  return !!(cr && typeof cr === "object" && Number(cr.rating) > 0);
}

function isPaymentConfirmed(paymentStatus) {
  return PAID_EQUIVALENTS.has(String(paymentStatus || "").toLowerCase().trim());
}

function readAmount(data) {
  const n = Number(data.total ?? data.amount ?? data.summary?.total ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function readCurrency(data) {
  return String(data.currency || data.summary?.currency || "XOF");
}

async function main() {
  const db = admin.firestore();
  const snap = await db.collection("orders").get();

  const planned = [];
  const alreadySet = [];
  const skippedPayment = [];
  const skippedUnpaidLogistics = [];
  const skippedUnmapped = [];
  const skippedEmpty = [];
  let scanned = 0;

  snap.forEach((docSnap) => {
    scanned += 1;
    const data = docSnap.data() || {};
    const status = String(data.status || "").toLowerCase().trim();
    const paymentStatus = String(
      data.paymentStatus || data.paymentState || data.payment?.status || "",
    )
      .toLowerCase()
      .trim();
    const current = data.fulfillmentStatus;
    const { kind, proposed } = proposedFromStatus(status);

    const row = {
      id: docSnap.id,
      orderId: String(data.orderId || data.orderNumber || ""),
      status: status || "(vide)",
      paymentStatus: paymentStatus || "(vide)",
      amount: readAmount(data),
      currency: readCurrency(data),
      currentFulfillmentStatus: isFulfillmentStatus(current) ? current : null,
      proposedFulfillmentStatus: proposed,
      hasCustomerReview: hasCustomerReview(data),
      createdAt:
        data.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate().toISOString()
          : null,
    };

    if (isFulfillmentStatus(current)) {
      alreadySet.push({
        ...row,
        proposedFulfillmentStatus: current,
        skipReason: "déjà fulfillmentStatus valide",
      });
      return;
    }

    if (kind === "skip-payment") {
      skippedPayment.push({ ...row, skipReason: "pending/cancelled/failed — hors logistique" });
      return;
    }
    if (kind === "skip-empty") {
      skippedEmpty.push({ ...row, skipReason: "status vide" });
      return;
    }
    if (kind === "skip-unmapped") {
      skippedUnmapped.push({ ...row, skipReason: `status inconnu: ${status}` });
      return;
    }

    if (!isPaymentConfirmed(paymentStatus)) {
      skippedUnpaidLogistics.push({
        ...row,
        skipReason: "mappable mais paymentStatus non confirmé — laissé sans fulfillmentStatus",
      });
      return;
    }

    planned.push(row);
  });

  const byProposed = {};
  for (const row of planned) {
    const key = row.proposedFulfillmentStatus;
    byProposed[key] = (byProposed[key] || 0) + 1;
  }
  const byLegacyStatus = {};
  for (const row of planned) {
    const key = row.status;
    byLegacyStatus[key] = (byLegacyStatus[key] || 0) + 1;
  }

  console.log(
    EXECUTE
      ? "=== EXÉCUTION RÉELLE — écriture fulfillmentStatus uniquement (status intouché) ==="
      : "=== DRY-RUN — aucune écriture ===",
  );
  console.log(`Commandes scannées : ${scanned}`);
  console.log(`À migrer : ${planned.length}`);
  console.log(`Déjà renseigné : ${alreadySet.length}`);
  console.log(`Skip paiement (pending/cancelled/failed) : ${skippedPayment.length}`);
  console.log(`Skip logistique non payée (sans fulfillmentStatus) : ${skippedUnpaidLogistics.length}`);
  console.log(`Skip status vide : ${skippedEmpty.length}`);
  console.log(`Skip status inconnu : ${skippedUnmapped.length}`);
  console.log("");
  console.log("Mapping proposé (legacy status → fulfillmentStatus) :");
  console.log("  paid | confirmed → prise_en_charge");
  console.log("  processing      → preparation");
  console.log("  shipped         → arrivee_entrepot");
  console.log("  delivered       → termine");
  console.log("");

  const printRow = (tag, row) => {
    console.log(
      `[${tag}] id=${row.id} orderId=${row.orderId || "—"} status=${row.status} paymentStatus=${row.paymentStatus} amount=${row.amount} ${row.currency || ""} → ${row.proposedFulfillmentStatus || "(aucun)"} review=${row.hasCustomerReview ? "oui" : "non"}`,
    );
  };

  for (const row of planned) printRow(EXECUTE ? "SET" : "PLAN", row);
  for (const row of skippedUnpaidLogistics) printRow("SKIP-UNPAID", row);
  for (const row of alreadySet) printRow("SKIP-ALREADY", row);
  for (const row of skippedPayment) printRow("SKIP-PAYMENT", row);
  for (const row of skippedEmpty) printRow("SKIP-EMPTY", row);
  for (const row of skippedUnmapped) printRow("SKIP-UNMAPPED", row);

  if (EXECUTE && planned.length > 0) {
    for (let i = 0; i < planned.length; i += BATCH_SIZE) {
      const chunk = planned.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const row of chunk) {
        batch.update(db.collection("orders").doc(row.id), {
          fulfillmentStatus: row.proposedFulfillmentStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      console.log(
        `[BATCH] ${Math.min(i + chunk.length, planned.length)}/${planned.length} documents mis à jour`,
      );
    }
  }

  const report = {
    mode: EXECUTE ? "execute" : "dry-run",
    mapping: LEGACY_MAP,
    scanned,
    plannedCount: planned.length,
    alreadySetCount: alreadySet.length,
    skippedPaymentCount: skippedPayment.length,
    skippedUnpaidLogisticsCount: skippedUnpaidLogistics.length,
    skippedEmptyCount: skippedEmpty.length,
    skippedUnmappedCount: skippedUnmapped.length,
    byProposed,
    byLegacyStatus,
    planned,
    alreadySet,
    skippedPayment,
    skippedUnpaidLogistics,
    skippedEmpty,
    skippedUnmapped,
  };

  const outFile = path.join(
    __dirname,
    EXECUTE
      ? "migrateFulfillmentStatus.execute.json"
      : "migrateFulfillmentStatus.dry-run.json",
  );
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");

  console.log("\n=== RAPPORT ===");
  console.log(
    JSON.stringify(
      {
        mode: report.mode,
        scanned,
        plannedCount: planned.length,
        alreadySetCount: alreadySet.length,
        skippedPaymentCount: skippedPayment.length,
        skippedUnpaidLogisticsCount: skippedUnpaidLogistics.length,
        skippedEmptyCount: skippedEmpty.length,
        skippedUnmappedCount: skippedUnmapped.length,
        skippedUnpaidLogistics,
        byProposed,
        byLegacyStatus,
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
