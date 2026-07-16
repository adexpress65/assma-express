const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

const fs = require('fs');
const path = require('path');

const BATCH_SIZE = Number(process.env.BACKFILL_BATCH_SIZE || 25);
const PRODUCT_LIMIT = Number(process.env.BACKFILL_LIMIT || 0);
const PAGE_SIZE = Number(process.env.BACKFILL_PAGE_SIZE || 50);
const IMAGE_CONCURRENCY = Number(process.env.BACKFILL_IMAGE_CONCURRENCY || 6);
const REQUEST_TIMEOUT_MS = Number(process.env.BACKFILL_FETCH_TIMEOUT_MS || 15000);
const CHECKPOINT_PATH = path.join(__dirname, '.backfill-image-hashes-state.json');
const FAILURE_LOG_PATH = path.join(__dirname, '.backfill-image-hashes-failures.json');

function fnv1aHashFromBuffer(buffer) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < buffer.length; index += 1) {
    hash ^= buffer[index];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

async function computeImageHashFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) {
      return null;
    }

    return fnv1aHashFromBuffer(buffer);
  } catch (error) {
    console.warn('[backfillImageHashes] image download failed:', url, error.message);
    return null;
  }
}

function getProductImages(data) {
  const images = [
    data.mainImage,
    data.imageUrl,
    data.image,
    ...(Array.isArray(data.images) ? data.images : []),
  ]
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());

  return Array.from(new Set(images));
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => run())
  );

  return results;
}

async function buildImageHashes(images, mainImage, existingHashes, existingMainImageHash) {
  const hashes = [...existingHashes];
  let mainImageHash = existingMainImageHash;

  const resolved = await mapWithConcurrency(images, IMAGE_CONCURRENCY, async (imageUrl) => {
    const hash = await computeImageHashFromUrl(imageUrl);
    return { imageUrl, hash };
  });

  for (const item of resolved) {
    if (!item || !item.hash) continue;

    if (!hashes.includes(item.hash)) {
      hashes.push(item.hash);
    }

    if (!mainImageHash && item.imageUrl === mainImage) {
      mainImageHash = item.hash;
    }
  }

  return {
    hashes,
    mainImageHash: mainImageHash || hashes[0] || null,
  };
}

function loadCheckpoint() {
  try {
    if (!fs.existsSync(CHECKPOINT_PATH)) {
      return { lastDocId: null, scanned: 0, updated: 0, skipped: 0 };
    }
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf8'));
  } catch {
    return { lastDocId: null, scanned: 0, updated: 0, skipped: 0 };
  }
}

function saveCheckpoint(state) {
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(state, null, 2));
}

function appendFailure(entry) {
  try {
    const current = fs.existsSync(FAILURE_LOG_PATH)
      ? JSON.parse(fs.readFileSync(FAILURE_LOG_PATH, 'utf8'))
      : [];
    current.push(entry);
    fs.writeFileSync(FAILURE_LOG_PATH, JSON.stringify(current, null, 2));
  } catch {
    // non bloquant
  }
}

async function safeCommit(batch, pendingDocIds, progress) {
  if (!pendingDocIds.length) {
    return true;
  }

  try {
    await batch.commit();
    console.log(
      `[commit] ok docs=${pendingDocIds.length} scanned=${progress.scanned} updated=${progress.updated} skipped=${progress.skipped}`
    );
    return true;
  } catch (error) {
    console.warn(
      `[commit] failed docs=${pendingDocIds.length} error=${error?.message || 'unknown'}`
    );
    appendFailure({
      type: 'commit',
      at: new Date().toISOString(),
      docIds: pendingDocIds,
      message: error?.message || String(error),
    });
    return false;
  }
}

