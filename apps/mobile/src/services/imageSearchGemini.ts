import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

/** 2.0 flash = réponses plus rapides qu’un gros 2.5 sur mobile. */
const MODEL = "gemini-2.0-flash";
const GEMINI_REQUEST_TIMEOUT_MS = 42_000;
/** Au-delà, on redimensionne pour éviter des appels > 1–2 min côté API. */
const BASE64_SHRINK_THRESHOLD = 80_000;

export type SuperCategory =
  | "clothing"
  | "bags"
  | "shoes"
  | "home"
  | "electronics"
  | "food"
  | "beauty"
  | "accessories"
  | null;

export type VisualSearchDescriptor = {
  searchQuery: string;
  keywords: string[];
  labels: string[];
  colors: string[];
  materials: string[];
  entities: string[];
  detectedText: string[];
  confidence: "high" | "medium" | "low";
  /** Super-catégorie sémantique déterminée à partir des labels/keywords Gemini. */
  detectedSuperCategory: SuperCategory;
  /**
   * Catégorie stricte détectée par Gemini pour le filtrage Algolia.
   * Doit correspondre aux rayons (ex: "Mode & Accessoires").
   */
  strictCategory?: string;
};

// ─── Listes de termes par groupe sémantique ──────────────────────────────────

export const CLOTHING_TERMS = [
  "robe", "dress", "gown", "vestido", "abaya", "kaftan", "caftan", "djellaba",
  "boubou", "chemise", "shirt", "blouse", "top", "veste", "jacket", "manteau",
  "coat", "pantalon", "pants", "jeans", "short", "shorts", "jupe", "skirt",
  "vetement", "vetements", "habillement", "mode", "pyjama", "tenue", "ensemble",
  "combinaison", "legging", "tshirt", "pull", "sweat", "hoodie", "gilet",
  "cardigan", "costume", "uniforme", "salopette", "lingerie", "maillot", "bikini",
  "sous-vetement", "tricot", "polo", "tunique", "kimono",
];

export const BAG_TERMS = [
  "sac", "bag", "sacoche", "pochette", "handbag", "backpack", "sac a dos",
  "valise", "trolley", "wallet", "portefeuille", "clutch", "tote", "bourse",
  "maroquinerie", "cabas", "besace", "cartable", "porte monnaie",
];

export const THERMAL_FOOD_CONTAINER_TERMS = [
  "isotherme", "thermique", "glaciere", "lunch bag", "boite repas",
  "sac repas", "sac lunch", "thermos", "bouteille isotherme",
];

export const HOME_TERMS = [
  "vase", "decoration", "deco", "maison", "interieur", "meuble", "mobilier",
  "tapis", "rideau", "coussin", "couette", "literie", "cuisine", "casserole",
  "marmite", "poele", "ustensile", "assiette", "verre", "tasse", "bol",
  "bougie", "lampe", "luminaire", "cadre", "tableau", "miroir", "pot",
  "jardiniere", "boite", "emballage", "conteneur", "panier",
];

export const SHOE_TERMS = [
  "chaussure", "chaussures", "shoe", "shoes", "sneaker", "sneakers",
  "basket", "baskets", "sandale", "sandales", "botte", "bottes", "boot",
  "boots", "escarpin", "escarpins", "mocassin", "claquette", "tong",
  "semelle", "talon", "platform", "plateforme", "trainer", "trainers",
  "espadrille", "footwear", "running", "walking", "walk", "jogging",
  "derby", "derbies", "loafer", "loafers",
];

export const ELECTRONICS_TERMS = [
  "telephone", "phone", "smartphone", "tablette", "tablet", "ordinateur",
  "computer", "laptop", "coque", "cable", "chargeur", "ecouteur", "casque",
  "enceinte", "speaker", "camera", "appareil photo", "console", "jeux",
];

export const FOOD_TERMS = [
  "aliment", "alimentaire", "nourriture", "food", "boisson", "drink",
  "cereale", "farine", "huile", "sucre", "sel", "epice", "sauce",
  "confiture", "conserve", "biscuit", "chocolat", "fromage", "yaourt",
  "produit alimentaire", "legume", "fruit",
];

