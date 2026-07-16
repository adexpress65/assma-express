/**
 * Service de correspondance directe d'image.
 *
 * Passe 1 de la recherche visuelle : avant toute analyse IA / similarité,
 * on vérifie si l'image téléversée correspond exactement à un produit
 * déjà stocké dans Firestore (par URL, nom de fichier Storage, ou hash de chemin).
 */
import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { db } from '@/config/firebase';
import type { AlgoliaHit } from '@/types/product';
import { DIRECT_EXACT_TOP_SCORE } from '@/services/visualSearchAlgoliaFilters';
import {
  DIRECT_IMAGE_MATCH_MAX_PAGES,
  paceFirestorePage,
  VISUAL_FIRESTORE_PAGE_SIZE,
} from '@/services/visualSearchFirestoreScan';

/** Score sur le hit Firestore pour un match URL/chemin exact (aligné sur le hook). */
const DIRECT_MATCH_SCORE = DIRECT_EXACT_TOP_SCORE;
const DIRECT_FINGERPRINT_SCORE = 120000;
const fingerprintCache = new Map<string, string | null>();
const FINGERPRINT_STORAGE_KEY = 'visual-image-fingerprint-cache-v1';
let persistedFingerprintCacheLoaded = false;

/**
 * Extrait la partie « chemin encodé » d'une URL Firebase Storage.
 * Ex : "https://firebasestorage.googleapis.com/v0/b/bucket/o/products%2Fimg.jpg?alt=media&token=xxx"
 *   → "products/img.jpg"
 */
