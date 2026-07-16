const admin = require('firebase-admin');
const { algoliasearch } = require('algoliasearch');
const serviceAccount = require('./serviceAccount.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID || process.env.EXPO_PUBLIC_ALGOLIA_APP_ID || 'ZYRHOXK3WR';
const ALGOLIA_ADMIN_API_KEY = process.env.ALGOLIA_ADMIN_API_KEY;
const ALGOLIA_INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || 'products';

if (!ALGOLIA_ADMIN_API_KEY) {
  console.error('❌ ALGOLIA_ADMIN_API_KEY manquante.');
  process.exit(1);
}

const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_API_KEY);

function toMillis(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'number') return value;
  return Date.now();
}

function sanitizeImage(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.includes('firebasestorage.googleapis.com') && !trimmed.includes('alt=media')) {
    return trimmed.includes('?') ? `${trimmed}&alt=media` : `${trimmed}?alt=media`;
  }
  return trimmed;
}

function mapProduct(doc) {
  const data = doc.data() || {};
  const images = [
    data.mainImage,
    data.imageUrl,
    data.image,
    ...(Array.isArray(data.images) ? data.images : []),
  ].filter((v) => typeof v === 'string' && v.trim().length > 0).map(sanitizeImage);

  const categoryName = String(data.categoryName || data.category || '').trim();
  const category = String(data.category || data.categoryName || '').trim();
  const subCategory = String(data.subCategory || data.subcategory || data.sub_category || '').trim();

  return {
    objectID: doc.id,
    name: String(data.name || 'Sans nom'),
    nameLower: String((data.name || '').toString().toLowerCase()),
    description: String(data.description || ''),
    price: Number(data.price || 0),
    currency: String(data.currency || 'XOF'),
    supplier: String(data.supplier || data.companyName || ''),
    companyName: String(data.companyName || data.supplier || ''),
    companyId: data.companyId ? String(data.companyId) : undefined,
    imageUrl: sanitizeImage(data.mainImage || data.imageUrl || data.image || images[0] || ''),
    mainImage: sanitizeImage(data.mainImage || data.imageUrl || data.image || images[0] || ''),
    images,
    category,
    categoryName,
    subCategory,
    featured: Boolean(data.featured),
    inStock: data.inStock !== false,
    minOrder: Number(data.minOrder || 1),
    updatedAt: toMillis(data.updatedAt),
  };
}

async function rebuildAlgoliaIndex() {
  try {
    console.log('⏳ Récupération des produits Firestore...');
    const snapshot = await db.collection('products').get();
    if (snapshot.empty) {
      console.log('❌ Aucun produit trouvé dans Firestore.');
      return;
    }

    const records = snapshot.docs
      .filter((doc) => {
        const d = doc.data() || {};
        return d.status !== 'draft' && d.isActive !== false;
      })
      .map(mapProduct);

    console.log(`📦 ${records.length} produits actifs à indexer.`);
    console.log(`🚀 Rebuild de l'index '${ALGOLIA_INDEX_NAME}'...`);

    try {
      await client.replaceAllObjects({
        indexName: ALGOLIA_INDEX_NAME,
        objects: records,
      });
    } catch (sdkErr) {
      console.warn('⚠️ SDK Algolia indisponible, fallback REST en cours...');
      await rebuildViaRest(records);
    }

    console.log('⚙️ Application des settings de recherche/faceting...');
    try {
      await client.setSettings({
        indexName: ALGOLIA_INDEX_NAME,
        indexSettings: {
          searchableAttributes: [
            'unordered(category)',
            'unordered(categoryName)',
            'unordered(subCategory)',
            'unordered(name)',
            'unordered(description)',
            'unordered(supplier)',
            'unordered(companyName)',
          ],
          attributesForFaceting: [
            'filterOnly(category)',
            'filterOnly(categoryName)',
            'filterOnly(subCategory)',
          ],
        },
      });
    } catch {
      await setSettingsViaRest();
    }

    console.log('✅ Rebuild Algolia terminé avec succès.');
  } catch (err) {
    console.error('❌ Erreur détaillée :', err);
    process.exitCode = 1;
  }
}

rebuildAlgoliaIndex();

async function rebuildViaRest(records) {
  const host = `https://${ALGOLIA_APP_ID}-dsn.algolia.net`;
  const headers = {
    'X-Algolia-Application-Id': ALGOLIA_APP_ID,
    'X-Algolia-API-Key': ALGOLIA_ADMIN_API_KEY,
    'Content-Type': 'application/json',
  };

  // clear index
  const clearRes = await fetch(`${host}/1/indexes/${ALGOLIA_INDEX_NAME}/clear`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  if (!clearRes.ok) {
    const txt = await clearRes.text();
    throw new Error(`clear index failed: ${clearRes.status} ${txt}`);
  }

  const batchSize = 500;
  for (let i = 0; i < records.length; i += batchSize) {
    const chunk = records.slice(i, i + batchSize);
    const requests = chunk.map((obj) => ({
      action: 'addObject',
      body: obj,
    }));
    const res = await fetch(`${host}/1/indexes/${ALGOLIA_INDEX_NAME}/batch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`batch failed: ${res.status} ${txt}`);
    }
    console.log(`📤 Batch ${Math.floor(i / batchSize) + 1} envoyé (${Math.min(i + batchSize, records.length)}/${records.length})`);
  }
}

async function setSettingsViaRest() {
  const host = `https://${ALGOLIA_APP_ID}-dsn.algolia.net`;
  const headers = {
    'X-Algolia-Application-Id': ALGOLIA_APP_ID,
    'X-Algolia-API-Key': ALGOLIA_ADMIN_API_KEY,
    'Content-Type': 'application/json',
  };
  const payload = {
    searchableAttributes: [
      'unordered(category)',
      'unordered(categoryName)',
      'unordered(subCategory)',
      'unordered(name)',
      'unordered(description)',
      'unordered(supplier)',
      'unordered(companyName)',
    ],
    attributesForFaceting: [
      'filterOnly(category)',
      'filterOnly(categoryName)',
      'filterOnly(subCategory)',
    ],
  };
  const res = await fetch(`${host}/1/indexes/${ALGOLIA_INDEX_NAME}/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`settings failed: ${res.status} ${txt}`);
  }
}