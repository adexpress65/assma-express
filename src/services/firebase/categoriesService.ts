// src/services/firebase/categoriesService.ts
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface Category {
  id: string;
  name: string;
  image: string;
  productCount: number;
  name_en?: string;
  name_fr?: string;
  name_zh?: string;
  name_zh_CN?: string;
  nameZh?: string;
  nameZhCn?: string;
  name_cn?: string;
  localizedNames?: Record<string, unknown>;
  nameTranslations?: Record<string, unknown>;
  names?: Record<string, unknown>;
  i18n?: Record<string, unknown>;
  translations?: Record<string, unknown>;
  localized?: Record<string, unknown>;
  locale?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

const MEMORY_TTL_MS = 120_000;
let memoryCache: { at: number; data: Category[] } | null = null;

export const getCategories = async (opts?: { force?: boolean }): Promise<Category[]> => {
  if (!opts?.force && memoryCache && Date.now() - memoryCache.at < MEMORY_TTL_MS) {
    return memoryCache.data;
  }
  try {
    const querySnapshot = await getDocs(collection(db, 'categories'));
    const categories: Category[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const nameRaw =
        [data.name, data.name_zh, data.name_zh_CN, data.label, data.title].find(
          (v) => typeof v === "string" && String(v).trim().length > 0,
        ) ?? "";
      categories.push({
        id: doc.id,
        name: String(nameRaw).trim(),
        image: (data.image as string) || "",
        productCount: Number(data.productCount) || 0,
        name_en: typeof data.name_en === "string" ? data.name_en : undefined,
        name_fr: typeof data.name_fr === "string" ? data.name_fr : undefined,
        name_zh: typeof data.name_zh === "string" ? data.name_zh : undefined,
        name_zh_CN: typeof data.name_zh_CN === "string" ? data.name_zh_CN : undefined,
        nameZh: typeof data.nameZh === "string" ? data.nameZh : undefined,
        nameZhCn: typeof data.nameZhCn === "string" ? data.nameZhCn : undefined,
        name_cn: typeof data.name_cn === "string" ? data.name_cn : undefined,
        localizedNames:
          data.localizedNames && typeof data.localizedNames === "object" && !Array.isArray(data.localizedNames)
            ? (data.localizedNames as Record<string, unknown>)
            : undefined,
        nameTranslations:
          data.nameTranslations && typeof data.nameTranslations === "object" && !Array.isArray(data.nameTranslations)
            ? (data.nameTranslations as Record<string, unknown>)
            : undefined,
        names:
          data.names && typeof data.names === "object" && !Array.isArray(data.names)
            ? (data.names as Record<string, unknown>)
            : undefined,
        i18n:
          data.i18n && typeof data.i18n === "object" && !Array.isArray(data.i18n)
            ? (data.i18n as Record<string, unknown>)
            : undefined,
        translations:
          data.translations && typeof data.translations === "object" && !Array.isArray(data.translations)
            ? (data.translations as Record<string, unknown>)
            : undefined,
        localized:
          data.localized && typeof data.localized === "object" && !Array.isArray(data.localized)
            ? (data.localized as Record<string, unknown>)
            : undefined,
        locale:
          data.locale && typeof data.locale === "object" && !Array.isArray(data.locale)
            ? (data.locale as Record<string, unknown>)
            : undefined,
        raw: data,
      });
    });
    
    memoryCache = { at: Date.now(), data: categories };
    return categories;
  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    return memoryCache?.data ?? [];
  }
};