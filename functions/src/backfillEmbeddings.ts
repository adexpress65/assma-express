/**
 * CLI : indexe les embeddings image de tous les produits Firestore.
 *
 * Prérequis : GOOGLE_APPLICATION_CREDENTIALS pointant vers une clé de compte de service,
 * ou environnement Firebase / gcloud déjà authentifié.
 *
 *   cd functions && npm run build && node lib/backfillEmbeddings.js
 */
import * as admin from "firebase-admin";
import {
  embedImageFromUrlWithPHash,
  CLIP_MODEL_ID,
  CLIP_DIMS,
} from "./services/clipService";
import {
  isPineconeConfigured,
  upsertProductVector,
} from "./services/pineconeVisualService";
import { visualMetadataFromProduct } from "./services/visualIndexMetadata";
import { EMBEDDINGS_COLLECTION } from "./services/visualSearchCore";
import type { DocumentData } from "firebase-admin/firestore";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function productImageUrl(data: DocumentData): string | null {
  const u = data.mainImage || data.imageUrl || data.image;
  if (!u || typeof u !== "string") return null;
  const t = u.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  return null;
}

async function main() {
  const lim = Math.min(
    Math.max(Number(process.env.BACKFILL_LIMIT) || 8000, 1),
    8000,
  );
  const snap = await db.collection("products").limit(lim).get();
  console.log(`[backfill] ${snap.size} documents products`);
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const url = productImageUrl(data);
    if (!url) {
      skip += 1;
      continue;
    }
    try {
      const { embedding, perceptualHashHex } = await embedImageFromUrlWithPHash(
        url,
      );
      const meta = visualMetadataFromProduct(doc.id, data, {
        perceptualHashHex,
      });
      await db.collection(EMBEDDINGS_COLLECTION).doc(doc.id).set(
        {
          productId: doc.id,
          embedding,
          perceptualHashHex,
          dims: CLIP_DIMS,
          modelId: CLIP_MODEL_ID,
          sourceImageUrl: url,
          price: meta.price,
          catalogScope: meta.catalogScope,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      if (isPineconeConfigured()) {
        await upsertProductVector(doc.id, embedding, meta);
      }
      ok += 1;
      if (ok % 25 === 0) {
        console.log(`[backfill] ${ok} indexés…`);
      }
    } catch (e) {
      fail += 1;
      console.warn(`[backfill] échec ${doc.id}`, (e as Error)?.message || e);
    }
  }

  console.log("[backfill] terminé", { ok, skip, fail });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isMain = typeof require !== "undefined" && require.main === module;
if (isMain) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

export { main as runBackfillEmbeddings };
