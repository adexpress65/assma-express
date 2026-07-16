import Constants from "expo-constants";
/** API classique (cacheDirectory, copyAsync, EncodingType) — le module racine v19 n’expose plus EncodingType. */
import * as FileSystem from "expo-file-system/legacy";
import {
  ImageManipulator as ExpoImageManipulator,
  manipulateAsync,
  SaveFormat,
} from "expo-image-manipulator";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";
import { toImage } from "@/config/api";
import {
  catalogCategoryMatchesSuperCategory,
  hitTextPassesCategoryFilter,
  inferSuperCategoryFromQueryText,
  type SuperCategory,
  type VisualSearchDescriptor,
} from "@/services/imageSearchGemini";
import type { AlgoliaHit } from "@/types/product";
import { VISUAL_SEARCH_RECALL_LOCK } from "@/config/visualSearchRecallLock";

/** Réponse HTTP de la Cloud Function `visualImageSearch` */
export type ApiVectorProduct = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  visualScore?: number;
  similarity?: number;
  /** Score composite serveur (0–1) après popularité / prix / catégorie. */
  compositeScore?: number;
  rankingComponents?: {
    cosineTerm: number;
    popularityTerm: number;
    priceTerm: number;
    categoryTerm: number;
    colorTerm?: number;
    shapeTerm?: number;
    visualBlend?: number;
  };
  sourceType?: string;
  /** interne = vendeur/entreprise plateforme (double passe Pinecone). */
  catalogScope?: string | null;
};

/** Entrée pour l’API vectorielle : URI locale (préféré) ou base64 (sans troncature côté client). */
export type VisualVectorImageInput =
  | { sourceUri: string; mimeHint?: string }
  | { imageBase64: string; mimeType?: string };

/** Options `searchVisualImageVector` (pagination + hints serveur). */
export type SearchVisualImageOptions = {
  limit?: number;
  offset?: number;
  categoryHint?: string;
  /** Mots-clés explicites (recherche texte, labels). */
  intentKeywords?: string[];
  /** Alias sémantique : indices issus d’analyse d’image (Gemini, etc.). */
  imageHints?: string[];
  minSimilarity?: number;
  duplicateSimilarityThreshold?: number;
  /** Budget temps côté serveur (ms), défaut ~5000. */
  budgetMs?: number;
  /** Dédup visuel fin (lectures Firestore supplémentaires) — désactivé par défaut pour la latence. */
  deepDiversify?: boolean;
  /** Réponse ultra-rapide : top 10 ordre vectoriel, sans ranking / diversification. */
  fastPath?: boolean;
  /** Avec fastPath : un batch Firestore pour enrichir noms / catégories (10 produits). */
  fastPathEnrichProducts?: boolean;
  /** Ne pas utiliser le cache mémoire côté fonction. */
  skipCache?: boolean;
  /** Métadonnées serveur de classement (désactive le cache côté fonction). */
  rankingDebug?: boolean;
  /** Analyser l’écart vs le leader (avec `rankingDebug`). */
  focusProductId?: string;
};

/**
 * Seuil cosinus côté UI — calibré pour le rappel e‑commerce (souvent 0,22–0,35 pour « même produit / même rayon »).
 * Trop haut → peu de résultats et le SKU exact peut disparaître après filtres catégorie.
 */
export const STRICT_VISUAL_MIN_SIMILARITY =
  VISUAL_SEARCH_RECALL_LOCK.strictVisualMinSimilarity;

/**
 * Plancher plus bas pour réinjecter des voisins depuis la réponse API brute quand le filtre
 * super-catégorie + `STRICT_*` laisse trop peu de lignes (voir `supplementVectorHitsForRecall`).
 */
export const RELAXED_VECTOR_RECALL_MIN = 0.19;

/** Cible minimale de hits vectoriels avant fusion / grille (alignée sur la limite API 50). */
export const MIN_VECTOR_HITS_TARGET_UI =
  VISUAL_SEARCH_RECALL_LOCK.minVectorHitsTargetUi;

