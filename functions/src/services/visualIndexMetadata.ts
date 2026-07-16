import type { DocumentData } from "firebase-admin/firestore";

/** Métadonnées Pinecone + affichage rapide côté client (React Native). */
export type VisualVectorMetadata = {
  productId: string;
  price: number;
  imageUrl: string;
  /** Produits vendeurs / entreprises plateforme vs agrégés sans vendeur. */
  catalogScope: "internal" | "external";
  /** pHash 64 bits (hex 16 car.) — indexé avec le vecteur pour détection copie exacte. */
  perceptualHashHex?: string;
};

export function catalogScopeFromProduct(data: DocumentData | undefined): "internal" | "external" {
  if (!data) return "external";
  const sid = data.sellerId;
  const cid = data.companyId;
  const hasSeller = sid != null && String(sid).trim().length > 0;
  const hasCompany = cid != null && String(cid).trim().length > 0;
  return hasSeller || hasCompany ? "internal" : "external";
}

export function visualMetadataFromProduct(
  productId: string,
  data: DocumentData,
  extras?: { perceptualHashHex?: string },
): VisualVectorMetadata {
  const raw = data.mainImage || data.imageUrl || data.image;
  const url = raw != null && typeof raw === "string" ? raw.trim() : "";
  return {
    productId,
    price: Number(data.price) || 0,
    imageUrl: url,
    catalogScope: catalogScopeFromProduct(data),
    ...(extras?.perceptualHashHex
      ? { perceptualHashHex: extras.perceptualHashHex }
      : {}),
  };
}
