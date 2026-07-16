/**
 * Traduction des libellés d’attributs (Couleur, Taille…) et valeurs de variantes (vert, M…)
 * pour affichage selon la langue UI.
 *
 * 1) **Firestore (prioritaire)** — champ optionnel `attributesLocalized` sur le document produit :
 *    [
 *      { "id": "1", "names": { "en": "Color", "ar": "...", "zh": "..." },
 *        "values": { "vert": { "en": "green", "ar": "...", "zh": "..." }, "bleu": { ... } } },
 *      { "id": "2", "names": { "en": "Size" }, "values": { "M": { "en": "M" } } }
 *    ]
 *    Les clés de `values` sont les **valeurs sources** (souvent FR) comme dans `attributes[].values`.
 *
 * 2) **Glossaire** — si pas d’entrée Firestore : correspondance pour noms d’attributs et couleurs courantes.
 */

function shortLang(lang: string | undefined): string {
  const raw = (lang || 'en').trim().toLowerCase();
  return raw.split(/[-_]/)[0] || 'en';
}

function pickEnArZhElseEn(
  row: { en: string; ar: string; zh: string },
  lang: string | undefined,
): string {
  const sl = shortLang(lang);
  if (sl === 'ar') return row.ar;
  if (sl === 'zh') return row.zh;
  return row.en;
}

/** Libellés d’attributs FR → autres langues (hors Firestore). */
const ATTR_LABEL_FR: Record<string, { en: string; ar: string; zh: string }> = {
  Couleur: { en: 'Color', ar: 'اللون', zh: '颜色' },
  Taille: { en: 'Size', ar: 'المقاس', zh: '尺码' },
  Pointure: { en: 'Shoe size', ar: 'مقاس الحذاء', zh: '鞋码' },
  Matière: { en: 'Material', ar: 'المادة', zh: '材质' },
  Modèle: { en: 'Model', ar: 'الموديل', zh: '型号' },
};

/** Valeurs couleur (FR) → en / ar / zh */
const COLOR_FR: Record<string, { en: string; ar: string; zh: string }> = {
  vert: { en: 'Green', ar: 'أخضر', zh: '绿色' },
  bleu: { en: 'Blue', ar: 'أزرق', zh: '蓝色' },
  rose: { en: 'Pink', ar: 'وردي', zh: '粉色' },
  jaune: { en: 'Yellow', ar: 'أصفر', zh: '黄色' },
  rouge: { en: 'Red', ar: 'أحمر', zh: '红色' },
  blanc: { en: 'White', ar: 'أبيض', zh: '白色' },
  noir: { en: 'Black', ar: 'أسود', zh: '黑色' },
  violet: { en: 'Purple', ar: 'بنفسجي', zh: '紫色' },
  orange: { en: 'Orange', ar: 'برتقالي', zh: '橙色' },
  gris: { en: 'Grey', ar: 'رمادي', zh: '灰色' },
  marron: { en: 'Brown', ar: 'بني', zh: '棕色' },
  beige: { en: 'Beige', ar: 'بيج', zh: '米色' },
  multicolore: { en: 'Multicolour', ar: 'متعدد الألوان', zh: '多色' },
};

type AttributesLocalizedEntry = {
  id?: string;
  names?: Record<string, string>;
  values?: Record<string, Record<string, string>>;
};

function findAttributesLocalizedEntry(
  product: Record<string, unknown>,
  attr: { id?: string; name: string },
): AttributesLocalizedEntry | undefined {
  const list = product.attributesLocalized;
  if (!Array.isArray(list)) return undefined;
  if (attr.id) {
    const byId = list.find(
      (x) => x && typeof x === 'object' && (x as AttributesLocalizedEntry).id === attr.id,
    ) as AttributesLocalizedEntry | undefined;
    if (byId) return byId;
  }
  return list.find(
    (x) =>
      x &&
      typeof x === 'object' &&
      (x as AttributesLocalizedEntry).names?.fr === attr.name,
  ) as AttributesLocalizedEntry | undefined;
}

function pickFromNamesMap(
  names: Record<string, string>,
  lang: string | undefined,
  fallback: string,
): string {
  const sl = shortLang(lang);
  const v =
    names[sl] ||
    names[lang?.toLowerCase() || ''] ||
    names.en ||
    names.fr;
  return (v && v.trim()) || fallback;
}

function pickFromValueRow(
  row: Record<string, string> | undefined,
  lang: string | undefined,
  fallback: string,
): string {
  if (!row) return fallback;
  const sl = shortLang(lang);
  const v = row[sl] || row.en || row.fr;
  return (v && v.trim()) || fallback;
}

/**
 * Nom d’affichage de l’attribut (ex. « Couleur » → « Color » en anglais).
 */
export function getLocalizedAttributeName(
  attr: { id?: string; name: string },
  product: Record<string, unknown> | null | undefined,
  lang: string | undefined,
): string {
  const base = (attr.name || '').trim();
  if (!base) return '';
  if (shortLang(lang) === 'fr') return base;

  const entry = product ? findAttributesLocalizedEntry(product, attr) : undefined;
  if (entry?.names && Object.keys(entry.names).length > 0) {
    return pickFromNamesMap(entry.names, lang, base);
  }

  const g = ATTR_LABEL_FR[base];
  if (g) return pickEnArZhElseEn(g, lang);
  return base;
}

/**
 * Valeur affichée (ex. « vert » → « Green »). Pour couleurs / textes de variante.
 */
export function getLocalizedVariantValue(
  sourceValue: string,
  attr: { id?: string; name: string },
  product: Record<string, unknown> | null | undefined,
  lang: string | undefined,
): string {
  const v = (sourceValue || '').trim();
  if (!v) return '';
  if (shortLang(lang) === 'fr') return v;

  const entry = product ? findAttributesLocalizedEntry(product, attr) : undefined;
  if (entry?.values?.[v]) {
    const picked = pickFromValueRow(entry.values[v], lang, v);
    if (picked !== v || entry.values[v][shortLang(lang)]) return picked;
  }

  const lower = v.toLowerCase();
  const isColorAttr = /couleur|color|colour/i.test(attr.name);
  if (isColorAttr && COLOR_FR[lower]) {
    return pickEnArZhElseEn(COLOR_FR[lower], lang);
  }

  return v;
}
