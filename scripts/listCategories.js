const admin = require('firebase-admin');
const sa = require('./serviceAccount.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  console.log('Chargement des produits...');
  const snap = await db.collection('products').get();
  console.log(`Total: ${snap.size} produits`);

  const catNames = new Map();
  const cats = new Map();

  snap.docs.forEach((d) => {
    const data = d.data();
    const cn = String(data.categoryName || '').trim();
    const c = String(data.category || '').trim();
    if (cn) catNames.set(cn, (catNames.get(cn) || 0) + 1);
    if (c) cats.set(c, (cats.get(c) || 0) + 1);
  });

  console.log('\n=== categoryName (Firestore) ===');
  [...catNames.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v}x  "${k}"`));

  console.log('\n=== category (Firestore) ===');
  [...cats.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${v}x  "${k}"`));

  // Aussi lister les catégories collection
  const catSnap = await db.collection('categories').get();
  if (!catSnap.empty) {
    console.log('\n=== Collection "categories" ===');
    catSnap.docs.forEach((d) => {
      const data = d.data();
      console.log(`  id=${d.id}  name="${data.name}"  folder="${data.folder || ''}"`);
    });
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