/** @deprecated Ancien seuil ; la recherche visuelle utilise STRICT_VISUAL_MIN_SIMILARITY. */
export const MIN_VECTOR_CLIP_SIMILARITY = STRICT_VISUAL_MIN_SIMILARITY;
/** @deprecated Repli rappel ; préférer `RELAXED_VECTOR_RECALL_MIN` + supplement. */
export const MIN_VECTOR_CLIP_SIMILARITY_RELAXED = RELAXED_VECTOR_RECALL_MIN;

function vectorProductText(item: ApiVectorProduct): string {
  return [item.name, item.categoryName, item.description].filter(Boolean).join(" ");
}

/**
 * Filtre : super-catégorie Gemini + rayon catalogue + cosinus ≥ STRICT_VISUAL_MIN_SIMILARITY.
 * Pour le rappel, combiner avec `supplementVectorHitsForRecall` côté hook.
 */
export function applyClipVectorPostFilters(
  raw: ApiVectorProduct[],
  descriptor: VisualSearchDescriptor | null | undefined,
  searchQueryFallback: string,
  primaryTokens: string[],
): ApiVectorProduct[] {
  const superCat =
    descriptor?.detectedSuperCategory ?? inferSuperCategoryFromQueryText(searchQueryFallback);

  let pool = raw;
  if (superCat) {
    const strictPool = raw.filter((item) => {
      if (!hitTextPassesCategoryFilter(vectorProductText(item), superCat, primaryTokens)) {
        return false;
      }
      const catName = item.categoryName || "";
      const catExtra = item.categoryId != null ? String(item.categoryId) : "";
      return catalogCategoryMatchesSuperCategory(catName, catExtra, superCat);
    });
    const minStrict = Math.max(
      VISUAL_SEARCH_RECALL_LOCK.strictCatalogMinAbsolute,
      Math.floor(raw.length * VISUAL_SEARCH_RECALL_LOCK.strictCatalogMinRatioOfRaw),
    );
    /** Rayons Firestore souvent imparfaits : un filtre catalogue strict vide la liste alors que CLIP est bon — repli texte + CLIP. */
    if (strictPool.length >= minStrict) {
      pool = strictPool;
    } else {
      pool = raw.filter((item) => {
        if (!hitTextPassesCategoryFilter(vectorProductText(item), superCat, primaryTokens)) {
          return false;
        }
        return true;
      });
    }
  }

  return filterApiVectorsStrictSimilarity(pool, STRICT_VISUAL_MIN_SIMILARITY);
}

/** Cosinus 0–1 à partir de la réponse API (`similarity` ou `visualScore`/100). */
export function clipSimilarityFromApiItem(item: ApiVectorProduct): number {
  if (typeof item.similarity === "number" && !Number.isNaN(item.similarity)) {
    return item.similarity;
  }
  const vs = Number(item.visualScore);
  if (!Number.isNaN(vs) && vs > 0) return vs / 100;
  return 0;
}

export function filterApiVectorsStrictSimilarity(
  items: ApiVectorProduct[],
  minCosine = STRICT_VISUAL_MIN_SIMILARITY,
): ApiVectorProduct[] {
  return items.filter((item) => clipSimilarityFromApiItem(item) >= minCosine);
}

/**
 * Si le filtrage (super-catégorie Gemini + similarité stricte) ne laisse que très peu de produits,
 * complète avec les meilleurs voisins CLIP de la **réponse brute** sous un cosinus légèrement plus bas,
 * sans repasser par le filtre texte/catégorie (le classement serveur reste la référence).
 */
