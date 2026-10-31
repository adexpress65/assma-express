import React from "react";

/**
 * Import statique : l’écran est prêt au premier tap (pas d’attente de chunk JS comme avec lazy()).
 */
import CategoriesScreen from "../../src/screens/CategoriesScreen";

export default function CategoriesTabRoute() {
  return <CategoriesScreen />;
}
