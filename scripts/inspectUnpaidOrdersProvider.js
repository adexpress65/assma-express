/**
 * Lecture seule : croise 5 commandes avec payments + API prestataire.
 * Aucune écriture Firestore.
 */
const path = require("path");
const dotenv = require(path.join(__dirname, "../ngenius-backend/node_modules/dotenv"));
const axios = require(path.join(__dirname, "../ngenius-backend/node_modules/axios"));
const admin = require("firebase-admin");

dotenv.config({ path: path.join(__dirname, "../ngenius-backend/.env") });

const serviceAccount = require("../assma-expresse-firebase-adminsdk-fbsvc-b87148844b.json");
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const IDS = [
  "ORD-1784394147514",
  "ORD-1784569721154",
  "ORD-1784575173617",
  "ORD-1784647633850",
  "ORD-1784662140508",
];

const SUCCESS = new Set(["PURCHASED", "CAPTURED", "PAID", "COMPLETED", "SUCCESS"]);
const FAILURE = new Set(["FAILED", "CANCELLED", "EXPIRED", "DECLINED"]);

function pickPaymentFields(data) {
  if (!data) return null;
  return {
    status: data.status ?? null,
    paymentStatus: data.paymentStatus ?? data.paymentState ?? data.payment?.status ?? null,
    provider: data.provider ?? data.paymentProvider ?? null,
    paidAt: data.paidAt
      ? typeof data.paidAt.toDate === "function"
        ? data.paidAt.toDate().toISOString()
        : String(data.paidAt)
      : null,
    total: data.total ?? data.amount ?? data.summary?.total ?? null,
    currency: data.currency || "XOF",
    ngeniusOrderReference: data.ngeniusOrderReference || null,
    ngeniusOrderId: data.ngeniusOrderId || null,
    ngeniusPaymentState: data.ngeniusPaymentState || null,
    fedapayTransactionId: data.fedapayTransactionId || data.transactionId || null,
    paydunyaToken: data.paydunyaToken || data.token || null,
    createdAt:
      data.createdAt && typeof data.createdAt.toDate === "function"
        ? data.createdAt.toDate().toISOString()
        : null,
  };
}

function extractState(payload) {
  return (
    payload?.payment?.state ||
    payload?.state ||
    payload?._embedded?.payment?.[0]?.state ||
    payload?._embedded?.payments?.[0]?.state ||
    null
  );
}

function classifyState(state) {
  if (!state) return "unknown";
  const s = String(state).trim().toUpperCase();
  if (SUCCESS.has(s)) return "paid";
  if (FAILURE.has(s)) return "failed";
  return "pending";
}

async function getNgToken() {
  const url = `${process.env.NG_GATEWAY_URL}/identity/auth/access-token`;
  const res = await axios.post(url, null, {
    headers: {
      Authorization: `Basic ${process.env.NG_KEY}`,
      "Content-Type": "application/vnd.ni-identity.v1+json",
      Realm: "OBMali",
    },
    timeout: 15000,
  });
  if (!res.data?.access_token) throw new Error("NGenius token manquant");
  return res.data.access_token;
}

async function fetchNgOrder(token, reference) {
  const url = `${process.env.NG_GATEWAY_URL}/transactions/outlets/${process.env.NG_OUTLET}/orders/${encodeURIComponent(reference)}`;
  const mediaTypes = ["application/vnd.ni-payment.v2+json", "application/json"];
  let last = null;
  for (const mediaType of mediaTypes) {
    try {
      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: mediaType,
          "Content-Type": mediaType,
          Realm: "OBMali",
        },
        timeout: 15000,
        validateStatus: () => true,
      });
      return { httpStatus: res.status, data: res.data };
    } catch (e) {
      last = e;
      if (e?.response?.status !== 415) throw e;
    }
  }
  throw last;
}

async function searchNgByMerchantRef(token, orderId) {
  const urls = [
    `${process.env.NG_GATEWAY_URL}/transactions/outlets/${process.env.NG_OUTLET}/orders?merchantOrderReference=${encodeURIComponent(orderId)}`,
    `${process.env.NG_GATEWAY_URL}/transactions/outlets/${process.env.NG_OUTLET}/orders?reference=${encodeURIComponent(orderId)}`,
  ];
  const results = [];
  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.ni-payment.v2+json",
          Realm: "OBMali",
        },
        timeout: 20000,
        validateStatus: () => true,
      });
      const embedded =
        res.data?._embedded?.order ||
        res.data?._embedded?.orders ||
        (Array.isArray(res.data) ? res.data : null);
      const count = Array.isArray(embedded) ? embedded.length : res.data ? 1 : 0;
      results.push({
        urlSuffix: url.split("/orders")[1],
        httpStatus: res.status,
        matchCount: count,
        states: Array.isArray(embedded)
          ? embedded.map((o) => ({
              reference: o.reference || null,
              merchantOrderReference: o.merchantOrderReference || null,
              state: extractState(o),
            }))
          : null,
        errorSnippet:
          res.status >= 400
            ? JSON.stringify(res.data).slice(0, 400)
            : null,
      });
    } catch (e) {
      results.push({
        urlSuffix: url.split("/orders")[1],
        httpStatus: e?.response?.status || null,
        errorSnippet: e?.message,
      });
    }
  }
  return results;
}