export const BEAUTY_TERMS = [
  "parfum", "cosmetique", "maquillage", "makeup", "creme", "lotion",
  "shampoing", "soin", "beaute", "beauty", "nail", "ongle", "mascara",
  "fond de teint", "serum", "rouge a levres", "hydratant",
];

export const ACCESSORY_TERMS = [
  "bijou", "bijoux", "collier", "bracelet", "bague", "boucle oreille",
  "montre", "watch", "ceinture", "belt", "foulard", "echarpe", "chapeau",
  "hat", "casquette", "cap", "lunettes", "glasses", "serre tete", "headband",
];

// ─── Incompatibilité entre super-catégories ───────────────────────────────────

const ALL_GROUPS = {
  clothing: CLOTHING_TERMS,
  bags: [...BAG_TERMS, ...THERMAL_FOOD_CONTAINER_TERMS],
  shoes: SHOE_TERMS,
  home: HOME_TERMS,
  electronics: ELECTRONICS_TERMS,
  food: FOOD_TERMS,
  beauty: BEAUTY_TERMS,
  accessories: ACCESSORY_TERMS,
};

export function normTok(t: string): string {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Détermine la super-catégorie à partir des labels/keywords/searchQuery Gemini.
 * Retourne null si aucune catégorie claire.
 */
export function detectSuperCategory(
  labels: string[],
  keywords: string[],
  searchQuery = "",
): SuperCategory {
  const tokens = [
    ...labels.map(normTok),
    ...keywords.map(normTok),
    ...searchQuery.split(" ").map(normTok),
  ].filter(Boolean);

  const score = (terms: string[], boost = 1) =>
    tokens.reduce((acc, tok) => {
      const matches = terms.some((t) => tok.includes(t) || t.includes(tok));
      const isLabel = labels.some((l) => normTok(l) === tok);
      return acc + (matches ? (isLabel ? boost * 2 : boost) : 0);
    }, 0);

  const scores: Record<string, number> = {
    clothing: score(CLOTHING_TERMS, 3),
    bags: score(BAG_TERMS, 2) + score(THERMAL_FOOD_CONTAINER_TERMS, 1),
    shoes: score(SHOE_TERMS, 2),
    home: score(HOME_TERMS, 2),
    electronics: score(ELECTRONICS_TERMS, 2),
    food: score(FOOD_TERMS, 2),
    beauty: score(BEAUTY_TERMS, 2),
    accessories: score(ACCESSORY_TERMS, 1),
  };

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] === 0) return null;
  return best[0] as SuperCategory;
}

/** Infère la super-catégorie depuis la requête texte seule (ex. « women walking shoes » → shoes). */
export function inferSuperCategoryFromQueryText(query: string): SuperCategory {
  const q = String(query || "").trim();
  if (!q) return null;
  return detectSuperCategory([], [], q);
}

/** Tokens pour filtres catégorie (labels + mots-clés Gemini). */
export function buildPrimaryTokensForCategory(
  descriptor: VisualSearchDescriptor | null | undefined,
): string[] {
  if (!descriptor) return [];
  return Array.from(
    new Set(
      [...(descriptor.labels || []), ...(descriptor.keywords || [])]
        .map((t) => normTok(String(t || "")))
        .filter(Boolean),
    ),
  );
}

/**
 * Verrouillage catalogue (style marketplace) : la ligne rayon Firestore / Algolia doit correspondre
 * à la super-catégorie détectée (ex. chaussures, pas cosmétique).
 */
export function catalogCategoryMatchesSuperCategory(
  categoryName: string | null | undefined,
  categoryField: string | null | undefined,
  superCat: SuperCategory,
): boolean {
  if (superCat == null) return true;
  const name = String(categoryName || "").trim();
  const extra = String(categoryField || "").trim();
  if (!name && !extra) return false;
  const blob = `${name} ${extra}`.trim();
  const n = normTok(blob);
  /**
   * Après traductions UI / rayons en arabe, CJK, etc., `normTok` peut vider toute la chaîne
   * alors que le verrou super-catégorie reste déduit du texte Gemini (latin). Sans ce repli,
   * `filterSearchHitsByCategoryLock` élimine 100 % des lignes → recherche image « vide ».
   */
  if (!n && blob.length > 0) return true;
  if (detectSuperCategory([], [], blob) === superCat) return true;
  const terms = ALL_GROUPS[superCat as keyof typeof ALL_GROUPS];
  if (!terms?.length) return false;
  for (const term of terms) {
    const nt = normTok(term);
    if (nt.length < 3) continue;
    if (n.includes(nt)) return true;
  }
  return false;
}

