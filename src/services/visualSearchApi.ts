import { API_BASE, toImage } from "@/config/api";
import type { VisualSearchDescriptor } from "@/services/imageSearchGemini";

export type ApiVectorProduct = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  visualScore?: number;
};

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function searchServerVisualProducts(
  query: string,
  descriptor?: VisualSearchDescriptor | null,
  limit = 20
): Promise<ApiVectorProduct[]> {
  const response = await fetch(`${API_BASE}/products/visual-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      descriptor,
      limit,
    }),
  });

  if (!response.ok) {
    throw new Error("Erreur recherche vectorielle serveur");
  }

  const payload = await safeJson<{ results?: ApiVectorProduct[] }>(response);
  return Array.isArray(payload?.results)
    ? payload.results.map((item) => ({
        ...item,
        imageUrl: item.imageUrl ? toImage(item.imageUrl) : item.imageUrl,
      }))
    : [];
}

export async function getPublicApiProduct(productId: string) {
  const response = await fetch(`${API_BASE}/products/public/${productId}`);
  if (!response.ok) {
    throw new Error("Produit API introuvable");
  }

  const payload = await safeJson<Record<string, any>>(response);
  if (!payload) {
    throw new Error("Produit API invalide");
  }

  return {
    ...payload,
    mainImage: payload.mainImage ? toImage(String(payload.mainImage)) : payload.mainImage,
    imageUrl: payload.imageUrl ? toImage(String(payload.imageUrl)) : payload.imageUrl,
    images: Array.isArray(payload.images)
      ? payload.images.map((item: string) => toImage(String(item)))
      : [],
  };
}

export async function getPublicApiProductsByCategory(categoryId: string, limit = 12) {
  const response = await fetch(`${API_BASE}/products/by-category/${categoryId}?limit=${limit}`);
  if (!response.ok) {
    throw new Error("Produits API de catégorie introuvables");
  }

  const payload = await safeJson<Array<Record<string, any>>>(response);
  return Array.isArray(payload)
    ? payload.map((item) => ({
        ...item,
        mainImage: item.imageUrl ? toImage(String(item.imageUrl)) : item.mainImage,
        imageUrl: item.imageUrl ? toImage(String(item.imageUrl)) : item.imageUrl,
        images: item.imageUrl ? [toImage(String(item.imageUrl))] : [],
        minOrder: 1,
        currency: "XOF",
        supplier: "ASSMA",
        companyName: "ASSMA",
        stockQuantity: 100,
        inStock: true,
      }))
    : [];
}