async function main() {
  const db = admin.firestore();
  const token = await getNgToken();
  const reports = [];

  for (const id of IDS) {
    const orderSnap = await db.collection("orders").doc(id).get();
    const paySnap = await db.collection("payments").doc(id).get();
    const order = orderSnap.exists ? orderSnap.data() : null;
    const paymentLog = paySnap.exists ? paySnap.data() : null;
    const fields = pickPaymentFields(order);
    const orderKeys = order
      ? Object.keys(order).filter((k) =>
          /pay|ngenius|feda|dunya|ref|token|provider|status|paid/i.test(k),
        )
      : [];

    const refs = [
      fields?.ngeniusOrderReference,
      fields?.ngeniusOrderId && String(fields.ngeniusOrderId).includes(":")
        ? String(fields.ngeniusOrderId).split(":").pop()
        : fields?.ngeniusOrderId,
      id,
    ].filter((v, i, a) => typeof v === "string" && v.trim() && a.indexOf(v) === i);

    const ngeniusAttempts = [];
    for (const ref of refs) {
      try {
        const r = await fetchNgOrder(token, ref);
        const state = r.httpStatus >= 200 && r.httpStatus < 300 ? extractState(r.data) : null;
        ngeniusAttempts.push({
          queriedReference: ref,
          httpStatus: r.httpStatus,
          ngeniusReference: r.data?.reference || null,
          merchantOrderReference: r.data?.merchantOrderReference || null,
          state,
          classification: r.httpStatus === 404 ? "not_found" : classifyState(state),
          errorMessage:
            r.httpStatus >= 400
              ? r.data?.message || r.data?.error?.message || JSON.stringify(r.data).slice(0, 500)
              : null,
        });
        if (r.httpStatus >= 200 && r.httpStatus < 300) break;
      } catch (e) {
        ngeniusAttempts.push({
          queriedReference: ref,
          httpStatus: e?.response?.status || null,
          errorMessage: e?.message || String(e),
          classification: "error",
        });
      }
    }

    const ngeniusSearch = await searchNgByMerchantRef(token, id);

    const ngPaid = ngeniusAttempts.some((a) => a.classification === "paid")
      || (ngeniusSearch || []).some((s) =>
        (s.states || []).some((st) => classifyState(st.state) === "paid"),
      );
    const firestorePaid = ["paid", "confirmed", "success", "succeeded", "completed", "captured", "paid_out"].includes(
      String(fields?.paymentStatus || "").toLowerCase(),
    );

    let verdict = "no_provider_payment";
    if (ngPaid && !firestorePaid) verdict = "sync_bug_provider_paid_firestore_not";
    else if (ngPaid && firestorePaid) verdict = "paid_both";
    else if (!ngPaid && firestorePaid) verdict = "firestore_paid_provider_not";
    else verdict = "likely_test_or_abandoned";

    reports.push({
      id,
      firestoreOrderExists: orderSnap.exists,
      firestorePaymentRelatedKeys: orderKeys,
      firestore: fields,
      backendPaymentsCollection: paymentLog
        ? {
            exists: true,
            paymentState: paymentLog.paymentState || null,
            orderRef: paymentLog.orderRef || null,
            hasRawWebhook: !!paymentLog.raw,
            updatedAt:
              paymentLog.updatedAt && typeof paymentLog.updatedAt.toDate === "function"
                ? paymentLog.updatedAt.toDate().toISOString()
                : null,
          }
        : { exists: false },
      ngenius: ngeniusAttempts,
      ngeniusSearchByMerchantRef: ngeniusSearch,
      verdict,
    });
  }

  const paymentsSnap = await db.collection("payments").get();
  const paymentsHits = [];
  paymentsSnap.forEach((docSnap) => {
    const raw = JSON.stringify(docSnap.data() || {});
    if (IDS.some((id) => raw.includes(id) || docSnap.id === id)) {
      const d = docSnap.data() || {};
      paymentsHits.push({
        docId: docSnap.id,
        paymentState: d.paymentState || null,
        orderRef: d.orderRef || null,
        hasRawWebhook: !!d.raw,
      });
    }
  });

  console.log(
    JSON.stringify(
      {
        mode: "read-only",
        paymentsCollectionSize: paymentsSnap.size,
        paymentsHits,
        reports,
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
