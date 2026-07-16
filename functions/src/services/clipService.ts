/**
 * Embeddings image via CLIP (Xenova / ONNX) — import dynamique pour le déploiement Firebase.
 * Prétraitement : Sharp (formats variés → JPEG) puis entrée 224×224 pour le ViT CLIP.
 */
import { decode as decodeJpeg } from "jpeg-js";
import { computePHashFromRgb } from "./perceptualHash";
import { tmpdir } from "os";
import { join } from "path";

export const CLIP_MODEL_ID = "Xenova/clip-vit-base-patch32";
export const CLIP_DIMS = 512;

/** Histogramme RGB (8×3) + rapport largeur/hauteur — similarité couleur / forme légère. */
export type ImageVisualFingerprint = {
  /** 24 valeurs sommant à ~1 (L1-normalisé). */
  hist: number[];
  aspectRatio: number;
  /** RGB dominants (0–1) — centres de masse des marges R/G/B. */
  dominantRgb?: [number, number, number];
  /** 8 bins L1-normalisés : répartition des magnitudes de gradient (structure / texture). */
  edgeHist?: number[];
};

/** Entrée réseau CLIP ViT-B/32 */
const CLIP_SPATIAL = 224;
/** Réduit d’abord les très grandes images (mémoire / Sharp). */
const MAX_SIDE_BEFORE_CLIP = 512;
/** Taille max chaîne base64 / data URL acceptée (~12 Mo de texte). */
const MAX_PAYLOAD_CHARS = 14_000_000;

type TransformersMod = typeof import("@xenova/transformers");

let transformersModule: TransformersMod | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let processor: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let visionModel: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clipTokenizer: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clipTextModel: any = null;

async function getTransformers(): Promise<TransformersMod> {
  if (!transformersModule) {
    transformersModule = await import("@xenova/transformers");
    transformersModule.env.cacheDir = join(tmpdir(), "xenova-cache");
    transformersModule.env.allowLocalModels = false;
  }
  return transformersModule;
}

function sanitizeBase64Chars(s: string): string {
  return s.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
}

/**
 * Extrait buffer + mime depuis une data URL ou du base64 pur.
 */
export function decodeImagePayload(
  input: string,
  fallbackMime = "image/jpeg",
): { buffer: Buffer; mime: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Payload image vide.");
  }
  const dataUrl = /^data:([^,]+),(.+)$/is.exec(trimmed);
  if (dataUrl) {
    const header = dataUrl[1].trim().toLowerCase();
    const body = sanitizeBase64Chars(dataUrl[2]);
    if (!header.includes("base64")) {
      throw new Error("Data URL non base64 (non supporté).");
    }
    const mimePart =
      header.split(";")[0].replace(/^data:/i, "").trim() || fallbackMime;
    const buf = Buffer.from(body, "base64");
    return { buffer: buf, mime: mimePart };
  }
  const b64 = sanitizeBase64Chars(trimmed);
  const buf = Buffer.from(b64, "base64");
  return { buffer: buf, mime: fallbackMime };
}

export function validateImagePayload(input: string): { ok: true } | { ok: false; reason: string } {
  if (!input || typeof input !== "string") return { ok: false, reason: "payload vide" };
  if (input.length > MAX_PAYLOAD_CHARS) return { ok: false, reason: "payload trop volumineux" };
  try {
    const { buffer } = decodeImagePayload(input);
    if (buffer.length < 32) return { ok: false, reason: "image décodée trop petite" };
    if (buffer.length > 22 * 1024 * 1024) return { ok: false, reason: "image décodée trop grande (>22 Mo)" };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "décodage invalide";
    return { ok: false, reason: msg };
  }
}

/**
 * Un seul passage Sharp → RGB 224×224 pour CLIP (pas de `clone()` / 2ᵉ Sharp : instable sous Windows / libvips).
 * pHash et empreinte couleur utilisent les mêmes pixels (JS + `jpeg-js` si besoin), sans Sharp.
 */
type ClipReadyImage = {
  rgb: Uint8ClampedArray;
  width: number;
  height: number;
};

