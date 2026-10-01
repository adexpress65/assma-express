import * as admin from "firebase-admin";

// Initialisation minimale — le reste des dépendances lourdes est en import dynamique dans chaque handler.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * ============================================================
 * Exports Cloud Functions (chargement léger au déploiement)
 * ============================================================
 */

export { aiSearch as askAsmaAI } from "./aiSearch";

export { onNewChatMessagePush } from "./onNewChatMessagePush";

export { onProductWrite } from "./onProductWrite";

/** Cascade suppression / suspension boutique → isActive=false sur les produits. */
export { onCompanyDeleted, onCompanyUpdated } from "./onCompanyChange";

/** Traduction auto en / ar / zh (secret GOOGLE_TRANSLATE_API_KEY). */
export { onProductTranslate } from "./onProductTranslate";

/** Nettoyage / suppression conversations (Admin SDK, messages + fil). */
export { conversationModeration } from "./conversationModeration";

/** Recherche image : imports lourds chargés au premier appel HTTP uniquement. */
export { visualImageSearch } from "./visualImageSearch";

/** Attribution de rôle via custom claim (Admin SDK). Ne pas appeler avant migration. */
export { setUserRole } from "./setUserRole";

/** Lecture claim Auth + miroir Firestore pour l'écran gestion des rôles. */
export { lookupUserRoleSnapshot } from "./lookupUserRoleSnapshot";

/** Taux de change (1 CNY/USD → XOF) — 2 fois / jour, écrit `config/exchangeRates`. */
export { updateExchangeRates } from "./updateExchangeRates";
