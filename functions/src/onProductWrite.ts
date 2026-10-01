import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import {
  createAlgoliaProductsIndex,
  shouldRemoveProductFromAlgolia,
} from "./algoliaProducts";
import { pineconeApiKey } from "./pineconeParams";

type ProductWriteDeps = {
  algoliasearch: typeof import("algoliasearch").default;
  pinecone: typeof import("./services/pineconeVisualService");
  visualMeta: typeof import("./services/visualIndexMetadata");
  notif: typeof import("./notifications");
};

let productWriteDepsPromise: Promise<ProductWriteDeps> | null = null;

function loadProductWriteDeps(): Promise<ProductWriteDeps> {
  if (!productWriteDepsPromise) {
    productWriteDepsPromise = Promise.all([
      import("algoliasearch"),
      import("./services/pineconeVisualService"),
      import("./services/visualIndexMetadata"),
      import("./notifications"),
    ]).then(([algoliaMod, pinecone, visualMeta, notif]) => ({
      algoliasearch: algoliaMod.default,
      pinecone,
      visualMeta,
      notif,
    }));
  }
  return productWriteDepsPromise;
}

/**
 * Algolia + Pinecone + push produits « featured ».
 * Imports lourds en lazy-load pour que l’analyse Firebase au déploiement reste &lt; 10s.
 */
export const onProductWrite = onDocumentWritten(
  {
    document: "products/{productId}",
    secrets: [pineconeApiKey],
    timeoutSeconds: 120,
    retry: false,
  },
  async (event) => {
    const { algoliasearch, pinecone, visualMeta, notif } =
      await loadProductWriteDeps();

    const getAlgoliaIndex = () => createAlgoliaProductsIndex(algoliasearch);

    const productId = event.params.productId;
    const before = event.data?.before;
    const after = event.data?.after;
    const index = getAlgoliaIndex();

    if (!after) {
      await index.deleteObject(productId);
      try {
        await admin.firestore().collection("product_image_embeddings").doc(productId).delete();
      } catch (e) {
        console.warn("Suppression embedding image:", e);
      }
      if (pinecone.isPineconeConfigured()) {
        try {
          await pinecone.deleteProductVector(productId);
        } catch (e) {
          console.warn("Suppression Pinecone:", e);
        }
      }
      return;
    }

    const data = after.data();
    if (!data) return;

    /**
     * Désactivation (cascade boutique ou action manuelle) : même traitement
     * Algolia qu’une suppression de document. Sans ça, `saveObject` réindexerait
     * le produit après un `isActive=false`. On ne touche pas aux embeddings
     * Firestore ni à Pinecone (le document produit existe toujours).
     */
    if (shouldRemoveProductFromAlgolia(data)) {
      try {
        await index.deleteObject(productId);
      } catch (err) {
        console.error("Algolia deleteObject (produit inactif):", err);
      }
      return;
    }

    const record: Record<string, unknown> = {
      objectID: productId,
      name: data.name || "Produit sans nom",
      nameLower: (data.name || "").toLowerCase(),
      category: data.categoryName || data.category || "Général",
      price: data.priceXOF ?? data.price ?? 0,
      imageUrl: data.mainImage || data.imageUrl || null,
      featured: data.featured === true,
      updatedAt: Date.now(),
    };

    if (typeof data.defaultLocale === "string" && data.defaultLocale.trim()) {
      record.defaultLocale = data.defaultLocale.trim();
    }

    /** Aligné avec `getLocalizedProductText` (apps/mobile/src/utils/productLocale.ts) */
    const ln = data.localizedNames;
    if (ln && typeof ln === "object" && !Array.isArray(ln)) {
      record.localizedNames = ln;
    }
    const ld = data.localizedDescriptions;
    if (ld && typeof ld === "object" && !Array.isArray(ld)) {
      record.localizedDescriptions = ld;
    }
    const i18nNest = data.i18n;
    if (i18nNest && typeof i18nNest === "object" && !Array.isArray(i18nNest)) {
      record.i18n = i18nNest;
    }
    const attrsLoc = data.attributesLocalized;
    if (Array.isArray(attrsLoc) && attrsLoc.length > 0) {
      record.attributesLocalized = attrsLoc;
    }
    for (const key of [
      "name_en",
      "name_fr",
      "name_zh",
      "name_ar",
      "name_de",
      "name_es",
      "name_pt",
      "description_en",
      "description_fr",
      "description_zh",
      "description_ar",
    ] as const) {
      if (typeof data[key] === "string" && (data[key] as string).trim()) {
        record[key] = data[key];
      }
    }

    try {
      await index.saveObject(record);

      if (pinecone.isPineconeConfigured()) {
        try {
          const embSnap = await admin
            .firestore()
            .collection("product_image_embeddings")
            .doc(productId)
            .get();
          const embDoc = embSnap.data();
          const emb = embDoc?.embedding;
          const ph =
            typeof embDoc?.perceptualHashHex === "string"
              ? embDoc.perceptualHashHex
              : undefined;
          if (Array.isArray(emb) && emb.length >= 64) {
            const vec = emb.map((x: unknown) => Number(x));
            await pinecone.upsertProductVector(
              productId,
              vec,
              visualMeta.visualMetadataFromProduct(productId, data, {
                perceptualHashHex: ph,
              }),
            );
          }
        } catch (e) {
          console.warn("Mise à jour métadonnées Pinecone:", e);
        }
      }

      const isCreate = !before?.exists;
      const wasFeatured = Boolean(
        before?.exists && before.data()?.featured === true,
      );
      const isFeatured = data.featured === true;
      const productName =
        typeof data.name === "string" && data.name.trim()
          ? data.name.trim()
          : "un produit";

      /**
       * Une seule push par produit créé. Le client + Render + les updates
       * (id, traductions) ne doivent plus renvoyer le même message.
       */
      if (isCreate) {
        const key = notif.newProductIdempotencyKey(productId);
        if (await notif.claimNotificationOnce(key, "onProductWrite.create")) {
          await notif.sendGlobalPushNotification(
            "Nouveau produit sur A2Express",
            productName,
            { productId, type: "new_product" },
          );
        }
      } else if (isFeatured && !wasFeatured) {
        const key = notif.featuredProductIdempotencyKey(productId);
        if (await notif.claimNotificationOnce(key, "onProductWrite.featured")) {
          await notif.sendGlobalPushNotification(
            "🔥 Nouveau sur A2Express !",
            `Découvrez : ${productName}.`,
            { productId, type: "featured_product" },
          );
        }
      }
    } catch (err) {
      console.error("Erreur:", err);
    }
  },
);
