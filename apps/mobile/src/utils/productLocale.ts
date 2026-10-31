/**
 * Résout un libellé produit (nom / description) selon la langue UI.
 *
 * **Important :** l’app ne « traduit pas » magiquement le texte stocké. Il faut des **traductions
 * en base** (Firestore) pour chaque langue affichée ; sinon `getLocalizedProductText` retourne
 * le champ de base (`name` / `description`, souvent en français).
 *
 * Firestore peut fournir par exemple :
 * - champs plats : `name_fr`, `name_zh`, `description_en`, …
 * - cartes : `localizedNames: { fr: "…", en: "…", ar: "…" }`, `localizedDescriptions`, …
 * - objet imbriqué : `i18n: { name: { zh: "…" } }`
 *
 * Les nouveaux produits vendeur incluent `localizedNames` / `defaultLocale` via
 * `buildFirestoreProductI18nFields` (au minimum la langue source, ex. `fr`).
 *
 * Si aucune variante n’existe pour la langue active, on retombe sur `base`
 * (souvent la langue du fournisseur).
 */
const NAME_MAP_KEYS = [
  'localizedNames',
  'nameTranslations',
  'names',
  'titleTranslations',
  'titles',
] as const;

const DESC_MAP_KEYS = [
  'localizedDescriptions',
  'descriptionTranslations',
  'descriptions',
] as const;

/** Exporté pour résolution d’attributs / variantes (même logique que nom produit). */
export function languageVariants(language: string | undefined): string[] {
  const raw = (language || 'en').trim().toLowerCase();
  if (!raw) return ['en'];
  const short = raw.split('-')[0] || raw;
  const set = new Set<string>([raw, short]);
  if (short === 'zh') {
    ['zh-hans', 'zh-cn', 'zh-tw', 'zh'].forEach((c) => set.add(c));
  }
  return [...set];
}

function readFromFlat(
  data: Record<string, unknown>,
  field: 'name' | 'description',
  variants: string[],
): string | undefined {
  for (const v of variants) {
    const key = `${field}_${v}`;
    const val = data[key];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return undefined;
}

function readFromMaps(
  data: Record<string, unknown>,
  mapKeys: readonly string[],
  variants: string[],
): string | undefined {
  for (const mk of mapKeys) {
    const obj = data[mk];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
    const record = obj as Record<string, unknown>;
    for (const v of variants) {
      const val = record[v] ?? record[v.toUpperCase()];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
  }
  return undefined;
}

function readFromI18nNest(
  data: Record<string, unknown>,
  field: 'name' | 'description',
  variants: string[],
): string | undefined {
  const nest = data.i18n;
  if (!nest || typeof nest !== 'object' || Array.isArray(nest)) return undefined;
  const branch = (nest as Record<string, unknown>)[field];
  if (!branch || typeof branch !== 'object' || Array.isArray(branch)) return undefined;
  const record = branch as Record<string, unknown>;
  for (const v of variants) {
    const val = record[v];
    if (typeof val === 'string' && val.trim()) return val.trim();
  }
  return undefined;
}

export function getLocalizedProductText(
  base: string | undefined,
  field: 'name' | 'description',
  data: Record<string, unknown> | null | undefined,
  language: string | undefined,
): string {
  const variants = languageVariants(language);
  const mapKeys = field === 'name' ? NAME_MAP_KEYS : DESC_MAP_KEYS;

  if (data && typeof data === 'object') {
    const fromFlat = readFromFlat(data, field, variants);
    if (fromFlat) return fromFlat;

    const fromMaps = readFromMaps(data, mapKeys, variants);
    if (fromMaps) return fromMaps;

    const fromNest = readFromI18nNest(data, field, variants);
    if (fromNest) return fromNest;
  }

  return (base ?? '').trim();
}

/** Langue source catalogue (fiches fournisseur / admin). */
export const DEFAULT_PRODUCT_LOCALE = 'fr';

/**
 * Locale BCP 47 pour `Intl.NumberFormat` / `toLocaleString` selon la langue UI.
 * À utiliser pour les prix afin que séparateurs et ordre suivent la langue active.
 */
export function intlLocaleForAppLanguage(lang: string | undefined): string {
  const short = (lang || 'en').split(/[-_]/)[0]?.toLowerCase() ?? 'en';
  const map: Record<string, string> = {
    en: 'en-US',
    fr: 'fr-FR',
    ar: 'ar',
    es: 'es-ES',
    pt: 'pt-PT',
    ru: 'ru-RU',
    tr: 'tr-TR',
    de: 'de-DE',
    it: 'it-IT',
    nl: 'nl-NL',
    ja: 'ja-JP',
    ko: 'ko-KR',
    vi: 'vi-VN',
    id: 'id-ID',
    zh: 'zh-CN',
  };
  return map[short] ?? 'en-US';
}

export type ProductI18nFormInput = {
  /** Langue des champs `name` / `description` principaux (souvent `fr`). */
  sourceLocale?: string;
  name: string;
  description: string;
  nameEn?: string;
  nameZh?: string;
  descriptionEn?: string;
  descriptionZh?: string;
};

function omitEmptyStringsFromRecord(r: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === 'string' && v.trim()) out[k] = v.trim();
  }
  return out;
}