function rawToRgb3(
  raw: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
): Uint8ClampedArray {
  const n = width * height;
  if (channels === 3) return raw;
  if (channels === 4) {
    const out = new Uint8ClampedArray(n * 3);
    for (let i = 0, o = 0; o < out.length; i += 4, o += 3) {
      out[o] = raw[i]!;
      out[o + 1] = raw[i + 1]!;
      out[o + 2] = raw[i + 2]!;
    }
    return out;
  }
  if (channels === 1) {
    const out = new Uint8ClampedArray(n * 3);
    for (let i = 0, o = 0; i < n; i++, o += 3) {
      const v = raw[i]!;
      out[o] = v;
      out[o + 1] = v;
      out[o + 2] = v;
    }
    return out;
  }
  throw new Error(`Canaux image non supportés pour CLIP (${channels}).`);
}

/** Sous Windows, libvips (Sharp) peut planter sur certains PNG ; Jimp est plus lent mais stable en local. */
async function clipReadyWithJimp(input: Buffer): Promise<ClipReadyImage> {
  const { Jimp } = await import("jimp");
  console.info("[clipService] jimp pipeline (win32)", { bytes: input.length });
  const img = await Jimp.read(input);
  img.scaleToFit({ w: MAX_SIDE_BEFORE_CLIP, h: MAX_SIDE_BEFORE_CLIP });
  img.cover({ w: CLIP_SPATIAL, h: CLIP_SPATIAL });
  const { data, width, height } = img.bitmap;
  const src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const rgb = new Uint8ClampedArray(width * height * 3);
  for (let p = 0, o = 0; p < width * height * 4; p += 4, o += 3) {
    rgb[o] = src[p]!;
    rgb[o + 1] = src[p + 1]!;
    rgb[o + 2] = src[p + 2]!;
  }
  return { rgb, width, height };
}