function extractStoragePath(url: string): string | null {
  try {
    const match = url.match(/\/o\/([^?#]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // URL malformée — ignorée
  }
  return null;
}

/**
 * Extrait le nom de fichier brut d'une URL quelconque.
 * Ex : ".../products%2Frobe-rose-enfant.jpg?alt=media" → "robe-rose-enfant.jpg"
 */
function extractFileName(url: string): string {
  try {
    const pathPart = extractStoragePath(url) ?? url;
    const noQuery = pathPart.split('?')[0];
    const segments = noQuery.split('/');
    return segments[segments.length - 1].toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Normalise une URL pour la comparaison : retire les params de token/query,
 * décode, et lower-case.
 */
function normalizeUrl(url: string): string {
  try {
    const noToken = url.split('?')[0].split('#')[0];
    return decodeURIComponent(noToken).toLowerCase().trim();
  } catch {
    return url.toLowerCase().trim();
  }
}

function getAllImageUrls(data: Record<string, unknown>): string[] {
  const raw = [
    data.mainImage,
    data.imageUrl,
    data.image,
    ...(Array.isArray(data.images) ? data.images : []),
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  return raw;
}

function sanitizeFirebaseUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.includes('firebasestorage.googleapis.com') && !trimmed.includes('alt=media')) {
    return trimmed.includes('?') ? `${trimmed}&alt=media` : `${trimmed}?alt=media`;
  }
  return trimmed;
}

type PageWalkOptions = {
  /** Nombre max de pages (× VISUAL_FIRESTORE_PAGE_SIZE). */
  maxPages: number;
  /** Si false, pas de pause entre pages (match direct — réponse en quelques secondes). */
  pace: boolean;
};

/**
 * @returns true pour arrêter la pagination (ex. match URL exact trouvé).
 */
async function forEachProductPage(
  onPage: (docs: QueryDocumentSnapshot[]) => Promise<boolean | void>,
  opts: PageWalkOptions,
): Promise<void> {
  const col = collection(db, 'products');
  let last: QueryDocumentSnapshot | undefined;
  for (let page = 0; page < opts.maxPages; page += 1) {
    if (opts.pace) {
      await paceFirestorePage(page);
    }
    const q = last
      ? query(col, orderBy(documentId()), startAfter(last), limit(VISUAL_FIRESTORE_PAGE_SIZE))
      : query(col, orderBy(documentId()), limit(VISUAL_FIRESTORE_PAGE_SIZE));
    const snap = await getDocs(q);
    if (snap.empty) break;
    const stop = await onPage(snap.docs);
    if (stop === true) break;
    last = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < VISUAL_FIRESTORE_PAGE_SIZE) break;
  }
}

function docToAlgoliaHit(docId: string, data: Record<string, unknown>): AlgoliaHit {
  const images = getAllImageUrls(data).map(sanitizeFirebaseUrl);
  const mainImage = images[0];

  return {
    objectID: docId,
    name: String(data.name ?? 'Produit'),
    price: Number(data.price) || 0,
    currency: String(data.currency ?? 'XOF'),
    supplier: String(data.supplier ?? data.companyName ?? 'Fournisseur'),
    companyName: String(data.companyName ?? data.supplier ?? 'Fournisseur'),
    companyId: data.companyId ? String(data.companyId) : undefined,
    mainImage,
    imageUrl: (data.imageUrl as string | undefined) ? sanitizeFirebaseUrl(data.imageUrl as string) : mainImage,
    image: (data.image as string | undefined) ? sanitizeFirebaseUrl(data.image as string) : mainImage,
    images,
    featured: Boolean(data.featured),
    category: data.category ? String(data.category) : undefined,
    categoryName: data.categoryName ? String(data.categoryName) : undefined,
    description: data.description ? String(data.description) : undefined,
    inStock: data.inStock !== false,
    hasFreeShipping: Boolean(data.hasFreeShipping),
    minOrder: Number(data.minOrder) || 1,
    visualScore: DIRECT_MATCH_SCORE,
    isExactImageMatch: true,
    sourceType: 'firebase',
  };
}

export interface DirectMatchResult {
  /** Produit(s) dont une image correspond exactement */
  exactMatches: AlgoliaHit[];
  /** Produit(s) dont le nom de fichier est très similaire */
  fileNameMatches: AlgoliaHit[];
}

/**
 * Recherche directe d'un produit par correspondance d'image.
 *
 * Stratégies testées (du plus strict au plus souple) :
 *   1. URL normalisée identique (sans query params)
 *   2. Même chemin Storage (ex : "products/robe-rose.jpg")
 *   3. Même nom de fichier (ex : "robe-rose.jpg")
 *
 * Retourne immédiatement les correspondances trouvées, triées par force.
 */
export async function findDirectImageMatch(
  imageUri: string,
  imageFileName?: string,
): Promise<DirectMatchResult> {
  const result: DirectMatchResult = { exactMatches: [], fileNameMatches: [] };

  if (!imageUri && !imageFileName) return result;

  const inputNorm = imageUri ? normalizeUrl(imageUri) : '';
  const inputPath = imageUri ? extractStoragePath(imageUri) : null;
  const inputFile = extractFileName(imageUri || imageFileName || '');
  const seenFileIds = new Set<string>();

  await forEachProductPage(
    async (docs) => {
      for (const docSnap of docs) {
        const data = docSnap.data() as Record<string, unknown>;

        if (data.status === 'draft' || data.isActive === false) continue;

        const productUrls = getAllImageUrls(data);
        if (productUrls.length === 0) continue;

        let isExactMatch = false;
        let isFileNameMatch = false;

        for (const pUrl of productUrls) {
          if (inputNorm && normalizeUrl(pUrl) === inputNorm) {
            isExactMatch = true;
            break;
          }

          if (inputPath) {
            const pPath = extractStoragePath(pUrl);
            if (pPath && pPath === inputPath) {
              isExactMatch = true;
              break;
            }
          }

          if (inputFile && inputFile.length > 4) {
            const pFile = extractFileName(pUrl);
            if (pFile && pFile === inputFile) {
              isFileNameMatch = true;
            }
          }
        }

        if (isExactMatch) {
          result.exactMatches.push(docToAlgoliaHit(docSnap.id, data));
          return true;
        }
        if (isFileNameMatch && !seenFileIds.has(docSnap.id)) {
          seenFileIds.add(docSnap.id);
          result.fileNameMatches.push(docToAlgoliaHit(docSnap.id, data));
        }
      }
      return undefined;
    },
    { maxPages: DIRECT_IMAGE_MATCH_MAX_PAGES, pace: false },
  );

  return result;
}

async function getImageFingerprint(imageUri: string): Promise<string | null> {
  if (!imageUri) return null;
  if (fingerprintCache.has(imageUri)) {
    return fingerprintCache.get(imageUri) ?? null;
  }

  await hydrateFingerprintCache();

  try {
    const localUri = await ensureLocalFingerprintSource(imageUri);
    if (!localUri) {
      fingerprintCache.set(imageUri, null);
      return null;
    }

    const manipulated = await manipulateAsync(
      localUri,
      [{ resize: { width: 24, height: 24 } }],
      {
        compress: 0.35,
        format: SaveFormat.JPEG,
        base64: true,
      },
    );

    const fingerprint = manipulated.base64
      ? `${manipulated.width}x${manipulated.height}:${manipulated.base64.slice(0, 768)}`
      : null;

    fingerprintCache.set(imageUri, fingerprint);
    await persistFingerprintCacheEntry(imageUri, fingerprint);
    return fingerprint;
  } catch (error) {
    console.warn('[directImageMatch] fingerprint error', imageUri, error);
    fingerprintCache.set(imageUri, null);
    await persistFingerprintCacheEntry(imageUri, null);
    return null;
  }
}

async function hydrateFingerprintCache(): Promise<void> {
  if (persistedFingerprintCacheLoaded) return;
  persistedFingerprintCacheLoaded = true;

  try {
    const raw = await AsyncStorage.getItem(FINGERPRINT_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string | null>;
    Object.entries(parsed).forEach(([key, value]) => {
      fingerprintCache.set(key, value);
    });
  } catch {
    // cache corrompu -> ignoré
  }
}

async function persistFingerprintCacheEntry(key: string, value: string | null): Promise<void> {
  try {
    const existingRaw = await AsyncStorage.getItem(FINGERPRINT_STORAGE_KEY);
    const existing = existingRaw ? (JSON.parse(existingRaw) as Record<string, string | null>) : {};
    existing[key] = value;
    await AsyncStorage.setItem(FINGERPRINT_STORAGE_KEY, JSON.stringify(existing));
  } catch {
    // échec cache non bloquant
  }
}

function buildLocalCachePath(uri: string): string {
  const safeName = encodeURIComponent(uri).replace(/%/g, '_').slice(0, 120);
  return `${FileSystem.cacheDirectory}fingerprints/${safeName}.img`;
}

async function ensureLocalFingerprintSource(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith('file://')) return uri;

  try {
    const targetDir = `${FileSystem.cacheDirectory}fingerprints/`;
    const dirInfo = await FileSystem.getInfoAsync(targetDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
    }

    const localPath = buildLocalCachePath(uri);
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      return localPath;
    }

    const downloaded = await FileSystem.downloadAsync(uri, localPath);
    return downloaded.uri;
  } catch (error) {
    console.warn('[directImageMatch] download error', uri, error);
    return null;
  }
}

function compareFingerprints(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;

  const size = Math.min(left.length, right.length);
  if (!size) return 0;

  let matches = 0;
  for (let index = 0; index < size; index += 1) {
    if (left[index] === right[index]) {
      matches += 1;
    }
  }

  return matches / size;
}

/**
 * Vérifie les meilleurs candidats visuels contre l'image source en calculant
 * une empreinte normalisée (resize + JPEG + base64). Si un candidat partage
 * la même empreinte, il est promu tout en haut.
 */
export async function promoteFingerprintExactMatch(
  sourceImageUri: string,
  hits: AlgoliaHit[],
  candidateLimit = 12,
): Promise<AlgoliaHit[]> {
  if (candidateLimit <= 0 || !sourceImageUri || hits.length === 0) {
    return hits;
  }

  const sourceFingerprint = await getImageFingerprint(sourceImageUri);
  if (!sourceFingerprint) {
    return hits;
  }

  const candidates = hits
    .filter((hit) => Boolean(hit.mainImage || hit.imageUrl || hit.image))
    .slice(0, candidateLimit);

  let bestMatchId: string | null = null;
  let bestSimilarity = 0;

  for (const hit of candidates) {
    const candidateUri = String(hit.mainImage || hit.imageUrl || hit.image || '');
    if (!candidateUri) continue;

    const candidateFingerprint = await getImageFingerprint(candidateUri);
    if (!candidateFingerprint) continue;

    const similarity = compareFingerprints(sourceFingerprint, candidateFingerprint);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatchId = hit.objectID;
    }
  }

  if (!bestMatchId || bestSimilarity < 0.985) {
    return hits;
  }

  return hits
    .map((hit) =>
      hit.objectID === bestMatchId
        ? {
            ...hit,
            visualScore: Math.max(Number(hit.visualScore ?? 0), DIRECT_FINGERPRINT_SCORE),
            isExactImageMatch: true,
            sourceType: hit.sourceType ?? 'firebase',
          }
        : hit,
    )
    .sort((a, b) => Number(b.visualScore ?? 0) - Number(a.visualScore ?? 0));
}

/**
 * Désactivé sur le chemin principal : télécharge des milliers d’images → plusieurs minutes et UI bloquée.
 * Réactiver seulement en tâche de fond / worker si besoin.
 */
export async function findGlobalFingerprintExactMatch(
  _sourceImageUri: string,
): Promise<AlgoliaHit | null> {
  return null;
}
