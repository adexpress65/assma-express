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

/** Traduction auto en / ar / zh (secret GOOGLE_TRANSLATE_API_KEY). */
export { onProductTranslate } from "./onProductTranslate";

/** Nettoyage / suppression conversations (Admin SDK, messages + fil). */
export { conversationModeration } from "./conversationModeration";

/** Recherche image : imports lourds chargés au premier appel HTTP uniquement. */
export { visualImageSearch } from "./visualImageSearch";
