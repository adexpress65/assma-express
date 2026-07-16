"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const clipService_1 = require("./services/clipService");
function dot(a, b) {
    let s = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        s += a[i] * b[i];
    }
    return s;
}
async function main() {
    const p = process.argv[2];
    if (!p || !(0, fs_1.existsSync)(p)) {
        console.error("Usage: node lib/clipSelfSimilarityTest.js <image.jpg>");
        process.exit(1);
    }
    const buf = (0, fs_1.readFileSync)(p);
    const { embedding: a } = await (0, clipService_1.embedClipFromRawBuffer)(buf);
    const { embedding: b } = await (0, clipService_1.embedClipFromRawBuffer)(Buffer.from(buf));
    const sim = dot(a, b);
    const l2a = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
    const l2b = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
    console.info(JSON.stringify({
        dims: a.length,
        expectedDims: clipService_1.CLIP_DIMS,
        l2a: Number(l2a.toFixed(6)),
        l2b: Number(l2b.toFixed(6)),
        cosineSelf: Number(sim.toFixed(6)),
        passStrict: sim > 0.999,
    }, null, 2));
    if (a.length !== clipService_1.CLIP_DIMS || b.length !== clipService_1.CLIP_DIMS) {
        console.error("ÉCHEC: dimension ≠ 512");
        process.exit(2);
    }
    if (sim < 0.999) {
        console.error("ÉCHEC: self-similarité attendue > 0.999 (même buffer deux fois)");
        process.exit(3);
    }
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=clipSelfSimilarityTest.js.map