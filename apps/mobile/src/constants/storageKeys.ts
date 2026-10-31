/**
 * Clés AsyncStorage partagées entre plusieurs écrans.
 * Regroupées ici pour éviter d'importer un écran complet juste pour lire une clé.
 */

/** Passe à `'true'` dès que l'onboarding a été terminé ou ignoré. */
export const INTRO_SEEN_KEY = '@a2express_intro_seen';

/** Passe à `'true'` lorsque l'utilisateur choisit d'explorer sans compte Firebase. */
export const GUEST_MODE_KEY = '@a2express_guest_mode';

/** Intention de navigation à reprendre après une connexion (JSON `{ href, params }`). */
export const PENDING_AUTH_INTENT_KEY = '@a2express_pending_auth_intent';

/** Commande NGenius en cours : survit à un retour téléphone / kill de l'app. */
export const PENDING_PAYMENT_ORDER_ID_KEY = '@a2express_pending_payment_order_id';
