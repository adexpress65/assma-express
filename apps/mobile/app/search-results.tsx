import React from "react";

import SearchResultsScreen from "@/screens/SearchResultsScreen";

/**
 * Import statique : pas d’attente de chunk JS au premier accès (recherche doit s’ouvrir vite).
 */
export default function SearchResultsRoute() {
  return <SearchResultsScreen />;
}
