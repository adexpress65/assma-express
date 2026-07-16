/**
 * Verrou rappel / diversification côté Cloud Function `visualImageSearch`.
 * Ne pas réduire sans QA ; voir `.cursor/rules/visual-search-recall.mdc`.
 */
export const VISUAL_SEARCH_RECALL_LOCK = {
  /** Têtes vectorielles exemptées du filtre intention / catégorie (rappel SKU exact). */
  vectorHeadCategoryExempt: 12,
  /** Seuil minimal `computeIntentCategoryTerm` pour conserver un hit (rappel vs bruit). */
  intentCategoryTermMin: 0.042,
  /** Plafond `protectTopK` pour la diversification (évite de vider le haut du classement). */
  diversifyProtectTopKMax: 45,
  /** Plancher `protectTopK` lié à `pageLimit`. */
  diversifyProtectTopKMinFromPage: 20,
} as const;
