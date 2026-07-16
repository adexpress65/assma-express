"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findExactPHashProductId = exports.hammingDistanceHex = exports.computePHashFromJpegBuffer = exports.computePHashFromRgb = exports.PHASH_EXACT_MAX_HAMMING = void 0;
const jpeg_js_1 = require("jpeg-js");
const PHASH_SIZE = 32;
const PHASH_LOW = 8;
exports.PHASH_EXACT_MAX_HAMMING = 8;
function dct1dOrtho(x) {
    const N = x.length;
    const out = new Float32Array(N);
    const c0 = Math.sqrt(1 / N);
    const ck = Math.sqrt(2 / N);
    const factor = Math.PI / N;
    for (let k = 0; k < N; k++) {
        let sum = 0;
        for (let n = 0; n < N; n++) {
            sum += x[n] * Math.cos(factor * (n + 0.5) * k);
        }
        out[k] = sum * (k === 0 ? c0 : ck);
    }
    return out;
}
function dct2d32x32(pixels) {
    const N = PHASH_SIZE;
    const temp = new Float32Array(N * N);
    const out = new Float32Array(N * N);
    const col = new Float32Array(N);
    for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++)
            col[y] = pixels[y * N + x];
        const d = dct1dOrtho(col);
        for (let y = 0; y < N; y++)
            temp[y * N + x] = d[y];
    }
    const row = new Float32Array(N);
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++)
            row[x] = temp[y * N + x];
        const d = dct1dOrtho(row);
        for (let x = 0; x < N; x++)
            out[y * N + x] = d[x];
    }
    return out;
}
function median64(values) {
    const s = [...values].sort((a, b) => a - b);
    const mid = 31;
    const mid2 = 32;
    return (s[mid] + s[mid2]) / 2;
}
function boxDownsampleLuma32(rgb, srcW, srcH) {
    const dst = PHASH_SIZE;
    const luma = new Float32Array(dst * dst);
    const scaleX = srcW / dst;
    const scaleY = srcH / dst;
    for (let y = 0; y < dst; y++) {
        for (let x = 0; x < dst; x++) {
            const x0 = Math.floor(x * scaleX);
            const y0 = Math.floor(y * scaleY);
            const x1 = Math.min(srcW, Math.ceil((x + 1) * scaleX));
            const y1 = Math.min(srcH, Math.ceil((y + 1) * scaleY));
            let sum = 0;
            let n = 0;
            for (let sy = y0; sy < y1; sy++) {
                for (let sx = x0; sx < x1; sx++) {
                    const i = (sy * srcW + sx) * 3;
                    const r = rgb[i];
                    const g = rgb[i + 1];
                    const b = rgb[i + 2];
                    sum += 0.299 * r + 0.587 * g + 0.114 * b;
                    n++;
                }
            }
            n = Math.max(1, n);
            luma[y * dst + x] = sum / n;
        }
    }
    return luma;
}
function rgbaToRgb(rgba, width, height) {
    const rgb = new Uint8ClampedArray(width * height * 3);
    for (let i = 0, j = 0; j < rgb.length; i += 4, j += 3) {
        rgb[j] = rgba[i];
        rgb[j + 1] = rgba[i + 1];
        rgb[j + 2] = rgba[i + 2];
    }
    return rgb;
}
function computePHashFromRgb(rgb, width, height) {
    if (width < 2 || height < 2)
        return "0".repeat(16);
    const pixels = boxDownsampleLuma32(rgb, width, height);
    const dct = dct2d32x32(pixels);
    const low = [];
    for (let y = 0; y < PHASH_LOW; y++) {
        for (let x = 0; x < PHASH_LOW; x++) {
            low.push(dct[y * PHASH_SIZE + x]);
        }
    }
    const med = median64(low);
    let h = 0n;
    for (let i = 0; i < 64; i++) {
        if (low[i] > med) {
            h |= 1n << BigInt(63 - i);
        }
    }
    return h.toString(16).padStart(16, "0");
}
exports.computePHashFromRgb = computePHashFromRgb;
function computePHashFromJpegBuffer(jpegBuf) {
    const decoded = (0, jpeg_js_1.decode)(jpegBuf, { useTArray: true });
    if (!decoded.data || decoded.width < 2 || decoded.height < 2)
        return "0".repeat(16);
    const w = decoded.width;
    const h = decoded.height;
    const n = w * h;
    let rgb;
    if (decoded.data.length === n * 4) {
        rgb = rgbaToRgb(decoded.data, w, h);
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
        return "0".repeat(16);
    }
    return computePHashFromRgb(rgb, w, h);
}
exports.computePHashFromJpegBuffer = computePHashFromJpegBuffer;
function hammingDistanceHex(a, b) {
    const na = a.trim().toLowerCase();
    const nb = b.trim().toLowerCase();
    if (na.length !== 16 || nb.length !== 16)
        return 64;
    try {
        const ba = BigInt("0x" + na);
        const bb = BigInt("0x" + nb);
        let x = ba ^ bb;
        let n = 0;
        while (x > 0n) {
            n += Number(x & 1n);
            x >>= 1n;
        }
        return n;
    }
    catch {
        return 64;
    }
}
exports.hammingDistanceHex = hammingDistanceHex;
function findExactPHashProductId(queryPHash, hits, maxHamming = exports.PHASH_EXACT_MAX_HAMMING) {
    if (!queryPHash || queryPHash.length !== 16)
        return null;
    let bestId = null;
    let bestD = maxHamming + 1;
    for (const h of hits) {
        const ph = h.perceptualHashHex;
        if (!ph || ph.length !== 16)
            continue;
        const d = hammingDistanceHex(queryPHash, ph);
        if (d < bestD) {
            bestD = d;
            bestId = h.productId;
        }
    }
    if (bestId === null || bestD > maxHamming)
        return null;
    return { productId: bestId, distance: bestD };
}
exports.findExactPHashProductId = findExactPHashProductId;
//# sourceMappingURL=perceptualHash.js.map