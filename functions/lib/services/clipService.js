"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.embedImageFromUrlWithPHash = exports.embedImageFromUrl = exports.embedImageBuffer = exports.embedImageBase64 = exports.fetchFingerprintFromImageUrl = exports.embedImageWithFingerprint = exports.embedClipVectorOnly = exports.embedClipFromRawBuffer = exports.decodeClipEmbedInputToBuffer = exports.compareVisualFingerprints = exports.computeVisualFingerprintFromJpeg = exports.computeVisualFingerprintFromRgb = exports.embedClipText = exports.loadClipText = exports.loadClipVision = exports.validateImagePayload = exports.decodeImagePayload = exports.CLIP_DIMS = exports.CLIP_MODEL_ID = void 0;
const jpeg_js_1 = require("jpeg-js");
const perceptualHash_1 = require("./perceptualHash");
const os_1 = require("os");
const path_1 = require("path");
exports.CLIP_MODEL_ID = "Xenova/clip-vit-base-patch32";
exports.CLIP_DIMS = 512;
const CLIP_SPATIAL = 224;
const MAX_SIDE_BEFORE_CLIP = 512;
const MAX_PAYLOAD_CHARS = 14000000;
let transformersModule = null;
let processor = null;
let visionModel = null;
let clipTokenizer = null;
let clipTextModel = null;
async function getTransformers() {
    if (!transformersModule) {
        transformersModule = await Promise.resolve().then(() => __importStar(require("@xenova/transformers")));
        transformersModule.env.cacheDir = (0, path_1.join)((0, os_1.tmpdir)(), "xenova-cache");
        transformersModule.env.allowLocalModels = false;
    }
    return transformersModule;
}
function sanitizeBase64Chars(s) {
    return s.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
}
function decodeImagePayload(input, fallbackMime = "image/jpeg") {
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
        const mimePart = header.split(";")[0].replace(/^data:/i, "").trim() || fallbackMime;
        const buf = Buffer.from(body, "base64");
        return { buffer: buf, mime: mimePart };
    }
    const b64 = sanitizeBase64Chars(trimmed);
    const buf = Buffer.from(b64, "base64");
    return { buffer: buf, mime: fallbackMime };
}
exports.decodeImagePayload = decodeImagePayload;
function validateImagePayload(input) {
    if (!input || typeof input !== "string")
        return { ok: false, reason: "payload vide" };
    if (input.length > MAX_PAYLOAD_CHARS)
        return { ok: false, reason: "payload trop volumineux" };
    try {
        const { buffer } = decodeImagePayload(input);
        if (buffer.length < 32)
            return { ok: false, reason: "image décodée trop petite" };
        if (buffer.length > 22 * 1024 * 1024)
            return { ok: false, reason: "image décodée trop grande (>22 Mo)" };
        return { ok: true };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "décodage invalide";
        return { ok: false, reason: msg };
    }
}
exports.validateImagePayload = validateImagePayload;
function rawToRgb3(raw, width, height, channels) {
    const n = width * height;
    if (channels === 3)
        return raw;
    if (channels === 4) {
        const out = new Uint8ClampedArray(n * 3);
        for (let i = 0, o = 0; o < out.length; i += 4, o += 3) {
            out[o] = raw[i];
            out[o + 1] = raw[i + 1];
            out[o + 2] = raw[i + 2];
        }
        return out;
    }
    if (channels === 1) {
        const out = new Uint8ClampedArray(n * 3);
        for (let i = 0, o = 0; i < n; i++, o += 3) {
            const v = raw[i];
            out[o] = v;
            out[o + 1] = v;
            out[o + 2] = v;
        }
        return out;
    }
    throw new Error(`Canaux image non supportés pour CLIP (${channels}).`);
}
async function clipReadyWithJimp(input) {
    const { Jimp } = await Promise.resolve().then(() => __importStar(require("jimp")));
    console.info("[clipService] jimp pipeline (win32)", { bytes: input.length });
    const img = await Jimp.read(input);
    img.scaleToFit({ w: MAX_SIDE_BEFORE_CLIP, h: MAX_SIDE_BEFORE_CLIP });
    img.cover({ w: CLIP_SPATIAL, h: CLIP_SPATIAL });
    const { data, width, height } = img.bitmap;
    const src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const rgb = new Uint8ClampedArray(width * height * 3);
    for (let p = 0, o = 0; p < width * height * 4; p += 4, o += 3) {
        rgb[o] = src[p];
        rgb[o + 1] = src[p + 1];
        rgb[o + 2] = src[p + 2];
    }
    return { rgb, width, height };
}
async function clipReadyWithSharp(input) {
    const sharp = (await Promise.resolve().then(() => __importStar(require("sharp")))).default;
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
async function sharpPipelineToClipReady(input) {
    const useJimp = process.env.CLIP_USE_JIMP === "1";
    if (useJimp) {
        return clipReadyWithJimp(input);
    }
    return clipReadyWithSharp(input);
}
async function runClipOnRawPixels(t, ready) {
    try {
        const image = new t.RawImage(ready.rgb, ready.width, ready.height, 3);
        const inputs = await processor(image);
        const out = await visionModel(inputs);
        const vec = tensorToVector(out.image_embeds);
        return vec;
    }
    catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        console.error("[clipService] RawImage / CLIP failed:", err);
        throw new Error(`CLIP: échec inférence (${err.slice(0, 160)})`);
    }
}
async function loadClipVision() {
    if (processor && visionModel)
        return;
    const t = await getTransformers();
    processor = await t.AutoProcessor.from_pretrained(exports.CLIP_MODEL_ID);
    visionModel = await t.CLIPVisionModelWithProjection.from_pretrained(exports.CLIP_MODEL_ID);
}
exports.loadClipVision = loadClipVision;
async function loadClipText() {
    if (clipTokenizer && clipTextModel)
        return;
    const t = await getTransformers();
    clipTokenizer = await t.AutoTokenizer.from_pretrained(exports.CLIP_MODEL_ID);
    clipTextModel = await t.CLIPTextModelWithProjection.from_pretrained(exports.CLIP_MODEL_ID);
}
exports.loadClipText = loadClipText;
async function embedClipText(text) {
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
exports.embedClipText = embedClipText;
function l2Normalize(arr) {
    const norm = Math.sqrt(arr.reduce((s, x) => s + x * x, 0)) || 1;
    return arr.map((x) => x / norm);
}
function tensorToVector(image_embeds) {
    const raw = image_embeds.data;
    const arr = raw instanceof Float32Array ? Array.from(raw) : [...raw];
    if (arr.length !== exports.CLIP_DIMS) {
        throw new Error(`CLIP image_embeds: dimension ${arr.length} ≠ attendu ${exports.CLIP_DIMS}`);
    }
    return l2Normalize(arr);
}
function logClipEmbeddingDiagnostics(embedding, label) {
    const norm = Math.sqrt(embedding.reduce((s, x) => s + x * x, 0));
    const badDim = embedding.length !== exports.CLIP_DIMS;
    const badNorm = norm < 0.99 || norm > 1.01;
    if (process.env.CLIP_DEBUG_EMBEDDINGS === "1") {
        console.info("[clip]", label, {
            dim: embedding.length,
            l2: Number(norm.toFixed(6)),
            sample: [0, 128, 256, 511].map((i) => Number(embedding[i].toFixed(6))),
        });
    }
    else if (badDim || badNorm) {
        console.warn("[clip]", label, {
            dim: embedding.length,
            l2: Number(norm.toFixed(6)),
            badDim,
            badNorm,
        });
    }
}
function dominantRgbFromHist(hist) {
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
        r += t * (rBins[i] / sr);
        g += t * (gBins[i] / sg);
        b += t * (bBins[i] / sb);
    }
    return [r, g, b];
}
function dominantRgbSimilarity(a, b) {
    const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    return clamp01(1 - d / Math.sqrt(3));
}
function edgeHistogramFromLuma(luma, w, h) {
    const bins = new Array(8).fill(0);
    const gxK = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gyK = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    let maxMag = 1e-9;
    const mags = [];
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            let gx = 0;
            let gy = 0;
            let ki = 0;
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const v = luma[(y + ky) * w + (x + kx)];
                    gx += gxK[ki] * v;
                    gy += gyK[ki] * v;
                    ki += 1;
                }
            }
            const mag = Math.sqrt(gx * gx + gy * gy);
            mags.push(mag);
            if (mag > maxMag)
                maxMag = mag;
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
function edgeHistogramSimilarity(a, b) {
    let l1 = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        l1 += Math.abs(a[i] - b[i]);
    }
    return clamp01(1 - l1 * 0.5);
}
function boxDownsampleRgbTo32(rgb, srcW, srcH) {
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
                    r += rgb[i];
                    g += rgb[i + 1];
                    b += rgb[i + 2];
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
function computeVisualFingerprintFromRgb(rgb, srcW, srcH) {
    const { data, w, h } = boxDownsampleRgbTo32(rgb, srcW, srcH);
    const ar = srcW / Math.max(1, srcH);
    const hist = new Array(24).fill(0);
    const luma = new Float32Array(w * h);
    let pi = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = pi * 3;
            const rp = data[i] / 255;
            const gp = data[i + 1] / 255;
            const bp = data[i + 2] / 255;
            luma[pi] = 0.299 * rp + 0.587 * gp + 0.114 * bp;
            const r = Math.min(7, Math.floor(data[i] / 32));
            const g = Math.min(7, Math.floor(data[i + 1] / 32));
            const b = Math.min(7, Math.floor(data[i + 2] / 32));
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
exports.computeVisualFingerprintFromRgb = computeVisualFingerprintFromRgb;
function computeVisualFingerprintFromJpeg(jpegBuf) {
    const decoded = (0, jpeg_js_1.decode)(jpegBuf, { useTArray: true });
    if (!decoded.data || decoded.width < 2 || decoded.height < 2) {
        return {
            hist: new Array(24).fill(0),
            aspectRatio: 1,
        };
    }
    const w = decoded.width;
    const h = decoded.height;
    const n = w * h;
    let rgb;
    if (decoded.data.length === n * 4) {
        rgb = new Uint8ClampedArray(n * 3);
        for (let i = 0, o = 0; o < rgb.length; i += 4, o += 3) {
            rgb[o] = decoded.data[i];
            rgb[o + 1] = decoded.data[i + 1];
            rgb[o + 2] = decoded.data[i + 2];
        }
    }
    else if (decoded.data.length === n * 3) {
        rgb = new Uint8ClampedArray(decoded.data);
    }
    else if (decoded.data.length === n) {
        rgb = new Uint8ClampedArray(n * 3);
        for (let i = 0, o = 0; i < n; i++, o += 3) {
            const v = decoded.data[i];
            rgb[o] = v;
            rgb[o + 1] = v;
            rgb[o + 2] = v;
        }
    }
    else {
        return { hist: new Array(24).fill(0), aspectRatio: 1 };
    }
    return computeVisualFingerprintFromRgb(rgb, w, h);
}
exports.computeVisualFingerprintFromJpeg = computeVisualFingerprintFromJpeg;
function compareVisualFingerprints(a, b) {
    let l1 = 0;
    for (let i = 0; i < a.hist.length; i++) {
        l1 += Math.abs(a.hist[i] - b.hist[i]);
    }
    const histSim = clamp01(1 - l1 * 0.5);
    const da = a.dominantRgb ?? dominantRgbFromHist(a.hist);
    const db = b.dominantRgb ?? dominantRgbFromHist(b.hist);
    const dominantSim = dominantRgbSimilarity(da, db);
    const colorSim = clamp01(0.55 * histSim + 0.45 * dominantSim);
    const dAr = Math.abs(a.aspectRatio - b.aspectRatio);
    const aspectSim = clamp01(1 - Math.min(1, dAr * 2.5));
    let shapeSim;
    if (a.edgeHist && b.edgeHist && a.edgeHist.length === b.edgeHist.length) {
        const edgeSim = edgeHistogramSimilarity(a.edgeHist, b.edgeHist);
        shapeSim = clamp01(0.45 * aspectSim + 0.55 * edgeSim);
    }
    else {
        shapeSim = aspectSim;
    }
    return { colorSim, shapeSim };
}
exports.compareVisualFingerprints = compareVisualFingerprints;
function clamp01(x) {
    if (x <= 0)
        return 0;
    if (x >= 1)
        return 1;
    return x;
}
async function decodeClipEmbedInputToBuffer(imageInput, fallbackMime = "image/jpeg") {
    if (typeof imageInput === "object" && imageInput != null && imageInput.kind === "buffer") {
        return imageInput.buffer;
    }
    const s = String(imageInput).trim();
    if (s.startsWith("data:image")) {
        const v = validateImagePayload(s);
        if (v.ok === false)
            throw new Error(`Image invalide : ${v.reason}`);
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
    if (v.ok === false)
        throw new Error(`Image invalide : ${v.reason}`);
    return decodeImagePayload(full, fallbackMime).buffer;
}
exports.decodeClipEmbedInputToBuffer = decodeClipEmbedInputToBuffer;
async function embedClipFromRawBuffer(rawBuf) {
    if (!Buffer.isBuffer(rawBuf) || rawBuf.length < 32) {
        throw new Error("Buffer image vide ou trop court.");
    }
    if (rawBuf.length > 25 * 1024 * 1024) {
        throw new Error("Image trop volumineuse (>25 Mo).");
    }
    let ready;
    try {
        ready = await sharpPipelineToClipReady(rawBuf);
    }
    catch (e) {
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
exports.embedClipFromRawBuffer = embedClipFromRawBuffer;
async function embedClipVectorOnly(imageInput, fallbackMime = "image/jpeg") {
    const rawBuf = await decodeClipEmbedInputToBuffer(imageInput, fallbackMime);
    const { embedding } = await embedClipFromRawBuffer(rawBuf);
    return embedding;
}
exports.embedClipVectorOnly = embedClipVectorOnly;
async function embedImageWithFingerprint(imageInput, fallbackMime = "image/jpeg") {
    const rawBuf = await decodeClipEmbedInputToBuffer(imageInput, fallbackMime);
    const { embedding, ready } = await embedClipFromRawBuffer(rawBuf);
    const [fingerprint, perceptualHashHex] = await Promise.all([
        Promise.resolve(computeVisualFingerprintFromRgb(ready.rgb, ready.width, ready.height)),
        Promise.resolve((0, perceptualHash_1.computePHashFromRgb)(ready.rgb, ready.width, ready.height)),
    ]);
    return { embedding, fingerprint, perceptualHashHex };
}
exports.embedImageWithFingerprint = embedImageWithFingerprint;
async function fetchFingerprintFromImageUrl(url) {
    if (!url || typeof url !== "string" || url.length < 8)
        return null;
    try {
        const res = await fetch(url, { redirect: "follow" });
        if (!res.ok)
            return null;
        const rawBuf = Buffer.from(await res.arrayBuffer());
        if (rawBuf.length < 32)
            return null;
        const ready = await sharpPipelineToClipReady(rawBuf);
        return computeVisualFingerprintFromRgb(ready.rgb, ready.width, ready.height);
    }
    catch {
        return null;
    }
}
exports.fetchFingerprintFromImageUrl = fetchFingerprintFromImageUrl;
async function embedImageBase64(imageInput, mimeType = "image/jpeg") {
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
exports.embedImageBase64 = embedImageBase64;
async function embedImageBuffer(rawBuf) {
    const { embedding } = await embedClipFromRawBuffer(rawBuf);
    return embedding;
}
exports.embedImageBuffer = embedImageBuffer;
async function embedImageFromUrl(url) {
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
exports.embedImageFromUrl = embedImageFromUrl;
async function embedImageFromUrlWithPHash(url) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
        throw new Error(`embedImageFromUrlWithPHash: HTTP ${res.status} pour ${url.slice(0, 80)}`);
    }
    const rawBuf = Buffer.from(await res.arrayBuffer());
    if (rawBuf.length < 32) {
        throw new Error("Téléchargement image : contenu trop court.");
    }
    const { embedding, ready } = await embedClipFromRawBuffer(rawBuf);
    const perceptualHashHex = (0, perceptualHash_1.computePHashFromRgb)(ready.rgb, ready.width, ready.height);
    return { embedding, perceptualHashHex };
}
exports.embedImageFromUrlWithPHash = embedImageFromUrlWithPHash;
//# sourceMappingURL=clipService.js.map