export function supplementVectorHitsForRecall(
  raw: ApiVectorProduct[],
  filtered: ApiVectorProduct[],
  opts?: { minTotal?: number; maxExtra?: number; relaxedMin?: number },
): ApiVectorProduct[] {
  const minTotal = opts?.minTotal ?? MIN_VECTOR_HITS_TARGET_UI;
  const maxExtra = opts?.maxExtra ?? 40;
  const relaxedMin = opts?.relaxedMin ?? RELAXED_VECTOR_RECALL_MIN;
  if (filtered.length >= minTotal || !raw.length) return filtered;

  const seen = new Set(filtered.map((x) => x.id));
  const relaxed = filterApiVectorsStrictSimilarity(raw, relaxedMin)
    .filter((x) => !seen.has(x.id))
    .sort((a, b) => clipSimilarityFromApiItem(b) - clipSimilarityFromApiItem(a));
  const need = Math.min(maxExtra, minTotal - filtered.length + 12);
  const extra = relaxed.slice(0, Math.max(need, 0));
  const merged = [...filtered, ...extra];
  merged.sort((a, b) => clipSimilarityFromApiItem(b) - clipSimilarityFromApiItem(a));
  return merged;
}

/** Garde uniquement les produits avec similarité strictement supérieure au seuil (usage legacy). */
export function filterVectorProductsByMinSimilarity(
  items: ApiVectorProduct[],
  minSimilarity = STRICT_VISUAL_MIN_SIMILARITY,
): ApiVectorProduct[] {
  return items.filter((item) => clipSimilarityFromApiItem(item) > minSimilarity);
}

/** Filtre les hits grille (post-fusion) selon le verrouillage de catégorie catalogue. */
export function filterSearchHitsByCategoryLock(
  hits: AlgoliaHit[],
  superCat: SuperCategory | null | undefined,
): AlgoliaHit[] {
  if (!superCat) return hits;
  return hits.filter(
    (hit) =>
      hit.isExactImageMatch ||
      catalogCategoryMatchesSuperCategory(hit.categoryName, hit.category, superCat),
  );
}

const DEFAULT_VISUAL_FN =
  "https://europe-west1-assma-expresse.cloudfunctions.net/visualImageSearch";