async function clipReadyWithSharp(input: Buffer): Promise<ClipReadyImage> {
  const sharp = (await import("sharp")).default;
  console.info("[clipService] sharp pipeline", { bytes: input.length });

  const { data, info } = await sharp(input, {
    failOn: "none",
    limitInputPixels: 4096 * 4096,
  })
    .rotate()
    .resize(MAX_SIDE_BEFORE_CLIP, MAX_SIDE_BEFORE_CLIP, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .resize(CLIP_SPATIAL, CLIP_SPATIAL, {
      fit: "cover",
      position: "center",
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels ?? 3;
  const width = info.width ?? CLIP_SPATIAL;
  const height = info.height ?? CLIP_SPATIAL;
  const rgb = rawToRgb3(new Uint8ClampedArray(data), width, height, ch);
  return { rgb, width, height };
}

/**
 * Toujours **Sharp** par défaut : indexation (souvent locale) et requête (Linux Cloud Functions)
 * doivent produire les **mêmes** pixels 224×224. L’ancien branchement Jimp sous `win32` cassait
 * la cohérence (resize/cover différents → embeddings différents → cosinus faible sur la même photo).
 *
 * Forcer Jimp uniquement pour dépannage local : `CLIP_USE_JIMP=1`
 */
async function sharpPipelineToClipReady(input: Buffer): Promise<ClipReadyImage> {
  const useJimp = process.env.CLIP_USE_JIMP === "1";
  if (useJimp) {
    return clipReadyWithJimp(input);
  }
  return clipReadyWithSharp(input);
}

async function runClipOnRawPixels(
  t: TransformersMod,
  ready: ClipReadyImage,
): Promise<number[]> {
  try {
    const image = new t.RawImage(ready.rgb, ready.width, ready.height, 3);
    /** AutoProcessor applique resize interne si besoin + normalisation ImageNet → pixel_values. */
    const inputs = await processor(image);
    const out = await visionModel(inputs);
    const vec = tensorToVector(out.image_embeds);
    return vec;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[clipService] RawImage / CLIP failed:", err);
    throw new Error(`CLIP: échec inférence (${err.slice(0, 160)})`);
  }
}

export async function loadClipVision(): Promise<void> {
  if (processor && visionModel) return;
  const t = await getTransformers();
  processor = await t.AutoProcessor.from_pretrained(CLIP_MODEL_ID);
  visionModel = await t.CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL_ID);
}

/** Tour de texte CLIP (même espace 512-D que les embeddings image du catalogue). */
export async function loadClipText(): Promise<void> {
  if (clipTokenizer && clipTextModel) return;
  const t = await getTransformers();
  clipTokenizer = await t.AutoTokenizer.from_pretrained(CLIP_MODEL_ID);
  clipTextModel = await t.CLIPTextModelWithProjection.from_pretrained(CLIP_MODEL_ID);
}

/**
 * Embedding texte CLIP — aligné sur les vecteurs **image** indexés (recherche cross-modale).
 * Sert à la fusion hybride quand la photo utilisateur ≠ packshot mais le libellé / intention matche le produit.
 */
export async function embedClipText(text: string): Promise<number[]> {
  const raw = String(text || "")
    .trim()
    .replace(/\s+/g, " ");
  if (raw.length < 3) {
    throw new Error("Texte CLIP trop court.");
  }
  await loadClipText();
  const inputs = clipTokenizer([raw.slice(0, 480)], {
    padding: true,
    truncation: true,
  });
  const out = await clipTextModel(inputs);
  const te = out.text_embeds;
  if (!te?.data) {
    throw new Error("CLIP text_embeds manquant.");
  }
  const vec = tensorToVector(te);
  logClipEmbeddingDiagnostics(vec, "embedClipText");
  return vec;
}

function l2Normalize(arr: number[]): number[] {
  const norm = Math.sqrt(arr.reduce((s, x) => s + x * x, 0)) || 1;
  return arr.map((x) => x / norm);
}

function tensorToVector(image_embeds: { data: Float32Array | number[] }): number[] {
  const raw = image_embeds.data;
  const arr = raw instanceof Float32Array ? Array.from(raw) : [...raw];
  if (arr.length !== CLIP_DIMS) {
    throw new Error(
      `CLIP image_embeds: dimension ${arr.length} ≠ attendu ${CLIP_DIMS}`,
    );
  }
  return l2Normalize(arr);
}

/** Logs dimension / L2 / échantillon — `CLIP_DEBUG_EMBEDDINGS=1` pour le détail. */
function logClipEmbeddingDiagnostics(embedding: number[], label: string): void {
  const norm = Math.sqrt(embedding.reduce((s, x) => s + x * x, 0));
  const badDim = embedding.length !== CLIP_DIMS;
  const badNorm = norm < 0.99 || norm > 1.01;
  if (process.env.CLIP_DEBUG_EMBEDDINGS === "1") {
    console.info("[clip]", label, {
      dim: embedding.length,
      l2: Number(norm.toFixed(6)),
      sample: [0, 128, 256, 511].map((i) => Number(embedding[i]!.toFixed(6))),
    });
  } else if (badDim || badNorm) {
    console.warn("[clip]", label, {
      dim: embedding.length,
      l2: Number(norm.toFixed(6)),
      badDim,
      badNorm,
    });
  }
}

/**
 * Empreinte couleur / forme sur JPEG déjà aligné (même pipeline que CLIP).
 */
function dominantRgbFromHist(hist: number[]): [number, number, number] {
  const rBins = hist.slice(0, 8);
  const gBins = hist.slice(8, 16);
  const bBins = hist.slice(16, 24);
  const sr = rBins.reduce((x, y) => x + y, 0) || 1;
  const sg = gBins.reduce((x, y) => x + y, 0) || 1;
  const sb = bBins.reduce((x, y) => x + y, 0) || 1;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.5) / 8;
    r += t * (rBins[i]! / sr);
    g += t * (gBins[i]! / sg);
    b += t * (bBins[i]! / sb);
  }
  return [r, g, b];
}

function dominantRgbSimilarity(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return clamp01(1 - d / Math.sqrt(3));
}

/** Sobel sur luminance 32×32 → histogramme 8 bins des magnitudes (structure des bords). */
function edgeHistogramFromLuma(luma: Float32Array, w: number, h: number): number[] {
  const bins = new Array(8).fill(0);
  const gxK = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gyK = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  let maxMag = 1e-9;
  const mags: number[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0;
      let gy = 0;
      let ki = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const v = luma[(y + ky) * w + (x + kx)]!;
          gx += gxK[ki]! * v;
          gy += gyK[ki]! * v;
          ki += 1;
        }
      }
      const mag = Math.sqrt(gx * gx + gy * gy);
      mags.push(mag);
      if (mag > maxMag) maxMag = mag;
    }
  }
  const scale = maxMag > 1e-9 ? maxMag : 1;
  for (const mag of mags) {
    const t = Math.min(1, mag / scale);
    const bin = Math.min(7, Math.floor(t * 8));
    bins[bin] += 1;
  }
  const s = bins.reduce((x, y) => x + y, 0) || 1;
  return bins.map((x) => x / s);
}

