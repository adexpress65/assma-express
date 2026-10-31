import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const HASH_CACHE_KEY = 'image-hash-cache-v1';
const memoryHashCache = new Map<string, string | null>();
let hashCacheHydrated = false;

function fnv1aHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

async function hydrateHashCache(): Promise<void> {
  if (hashCacheHydrated) return;
  hashCacheHydrated = true;

  try {
    const raw = await AsyncStorage.getItem(HASH_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string | null>;
    Object.entries(parsed).forEach(([key, value]) => {
      memoryHashCache.set(key, value);
    });
  } catch {
    // cache non critique
  }
}

async function persistHashCacheEntry(key: string, value: string | null): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(HASH_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string | null>) : {};
    parsed[key] = value;
    await AsyncStorage.setItem(HASH_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // cache non critique
  }
}

function buildDownloadPath(uri: string): string {
  const encoded = encodeURIComponent(uri).replace(/%/g, '_').slice(0, 140);
  return `${FileSystem.cacheDirectory}image-hash/${encoded}`;
}

async function ensureLocalFile(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith('file://')) return uri;

  try {
    const dir = `${FileSystem.cacheDirectory}image-hash/`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    const localPath = buildDownloadPath(uri);
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      return localPath;
    }

    const downloaded = await FileSystem.downloadAsync(uri, localPath);
    return downloaded.uri;
  } catch (error) {
    console.warn('[imageHash] download failed', uri, error);
    return null;
  }
}

export async function computeImageHash(imageUri: string): Promise<string | null> {
  if (!imageUri) return null;

  await hydrateHashCache();
  if (memoryHashCache.has(imageUri)) {
    return memoryHashCache.get(imageUri) ?? null;
  }

  try {
    const localUri = await ensureLocalFile(imageUri);
    if (!localUri) {
      memoryHashCache.set(imageUri, null);
      return null;
    }

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const hash = fnv1aHash(base64);
    memoryHashCache.set(imageUri, hash);
    await persistHashCacheEntry(imageUri, hash);
    return hash;
  } catch (error) {
    console.warn('[imageHash] read failed', imageUri, error);
    memoryHashCache.set(imageUri, null);
    await persistHashCacheEntry(imageUri, null);
    return null;
  }
}

export async function computeImageHashes(imageUris: string[]): Promise<string[]> {
  const hashes = await Promise.all(imageUris.map((uri) => computeImageHash(uri)));
  return hashes.filter((value): value is string => typeof value === 'string' && value.length > 0);
}