export function getIncompatibleTermsForSuperCat(superCat: SuperCategory): string[] {
  if (!superCat) return [];
  const incompatible: string[] = [];
  
  for (const [key, terms] of Object.entries(ALL_GROUPS)) {
    if (key === superCat) continue;
    // Exception: clothing et accessories ont des termes en commun dans la pratique
    if (
      (superCat === 'clothing' && key === 'accessories') ||
      (superCat === 'accessories' && key === 'clothing')
    ) {
      continue;
    }
    incompatible.push(...terms);
  }
  
  return incompatible.map(normTok);
}

/**
 * Évalue si un produit est sémantiquement compatible.
 * @param productText texte normalisé (name + categoryName + description)
 * @param superCat   super-catégorie détectée par Gemini
 * @param primaryTokens tokens normalisés des labels/keywords Gemini (inclusion)
 */
export function hitTextPassesCategoryFilter(
  productText: string,
  superCat: SuperCategory,
  primaryTokens: string[],
): boolean {
  if (!superCat) return true;
  if (!productText.trim()) return false;

  const textNorm = normTok(productText);

  // 1. Détection de la catégorie du produit via scoring
  const productSuperCat = detectSuperCategory([], [], textNorm);
  
  // Si le produit appartient clairement à une AUTRE catégorie majeure, on le bloque
  if (productSuperCat && productSuperCat !== superCat) {
    // Exception: clothing et accessories peuvent parfois se chevaucher,
    // mais une chaussure (shoes) n'est jamais une bague (accessories)
    if (
      (superCat === 'clothing' && productSuperCat === 'accessories') ||
      (superCat === 'accessories' && productSuperCat === 'clothing')
    ) {
      // Tolérance
    } else {
      return false;
    }
  }

  // 2. Exclusion stricte (mots courts = token entier ; longs = sous-chaîne)
  const incompatible = getIncompatibleTermsForSuperCat(superCat);
  const words = textNorm.split(' ').filter(Boolean);
  for (const term of incompatible) {
    if (term.length <= 4) {
      if (words.includes(term)) return false;
    } else if (textNorm.includes(term)) {
      return false;
    }
  }

  return true;
}

// ─── Gemini API ───────────────────────────────────────────────────────────────

function getGeminiApiKey(): string {
  /** Priorité à `extra` : injecté par `app.config.js` au build EAS / release (fiable sur Play Store). */
  const extra = Constants.expoConfig?.extra as { geminiApiKey?: string } | undefined;
  if (extra?.geminiApiKey && String(extra.geminiApiKey).trim()) {
    return String(extra.geminiApiKey).trim();
  }
  const fromEnv = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
  return "";
}

/** True si la clé Gemini est présente au build / runtime (sinon masquer l’UI « recherche par image »). */
export function isVisualSearchGeminiConfigured(): boolean {
  return getGeminiApiKey().length > 0;
}

export class ImageSearchGeminiError extends Error {
  constructor(
    message: string,
    public code: "NO_API_KEY" | "API_ERROR" | "EMPTY_RESPONSE" | "TIMEOUT"
  ) {
    super(message);
    this.name = "ImageSearchGeminiError";
  }
}

