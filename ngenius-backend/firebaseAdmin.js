import admin from 'firebase-admin';
import { readFile } from 'fs/promises';
import path from 'path';

async function initializeFirebase() {
  if (!admin.apps.length) {
    let serviceAccount;
    
    try {
      // 1. On essaie d'abord le chemin Secret File de Render
      const secretPath = '/etc/secrets/serviceAccountKey.json';
      const localPath = './serviceAccountKey.json';
      
      // On vérifie dynamiquement quel fichier utiliser
      const keyPath = process.env.NODE_ENV === 'production' ? secretPath : localPath;
      
      serviceAccount = JSON.parse(
        await readFile(new URL(keyPath, import.meta.url))
      );
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase Admin initialisé avec succès");
    } catch (error) {
      console.error("❌ Erreur d'initialisation Firebase Admin:", error.message);
    }
  }
}

await initializeFirebase();

export const db = admin.firestore();
export default admin;