import type { VisualSearchDescriptor } from "@/services/imageSearchGemini";

/**
 * Passe le base64 de la dernière sélection image au moment du `router.push` :
 * la lecture via `imageUri` échoue souvent (content://, chemins Expo) → sans ceci, pas d’appel CLIP.
 */
type Stash = { base64: string; mime: string; at: number };

let stash: Stash | null = null;

type DescriptorStash = { descriptor: VisualSearchDescriptor; at: number };

let descriptorStash: DescriptorStash | null = null;

/** Évite un second appel Gemini sur l’écran résultats : même analyse que le header. */
export function setVisualSearchDescriptor(descriptor: VisualSearchDescriptor): void {
  if (!descriptor || typeof descriptor !== "object") return;
  descriptorStash = { descriptor, at: Date.now() };
}

export function consumeVisualSearchDescriptor(
  maxAgeMs = 180_000,
): VisualSearchDescriptor | null {
  if (!descriptorStash) return null;
  if (Date.now() - descriptorStash.at > maxAgeMs) {
    descriptorStash = null;
    return null;
  }
  const { descriptor } = descriptorStash;
  descriptorStash = null;
  return descriptor;
}

export function setVisualSearchPickBase64(base64: string, mime: string): void {
  if (!base64 || typeof base64 !== "string") return;
  stash = {
    base64,
    mime: mime && mime.trim() ? mime.trim() : "image/jpeg",
    at: Date.now(),
  };
}

/** Consomme le tampon (une seule navigation). `maxAgeMs` évite une vieille image. */
export function consumeVisualSearchPickBase64(maxAgeMs = 180_000): {
  base64: string;
  mime: string;
} | null {
  if (!stash) return null;
  if (Date.now() - stash.at > maxAgeMs) {
    stash = null;
    return null;
  }
  const out = { base64: stash.base64, mime: stash.mime };
  stash = null;
  return out;
}
