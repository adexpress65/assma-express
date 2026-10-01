/**
 * Migration users/{uid}.role (Firestore) → custom claim Auth `role`.
 *
 * Défaut : dry-run (aucune écriture).
 * Exécution réelle : node migrateUserRoleClaims.js --execute
 *
 * Mapping :
 *   role ∈ {super-admin, super_admin} → super-admin
 *   role = admin → admin
 *   companies/{uid} existe → seller (prioritaire sur role/userType, pas sur admin)
 *   role = seller SANS companies/{uid} → customer
 *   le reste → customer
 *   userType ignoré
 */
const admin = require("firebase-admin");
const serviceAccount = require("../assma-expresse-firebase-adminsdk-fbsvc-b87148844b.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const EXECUTE = process.argv.includes("--execute");

function firestoreRoleOf(data) {
  if (!data || data.role === undefined || data.role === null || data.role === "") {
    return "(absent)";
  }
  return String(data.role);
}

function decideClaim(firestoreRole, hasCompanyDoc) {
  const raw = String(firestoreRole || "").trim();
  if (raw === "super-admin" || raw === "super_admin") {
    return { claim: "super-admin", skip: false, reason: null };
  }
  if (raw === "admin") {
    return { claim: "admin", skip: false, reason: null };
  }
  if (hasCompanyDoc) {
    return { claim: "seller", skip: false, reason: null };
  }
  return { claim: "customer", skip: false, reason: null };
}

async function listAllAuthUsers() {
  const out = [];
  let pageToken;
  do {
    const res = await admin.auth().listUsers(1000, pageToken);
    out.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);
  return out;
}

async function main() {
  const db = admin.firestore();
  const companyIds = new Set();
  const companiesSnap = await db.collection("companies").get();
  companiesSnap.forEach((d) => companyIds.add(d.id));

  const usersSnap = await db.collection("users").get();
  const firestoreByUid = new Map();
  usersSnap.forEach((d) => firestoreByUid.set(d.id, d.data() || {}));

  const authUsers = await listAllAuthUsers();
  const authUids = new Set(authUsers.map((u) => u.uid));

  const migrated = {
    "super-admin": [],
    admin: [],
    seller: [],
    customer: [],
  };
  const skipped = [];

  console.log(
    EXECUTE
      ? "=== EXÉCUTION RÉELLE — écriture des custom claims ==="
      : "=== DRY-RUN — aucune écriture ===",
  );

  for (const authUser of authUsers) {
    const data = firestoreByUid.get(authUser.uid) || {};
    const fsRole = firestoreRoleOf(data);
    const hasCompany = companyIds.has(authUser.uid);
    const decision = decideClaim(fsRole === "(absent)" ? "" : fsRole, hasCompany);
    const email = authUser.email || "(sans email)";

    if (decision.skip) {
      skipped.push({
        uid: authUser.uid,
        email,
        firestoreRole: fsRole,
        reason: decision.reason,
      });
      console.log(
        `[SKIP] uid=${authUser.uid} email=${email} firestoreRole=${fsRole} reason=${decision.reason}`,
      );
      continue;
    }

    const row = {
      uid: authUser.uid,
      email,
      firestoreRole: fsRole,
      claim: decision.claim,
      hasCompany,
    };
    migrated[decision.claim].push(row);
    console.log(
      `[${EXECUTE ? "SET" : "PLAN"}] uid=${authUser.uid} email=${email} firestoreRole=${fsRole} → claim=${decision.claim}`,
    );

    if (EXECUTE) {
      const nextClaims = { ...(authUser.customClaims || {}), role: decision.claim };
      await admin.auth().setCustomUserClaims(authUser.uid, nextClaims);
      await db.collection("users").doc(authUser.uid).set(
        {
          role: decision.claim,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  }

  for (const [uid, data] of firestoreByUid.entries()) {
    if (authUids.has(uid)) continue;
    skipped.push({
      uid,
      email: data.email || "(sans email)",
      firestoreRole: firestoreRoleOf(data),
      reason: "document Firestore users/ sans compte Firebase Auth — claim impossible",
    });
    console.log(
      `[SKIP] uid=${uid} firestoreRole=${firestoreRoleOf(data)} reason=pas de compte Auth`,
    );
  }

  const counts = {
    "super-admin": migrated["super-admin"].length,
    admin: migrated.admin.length,
    seller: migrated.seller.length,
    customer: migrated.customer.length,
  };

  console.log("\n=== RAPPORT ===");
  console.log(JSON.stringify({ mode: EXECUTE ? "execute" : "dry-run", counts, skipped }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