async function shrinkBase64ImageForLlm(
  base64Image: string,
  mimeType: string,
): Promise<{ data: string; mimeForInline: string }> {
  const fallbackMime = mimeType?.includes("/") ? mimeType : "image/jpeg";
  const isPng = mimeType.toLowerCase().includes("png");
  const ext = isPng ? "png" : "jpg";
  const tmp = `${FileSystem.cacheDirectory}gemini-visual-in.${ext}`;
  await FileSystem.writeAsStringAsync(tmp, base64Image, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const manipulated = await manipulateAsync(
    tmp,
    [{ resize: { width: 768 } }],
    { compress: 0.68, format: SaveFormat.JPEG, base64: true },
  );
  if (manipulated.base64 && manipulated.base64.length > 0) {
    return { data: manipulated.base64, mimeForInline: "image/jpeg" };
  }
  return { data: base64Image, mimeForInline: fallbackMime };
}

/**
 * Si l’IA est lente / timeout / erreur réseau, on continue la recherche (Algolia) au lieu de 0 résultat.
 */
export function fallbackVisualDescriptorAfterGeminiFailure(): VisualSearchDescriptor {
  return repairVisualSearchDescriptor({
    searchQuery: "produit",
    keywords: ["produit", "vente"],
    labels: ["article"],
    colors: [],
    materials: [],
    entities: [],
    detectedText: [],
    confidence: "low",
    /** Pas de filtre sémantique strict par défaut (évite d’exclure tout le catalogue). */
    detectedSuperCategory: null,
    strictCategory: undefined,
  });
}

async function geminiGenerateWithTimeout(
  url: string,
  body: unknown,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    const aborted =
      e instanceof Error &&
      (e.name === "AbortError" ||
        (e as { code?: string }).code === "ABORT_ERR" ||
        /aborted|AbortError/i.test(String(e)));
    if (aborted) {
      throw new ImageSearchGeminiError(
        "L'analyse de l'image a pris trop de temps. Recherche lancée avec des mots-clés génériques.",
        "TIMEOUT",
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function cleanLlmNoise(value: string): string {
  let cleaned = String(value || "");
  const noisePatterns = [
    /here is the json requested:?/gi,
    /here is the json:?/gi,
    /requested json:?/gi,
    /this is the json:?/gi,
    /the following json:?/gi,
    /json requested:?/gi,
    /json response:?/gi,
  ];
  noisePatterns.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, "");
  });
  return cleaned.trim();
}

function normalizeTokens(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => cleanLlmNoise(String(item || "").trim()))
        .filter(Boolean)
        .map((item) =>
          item
            .replace(/\s+/g, " ")
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
            .trim()
        )
        .filter(Boolean)
    )
  );
}

function normalizeSearchQuery(value: unknown, fallbacks: string[]): string {
  let raw = cleanLlmNoise(String(value || ""))
    .replace(/\s+/g, " ")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .trim();

  const noisePhrases = [
    "here is the json requested", "here is the json", "requested json",
    "this is the json", "json format", "the following json",
    "recherche image", "image search results",
  ];
  noisePhrases.forEach((phrase) => {
    raw = raw.replace(new RegExp(phrase, "gi"), "");
  });
  raw = raw.replace(/\bjson\b/gi, "").replace(/\s+/g, " ").trim();
  raw = raw.trim();
  return raw || fallbacks.join(" ").trim();
}

