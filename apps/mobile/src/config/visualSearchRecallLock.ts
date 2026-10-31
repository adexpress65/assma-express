/**
 * Verrou « rappel + grille » recherche visuelle (validé : SKU exact en tête, ~50 lignes).
 * Ne pas baisser ces valeurs sans session de test ; voir `.cursor/rules/visual-search-recall.mdc`.
 */
export const VISUAL_SEARCH_RECALL_LOCK = {
  /** Cosinus minimal UI / aligné requête API `minSimilarity`. */
  strictVisualMinSimilarity: 0.22,
  /** Cible de complément vectoriel avant fusion (proche du max API 50). */
  minVectorHitsTargetUi: 48,
  /** Objectif de lignes après verrou super-catégorie + complément CLIP. */
  gridTargetResults: 50,
  /**
   * Filtre strict catalogue : garder seulement si au moins ce ratio des hits bruts passe.
   * Sinon repli texte + CLIP (rayons Firestore imparfaits).
   */
  strictCatalogMinRatioOfRaw: 0.22,
  /** Minimum absolu de hits « strict catalogue » pour ne pas déclencher le repli. */
  strictCatalogMinAbsolute: 20,
  /** Taille d’une page API `visualImageSearch` (max serveur 50 par requête). */
  visualPageSize: 50,
} as const;
