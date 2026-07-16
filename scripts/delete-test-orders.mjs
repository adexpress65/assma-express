#!/usr/bin/env node
/**
 * Supprime des commandes de test dans Firestore (firebase-admin).
 *
 * Usage (PowerShell, depuis la racine du dépôt assma) :
 *   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\chemin\vers\serviceAccount.json"
 *   $env:FIREBASE_PROJECT_ID="votre-project-id"
 *   $env:MATCH_USER_ID="uidFirebaseDuCompteDeTest"
 *   node scripts/delete-test-orders.mjs
 *
 * Supprime tous les documents de la collection `orders` où `userId` == MATCH_USER_ID.
 * À utiliser uniquement sur un projet où vous avez les droits Admin SDK.
 *
 * Alternative : Console Firebase → Firestore → collection orders → suppression manuelle.
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
const matchUserId = process.env.MATCH_USER_ID;

if (!projectId) {
  console.error('Définissez FIREBASE_PROJECT_ID (ou GCLOUD_PROJECT).');
  process.exit(1);
}
if (!matchUserId) {
  console.error('Définissez MATCH_USER_ID (uid du compte dont vous voulez effacer les commandes).');
  process.exit(1);
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credPath) {
  console.error('Définissez GOOGLE_APPLICATION_CREDENTIALS vers le JSON du compte de service.');
  process.exit(1);
}

try {
  readFileSync(credPath, 'utf8');
} catch {
  console.error('Fichier de credentials introuvable :', credPath);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
}

const db = admin.firestore();

async function main() {
  const snap = await db.collection('orders').where('userId', '==', matchUserId).get();
  if (snap.empty) {
    console.log('Aucune commande pour cet utilisateur.');
    return;
  }
  let batch = db.batch();
  let n = 0;
  let op = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    op++;
    n++;
    if (op >= 450) {
      await batch.commit();
      batch = db.batch();
      op = 0;
    }
  }
  if (op > 0) await batch.commit();
  console.log(`Supprimé ${n} commande(s) pour userId=${matchUserId}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