function getVisualImageSearchUrl(): string {
  const extra = Constants.expoConfig?.extra as
    | { visualImageSearchUrl?: string }
    | undefined;
  return (
    extra?.visualImageSearchUrl ||
    process.env.EXPO_PUBLIC_VISUAL_IMAGE_SEARCH_URL ||
    DEFAULT_VISUAL_FN
  );
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** JPEG exporté : taille minimale (octets) pour éviter les envois vides / corrompus. */
const MIN_JPEG_BYTES_FOR_VECTOR_UPLOAD = 2048;
/**
 * Image plus légère = moins d’octets en JSON (upload) + moins de travail côté fonction (CLIP).
 * 720 px / ~0,82 reste largement suffisant pour l’embedding visuel.
 */
const VECTOR_JPEG_MAX_WIDTH = 720;
const VECTOR_JPEG_COMPRESS = 0.82;

/**
 * Prépare une URI locale pour `manipulateAsync` (fichier ou base64 → fichier cache, sans modifier la chaîne base64).
 */
async function resolveLocalUriForVisualManipulator(
  input: VisualVectorImageInput,
): Promise<{ localUri: string; cleanupUri?: string; base64SourceLength?: number }> {
  if ("sourceUri" in input && input.sourceUri?.trim()) {
    return { localUri: input.sourceUri.trim() };
  }
  if (!("imageBase64" in input) || !String(input.imageBase64 || "").trim()) {
    throw new Error("Aucune image fournie pour la recherche vectorielle.");
  }
  const raw = String(input.imageBase64);
  const base64SourceLength = raw.length;
  const t = raw.trim();
  let b64Payload = t;
  if (t.startsWith("data:")) {
    const comma = t.indexOf(",");
    if (comma < 0) {
      throw new Error("Data URL image invalide (virgule manquante).");
    }
    b64Payload = t.slice(comma + 1);
  }
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error("Stockage cache indisponible sur l’appareil.");
  }
  /** Extension `.jpg` : certains chemins natifs détectent mal le format avec `.bin`. */
  const dest = `${cacheDir}visual-search-src-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(dest, b64Payload, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { localUri: dest, cleanupUri: dest, base64SourceLength };
}

/**
 * Redimensionnement + JPEG via l’API objet (SDK 52+), avec repli sur `manipulateAsync`.
 * Évite des erreurs JSI / bridge observées avec certains builds quand seul l’ancien chemin est utilisé.
 */
/**
 * Ne lire que `uri` (contrat officiel). Ne pas toucher à d’autres clés : sur Turbo Modules,
 * l’accès à une propriété absente (ex. jpegOutUri) peut lever une exception.
 */
function coerceManipulatorOutputUri(result: {
  uri?: string;
  width: number;
  height: number;
  base64?: string;
}): { uri: string; width: number; height: number; base64?: string } {
  let uri = "";
  try {
    const u = result.uri;
    if (typeof u === "string" && u.length > 0) uri = u;
  } catch {
    /* résultat natif atypique */
  }
  if (!uri) {
    throw new Error(
      "Conversion JPEG : sortie sans URI (expo-image-manipulator n’a pas renvoyé de fichier).",
    );
  }
  return {
    uri,
    width: result.width,
    height: result.height,
    base64: result.base64,
  };
}

async function resizeToJpegForVector(localUri: string): Promise<{
  uri: string;
  width: number;
  height: number;
  base64?: string;
}> {
  try {
    const saved = await manipulateAsync(
      localUri,
      [{ resize: { width: VECTOR_JPEG_MAX_WIDTH } }],
      { compress: VECTOR_JPEG_COMPRESS, format: SaveFormat.JPEG },
    );
    return coerceManipulatorOutputUri(saved);
  } catch (e) {
    console.warn(
      "[visualSearchApi] manipulateAsync failed, fallback nouvelle API manipulate()",
      e,
    );
    const ctx = ExpoImageManipulator.manipulate(localUri);
    try {
      ctx.resize({ width: VECTOR_JPEG_MAX_WIDTH });
      const image = await ctx.renderAsync();
      try {
        const out = await image.saveAsync({
          compress: VECTOR_JPEG_COMPRESS,
          format: SaveFormat.JPEG,
        });
        return coerceManipulatorOutputUri(out);
      } finally {
        image.release();
      }
    } finally {
      ctx.release();
    }
  }
}

/**
 * Recherche par image réelle : embedding CLIP côté serveur + classement e-commerce
 * (cosinus, popularité, prix, catégorie) + diversification.
 *
 * Envoie le JPEG en **JSON** (`imageBase64` + mêmes clés que l’ancien champ `meta`) pour éviter les bugs
 * Android / FormData sur `file://` (ex. erreur « jpegOutUri »). Conversion locale via `expo-image-manipulator`.
 *
 * @param limitOrOptions — nombre de résultats (page) ou options (pagination, seuils).
 */
/** Métadonnées pagination renvoyées par `visualImageSearch` (corps JSON). */
export type VisualImageSearchResponseMeta = {
  hasMore?: boolean;
  totalRanked?: number;
  offset?: number;
  limit?: number;
  returned?: number;
};

export type SearchVisualImageVectorResult = {
  results: ApiVectorProduct[];
  metadata: VisualImageSearchResponseMeta;
};

export async function searchVisualImageVector(
  imageInput: VisualVectorImageInput,
  limitOrOptions: number | SearchVisualImageOptions = 10,
): Promise<SearchVisualImageVectorResult> {
  const opts: SearchVisualImageOptions =
    typeof limitOrOptions === "number"
      ? { limit: limitOrOptions }
      : limitOrOptions;
  /** Plafond aligné sur la Cloud Function (`pageLimit` max 50). */
  const pageLimit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));

  const url = getVisualImageSearchUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  let cleanupUri: string | undefined;
  /** Fichier JPEG produit par le manipulateur — à supprimer dans `finally` (cache). */
  let outputJpegPath: string | undefined;
  try {
    const { localUri, cleanupUri: c, base64SourceLength } =
      await resolveLocalUriForVisualManipulator(imageInput);
    cleanupUri = c;

    const manipulated = await resizeToJpegForVector(localUri);
    console.info("[visualSearchApi] JPEG resize result", {
      uri: manipulated.uri,
      width: manipulated.width,
      height: manipulated.height,
      hasBase64: Boolean(manipulated.base64),
    });
    if (!manipulated.uri) {
      throw new Error("Conversion JPEG impossible (URI de sortie manquante).");
    }
    outputJpegPath = manipulated.uri;
    console.info("[visualSearchApi] final JPEG URI for multipart upload", {
      uri: outputJpegPath,
    });

    const info = await FileSystem.getInfoAsync(manipulated.uri, { size: true });
    const jpegBytes =
      info.exists && typeof info.size === "number" ? info.size : 0;
    if (jpegBytes < MIN_JPEG_BYTES_FOR_VECTOR_UPLOAD) {
      throw new Error(
        "Image trop petite ou illisible après conversion. Reprenez une photo plus nette du produit.",
      );
    }

    console.info("[visualSearchApi] envoi vectoriel multipart JPEG", {
      jpegBytes,
      ...(base64SourceLength != null
        ? { base64SourceLengthBeforeSend: base64SourceLength }
        : {}),
    });

    const meta: Record<string, unknown> = {
      mimeType: "image/jpeg",
      limit: pageLimit,
      offset,
    };
    if (opts.categoryHint) meta.categoryHint = opts.categoryHint;
    if (opts.intentKeywords?.length) meta.intentKeywords = opts.intentKeywords;
    if (opts.imageHints?.length) meta.imageHints = opts.imageHints;
    if (typeof opts.minSimilarity === "number")
      meta.minSimilarity = opts.minSimilarity;
    if (typeof opts.duplicateSimilarityThreshold === "number")
      meta.duplicateSimilarityThreshold = opts.duplicateSimilarityThreshold;
    if (typeof opts.budgetMs === "number") meta.budgetMs = opts.budgetMs;
    if (opts.deepDiversify === true) meta.deepDiversify = true;
    if (opts.fastPath === true) meta.fastPath = true;
    if (opts.fastPathEnrichProducts === true) meta.fastPathEnrichProducts = true;
    if (opts.skipCache === true) meta.skipCache = true;
    if (opts.rankingDebug === true) {
      meta.rankingDebug = true;
      meta.skipCache = true;
    }
    const fp = opts.focusProductId?.trim();
    if (fp) meta.focusProductId = fp;

    const imageBase64 = await FileSystem.readAsStringAsync(manipulated.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!imageBase64 || imageBase64.length < 500) {
      throw new Error(
        "Lecture du JPEG converti impossible (fichier vide ou inaccessible). Réessayez.",
      );
    }

    /** LOCK : JSON `imageBase64` (pas multipart `file://`) — régression Android `jpegOutUri` / FormData. */
    const jsonBody = JSON.stringify({
      ...meta,
      imageBase64,
    });

    console.info("[visualSearchApi] POST application/json (imageBase64)", {
      url,
      meta,
      jpegBytes,
      imageBase64Chars: imageBase64.length,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonBody,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await safeJson<{ error?: string }>(response);
      throw new Error(
        errBody?.error ||
          `Échec de l’envoi de l’image (${response.status}). Réessayez dans un instant.`,
      );
    }

    const payload = await safeJson<{
      results?: ApiVectorProduct[];
      metadata?: VisualImageSearchResponseMeta;
    }>(response);
    const responseMeta =
      payload?.metadata && typeof payload.metadata === "object"
        ? payload.metadata
        : {};
    const rows = Array.isArray(payload?.results) ? payload!.results! : [];
    const results = rows.map((item) => ({
      ...item,
      imageUrl: item.imageUrl ? toImage(String(item.imageUrl)) : item.imageUrl,
    }));
    return { results, metadata: responseMeta };
  } finally {
    clearTimeout(timer);
    if (cleanupUri) {
      await FileSystem.deleteAsync(cleanupUri, { idempotent: true }).catch(() => {});
    }
    if (outputJpegPath && outputJpegPath !== cleanupUri) {
      await FileSystem.deleteAsync(outputJpegPath, { idempotent: true }).catch(() => {});
    }
  }
}

