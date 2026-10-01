export type AuthGuardReason =
  | 'buy_now'
  | 'add_to_cart'
  | 'contact_seller'
  | 'messages'
  | 'account'
  | 'checkout'
  | 'generic';

export type AuthIntentHref = string;

export type RequireAuthOptions = {
  reason?: AuthGuardReason;
  /** Message personnalisé affiché dans la modale et le LoginModal. */
  message?: string;
  /** Destination après connexion (ex. `/(tabs)/messages`). */
  href?: AuthIntentHref;
  params?: Record<string, string>;
  /** Reprend l'action en cours une fois l'utilisateur authentifié. */
  onAuthorized?: () => void;
};
