#!/usr/bin/env node
/**
 * A2Express — Backfill Firestore (Admin SDK)
 *
 * 1) Pour chaque doc `companies/{companyDocId}` avec un champ `uid` (Firebase Auth du gérant),
 *    écrit sur `users/{uid}` : { companyId: companyDocId, companyLinkedAt, updatedAt } (merge).
 * 2) Normalise `nameLower` et `name_lower` sur chaque company si besoin.
 * 3) Pour chaque `products/{id}` avec `companyId`, aligne `supplier`, `companyName` et
 *    le map `companyData` { id, name, logo, isPremium } depuis le doc `companies`.
 *
 * Prérequis :
 *   - Dépendance : firebase-admin (npm install à la racine du repo)
 *   - Authentification Admin (une des options) :
 *       export GOOGLE_APPLICATION_CREDENTIALS=/chemin/vers/serviceAccount.json
 *     ou fichier à la racine : serviceAccountKey.json (voir .gitignore)
 *     ou : gcloud auth application-default login (projet assma-expresse)
 *
 * Usage :
 *   node scripts/firestore-backfill-company-links.mjs
 *   node scripts/firestore-backfill-company-links.mjs --dry-run
 *   node scripts/firestore-backfill-company-links.mjs --limit-products=2000
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit-products='));
const limitProducts = limitArg
  ? parseInt(limitArg.split('=')[1], 10)
  : Number.POSITIVE_INFINITY;

function initAdmin() {
  if (admin.apps.length) return;
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const localKey = join(rootDir, 'serviceAccountKey.json');
  const credPath = envPath && existsSync(envPath) ? envPath : localKey;

  if (existsSync(credPath)) {
    const sa = JSON.parse(readFileSync(credPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(sa),
    });
    console.log('Admin: certificat fichier →', credPath);
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('Admin: Application Default Credentials');
  }
}

function pickCompanyDisplayName(data) {
  const d = data || {};
  return (
    String(d.name || '').trim() ||
    String(d.companyName || '').trim() ||
    String(d.displayName || '').trim() ||
    String(d.nameLower || '').trim() ||
    String(d.name_lower || '').trim()
  );
}

function buildCompanyData(companyId, cdata, fallbackName) {
  const name = pickCompanyDisplayName(cdata) || fallbackName || '';
  return {
    id: companyId,
    name,
    logo: String(cdata?.logo || ''),
    isPremium: Boolean(cdata?.isPremium === true),
  };
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  console.log(
    dryRun ? 'Mode DRY-RUN (aucune écriture)' : 'Mode ÉCRITURE réelle'
  );

  /** @type {Map<string, Record<string, unknown>>} */
  const companyById = new Map();

  console.log('\n--- Companies + lien users.companyId ---');
  const companiesSnap = await db.collection('companies').get();
  let userLinks = 0;
  let companyMetaFixes = 0;

  for (const cdoc of companiesSnap.docs) {
    const companyId = cdoc.id;
    const data = cdoc.data() || {};
    companyById.set(companyId, data);

    const ownerUid =
      typeof data.uid === 'string' && data.uid.trim() ? data.uid.trim() : null;
    if (ownerUid) {
      if (dryRun) {
        console.log(`[dry-run] users/${ownerUid} merge companyId=${companyId}`);
      } else {
        await db
          .collection('users')
          .doc(ownerUid)
          .set(
            {
              companyId,
              companyLinkedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }
      userLinks++;
    }

    const name = pickCompanyDisplayName(data);
    if (!name || dryRun) continue;
    const nl = name.toLowerCase();
    const patch = {};
    if (data.nameLower !== nl) patch.nameLower = nl;
    if (data.name_lower !== nl) patch.name_lower = nl;
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = FieldValue.serverTimestamp();
      if (!dryRun) await cdoc.ref.update(patch);
      companyMetaFixes++;
    }
  }

  console.log(
    `Companies: ${companiesSnap.size} | Liens users←company (uid): ${userLinks} | Meta nameLower: ${companyMetaFixes}`
  );

  console.log('\n--- Produits : supplier / companyName / companyData ---');
  let scanned = 0;
  let productUpdates = 0;
  let lastDoc = null;
  const pageSize = 250;

  const flushBatch = async (batch) => {
    if (dryRun) return;
    await batch.commit();
  };

  while (scanned < limitProducts) {
    const take = Math.min(pageSize, limitProducts - scanned);
    if (take <= 0) break;

    let q = db
      .collection('products')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(take);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    let batch = db.batch();
    let ops = 0;

    for (const pdoc of snap.docs) {
      scanned++;
      const pdata = pdoc.data() || {};
      const companyId =
        typeof pdata.companyId === 'string' ? pdata.companyId.trim() : '';
      if (!companyId) continue;

      const cdata = companyById.get(companyId);
      if (!cdata) continue;

      const cname =
        pickCompanyDisplayName(cdata) ||
        String(pdata.companyName || '').trim() ||
        String(pdata.supplier || '').trim();
      if (!cname) continue;

      const companyData = buildCompanyData(
        companyId,
        cdata,
        cname
      );

      const sameName =
        String(pdata.supplier || '') === cname &&
        String(pdata.companyName || '') === cname;
      const cd = pdata.companyData;
      const sameData =
        cd &&
        cd.id === companyData.id &&
        cd.name === companyData.name &&
        (cd.logo || '') === companyData.logo &&
        Boolean(cd.isPremium) === companyData.isPremium;

      if (sameName && sameData) continue;

      productUpdates++;
      if (dryRun) {
        console.log(`[dry-run] product ${pdoc.id} → "${cname}"`);
        continue;
      }

      batch.update(pdoc.ref, {
        supplier: cname,
        companyName: cname,
        companyData,
        companySyncAt: FieldValue.serverTimestamp(),
      });
      ops++;
      if (ops >= 400) {
        await flushBatch(batch);
        batch = db.batch();
        ops = 0;
      }
    }

    if (ops > 0) await flushBatch(batch);
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < take) break;
  }

  console.log(`Produits scannés: ${scanned} | À mettre à jour: ${productUpdates}`);
  console.log(dryRun ? '\nFin (dry-run).' : '\nFin — écritures appliquées.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
