const admin = require('firebase-admin');
const serviceAccount = require('../assma-expresse-firebase-adminsdk-fbsvc-b87148844b.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function fixMissingSellerUid() {
  console.log("=== CORRECTION PRODUITS SANS sellerUid ===");

  const snapshot = await db.collection('products').get();
  let batch = db.batch();
  let count = 0;
  let total = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (!data.sellerUid) {
      let sellerUid = null;

      // 1️⃣ priorité creatorId
      if (data.creatorId) {
        sellerUid = data.creatorId;
      }

      // 2️⃣ sinon fallback via company
      else if (data.companyId) {
        const companyDoc = await db.collection('companies')
          .doc(data.companyId)
          .get();

        if (companyDoc.exists) {
          sellerUid = companyDoc.data().uid;
        }
      }

      if (sellerUid) {
        batch.update(doc.ref, { sellerUid });
        count++;
        total++;
      }
    }

    if (count === 400) { // moins pour éviter surcharge
      await batch.commit();
      batch = db.batch();
      count = 0;
      console.log("400 produits corrigés...");
    }
  }

  if (count > 0) {
    await batch.commit();
  }

  console.log("Correction terminée. Total:", total);
  process.exit(0);
}

fixMissingSellerUid().catch(console.error);