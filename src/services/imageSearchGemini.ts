import Constants from "expo-constants";
const MODEL = "gemini-2.5-flash";

export type VisualSearchDescriptor = {
  searchQuery: string;
  keywords: string[];
  labels: string[];
  colors: string[];
  materials: string[];
  entities: string[];
  detectedText: string[];
  confidence: "high" | "medium" | "low";
};

function getGeminiApiKey(): string {
  const fromEnv = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
  const extra = Constants.expoConfig?.extra as { geminiApiKey?: string } | undefined;
  if (extra?.geminiApiKey && String(extra.geminiApiKey).trim()) {
    return String(extra.geminiApiKey).trim();
  }
  return "";
}

export class ImageSearchGeminiError extends Error {
  constructor(
    message: string,
    public code: "NO_API_KEY" | "API_ERROR" | "EMPTY_RESPONSE"
  ) {
    super(message);
    this.name = "ImageSearchGeminiError";
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
  if (!Array.isArray(value)) {
    return [];
  }

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

  // Nettoyage supplémentaire des phrases conversationnelles typiques des LLM
  const noisePhrases = [
    "here is the json requested",
    "here is the json",
    "requested json",
    "this is the json",
    "json format",
    "the following json",
    "recherche image",
    "image search results",
  ];

  noisePhrases.forEach((phrase) => {
    const regex = new RegExp(phrase, "gi");
    raw = raw.replace(regex, "");
  });

  raw = raw.trim();

  if (raw) {
    return raw;
  }

  return fallbacks.join(" ").trim();
}

function extractResponseText(payload: any): string {
  const rawText = String(payload?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
  
  // Si le texte contient du JSON entouré de texte conversationnel (ex: "Here is the JSON requested: { ... }")
  // On tente d'extraire uniquement la partie entre les premières { et les dernières }
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }
  
  return rawText;
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
      new Set([
        ...keywords,
        ...labels,
        ...colors,
        ...materials,
        ...entities,
        ...detectedText,
      ])
    ).slice(0, 12);

    const confidence =
      parsed?.confidence === "high" || parsed?.confidence === "low"
        ? parsed.confidence
        : "medium";

    return {
      searchQuery: normalizeSearchQuery(parsed?.searchQuery, fallbackTokens),
      keywords,
      labels,
      colors,
      materials,
      entities,
      detectedText,
      confidence,
    };
  } catch {
    const tokens = rawText
      .replace(/\n/g, " ")
      .split(/[|,]/)
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      searchQuery: normalizeSearchQuery(tokens.join(" "), tokens),
      keywords: tokens.slice(0, 8),
      labels: tokens.slice(0, 6),
      colors: [],
      materials: [],
      entities: [],
      detectedText: [],
      confidence: "low",
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
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const prompt =
    "Tu es le moteur de recherche visuelle d'une marketplace B2B. " +
    "Analyse cette image comme un moteur de recherche produit type Alibaba. " +
    "Identifie le produit, ses variantes, ses attributs et tout texte visible. " +
    "Réponds uniquement en JSON valide avec cette structure exacte: " +
    '{"searchQuery":"", "keywords":[], "labels":[], "colors":[], "materials":[], "entities":[], "detectedText":[], "confidence":"high|medium|low"}. ' +
    "searchQuery doit être une requête courte et précise pour retrouver le produit exact. " +
    "keywords contient les mots les plus discriminants. " +
    "labels décrit le type de produit et ses variantes. " +
    "colors contient les couleurs visibles. " +
    "materials contient la matière si identifiable. " +
    "entities contient marque, modèle, logo, SKU ou texte important. " +
    "detectedText contient uniquement le texte lu dans l'image.";

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mime, data: base64Image } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 220,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ImageSearchGeminiError(data?.error?.message || "Erreur API", "API_ERROR");
  }

  const text = extractResponseText(data);
  if (!text) throw new ImageSearchGeminiError("Image non comprise.", "EMPTY_RESPONSE");

  return parseVisualDescriptor(text);
}

export async function getSearchKeywordsFromImage(
  base64Image: string,
  mimeType: string
): Promise<string> {
  const descriptor = await analyzeImageForVisualSearch(base64Image, mimeType);
  return descriptor.searchQuery;
}