export interface RawApiProduct {
  id?: string;
  name?: string;
  price?: number;
  mainImage?: string;
  imageUrl?: string;
  images?: string[];
  description?: string;
  categoryId?: string;
  categoryName?: string;
  [key: string]: unknown;
}

function firestoreDocToRaw(id: string, data: Record<string, unknown>): RawApiProduct {
  const mainImage = (data.mainImage || data.imageUrl || data.image) as string | undefined;
  const imageUrl = (data.imageUrl || data.mainImage || data.image) as string | undefined;
  return {
    ...data,
    id,
    name: data.name as string,
    price: Number(data.price) || 0,
    mainImage: mainImage ? toImage(String(mainImage)) : mainImage,
    imageUrl: imageUrl ? toImage(String(imageUrl)) : imageUrl,
    images: Array.isArray(data.images)
      ? (data.images as string[]).map((u) => toImage(String(u)))
      : imageUrl
        ? [toImage(String(imageUrl))]
        : [],
  };
}

/** Détail produit depuis Firestore uniquement (plus d'API Prisma). */
export async function getPublicApiProduct(productId: string): Promise<RawApiProduct> {
  const ref = doc(db, "products", productId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Produit introuvable");
  }
  return firestoreDocToRaw(snap.id, snap.data() as Record<string, unknown>);
}