function edgeHistogramSimilarity(a: number[], b: number[]): number {
  let l1 = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    l1 += Math.abs(a[i]! - b[i]!);
  }
  return clamp01(1 - l1 * 0.5);
}

function boxDownsampleRgbTo32(
  rgb: Uint8ClampedArray,
  srcW: number,
  srcH: number,
): { data: Uint8ClampedArray; w: number; h: number } {
  const dst = 32;
  const out = new Uint8ClampedArray(dst * dst * 3);
  const scaleX = srcW / dst;
  const scaleY = srcH / dst;
  for (let y = 0; y < dst; y++) {
    for (let x = 0; x < dst; x++) {
      const x0 = Math.floor(x * scaleX);
      const y0 = Math.floor(y * scaleY);
      const x1 = Math.min(srcW, Math.ceil((x + 1) * scaleX));
      const y1 = Math.min(srcH, Math.ceil((y + 1) * scaleY));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * srcW + sx) * 3;
          r += rgb[i]!;
          g += rgb[i + 1]!;
          b += rgb[i + 2]!;
          n++;
        }
      }
      n = Math.max(1, n);
      const o = (y * dst + x) * 3;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
    }
  }
  return { data: out, w: dst, h: dst };
}

/** Même logique que l’ancien chemin Sharp 32×32, en pur JS (aligné sur l’image CLIP 224×224). */
export function computeVisualFingerprintFromRgb(
  rgb: Uint8ClampedArray,
  srcW: number,
  srcH: number,
): ImageVisualFingerprint {
  const { data, w, h } = boxDownsampleRgbTo32(rgb, srcW, srcH);
  const ar = srcW / Math.max(1, srcH);
  const hist = new Array(24).fill(0);
  const luma = new Float32Array(w * h);
  let pi = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = pi * 3;
      const rp = data[i]! / 255;
      const gp = data[i + 1]! / 255;
      const bp = data[i + 2]! / 255;
      luma[pi] = 0.299 * rp + 0.587 * gp + 0.114 * bp;
      const r = Math.min(7, Math.floor(data[i]! / 32));
      const g = Math.min(7, Math.floor(data[i + 1]! / 32));
      const b = Math.min(7, Math.floor(data[i + 2]! / 32));
      hist[r] += 1;
      hist[8 + g] += 1;
      hist[16 + b] += 1;
      pi += 1;
    }
  }
  const sum = hist.reduce((a, b) => a + b, 0) || 1;
  const norm = hist.map((x) => x / sum);
  const dominantRgb = dominantRgbFromHist(norm);
  const edgeHist = edgeHistogramFromLuma(luma, w, h);
  return { hist: norm, aspectRatio: ar, dominantRgb, edgeHist };
}

/** JPEG en mémoire — décodage `jpeg-js` (sans Sharp). */
export function computeVisualFingerprintFromJpeg(jpegBuf: Buffer): ImageVisualFingerprint {
  const decoded = decodeJpeg(jpegBuf, { useTArray: true });
  if (!decoded.data || decoded.width < 2 || decoded.height < 2) {
    return {
      hist: new Array(24).fill(0),
      aspectRatio: 1,
    };
  }
  const w = decoded.width;
  const h = decoded.height;
  const n = w * h;
  let rgb: Uint8ClampedArray;
  if (decoded.data.length === n * 4) {
    rgb = new Uint8ClampedArray(n * 3);
    for (let i = 0, o = 0; o < rgb.length; i += 4, o += 3) {
      rgb[o] = decoded.data[i]!;
      rgb[o + 1] = decoded.data[i + 1]!;
      rgb[o + 2] = decoded.data[i + 2]!;
    }
  } else if (decoded.data.length === n * 3) {
    rgb = new Uint8ClampedArray(decoded.data);
  } else if (decoded.data.length === n) {
    rgb = new Uint8ClampedArray(n * 3);
    for (let i = 0, o = 0; i < n; i++, o += 3) {
      const v = decoded.data[i]!;
      rgb[o] = v;
      rgb[o + 1] = v;
      rgb[o + 2] = v;
    }
  } else {
    return { hist: new Array(24).fill(0), aspectRatio: 1 };
  }
  return computeVisualFingerprintFromRgb(rgb, w, h);
}