/** Requêtes produit invalides (artefacts JSON / MIME / modèle). */
function isGarbageSearchQuery(q: string): boolean {
  const t = String(q || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (t.length < 2) return true;
  const garbage = new Set([
    "json",
    "application/json",
    "text",
    "object",
    "array",
    "null",
    "undefined",
    "format json",
    "reponse json",
    "réponse json",
  ]);
  if (garbage.has(t)) return true;
  if (/^json[\s.:;]*$/i.test(t)) return true;
  if (/^application\/json/i.test(t)) return true;
  return false;
}

/**
 * Remplace une searchQuery corrompue par labels / mots-clés (cas capture d’écran « json » dans la barre).
 */
export function repairVisualSearchDescriptor(d: VisualSearchDescriptor): VisualSearchDescriptor {
  const fallbacks = Array.from(
    new Set(
      [
        ...(d.keywords ?? []),
        ...(d.labels ?? []),
        ...(d.colors ?? []),
        ...(d.materials ?? []),
        ...(d.entities ?? []),
        ...(d.detectedText ?? []),
      ].filter(Boolean),
    ),
  );
  let sq = String(d.searchQuery || "").trim();
  if (isGarbageSearchQuery(sq)) {
    sq = fallbacks.join(" ").trim();
  }
  if (isGarbageSearchQuery(sq)) {
    sq = "produit";
  }
  if (sq === d.searchQuery) {
    const detectedSuperCategory = detectSuperCategory(
      d.labels ?? [],
      d.keywords ?? [],
      sq,
    );
    if (d.detectedSuperCategory == null && detectedSuperCategory != null) {
      return { ...d, detectedSuperCategory };
    }
    return d;
  }
  const detectedSuperCategory = detectSuperCategory(
    d.labels ?? [],
    d.keywords ?? [],
    sq,
  );
  return { ...d, searchQuery: sq, detectedSuperCategory };
}

function extractResponseText(payload: unknown): string {
  const part = (payload as Record<string, unknown>)?.candidates?.[0]?.content?.parts?.[0] as
    | Record<string, unknown>
    | undefined;
  let rawText = String(part?.text ?? "").trim();

  if (!rawText && part && typeof part === "object") {
    try {
      rawText = JSON.stringify(part);
    } catch {
      rawText = "";
    }
  }

  rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  if (rawText.startsWith("{") && rawText.endsWith("}")) {
    return rawText;
  }

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0].trim() : rawText;
}

