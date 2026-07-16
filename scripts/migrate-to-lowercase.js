const admin = require('firebase-admin');
const serviceAccount = require('../assma-expresse-firebase-adminsdk-fbsvc-b871...json'); // Ton fichier serviceAccountKey

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateCollection(collectionName) {
  console.log(`🚀 Migration de ${collectionName}...`);
  const snapshot = await db.collection(collectionName).get();
  
  let updated = 0;
  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates = {};

    // Ajoute nameLower si pas existant
    if (!data.nameLower && data.name) {
      updates.nameLower = data.name.toLowerCase().trim();
    }

    // Champs spécifiques par collection
    if (collectionName === 'products') {
      if (!data.categoryLower && data.category) {
        updates.categoryLower = data.category.toLowerCase().trim();
      }
      if (!data.supplierLower && (data.supplier || data.companyName)) {
        updates.supplierLower = (data.supplier || data.companyName).toLowerCase().trim();
      }
    }

    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      batchCount++;
      updated++;

      if (batchCount === 500) {
        await batch.commit();
        console.log(`  ✅ Batch de 500 documents commité`);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`✅ ${collectionName} terminé: ${updated} documents mis à jour\n`);
}

async function run() {
  try {
    await migrateCollection('products');
    await migrateCollection('categories');
    await migrateCollection('companies');
    console.log('🎉 Migration globale terminée!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

run();