/**
 * Champs Firestore / Algolia pour le modèle i18n « pro » : `defaultLocale` + cartes + champs plats pour l’index.
 * À fusionner dans le document `products/{id}` lors de la création / édition.
 */
export function buildFirestoreProductI18nFields(
  src: ProductI18nFormInput,
): Record<string, unknown> {
  const loc = (src.sourceLocale || DEFAULT_PRODUCT_LOCALE).trim().toLowerCase() || 'fr';
  const name = (src.name || '').trim();
  const description = (src.description || '').trim();
  const nameEn = (src.nameEn || '').trim();
  const nameZh = (src.nameZh || '').trim();
  const descriptionEn = (src.descriptionEn || '').trim();
  const descriptionZh = (src.descriptionZh || '').trim();

  const localizedNames = omitEmptyStringsFromRecord({
    [loc]: name,
    ...(nameEn ? { en: nameEn } : {}),
    ...(nameZh ? { zh: nameZh } : {}),
  });

  const localizedDescriptions = omitEmptyStringsFromRecord({
    [loc]: description,
    ...(descriptionEn ? { en: descriptionEn } : {}),
    ...(descriptionZh ? { zh: descriptionZh } : {}),
  });

  const patch: Record<string, unknown> = {
    defaultLocale: loc,
    localizedNames,
    localizedDescriptions,
  };

  if (nameEn) patch.name_en = nameEn;
  if (nameZh) patch.name_zh = nameZh;
  if (descriptionEn) patch.description_en = descriptionEn;
  if (descriptionZh) patch.description_zh = descriptionZh;
  if (loc === 'fr' && name) patch.name_fr = name;
  if (loc === 'fr' && description) patch.description_fr = description;

  return patch;
}

/** Hydrate le formulaire admin depuis un document Firestore existant. */
export function extractProductI18nFormFields(data: Record<string, unknown>): {
  titleEn: string;
  titleZh: string;
  descriptionEn: string;
  descriptionZh: string;
} {
  const ln =
    data.localizedNames && typeof data.localizedNames === 'object' && !Array.isArray(data.localizedNames)
      ? (data.localizedNames as Record<string, string>)
      : {};
  const ld =
    data.localizedDescriptions &&
    typeof data.localizedDescriptions === 'object' &&
    !Array.isArray(data.localizedDescriptions)
      ? (data.localizedDescriptions as Record<string, string>)
      : {};
  return {
    titleEn: (ln.en || (typeof data.name_en === 'string' ? data.name_en : '') || '').trim(),
    titleZh: (ln.zh || (typeof data.name_zh === 'string' ? data.name_zh : '') || '').trim(),
    descriptionEn: (
      ld.en || (typeof data.description_en === 'string' ? data.description_en : '') || ''
    ).trim(),
    descriptionZh: (
      ld.zh || (typeof data.description_zh === 'string' ? data.description_zh : '') || ''
    ).trim(),
  };
}