async function processDocs(docs, progress) {
  let batch = db.batch();
  let batchOps = 0;
  let skipped = 0;
  let pendingDocIds = [];

  for (const docSnap of docs) {
    progress.scanned += 1;
    const data = docSnap.data();
    const images = getProductImages(data);

    if (!images.length) {
      skipped += 1;
      continue;
    }

    const existingHashes = Array.isArray(data.imageHashes)
      ? data.imageHashes.filter((value) => typeof value === 'string' && value.length > 0)
      : [];

    const mainImage = typeof data.mainImage === 'string' ? data.mainImage : images[0];
    const existingMainImageHash =
      typeof data.mainImageHash === 'string' ? data.mainImageHash : null;

    const missingHashes = existingHashes.length < images.length || !existingMainImageHash;
    if (!missingHashes) {
      skipped += 1;
      saveCheckpoint({
        lastDocId: docSnap.id,
        scanned: progress.scanned,
        updated: progress.updated,
        skipped: progress.skipped + skipped,
      });
      continue;
    }

    let hashes;
    let mainImageHash;
    try {
      const built = await buildImageHashes(
        images,
        mainImage,
        existingHashes,
        existingMainImageHash
      );
      hashes = built.hashes;
      mainImageHash = built.mainImageHash;
    } catch (error) {
      skipped += 1;
      appendFailure({
        type: 'product',
        at: new Date().toISOString(),
        docId: docSnap.id,
        message: error?.message || String(error),
      });
      saveCheckpoint({
        lastDocId: docSnap.id,
        scanned: progress.scanned,
        updated: progress.updated,
        skipped: progress.skipped + skipped,
      });
      continue;
    }

    if (!hashes.length) {
      skipped += 1;
      saveCheckpoint({
        lastDocId: docSnap.id,
        scanned: progress.scanned,
        updated: progress.updated,
        skipped: progress.skipped + skipped,
      });
      continue;
    }

    batch.update(docSnap.ref, {
      imageHashes: hashes,
      mainImageHash,
      imageHashesUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batchOps += 1;
    progress.updated += 1;
    pendingDocIds.push(docSnap.id);

    if (batchOps >= BATCH_SIZE) {
      await safeCommit(batch, pendingDocIds, progress);
      batch = db.batch();
      batchOps = 0;
      pendingDocIds = [];
      console.log(
        `[progress] scanned=${progress.scanned} updated=${progress.updated} skipped=${progress.skipped + skipped}`
      );
    }

    saveCheckpoint({
      lastDocId: docSnap.id,
      scanned: progress.scanned,
      updated: progress.updated,
      skipped: progress.skipped + skipped,
    });
  }

  if (batchOps > 0) {
    await safeCommit(batch, pendingDocIds, progress);
  }

  progress.skipped += skipped;
}

async function backfillImageHashes() {
  console.log('=== BACKFILL IMAGE HASHES ===');
  console.log(
    `Config: pageSize=${PAGE_SIZE}, batchSize=${BATCH_SIZE}, imageConcurrency=${IMAGE_CONCURRENCY}, timeoutMs=${REQUEST_TIMEOUT_MS}`
  );

  const state = loadCheckpoint();
  const progress = {
    scanned: Number(state.scanned || 0),
    updated: Number(state.updated || 0),
    skipped: Number(state.skipped || 0),
  };

  let lastDoc = null;
  let processedCount = 0;

  if (state.lastDocId) {
    try {
      lastDoc = await db.collection('products').doc(state.lastDocId).get();
      console.log(`[resume] reprise après doc=${state.lastDocId}`);
    } catch {
      lastDoc = null;
    }
  }

  while (true) {
    let queryRef = db.collection('products').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
    if (lastDoc && lastDoc.exists) {
      queryRef = queryRef.startAfter(lastDoc);
    }

    const snapshot = await queryRef.get();
    if (snapshot.empty) {
      break;
    }

    let docs = snapshot.docs;
    if (PRODUCT_LIMIT > 0) {
      const remaining = PRODUCT_LIMIT - processedCount;
      if (remaining <= 0) {
        break;
      }
      docs = docs.slice(0, remaining);
    }

    await processDocs(docs, progress);
    processedCount += docs.length;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    console.log(
      `[page] processed=${processedCount} scanned=${progress.scanned} updated=${progress.updated} skipped=${progress.skipped}`
    );

    if (PRODUCT_LIMIT > 0 && processedCount >= PRODUCT_LIMIT) {
      break;
    }
  }

  console.log('=== BACKFILL TERMINE ===');
  console.log('Scannés:', progress.scanned);
  console.log('Mis à jour:', progress.updated);
  console.log('Ignorés:', progress.skipped);
  saveCheckpoint({
    lastDocId: null,
    scanned: progress.scanned,
    updated: progress.updated,
    skipped: progress.skipped,
    finishedAt: new Date().toISOString(),
  });
}

backfillImageHashes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('ERREUR BACKFILL IMAGE HASHES:', error);
    process.exit(1);
  });