export async function getPublicApiProductsByCategory(
  categoryId: string,
  maxItems = 12,
): Promise<RawApiProduct[]> {
  const q = query(
    collection(db, "products"),
    where("categoryId", "==", categoryId),
    limit(maxItems),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    firestoreDocToRaw(d.id, d.data() as Record<string, unknown>),
  );
}

/** MIME pour l'API CLIP à partir du nom de fichier picker. */
export function guessImageMimeFromFileName(fileName: string): string {
  const l = String(fileName || "").toLowerCase();
  if (l.endsWith(".png")) return "image/png";
  if (l.endsWith(".webp")) return "image/webp";
  if (l.endsWith(".gif")) return "image/gif";
  if (l.endsWith(".heic") || l.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

async function base64ViaManipulator(uri: string): Promise<string | null> {
  try {
    const r = await manipulateAsync(
      uri,
      [{ resize: { width: VECTOR_JPEG_MAX_WIDTH } }],
      { compress: VECTOR_JPEG_COMPRESS, format: SaveFormat.JPEG, base64: true },
    );
    return r.base64 && r.base64.length > 0 ? r.base64 : null;
  } catch (e) {
    console.warn("[getBase64FromImageUri] manipulateAsync", e);
    return null;
  }
}

/**
 * Lit une image locale (file://, content://, ph://…) en base64.
 * Repli : `expo-image-manipulator` si `copyAsync` / `readAsStringAsync` échoue.
 */
export async function getBase64FromImageUri(uri: string): Promise<string | null> {
  if (!uri || typeof uri !== "string") return null;

  const readWithFs = async (path: string): Promise<string | null> => {
    try {
      const b64 = await FileSystem.readAsStringAsync(path, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return b64 && b64.length > 0 ? b64 : null;
    } catch {
      return null;
    }
  };

  try {
    let readPath = uri;
    if (!uri.startsWith("file://")) {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return (await base64ViaManipulator(uri)) ?? null;
      const dest = `${cacheDir}visual-search-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      readPath = dest;
    }
    const direct = await readWithFs(readPath);
    if (direct) return direct;
  } catch (e) {
    console.warn("[getBase64FromImageUri] fs", e);
  }

  return (await base64ViaManipulator(uri)) ?? null;
}
