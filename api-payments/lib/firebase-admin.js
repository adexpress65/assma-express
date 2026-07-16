/**
 * lib/firebase-admin.js
 * Safe + Vercel Compatible + Automatic JSON Parsing
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT env variable.");
  }

  let serviceAccount;

  try {
    serviceAccount = JSON.parse(raw);
  } catch (e) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT parse error:", e);
    throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT JSON format.");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log("🔥 Firebase Admin initialized successfully.");
}

const db = admin.firestore();

module.exports = { admin, db };
