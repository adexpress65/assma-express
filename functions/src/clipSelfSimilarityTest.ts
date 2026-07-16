/**
 * Auto-test CLIP : même buffer → deux passages → cosine ≈ 1.
 *
 * Usage (après `npm run build` dans functions/) :
 *   node lib/clipSelfSimilarityTest.js <chemin-image.jpg>
 *
 * Variables : CLIP_DEBUG_EMBEDDINGS=1 pour plus de logs.
 */
import { readFileSync, existsSync } from "fs";
import { embedClipFromRawBuffer, CLIP_DIMS } from "./services/clipService";

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    s += a[i]! * b[i]!;
  }
  return s;
}

async function main(): Promise<void> {
  const p = process.argv[2];
  if (!p || !existsSync(p)) {
    console.error("Usage: node lib/clipSelfSimilarityTest.js <image.jpg>");
    process.exit(1);
  }
  const buf = readFileSync(p);
  const { embedding: a } = await embedClipFromRawBuffer(buf);
  const { embedding: b } = await embedClipFromRawBuffer(Buffer.from(buf));

  const sim = dot(a, b);
  const l2a = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  const l2b = Math.sqrt(b.reduce((s, x) => s + x * x, 0));

  console.info(
    JSON.stringify(
      {
        dims: a.length,
        expectedDims: CLIP_DIMS,
        l2a: Number(l2a.toFixed(6)),
        l2b: Number(l2b.toFixed(6)),
        cosineSelf: Number(sim.toFixed(6)),
        passStrict: sim > 0.999,
      },
      null,
      2,
    ),
  );

  if (a.length !== CLIP_DIMS || b.length !== CLIP_DIMS) {
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