/**
 * Heuristiques visuelles : histogramme global + couleurs dominantes → `colorSim` ;
 * rapport d’aspect + histogramme de bords (structure) → `shapeSim`.
 */
export function compareVisualFingerprints(
  a: ImageVisualFingerprint,
  b: ImageVisualFingerprint,
): { colorSim: number; shapeSim: number } {
  let l1 = 0;
  for (let i = 0; i < a.hist.length; i++) {
    l1 += Math.abs(a.hist[i]! - b.hist[i]!);
  }
  const histSim = clamp01(1 - l1 * 0.5);

  const da = a.dominantRgb ?? dominantRgbFromHist(a.hist);
  const db = b.dominantRgb ?? dominantRgbFromHist(b.hist);
  const dominantSim = dominantRgbSimilarity(da, db);

  const colorSim = clamp01(0.55 * histSim + 0.45 * dominantSim);

  const dAr = Math.abs(a.aspectRatio - b.aspectRatio);
  const aspectSim = clamp01(1 - Math.min(1, dAr * 2.5));

  let shapeSim: number;
  if (a.edgeHist && b.edgeHist && a.edgeHist.length === b.edgeHist.length) {
    const edgeSim = edgeHistogramSimilarity(a.edgeHist, b.edgeHist);
    shapeSim = clamp01(0.45 * aspectSim + 0.55 * edgeSim);
  } else {
    shapeSim = aspectSim;
  }

  return { colorSim, shapeSim };
}