function parseVisualDescriptor(rawText: string): VisualSearchDescriptor {
  try {
    const parsed = JSON.parse(rawText);
    const keywords = normalizeTokens(parsed?.keywords);
    const labels = normalizeTokens(parsed?.labels);
    const colors = normalizeTokens(parsed?.colors);
    const materials = normalizeTokens(parsed?.materials);
    const entities = normalizeTokens(parsed?.entities);
    const detectedText = normalizeTokens(parsed?.detectedText);
    const fallbackTokens = Array.from(
      new Set([...keywords, ...labels, ...colors, ...materials, ...entities, ...detectedText])
    ).slice(0, 12);

    const confidence =
      parsed?.confidence === "high" || parsed?.confidence === "low"
        ? parsed.confidence
        : "medium";

    let sq = normalizeSearchQuery(parsed?.searchQuery, fallbackTokens);
    if (isGarbageSearchQuery(sq)) {
      sq = normalizeSearchQuery("", fallbackTokens);
    }
    if (isGarbageSearchQuery(sq)) {
      sq = "produit";
    }
    const detectedSuperCategory = detectSuperCategory(labels, keywords, sq);
    const rawCat = cleanLlmNoise(String(parsed?.strictCategory ?? parsed?.category ?? '')).trim();
    const strictCategory = rawCat || undefined;

    return {
      searchQuery: sq,
      keywords,
      labels,
      colors,
      materials,
      entities,
      detectedText,
      confidence,
      detectedSuperCategory,
      strictCategory,
    };
  } catch {
    const tokens = rawText
      .replace(/\n/g, " ")
      .split(/[|,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const labels = tokens.slice(0, 6);
    let sq = normalizeSearchQuery(tokens.join(" "), tokens);
    if (isGarbageSearchQuery(sq)) {
      sq = normalizeSearchQuery("", tokens);
    }
    if (isGarbageSearchQuery(sq)) {
      sq = "produit";
    }
    return {
      searchQuery: sq,
      keywords: tokens.slice(0, 8),
      labels,
      colors: [],
      materials: [],
      entities: [],
      detectedText: [],
      confidence: "low",
      detectedSuperCategory: detectSuperCategory(labels, tokens, sq),
    };
  }
}

export async function analyzeImageForVisualSearch(
  base64Image: string,
  mimeType: string
): Promise<VisualSearchDescriptor> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new ImageSearchGeminiError("Clé API manquante.", "NO_API_KEY");
  }

  const mime = mimeType?.includes("/") ? mimeType : "image/jpeg";
  let imagePayload = base64Image;
  let inlineMime = mime;
  if (base64Image.length > BASE64_SHRINK_THRESHOLD) {
    try {
      const prepared = await shrinkBase64ImageForLlm(base64Image, mime);
      imagePayload = prepared.data;
      inlineMime = prepared.mimeForInline;
    } catch (shrinkErr) {
      console.warn("[imageSearchGemini] resize image skipped", shrinkErr);
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const prompt =
    "Tu es le moteur de recherche visuelle d'une marketplace B2B africaine. " +
    "Analyse cette image et identifie le produit principal. " +
    "Réponds UNIQUEMENT en JSON valide (pas de texte autour) avec cette structure: " +
    '{"searchQuery":"requete courte pour trouver ce produit", "keywords":["mot1","mot2"], "labels":["type produit"], "colors":["couleur"], "materials":["matiere"], "entities":["marque/modele"], "detectedText":["texte visible"], "confidence":"high|medium|low", "strictCategory":"UNE des catégories ci-dessous"}. ' +
    "IMPORTANT pour strictCategory, tu DOIS choisir EXACTEMENT une de ces valeurs (copier-coller tel quel): " +
    '"Mode & Accessoires" (chaussures, baskets, sneakers, sacs à main, bijoux, bagues, montres, ceintures, lunettes, foulards), ' +
    '"Mode & Vêtements" (robes, chemises, pantalons, jupes, vestes, t-shirts, jogging, manteaux, costumes), ' +
    '"Chaussure homme" (chaussures masculines, mocassins, derbies, boots homme), ' +
    '"Chaussures femmes" (escarpins, sandales femme, talons, ballerines), ' +
    '"Sac a main" (sacs à main, pochettes, clutch), ' +
    '"Sacs à dos" (sacs à dos, cartables), ' +
    '"Bébé & Enfant" (vêtements enfant/bébé, jouets, couches, biberons), ' +
    '"Adulte et enfant" (vêtements mixtes adulte et enfant), ' +
    '"Beauté & Santé" (maquillage, crèmes, parfums, soins, shampoings), ' +
    '"Cosmétiques" (cosmétiques, produits de beauté), ' +
    '"Électroniques" (téléphones, écouteurs, chargeurs, gadgets), ' +
    '"Maison & Jardin" (vases, décoration, meubles, ustensiles cuisine), ' +
    '"Maisons et jardin" (même chose), ' +
    '"Automobile et Moto" (pièces auto/moto, accessoires véhicule), ' +
    '"Machines Industrielles" (machines, équipements pro), ' +
    '"Emballage" (emballages, cartons, sachets), ' +
    '"Cadeau" (cadeaux, coffrets), ' +
    '"Nuisette sexy pour femme" (lingerie sexy, nuisettes), ' +
    '"Robe pour femme" (robes femme spécifiquement). ' +
    "Exemples: basket / sneaker -> strictCategory = \"Chaussures femmes\" ou \"Chaussure homme\" selon le genre apparent (sinon \"Chaussures femmes\" par défaut). " +
    "Robe rose enfant -> strictCategory = \"Bébé & Enfant\". " +
    "Shampoing -> strictCategory = \"Beauté & Santé\". " +
    "Vase déco -> strictCategory = \"Maison & Jardin\".";

  const requestBody = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: inlineMime, data: imagePayload } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 220,
    },
  };

  try {
    const res = await geminiGenerateWithTimeout(url, requestBody, GEMINI_REQUEST_TIMEOUT_MS);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ImageSearchGeminiError(data?.error?.message || "Erreur API", "API_ERROR");
    }

    const text = extractResponseText(data);
    if (!text) throw new ImageSearchGeminiError("Image non comprise.", "EMPTY_RESPONSE");

    const parsed = parseVisualDescriptor(text);
    return repairVisualSearchDescriptor(parsed);
  } catch (err) {
    if (err instanceof ImageSearchGeminiError && err.code === "NO_API_KEY") {
      throw err;
    }
    console.warn("[imageSearchGemini] analyse IA échouée, fallback recherche:", err);
    return fallbackVisualDescriptorAfterGeminiFailure();
  }
}

export async function getSearchKeywordsFromImage(
  base64Image: string,
  mimeType: string
): Promise<string> {
  const descriptor = await analyzeImageForVisualSearch(base64Image, mimeType);
  return descriptor.searchQuery;
}
