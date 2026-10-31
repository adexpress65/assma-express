/**
 * Parcours Firestore pour la recherche visuelle.
 * Le match direct d’image va vite (sans pause). Index / fallback gardent une légère cadence anti-throttle.
 */

export const VISUAL_FIRESTORE_PAGE_SIZE = 500;

/**
 * Scan « match URL / nom de fichier » (ordre documentId).
 * Limiter les pages évite 14×500 lectures Firestore séquentielles (plusieurs minutes sur gros catalogue).
 */
export const DIRECT_IMAGE_MATCH_MAX_PAGES = 4;

/** Pause seulement pour index visuel & fallback (ms). */
export const FIRESTORE_PAGE_DELAY_MS = 100;

export async function paceFirestorePage(pageIndex: number): Promise<void> {
  if (pageIndex <= 0) return;
  await new Promise((r) => setTimeout(r, FIRESTORE_PAGE_DELAY_MS));
}

export const VISUAL_FALLBACK_MAX_PAGES = 8;

/** Scan Firestore sur l’écran résultats uniquement : évite 8×500 lectures + pauses. */
export const SEARCH_RESULTS_FIRESTORE_FALLBACK_MAX_PAGES = 2;

/** Pas de pause entre pages sur cet écran (affichage prioritaire). */
export const SEARCH_RESULTS_FIRESTORE_FALLBACK_PACE_MS = 0;

/** Index AsyncStorage : ~8 × 500 = 4000 (suffisant pour la similarité locale sans bloquer l’UI). */
export const VISUAL_INDEX_MAX_PAGES = 8;