function clamp01(x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

export type ClipEmbedInput = string | { kind: "buffer"; buffer: Buffer };

/**
 * Décode toute entrée supportée vers un buffer brut (avant Sharp → CLIP).
 * Même logique pour indexation, requête et tests.
 */
export async function decodeClipEmbedInputToBuffer(
  imageInput: ClipEmbedInput,
  fallbackMime = "image/jpeg",
): Promise<Buffer> {
  if (typeof imageInput === "object" && imageInput != null && imageInput.kind === "buffer") {
    return imageInput.buffer;
  }
  const s = String(imageInput).trim();
  if (s.startsWith("data:image")) {
    const v = validateImagePayload(s);
    if (v.ok === false) throw new Error(`Image invalide : ${v.reason}`);
    return decodeImagePayload(s, fallbackMime).buffer;
  }
  if (s.startsWith("http://") || s.startsWith("https://")) {
    const res = await fetch(s, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`decodeClipEmbedInputToBuffer: HTTP ${res.status} pour ${s.slice(0, 80)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
  const full = `data:${fallbackMime};base64,${sanitizeBase64Chars(s)}`;
  const v = validateImagePayload(full);
  if (v.ok === false) throw new Error(`Image invalide : ${v.reason}`);
  return decodeImagePayload(full, fallbackMime).buffer;
}

/**
 * **Source unique de vérité** : buffer → Sharp 224×224 → CLIP → L2-normalisé [512].
 * Utilisé par l’indexation (URL) et la recherche (multipart / base64).
 */
export async function embedClipFromRawBuffer(rawBuf: Buffer): Promise<{
  embedding: number[];
  ready: ClipReadyImage;
}> {
  if (!Buffer.isBuffer(rawBuf) || rawBuf.length < 32) {
    throw new Error("Buffer image vide ou trop court.");
  }
  if (rawBuf.length > 25 * 1024 * 1024) {
    throw new Error("Image trop volumineuse (>25 Mo).");
  }
  let ready: ClipReadyImage;
  try {
    ready = await sharpPipelineToClipReady(rawBuf);
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[clipService] sharpPipelineToClipReady failed:", err);
    throw new Error(`Image illisible après traitement (${err.slice(0, 200)})`);
  }
  if (ready.width < 8 || ready.height < 8 || ready.rgb.length < 300) {
    throw new Error("Image CLIP trop petite après traitement (fichier corrompu ?).");
  }
  await loadClipVision();
  const t = await getTransformers();
  const embedding = await runClipOnRawPixels(t, ready);
  logClipEmbeddingDiagnostics(embedding, "embedClipFromRawBuffer");
  return { embedding, ready };
}

/** Recherche « minimaliste » : CLIP seul (pas de fingerprint / pHash). Voir `VISUAL_SEARCH_CLIP_ONLY`. */
export async function embedClipVectorOnly(
  imageInput: ClipEmbedInput,
  fallbackMime = "image/jpeg",
): Promise<number[]> {
  const rawBuf = await decodeClipEmbedInputToBuffer(imageInput, fallbackMime);
  const { embedding } = await embedClipFromRawBuffer(rawBuf);
  return embedding;
}

/**
 * Embedding CLIP + empreinte visuelle (un seul passage Sharp → 224×224).
 */
export async function embedImageWithFingerprint(
  imageInput: ClipEmbedInput,
  fallbackMime = "image/jpeg",
): Promise<{
  embedding: number[];
  fingerprint: ImageVisualFingerprint;
  perceptualHashHex: string;
}> {
  const rawBuf = await decodeClipEmbedInputToBuffer(imageInput, fallbackMime);
  const { embedding, ready } = await embedClipFromRawBuffer(rawBuf);
  const [fingerprint, perceptualHashHex] = await Promise.all([
    Promise.resolve(computeVisualFingerprintFromRgb(ready.rgb, ready.width, ready.height)),
    Promise.resolve(computePHashFromRgb(ready.rgb, ready.width, ready.height)),
  ]);
  return { embedding, fingerprint, perceptualHashHex };
}

/** Télécharge une image produit et calcule la même empreinte (budget ranking). */
export async function fetchFingerprintFromImageUrl(
  url: string | null | undefined,
): Promise<ImageVisualFingerprint | null> {
  if (!url || typeof url !== "string" || url.length < 8) return null;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const rawBuf = Buffer.from(await res.arrayBuffer());
    if (rawBuf.length < 32) return null;
    const ready = await sharpPipelineToClipReady(rawBuf);
    return computeVisualFingerprintFromRgb(ready.rgb, ready.width, ready.height);
  } catch {
    return null;
  }
}

/**
 * imageInput : data URL complète **ou** chaîne base64 pure (sans préfixe).
 */
export async function embedImageBase64(
  imageInput: string,
  mimeType = "image/jpeg",
): Promise<number[]> {
  const trimmed = imageInput.trim();
  const full = trimmed.startsWith("data:")
    ? trimmed
    : `data:${mimeType};base64,${sanitizeBase64Chars(trimmed)}`;

  const v = validateImagePayload(full);
  if (v.ok === false) {
    throw new Error(`Image invalide : ${v.reason}`);
  }

  const { buffer: rawBuf } = decodeImagePayload(full, mimeType);
  const { embedding } = await embedClipFromRawBuffer(rawBuf);
  return embedding;
}

/**
 * Image déjà en octets (ex. upload multipart) — même pipeline que URL / base64.
 */
export async function embedImageBuffer(rawBuf: Buffer): Promise<number[]> {
  const { embedding } = await embedClipFromRawBuffer(rawBuf);
  return embedding;
}

export async function embedImageFromUrl(url: string): Promise<number[]> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`embedImageFromUrl: HTTP ${res.status} pour ${url.slice(0, 80)}`);
  }
  const rawBuf = Buffer.from(await res.arrayBuffer());
  if (rawBuf.length < 32) {
    throw new Error("Téléchargement image : contenu trop court.");
  }
  const { embedding } = await embedClipFromRawBuffer(rawBuf);
  return embedding;
}

/** Indexation : embedding CLIP + pHash (même `ready` que CLIP). */
export async function embedImageFromUrlWithPHash(url: string): Promise<{
  embedding: number[];
  perceptualHashHex: string;
}> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`embedImageFromUrlWithPHash: HTTP ${res.status} pour ${url.slice(0, 80)}`);
  }
  const rawBuf = Buffer.from(await res.arrayBuffer());
  if (rawBuf.length < 32) {
    throw new Error("Téléchargement image : contenu trop court.");
  }
  const { embedding, ready } = await embedClipFromRawBuffer(rawBuf);
  const perceptualHashHex = computePHashFromRgb(ready.rgb, ready.width, ready.height);
  return { embedding, perceptualHashHex };
}
